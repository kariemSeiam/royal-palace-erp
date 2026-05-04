from datetime import date, datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    ensure_not_blocked_admin_role,
    get_current_user_and_role,
    get_user_factory_scope_id,
)
from src.core.db.session import get_db
from src.models.user import User
try:
    from src.models.procurement_rfq import ProcurementRFQ, SupplierQuotation, SupplierQuotationItem
except ImportError:
    ProcurementRFQ = None
    SupplierQuotation = None
    SupplierQuotationItem = None
from src.api.routers.admin_audit import log_audit_event
from src.services.procurement_service import ProcurementService

router = APIRouter(prefix="/admin/procurement", tags=["admin-procurement"])


def _normalize_permission_set(permissions) -> set[str]:
    return {
        str(code or "").strip().lower()
        for code in (permissions or set())
        if str(code or "").strip()
    }


def _has_any_permission(permissions: set[str], *codes: str) -> bool:
    wanted = {str(code or "").strip().lower() for code in codes if str(code or "").strip()}
    return any(code in permissions for code in wanted)


async def require_procurement_view(
    actor=Depends(get_current_user_and_role),
):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    normalized = _normalize_permission_set(permissions)

    if user.is_superuser:
        return user

    if not _has_any_permission(
        normalized,
        "procurement.view",
        "procurement.manage",
        "inventory.view",
        "inventory.manage",
        "orders.view",
        "orders.manage",
    ):
        raise HTTPException(status_code=403, detail="Procurement access denied")

    return user


async def require_procurement_manage(
    actor=Depends(get_current_user_and_role),
):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    normalized = _normalize_permission_set(permissions)

    if user.is_superuser:
        return user

    if not _has_any_permission(
        normalized,
        "procurement.manage",
        "inventory.manage",
        "orders.manage",
    ):
        raise HTTPException(status_code=403, detail="Procurement management access denied")

    return user


def _scoped_factory_id_or_none(current_user: User):
    if getattr(current_user, "is_superuser", False):
        return None
    return get_user_factory_scope_id(current_user)


def _enforce_target_factory(current_user: User, target_factory_id: int | None):
    if getattr(current_user, "is_superuser", False):
        return

    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    if scoped_factory_id is None:
        return

    if target_factory_id is None:
        raise HTTPException(status_code=403, detail="Factory scope is required")

    if int(scoped_factory_id) != int(target_factory_id):
        raise HTTPException(status_code=403, detail="Access denied for this factory scope")


