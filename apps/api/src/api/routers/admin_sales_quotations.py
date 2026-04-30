from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    enforce_factory_scope,
    get_user_factory_scope_id,
    is_factory_scoped_user,
    require_orders_manage,
    require_orders_view,
)
from src.core.db.session import get_db
from src.api.routers.admin_audit import log_audit_event
from src.models.user import User
from src.schemas.orders import (
    SalesQuotationConvertRequest,
    SalesQuotationCreateRequest,
    SalesQuotationOut,
    SalesQuotationStatusRequest,
    SalesQuotationUpdateRequest,
)

router = APIRouter(prefix="/admin/sales-quotations", tags=["admin-sales-quotations"])

VAT_RATE = Decimal("0.00")
ALLOWED_EDITABLE_STATUSES = {"draft", "sent", "approved", "rejected", "expired"}
ALLOWED_CONVERT_STATUSES = {"approved", "sent", "draft"}


def _safe_decimal(value) -> Decimal:
    try:
        return Decimal(str(value or 0))
    except Exception:
        return Decimal("0.00")


def _normalize_optional_text(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


async def ensure_sales_quotations_tables(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS sales_quotations (
                id SERIAL PRIMARY KEY,
                quotation_number VARCHAR(100) NOT NULL,
                factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
                business_account_id INTEGER NULL REFERENCES business_accounts(id) ON DELETE SET NULL,
                converted_order_id INTEGER NULL REFERENCES customer_orders(id) ON DELETE SET NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'draft',
                customer_name VARCHAR(255),
                customer_phone VARCHAR(50),
                shipping_address TEXT,
                notes TEXT,
                subtotal_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
                vat_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
                total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
                valid_until TIMESTAMPTZ NULL,
                sent_at TIMESTAMPTZ NULL,
                approved_at TIMESTAMPTZ NULL,
                rejected_at TIMESTAMPTZ NULL,
                expired_at TIMESTAMPTZ NULL,
                converted_at TIMESTAMPTZ NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS sales_quotation_items (
                id SERIAL PRIMARY KEY,
                quotation_id INTEGER NOT NULL REFERENCES sales_quotations(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
                quantity INTEGER NOT NULL,
                unit_price NUMERIC(14, 2) NOT NULL,
                line_total NUMERIC(14, 2) NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_quotations_factory_number ON sales_quotations(factory_id, quotation_number)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_sales_quotations_factory_id ON sales_quotations(factory_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_sales_quotations_status ON sales_quotations(status)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_sales_quotation_items_quotation_id ON sales_quotation_items(quotation_id)"))
    await db.commit()


async def fetch_factory_name(db: AsyncSession, factory_id: int):
    result = await db.execute(
        text(
            """
            SELECT id, name
            FROM factories
            WHERE id = :factory_id
            LIMIT 1
            """
        ),
        {"factory_id": factory_id},
    )
    return result.mappings().first()


async def resolve_active_warehouse_for_factory(db: AsyncSession, factory_id: int) -> int:
    result = await db.execute(
        text(
            """
            SELECT id
            FROM warehouses
            WHERE factory_id = :factory_id
              AND is_active = TRUE
            ORDER BY id ASC
            LIMIT 1
            """
        ),
        {"factory_id": factory_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=409, detail=f"No active warehouse is available for factory #{factory_id}")
    return int(row["id"])


async def generate_quotation_number(db: AsyncSession, factory_id: int) -> str:
    prefix = f"SQ-{factory_id}"
    result = await db.execute(
        text(
            """
            SELECT quotation_number
            FROM sales_quotations
            WHERE factory_id = :factory_id
            ORDER BY id DESC
            LIMIT 1
            """
        ),
        {"factory_id": factory_id},
    )
    row = result.mappings().first()
    next_seq = 1
    if row and row.get("quotation_number"):
        raw = str(row["quotation_number"]).strip()
        if raw.startswith(prefix + "-"):
            try:
                next_seq = int(raw.split("-")[-1]) + 1
            except Exception:
                next_seq = 1
    return f"{prefix}-{str(next_seq).zfill(6)}"


async def generate_order_number(prefix: str = "ORD") -> str:
    return f"{prefix}-{uuid4().hex[:10].upper()}"


async def resolve_quotation_items_and_totals(db: AsyncSession, factory_id: int, items_payload):
    if not items_payload:
        raise HTTPException(status_code=400, detail="Quotation items are required")

    subtotal = Decimal("0.00")
    resolved_items = []

    for item in items_payload:
        if int(item.quantity) <= 0:
            raise HTTPException(status_code=400, detail="Item quantity must be greater than zero")

        product_result = await db.execute(
            text(
                """
                SELECT id, factory_id, is_active, base_price, name_ar, sku
                FROM products
                WHERE id = :product_id
                LIMIT 1
                """
            ),
            {"product_id": item.product_id},
        )
        product = product_result.mappings().first()

        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

        if not bool(product["is_active"]):
            raise HTTPException(status_code=409, detail=f"Product {item.product_id} is inactive")

        if product["factory_id"] is None:
            raise HTTPException(status_code=409, detail=f"Product {item.product_id} has no factory assignment")

        if int(product["factory_id"]) != int(factory_id):
            raise HTTPException(status_code=409, detail=f"Product {item.product_id} belongs to another factory")

        unit_price = _safe_decimal(item.unit_price if item.unit_price is not None else product["base_price"])
        if unit_price <= 0:
            raise HTTPException(status_code=400, detail=f"Product {item.product_id} has invalid unit price")

        quantity = int(item.quantity)
        line_total = (unit_price * quantity).quantize(Decimal("0.01"))
        subtotal += line_total

        resolved_items.append(
            {
                "product_id": int(product["id"]),
                "product_name": product["name_ar"],
                "sku": product["sku"],
                "quantity": quantity,
                "unit_price": unit_price.quantize(Decimal("0.01")),
                "line_total": line_total,
            }
        )

    vat_amount = (subtotal * VAT_RATE).quantize(Decimal("0.01"))
    total_amount = (subtotal + vat_amount).quantize(Decimal("0.01"))

    return {
        "items": resolved_items,
        "subtotal_amount": subtotal.quantize(Decimal("0.01")),
        "vat_amount": vat_amount,
        "total_amount": total_amount,
    }


async def fetch_quotation_or_404(db: AsyncSession, quotation_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                sq.*,
                f.name AS factory_name,
                co.order_number AS converted_order_number,
                (
                    SELECT COUNT(*)
                    FROM sales_quotation_items sqi
                    WHERE sqi.quotation_id = sq.id
                ) AS item_count
            FROM sales_quotations sq
            JOIN factories f ON f.id = sq.factory_id
            LEFT JOIN customer_orders co ON co.id = sq.converted_order_id
            WHERE sq.id = :quotation_id
            LIMIT 1
            """
        ),
        {"quotation_id": quotation_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Sales quotation not found")
    return row


async def fetch_quotation_items(db: AsyncSession, quotation_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                sqi.id,
                sqi.quotation_id,
                sqi.product_id,
                p.name_ar AS product_name,
                p.sku,
                sqi.quantity,
                sqi.unit_price,
                sqi.line_total
            FROM sales_quotation_items sqi
            JOIN products p ON p.id = sqi.product_id
            WHERE sqi.quotation_id = :quotation_id
            ORDER BY sqi.id ASC
            """
        ),
        {"quotation_id": quotation_id},
    )
    return result.mappings().all()


def serialize_quotation(row, items=None):
    data = dict(row)
    serialized_items = []
    for item in items or []:
        item_data = dict(item)
        serialized_items.append(
            {
                "id": item_data.get("id"),
                "quotation_id": item_data.get("quotation_id"),
                "product_id": item_data.get("product_id"),
                "product_name": item_data.get("product_name"),
                "sku": item_data.get("sku"),
                "quantity": int(item_data.get("quantity") or 0),
                "unit_price": str(item_data.get("unit_price")) if item_data.get("unit_price") is not None else "0.00",
                "line_total": str(item_data.get("line_total")) if item_data.get("line_total") is not None else "0.00",
            }
        )

    return {
        "id": data.get("id"),
        "quotation_number": data.get("quotation_number"),
        "factory_id": data.get("factory_id"),
        "factory_name": data.get("factory_name"),
        "business_account_id": data.get("business_account_id"),
        "converted_order_id": data.get("converted_order_id"),
        "converted_order_number": data.get("converted_order_number"),
        "status": data.get("status"),
        "customer_name": data.get("customer_name"),
        "customer_phone": data.get("customer_phone"),
        "shipping_address": data.get("shipping_address"),
        "notes": data.get("notes"),
        "subtotal_amount": str(data.get("subtotal_amount")) if data.get("subtotal_amount") is not None else "0.00",
        "vat_amount": str(data.get("vat_amount")) if data.get("vat_amount") is not None else "0.00",
        "total_amount": str(data.get("total_amount")) if data.get("total_amount") is not None else "0.00",
        "item_count": int(data.get("item_count") or len(serialized_items)),
        "valid_until": data.get("valid_until").isoformat() if data.get("valid_until") else None,
        "sent_at": data.get("sent_at").isoformat() if data.get("sent_at") else None,
        "approved_at": data.get("approved_at").isoformat() if data.get("approved_at") else None,
        "rejected_at": data.get("rejected_at").isoformat() if data.get("rejected_at") else None,
        "expired_at": data.get("expired_at").isoformat() if data.get("expired_at") else None,
        "converted_at": data.get("converted_at").isoformat() if data.get("converted_at") else None,
        "created_at": data.get("created_at").isoformat() if data.get("created_at") else None,
        "updated_at": data.get("updated_at").isoformat() if data.get("updated_at") else None,
        "items": serialized_items,
    }


async def create_work_order(db: AsyncSession, order_id: int, factory_id: int):
    await db.execute(
        text(
            """
            INSERT INTO work_orders (order_id, factory_id, status, notes)
            VALUES (:order_id, :factory_id, 'pending', 'Auto-created from quotation conversion')
            """
        ),
        {"order_id": order_id, "factory_id": factory_id},
    )


@router.get("")
async def list_sales_quotations(
    current_user: User = Depends(require_orders_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_sales_quotations_tables(db)

    params = {}
    where_sql = ""
    if is_factory_scoped_user(current_user):
        params["factory_id"] = get_user_factory_scope_id(current_user)
        where_sql = " WHERE sq.factory_id = :factory_id "

    result = await db.execute(
        text(
            f"""
            SELECT
                sq.*,
                f.name AS factory_name,
                co.order_number AS converted_order_number,
                (
                    SELECT COUNT(*)
                    FROM sales_quotation_items sqi
                    WHERE sqi.quotation_id = sq.id
                ) AS item_count
            FROM sales_quotations sq
            JOIN factories f ON f.id = sq.factory_id
            LEFT JOIN customer_orders co ON co.id = sq.converted_order_id
            {where_sql}
            ORDER BY sq.id DESC
            """
        ),
        params,
    )
    return [serialize_quotation(row) for row in result.mappings().all()]


@router.get("/summary")
async def get_sales_quotations_summary(
    current_user: User = Depends(require_orders_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_sales_quotations_tables(db)

    params = {}
    where_sql = ""
    if is_factory_scoped_user(current_user):
        params["factory_id"] = get_user_factory_scope_id(current_user)
        where_sql = " WHERE factory_id = :factory_id "

    total_count = int((await db.execute(text(f"SELECT COUNT(*) FROM sales_quotations {where_sql}"), params)).scalar() or 0)
    total_amount = float((await db.execute(text(f"SELECT COALESCE(SUM(total_amount), 0) FROM sales_quotations {where_sql}"), params)).scalar() or 0)
    draft_count = int((await db.execute(text(f"SELECT COUNT(*) FROM sales_quotations {where_sql + (' AND ' if where_sql else ' WHERE ')} status = 'draft'"), params)).scalar() or 0)
    sent_count = int((await db.execute(text(f"SELECT COUNT(*) FROM sales_quotations {where_sql + (' AND ' if where_sql else ' WHERE ')} status = 'sent'"), params)).scalar() or 0)
    approved_count = int((await db.execute(text(f"SELECT COUNT(*) FROM sales_quotations {where_sql + (' AND ' if where_sql else ' WHERE ')} status = 'approved'"), params)).scalar() or 0)
    rejected_count = int((await db.execute(text(f"SELECT COUNT(*) FROM sales_quotations {where_sql + (' AND ' if where_sql else ' WHERE ')} status = 'rejected'"), params)).scalar() or 0)
    converted_count = int((await db.execute(text(f"SELECT COUNT(*) FROM sales_quotations {where_sql + (' AND ' if where_sql else ' WHERE ')} status = 'converted'"), params)).scalar() or 0)
    expired_count = int((await db.execute(text(f"SELECT COUNT(*) FROM sales_quotations {where_sql + (' AND ' if where_sql else ' WHERE ')} status = 'expired'"), params)).scalar() or 0)

    return {
        "total_count": total_count,
        "total_amount": total_amount,
        "draft_count": draft_count,
        "sent_count": sent_count,
        "approved_count": approved_count,
        "rejected_count": rejected_count,
        "converted_count": converted_count,
        "expired_count": expired_count,
    }


@router.get("/{quotation_id}")
async def get_sales_quotation(
    quotation_id: int,
    current_user: User = Depends(require_orders_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_sales_quotations_tables(db)

    quotation = await fetch_quotation_or_404(db, quotation_id)
    enforce_factory_scope(current_user, quotation.get("factory_id"), "Access denied for this quotation factory scope")
    items = await fetch_quotation_items(db, quotation_id)
    return serialize_quotation(quotation, items)


@router.post("")
async def create_sales_quotation(
    payload: SalesQuotationCreateRequest,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_sales_quotations_tables(db)

    enforce_factory_scope(current_user, payload.factory_id, "Access denied for this quotation factory scope")

    factory = await fetch_factory_name(db, payload.factory_id)
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")

    calc = await resolve_quotation_items_and_totals(db, payload.factory_id, payload.items)
    quotation_number = await generate_quotation_number(db, payload.factory_id)

    try:
        insert_result = await db.execute(
            text(
                """
                INSERT INTO sales_quotations (
                    quotation_number,
                    factory_id,
                    business_account_id,
                    status,
                    customer_name,
                    customer_phone,
                    shipping_address,
                    notes,
                    subtotal_amount,
                    vat_amount,
                    total_amount,
                    valid_until
                )
                VALUES (
                    :quotation_number,
                    :factory_id,
                    :business_account_id,
                    'draft',
                    :customer_name,
                    :customer_phone,
                    :shipping_address,
                    :notes,
                    :subtotal_amount,
                    :vat_amount,
                    :total_amount,
                    :valid_until
                )
                RETURNING id
                """
            ),
            {
                "quotation_number": quotation_number,
                "factory_id": payload.factory_id,
                "business_account_id": payload.business_account_id,
                "customer_name": _normalize_optional_text(payload.customer_name),
                "customer_phone": _normalize_optional_text(payload.customer_phone),
                "shipping_address": _normalize_optional_text(payload.shipping_address),
                "notes": _normalize_optional_text(payload.notes),
                "subtotal_amount": calc["subtotal_amount"],
                "vat_amount": calc["vat_amount"],
                "total_amount": calc["total_amount"],
                "valid_until": payload.valid_until,
            },
        )
        quotation_id = int(insert_result.scalar())

        for item in calc["items"]:
            await db.execute(
                text(
                    """
                    INSERT INTO sales_quotation_items (
                        quotation_id,
                        product_id,
                        quantity,
                        unit_price,
                        line_total
                    )
                    VALUES (
                        :quotation_id,
                        :product_id,
                        :quantity,
                        :unit_price,
                        :line_total
                    )
                    """
                ),
                {
                    "quotation_id": quotation_id,
                    "product_id": item["product_id"],
                    "quantity": item["quantity"],
                    "unit_price": item["unit_price"],
                    "line_total": item["line_total"],
                },
            )

        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_quotation",
            entity_id=quotation_id,
            action="sales_quotation_created",
            factory_id=payload.factory_id,
            title="إنشاء عرض سعر",
            description=f"Created quotation {quotation_number}",
            reference_type="sales_quotation",
            reference_id=quotation_id,
            metadata={"quotation_number": quotation_number, "business_account_id": payload.business_account_id},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create sales quotation: {exc}")

    quotation = await fetch_quotation_or_404(db, quotation_id)
    items = await fetch_quotation_items(db, quotation_id)
    return serialize_quotation(quotation, items)


@router.put("/{quotation_id}")
async def update_sales_quotation(
    quotation_id: int,
    payload: SalesQuotationUpdateRequest,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_sales_quotations_tables(db)

    quotation = await fetch_quotation_or_404(db, quotation_id)
    enforce_factory_scope(current_user, quotation.get("factory_id"), "Access denied for this quotation factory scope")

    if str(quotation.get("status") or "") not in ALLOWED_EDITABLE_STATUSES:
        raise HTTPException(status_code=409, detail="Only editable quotations can be updated")

    calc = None
    if payload.items is not None:
        calc = await resolve_quotation_items_and_totals(db, int(quotation["factory_id"]), payload.items)

    try:
        await db.execute(
            text(
                """
                UPDATE sales_quotations
                SET
                    customer_name = :customer_name,
                    customer_phone = :customer_phone,
                    shipping_address = :shipping_address,
                    notes = :notes,
                    valid_until = :valid_until,
                    subtotal_amount = :subtotal_amount,
                    vat_amount = :vat_amount,
                    total_amount = :total_amount,
                    updated_at = NOW()
                WHERE id = :quotation_id
                """
            ),
            {
                "quotation_id": quotation_id,
                "customer_name": _normalize_optional_text(payload.customer_name) if payload.customer_name is not None else quotation.get("customer_name"),
                "customer_phone": _normalize_optional_text(payload.customer_phone) if payload.customer_phone is not None else quotation.get("customer_phone"),
                "shipping_address": _normalize_optional_text(payload.shipping_address) if payload.shipping_address is not None else quotation.get("shipping_address"),
                "notes": _normalize_optional_text(payload.notes) if payload.notes is not None else quotation.get("notes"),
                "valid_until": payload.valid_until if payload.valid_until is not None else quotation.get("valid_until"),
                "subtotal_amount": calc["subtotal_amount"] if calc else quotation.get("subtotal_amount"),
                "vat_amount": calc["vat_amount"] if calc else quotation.get("vat_amount"),
                "total_amount": calc["total_amount"] if calc else quotation.get("total_amount"),
            },
        )

        if calc is not None:
            await db.execute(
                text("DELETE FROM sales_quotation_items WHERE quotation_id = :quotation_id"),
                {"quotation_id": quotation_id},
            )
            for item in calc["items"]:
                await db.execute(
                    text(
                        """
                        INSERT INTO sales_quotation_items (
                            quotation_id,
                            product_id,
                            quantity,
                            unit_price,
                            line_total
                        )
                        VALUES (
                            :quotation_id,
                            :product_id,
                            :quantity,
                            :unit_price,
                            :line_total
                        )
                        """
                    ),
                    {
                        "quotation_id": quotation_id,
                        "product_id": item["product_id"],
                        "quantity": item["quantity"],
                        "unit_price": item["unit_price"],
                        "line_total": item["line_total"],
                    },
                )

        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_quotation",
            entity_id=quotation_id,
            action="sales_quotation_updated",
            factory_id=quotation.get("factory_id"),
            title="تحديث عرض سعر",
            description=f"Updated quotation {quotation.get('quotation_number')}",
            reference_type="sales_quotation",
            reference_id=quotation_id,
            metadata={"status": quotation.get("status")},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update sales quotation: {exc}")

    updated = await fetch_quotation_or_404(db, quotation_id)
    items = await fetch_quotation_items(db, quotation_id)
    return serialize_quotation(updated, items)


@router.post("/{quotation_id}/send")
async def send_sales_quotation(
    quotation_id: int,
    payload: SalesQuotationStatusRequest | None = None,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_sales_quotations_tables(db)

    quotation = await fetch_quotation_or_404(db, quotation_id)
    enforce_factory_scope(current_user, quotation.get("factory_id"), "Access denied for this quotation factory scope")

    status = str(quotation.get("status") or "")
    if status == "converted":
        raise HTTPException(status_code=409, detail="Converted quotation cannot be sent")
    if status == "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled quotation cannot be sent")

    notes = _normalize_optional_text((payload or SalesQuotationStatusRequest()).notes)

    try:
        await db.execute(
            text(
                """
                UPDATE sales_quotations
                SET
                    status = 'sent',
                    sent_at = COALESCE(sent_at, NOW()),
                    notes = COALESCE(:notes, notes),
                    updated_at = NOW()
                WHERE id = :quotation_id
                """
            ),
            {"quotation_id": quotation_id, "notes": notes},
        )
        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_quotation",
            entity_id=quotation_id,
            action="sales_quotation_sent",
            factory_id=quotation.get("factory_id"),
            title="إرسال عرض سعر",
            description=f"إرسال عرض سعر - {quotation.get('quotation_number')}",
            reference_type="sales_quotation",
            reference_id=quotation_id,
            metadata={"previous_status": quotation.get("status")},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to send sales quotation: {exc}")

    updated = await fetch_quotation_or_404(db, quotation_id)
    items = await fetch_quotation_items(db, quotation_id)
    return serialize_quotation(updated, items)


@router.post("/{quotation_id}/approve")
async def approve_sales_quotation(
    quotation_id: int,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_sales_quotations_tables(db)

    quotation = await fetch_quotation_or_404(db, quotation_id)
    enforce_factory_scope(current_user, quotation.get("factory_id"), "Access denied for this quotation factory scope")

    if str(quotation.get("status") or "") == "converted":
        raise HTTPException(status_code=409, detail="Converted quotation cannot be approved")
    if str(quotation.get("status") or "") == "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled quotation cannot be approved")

    try:
        await db.execute(
            text(
                """
                UPDATE sales_quotations
                SET
                    status = 'approved',
                    approved_at = NOW(),
                    rejected_at = NULL,
                    expired_at = NULL,
                    updated_at = NOW()
                WHERE id = :quotation_id
                """
            ),
            {"quotation_id": quotation_id},
        )
        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_quotation",
            entity_id=quotation_id,
            action="sales_quotation_approved",
            factory_id=quotation.get("factory_id"),
            title="اعتماد عرض سعر",
            description=f"اعتماد عرض سعر - {quotation.get('quotation_number')}",
            reference_type="sales_quotation",
            reference_id=quotation_id,
            metadata={"previous_status": quotation.get("status")},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to approve sales quotation: {exc}")

    updated = await fetch_quotation_or_404(db, quotation_id)
    items = await fetch_quotation_items(db, quotation_id)
    return serialize_quotation(updated, items)


@router.post("/{quotation_id}/reject")
async def reject_sales_quotation(
    quotation_id: int,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_sales_quotations_tables(db)

    quotation = await fetch_quotation_or_404(db, quotation_id)
    enforce_factory_scope(current_user, quotation.get("factory_id"), "Access denied for this quotation factory scope")

    if str(quotation.get("status") or "") == "converted":
        raise HTTPException(status_code=409, detail="Converted quotation cannot be rejected")
    if str(quotation.get("status") or "") == "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled quotation cannot be rejected")

    try:
        await db.execute(
            text(
                """
                UPDATE sales_quotations
                SET
                    status = 'rejected',
                    rejected_at = NOW(),
                    approved_at = NULL,
                    expired_at = NULL,
                    updated_at = NOW()
                WHERE id = :quotation_id
                """
            ),
            {"quotation_id": quotation_id},
        )
        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_quotation",
            entity_id=quotation_id,
            action="sales_quotation_rejected",
            factory_id=quotation.get("factory_id"),
            title="رفض عرض سعر",
            description=f"رفض عرض سعر - {quotation.get('quotation_number')}",
            reference_type="sales_quotation",
            reference_id=quotation_id,
            metadata={"previous_status": quotation.get("status")},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to reject sales quotation: {exc}")

    updated = await fetch_quotation_or_404(db, quotation_id)
    items = await fetch_quotation_items(db, quotation_id)
    return serialize_quotation(updated, items)


@router.post("/{quotation_id}/expire")
async def expire_sales_quotation(
    quotation_id: int,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_sales_quotations_tables(db)

    quotation = await fetch_quotation_or_404(db, quotation_id)
    enforce_factory_scope(current_user, quotation.get("factory_id"), "Access denied for this quotation factory scope")

    if str(quotation.get("status") or "") == "converted":
        raise HTTPException(status_code=409, detail="Converted quotation cannot be expired")
    if str(quotation.get("status") or "") == "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled quotation cannot be expired")

    try:
        await db.execute(
            text(
                """
                UPDATE sales_quotations
                SET
                    status = 'expired',
                    expired_at = NOW(),
                    updated_at = NOW()
                WHERE id = :quotation_id
                """
            ),
            {"quotation_id": quotation_id},
        )
        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_quotation",
            entity_id=quotation_id,
            action="sales_quotation_expired",
            factory_id=quotation.get("factory_id"),
            title="انتهاء عرض سعر",
            description=f"انتهاء عرض سعر - {quotation.get('quotation_number')}",
            reference_type="sales_quotation",
            reference_id=quotation_id,
            metadata={"previous_status": quotation.get("status")},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to expire sales quotation: {exc}")

    updated = await fetch_quotation_or_404(db, quotation_id)
    items = await fetch_quotation_items(db, quotation_id)
    return serialize_quotation(updated, items)


@router.post("/{quotation_id}/cancel")
async def cancel_sales_quotation(
    quotation_id: int,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_sales_quotations_tables(db)

    quotation = await fetch_quotation_or_404(db, quotation_id)
    enforce_factory_scope(current_user, quotation.get("factory_id"), "Access denied for this quotation factory scope")

    if str(quotation.get("status") or "") == "converted":
        raise HTTPException(status_code=409, detail="Converted quotation cannot be cancelled")

    try:
        await db.execute(
            text(
                """
                UPDATE sales_quotations
                SET
                    status = 'cancelled',
                    updated_at = NOW()
                WHERE id = :quotation_id
                """
            ),
            {"quotation_id": quotation_id},
        )
        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_quotation",
            entity_id=quotation_id,
            action="sales_quotation_cancelled",
            factory_id=quotation.get("factory_id"),
            title="إلغاء عرض سعر",
            description=f"إلغاء عرض سعر - {quotation.get('quotation_number')}",
            reference_type="sales_quotation",
            reference_id=quotation_id,
            metadata={"previous_status": quotation.get("status")},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to cancel sales quotation: {exc}")

    updated = await fetch_quotation_or_404(db, quotation_id)
    items = await fetch_quotation_items(db, quotation_id)
    return serialize_quotation(updated, items)


@router.post("/{quotation_id}/convert")
async def convert_sales_quotation_to_order(
    quotation_id: int,
    payload: SalesQuotationConvertRequest | None = None,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_sales_quotations_tables(db)

    quotation = await fetch_quotation_or_404(db, quotation_id)
    enforce_factory_scope(current_user, quotation.get("factory_id"), "Access denied for this quotation factory scope")

    status = str(quotation.get("status") or "")
    if status == "converted":
        raise HTTPException(status_code=409, detail="Quotation already converted to order")
    if status not in ALLOWED_CONVERT_STATUSES:
        raise HTTPException(status_code=409, detail="Only draft / sent / approved quotations can be converted")

    quotation_items = await fetch_quotation_items(db, quotation_id)
    if not quotation_items:
        raise HTTPException(status_code=409, detail="Quotation has no items")

    factory_id = int(quotation["factory_id"])
    warehouse_id = await resolve_active_warehouse_for_factory(db, factory_id)

    try:
        order_number = await generate_order_number("ORD")
        order_result = await db.execute(
            text(
                """
                INSERT INTO customer_orders (
                    order_number,
                    user_id,
                    business_account_id,
                    order_type,
                    status,
                    payment_status,
                    subtotal_amount,
                    vat_amount,
                    total_amount,
                    customer_name,
                    customer_phone,
                    shipping_address,
                    notes,
                    factory_id,
                    warehouse_id,
                    parent_order_id,
                    is_master_order
                )
                VALUES (
                    :order_number,
                    NULL,
                    :business_account_id,
                    'b2b',
                    'order_received',
                    'pending',
                    :subtotal_amount,
                    :vat_amount,
                    :total_amount,
                    :customer_name,
                    :customer_phone,
                    :shipping_address,
                    :notes,
                    :factory_id,
                    :warehouse_id,
                    NULL,
                    FALSE
                )
                RETURNING id
                """
            ),
            {
                "order_number": order_number,
                "business_account_id": quotation.get("business_account_id"),
                "subtotal_amount": quotation.get("subtotal_amount"),
                "vat_amount": quotation.get("vat_amount"),
                "total_amount": quotation.get("total_amount"),
                "customer_name": quotation.get("customer_name"),
                "customer_phone": quotation.get("customer_phone"),
                "shipping_address": quotation.get("shipping_address"),
                "notes": _normalize_optional_text((payload or SalesQuotationConvertRequest()).notes) or quotation.get("notes"),
                "factory_id": factory_id,
                "warehouse_id": warehouse_id,
            },
        )
        order_id = int(order_result.scalar())

        for item in quotation_items:
            await db.execute(
                text(
                    """
                    INSERT INTO customer_order_items (
                        order_id,
                        product_id,
                        quantity,
                        unit_price,
                        line_total
                    )
                    VALUES (
                        :order_id,
                        :product_id,
                        :quantity,
                        :unit_price,
                        :line_total
                    )
                    """
                ),
                {
                    "order_id": order_id,
                    "product_id": item["product_id"],
                    "quantity": int(item["quantity"]),
                    "unit_price": item["unit_price"],
                    "line_total": item["line_total"],
                },
            )

        await create_work_order(db, order_id, factory_id)

        await db.execute(
            text(
                """
                UPDATE sales_quotations
                SET
                    status = 'converted',
                    converted_order_id = :order_id,
                    converted_at = NOW(),
                    approved_at = COALESCE(approved_at, NOW()),
                    updated_at = NOW()
                WHERE id = :quotation_id
                """
            ),
            {"quotation_id": quotation_id, "order_id": order_id},
        )

        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_quotation",
            entity_id=quotation_id,
            action="sales_quotation_converted",
            factory_id=factory_id,
            title="تحويل عرض السعر إلى طلب",
            description=f"Converted quotation {quotation.get('quotation_number')} to order {order_number}",
            reference_type="customer_order",
            reference_id=order_id,
            metadata={"quotation_number": quotation.get("quotation_number"), "order_number": order_number},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to convert quotation to order: {exc}")

    updated = await fetch_quotation_or_404(db, quotation_id)
    items = await fetch_quotation_items(db, quotation_id)
    return serialize_quotation(updated, items)
