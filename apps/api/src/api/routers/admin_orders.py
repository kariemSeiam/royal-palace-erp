from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    require_orders_manage,
    require_orders_view,
    get_user_factory_scope_id,
    is_factory_scoped_user,
    enforce_factory_scope,
)
from src.core.db.session import get_db
from src.api.routers.admin_audit import log_audit_event
from src.models.user import User

router = APIRouter(prefix="/admin/orders", tags=["admin-orders"])

ALLOWED_STATUS_TRANSITIONS = {
    "order_received": {"materials_allocated", "cancelled"},
    "materials_allocated": {"manufacturing_started", "cancelled"},
    "manufacturing_started": {"assembly", "cancelled"},
    "assembly": {"quality_control", "cancelled"},
    "quality_control": {"packaging", "cancelled"},
    "packaging": {"delivery_dispatched", "cancelled"},
    "delivery_dispatched": {"delivered", "cancelled"},
    "delivered": set(),
    "cancelled": set(),
}


def _normalize_optional_text(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


async def ensure_delivery_notes_table(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS delivery_notes (
                id SERIAL PRIMARY KEY,
                delivery_number VARCHAR(100) NOT NULL,
                order_id INTEGER NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT,
                factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
                warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
                status VARCHAR(50) NOT NULL DEFAULT 'dispatched',
                customer_name VARCHAR(255),
                customer_phone VARCHAR(50),
                shipping_address TEXT,
                dispatched_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                delivered_at TIMESTAMPTZ NULL,
                dispatched_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                delivered_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                receiver_name VARCHAR(255),
                receiver_phone VARCHAR(50),
                proof_notes TEXT,
                notes TEXT,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_notes_factory_delivery_number ON delivery_notes(factory_id, delivery_number)"))
    await db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_delivery_notes_order_id ON delivery_notes(order_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_delivery_notes_status ON delivery_notes(status)"))
    await db.commit()


async def generate_delivery_number(db: AsyncSession, factory_id: int) -> str:
    prefix = f"DN-{factory_id}"
    result = await db.execute(
        text("SELECT delivery_number FROM delivery_notes WHERE factory_id = :factory_id ORDER BY id DESC LIMIT 1"),
        {"factory_id": factory_id},
    )
    row = result.mappings().first()
    next_seq = 1
    if row and row.get("delivery_number"):
        raw = str(row["delivery_number"]).strip()
        if raw.startswith(prefix + "-"):
            try:
                next_seq = int(raw.split("-")[-1]) + 1
            except Exception:
                next_seq = 1
    return f"{prefix}-{str(next_seq).zfill(6)}"


def serialize_order(row):
    data = dict(row)
    return {
        "id": data.get("id"),
        "parent_order_id": data.get("parent_order_id"),
        "is_master_order": bool(data.get("is_master_order")),
        "factory_id": data.get("factory_id"),
        "factory_name": data.get("factory_name"),
        "warehouse_id": data.get("warehouse_id"),
        "warehouse_name": data.get("warehouse_name"),
        "warehouse_code": data.get("warehouse_code"),
        "order_number": data.get("order_number"),
        "order_type": data.get("order_type"),
        "status": data.get("status"),
        "payment_status": data.get("payment_status"),
        "subtotal_amount": str(data.get("subtotal_amount")) if data.get("subtotal_amount") is not None else None,
        "vat_amount": str(data.get("vat_amount")) if data.get("vat_amount") is not None else None,
        "total_amount": str(data.get("total_amount")) if data.get("total_amount") is not None else None,
        "customer_name": data.get("customer_name"),
        "customer_phone": data.get("customer_phone"),
        "shipping_address": data.get("shipping_address"),
        "business_account_id": data.get("business_account_id"),
        "user_id": data.get("user_id"),
        "delivery_note_id": data.get("delivery_note_id"),
        "delivery_number": data.get("delivery_number"),
        "delivery_status": data.get("delivery_status"),
        "dispatched_at": data.get("dispatched_at").isoformat() if data.get("dispatched_at") else None,
        "delivered_at": data.get("delivered_at").isoformat() if data.get("delivered_at") else None,
        "receiver_name": data.get("receiver_name"),
        "receiver_phone": data.get("receiver_phone"),
        "delivery_notes": data.get("delivery_notes"),
    }


async def fetch_order_or_404(db: AsyncSession, order_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                co.*,
                f.name AS factory_name,
                w.name AS warehouse_name,
                w.code AS warehouse_code,
                dn.id AS delivery_note_id,
                dn.delivery_number,
                dn.status AS delivery_status,
                dn.dispatched_at,
                dn.delivered_at,
                dn.receiver_name,
                dn.receiver_phone,
                dn.proof_notes AS delivery_notes
            FROM customer_orders co
            LEFT JOIN factories f ON f.id = co.factory_id
            LEFT JOIN warehouses w ON w.id = co.warehouse_id
            LEFT JOIN delivery_notes dn ON dn.order_id = co.id
            WHERE co.id = :order_id
            LIMIT 1
            """
        ),
        {"order_id": order_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    return row


async def fetch_delivery_note_by_order_id(db: AsyncSession, order_id: int):
    result = await db.execute(text("SELECT * FROM delivery_notes WHERE order_id = :order_id LIMIT 1"), {"order_id": order_id})
    return result.mappings().first()


async def fetch_child_orders(db: AsyncSession, parent_order_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                co.*,
                f.name AS factory_name,
                w.name AS warehouse_name,
                w.code AS warehouse_code,
                dn.id AS delivery_note_id,
                dn.delivery_number,
                dn.status AS delivery_status,
                dn.dispatched_at,
                dn.delivered_at,
                dn.receiver_name,
                dn.receiver_phone,
                dn.proof_notes AS delivery_notes
            FROM customer_orders co
            LEFT JOIN factories f ON f.id = co.factory_id
            LEFT JOIN warehouses w ON w.id = co.warehouse_id
            LEFT JOIN delivery_notes dn ON dn.order_id = co.id
            WHERE co.parent_order_id = :parent_order_id
            ORDER BY co.id ASC
            """
        ),
        {"parent_order_id": parent_order_id},
    )
    return result.mappings().all()


async def ensure_order_factory_integrity(db: AsyncSession, order_id: int, factory_id: int | None):
    if factory_id is None:
        raise HTTPException(status_code=409, detail="Order factory is not assigned")

    result = await db.execute(
        text(
            """
            SELECT coi.product_id, p.factory_id AS product_factory_id
            FROM customer_order_items coi
            JOIN products p ON p.id = coi.product_id
            WHERE coi.order_id = :order_id
            """
        ),
        {"order_id": order_id},
    )
    rows = result.mappings().all()
    if not rows:
        raise HTTPException(status_code=409, detail="Order has no items")
    for row in rows:
        if row.get("product_factory_id") is None:
            raise HTTPException(status_code=409, detail=f"Product #{row.get('product_id')} has no factory assignment")
        if int(row.get("product_factory_id")) != int(factory_id):
            raise HTTPException(status_code=409, detail=f"Product #{row.get('product_id')} belongs to another factory")


async def ensure_valid_warehouse_for_order(db: AsyncSession, warehouse_id: int | None, factory_id: int | None):
    if warehouse_id is None:
        raise HTTPException(status_code=409, detail="Order warehouse is not assigned")
    if factory_id is None:
        raise HTTPException(status_code=409, detail="Order factory is not assigned")
    result = await db.execute(text("SELECT id, factory_id, is_active FROM warehouses WHERE id = :warehouse_id LIMIT 1"), {"warehouse_id": warehouse_id})
    warehouse = result.mappings().first()
    if not warehouse:
        raise HTTPException(status_code=404, detail="Assigned warehouse not found")
    if int(warehouse["factory_id"]) != int(factory_id):
        raise HTTPException(status_code=409, detail="Assigned warehouse belongs to another factory")
    if not bool(warehouse["is_active"]):
        raise HTTPException(status_code=409, detail="Assigned warehouse is inactive")


async def ensure_dispatch_stock_is_available(db: AsyncSession, order_id: int, warehouse_id: int):
    items_result = await db.execute(
        text(
            """
            SELECT coi.product_id, p.name_ar, p.sku, coi.quantity
            FROM customer_order_items coi
            JOIN products p ON p.id = coi.product_id
            WHERE coi.order_id = :order_id
            ORDER BY coi.id ASC
            """
        ),
        {"order_id": order_id},
    )
    items = items_result.mappings().all()
    for item in items:
        stock_result = await db.execute(
            text(
                """
                SELECT COALESCE(SUM(
                    CASE
                        WHEN movement_type = 'in' THEN quantity
                        WHEN movement_type = 'out' THEN -quantity
                        WHEN movement_type = 'adjustment' THEN quantity
                        ELSE 0
                    END
                ), 0) AS current_stock
                FROM inventory_movements
                WHERE warehouse_id = :warehouse_id AND product_id = :product_id
                """
            ),
            {"warehouse_id": warehouse_id, "product_id": item["product_id"]},
        )
        current_stock = float(stock_result.scalar() or 0)
        required_qty = float(item["quantity"] or 0)
        if required_qty > current_stock:
            raise HTTPException(status_code=409, detail=f"Insufficient stock for product {item['name_ar']} ({item['sku']}). Current stock is {current_stock}, required is {required_qty}")


async def ensure_dispatch_not_already_deducted(db: AsyncSession, order_id: int):
    result = await db.execute(text("SELECT id FROM inventory_movements WHERE reference_type = 'order_dispatch' AND reference_id = :order_id LIMIT 1"), {"order_id": order_id})
    if result.first():
        raise HTTPException(status_code=409, detail="Inventory was already deducted for this order dispatch")


async def ensure_completed_work_order_for_dispatch(db: AsyncSession, order_id: int, factory_id: int | None):
    if factory_id is None:
        raise HTTPException(status_code=409, detail="Order factory is not assigned")
    result = await db.execute(
        text("SELECT id, status FROM work_orders WHERE order_id = :order_id AND factory_id = :factory_id ORDER BY id DESC LIMIT 1"),
        {"order_id": order_id, "factory_id": factory_id},
    )
    work_order = result.mappings().first()
    if not work_order:
        raise HTTPException(status_code=409, detail="Dispatch requires a work order for this order")
    if str(work_order.get("status") or "") != "completed":
        raise HTTPException(status_code=409, detail="Dispatch requires completed work order")


async def create_dispatch_inventory_movements(db: AsyncSession, order_id: int, factory_id: int, warehouse_id: int):
    items_result = await db.execute(text("SELECT product_id, quantity FROM customer_order_items WHERE order_id = :order_id ORDER BY id ASC"), {"order_id": order_id})
    for item in items_result.mappings().all():
        await db.execute(
            text(
                """
                INSERT INTO inventory_movements (
                    factory_id, warehouse_id, product_id, movement_type, quantity,
                    reference_type, reference_id, notes
                )
                VALUES (
                    :factory_id, :warehouse_id, :product_id, 'out', :quantity,
                    'order_dispatch', :reference_id, :notes
                )
                """
            ),
            {
                "factory_id": factory_id,
                "warehouse_id": warehouse_id,
                "product_id": item["product_id"],
                "quantity": item["quantity"],
                "reference_id": order_id,
                "notes": f"Automatic stock deduction for dispatched order #{order_id}",
            },
        )


async def ensure_delete_is_safe(db: AsyncSession, order_ids: list[int]):
    result = await db.execute(text("SELECT reference_id FROM inventory_movements WHERE reference_type = 'order_dispatch' AND reference_id = ANY(:order_ids) LIMIT 1"), {"order_ids": order_ids})
    row = result.mappings().first()
    if row:
        raise HTTPException(status_code=409, detail=f"Cannot delete order bundle because dispatch inventory movement exists for order #{row['reference_id']}")
    result = await db.execute(text("SELECT order_id FROM delivery_notes WHERE order_id = ANY(:order_ids) LIMIT 1"), {"order_ids": order_ids})
    delivery_row = result.mappings().first()
    if delivery_row:
        raise HTTPException(status_code=409, detail=f"Cannot delete order bundle because delivery note exists for order #{delivery_row['order_id']}")


@router.get("")
async def list_orders(current_user: User = Depends(require_orders_view), db: AsyncSession = Depends(get_db)):
    await ensure_delivery_notes_table(db)
    sql = """
        SELECT
            co.*,
            f.name AS factory_name,
            w.name AS warehouse_name,
            w.code AS warehouse_code,
            dn.id AS delivery_note_id,
            dn.delivery_number,
            dn.status AS delivery_status,
            dn.dispatched_at,
            dn.delivered_at,
            dn.receiver_name,
            dn.receiver_phone,
            dn.proof_notes AS delivery_notes
        FROM customer_orders co
        LEFT JOIN factories f ON f.id = co.factory_id
        LEFT JOIN warehouses w ON w.id = co.warehouse_id
        LEFT JOIN delivery_notes dn ON dn.order_id = co.id
    """
    params = {}
    if is_factory_scoped_user(current_user):
        sql += " WHERE co.factory_id = :factory_id "
        params["factory_id"] = get_user_factory_scope_id(current_user)
    sql += " ORDER BY co.id DESC "
    result = await db.execute(text(sql), params)
    return [serialize_order(row) for row in result.mappings().all()]


@router.get("/warehouses/options")
async def list_order_warehouse_options(current_user: User = Depends(require_orders_view), db: AsyncSession = Depends(get_db)):
    scoped_factory_id = get_user_factory_scope_id(current_user) if is_factory_scoped_user(current_user) else None
    if scoped_factory_id is None:
        result = await db.execute(text("SELECT w.id, w.factory_id, f.name AS factory_name, w.code, w.name, w.is_active FROM warehouses w JOIN factories f ON f.id = w.factory_id ORDER BY f.name ASC, w.name ASC, w.id ASC"))
    else:
        result = await db.execute(text("SELECT w.id, w.factory_id, f.name AS factory_name, w.code, w.name, w.is_active FROM warehouses w JOIN factories f ON f.id = w.factory_id WHERE w.factory_id = :factory_id ORDER BY f.name ASC, w.name ASC, w.id ASC"), {"factory_id": scoped_factory_id})
    return [dict(row) for row in result.mappings().all()]


@router.get("/{order_id}/delivery-note")
async def get_order_delivery_note(order_id: int, current_user: User = Depends(require_orders_view), db: AsyncSession = Depends(get_db)):
    await ensure_delivery_notes_table(db)
    order_row = await fetch_order_or_404(db, order_id)
    enforce_factory_scope(current_user, order_row.get("factory_id"), "Access denied for this order factory scope")
    delivery_note = await fetch_delivery_note_by_order_id(db, order_id)
    if not delivery_note:
        raise HTTPException(status_code=404, detail="Delivery note not found for this order")
    return dict(delivery_note)


@router.get("/delivery-notes")
async def list_delivery_notes(current_user: User = Depends(require_orders_view), db: AsyncSession = Depends(get_db)):
    await ensure_delivery_notes_table(db)
    params = {}
    where_sql = ""
    if is_factory_scoped_user(current_user):
        params["factory_id"] = get_user_factory_scope_id(current_user)
        where_sql = " WHERE dn.factory_id = :factory_id "
    result = await db.execute(text(f"SELECT dn.*, co.order_number, f.name AS factory_name, w.name AS warehouse_name, w.code AS warehouse_code FROM delivery_notes dn JOIN customer_orders co ON co.id = dn.order_id LEFT JOIN factories f ON f.id = dn.factory_id LEFT JOIN warehouses w ON w.id = dn.warehouse_id {where_sql} ORDER BY dn.id DESC"), params)
    return [dict(row) for row in result.mappings().all()]


@router.put("/{order_id}")
async def update_order(order_id: int, payload: dict, current_user: User = Depends(require_orders_manage), db: AsyncSession = Depends(get_db)):
    await ensure_delivery_notes_table(db)
    order_row = await fetch_order_or_404(db, order_id)
    enforce_factory_scope(current_user, order_row.get("factory_id"), "Access denied for this order factory scope")

    status_value = payload.get("status", order_row.get("status"))
    payment_status = payload.get("payment_status", order_row.get("payment_status"))
    customer_name = payload.get("customer_name", order_row.get("customer_name"))
    customer_phone = payload.get("customer_phone", order_row.get("customer_phone"))
    shipping_address = payload.get("shipping_address", order_row.get("shipping_address"))
    warehouse_id = payload.get("warehouse_id", order_row.get("warehouse_id"))

    if warehouse_id in ["", None]:
        warehouse_id = None
    else:
        try:
            warehouse_id = int(warehouse_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid warehouse_id")

    allowed_statuses = ["order_received", "materials_allocated", "manufacturing_started", "assembly", "quality_control", "packaging", "delivery_dispatched", "delivered", "cancelled"]
    if status_value not in allowed_statuses:
        raise HTTPException(status_code=400, detail="Invalid order status")

    allowed_payment_statuses = ["pending", "paid", "failed", "refunded", "partially_refunded", "cod"]
    if payment_status not in allowed_payment_statuses:
        raise HTTPException(status_code=400, detail="Invalid payment status")

    current_status = order_row.get("status")
    factory_id = order_row.get("factory_id")

    if current_status == "cancelled" and status_value != "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled order cannot be reactivated")
    if current_status == "delivered" and status_value != "delivered":
        raise HTTPException(status_code=409, detail="Delivered order cannot be changed")
    if status_value != current_status:
        allowed_next = ALLOWED_STATUS_TRANSITIONS.get(str(current_status), set())
        if status_value not in allowed_next:
            raise HTTPException(status_code=409, detail=f"Invalid status transition from {current_status} to {status_value}")
    if warehouse_id is not None:
        await ensure_valid_warehouse_for_order(db, warehouse_id, factory_id)

    try:
        await db.execute(text("UPDATE customer_orders SET status = :status, payment_status = :payment_status, customer_name = :customer_name, customer_phone = :customer_phone, shipping_address = :shipping_address, warehouse_id = :warehouse_id, updated_at = NOW() WHERE id = :order_id"), {"order_id": order_id, "status": status_value, "payment_status": payment_status, "customer_name": customer_name, "customer_phone": customer_phone, "shipping_address": shipping_address, "warehouse_id": warehouse_id})
        await log_audit_event(
            db,
            current_user=current_user,
            module="orders",
            entity_type="customer_order",
            entity_id=order_id,
            action="order_updated",
            factory_id=factory_id,
            title="تحديث الطلب",
            description=f"Order {order_row.get('order_number')} updated",
            reference_type="customer_order",
            reference_id=order_id,
            metadata={
                "before_status": current_status,
                "after_status": status_value,
                "payment_status": payment_status,
                "warehouse_id": warehouse_id,
            },
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update order: {exc}")

    updated_row = await fetch_order_or_404(db, order_id)
    return serialize_order(updated_row)


@router.delete("/{order_id}")
async def delete_order(order_id: int, current_user: User = Depends(require_orders_manage), db: AsyncSession = Depends(get_db)):
    await ensure_delivery_notes_table(db)
    order_row = await fetch_order_or_404(db, order_id)
    enforce_factory_scope(current_user, order_row.get("factory_id"), "Access denied for this order factory scope")

    child_rows = await fetch_child_orders(db, order_id)
    delete_ids = [order_id]
    if bool(order_row.get("is_master_order")):
        for child in child_rows:
            enforce_factory_scope(current_user, child.get("factory_id"), "Access denied for child order factory scope")
            delete_ids.append(int(child["id"]))

    await ensure_delete_is_safe(db, delete_ids)
    try:
        await db.execute(text("DELETE FROM customer_order_items WHERE order_id = ANY(:order_ids)"), {"order_ids": delete_ids})
        await db.execute(text("DELETE FROM customer_orders WHERE id = ANY(:order_ids)"), {"order_ids": delete_ids})
        await log_audit_event(
            db,
            current_user=current_user,
            module="orders",
            entity_type="customer_order",
            entity_id=order_id,
            action="order_deleted",
            factory_id=order_row.get("factory_id"),
            title="حذف الطلب",
            description=f"Deleted order bundle rooted at {order_row.get('order_number')}",
            reference_type="customer_order",
            reference_id=order_id,
            metadata={"deleted_order_ids": delete_ids},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete order: {exc}")

    return {"ok": True, "deleted_order_ids": delete_ids, "deleted_count": len(delete_ids)}


@router.post("/{order_id}/cancel")
async def cancel_order(order_id: int, current_user: User = Depends(require_orders_manage), db: AsyncSession = Depends(get_db)):
    await ensure_delivery_notes_table(db)
    order_row = await fetch_order_or_404(db, order_id)
    enforce_factory_scope(current_user, order_row.get("factory_id"), "Access denied for this order factory scope")

    if order_row.get("status") == "delivered":
        raise HTTPException(status_code=409, detail="Delivered order cannot be cancelled")
    if order_row.get("delivery_note_id"):
        raise HTTPException(status_code=409, detail="Order with delivery note cannot be cancelled directly")

    try:
        await db.execute(text("UPDATE customer_orders SET status = 'cancelled', updated_at = NOW() WHERE id = :order_id"), {"order_id": order_id})
        await log_audit_event(
            db,
            current_user=current_user,
            module="orders",
            entity_type="customer_order",
            entity_id=order_id,
            action="order_cancelled",
            factory_id=order_row.get("factory_id"),
            title="إلغاء الطلب",
            description=f"Cancelled order {order_row.get('order_number')}",
            reference_type="customer_order",
            reference_id=order_id,
            metadata={"previous_status": order_row.get("status")},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to cancel order: {exc}")

    updated_row = await fetch_order_or_404(db, order_id)
    return serialize_order(updated_row)


@router.post("/{order_id}/mark-paid")
async def mark_order_paid(order_id: int, current_user: User = Depends(require_orders_manage), db: AsyncSession = Depends(get_db)):
    await ensure_delivery_notes_table(db)
    order_row = await fetch_order_or_404(db, order_id)
    enforce_factory_scope(current_user, order_row.get("factory_id"), "Access denied for this order factory scope")

    try:
        await db.execute(text("UPDATE customer_orders SET payment_status = 'paid', updated_at = NOW() WHERE id = :order_id"), {"order_id": order_id})
        await db.execute(text("UPDATE sales_invoices SET paid_amount = total_amount, remaining_amount = 0, payment_status = 'paid', status = CASE WHEN status = 'cancelled' THEN status ELSE 'paid' END, paid_at = COALESCE(paid_at, NOW()), updated_at = NOW() WHERE order_id = :order_id AND status != 'cancelled'"), {"order_id": order_id})
        await log_audit_event(
            db,
            current_user=current_user,
            module="orders",
            entity_type="customer_order",
            entity_id=order_id,
            action="order_marked_paid",
            factory_id=order_row.get("factory_id"),
            title="تحصيل الطلب",
            description=f"Marked order {order_row.get('order_number')} as paid",
            reference_type="customer_order",
            reference_id=order_id,
            metadata={"previous_payment_status": order_row.get("payment_status"), "new_payment_status": "paid"},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to mark order paid: {exc}")

    updated_row = await fetch_order_or_404(db, order_id)
    return serialize_order(updated_row)


@router.post("/{order_id}/dispatch")
async def dispatch_order(order_id: int, payload: dict | None = None, current_user: User = Depends(require_orders_manage), db: AsyncSession = Depends(get_db)):
    await ensure_delivery_notes_table(db)
    order_row = await fetch_order_or_404(db, order_id)
    factory_id = order_row.get("factory_id")
    warehouse_id = order_row.get("warehouse_id")
    enforce_factory_scope(current_user, factory_id, "Access denied for this order factory scope")

    current_status = order_row.get("status")
    if current_status == "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled order cannot be dispatched")
    if current_status == "delivered":
        raise HTTPException(status_code=409, detail="Delivered order cannot be dispatched again")
    if current_status == "delivery_dispatched":
        raise HTTPException(status_code=409, detail="Order is already dispatched")
    if current_status != "packaging":
        raise HTTPException(status_code=409, detail="Order must be in packaging stage before dispatch")

    await ensure_order_factory_integrity(db, order_id, factory_id)
    await ensure_valid_warehouse_for_order(db, warehouse_id, factory_id)
    await ensure_completed_work_order_for_dispatch(db, order_id, factory_id)
    await ensure_dispatch_not_already_deducted(db, order_id)
    await ensure_dispatch_stock_is_available(db, order_id, warehouse_id)

    existing_delivery = await fetch_delivery_note_by_order_id(db, order_id)
    if existing_delivery:
        raise HTTPException(status_code=409, detail="Delivery note already exists for this order")

    payload = payload or {}
    delivery_notes = _normalize_optional_text(payload.get("notes"))
    delivery_number = await generate_delivery_number(db, int(factory_id))

    try:
        await create_dispatch_inventory_movements(db=db, order_id=order_id, factory_id=int(factory_id), warehouse_id=int(warehouse_id))
        await db.execute(text("INSERT INTO delivery_notes (delivery_number, order_id, factory_id, warehouse_id, status, customer_name, customer_phone, shipping_address, dispatched_by_user_id, notes) VALUES (:delivery_number, :order_id, :factory_id, :warehouse_id, 'dispatched', :customer_name, :customer_phone, :shipping_address, :dispatched_by_user_id, :notes)"), {"delivery_number": delivery_number, "order_id": order_id, "factory_id": int(factory_id), "warehouse_id": int(warehouse_id), "customer_name": order_row.get("customer_name"), "customer_phone": order_row.get("customer_phone"), "shipping_address": order_row.get("shipping_address"), "dispatched_by_user_id": current_user.id, "notes": delivery_notes})
        await db.execute(text("UPDATE customer_orders SET status = 'delivery_dispatched', updated_at = NOW() WHERE id = :order_id"), {"order_id": order_id})
        await log_audit_event(
            db,
            current_user=current_user,
            module="orders",
            entity_type="customer_order",
            entity_id=order_id,
            action="order_dispatched",
            factory_id=int(factory_id),
            title="شحن الطلب",
            description=f"Dispatched order {order_row.get('order_number')} with delivery note {delivery_number}",
            reference_type="delivery_note",
            reference_id=order_id,
            metadata={"delivery_number": delivery_number, "warehouse_id": warehouse_id},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to dispatch order: {exc}")

    updated_row = await fetch_order_or_404(db, order_id)
    return serialize_order(updated_row)


@router.post("/{order_id}/deliver")
async def deliver_order(order_id: int, payload: dict | None = None, current_user: User = Depends(require_orders_manage), db: AsyncSession = Depends(get_db)):
    await ensure_delivery_notes_table(db)
    order_row = await fetch_order_or_404(db, order_id)
    enforce_factory_scope(current_user, order_row.get("factory_id"), "Access denied for this order factory scope")

    if order_row.get("status") == "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled order cannot be delivered")
    if order_row.get("status") not in {"delivery_dispatched", "delivered"}:
        raise HTTPException(status_code=409, detail="Order must be dispatched before delivery")

    delivery_note = await fetch_delivery_note_by_order_id(db, order_id)
    if not delivery_note:
        raise HTTPException(status_code=409, detail="Delivery note must exist before delivery confirmation")

    payload = payload or {}
    receiver_name = _normalize_optional_text(payload.get("receiver_name")) or _normalize_optional_text(order_row.get("customer_name"))
    receiver_phone = _normalize_optional_text(payload.get("receiver_phone")) or _normalize_optional_text(order_row.get("customer_phone"))
    proof_notes = _normalize_optional_text(payload.get("proof_notes")) or _normalize_optional_text(payload.get("notes"))

    try:
        await db.execute(text("UPDATE customer_orders SET status = 'delivered', updated_at = NOW() WHERE id = :order_id"), {"order_id": order_id})
        await db.execute(text("UPDATE delivery_notes SET status = 'delivered', delivered_at = NOW(), delivered_by_user_id = :delivered_by_user_id, receiver_name = :receiver_name, receiver_phone = :receiver_phone, proof_notes = :proof_notes, updated_at = NOW() WHERE order_id = :order_id"), {"order_id": order_id, "delivered_by_user_id": current_user.id, "receiver_name": receiver_name, "receiver_phone": receiver_phone, "proof_notes": proof_notes})
        await log_audit_event(
            db,
            current_user=current_user,
            module="orders",
            entity_type="customer_order",
            entity_id=order_id,
            action="order_delivered",
            factory_id=order_row.get("factory_id"),
            title="تسليم الطلب",
            description=f"Delivered order {order_row.get('order_number')}",
            reference_type="delivery_note",
            reference_id=order_id,
            metadata={"receiver_name": receiver_name, "receiver_phone": receiver_phone},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to deliver order: {exc}")

    updated_row = await fetch_order_or_404(db, order_id)
    return serialize_order(updated_row)
