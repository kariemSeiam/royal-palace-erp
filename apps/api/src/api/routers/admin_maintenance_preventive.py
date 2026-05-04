from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.maintenance_preventive import MaintenancePreventiveRule
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/admin/maintenance/preventive", tags=["admin-maintenance-preventive"])

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "maintenance.view", "maintenance.manage"):
        raise HTTPException(403, "Access denied")
    return user

class RuleCreate(BaseModel):
    equipment_id: int
    frequency_hours: Optional[int] = None
    frequency_days: Optional[int] = None
    next_maintenance_date: Optional[str] = None
    instructions: Optional[str] = None

@router.get("")
async def list_rules(db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(select(MaintenancePreventiveRule).limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"equipment_id":r.equipment_id,"frequency_hours":r.frequency_hours,"frequency_days":r.frequency_days,"next_maintenance_date":str(r.next_maintenance_date) if r.next_maintenance_date else None} for r in rows]

@router.post("")
async def create_rule(payload: RuleCreate, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    rule = MaintenancePreventiveRule(**payload.dict())
    db.add(rule)
    await db.commit()
    await db.refresh(rule)
    return {"id":rule.id}

@router.delete("/{rule_id}")
async def delete_rule(rule_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(select(MaintenancePreventiveRule).where(MaintenancePreventiveRule.id == rule_id))
    rule = result.scalar_one_or_none()
    if not rule: raise HTTPException(404, "Not found")
    await db.delete(rule)
    await db.commit()
    return {"ok": True}
