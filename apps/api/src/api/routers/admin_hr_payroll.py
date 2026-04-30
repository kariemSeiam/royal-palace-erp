from datetime import datetime, timezone
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import enforce_factory_scope, require_hr_payroll_manage, require_hr_payroll_view
from src.core.db.session import get_db
from src.models.erp_org import Employee
from src.models.hr_payroll import (
    EmployeeCompensation,
    EmployeeEvaluation,
    EmployeeLeave,
    HrPayrollPolicy,
    PayrollLine,
    PayrollRun,
)
from src.models.user import Factory, User
from src.schemas.hr_payroll import (
    EmployeeCompensationCreateRequest,
    EmployeeCompensationOut,
    EmployeeEvaluationCreateRequest,
    EmployeeEvaluationOut,
    EmployeeEvaluationStatusUpdateRequest,
    EmployeeLeaveCreateRequest,
    EmployeeLeaveOut,
    EmployeeLeaveStatusUpdateRequest,
    HrPayrollPolicyOut,
    HrPayrollPolicyUpsertRequest,
    PayrollReceiptMarkPaidRequest,
    PayrollRunGenerateRequest,
    PayrollRunStatusUpdateRequest,
)

router = APIRouter(prefix="/admin/hr", tags=["admin-hr-payroll"])

LEAVE_ALLOWED_STATUSES = {"draft", "approved", "rejected", "cancelled"}
EVALUATION_ALLOWED_STATUSES = {"draft", "approved", "rejected"}
PAYROLL_RUN_ALLOWED_STATUSES = {"generated", "finalized", "cancelled"}


def as_float(value: Any) -> float:
    if value is None:
        return 0.0
    if isinstance(value, Decimal):
        return float(value)
    return float(value)


