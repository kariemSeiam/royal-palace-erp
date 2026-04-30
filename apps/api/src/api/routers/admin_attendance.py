from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    apply_factory_scope_filter,
    enforce_factory_scope,
    require_attendance_manage,
    require_attendance_view,
)
from src.core.db.session import get_db
from src.models.attendance import AttendanceLog
from src.models.erp_org import Employee
from src.models.user import Factory, User
from src.schemas.attendance import AttendanceCreateRequest, AttendanceOut

router = APIRouter(prefix="/admin/attendance", tags=["admin-attendance"])

VALID_ATTENDANCE_STATUSES = {
    "present",
    "absent",
    "late",
    "incomplete",
    "half_day",
    "unpaid_leave",
    "paid_leave",
}


async def ensure_attendance_policy_columns(db: AsyncSession) -> None:
    await db.execute(text("ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS worked_minutes_override INTEGER NOT NULL DEFAULT 0"))
    await db.execute(text("ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS late_minutes INTEGER NOT NULL DEFAULT 0"))
    await db.execute(text("ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER NOT NULL DEFAULT 0"))
    await db.execute(text("ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS half_day_minutes INTEGER NOT NULL DEFAULT 0"))
    await db.commit()


def serialize_attendance(row: AttendanceLog) -> AttendanceOut:
    return AttendanceOut(
        id=row.id,
        factory_id=row.factory_id,
        employee_id=row.employee_id,
        attendance_date=row.attendance_date,
        check_in_at=row.check_in_at,
        check_out_at=row.check_out_at,
        source=row.source,
        status=row.status,
        worked_minutes_override=int(row.worked_minutes_override or 0),
        late_minutes=int(row.late_minutes or 0),
        overtime_minutes=int(row.overtime_minutes or 0),
        half_day_minutes=int(row.half_day_minutes or 0),
        notes=row.notes,
        is_active=row.is_active,
    )


@router.get("", response_model=list[AttendanceOut])
async def list_attendance(
    current_user: User = Depends(require_attendance_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_attendance_policy_columns(db)

    stmt = select(AttendanceLog).order_by(AttendanceLog.attendance_date.desc(), AttendanceLog.id.desc())
    stmt = apply_factory_scope_filter(stmt, AttendanceLog.factory_id, current_user)

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [serialize_attendance(row) for row in rows]


@router.post("", response_model=AttendanceOut, status_code=status.HTTP_201_CREATED)
async def create_attendance(
    payload: AttendanceCreateRequest,
    current_user: User = Depends(require_attendance_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_attendance_policy_columns(db)

    enforce_factory_scope(
        current_user,
        payload.factory_id,
        detail="Cannot create attendance outside assigned factory",
    )

    if payload.status not in VALID_ATTENDANCE_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid attendance status")

    factory_result = await db.execute(select(Factory).where(Factory.id == payload.factory_id))
    factory = factory_result.scalar_one_or_none()
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")

    employee_result = await db.execute(
        select(Employee).where(
            Employee.id == payload.employee_id,
            Employee.factory_id == payload.factory_id,
        )
    )
    employee = employee_result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found for this factory")

    attendance = AttendanceLog(
        factory_id=payload.factory_id,
        employee_id=payload.employee_id,
        attendance_date=payload.attendance_date,
        check_in_at=payload.check_in_at,
        check_out_at=payload.check_out_at,
        source=payload.source,
        status=payload.status,
        worked_minutes_override=payload.worked_minutes_override,
        late_minutes=payload.late_minutes,
        overtime_minutes=payload.overtime_minutes,
        half_day_minutes=payload.half_day_minutes,
        notes=payload.notes,
        is_active=True,
    )
    db.add(attendance)
    await db.commit()
    await db.refresh(attendance)

    return serialize_attendance(attendance)


@router.delete("/{attendance_id}")
async def delete_attendance(
    attendance_id: int,
    current_user: User = Depends(require_attendance_manage),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(AttendanceLog).where(AttendanceLog.id == attendance_id))
    attendance = result.scalar_one_or_none()

    if not attendance:
        raise HTTPException(status_code=404, detail="Attendance record not found")

    enforce_factory_scope(
        current_user,
        attendance.factory_id,
        detail="Cannot delete attendance outside assigned factory",
    )

    await db.delete(attendance)
    await db.commit()
    return {"message": "Attendance deleted successfully"}
