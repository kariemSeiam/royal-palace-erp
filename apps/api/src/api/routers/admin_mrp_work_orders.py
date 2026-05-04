from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.mrp_work_order import MrpWorkOrder
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter(prefix="/admin/mrp/work-orders", tags=["admin-mrp-work-orders"])

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "work_orders.view", "work_orders.manage"):
        raise HTTPException(403, "Access denied")
    return user

class WorkOrderCreate(BaseModel):
    manufacturing_order_id: int
    routing_step_id: Optional[int] = None
    workcenter_id: Optional[int] = None
    planned_start_at: Optional[str] = None
    planned_end_at: Optional[str] = None

class WorkOrderUpdate(BaseModel):
    state: Optional[str] = None
    actual_start_at: Optional[str] = None
    actual_end_at: Optional[str] = None
    duration_minutes: Optional[float] = None
    notes: Optional[str] = None

@router.get("")
async def list_work_orders(mo_id: int = Query(..., alias="manufacturing_order_id"), db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(text("""
        SELECT wo.*, rs.step_name, wc.name as workcenter_name
        FROM mrp_work_orders wo
        LEFT JOIN mrp_routing_steps rs ON rs.id = wo.routing_step_id
        LEFT JOIN mrp_workcenters wc ON wc.id = wo.workcenter_id
        WHERE wo.manufacturing_order_id = :mo_id
        ORDER BY wo.id
    """), {"mo_id": mo_id})
    rows = result.mappings().all()
    return [dict(r) for r in rows]

@router.post("")
async def create_work_order(payload: WorkOrderCreate, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    wo = MrpWorkOrder(**payload.dict())
    db.add(wo)
    await db.commit()
    await db.refresh(wo)
    return {"id": wo.id}

@router.put("/{wo_id}")
async def update_work_order(wo_id: int, payload: WorkOrderUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(select(MrpWorkOrder).where(MrpWorkOrder.id == wo_id))
    wo = result.scalar_one_or_none()
    if not wo: raise HTTPException(404, "Work order not found")
    update_data = payload.dict(exclude_unset=True)
    for field, value in update_data.items():
        if hasattr(wo, field):
            setattr(wo, field, value)
    if payload.state == "in_progress" and not wo.actual_start_at:
        wo.actual_start_at = datetime.utcnow()
    if payload.state == "done" and not wo.actual_end_at:
        wo.actual_end_at = datetime.utcnow()
        if wo.actual_start_at:
            wo.duration_minutes = (wo.actual_end_at - wo.actual_start_at).total_seconds() / 60
    await db.commit()
    await db.refresh(wo)
    return {"ok": True, "id": wo.id, "state": wo.state}

@router.delete("/{wo_id}")
async def delete_work_order(wo_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(select(MrpWorkOrder).where(MrpWorkOrder.id == wo_id))
    wo = result.scalar_one_or_none()
    if not wo: raise HTTPException(404, "Not found")
    await db.delete(wo)
    await db.commit()
    return {"ok": True}