async def ensure_hr_payroll_tables(db: AsyncSession) -> None:
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS employee_leaves (
                id SERIAL PRIMARY KEY,
                factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
                employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
                leave_type VARCHAR(50) NOT NULL DEFAULT 'annual',
                start_date DATE NOT NULL,
                end_date DATE NOT NULL,
                total_days INTEGER NOT NULL DEFAULT 1,
                status VARCHAR(50) NOT NULL DEFAULT 'draft',
                is_paid BOOLEAN NOT NULL DEFAULT TRUE,
                notes TEXT NULL,
                approved_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                approved_at TIMESTAMPTZ NULL,
                rejected_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                rejected_at TIMESTAMPTZ NULL,
                created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS employee_evaluations (
                id SERIAL PRIMARY KEY,
                factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
                employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
                evaluation_month INTEGER NOT NULL,
                evaluation_year INTEGER NOT NULL,
                rating_score INTEGER NOT NULL DEFAULT 0,
                rating_label VARCHAR(100) NOT NULL DEFAULT 'Average',
                strengths TEXT NULL,
                notes TEXT NULL,
                bonus_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
                deduction_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
                status VARCHAR(50) NOT NULL DEFAULT 'draft',
                approved_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                approved_at TIMESTAMPTZ NULL,
                rejected_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                rejected_at TIMESTAMPTZ NULL,
                created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS employee_compensations (
                id SERIAL PRIMARY KEY,
                factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
                employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
                basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
                housing_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
                transport_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
                meal_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
                other_allowance NUMERIC(12,2) NOT NULL DEFAULT 0,
                fixed_deductions NUMERIC(12,2) NOT NULL DEFAULT 0,
                daily_salary_divisor INTEGER NOT NULL DEFAULT 30,
                currency VARCHAR(10) NOT NULL DEFAULT 'EGP',
                effective_from DATE NOT NULL,
                created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS hr_payroll_policies (
                id SERIAL PRIMARY KEY,
                factory_id INTEGER NOT NULL UNIQUE REFERENCES factories(id) ON DELETE RESTRICT,
                standard_work_hours_per_day INTEGER NOT NULL DEFAULT 8,
                late_grace_minutes INTEGER NOT NULL DEFAULT 15,
                overtime_multiplier NUMERIC(8,2) NOT NULL DEFAULT 1.25,
                half_day_deduction_ratio NUMERIC(8,2) NOT NULL DEFAULT 0.50,
                absence_deduction_multiplier NUMERIC(8,2) NOT NULL DEFAULT 1.00,
                unpaid_leave_deduction_multiplier NUMERIC(8,2) NOT NULL DEFAULT 1.00,
                late_deduction_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                overtime_enabled BOOLEAN NOT NULL DEFAULT TRUE,
                created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS payroll_runs (
                id SERIAL PRIMARY KEY,
                factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
                payroll_month INTEGER NOT NULL,
                payroll_year INTEGER NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'generated',
                finalized_at TIMESTAMPTZ NULL,
                finalized_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                generated_at TIMESTAMPTZ NOT NULL,
                generated_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                notes TEXT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS payroll_lines (
                id SERIAL PRIMARY KEY,
                payroll_run_id INTEGER NOT NULL REFERENCES payroll_runs(id) ON DELETE CASCADE,
                factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
                employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
                basic_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
                allowances_total NUMERIC(12,2) NOT NULL DEFAULT 0,
                bonuses_total NUMERIC(12,2) NOT NULL DEFAULT 0,
                deductions_total NUMERIC(12,2) NOT NULL DEFAULT 0,
                absence_days INTEGER NOT NULL DEFAULT 0,
                absence_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
                late_minutes INTEGER NOT NULL DEFAULT 0,
                late_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
                half_day_days INTEGER NOT NULL DEFAULT 0,
                half_day_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
                unpaid_leave_days INTEGER NOT NULL DEFAULT 0,
                unpaid_leave_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
                overtime_minutes INTEGER NOT NULL DEFAULT 0,
                overtime_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
                evaluation_bonus NUMERIC(12,2) NOT NULL DEFAULT 0,
                evaluation_deduction NUMERIC(12,2) NOT NULL DEFAULT 0,
                net_salary NUMERIC(12,2) NOT NULL DEFAULT 0,
                currency VARCHAR(10) NOT NULL DEFAULT 'EGP',
                receipt_code VARCHAR(100) NOT NULL,
                receipt_status VARCHAR(50) NOT NULL DEFAULT 'pending',
                paid_at TIMESTAMPTZ NULL,
                received_at TIMESTAMPTZ NULL,
                received_notes TEXT NULL,
                notes TEXT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )

    alter_statements = [
        "ALTER TABLE employee_leaves ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL",
        "ALTER TABLE employee_leaves ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL",
        "ALTER TABLE employee_leaves ADD COLUMN IF NOT EXISTS rejected_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL",
        "ALTER TABLE employee_leaves ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ NULL",
        "ALTER TABLE employee_leaves ALTER COLUMN status SET DEFAULT 'draft'",
        "ALTER TABLE employee_evaluations ADD COLUMN IF NOT EXISTS status VARCHAR(50) NOT NULL DEFAULT 'draft'",
        "ALTER TABLE employee_evaluations ADD COLUMN IF NOT EXISTS approved_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL",
        "ALTER TABLE employee_evaluations ADD COLUMN IF NOT EXISTS approved_at TIMESTAMPTZ NULL",
        "ALTER TABLE employee_evaluations ADD COLUMN IF NOT EXISTS rejected_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL",
        "ALTER TABLE employee_evaluations ADD COLUMN IF NOT EXISTS rejected_at TIMESTAMPTZ NULL",
        "ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS finalized_at TIMESTAMPTZ NULL",
        "ALTER TABLE payroll_runs ADD COLUMN IF NOT EXISTS finalized_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL",
        "ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS worked_minutes_override INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS late_minutes INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE attendance_logs ADD COLUMN IF NOT EXISTS half_day_minutes INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS late_minutes INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS late_deduction NUMERIC(12,2) NOT NULL DEFAULT 0",
        "ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS half_day_days INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS half_day_deduction NUMERIC(12,2) NOT NULL DEFAULT 0",
        "ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS unpaid_leave_days INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS unpaid_leave_deduction NUMERIC(12,2) NOT NULL DEFAULT 0",
        "ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS overtime_minutes INTEGER NOT NULL DEFAULT 0",
        "ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS overtime_amount NUMERIC(12,2) NOT NULL DEFAULT 0",
        "ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS received_at TIMESTAMPTZ NULL",
        "ALTER TABLE payroll_lines ADD COLUMN IF NOT EXISTS received_notes TEXT NULL",
    ]
    for statement in alter_statements:
        await db.execute(text(statement))

    await db.commit()


def serialize_leave(row: EmployeeLeave) -> EmployeeLeaveOut:
    return EmployeeLeaveOut(
        id=row.id,
        factory_id=row.factory_id,
        employee_id=row.employee_id,
        leave_type=row.leave_type,
        start_date=row.start_date,
        end_date=row.end_date,
        total_days=row.total_days,
        status=row.status,
        is_paid=row.is_paid,
        notes=row.notes,
        approved_by_user_id=getattr(row, "approved_by_user_id", None),
        approved_at=getattr(row, "approved_at", None),
        rejected_by_user_id=getattr(row, "rejected_by_user_id", None),
        rejected_at=getattr(row, "rejected_at", None),
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def serialize_evaluation(row: EmployeeEvaluation) -> EmployeeEvaluationOut:
    return EmployeeEvaluationOut(
        id=row.id,
        factory_id=row.factory_id,
        employee_id=row.employee_id,
        evaluation_month=row.evaluation_month,
        evaluation_year=row.evaluation_year,
        rating_score=row.rating_score,
        rating_label=row.rating_label,
        strengths=row.strengths,
        notes=row.notes,
        bonus_amount=as_float(row.bonus_amount),
        deduction_amount=as_float(row.deduction_amount),
        status=getattr(row, "status", "draft"),
        approved_by_user_id=getattr(row, "approved_by_user_id", None),
        approved_at=getattr(row, "approved_at", None),
        rejected_by_user_id=getattr(row, "rejected_by_user_id", None),
        rejected_at=getattr(row, "rejected_at", None),
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def serialize_compensation(row: EmployeeCompensation) -> EmployeeCompensationOut:
    return EmployeeCompensationOut(
        id=row.id,
        factory_id=row.factory_id,
        employee_id=row.employee_id,
        basic_salary=as_float(row.basic_salary),
        housing_allowance=as_float(row.housing_allowance),
        transport_allowance=as_float(row.transport_allowance),
        meal_allowance=as_float(row.meal_allowance),
        other_allowance=as_float(row.other_allowance),
        fixed_deductions=as_float(row.fixed_deductions),
        daily_salary_divisor=row.daily_salary_divisor,
        currency=row.currency,
        effective_from=row.effective_from,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def serialize_policy(row: HrPayrollPolicy) -> HrPayrollPolicyOut:
    return HrPayrollPolicyOut(
        id=row.id,
        factory_id=row.factory_id,
        standard_work_hours_per_day=row.standard_work_hours_per_day,
        late_grace_minutes=row.late_grace_minutes,
        overtime_multiplier=as_float(row.overtime_multiplier),
        half_day_deduction_ratio=as_float(row.half_day_deduction_ratio),
        absence_deduction_multiplier=as_float(row.absence_deduction_multiplier),
        unpaid_leave_deduction_multiplier=as_float(row.unpaid_leave_deduction_multiplier),
        late_deduction_enabled=row.late_deduction_enabled,
        overtime_enabled=row.overtime_enabled,
        is_active=row.is_active,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


async def get_factory_or_404(db: AsyncSession, factory_id: int) -> Factory:
    result = await db.execute(select(Factory).where(Factory.id == factory_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Factory not found")
    return row


async def get_employee_or_404(db: AsyncSession, employee_id: int) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Employee not found")
    return row


async def get_policy_for_factory(db: AsyncSession, factory_id: int) -> HrPayrollPolicy | None:
    result = await db.execute(
        select(HrPayrollPolicy).where(
            HrPayrollPolicy.factory_id == factory_id,
            HrPayrollPolicy.is_active == True,
        )
    )
    return result.scalar_one_or_none()


@router.get("/policy", response_model=HrPayrollPolicyOut | None)
async def get_policy(
    factory_id: int = Query(...),
    current_user: User = Depends(require_hr_payroll_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    enforce_factory_scope(current_user, factory_id, detail="Cannot view policy outside assigned factory")
    policy = await get_policy_for_factory(db, factory_id)
    if not policy:
        return None
    return serialize_policy(policy)


@router.post("/policy", response_model=HrPayrollPolicyOut, status_code=status.HTTP_201_CREATED)
async def upsert_policy(
    payload: HrPayrollPolicyUpsertRequest,
    current_user: User = Depends(require_hr_payroll_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    enforce_factory_scope(current_user, payload.factory_id, detail="Cannot manage policy outside assigned factory")
    await get_factory_or_404(db, payload.factory_id)

    existing = await get_policy_for_factory(db, payload.factory_id)

    if existing:
        existing.standard_work_hours_per_day = payload.standard_work_hours_per_day
        existing.late_grace_minutes = payload.late_grace_minutes
        existing.overtime_multiplier = payload.overtime_multiplier
        existing.half_day_deduction_ratio = payload.half_day_deduction_ratio
        existing.absence_deduction_multiplier = payload.absence_deduction_multiplier
        existing.unpaid_leave_deduction_multiplier = payload.unpaid_leave_deduction_multiplier
        existing.late_deduction_enabled = payload.late_deduction_enabled
        existing.overtime_enabled = payload.overtime_enabled
        existing.is_active = True

        await db.commit()
        await db.refresh(existing)
        return serialize_policy(existing)

    row = HrPayrollPolicy(
        factory_id=payload.factory_id,
        standard_work_hours_per_day=payload.standard_work_hours_per_day,
        late_grace_minutes=payload.late_grace_minutes,
        overtime_multiplier=payload.overtime_multiplier,
        half_day_deduction_ratio=payload.half_day_deduction_ratio,
        absence_deduction_multiplier=payload.absence_deduction_multiplier,
        unpaid_leave_deduction_multiplier=payload.unpaid_leave_deduction_multiplier,
        late_deduction_enabled=payload.late_deduction_enabled,
        overtime_enabled=payload.overtime_enabled,
        created_by_user_id=current_user.id,
        is_active=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return serialize_policy(row)


@router.get("/leaves", response_model=list[EmployeeLeaveOut])
async def list_leaves(
    current_user: User = Depends(require_hr_payroll_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    result = await db.execute(select(EmployeeLeave).order_by(EmployeeLeave.id.desc()))
    rows = result.scalars().all()
    scoped = [
        row for row in rows
        if current_user.is_superuser or current_user.factory_id is None or row.factory_id == current_user.factory_id
    ]
    return [serialize_leave(row) for row in scoped]


@router.post("/leaves", response_model=EmployeeLeaveOut, status_code=status.HTTP_201_CREATED)
async def create_leave(
    payload: EmployeeLeaveCreateRequest,
    current_user: User = Depends(require_hr_payroll_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    enforce_factory_scope(current_user, payload.factory_id, detail="Cannot create leave outside assigned factory")
    await get_factory_or_404(db, payload.factory_id)
    employee = await get_employee_or_404(db, payload.employee_id)
    if employee.factory_id != payload.factory_id:
        raise HTTPException(status_code=400, detail="Employee does not belong to this factory")
    if payload.end_date < payload.start_date:
        raise HTTPException(status_code=400, detail="end_date must be after or equal to start_date")
    if payload.status not in LEAVE_ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid leave status")

    row = EmployeeLeave(
        factory_id=payload.factory_id,
        employee_id=payload.employee_id,
        leave_type=payload.leave_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        total_days=payload.total_days,
        status=payload.status,
        is_paid=payload.is_paid,
        notes=payload.notes,
        created_by_user_id=current_user.id,
        is_active=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return serialize_leave(row)


@router.post("/leaves/{leave_id}/status", response_model=EmployeeLeaveOut)
async def update_leave_status(
    leave_id: int,
    payload: EmployeeLeaveStatusUpdateRequest,
    current_user: User = Depends(require_hr_payroll_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)

    if payload.status not in LEAVE_ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid leave status")

    result = await db.execute(select(EmployeeLeave).where(EmployeeLeave.id == leave_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Leave record not found")

    enforce_factory_scope(current_user, row.factory_id, detail="Cannot modify leave outside assigned factory")

    row.status = payload.status
    row.notes = payload.notes if payload.notes is not None else row.notes

    if payload.status == "approved":
        row.approved_by_user_id = current_user.id
        row.approved_at = datetime.now(timezone.utc)
        row.rejected_by_user_id = None
        row.rejected_at = None
    elif payload.status == "rejected":
        row.rejected_by_user_id = current_user.id
        row.rejected_at = datetime.now(timezone.utc)
    else:
        row.approved_by_user_id = None
        row.approved_at = None
        if payload.status != "rejected":
            row.rejected_by_user_id = None
            row.rejected_at = None

    await db.commit()
    await db.refresh(row)
    return serialize_leave(row)


@router.get("/evaluations", response_model=list[EmployeeEvaluationOut])
async def list_evaluations(
    current_user: User = Depends(require_hr_payroll_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    result = await db.execute(
        select(EmployeeEvaluation).order_by(
            EmployeeEvaluation.evaluation_year.desc(),
            EmployeeEvaluation.evaluation_month.desc(),
            EmployeeEvaluation.id.desc(),
        )
    )
    rows = result.scalars().all()
    scoped = [
        row for row in rows
        if current_user.is_superuser or current_user.factory_id is None or row.factory_id == current_user.factory_id
    ]
    return [serialize_evaluation(row) for row in scoped]


@router.post("/evaluations", response_model=EmployeeEvaluationOut, status_code=status.HTTP_201_CREATED)
async def create_evaluation(
    payload: EmployeeEvaluationCreateRequest,
    current_user: User = Depends(require_hr_payroll_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    enforce_factory_scope(current_user, payload.factory_id, detail="Cannot create evaluation outside assigned factory")
    await get_factory_or_404(db, payload.factory_id)
    employee = await get_employee_or_404(db, payload.employee_id)
    if employee.factory_id != payload.factory_id:
        raise HTTPException(status_code=400, detail="Employee does not belong to this factory")
    if payload.status not in EVALUATION_ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid evaluation status")

    row = EmployeeEvaluation(
        factory_id=payload.factory_id,
        employee_id=payload.employee_id,
        evaluation_month=payload.evaluation_month,
        evaluation_year=payload.evaluation_year,
        rating_score=payload.rating_score,
        rating_label=payload.rating_label,
        strengths=payload.strengths,
        notes=payload.notes,
        bonus_amount=payload.bonus_amount,
        deduction_amount=payload.deduction_amount,
        status=payload.status,
        created_by_user_id=current_user.id,
        is_active=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return serialize_evaluation(row)


@router.post("/evaluations/{evaluation_id}/status", response_model=EmployeeEvaluationOut)
async def update_evaluation_status(
    evaluation_id: int,
    payload: EmployeeEvaluationStatusUpdateRequest,
    current_user: User = Depends(require_hr_payroll_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)

    if payload.status not in EVALUATION_ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid evaluation status")

    result = await db.execute(select(EmployeeEvaluation).where(EmployeeEvaluation.id == evaluation_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Evaluation record not found")

    enforce_factory_scope(current_user, row.factory_id, detail="Cannot modify evaluation outside assigned factory")

    row.status = payload.status
    row.notes = payload.notes if payload.notes is not None else row.notes

    if payload.status == "approved":
        row.approved_by_user_id = current_user.id
        row.approved_at = datetime.now(timezone.utc)
        row.rejected_by_user_id = None
        row.rejected_at = None
    elif payload.status == "rejected":
        row.rejected_by_user_id = current_user.id
        row.rejected_at = datetime.now(timezone.utc)
    else:
        row.approved_by_user_id = None
        row.approved_at = None
        if payload.status != "rejected":
            row.rejected_by_user_id = None
            row.rejected_at = None

    await db.commit()
    await db.refresh(row)
    return serialize_evaluation(row)


@router.get("/compensations", response_model=list[EmployeeCompensationOut])
async def list_compensations(
    current_user: User = Depends(require_hr_payroll_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    result = await db.execute(
        select(EmployeeCompensation).order_by(
            EmployeeCompensation.effective_from.desc(),
            EmployeeCompensation.id.desc(),
        )
    )
    rows = result.scalars().all()
    scoped = [
        row for row in rows
        if current_user.is_superuser or current_user.factory_id is None or row.factory_id == current_user.factory_id
    ]
    return [serialize_compensation(row) for row in scoped]


@router.post("/compensations", response_model=EmployeeCompensationOut, status_code=status.HTTP_201_CREATED)
async def create_compensation(
    payload: EmployeeCompensationCreateRequest,
    current_user: User = Depends(require_hr_payroll_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    enforce_factory_scope(current_user, payload.factory_id, detail="Cannot create compensation outside assigned factory")
    await get_factory_or_404(db, payload.factory_id)
    employee = await get_employee_or_404(db, payload.employee_id)
    if employee.factory_id != payload.factory_id:
        raise HTTPException(status_code=400, detail="Employee does not belong to this factory")

    row = EmployeeCompensation(
        factory_id=payload.factory_id,
        employee_id=payload.employee_id,
        basic_salary=payload.basic_salary,
        housing_allowance=payload.housing_allowance,
        transport_allowance=payload.transport_allowance,
        meal_allowance=payload.meal_allowance,
        other_allowance=payload.other_allowance,
        fixed_deductions=payload.fixed_deductions,
        daily_salary_divisor=payload.daily_salary_divisor,
        currency=payload.currency,
        effective_from=payload.effective_from,
        created_by_user_id=current_user.id,
        is_active=True,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return serialize_compensation(row)


@router.post("/payroll-runs/generate")
async def generate_payroll_run(
    payload: PayrollRunGenerateRequest,
    current_user: User = Depends(require_hr_payroll_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    enforce_factory_scope(current_user, payload.factory_id, detail="Cannot generate payroll outside assigned factory")
    await get_factory_or_404(db, payload.factory_id)

    existing_run_result = await db.execute(
        select(PayrollRun).where(
            PayrollRun.factory_id == payload.factory_id,
            PayrollRun.payroll_month == payload.payroll_month,
            PayrollRun.payroll_year == payload.payroll_year,
        )
    )
    if existing_run_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Payroll run already exists for this month")

    employees_result = await db.execute(
        select(Employee).where(
            Employee.factory_id == payload.factory_id,
            Employee.is_active == True,
        ).order_by(Employee.id.asc())
    )
    employees = employees_result.scalars().all()

    policy = await get_policy_for_factory(db, payload.factory_id)

    standard_work_hours_per_day = policy.standard_work_hours_per_day if policy else 8
    late_grace_minutes = policy.late_grace_minutes if policy else 15
    overtime_multiplier = as_float(policy.overtime_multiplier) if policy else 1.25
    half_day_deduction_ratio = as_float(policy.half_day_deduction_ratio) if policy else 0.50
    absence_deduction_multiplier = as_float(policy.absence_deduction_multiplier) if policy else 1.00
    unpaid_leave_deduction_multiplier = as_float(policy.unpaid_leave_deduction_multiplier) if policy else 1.00
    late_deduction_enabled = policy.late_deduction_enabled if policy else True
    overtime_enabled = policy.overtime_enabled if policy else True

    run = PayrollRun(
        factory_id=payload.factory_id,
        payroll_month=payload.payroll_month,
        payroll_year=payload.payroll_year,
        status="generated",
        generated_at=datetime.now(timezone.utc),
        generated_by_user_id=current_user.id,
        notes=payload.notes,
    )
    db.add(run)
    await db.flush()

    for employee in employees:
        compensation_result = await db.execute(
            select(EmployeeCompensation)
            .where(
                EmployeeCompensation.employee_id == employee.id,
                EmployeeCompensation.factory_id == payload.factory_id,
                EmployeeCompensation.is_active == True,
            )
            .order_by(EmployeeCompensation.effective_from.desc(), EmployeeCompensation.id.desc())
        )
        compensation = compensation_result.scalars().first()
        if not compensation:
            continue

        evaluation_result = await db.execute(
            select(EmployeeEvaluation)
            .where(
                EmployeeEvaluation.employee_id == employee.id,
                EmployeeEvaluation.factory_id == payload.factory_id,
                EmployeeEvaluation.evaluation_month == payload.payroll_month,
                EmployeeEvaluation.evaluation_year == payload.payroll_year,
                EmployeeEvaluation.is_active == True,
                EmployeeEvaluation.status == "approved",
            )
            .order_by(EmployeeEvaluation.id.desc())
        )
        evaluation = evaluation_result.scalars().first()

        attendance_stats_result = await db.execute(
            text(
                """
                SELECT
                    COALESCE(SUM(CASE WHEN status = 'absent' THEN 1 ELSE 0 END), 0) AS absence_days,
                    COALESCE(SUM(CASE WHEN status = 'half_day' THEN 1 ELSE 0 END), 0) AS half_day_days,
                    COALESCE(SUM(CASE WHEN status = 'unpaid_leave' THEN 1 ELSE 0 END), 0) AS unpaid_leave_days,
                    COALESCE(SUM(CASE WHEN status = 'late' THEN GREATEST(late_minutes - :late_grace_minutes, 0) ELSE 0 END), 0) AS late_minutes,
                    COALESCE(SUM(CASE WHEN :overtime_enabled = TRUE THEN overtime_minutes ELSE 0 END), 0) AS overtime_minutes
                FROM attendance_logs
                WHERE factory_id = :factory_id
                  AND employee_id = :employee_id
                  AND EXTRACT(MONTH FROM attendance_date) = :payroll_month
                  AND EXTRACT(YEAR FROM attendance_date) = :payroll_year
                  AND is_active = TRUE
                """
            ),
            {
                "factory_id": payload.factory_id,
                "employee_id": employee.id,
                "payroll_month": payload.payroll_month,
                "payroll_year": payload.payroll_year,
                "late_grace_minutes": late_grace_minutes,
                "overtime_enabled": overtime_enabled,
            },
        )
        attendance_stats = attendance_stats_result.mappings().first() or {}

        absence_days = int(attendance_stats.get("absence_days") or 0)
        half_day_days = int(attendance_stats.get("half_day_days") or 0)
        unpaid_leave_days = int(attendance_stats.get("unpaid_leave_days") or 0)
        late_minutes = int(attendance_stats.get("late_minutes") or 0)
        overtime_minutes = int(attendance_stats.get("overtime_minutes") or 0)

        basic_salary = as_float(compensation.basic_salary)
        allowances_total = (
            as_float(compensation.housing_allowance)
            + as_float(compensation.transport_allowance)
            + as_float(compensation.meal_allowance)
            + as_float(compensation.other_allowance)
        )
        evaluation_bonus = as_float(evaluation.bonus_amount) if evaluation else 0.0
        evaluation_deduction = as_float(evaluation.deduction_amount) if evaluation else 0.0
        fixed_deductions = as_float(compensation.fixed_deductions)

        daily_divisor = compensation.daily_salary_divisor if compensation.daily_salary_divisor > 0 else 30
        daily_rate = basic_salary / daily_divisor
        working_minutes_per_day = max(int(standard_work_hours_per_day) * 60, 60)
        minute_rate = daily_rate / working_minutes_per_day

        absence_deduction = round(daily_rate * absence_deduction_multiplier * absence_days, 2)
        half_day_deduction = round((daily_rate * half_day_deduction_ratio) * half_day_days, 2)
        unpaid_leave_deduction = round(daily_rate * unpaid_leave_deduction_multiplier * unpaid_leave_days, 2)
        late_deduction = round((minute_rate * late_minutes), 2) if late_deduction_enabled else 0.0
        overtime_amount = round((minute_rate * overtime_multiplier) * overtime_minutes, 2) if overtime_enabled else 0.0

        bonuses_total = round(evaluation_bonus + overtime_amount, 2)
        deductions_total = round(
            fixed_deductions
            + absence_deduction
            + half_day_deduction
            + unpaid_leave_deduction
            + late_deduction
            + evaluation_deduction,
            2,
        )
        net_salary = round(basic_salary + allowances_total + bonuses_total - deductions_total, 2)

        line = PayrollLine(
            payroll_run_id=run.id,
            factory_id=payload.factory_id,
            employee_id=employee.id,
            basic_salary=basic_salary,
            allowances_total=allowances_total,
            bonuses_total=bonuses_total,
            deductions_total=deductions_total,
            absence_days=absence_days,
            absence_deduction=absence_deduction,
            late_minutes=late_minutes,
            late_deduction=late_deduction,
            half_day_days=half_day_days,
            half_day_deduction=half_day_deduction,
            unpaid_leave_days=unpaid_leave_days,
            unpaid_leave_deduction=unpaid_leave_deduction,
            overtime_minutes=overtime_minutes,
            overtime_amount=overtime_amount,
            evaluation_bonus=evaluation_bonus,
            evaluation_deduction=evaluation_deduction,
            net_salary=net_salary,
            currency=compensation.currency,
            receipt_code=f"PAY-{payload.payroll_year}{payload.payroll_month:02d}-{employee.id}",
            receipt_status="pending",
            notes=payload.notes,
        )
        db.add(line)

    await db.commit()
    await db.refresh(run)

    return {
        "id": run.id,
        "factory_id": run.factory_id,
        "payroll_month": run.payroll_month,
        "payroll_year": run.payroll_year,
        "status": run.status,
        "generated_at": run.generated_at,
        "finalized_at": getattr(run, "finalized_at", None),
    }


@router.post("/payroll-runs/{payroll_run_id}/status")
async def update_payroll_run_status(
    payroll_run_id: int,
    payload: PayrollRunStatusUpdateRequest,
    current_user: User = Depends(require_hr_payroll_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)

    if payload.status not in PAYROLL_RUN_ALLOWED_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid payroll run status")

    result = await db.execute(select(PayrollRun).where(PayrollRun.id == payroll_run_id))
    run = result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")

    enforce_factory_scope(current_user, run.factory_id, detail="Cannot modify payroll outside assigned factory")

    run.status = payload.status
    if payload.notes is not None:
        run.notes = payload.notes

    if payload.status == "finalized":
        run.finalized_at = datetime.now(timezone.utc)
        run.finalized_by_user_id = current_user.id
    elif payload.status != "finalized":
        run.finalized_at = None
        run.finalized_by_user_id = None

    await db.commit()
    await db.refresh(run)

    return {
        "id": run.id,
        "factory_id": run.factory_id,
        "payroll_month": run.payroll_month,
        "payroll_year": run.payroll_year,
        "status": run.status,
        "generated_at": run.generated_at,
        "finalized_at": getattr(run, "finalized_at", None),
        "notes": run.notes,
    }


@router.get("/payroll-runs/{payroll_run_id}")
async def get_payroll_run_details(
    payroll_run_id: int,
    current_user: User = Depends(require_hr_payroll_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)

    run_result = await db.execute(select(PayrollRun).where(PayrollRun.id == payroll_run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")

    enforce_factory_scope(current_user, run.factory_id, detail="Cannot view payroll outside assigned factory")

    lines_result = await db.execute(
        text(
            """
            SELECT
                pl.id,
                pl.employee_id,
                pl.basic_salary,
                pl.allowances_total,
                pl.bonuses_total,
                pl.deductions_total,
                pl.absence_days,
                pl.absence_deduction,
                pl.late_minutes,
                pl.late_deduction,
                pl.half_day_days,
                pl.half_day_deduction,
                pl.unpaid_leave_days,
                pl.unpaid_leave_deduction,
                pl.overtime_minutes,
                pl.overtime_amount,
                pl.evaluation_bonus,
                pl.evaluation_deduction,
                pl.net_salary,
                pl.currency,
                pl.receipt_code,
                pl.receipt_status,
                pl.paid_at,
                pl.received_at,
                pl.received_notes,
                pl.notes,
                e.employee_code,
                e.first_name,
                e.last_name
            FROM payroll_lines pl
            JOIN employees e ON e.id = pl.employee_id
            WHERE pl.payroll_run_id = :payroll_run_id
            ORDER BY pl.id ASC
            """
        ),
        {"payroll_run_id": payroll_run_id},
    )
    items = []
    totals = {
        "employees": 0,
        "net_salary_total": 0.0,
        "bonuses_total": 0.0,
        "deductions_total": 0.0,
    }
    for row in lines_result.mappings().all():
        item = {
            "id": row["id"],
            "employee_id": row["employee_id"],
            "employee_code": row["employee_code"],
            "employee_name": f'{row["first_name"]} {row["last_name"]}',
            "basic_salary": as_float(row["basic_salary"]),
            "allowances_total": as_float(row["allowances_total"]),
            "bonuses_total": as_float(row["bonuses_total"]),
            "deductions_total": as_float(row["deductions_total"]),
            "absence_days": int(row["absence_days"] or 0),
            "absence_deduction": as_float(row["absence_deduction"]),
            "late_minutes": int(row["late_minutes"] or 0),
            "late_deduction": as_float(row["late_deduction"]),
            "half_day_days": int(row["half_day_days"] or 0),
            "half_day_deduction": as_float(row["half_day_deduction"]),
            "unpaid_leave_days": int(row["unpaid_leave_days"] or 0),
            "unpaid_leave_deduction": as_float(row["unpaid_leave_deduction"]),
            "overtime_minutes": int(row["overtime_minutes"] or 0),
            "overtime_amount": as_float(row["overtime_amount"]),
            "evaluation_bonus": as_float(row["evaluation_bonus"]),
            "evaluation_deduction": as_float(row["evaluation_deduction"]),
            "net_salary": as_float(row["net_salary"]),
            "currency": row["currency"],
            "receipt_code": row["receipt_code"],
            "receipt_status": row["receipt_status"],
            "paid_at": row["paid_at"],
            "received_at": row["received_at"],
            "received_notes": row["received_notes"],
            "notes": row["notes"],
        }
        items.append(item)
        totals["employees"] += 1
        totals["net_salary_total"] += item["net_salary"]
        totals["bonuses_total"] += item["bonuses_total"]
        totals["deductions_total"] += item["deductions_total"]

    return {
        "id": run.id,
        "factory_id": run.factory_id,
        "payroll_month": run.payroll_month,
        "payroll_year": run.payroll_year,
        "status": run.status,
        "generated_at": run.generated_at,
        "finalized_at": getattr(run, "finalized_at", None),
        "finalized_by_user_id": getattr(run, "finalized_by_user_id", None),
        "notes": run.notes,
        "summary": totals,
        "items": items,
    }


@router.post("/payroll-lines/{payroll_line_id}/mark-paid")
async def mark_payroll_line_paid(
    payroll_line_id: int,
    payload: PayrollReceiptMarkPaidRequest,
    current_user: User = Depends(require_hr_payroll_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    result = await db.execute(select(PayrollLine).where(PayrollLine.id == payroll_line_id))
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Payroll line not found")

    enforce_factory_scope(current_user, line.factory_id, detail="Cannot modify payroll outside assigned factory")

    run_result = await db.execute(select(PayrollRun).where(PayrollRun.id == line.payroll_run_id))
    run = run_result.scalar_one_or_none()
    if not run:
        raise HTTPException(status_code=404, detail="Payroll run not found")

    if run.status != "finalized":
        raise HTTPException(status_code=409, detail="Payroll run must be finalized before marking salary as paid")

    if line.receipt_status == "received":
        raise HTTPException(status_code=409, detail="Payroll receipt already acknowledged by employee")

    line.receipt_status = "paid"
    line.paid_at = datetime.now(timezone.utc)
    if payload.notes:
        line.notes = payload.notes

    await db.commit()
    await db.refresh(line)

    return {
        "id": line.id,
        "receipt_code": line.receipt_code,
        "receipt_status": line.receipt_status,
        "paid_at": line.paid_at,
        "received_at": line.received_at,
    }


@router.get("/summary")
async def get_hr_summary(
    factory_id: int = Query(...),
    payroll_month: int = Query(..., ge=1, le=12),
    payroll_year: int = Query(..., ge=2000, le=2100),
    current_user: User = Depends(require_hr_payroll_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    enforce_factory_scope(current_user, factory_id, detail="Cannot view HR summary outside assigned factory")

    leaves_result = await db.execute(
        text(
            """
            SELECT
                COALESCE(status, 'unknown') AS status,
                COUNT(*) AS total
            FROM employee_leaves
            WHERE factory_id = :factory_id
              AND is_active = TRUE
              AND EXTRACT(MONTH FROM start_date) = :payroll_month
              AND EXTRACT(YEAR FROM start_date) = :payroll_year
            GROUP BY status
            ORDER BY total DESC, status ASC
            """
        ),
        {"factory_id": factory_id, "payroll_month": payroll_month, "payroll_year": payroll_year},
    )

    evaluations_result = await db.execute(
        text(
            """
            SELECT
                COALESCE(status, 'unknown') AS status,
                COUNT(*) AS total,
                COALESCE(SUM(bonus_amount), 0) AS total_bonus,
                COALESCE(SUM(deduction_amount), 0) AS total_deduction
            FROM employee_evaluations
            WHERE factory_id = :factory_id
              AND is_active = TRUE
              AND evaluation_month = :payroll_month
              AND evaluation_year = :payroll_year
            GROUP BY status
            ORDER BY total DESC, status ASC
            """
        ),
        {"factory_id": factory_id, "payroll_month": payroll_month, "payroll_year": payroll_year},
    )

    payroll_runs_result = await db.execute(
        text(
            """
            SELECT
                pr.id,
                pr.status,
                pr.generated_at,
                pr.finalized_at,
                COUNT(pl.id) AS employees_count,
                COALESCE(SUM(pl.net_salary), 0) AS net_salary_total,
                COALESCE(SUM(pl.bonuses_total), 0) AS bonuses_total,
                COALESCE(SUM(pl.deductions_total), 0) AS deductions_total,
                COALESCE(SUM(CASE WHEN pl.receipt_status = 'pending' THEN 1 ELSE 0 END), 0) AS pending_receipts,
                COALESCE(SUM(CASE WHEN pl.receipt_status = 'paid' THEN 1 ELSE 0 END), 0) AS paid_receipts,
                COALESCE(SUM(CASE WHEN pl.receipt_status = 'received' THEN 1 ELSE 0 END), 0) AS received_receipts
            FROM payroll_runs pr
            LEFT JOIN payroll_lines pl ON pl.payroll_run_id = pr.id
            WHERE pr.factory_id = :factory_id
              AND pr.payroll_month = :payroll_month
              AND pr.payroll_year = :payroll_year
            GROUP BY pr.id, pr.status, pr.generated_at, pr.finalized_at
            ORDER BY pr.id DESC
            """
        ),
        {"factory_id": factory_id, "payroll_month": payroll_month, "payroll_year": payroll_year},
    )

    compensation_result = await db.execute(
        text(
            """
            SELECT COUNT(*) AS total
            FROM employee_compensations
            WHERE factory_id = :factory_id
              AND is_active = TRUE
            """
        ),
        {"factory_id": factory_id},
    )
    compensation_count = int(compensation_result.scalar() or 0)

    employee_result = await db.execute(
        text(
            """
            SELECT COUNT(*) AS total
            FROM employees
            WHERE factory_id = :factory_id
              AND is_active = TRUE
            """
        ),
        {"factory_id": factory_id},
    )
    employee_count = int(employee_result.scalar() or 0)

    leave_breakdown = []
    leave_totals = {"total": 0, "approved": 0, "draft": 0, "rejected": 0, "cancelled": 0}
    for row in leaves_result.mappings().all():
        total = int(row["total"] or 0)
        status_code = row["status"]
        leave_breakdown.append({"status": status_code, "count": total})
        leave_totals["total"] += total
        if status_code in leave_totals:
            leave_totals[status_code] += total

    evaluation_breakdown = []
    evaluation_totals = {
        "total": 0,
        "approved": 0,
        "draft": 0,
        "rejected": 0,
        "bonus_total": 0.0,
        "deduction_total": 0.0,
    }
    for row in evaluations_result.mappings().all():
        total = int(row["total"] or 0)
        bonus_total = as_float(row["total_bonus"])
        deduction_total = as_float(row["total_deduction"])
        status_code = row["status"]
        evaluation_breakdown.append(
            {
                "status": status_code,
                "count": total,
                "bonus_total": bonus_total,
                "deduction_total": deduction_total,
            }
        )
        evaluation_totals["total"] += total
        evaluation_totals["bonus_total"] += bonus_total
        evaluation_totals["deduction_total"] += deduction_total
        if status_code in evaluation_totals:
            evaluation_totals[status_code] += total

    payroll_runs = []
    payroll_summary = {
        "runs_count": 0,
        "employees_count": 0,
        "net_salary_total": 0.0,
        "bonuses_total": 0.0,
        "deductions_total": 0.0,
        "pending_receipts": 0,
        "paid_receipts": 0,
        "received_receipts": 0,
        "generated_runs": 0,
        "finalized_runs": 0,
        "cancelled_runs": 0,
    }
    for row in payroll_runs_result.mappings().all():
        item = {
            "id": int(row["id"]),
            "status": row["status"],
            "generated_at": row["generated_at"],
            "finalized_at": row["finalized_at"],
            "employees_count": int(row["employees_count"] or 0),
            "net_salary_total": as_float(row["net_salary_total"]),
            "bonuses_total": as_float(row["bonuses_total"]),
            "deductions_total": as_float(row["deductions_total"]),
            "pending_receipts": int(row["pending_receipts"] or 0),
            "paid_receipts": int(row["paid_receipts"] or 0),
            "received_receipts": int(row["received_receipts"] or 0),
        }
        payroll_runs.append(item)
        payroll_summary["runs_count"] += 1
        payroll_summary["employees_count"] += item["employees_count"]
        payroll_summary["net_salary_total"] += item["net_salary_total"]
        payroll_summary["bonuses_total"] += item["bonuses_total"]
        payroll_summary["deductions_total"] += item["deductions_total"]
        payroll_summary["pending_receipts"] += item["pending_receipts"]
        payroll_summary["paid_receipts"] += item["paid_receipts"]
        payroll_summary["received_receipts"] += item["received_receipts"]
        if item["status"] == "generated":
            payroll_summary["generated_runs"] += 1
        elif item["status"] == "finalized":
            payroll_summary["finalized_runs"] += 1
        elif item["status"] == "cancelled":
            payroll_summary["cancelled_runs"] += 1

    return {
        "factory_id": factory_id,
        "payroll_month": payroll_month,
        "payroll_year": payroll_year,
        "employee_count": employee_count,
        "compensation_count": compensation_count,
        "leave_summary": leave_totals,
        "leave_breakdown": leave_breakdown,
        "evaluation_summary": evaluation_totals,
        "evaluation_breakdown": evaluation_breakdown,
        "payroll_summary": payroll_summary,
        "payroll_runs": payroll_runs,
    }


@router.get("/reports/payroll")
async def get_payroll_report(
    factory_id: int = Query(...),
    payroll_month: int = Query(..., ge=1, le=12),
    payroll_year: int = Query(..., ge=2000, le=2100),
    current_user: User = Depends(require_hr_payroll_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    enforce_factory_scope(current_user, factory_id, detail="Cannot view payroll report outside assigned factory")

    rows_result = await db.execute(
        text(
            """
            SELECT
                pr.id AS payroll_run_id,
                pr.status AS payroll_run_status,
                pr.generated_at,
                pr.finalized_at,
                pl.id AS payroll_line_id,
                pl.employee_id,
                pl.basic_salary,
                pl.allowances_total,
                pl.bonuses_total,
                pl.deductions_total,
                pl.absence_days,
                pl.absence_deduction,
                pl.late_minutes,
                pl.late_deduction,
                pl.half_day_days,
                pl.half_day_deduction,
                pl.unpaid_leave_days,
                pl.unpaid_leave_deduction,
                pl.overtime_minutes,
                pl.overtime_amount,
                pl.evaluation_bonus,
                pl.evaluation_deduction,
                pl.net_salary,
                pl.currency,
                pl.receipt_code,
                pl.receipt_status,
                e.employee_code,
                e.first_name,
                e.last_name
            FROM payroll_runs pr
            JOIN payroll_lines pl ON pl.payroll_run_id = pr.id
            JOIN employees e ON e.id = pl.employee_id
            WHERE pr.factory_id = :factory_id
              AND pr.payroll_month = :payroll_month
              AND pr.payroll_year = :payroll_year
            ORDER BY pr.id DESC, pl.id ASC
            """
        ),
        {"factory_id": factory_id, "payroll_month": payroll_month, "payroll_year": payroll_year},
    )

    items = []
    summary = {
        "lines_count": 0,
        "net_salary_total": 0.0,
        "basic_salary_total": 0.0,
        "allowances_total": 0.0,
        "bonuses_total": 0.0,
        "deductions_total": 0.0,
        "absence_deduction_total": 0.0,
        "late_deduction_total": 0.0,
        "half_day_deduction_total": 0.0,
        "unpaid_leave_deduction_total": 0.0,
        "overtime_amount_total": 0.0,
        "pending_receipts": 0,
        "paid_receipts": 0,
        "received_receipts": 0,
    }

    for row in rows_result.mappings().all():
        item = {
            "payroll_run_id": int(row["payroll_run_id"]),
            "payroll_run_status": row["payroll_run_status"],
            "generated_at": row["generated_at"],
            "finalized_at": row["finalized_at"],
            "payroll_line_id": int(row["payroll_line_id"]),
            "employee_id": int(row["employee_id"]),
            "employee_code": row["employee_code"],
            "employee_name": f'{row["first_name"]} {row["last_name"]}',
            "basic_salary": as_float(row["basic_salary"]),
            "allowances_total": as_float(row["allowances_total"]),
            "bonuses_total": as_float(row["bonuses_total"]),
            "deductions_total": as_float(row["deductions_total"]),
            "absence_days": int(row["absence_days"] or 0),
            "absence_deduction": as_float(row["absence_deduction"]),
            "late_minutes": int(row["late_minutes"] or 0),
            "late_deduction": as_float(row["late_deduction"]),
            "half_day_days": int(row["half_day_days"] or 0),
            "half_day_deduction": as_float(row["half_day_deduction"]),
            "unpaid_leave_days": int(row["unpaid_leave_days"] or 0),
            "unpaid_leave_deduction": as_float(row["unpaid_leave_deduction"]),
            "overtime_minutes": int(row["overtime_minutes"] or 0),
            "overtime_amount": as_float(row["overtime_amount"]),
            "evaluation_bonus": as_float(row["evaluation_bonus"]),
            "evaluation_deduction": as_float(row["evaluation_deduction"]),
            "net_salary": as_float(row["net_salary"]),
            "currency": row["currency"],
            "receipt_code": row["receipt_code"],
            "receipt_status": row["receipt_status"],
        }
        items.append(item)
        summary["lines_count"] += 1
        summary["basic_salary_total"] += item["basic_salary"]
        summary["allowances_total"] += item["allowances_total"]
        summary["bonuses_total"] += item["bonuses_total"]
        summary["deductions_total"] += item["deductions_total"]
        summary["absence_deduction_total"] += item["absence_deduction"]
        summary["late_deduction_total"] += item["late_deduction"]
        summary["half_day_deduction_total"] += item["half_day_deduction"]
        summary["unpaid_leave_deduction_total"] += item["unpaid_leave_deduction"]
        summary["overtime_amount_total"] += item["overtime_amount"]
        summary["net_salary_total"] += item["net_salary"]
        if item["receipt_status"] == "pending":
            summary["pending_receipts"] += 1
        elif item["receipt_status"] == "paid":
            summary["paid_receipts"] += 1
        elif item["receipt_status"] == "received":
            summary["received_receipts"] += 1

    return {
        "factory_id": factory_id,
        "payroll_month": payroll_month,
        "payroll_year": payroll_year,
        "summary": summary,
        "items": items,
    }
