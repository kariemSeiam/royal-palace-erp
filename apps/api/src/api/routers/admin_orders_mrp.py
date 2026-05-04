from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission
from src.core.db.session import get_db

router = APIRouter(prefix="/admin/orders", tags=["admin-orders-mrp"])

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not has_any_permission(permissions, "orders.view", "work_orders.view"):
        raise HTTPException(403, "Access denied")
    return user

@router.post("/{order_id}/create-mo")
async def create_mo_from_order(order_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    order = await db.execute(select(text("*")).select_from(text("customer_orders")).where(text("id = :id")), {"id": order_id})
    row = order.mappings().first()
    if not row: raise HTTPException(404, "Order not found")
    factory_id = row.get("factory_id")
    if not factory_id:
        factory_result = await db.execute(text("SELECT id FROM factories LIMIT 1"))
        factory_id = factory_result.scalar()
    if not factory_id:
        raise HTTPException(400, "No factory available")
    note = f"Created from Sales Order #{order_id}"
    ins = text("INSERT INTO work_orders (order_id, factory_id, status, notes, priority, source_doc) VALUES (:oid, :fid, 'draft', :note, 'normal', 'SALES') RETURNING id")
    result = await db.execute(ins, {"oid": order_id, "fid": factory_id, "note": note})
    await db.commit()
    return {"manufacturing_order_id": result.scalar_one()}
