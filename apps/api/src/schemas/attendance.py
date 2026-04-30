from datetime import date, datetime

from pydantic import BaseModel, Field


class AttendanceCreateRequest(BaseModel):
    factory_id: int
    employee_id: int
    attendance_date: date
    check_in_at: datetime | None = None
    check_out_at: datetime | None = None
    source: str = "manual"
    status: str = "present"
    worked_minutes_override: int = Field(default=0, ge=0)
    late_minutes: int = Field(default=0, ge=0)
    overtime_minutes: int = Field(default=0, ge=0)
    half_day_minutes: int = Field(default=0, ge=0)
    notes: str | None = None


class AttendanceOut(BaseModel):
    id: int
    factory_id: int
    employee_id: int
    attendance_date: date
    check_in_at: datetime | None = None
    check_out_at: datetime | None = None
    source: str
    status: str
    worked_minutes_override: int = 0
    late_minutes: int = 0
    overtime_minutes: int = 0
    half_day_minutes: int = 0
    notes: str | None = None
    is_active: bool


class WorkerAttendanceActionRequest(BaseModel):
    notes: str | None = None


class WorkerAttendanceTodayOut(BaseModel):
    id: int | None = None
    factory_id: int
    employee_id: int
    attendance_date: date
    check_in_at: datetime | None = None
    check_out_at: datetime | None = None
    source: str
    status: str
    worked_minutes_override: int = 0
    late_minutes: int = 0
    overtime_minutes: int = 0
    half_day_minutes: int = 0
    notes: str | None = None
    is_active: bool
    worked_minutes: int = 0


class WorkerAttendanceHistoryOut(BaseModel):
    id: int
    attendance_date: date
    check_in_at: datetime | None = None
    check_out_at: datetime | None = None
    source: str
    status: str
    worked_minutes_override: int = 0
    late_minutes: int = 0
    overtime_minutes: int = 0
    half_day_minutes: int = 0
    notes: str | None = None
    worked_minutes: int = 0
