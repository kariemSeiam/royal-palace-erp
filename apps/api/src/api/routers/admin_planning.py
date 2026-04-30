from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role, is_factory_scoped, get_user_factory_scope_id
from src.core.db.session import get_db
from src.models.user import User
from src.models.planning import PlanningResource, PlanningSlot

router = APIRouter(prefix="/admin/planning", tags=["admin-planning"])

async def require_planning_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "planning.view", "planning.manage"):
        raise HTTPException(status_code=403, detail="Planning access denied")
    return user

def _scope_filter(stmt, factory_column, current_user):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            stmt = stmt.where(factory_column == scoped_id)
    return stmt

@router.get("/slots")
async def list_slots(current_user: User = Depends(require_planning_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(PlanningSlot).order_by(PlanningSlot.planned_start_at.asc())
    stmt = _scope_filter(stmt, PlanningSlot.factory_id, current_user)
    result = await db.execute(stmt.limit(500))
    rows = result.scalars().all()
    return [{"id":r.id,"resource_id":r.resource_id,"factory_id":r.factory_id,"work_order_id":r.work_order_id,"planned_start_at":str(r.planned_start_at) if r.planned_start_at else None,"planned_end_at":str(r.planned_end_at) if r.planned_end_at else None,"actual_start_at":str(r.actual_start_at) if r.actual_start_at else None,"actual_end_at":str(r.actual_end_at) if r.actual_end_at else None,"status":r.status,"notes":r.notes} for r in rows]

@router.post("/slots", status_code=status.HTTP_201_CREATED)
async def create_slot(payload: dict, current_user: User = Depends(require_planning_view), db: AsyncSession = Depends(get_db)):
    slot = PlanningSlot(resource_id=payload["resource_id"], factory_id=payload.get("factory_id"), work_order_id=payload.get("work_order_id"), planned_start_at=payload["planned_start_at"], planned_end_at=payload["planned_end_at"], status=payload.get("status","planned"), notes=payload.get("notes"))
    db.add(slot)
    await db.commit()
    await db.refresh(slot)
    return {"id":slot.id,"resource_id":slot.resource_id,"planned_start_at":str(slot.planned_start_at)}

@router.put("/slots/{slot_id}")
async def update_slot(slot_id: int, payload: dict, current_user: User = Depends(require_planning_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(PlanningSlot).where(PlanningSlot.id == slot_id))
    slot = result.scalar_one_or_none()
    if not slot: raise HTTPException(status_code=404, detail="Slot not found")
    for field in ["resource_id","factory_id","work_order_id","planned_start_at","planned_end_at","actual_start_at","actual_end_at","status","notes"]:
        if field in payload: setattr(slot, field, payload[field])
    await db.commit()
    await db.refresh(slot)
    return {"id":slot.id,"planned_start_at":str(slot.planned_start_at)}

@router.delete("/slots/{slot_id}")
async def delete_slot(slot_id: int, current_user: User = Depends(require_planning_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(PlanningSlot).where(PlanningSlot.id == slot_id))
    slot = result.scalar_one_or_none()
    if not slot: raise HTTPException(status_code=404, detail="Slot not found")
    await db.delete(slot)
    await db.commit()
    return {"message":"Slot deleted"}

@router.get("/resources")
async def list_resources(current_user: User = Depends(require_planning_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(PlanningResource).order_by(PlanningResource.id.asc()).limit(200))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"resource_type":r.resource_type,"employee_id":r.employee_id,"work_order_id":r.work_order_id} for r in rows]

@router.post("/resources", status_code=status.HTTP_201_CREATED)
async def create_resource(payload: dict, current_user: User = Depends(require_planning_view), db: AsyncSession = Depends(get_db)):
    resource = PlanningResource(name=payload["name"], resource_type=payload.get("resource_type","employee"), employee_id=payload.get("employee_id"), work_order_id=payload.get("work_order_id"))
    db.add(resource)
    await db.commit()
    await db.refresh(resource)
    return {"id":resource.id,"name":resource.name}
