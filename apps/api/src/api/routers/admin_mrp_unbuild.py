from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.mrp_unbuild import MrpUnbuildOrder
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/admin/mrp/unbuild", tags=["admin-mrp-unbuild"])

async def require_unbuild_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "unbuild.view", "unbuild.manage"):
        raise HTTPException(403, "Unbuild access denied")
    return user

class UnbuildCreate(BaseModel):
    product_id: int
    quantity: float
    bom_id: Optional[int] = None
    factory_id: Optional[int] = None
    notes: Optional[str] = None

@router.get("")
async def list_unbuild(db: AsyncSession = Depends(get_db), user=Depends(require_unbuild_access)):
    result = await db.execute(select(MrpUnbuildOrder).order_by(MrpUnbuildOrder.id.desc()).limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"product_id":r.product_id,"quantity":float(r.quantity),"bom_id":r.bom_id,"factory_id":r.factory_id,"state":r.state,"notes":r.notes} for r in rows]

@router.post("")
async def create_unbuild(payload: UnbuildCreate, db: AsyncSession = Depends(get_db), user=Depends(require_unbuild_access)):
    order = MrpUnbuildOrder(**payload.dict())
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return {"id":order.id, "product_id":order.product_id, "state":order.state}

@router.put("/{order_id}")
async def update_unbuild(order_id: int, payload: dict, db: AsyncSession = Depends(get_db), user=Depends(require_unbuild_access)):
    result = await db.execute(select(MrpUnbuildOrder).where(MrpUnbuildOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order: raise HTTPException(404, "Unbuild order not found")
    for key, val in payload.items():
        if hasattr(order, key):
            setattr(order, key, val)
    await db.commit()
    return {"ok": True}

@router.delete("/{order_id}")
async def delete_unbuild(order_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_unbuild_access)):
    result = await db.execute(select(MrpUnbuildOrder).where(MrpUnbuildOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order: raise HTTPException(404, "Unbuild order not found")
    await db.delete(order)
    await db.commit()
    return {"ok": True}
