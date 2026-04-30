from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException, status
from jose import JWTError, jwt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config.settings import settings
from src.core.db.session import get_db
from src.core.security.jwt import ALGORITHM
from src.models.attendance import AttendanceLog
from src.models.erp_org import Employee
from src.models.user import User
from src.schemas.attendance import (
    WorkerAttendanceActionRequest,
    WorkerAttendanceHistoryOut,
    WorkerAttendanceTodayOut,
)

router = APIRouter(prefix="/worker/attendance", tags=["worker-attendance"])


def utc_now() -> datetime:
    return datetime.now(timezone.utc)


async def ensure_attendance_policy_columns(db: AsyncSession) -> None:
    await db.execute(text("ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS worked_minutes_override INTEGER NOT NULL DEFAULT 0"))
    await db.execute(text("ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS late_minutes INTEGER NOT NULL DEFAULT 0"))
    await db.execute(text("ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER NOT NULL DEFAULT 0"))
    await db.execute(text("ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS half_day_minutes INTEGER NOT NULL DEFAULT 0"))
    await db.commit()


def calc_worked_minutes(row: AttendanceLog | None) -> int:
    if not row:
        return 0

    override_value = int(getattr(row, "worked_minutes_override", 0) or 0)
    if override_value > 0:
        return override_value

    if not row.check_in_at or not row.check_out_at:
        return 0

    seconds = int((row.check_out_at - row.check_in_at).total_seconds())
    if seconds <= 0:
        return 0

    return seconds // 60


def serialize_today(row: AttendanceLog | None, factory_id: int, employee_id: int, target_date):
    if not row:
        return WorkerAttendanceTodayOut(
            id=None,
            factory_id=factory_id,
            employee_id=employee_id,
            attendance_date=target_date,
            check_in_at=None,
            check_out_at=None,
            source="mobile",
            status="absent",
            worked_minutes_override=0,
            late_minutes=0,
            overtime_minutes=0,
            half_day_minutes=0,
            notes=None,
            is_active=True,
            worked_minutes=0,
        )

    return WorkerAttendanceTodayOut(
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
        worked_minutes=calc_worked_minutes(row),
    )


def serialize_history(row: AttendanceLog):
    return WorkerAttendanceHistoryOut(
        id=row.id,
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
        worked_minutes=calc_worked_minutes(row),
    )


async def get_current_worker_user(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Unauthorized")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    if not user.employee_id:
        raise HTTPException(status_code=403, detail="This account is not linked to an employee")

    employee_result = await db.execute(
        select(Employee).where(
            Employee.id == user.employee_id,
            Employee.is_active == True,
        )
    )
    employee = employee_result.scalar_one_or_none()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee record not found")

    return user, employee


@router.get("/today", response_model=WorkerAttendanceTodayOut)
async def get_today_attendance(
    actor=Depends(get_current_worker_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_attendance_policy_columns(db)

    user, employee = actor
    today = utc_now().date()

    result = await db.execute(
        select(AttendanceLog)
        .where(
            AttendanceLog.factory_id == employee.factory_id,
            AttendanceLog.employee_id == employee.id,
            AttendanceLog.attendance_date == today,
            AttendanceLog.is_active == True,
        )
        .order_by(AttendanceLog.id.desc())
    )
    row = result.scalars().first()

    return serialize_today(row, int(employee.factory_id), int(employee.id), today)


@router.get("/history", response_model=list[WorkerAttendanceHistoryOut])
async def get_attendance_history(
    actor=Depends(get_current_worker_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_attendance_policy_columns(db)

    user, employee = actor

    result = await db.execute(
        select(AttendanceLog)
        .where(
            AttendanceLog.factory_id == employee.factory_id,
            AttendanceLog.employee_id == employee.id,
            AttendanceLog.is_active == True,
        )
        .order_by(AttendanceLog.attendance_date.desc(), AttendanceLog.id.desc())
        .limit(30)
    )
    rows = result.scalars().all()

    return [serialize_history(row) for row in rows]


@router.post("/check-in", response_model=WorkerAttendanceTodayOut, status_code=status.HTTP_201_CREATED)
async def check_in(
    payload: WorkerAttendanceActionRequest,
    actor=Depends(get_current_worker_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_attendance_policy_columns(db)

    user, employee = actor
    now = utc_now()
    today = now.date()

    existing_result = await db.execute(
        select(AttendanceLog)
        .where(
            AttendanceLog.factory_id == employee.factory_id,
            AttendanceLog.employee_id == employee.id,
            AttendanceLog.attendance_date == today,
            AttendanceLog.is_active == True,
        )
        .order_by(AttendanceLog.id.desc())
    )
    existing = existing_result.scalars().first()

    if existing and existing.check_in_at:
        raise HTTPException(status_code=409, detail="Attendance already checked in today")

    if existing:
        existing.check_in_at = now
        existing.source = "mobile"
        existing.status = "present"
        existing.notes = payload.notes
        await db.commit()
        await db.refresh(existing)
        return serialize_today(existing, int(employee.factory_id), int(employee.id), today)

    row = AttendanceLog(
        factory_id=int(employee.factory_id),
        employee_id=int(employee.id),
        attendance_date=today,
        check_in_at=now,
        check_out_at=None,
        source="mobile",
        status="present",
        worked_minutes_override=0,
        late_minutes=0,
        overtime_minutes=0,
        half_day_minutes=0,
        notes=payload.notes,
        is_active=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)

    return serialize_today(row, int(employee.factory_id), int(employee.id), today)


@router.post("/check-out", response_model=WorkerAttendanceTodayOut)
async def check_out(
    payload: WorkerAttendanceActionRequest,
    actor=Depends(get_current_worker_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_attendance_policy_columns(db)

    user, employee = actor
    now = utc_now()
    today = now.date()

    result = await db.execute(
        select(AttendanceLog)
        .where(
            AttendanceLog.factory_id == employee.factory_id,
            AttendanceLog.employee_id == employee.id,
            AttendanceLog.attendance_date == today,
            AttendanceLog.is_active == True,
        )
        .order_by(AttendanceLog.id.desc())
    )
    row = result.scalars().first()

    if not row:
        raise HTTPException(status_code=404, detail="No attendance record found for today")

    if not row.check_in_at:
        raise HTTPException(status_code=409, detail="Cannot check out before check in")

    if row.check_out_at:
        raise HTTPException(status_code=409, detail="Attendance already checked out today")

    row.check_out_at = now
    row.source = "mobile"
    row.status = "present"
    row.notes = payload.notes if payload.notes is not None else row.notes

    await db.commit()
    await db.refresh(row)

    return serialize_today(row, int(employee.factory_id), int(employee.id), today)
