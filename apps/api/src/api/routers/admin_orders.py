from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User

router = APIRouter(prefix="/admin/orders", tags=["admin-orders"])

async def require_orders_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "orders.view", "orders.manage"):
        raise HTTPException(status_code=403, detail="Orders access denied")
    return user

@router.get("")
async def list_orders(db: AsyncSession = Depends(get_db), user=Depends(require_orders_view)):
    result = await db.execute(text("SELECT * FROM customer_orders ORDER BY id DESC LIMIT 50"))
    return [dict(r) for r in result.mappings().all()]

@router.post("/{order_id}/reserve")
async def reserve_order_stock(order_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_orders_view)):
    order = (await db.execute(text("SELECT * FROM customer_orders WHERE id = :id"), {"id": order_id})).mappings().first()
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    items = (await db.execute(text("SELECT * FROM customer_order_items WHERE order_id = :oid"), {"oid": order_id})).mappings().all()
    warehouse_id = (await db.execute(text("SELECT id FROM warehouses WHERE factory_id = :fid LIMIT 1"), {"fid": order["factory_id"]})).scalar()
    for item in items:
        await db.execute(text("""
            INSERT INTO stock_quants (product_id, location_id, quantity, reserved_quantity)
            VALUES (:pid, (SELECT id FROM stock_locations WHERE code='WH/Reserve' LIMIT 1), 0, :qty)
        """), {"pid": item["product_id"], "qty": float(item["quantity"])})
    await db.execute(text("UPDATE customer_orders SET status = 'reserved', updated_at = NOW() WHERE id = :id"), {"id": order_id})
    await db.commit()
    return {"message": "Stock reserved"}

@router.post("/{order_id}/deliver")
async def create_delivery(order_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_orders_view)):
    order = (await db.execute(text("SELECT * FROM customer_orders WHERE id = :id"), {"id": order_id})).mappings().first()
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    items = (await db.execute(text("SELECT * FROM customer_order_items WHERE order_id = :oid"), {"oid": order_id})).mappings().all()
    warehouse_id = (await db.execute(text("SELECT id FROM warehouses WHERE factory_id = :fid LIMIT 1"), {"fid": order["factory_id"]})).scalar()
    from src.api.routers.admin_inventory import _insert_movement
    for item in items:
        await _insert_movement(db, factory_id=order["factory_id"], warehouse_id=warehouse_id, product_id=item["product_id"], movement_type="out", quantity=float(item["quantity"]), reference_type="customer_order", reference_id=order_id, notes=f"Delivery for Order #{order_id}")
    await db.execute(text("UPDATE customer_orders SET status = 'delivered', updated_at = NOW() WHERE id = :id"), {"id": order_id})
    await db.commit()
    return {"message": "Delivery created"}