def _clean_text(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _to_int(value, field_name: str, required: bool = False):
    if value in [None, ""]:
        if required:
            raise HTTPException(status_code=400, detail=f"{field_name} is required")
        return None
    try:
        return int(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")


def _to_float(value, field_name: str, required: bool = False):
    if value in [None, ""]:
        if required:
            raise HTTPException(status_code=400, detail=f"{field_name} is required")
        return None
    try:
        return float(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")


def _today() -> date:
    return datetime.utcnow().date()


async def ensure_procurement_tables(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS suppliers (
                id SERIAL PRIMARY KEY,
                factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
                code VARCHAR(100) NOT NULL,
                name VARCHAR(255) NOT NULL,
                contact_name VARCHAR(255) NULL,
                phone VARCHAR(100) NULL,
                email VARCHAR(255) NULL,
                address TEXT NULL,
                notes TEXT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_suppliers_factory_code
            ON suppliers(factory_id, code)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_suppliers_factory_id
            ON suppliers(factory_id)
            """
        )
    )

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS purchase_orders (
                id SERIAL PRIMARY KEY,
                factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
                supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
                warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
                po_number VARCHAR(100) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'draft',
                expected_date DATE NULL,
                notes TEXT NULL,
                created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                approved_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                approved_at TIMESTAMPTZ NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_purchase_orders_factory_po_number
            ON purchase_orders(factory_id, po_number)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_purchase_orders_factory_id
            ON purchase_orders(factory_id)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_purchase_orders_supplier_id
            ON purchase_orders(supplier_id)
            """
        )
    )

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS purchase_order_items (
                id SERIAL PRIMARY KEY,
                purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
                quantity NUMERIC(14, 2) NOT NULL DEFAULT 0,
                unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
                line_total NUMERIC(14, 2) NOT NULL DEFAULT 0,
                notes TEXT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_purchase_order_items_purchase_order_id
            ON purchase_order_items(purchase_order_id)
            """
        )
    )

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS purchase_receipts (
                id SERIAL PRIMARY KEY,
                purchase_order_id INTEGER NOT NULL REFERENCES purchase_orders(id) ON DELETE CASCADE,
                purchase_order_item_id INTEGER NOT NULL REFERENCES purchase_order_items(id) ON DELETE CASCADE,
                warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
                received_quantity NUMERIC(14, 2) NOT NULL DEFAULT 0,
                unit_cost NUMERIC(14, 2) NOT NULL DEFAULT 0,
                notes TEXT NULL,
                received_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_purchase_receipts_purchase_order_id
            ON purchase_receipts(purchase_order_id)
            """
        )
    )

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS supplier_invoices (
                id SERIAL PRIMARY KEY,
                factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
                supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
                purchase_order_id INTEGER NULL REFERENCES purchase_orders(id) ON DELETE SET NULL,
                invoice_number VARCHAR(100) NOT NULL,
                invoice_date DATE NOT NULL,
                due_date DATE NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'open',
                subtotal_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
                vat_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
                total_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
                paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
                remaining_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
                notes TEXT NULL,
                created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_supplier_invoices_factory_invoice_number
            ON supplier_invoices(factory_id, invoice_number)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_supplier_invoices_factory_id
            ON supplier_invoices(factory_id)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_supplier_invoices_supplier_id
            ON supplier_invoices(supplier_id)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_supplier_invoices_purchase_order_id
            ON supplier_invoices(purchase_order_id)
            """
        )
    )

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS supplier_payments (
                id SERIAL PRIMARY KEY,
                factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
                supplier_id INTEGER NOT NULL REFERENCES suppliers(id) ON DELETE RESTRICT,
                supplier_invoice_id INTEGER NULL REFERENCES supplier_invoices(id) ON DELETE SET NULL,
                payment_date DATE NOT NULL,
                amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
                payment_method VARCHAR(100) NULL,
                reference_number VARCHAR(100) NULL,
                notes TEXT NULL,
                created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_supplier_payments_factory_id
            ON supplier_payments(factory_id)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_supplier_payments_supplier_id
            ON supplier_payments(supplier_id)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_supplier_payments_supplier_invoice_id
            ON supplier_payments(supplier_invoice_id)
            """
        )
    )

    await db.commit()


async def _factory_exists(db: AsyncSession, factory_id: int):
    result = await db.execute(
        text("SELECT id, name FROM factories WHERE id = :factory_id LIMIT 1"),
        {"factory_id": factory_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Factory not found")
    return row


async def _warehouse_exists_in_factory(db: AsyncSession, warehouse_id: int, factory_id: int):
    result = await db.execute(
        text(
            """
            SELECT id, factory_id, name, code, is_active
            FROM warehouses
            WHERE id = :warehouse_id
              AND factory_id = :factory_id
            LIMIT 1
            """
        ),
        {"warehouse_id": warehouse_id, "factory_id": factory_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Warehouse not found in this factory")
    if not bool(row["is_active"]):
        raise HTTPException(status_code=409, detail="Warehouse is inactive")
    return row


async def _product_exists_in_factory(db: AsyncSession, product_id: int, factory_id: int):
    result = await db.execute(
        text(
            """
            SELECT id, factory_id, name_ar, sku, is_active
            FROM products
            WHERE id = :product_id
              AND factory_id = :factory_id
            LIMIT 1
            """
        ),
        {"product_id": product_id, "factory_id": factory_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Product not found in this factory")
    if row.get("is_active") is False:
        raise HTTPException(status_code=409, detail="Product is inactive")
    return row


async def _supplier_or_404(db: AsyncSession, supplier_id: int):
    result = await db.execute(
        text(
            """
            SELECT s.*, f.name AS factory_name
            FROM suppliers s
            JOIN factories f ON f.id = s.factory_id
            WHERE s.id = :supplier_id
            LIMIT 1
            """
        ),
        {"supplier_id": supplier_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Supplier not found")
    return row


async def _purchase_order_or_404(db: AsyncSession, purchase_order_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                po.*,
                f.name AS factory_name,
                s.name AS supplier_name,
                s.code AS supplier_code,
                w.name AS warehouse_name,
                w.code AS warehouse_code,
                cu.full_name AS created_by_name,
                au.full_name AS approved_by_name
            FROM purchase_orders po
            JOIN factories f ON f.id = po.factory_id
            JOIN suppliers s ON s.id = po.supplier_id
            JOIN warehouses w ON w.id = po.warehouse_id
            LEFT JOIN users cu ON cu.id = po.created_by_user_id
            LEFT JOIN users au ON au.id = po.approved_by_user_id
            WHERE po.id = :purchase_order_id
            LIMIT 1
            """
        ),
        {"purchase_order_id": purchase_order_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Purchase order not found")
    return row


async def _supplier_invoice_or_404(db: AsyncSession, supplier_invoice_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                si.*,
                f.name AS factory_name,
                s.name AS supplier_name,
                s.code AS supplier_code,
                po.po_number,
                u.full_name AS created_by_name
            FROM supplier_invoices si
            JOIN factories f ON f.id = si.factory_id
            JOIN suppliers s ON s.id = si.supplier_id
            LEFT JOIN purchase_orders po ON po.id = si.purchase_order_id
            LEFT JOIN users u ON u.id = si.created_by_user_id
            WHERE si.id = :supplier_invoice_id
            LIMIT 1
            """
        ),
        {"supplier_invoice_id": supplier_invoice_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Supplier invoice not found")
    return row


async def _fetch_invoice_payments(db: AsyncSession, supplier_invoice_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                sp.id,
                sp.factory_id,
                sp.supplier_id,
                sp.supplier_invoice_id,
                sp.payment_date,
                sp.amount,
                sp.payment_method,
                sp.reference_number,
                sp.notes,
                sp.created_by_user_id,
                sp.created_at,
                u.full_name AS created_by_name
            FROM supplier_payments sp
            LEFT JOIN users u ON u.id = sp.created_by_user_id
            WHERE sp.supplier_invoice_id = :supplier_invoice_id
            ORDER BY sp.id DESC
            """
        ),
        {"supplier_invoice_id": supplier_invoice_id},
    )
    return [dict(row) for row in result.mappings().all()]


async def _fetch_purchase_order_items(db: AsyncSession, purchase_order_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                poi.id,
                poi.purchase_order_id,
                poi.product_id,
                poi.quantity,
                poi.unit_cost,
                poi.line_total,
                poi.notes,
                poi.created_at,
                poi.updated_at,
                p.name_ar AS product_name,
                p.sku AS product_sku,
                COALESCE((
                    SELECT SUM(pr.received_quantity)
                    FROM purchase_receipts pr
                    WHERE pr.purchase_order_item_id = poi.id
                ), 0) AS received_quantity
            FROM purchase_order_items poi
            JOIN products p ON p.id = poi.product_id
            WHERE poi.purchase_order_id = :purchase_order_id
            ORDER BY poi.id ASC
            """
        ),
        {"purchase_order_id": purchase_order_id},
    )

    rows = []
    for row in result.mappings().all():
        data = dict(row)
        ordered_qty = float(data.get("quantity") or 0)
        received_qty = float(data.get("received_quantity") or 0)
        rows.append(
            {
                "id": data.get("id"),
                "purchase_order_id": data.get("purchase_order_id"),
                "product_id": data.get("product_id"),
                "product_name": data.get("product_name"),
                "product_sku": data.get("product_sku"),
                "quantity": ordered_qty,
                "received_quantity": received_qty,
                "remaining_quantity": max(ordered_qty - received_qty, 0),
                "unit_cost": float(data.get("unit_cost") or 0),
                "line_total": float(data.get("line_total") or 0),
                "notes": data.get("notes"),
                "created_at": data.get("created_at"),
                "updated_at": data.get("updated_at"),
            }
        )
    return rows


async def _fetch_purchase_receipts(db: AsyncSession, purchase_order_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                pr.id,
                pr.purchase_order_id,
                pr.purchase_order_item_id,
                pr.warehouse_id,
                pr.product_id,
                pr.received_quantity,
                pr.unit_cost,
                pr.notes,
                pr.received_by_user_id,
                pr.created_at,
                p.name_ar AS product_name,
                p.sku AS product_sku,
                w.name AS warehouse_name,
                w.code AS warehouse_code,
                u.full_name AS received_by_name
            FROM purchase_receipts pr
            JOIN products p ON p.id = pr.product_id
            JOIN warehouses w ON w.id = pr.warehouse_id
            LEFT JOIN users u ON u.id = pr.received_by_user_id
            WHERE pr.purchase_order_id = :purchase_order_id
            ORDER BY pr.id DESC
            """
        ),
        {"purchase_order_id": purchase_order_id},
    )
    return [dict(row) for row in result.mappings().all()]


def _serialize_supplier(row):
    data = dict(row)
    return {
        "id": data.get("id"),
        "factory_id": data.get("factory_id"),
        "factory_name": data.get("factory_name"),
        "code": data.get("code"),
        "name": data.get("name"),
        "contact_name": data.get("contact_name"),
        "phone": data.get("phone"),
        "email": data.get("email"),
        "address": data.get("address"),
        "notes": data.get("notes"),
        "is_active": bool(data.get("is_active")) if data.get("is_active") is not None else True,
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
    }


def _serialize_purchase_order(row, items=None, receipts=None):
    data = dict(row)
    safe_items = items or []
    safe_receipts = receipts or []
    total_ordered = sum(float(item.get("quantity") or 0) for item in safe_items)
    total_received = sum(float(item.get("received_quantity") or 0) for item in safe_items)
    total_value = sum(float(item.get("line_total") or 0) for item in safe_items)

    return {
        "id": data.get("id"),
        "factory_id": data.get("factory_id"),
        "factory_name": data.get("factory_name"),
        "supplier_id": data.get("supplier_id"),
        "supplier_name": data.get("supplier_name"),
        "supplier_code": data.get("supplier_code"),
        "warehouse_id": data.get("warehouse_id"),
        "warehouse_name": data.get("warehouse_name"),
        "warehouse_code": data.get("warehouse_code"),
        "po_number": data.get("po_number"),
        "status": data.get("status"),
        "expected_date": str(data.get("expected_date")) if data.get("expected_date") is not None else None,
        "notes": data.get("notes"),
        "created_by_user_id": data.get("created_by_user_id"),
        "created_by_name": data.get("created_by_name"),
        "approved_by_user_id": data.get("approved_by_user_id"),
        "approved_by_name": data.get("approved_by_name"),
        "approved_at": data.get("approved_at"),
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
        "items": safe_items,
        "items_count": len(safe_items),
        "receipts": safe_receipts,
        "receipts_count": len(safe_receipts),
        "total_ordered_quantity": total_ordered,
        "total_received_quantity": total_received,
        "total_remaining_quantity": max(total_ordered - total_received, 0),
        "total_value": total_value,
        "fully_received": len(safe_items) > 0 and all(float(item.get("remaining_quantity") or 0) <= 0 for item in safe_items),
    }


def _serialize_supplier_invoice(row, payments=None):
    data = dict(row)
    safe_payments = payments or []
    total_paid = float(data.get("paid_amount") or 0)
    total_amount = float(data.get("total_amount") or 0)
    remaining_amount = float(data.get("remaining_amount") or max(total_amount - total_paid, 0))

    return {
        "id": data.get("id"),
        "factory_id": data.get("factory_id"),
        "factory_name": data.get("factory_name"),
        "supplier_id": data.get("supplier_id"),
        "supplier_name": data.get("supplier_name"),
        "supplier_code": data.get("supplier_code"),
        "purchase_order_id": data.get("purchase_order_id"),
        "po_number": data.get("po_number"),
        "invoice_number": data.get("invoice_number"),
        "invoice_date": str(data.get("invoice_date")) if data.get("invoice_date") is not None else None,
        "due_date": str(data.get("due_date")) if data.get("due_date") is not None else None,
        "status": data.get("status"),
        "subtotal_amount": float(data.get("subtotal_amount") or 0),
        "vat_amount": float(data.get("vat_amount") or 0),
        "total_amount": total_amount,
        "paid_amount": total_paid,
        "remaining_amount": remaining_amount,
        "notes": data.get("notes"),
        "created_by_user_id": data.get("created_by_user_id"),
        "created_by_name": data.get("created_by_name"),
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
        "payments": safe_payments,
        "payments_count": len(safe_payments),
        "is_overdue": bool(data.get("due_date") is not None and remaining_amount > 0 and data.get("due_date") < _today()),
    }


async def _validate_po_items_payload(db: AsyncSession, factory_id: int, items: list):
    if not isinstance(items, list) or len(items) == 0:
        raise HTTPException(status_code=400, detail="At least one purchase order item is required")

    normalized_items = []
    for index, item in enumerate(items):
        product_id = _to_int(item.get("product_id"), f"items[{index}].product_id", required=True)
        quantity = _to_float(item.get("quantity"), f"items[{index}].quantity", required=True)
        unit_cost = _to_float(item.get("unit_cost"), f"items[{index}].unit_cost", required=True)
        notes = _clean_text(item.get("notes"))

        if quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Quantity must be greater than zero for item #{index + 1}")
        if unit_cost < 0:
            raise HTTPException(status_code=400, detail=f"Unit cost cannot be negative for item #{index + 1}")

        await _product_exists_in_factory(db, product_id, factory_id)

        normalized_items.append(
            {
                "product_id": product_id,
                "quantity": quantity,
                "unit_cost": unit_cost,
                "line_total": quantity * unit_cost,
                "notes": notes,
            }
        )

    return normalized_items


async def _refresh_po_status_from_receipts(db: AsyncSession, purchase_order_id: int):
    items = await _fetch_purchase_order_items(db, purchase_order_id)
    if not items:
        next_status = "draft"
    else:
        total_received = sum(float(item.get("received_quantity") or 0) for item in items)
        if total_received <= 0:
            next_status = "approved"
        elif all(float(item.get("remaining_quantity") or 0) <= 0 for item in items):
            next_status = "received"
        else:
            next_status = "partially_received"

    await db.execute(
        text(
            """
            UPDATE purchase_orders
            SET
                status = :status,
                updated_at = NOW()
            WHERE id = :purchase_order_id
            """
        ),
        {"purchase_order_id": purchase_order_id, "status": next_status},
    )
    return next_status


async def _refresh_invoice_paid_state(db: AsyncSession, supplier_invoice_id: int):
    invoice = await _supplier_invoice_or_404(db, supplier_invoice_id)

    payments_sum_result = await db.execute(
        text(
            """
            SELECT COALESCE(SUM(amount), 0) AS total_paid
            FROM supplier_payments
            WHERE supplier_invoice_id = :supplier_invoice_id
            """
        ),
        {"supplier_invoice_id": supplier_invoice_id},
    )
    total_paid = float(payments_sum_result.scalar() or 0)
    total_amount = float(invoice.get("total_amount") or 0)
    remaining_amount = max(total_amount - total_paid, 0)

    if remaining_amount <= 0 and total_amount > 0:
        next_status = "paid"
    elif total_paid > 0:
        next_status = "partially_paid"
    else:
        next_status = "open"

    await db.execute(
        text(
            """
            UPDATE supplier_invoices
            SET
                paid_amount = :paid_amount,
                remaining_amount = :remaining_amount,
                status = :status,
                updated_at = NOW()
            WHERE id = :supplier_invoice_id
            """
        ),
        {
            "supplier_invoice_id": supplier_invoice_id,
            "paid_amount": total_paid,
            "remaining_amount": remaining_amount,
            "status": next_status,
        },
    )
    return {
        "paid_amount": total_paid,
        "remaining_amount": remaining_amount,
        "status": next_status,
    }


@router.get("/suppliers")
async def list_suppliers(
    current_user: User = Depends(require_procurement_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    sql = """
        SELECT
            s.*,
            f.name AS factory_name
        FROM suppliers s
        JOIN factories f ON f.id = s.factory_id
    """
    params = {}
    if scoped_factory_id is not None:
        sql += " WHERE s.factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id

    sql += " ORDER BY s.id DESC"
    result = await db.execute(text(sql), params)
    return [_serialize_supplier(row) for row in result.mappings().all()]


@router.post("/suppliers", status_code=status.HTTP_201_CREATED)
async def create_supplier(
    payload: dict,
    current_user: User = Depends(require_procurement_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)

    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    requested_factory_id = _to_int(payload.get("factory_id"), "factory_id", required=scoped_factory_id is None)
    target_factory_id = scoped_factory_id if scoped_factory_id is not None else requested_factory_id

    _enforce_target_factory(current_user, target_factory_id)
    await _factory_exists(db, target_factory_id)

    code = _clean_text(payload.get("code"))
    name = _clean_text(payload.get("name"))

    if not code:
        raise HTTPException(status_code=400, detail="code is required")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    duplicate = await db.execute(
        text(
            """
            SELECT id
            FROM suppliers
            WHERE factory_id = :factory_id
              AND (code = :code OR name = :name)
            LIMIT 1
            """
        ),
        {"factory_id": target_factory_id, "code": code, "name": name},
    )
    if duplicate.first():
        raise HTTPException(status_code=409, detail="Supplier code or name already exists in this factory")

    result = await db.execute(
        text(
            """
            INSERT INTO suppliers (
                factory_id, code, name, contact_name, phone, email, address, notes, is_active
            )
            VALUES (
                :factory_id, :code, :name, :contact_name, :phone, :email, :address, :notes, :is_active
            )
            RETURNING id
            """
        ),
        {
            "factory_id": target_factory_id,
            "code": code,
            "name": name,
            "contact_name": _clean_text(payload.get("contact_name")),
            "phone": _clean_text(payload.get("phone")),
            "email": _clean_text(payload.get("email")),
            "address": _clean_text(payload.get("address")),
            "notes": _clean_text(payload.get("notes")),
            "is_active": bool(payload.get("is_active", True)),
        },
    )
    supplier_id = result.scalar_one()
    await log_audit_event(
        db,
        current_user=current_user,
        module="procurement",
        entity_type="purchase_order",
        entity_id=purchase_order_id,
        action="purchase_order_updated",
        factory_id=current.get("factory_id"),
        title="تحديث أمر شراء",
        description=f"Updated purchase order {current.get('po_number')}",
        reference_type="purchase_order",
        reference_id=purchase_order_id,
        metadata={"status": status_value, "approved_now": set_approved_now},
    )
    await db.commit()

    row = await _supplier_or_404(db, supplier_id)
    return _serialize_supplier(row)


@router.put("/suppliers/{supplier_id}")
async def update_supplier(
    supplier_id: int,
    payload: dict,
    current_user: User = Depends(require_procurement_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    current = await _supplier_or_404(db, supplier_id)
    _enforce_target_factory(current_user, current.get("factory_id"))

    code = _clean_text(payload.get("code"))
    name = _clean_text(payload.get("name"))
    if not code:
        raise HTTPException(status_code=400, detail="code is required")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    duplicate = await db.execute(
        text(
            """
            SELECT id
            FROM suppliers
            WHERE factory_id = :factory_id
              AND id != :supplier_id
              AND (code = :code OR name = :name)
            LIMIT 1
            """
        ),
        {
            "factory_id": current["factory_id"],
            "supplier_id": supplier_id,
            "code": code,
            "name": name,
        },
    )
    if duplicate.first():
        raise HTTPException(status_code=409, detail="Supplier code or name already exists in this factory")

    await db.execute(
        text(
            """
            UPDATE suppliers
            SET
                code = :code,
                name = :name,
                contact_name = :contact_name,
                phone = :phone,
                email = :email,
                address = :address,
                notes = :notes,
                is_active = :is_active,
                updated_at = NOW()
            WHERE id = :supplier_id
            """
        ),
        {
            "supplier_id": supplier_id,
            "code": code,
            "name": name,
            "contact_name": _clean_text(payload.get("contact_name")),
            "phone": _clean_text(payload.get("phone")),
            "email": _clean_text(payload.get("email")),
            "address": _clean_text(payload.get("address")),
            "notes": _clean_text(payload.get("notes")),
            "is_active": bool(payload.get("is_active", True)),
        },
    )
    await log_audit_event(
        db,
        current_user=current_user,
        module="procurement",
        entity_type="supplier",
        entity_id=supplier_id,
        action="supplier_updated",
        factory_id=current.get("factory_id"),
        title="تحديث بيانات مورد",
        description=f"Updated supplier {name} with code {code}",
        reference_type="supplier",
        reference_id=supplier_id,
        metadata={"supplier_code": code, "supplier_name": name},
    )
    await db.commit()

    row = await _supplier_or_404(db, supplier_id)
    return _serialize_supplier(row)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(
    supplier_id: int,
    current_user: User = Depends(require_procurement_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    current = await _supplier_or_404(db, supplier_id)
    _enforce_target_factory(current_user, current.get("factory_id"))

    linked = await db.execute(
        text("SELECT id FROM purchase_orders WHERE supplier_id = :supplier_id LIMIT 1"),
        {"supplier_id": supplier_id},
    )
    if linked.first():
        raise HTTPException(status_code=409, detail="Cannot delete supplier linked to purchase orders")

    linked_invoices = await db.execute(
        text("SELECT id FROM supplier_invoices WHERE supplier_id = :supplier_id LIMIT 1"),
        {"supplier_id": supplier_id},
    )
    if linked_invoices.first():
        raise HTTPException(status_code=409, detail="Cannot delete supplier linked to supplier invoices")

    await db.execute(text("DELETE FROM suppliers WHERE id = :supplier_id"), {"supplier_id": supplier_id})
    await db.commit()
    return {"ok": True, "deleted_supplier_id": supplier_id}


@router.get("/purchase-orders")
async def list_purchase_orders(
    current_user: User = Depends(require_procurement_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    sql = """
        SELECT
            po.*,
            f.name AS factory_name,
            s.name AS supplier_name,
            s.code AS supplier_code,
            w.name AS warehouse_name,
            w.code AS warehouse_code,
            cu.full_name AS created_by_name,
            au.full_name AS approved_by_name
        FROM purchase_orders po
        JOIN factories f ON f.id = po.factory_id
        JOIN suppliers s ON s.id = po.supplier_id
        JOIN warehouses w ON w.id = po.warehouse_id
        LEFT JOIN users cu ON cu.id = po.created_by_user_id
        LEFT JOIN users au ON au.id = po.approved_by_user_id
    """
    params = {}
    if scoped_factory_id is not None:
        sql += " WHERE po.factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id
    sql += " ORDER BY po.id DESC"

    result = await db.execute(text(sql), params)
    rows = result.mappings().all()

    output = []
    for row in rows:
        items = await _fetch_purchase_order_items(db, int(row["id"]))
        receipts = await _fetch_purchase_receipts(db, int(row["id"]))
        output.append(_serialize_purchase_order(row, items=items, receipts=receipts))
    return output


@router.post("/purchase-orders", status_code=status.HTTP_201_CREATED)
async def create_purchase_order(
    payload: dict,
    current_user: User = Depends(require_procurement_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)

    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    requested_factory_id = _to_int(payload.get("factory_id"), "factory_id", required=scoped_factory_id is None)
    target_factory_id = scoped_factory_id if scoped_factory_id is not None else requested_factory_id

    _enforce_target_factory(current_user, target_factory_id)
    await _factory_exists(db, target_factory_id)

    supplier_id = _to_int(payload.get("supplier_id"), "supplier_id", required=True)
    warehouse_id = _to_int(payload.get("warehouse_id"), "warehouse_id", required=True)
    po_number = _clean_text(payload.get("po_number"))
    expected_date = _clean_text(payload.get("expected_date"))
    notes = _clean_text(payload.get("notes"))

    if not po_number:
        raise HTTPException(status_code=400, detail="po_number is required")

    supplier = await _supplier_or_404(db, supplier_id)
    if int(supplier["factory_id"]) != int(target_factory_id):
        raise HTTPException(status_code=409, detail="Supplier does not belong to this factory")

    await _warehouse_exists_in_factory(db, warehouse_id, target_factory_id)

    duplicate = await db.execute(
        text(
            """
            SELECT id
            FROM purchase_orders
            WHERE factory_id = :factory_id
              AND po_number = :po_number
            LIMIT 1
            """
        ),
        {"factory_id": target_factory_id, "po_number": po_number},
    )
    if duplicate.first():
        raise HTTPException(status_code=409, detail="PO number already exists in this factory")

    normalized_items = await _validate_po_items_payload(db, target_factory_id, payload.get("items") or [])

    result = await db.execute(
        text(
            """
            INSERT INTO purchase_orders (
                factory_id,
                supplier_id,
                warehouse_id,
                po_number,
                status,
                expected_date,
                notes,
                created_by_user_id
            )
            VALUES (
                :factory_id,
                :supplier_id,
                :warehouse_id,
                :po_number,
                'draft',
                :expected_date,
                :notes,
                :created_by_user_id
            )
            RETURNING id
            """
        ),
        {
            "factory_id": target_factory_id,
            "supplier_id": supplier_id,
            "warehouse_id": warehouse_id,
            "po_number": po_number,
            "expected_date": expected_date,
            "notes": notes,
            "created_by_user_id": getattr(current_user, "id", None),
        },
    )
    purchase_order_id = result.scalar_one()

    for item in normalized_items:
        await db.execute(
            text(
                """
                INSERT INTO purchase_order_items (
                    purchase_order_id,
                    product_id,
                    quantity,
                    unit_cost,
                    line_total,
                    notes
                )
                VALUES (
                    :purchase_order_id,
                    :product_id,
                    :quantity,
                    :unit_cost,
                    :line_total,
                    :notes
                )
                """
            ),
            {
                "purchase_order_id": purchase_order_id,
                "product_id": item["product_id"],
                "quantity": item["quantity"],
                "unit_cost": item["unit_cost"],
                "line_total": item["line_total"],
                "notes": item["notes"],
            },
        )

    await log_audit_event(
        db,
        current_user=current_user,
        module="procurement",
        entity_type="purchase_order",
        entity_id=purchase_order_id,
        action="purchase_order_created",
        factory_id=target_factory_id,
        title="إنشاء أمر شراء",
        description=f"Created purchase order {po_number}",
        reference_type="purchase_order",
        reference_id=purchase_order_id,
        metadata={"supplier_id": supplier_id, "warehouse_id": warehouse_id, "items_count": len(normalized_items)},
    )
    await db.commit()

    po = await _purchase_order_or_404(db, purchase_order_id)
    po_items = await _fetch_purchase_order_items(db, purchase_order_id)
    po_receipts = await _fetch_purchase_receipts(db, purchase_order_id)
    return _serialize_purchase_order(po, items=po_items, receipts=po_receipts)


@router.put("/purchase-orders/{purchase_order_id}")
async def update_purchase_order(
    purchase_order_id: int,
    payload: dict,
    current_user: User = Depends(require_procurement_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    current = await _purchase_order_or_404(db, purchase_order_id)
    _enforce_target_factory(current_user, current.get("factory_id"))

    current_status = str(current.get("status") or "draft")
    if current_status not in {"draft", "submitted", "approved"}:
        raise HTTPException(status_code=409, detail="Only draft, submitted, or approved purchase orders can be edited")

    receipts = await _fetch_purchase_receipts(db, purchase_order_id)
    if receipts:
        raise HTTPException(status_code=409, detail="Cannot edit purchase order items after receipts exist")

    supplier_id = _to_int(payload.get("supplier_id", current["supplier_id"]), "supplier_id", required=True)
    warehouse_id = _to_int(payload.get("warehouse_id", current["warehouse_id"]), "warehouse_id", required=True)
    po_number = _clean_text(payload.get("po_number", current["po_number"]))
    expected_date = _clean_text(payload.get("expected_date", current.get("expected_date")))
    notes = _clean_text(payload.get("notes", current.get("notes")))
    status_value = _clean_text(payload.get("status", current_status)) or current_status

    allowed_statuses = {"draft", "submitted", "approved", "cancelled"}
    if status_value not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid purchase order status")

    supplier = await _supplier_or_404(db, supplier_id)
    if int(supplier["factory_id"]) != int(current["factory_id"]):
        raise HTTPException(status_code=409, detail="Supplier does not belong to this factory")

    await _warehouse_exists_in_factory(db, warehouse_id, int(current["factory_id"]))

    duplicate = await db.execute(
        text(
            """
            SELECT id
            FROM purchase_orders
            WHERE factory_id = :factory_id
              AND id != :purchase_order_id
              AND po_number = :po_number
            LIMIT 1
            """
        ),
        {
            "factory_id": current["factory_id"],
            "purchase_order_id": purchase_order_id,
            "po_number": po_number,
        },
    )
    if duplicate.first():
        raise HTTPException(status_code=409, detail="PO number already exists in this factory")

    normalized_items = await _validate_po_items_payload(db, int(current["factory_id"]), payload.get("items") or [])

    approved_by_user_id = current.get("approved_by_user_id")
    set_approved_now = status_value == "approved" and current.get("approved_at") is None
    if set_approved_now:
        approved_by_user_id = getattr(current_user, "id", None)

    if set_approved_now:
        await db.execute(
            text(
                """
                UPDATE purchase_orders
                SET
                    supplier_id = :supplier_id,
                    warehouse_id = :warehouse_id,
                    po_number = :po_number,
                    status = :status,
                    expected_date = :expected_date,
                    notes = :notes,
                    approved_by_user_id = :approved_by_user_id,
                    approved_at = NOW(),
                    updated_at = NOW()
                WHERE id = :purchase_order_id
                """
            ),
            {
                "purchase_order_id": purchase_order_id,
                "supplier_id": supplier_id,
                "warehouse_id": warehouse_id,
                "po_number": po_number,
                "status": status_value,
                "expected_date": expected_date,
                "notes": notes,
                "approved_by_user_id": approved_by_user_id,
            },
        )
    else:
        await db.execute(
            text(
                """
                UPDATE purchase_orders
                SET
                    supplier_id = :supplier_id,
                    warehouse_id = :warehouse_id,
                    po_number = :po_number,
                    status = :status,
                    expected_date = :expected_date,
                    notes = :notes,
                    updated_at = NOW()
                WHERE id = :purchase_order_id
                """
            ),
            {
                "purchase_order_id": purchase_order_id,
                "supplier_id": supplier_id,
                "warehouse_id": warehouse_id,
                "po_number": po_number,
                "status": status_value,
                "expected_date": expected_date,
                "notes": notes,
            },
        )

    await db.execute(
        text("DELETE FROM purchase_order_items WHERE purchase_order_id = :purchase_order_id"),
        {"purchase_order_id": purchase_order_id},
    )

    for item in normalized_items:
        await db.execute(
            text(
                """
                INSERT INTO purchase_order_items (
                    purchase_order_id,
                    product_id,
                    quantity,
                    unit_cost,
                    line_total,
                    notes
                )
                VALUES (
                    :purchase_order_id,
                    :product_id,
                    :quantity,
                    :unit_cost,
                    :line_total,
                    :notes
                )
                """
            ),
            {
                "purchase_order_id": purchase_order_id,
                "product_id": item["product_id"],
                "quantity": item["quantity"],
                "unit_cost": item["unit_cost"],
                "line_total": item["line_total"],
                "notes": item["notes"],
            },
        )

    await log_audit_event(
        db,
        current_user=current_user,
        module="procurement",
        entity_type="purchase_order",
        entity_id=purchase_order_id,
        action="purchase_order_updated",
        factory_id=current.get("factory_id"),
        title="تحديث أمر شراء",
        description=f"Updated purchase order {current.get('po_number')}",
        reference_type="purchase_order",
        reference_id=purchase_order_id,
        metadata={"status": status_value, "approved_now": set_approved_now},
    )
    await db.commit()

    po = await _purchase_order_or_404(db, purchase_order_id)
    po_items = await _fetch_purchase_order_items(db, purchase_order_id)
    po_receipts = await _fetch_purchase_receipts(db, purchase_order_id)
    return _serialize_purchase_order(po, items=po_items, receipts=po_receipts)


@router.delete("/purchase-orders/{purchase_order_id}")
async def delete_purchase_order(
    purchase_order_id: int,
    current_user: User = Depends(require_procurement_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    current = await _purchase_order_or_404(db, purchase_order_id)
    _enforce_target_factory(current_user, current.get("factory_id"))

    receipts = await _fetch_purchase_receipts(db, purchase_order_id)
    if receipts:
        raise HTTPException(status_code=409, detail="Cannot delete purchase order after receipts exist")

    linked_invoice = await db.execute(
        text("SELECT id FROM supplier_invoices WHERE purchase_order_id = :purchase_order_id LIMIT 1"),
        {"purchase_order_id": purchase_order_id},
    )
    if linked_invoice.first():
        raise HTTPException(status_code=409, detail="Cannot delete purchase order linked to supplier invoices")

    await db.execute(
        text("DELETE FROM purchase_order_items WHERE purchase_order_id = :purchase_order_id"),
        {"purchase_order_id": purchase_order_id},
    )
    await db.execute(
        text("DELETE FROM purchase_orders WHERE id = :purchase_order_id"),
        {"purchase_order_id": purchase_order_id},
    )
    await log_audit_event(
        db,
        current_user=current_user,
        module="procurement",
        entity_type="purchase_order",
        entity_id=purchase_order_id,
        action="purchase_order_deleted",
        factory_id=current.get("factory_id"),
        title="حذف أمر شراء",
        description=f"Deleted purchase order {current.get('po_number')}",
        reference_type="purchase_order",
        reference_id=purchase_order_id,
        metadata={"supplier_id": current.get("supplier_id")},
    )
    await db.commit()

    return {"ok": True, "deleted_purchase_order_id": purchase_order_id}


@router.get("/receipts")
async def list_purchase_receipts(
    current_user: User = Depends(require_procurement_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    sql = """
        SELECT
            pr.id,
            pr.purchase_order_id,
            pr.purchase_order_item_id,
            pr.warehouse_id,
            pr.product_id,
            pr.received_quantity,
            pr.unit_cost,
            pr.notes,
            pr.received_by_user_id,
            pr.created_at,
            po.factory_id,
            po.po_number,
            s.name AS supplier_name,
            s.code AS supplier_code,
            p.name_ar AS product_name,
            p.sku AS product_sku,
            w.name AS warehouse_name,
            w.code AS warehouse_code,
            f.name AS factory_name,
            u.full_name AS received_by_name
        FROM purchase_receipts pr
        JOIN purchase_orders po ON po.id = pr.purchase_order_id
        JOIN suppliers s ON s.id = po.supplier_id
        JOIN products p ON p.id = pr.product_id
        JOIN warehouses w ON w.id = pr.warehouse_id
        JOIN factories f ON f.id = po.factory_id
        LEFT JOIN users u ON u.id = pr.received_by_user_id
    """
    params = {}
    if scoped_factory_id is not None:
        sql += " WHERE po.factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id

    sql += " ORDER BY pr.id DESC"
    result = await db.execute(text(sql), params)

    return [dict(row) for row in result.mappings().all()]


@router.post("/purchase-orders/{purchase_order_id}/receive")
async def receive_purchase_order_items(
    purchase_order_id: int,
    payload: dict,
    current_user: User = Depends(require_procurement_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    po = await _purchase_order_or_404(db, purchase_order_id)
    _enforce_target_factory(current_user, po.get("factory_id"))

    if str(po.get("status") or "") == "cancelled":
        raise HTTPException(status_code=409, detail="Cannot receive against a cancelled purchase order")

    receipt_lines = payload.get("receipts") or []
    notes = _clean_text(payload.get("notes"))

    if not isinstance(receipt_lines, list) or len(receipt_lines) == 0:
        raise HTTPException(status_code=400, detail="At least one receipt line is required")

    po_items = await _fetch_purchase_order_items(db, purchase_order_id)
    items_map = {int(item["id"]): item for item in po_items}

    for index, entry in enumerate(receipt_lines):
        purchase_order_item_id = _to_int(entry.get("purchase_order_item_id"), f"receipts[{index}].purchase_order_item_id", required=True)
        received_quantity = _to_float(entry.get("received_quantity"), f"receipts[{index}].received_quantity", required=True)

        if purchase_order_item_id not in items_map:
            raise HTTPException(status_code=404, detail=f"PO item #{purchase_order_item_id} not found")
        if received_quantity <= 0:
            raise HTTPException(status_code=400, detail=f"Received quantity must be greater than zero for line #{index + 1}")

        po_item = items_map[purchase_order_item_id]
        remaining = float(po_item.get("remaining_quantity") or 0)
        if received_quantity > remaining:
            raise HTTPException(
                status_code=409,
                detail=f"Received quantity exceeds remaining quantity for PO item #{purchase_order_item_id}",
            )

    for entry in receipt_lines:
        purchase_order_item_id = int(entry["purchase_order_item_id"])
        received_quantity = float(entry["received_quantity"])
        line_notes = _clean_text(entry.get("notes")) or notes
        po_item = items_map[purchase_order_item_id]

        await db.execute(
            text(
                """
                INSERT INTO purchase_receipts (
                    purchase_order_id,
                    purchase_order_item_id,
                    warehouse_id,
                    product_id,
                    received_quantity,
                    unit_cost,
                    notes,
                    received_by_user_id
                )
                VALUES (
                    :purchase_order_id,
                    :purchase_order_item_id,
                    :warehouse_id,
                    :product_id,
                    :received_quantity,
                    :unit_cost,
                    :notes,
                    :received_by_user_id
                )
                """
            ),
            {
                "purchase_order_id": purchase_order_id,
                "purchase_order_item_id": purchase_order_item_id,
                "warehouse_id": po["warehouse_id"],
                "product_id": po_item["product_id"],
                "received_quantity": received_quantity,
                "unit_cost": po_item["unit_cost"],
                "notes": line_notes,
                "received_by_user_id": getattr(current_user, "id", None),
            },
        )

        await db.execute(
            text(
                """
                INSERT INTO inventory_movements (
                    factory_id,
                    warehouse_id,
                    product_id,
                    movement_type,
                    quantity,
                    reference_type,
                    reference_id,
                    notes,
                    created_by_user_id
                )
                VALUES (
                    :factory_id,
                    :warehouse_id,
                    :product_id,
                    'in',
                    :quantity,
                    'purchase_receipt',
                    :reference_id,
                    :notes,
                    :created_by_user_id
                )
                """
            ),
            {
                "factory_id": po["factory_id"],
                "warehouse_id": po["warehouse_id"],
                "product_id": po_item["product_id"],
                "quantity": received_quantity,
                "reference_id": purchase_order_id,
                "notes": line_notes or f"Purchase receipt for PO {po['po_number']}",
                "created_by_user_id": getattr(current_user, "id", None),
            },
        )

    next_status = await _refresh_po_status_from_receipts(db, purchase_order_id)
    await log_audit_event(
        db,
        current_user=current_user,
        module="procurement",
        entity_type="purchase_order",
        entity_id=purchase_order_id,
        action="purchase_order_received",
        factory_id=po.get("factory_id"),
        title="تسجيل استلام أمر شراء",
        description=f"Recorded receipt against purchase order {po.get('po_number')}",
        reference_type="purchase_order",
        reference_id=purchase_order_id,
        metadata={"next_status": next_status, "receipts_count": len(entries)},
    )
    await db.commit()

    fresh_po = await _purchase_order_or_404(db, purchase_order_id)
    fresh_items = await _fetch_purchase_order_items(db, purchase_order_id)
    fresh_receipts = await _fetch_purchase_receipts(db, purchase_order_id)
    return _serialize_purchase_order(fresh_po, items=fresh_items, receipts=fresh_receipts)


@router.get("/supplier-invoices")
async def list_supplier_invoices(
    current_user: User = Depends(require_procurement_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    sql = """
        SELECT
            si.*,
            f.name AS factory_name,
            s.name AS supplier_name,
            s.code AS supplier_code,
            po.po_number,
            u.full_name AS created_by_name
        FROM supplier_invoices si
        JOIN factories f ON f.id = si.factory_id
        JOIN suppliers s ON s.id = si.supplier_id
        LEFT JOIN purchase_orders po ON po.id = si.purchase_order_id
        LEFT JOIN users u ON u.id = si.created_by_user_id
    """
    params = {}
    if scoped_factory_id is not None:
        sql += " WHERE si.factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id
    sql += " ORDER BY si.id DESC"

    result = await db.execute(text(sql), params)
    rows = result.mappings().all()

    output = []
    for row in rows:
        payments = await _fetch_invoice_payments(db, int(row["id"]))
        output.append(_serialize_supplier_invoice(row, payments=payments))
    return output


@router.post("/supplier-invoices", status_code=status.HTTP_201_CREATED)
async def create_supplier_invoice(
    payload: dict,
    current_user: User = Depends(require_procurement_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)

    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    requested_factory_id = _to_int(payload.get("factory_id"), "factory_id", required=scoped_factory_id is None)
    target_factory_id = scoped_factory_id if scoped_factory_id is not None else requested_factory_id

    _enforce_target_factory(current_user, target_factory_id)
    await _factory_exists(db, target_factory_id)

    supplier_id = _to_int(payload.get("supplier_id"), "supplier_id", required=True)
    purchase_order_id = _to_int(payload.get("purchase_order_id"), "purchase_order_id", required=False)
    invoice_number = _clean_text(payload.get("invoice_number"))
    invoice_date = _clean_text(payload.get("invoice_date"))
    due_date = _clean_text(payload.get("due_date"))
    notes = _clean_text(payload.get("notes"))

    if not invoice_number:
        raise HTTPException(status_code=400, detail="invoice_number is required")
    if not invoice_date:
        raise HTTPException(status_code=400, detail="invoice_date is required")

    supplier = await _supplier_or_404(db, supplier_id)
    if int(supplier["factory_id"]) != int(target_factory_id):
        raise HTTPException(status_code=409, detail="Supplier does not belong to this factory")

    po_total_value = 0.0
    if purchase_order_id is not None:
        purchase_order = await _purchase_order_or_404(db, purchase_order_id)
        if int(purchase_order["factory_id"]) != int(target_factory_id):
            raise HTTPException(status_code=409, detail="Purchase order does not belong to this factory")
        if int(purchase_order["supplier_id"]) != int(supplier_id):
            raise HTTPException(status_code=409, detail="Purchase order supplier mismatch")
        po_items = await _fetch_purchase_order_items(db, purchase_order_id)
        po_total_value = sum(float(item.get("line_total") or 0) for item in po_items)

    duplicate = await db.execute(
        text(
            """
            SELECT id
            FROM supplier_invoices
            WHERE factory_id = :factory_id
              AND invoice_number = :invoice_number
            LIMIT 1
            """
        ),
        {"factory_id": target_factory_id, "invoice_number": invoice_number},
    )
    if duplicate.first():
        raise HTTPException(status_code=409, detail="Invoice number already exists in this factory")

    subtotal_amount = _to_float(payload.get("subtotal_amount"), "subtotal_amount", required=False)
    vat_amount = _to_float(payload.get("vat_amount", 0), "vat_amount", required=False)
    if subtotal_amount is None:
        subtotal_amount = po_total_value
    if vat_amount is None:
        vat_amount = 0.0
    total_amount = _to_float(payload.get("total_amount"), "total_amount", required=False)
    if total_amount is None:
        total_amount = subtotal_amount + vat_amount

    if subtotal_amount < 0 or vat_amount < 0 or total_amount < 0:
        raise HTTPException(status_code=400, detail="Invoice amounts cannot be negative")

    if total_amount < subtotal_amount:
        raise HTTPException(status_code=400, detail="total_amount cannot be less than subtotal_amount")

    result = await db.execute(
        text(
            """
            INSERT INTO supplier_invoices (
                factory_id,
                supplier_id,
                purchase_order_id,
                invoice_number,
                invoice_date,
                due_date,
                status,
                subtotal_amount,
                vat_amount,
                total_amount,
                paid_amount,
                remaining_amount,
                notes,
                created_by_user_id
            )
            VALUES (
                :factory_id,
                :supplier_id,
                :purchase_order_id,
                :invoice_number,
                :invoice_date,
                :due_date,
                'open',
                :subtotal_amount,
                :vat_amount,
                :total_amount,
                0,
                :remaining_amount,
                :notes,
                :created_by_user_id
            )
            RETURNING id
            """
        ),
        {
            "factory_id": target_factory_id,
            "supplier_id": supplier_id,
            "purchase_order_id": purchase_order_id,
            "invoice_number": invoice_number,
            "invoice_date": invoice_date,
            "due_date": due_date,
            "subtotal_amount": subtotal_amount,
            "vat_amount": vat_amount,
            "total_amount": total_amount,
            "remaining_amount": total_amount,
            "notes": notes,
            "created_by_user_id": getattr(current_user, "id", None),
        },
    )
    supplier_invoice_id = result.scalar_one()
    await log_audit_event(
        db,
        current_user=current_user,
        module="procurement",
        entity_type="supplier_invoice",
        entity_id=supplier_invoice_id,
        action="supplier_invoice_created",
        factory_id=target_factory_id,
        title="إنشاء فاتورة مورد",
        description=f"Created supplier invoice {invoice_number}",
        reference_type="supplier_invoice",
        reference_id=supplier_invoice_id,
        metadata={"supplier_id": supplier_id, "purchase_order_id": purchase_order_id, "total_amount": total_amount},
    )
    await log_audit_event(
        db,
        current_user=current_user,
        module="procurement",
        entity_type="supplier_invoice",
        entity_id=supplier_invoice_id,
        action="supplier_invoice_updated",
        factory_id=current.get("factory_id"),
        title="تحديث فاتورة مورد",
        description=f"Updated supplier invoice {current.get('invoice_number')}",
        reference_type="supplier_invoice",
        reference_id=supplier_invoice_id,
        metadata={"supplier_id": supplier_id, "purchase_order_id": purchase_order_id, "total_amount": total_amount},
    )
    await db.commit()

    invoice = await _supplier_invoice_or_404(db, supplier_invoice_id)
    payments = await _fetch_invoice_payments(db, supplier_invoice_id)
    return _serialize_supplier_invoice(invoice, payments=payments)


@router.put("/supplier-invoices/{supplier_invoice_id}")
async def update_supplier_invoice(
    supplier_invoice_id: int,
    payload: dict,
    current_user: User = Depends(require_procurement_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    current = await _supplier_invoice_or_404(db, supplier_invoice_id)
    _enforce_target_factory(current_user, current.get("factory_id"))

    existing_payments = await _fetch_invoice_payments(db, supplier_invoice_id)
    if existing_payments:
        raise HTTPException(status_code=409, detail="Cannot edit supplier invoice after payments exist")

    supplier_id = _to_int(payload.get("supplier_id", current["supplier_id"]), "supplier_id", required=True)
    purchase_order_id = _to_int(payload.get("purchase_order_id", current.get("purchase_order_id")), "purchase_order_id", required=False)
    invoice_number = _clean_text(payload.get("invoice_number", current["invoice_number"]))
    invoice_date = _clean_text(payload.get("invoice_date", current["invoice_date"]))
    due_date = _clean_text(payload.get("due_date", current.get("due_date")))
    notes = _clean_text(payload.get("notes", current.get("notes")))

    supplier = await _supplier_or_404(db, supplier_id)
    if int(supplier["factory_id"]) != int(current["factory_id"]):
        raise HTTPException(status_code=409, detail="Supplier does not belong to this factory")

    if purchase_order_id is not None:
        purchase_order = await _purchase_order_or_404(db, purchase_order_id)
        if int(purchase_order["factory_id"]) != int(current["factory_id"]):
            raise HTTPException(status_code=409, detail="Purchase order does not belong to this factory")
        if int(purchase_order["supplier_id"]) != int(supplier_id):
            raise HTTPException(status_code=409, detail="Purchase order supplier mismatch")

    duplicate = await db.execute(
        text(
            """
            SELECT id
            FROM supplier_invoices
            WHERE factory_id = :factory_id
              AND id != :supplier_invoice_id
              AND invoice_number = :invoice_number
            LIMIT 1
            """
        ),
        {
            "factory_id": current["factory_id"],
            "supplier_invoice_id": supplier_invoice_id,
            "invoice_number": invoice_number,
        },
    )
    if duplicate.first():
        raise HTTPException(status_code=409, detail="Invoice number already exists in this factory")

    subtotal_amount = _to_float(payload.get("subtotal_amount", current.get("subtotal_amount")), "subtotal_amount", required=True)
    vat_amount = _to_float(payload.get("vat_amount", current.get("vat_amount", 0)), "vat_amount", required=False)
    if vat_amount is None:
        vat_amount = 0.0
    total_amount = _to_float(payload.get("total_amount", current.get("total_amount")), "total_amount", required=True)
    if subtotal_amount < 0 or vat_amount < 0 or total_amount < 0:
        raise HTTPException(status_code=400, detail="Invoice amounts cannot be negative")
    if total_amount < subtotal_amount:
        raise HTTPException(status_code=400, detail="total_amount cannot be less than subtotal_amount")

    await db.execute(
        text(
            """
            UPDATE supplier_invoices
            SET
                supplier_id = :supplier_id,
                purchase_order_id = :purchase_order_id,
                invoice_number = :invoice_number,
                invoice_date = :invoice_date,
                due_date = :due_date,
                subtotal_amount = :subtotal_amount,
                vat_amount = :vat_amount,
                total_amount = :total_amount,
                remaining_amount = :remaining_amount,
                notes = :notes,
                updated_at = NOW()
            WHERE id = :supplier_invoice_id
            """
        ),
        {
            "supplier_invoice_id": supplier_invoice_id,
            "supplier_id": supplier_id,
            "purchase_order_id": purchase_order_id,
            "invoice_number": invoice_number,
            "invoice_date": invoice_date,
            "due_date": due_date,
            "subtotal_amount": subtotal_amount,
            "vat_amount": vat_amount,
            "total_amount": total_amount,
            "remaining_amount": total_amount,
            "notes": notes,
        },
    )
    await log_audit_event(
        db,
        current_user=current_user,
        module="procurement",
        entity_type="supplier_invoice",
        entity_id=supplier_invoice_id,
        action="supplier_invoice_updated",
        factory_id=current.get("factory_id"),
        title="تحديث فاتورة مورد",
        description=f"Updated supplier invoice {current.get('invoice_number')}",
        reference_type="supplier_invoice",
        reference_id=supplier_invoice_id,
        metadata={"supplier_id": supplier_id, "purchase_order_id": purchase_order_id, "total_amount": total_amount},
    )
    await db.commit()

    invoice = await _supplier_invoice_or_404(db, supplier_invoice_id)
    payments = await _fetch_invoice_payments(db, supplier_invoice_id)
    return _serialize_supplier_invoice(invoice, payments=payments)


@router.post("/supplier-invoices/{supplier_invoice_id}/payments", status_code=status.HTTP_201_CREATED)
async def add_supplier_invoice_payment(
    supplier_invoice_id: int,
    payload: dict,
    current_user: User = Depends(require_procurement_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    invoice = await _supplier_invoice_or_404(db, supplier_invoice_id)
    _enforce_target_factory(current_user, invoice.get("factory_id"))

    payment_date = _clean_text(payload.get("payment_date"))
    amount = _to_float(payload.get("amount"), "amount", required=True)
    payment_method = _clean_text(payload.get("payment_method"))
    reference_number = _clean_text(payload.get("reference_number"))
    notes = _clean_text(payload.get("notes"))

    if not payment_date:
        raise HTTPException(status_code=400, detail="payment_date is required")
    if amount <= 0:
        raise HTTPException(status_code=400, detail="amount must be greater than zero")

    remaining_amount = float(invoice.get("remaining_amount") or 0)
    if amount > remaining_amount:
        raise HTTPException(status_code=409, detail="Payment amount exceeds invoice remaining amount")

    await db.execute(
        text(
            """
            INSERT INTO supplier_payments (
                factory_id,
                supplier_id,
                supplier_invoice_id,
                payment_date,
                amount,
                payment_method,
                reference_number,
                notes,
                created_by_user_id
            )
            VALUES (
                :factory_id,
                :supplier_id,
                :supplier_invoice_id,
                :payment_date,
                :amount,
                :payment_method,
                :reference_number,
                :notes,
                :created_by_user_id
            )
            """
        ),
        {
            "factory_id": invoice["factory_id"],
            "supplier_id": invoice["supplier_id"],
            "supplier_invoice_id": supplier_invoice_id,
            "payment_date": payment_date,
            "amount": amount,
            "payment_method": payment_method,
            "reference_number": reference_number,
            "notes": notes,
            "created_by_user_id": getattr(current_user, "id", None),
        },
    )

    refreshed = await _refresh_invoice_paid_state(db, supplier_invoice_id)
    await log_audit_event(
        db,
        current_user=current_user,
        module="procurement",
        entity_type="supplier_payment",
        action="supplier_payment_created",
        factory_id=invoice.get("factory_id"),
        title="تسجيل دفعة مورد",
        description=f"Recorded supplier payment against invoice {invoice.get('invoice_number')}",
        reference_type="supplier_invoice",
        reference_id=supplier_invoice_id,
        metadata={"amount": amount, "payment_method": payment_method, "reference_number": reference_number, "invoice_status": refreshed.get("status")},
    )
    await db.commit()

    fresh_invoice = await _supplier_invoice_or_404(db, supplier_invoice_id)
    payments = await _fetch_invoice_payments(db, supplier_invoice_id)
    return _serialize_supplier_invoice(fresh_invoice, payments=payments)


@router.get("/supplier-ledger")
async def get_supplier_ledger(
    current_user: User = Depends(require_procurement_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    supplier_sql = """
        SELECT
            s.id,
            s.factory_id,
            f.name AS factory_name,
            s.code,
            s.name
        FROM suppliers s
        JOIN factories f ON f.id = s.factory_id
    """
    params = {}
    if scoped_factory_id is not None:
        supplier_sql += " WHERE s.factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id
    supplier_sql += " ORDER BY s.name ASC"

    suppliers_result = await db.execute(text(supplier_sql), params)
    suppliers = suppliers_result.mappings().all()

    output = []
    for supplier in suppliers:
        supplier_id = int(supplier["id"])

        invoices_result = await db.execute(
            text(
                """
                SELECT
                    COALESCE(SUM(total_amount), 0) AS invoiced_total,
                    COALESCE(SUM(paid_amount), 0) AS paid_total,
                    COALESCE(SUM(remaining_amount), 0) AS remaining_total,
                    COUNT(*) AS invoices_count
                FROM supplier_invoices
                WHERE supplier_id = :supplier_id
                """
            ),
            {"supplier_id": supplier_id},
        )
        invoices_summary = invoices_result.mappings().first() or {}

        payments_result = await db.execute(
            text(
                """
                SELECT
                    MAX(payment_date) AS last_payment_date,
                    COALESCE(SUM(amount), 0) AS payments_total
                FROM supplier_payments
                WHERE supplier_id = :supplier_id
                """
            ),
            {"supplier_id": supplier_id},
        )
        payments_summary = payments_result.mappings().first() or {}

        output.append(
            {
                "supplier_id": supplier_id,
                "factory_id": supplier["factory_id"],
                "factory_name": supplier["factory_name"],
                "supplier_code": supplier["code"],
                "supplier_name": supplier["name"],
                "invoices_count": int(invoices_summary.get("invoices_count") or 0),
                "invoiced_total": float(invoices_summary.get("invoiced_total") or 0),
                "paid_total": float(invoices_summary.get("paid_total") or 0),
                "remaining_total": float(invoices_summary.get("remaining_total") or 0),
                "last_payment_date": str(payments_summary.get("last_payment_date")) if payments_summary.get("last_payment_date") is not None else None,
            }
        )

    return output


@router.get("/supplier-aging")
async def get_supplier_aging(
    current_user: User = Depends(require_procurement_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    sql = """
        SELECT
            si.id,
            si.factory_id,
            f.name AS factory_name,
            si.supplier_id,
            s.code AS supplier_code,
            s.name AS supplier_name,
            si.invoice_number,
            si.due_date,
            si.remaining_amount
        FROM supplier_invoices si
        JOIN suppliers s ON s.id = si.supplier_id
        JOIN factories f ON f.id = si.factory_id
        WHERE si.remaining_amount > 0
    """
    params = {}
    if scoped_factory_id is not None:
        sql += " AND si.factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id

    result = await db.execute(text(sql), params)
    rows = result.mappings().all()

    summary = {}
    today = _today()

    for row in rows:
        supplier_id = int(row["supplier_id"])
        if supplier_id not in summary:
            summary[supplier_id] = {
                "supplier_id": supplier_id,
                "factory_id": row["factory_id"],
                "factory_name": row["factory_name"],
                "supplier_code": row["supplier_code"],
                "supplier_name": row["supplier_name"],
                "current": 0.0,
                "days_1_30": 0.0,
                "days_31_60": 0.0,
                "days_61_90": 0.0,
                "days_90_plus": 0.0,
                "total_due": 0.0,
                "overdue_invoices_count": 0,
            }

        amount = float(row.get("remaining_amount") or 0)
        due_date = row.get("due_date")
        bucket_key = "current"

        if due_date is not None:
            overdue_days = (today - due_date).days
            if overdue_days <= 0:
                bucket_key = "current"
            elif overdue_days <= 30:
                bucket_key = "days_1_30"
            elif overdue_days <= 60:
                bucket_key = "days_31_60"
            elif overdue_days <= 90:
                bucket_key = "days_61_90"
            else:
                bucket_key = "days_90_plus"

            if overdue_days > 0:
                summary[supplier_id]["overdue_invoices_count"] += 1

        summary[supplier_id][bucket_key] += amount
        summary[supplier_id]["total_due"] += amount

    return list(summary.values())


@router.get("/supplier-performance")
async def get_supplier_performance(
    current_user: User = Depends(require_procurement_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    sql = """
        SELECT
            s.id AS supplier_id,
            s.factory_id,
            f.name AS factory_name,
            s.code AS supplier_code,
            s.name AS supplier_name,
            COUNT(DISTINCT po.id) AS purchase_orders_count,
            COUNT(pr.id) AS receipts_count,
            COALESCE(SUM(pr.received_quantity), 0) AS received_quantity_total,
            COUNT(DISTINCT CASE
                WHEN po.expected_date IS NOT NULL
                 AND DATE(pr.created_at) <= po.expected_date
                THEN pr.purchase_order_id
            END) AS on_time_purchase_orders_count,
            COUNT(DISTINCT CASE
                WHEN po.expected_date IS NOT NULL
                 AND DATE(pr.created_at) > po.expected_date
                THEN pr.purchase_order_id
            END) AS delayed_purchase_orders_count,
            AVG(CASE
                WHEN po.expected_date IS NOT NULL
                THEN DATE(pr.created_at) - po.expected_date
                ELSE NULL
            END) AS avg_delay_days
        FROM suppliers s
        JOIN factories f ON f.id = s.factory_id
        LEFT JOIN purchase_orders po ON po.supplier_id = s.id
        LEFT JOIN purchase_receipts pr ON pr.purchase_order_id = po.id
    """
    params = {}
    if scoped_factory_id is not None:
        sql += " WHERE s.factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id

    sql += """
        GROUP BY s.id, s.factory_id, f.name, s.code, s.name
        ORDER BY s.name ASC
    """

    result = await db.execute(text(sql), params)
    rows = result.mappings().all()

    output = []
    for row in rows:
        purchase_orders_count = int(row.get("purchase_orders_count") or 0)
        on_time_purchase_orders_count = int(row.get("on_time_purchase_orders_count") or 0)
        delayed_purchase_orders_count = int(row.get("delayed_purchase_orders_count") or 0)

        output.append(
            {
                "supplier_id": row["supplier_id"],
                "factory_id": row["factory_id"],
                "factory_name": row["factory_name"],
                "supplier_code": row["supplier_code"],
                "supplier_name": row["supplier_name"],
                "purchase_orders_count": purchase_orders_count,
                "receipts_count": int(row.get("receipts_count") or 0),
                "received_quantity_total": float(row.get("received_quantity_total") or 0),
                "on_time_purchase_orders_count": on_time_purchase_orders_count,
                "delayed_purchase_orders_count": delayed_purchase_orders_count,
                "on_time_rate": round((on_time_purchase_orders_count / purchase_orders_count) * 100, 2) if purchase_orders_count > 0 else 0.0,
                "avg_delay_days": round(float(row.get("avg_delay_days") or 0), 2),
            }
        )

    return output


@router.get("/supplier-payables-summary")
async def get_supplier_payables_summary(
    current_user: User = Depends(require_procurement_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_procurement_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    sql = """
        SELECT
            COUNT(*) AS invoices_count,
            COALESCE(SUM(total_amount), 0) AS invoices_total,
            COALESCE(SUM(paid_amount), 0) AS paid_total,
            COALESCE(SUM(remaining_amount), 0) AS remaining_total,
            COUNT(CASE WHEN remaining_amount > 0 AND due_date IS NOT NULL AND due_date < CURRENT_DATE THEN 1 END) AS overdue_invoices_count
        FROM supplier_invoices
    """
    params = {}
    if scoped_factory_id is not None:
        sql += " WHERE factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id

    result = await db.execute(text(sql), params)
    row = result.mappings().first() or {}

    return {
        "invoices_count": int(row.get("invoices_count") or 0),
        "invoices_total": float(row.get("invoices_total") or 0),
        "paid_total": float(row.get("paid_total") or 0),
        "remaining_total": float(row.get("remaining_total") or 0),
        "overdue_invoices_count": int(row.get("overdue_invoices_count") or 0),
    }


# RFQ Endpoints

@router.get("/rfqs")
async def list_rfqs(
    current_user: User = Depends(require_procurement_view),
    db: AsyncSession = Depends(get_db),
):
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    query = select(ProcurementRFQ)
    if scoped_factory_id:
        query = query.filter(ProcurementRFQ.factory_id == scoped_factory_id)
    
    result = await db.execute(query.order_by(ProcurementRFQ.id.desc()))
    return result.scalars().all()


@router.post("/rfqs")
async def create_rfq(
    payload: dict,
    current_user: User = Depends(require_procurement_manage),
    db: AsyncSession = Depends(get_db),
):
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    factory_id = scoped_factory_id or payload.get("factory_id")
    
    rfq = ProcurementRFQ(
        factory_id=factory_id,
        rfq_number=payload.get("rfq_number"),
        title=payload.get("title"),
        description=payload.get("description"),
        status="draft",
        deadline=datetime.fromisoformat(payload.get("deadline")) if payload.get("deadline") else None,
        created_by_user_id=current_user.id
    )
    db.add(rfq)
    await db.flush()
    
    await log_audit_event(
        db,
        current_user=current_user,
        module="procurement",
        entity_type="rfq",
        entity_id=rfq.id,
        action="rfq_created",
        factory_id=factory_id,
        title="إنشاء طلب عرض سعر",
        description=f"Created RFQ {rfq.rfq_number}",
        reference_type="rfq",
        reference_id=rfq.id
    )
    await db.commit()
    return rfq


@router.get("/rfqs/{rfq_id}/comparison")
async def compare_rfq_quotations(
    rfq_id: int,
    current_user: User = Depends(require_procurement_view),
    db: AsyncSession = Depends(get_db),
):
    # Verify access to RFQ
    rfq_result = await db.execute(select(ProcurementRFQ).filter(ProcurementRFQ.id == rfq_id))
    rfq = rfq_result.scalar_one_or_none()
    if not rfq:
        raise HTTPException(status_code=404, detail="RFQ not found")
    
    _enforce_target_factory(current_user, rfq.factory_id)
    
    comparison = await ProcurementService.get_rfq_comparison(db, rfq_id)
    return comparison

@router.get("/landed-costs")
async def list_landed_costs(current_user: User = Depends(require_procurement_view), db: AsyncSession = Depends(get_db)):
    await ensure_procurement_tables(db)
    result = await db.execute(text("SELECT * FROM landed_costs ORDER BY id DESC"))
    return [dict(r) for r in result.mappings().all()]

@router.post("/landed-costs", status_code=status.HTTP_201_CREATED)
async def create_landed_cost(payload: dict, current_user: User = Depends(require_procurement_manage), db: AsyncSession = Depends(get_db)):
    await ensure_procurement_tables(db)
    res = await db.execute(text("INSERT INTO landed_costs (name, date, amount, currency, notes) VALUES (:n, :d, :a, :c, :nt) RETURNING id"), {
        "n": payload["name"], "d": payload.get("date"), "a": payload.get("amount", 0),
        "c": payload.get("currency", "EGP"), "nt": payload.get("notes")
    })
    cost_id = int(res.scalar_one())
    for item in payload.get("items", []):
        await db.execute(text("INSERT INTO landed_cost_items (landed_cost_id, product_id, amount) VALUES (:cid, :pid, :amt)"),
                         {"cid": cost_id, "pid": item["product_id"], "amt": item["amount"]})
    await db.commit()
    return {"id": cost_id, "message": "Landed cost created"}
