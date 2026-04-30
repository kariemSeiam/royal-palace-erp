from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role, is_factory_scoped, get_user_factory_scope_id
from src.core.db.session import get_db
from src.models.user import User
from src.models.appointment import Appointment

router = APIRouter(prefix="/admin/appointments", tags=["admin-appointments"])

async def require_appointment_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "appointment.view", "appointment.manage"):
        raise HTTPException(status_code=403, detail="Appointments access denied")
    return user

def _scope_filter(stmt, factory_column, current_user):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            stmt = stmt.where(factory_column == scoped_id)
    return stmt

@router.get("")
async def list_appointments(current_user: User = Depends(require_appointment_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(Appointment).order_by(Appointment.scheduled_at.asc())
    stmt = _scope_filter(stmt, Appointment.factory_id, current_user)
    result = await db.execute(stmt.limit(200))
    rows = result.scalars().all()
    return [{"id":r.id,"subject":r.subject,"employee_id":r.employee_id,"factory_id":r.factory_id,"scheduled_at":str(r.scheduled_at) if r.scheduled_at else None,"duration_minutes":r.duration_minutes,"status":r.status,"notes":r.notes} for r in rows]

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_appointment(payload: dict, current_user: User = Depends(require_appointment_view), db: AsyncSession = Depends(get_db)):
    appt = Appointment(subject=payload["subject"], employee_id=payload.get("employee_id"), factory_id=payload.get("factory_id"), scheduled_at=payload.get("scheduled_at"), duration_minutes=payload.get("duration_minutes",30), status=payload.get("status","confirmed"), notes=payload.get("notes"))
    db.add(appt)
    await db.commit()
    await db.refresh(appt)
    return {"id":appt.id,"subject":appt.subject,"scheduled_at":str(appt.scheduled_at) if appt.scheduled_at else None}

@router.put("/{appointment_id}")
async def update_appointment(appointment_id: int, payload: dict, current_user: User = Depends(require_appointment_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Appointment).where(Appointment.id == appointment_id))
    appt = result.scalar_one_or_none()
    if not appt: raise HTTPException(status_code=404, detail="Appointment not found")
    for field in ["subject","employee_id","factory_id","scheduled_at","duration_minutes","status","notes"]:
        if field in payload: setattr(appt, field, payload[field])
    await db.commit()
    await db.refresh(appt)
    return {"id":appt.id,"subject":appt.subject,"status":appt.status}

@router.delete("/{appointment_id}")
async def delete_appointment(appointment_id: int, current_user: User = Depends(require_appointment_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Appointment).where(Appointment.id == appointment_id))
    appt = result.scalar_one_or_none()
    if not appt: raise HTTPException(status_code=404, detail="Appointment not found")
    await db.delete(appt)
    await db.commit()
    return {"message":"Appointment deleted"}
