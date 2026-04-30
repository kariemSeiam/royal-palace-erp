from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header, HTTPException
from jose import JWTError, jwt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config.settings import settings
from src.core.db.session import get_db
from src.core.security.jwt import ALGORITHM
from src.models.erp_org import Department, Employee
from src.models.hr_payroll import EmployeeCompensation, EmployeeEvaluation, EmployeeLeave, HrPayrollPolicy, PayrollLine
from src.models.user import Factory, Role, User
from src.schemas.hr_payroll import PayrollReceiptAcknowledgeRequest

router = APIRouter(prefix="/worker/hr", tags=["worker-hr"])


def as_float(value):
    if value is None:
        return 0.0
    try:
        return float(value)
    except Exception:
        return 0.0


async def ensure_hr_payroll_tables(db: AsyncSession) -> None:
    statements = [
        """
        CREATE TABLE IF NOT EXISTS employee_leaves (
            id SERIAL PRIMARY KEY,
            factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
            employee_id INTEGER NOT NULL REFERENCES employees(id) ON DELETE RESTRICT,
            leave_type VARCHAR(50) NOT NULL DEFAULT 'annual',
            start_date DATE NOT NULL,
            end_date DATE NOT NULL,
            total_days INTEGER NOT NULL DEFAULT 1,
            status VARCHAR(50) NOT NULL DEFAULT 'approved',
            is_paid BOOLEAN NOT NULL DEFAULT TRUE,
            notes TEXT NULL,
            created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
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
            created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
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
        """,
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
        """,
        """
        CREATE TABLE IF NOT EXISTS payroll_runs (
            id SERIAL PRIMARY KEY,
            factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
            payroll_month INTEGER NOT NULL,
            payroll_year INTEGER NOT NULL,
            status VARCHAR(50) NOT NULL DEFAULT 'generated',
            generated_at TIMESTAMPTZ NOT NULL,
            generated_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            notes TEXT NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
        """,
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
        """,
    ]
    for statement in statements:
        await db.execute(text(statement))

    await db.commit()


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
    if not user or not user.is_active:
        raise HTTPException(status_code=401, detail="Unauthorized")

    if not user.employee_id or not user.factory_id:
        raise HTTPException(status_code=403, detail="This account is not linked to an employee and factory")

    employee_result = await db.execute(
        select(Employee).where(
            Employee.id == user.employee_id,
            Employee.factory_id == user.factory_id,
            Employee.is_active == True,
        )
    )
    employee = employee_result.scalar_one_or_none()
    if not employee:
        raise HTTPException(status_code=404, detail="Employee record not found")

    return user, employee


@router.get("/overview")
async def get_worker_hr_overview(
    actor=Depends(get_current_worker_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    user, employee = actor

    department = None
    if employee.department_id:
        department_result = await db.execute(select(Department).where(Department.id == employee.department_id))
        department = department_result.scalar_one_or_none()

    factory = None
    if user.factory_id:
        factory_result = await db.execute(select(Factory).where(Factory.id == user.factory_id))
        factory = factory_result.scalar_one_or_none()

    role = None
    if user.role_id:
        role_result = await db.execute(select(Role).where(Role.id == user.role_id))
        role = role_result.scalar_one_or_none()

    policy_result = await db.execute(
        select(HrPayrollPolicy).where(
            HrPayrollPolicy.factory_id == user.factory_id,
            HrPayrollPolicy.is_active == True,
        )
    )
    policy = policy_result.scalar_one_or_none()

    compensation_result = await db.execute(
        select(EmployeeCompensation)
        .where(
            EmployeeCompensation.employee_id == employee.id,
            EmployeeCompensation.factory_id == user.factory_id,
            EmployeeCompensation.is_active == True,
        )
        .order_by(EmployeeCompensation.effective_from.desc(), EmployeeCompensation.id.desc())
    )
    compensation = compensation_result.scalars().first()

    leaves_result = await db.execute(
        select(EmployeeLeave)
        .where(
            EmployeeLeave.employee_id == employee.id,
            EmployeeLeave.factory_id == user.factory_id,
            EmployeeLeave.is_active == True,
        )
        .order_by(EmployeeLeave.start_date.desc(), EmployeeLeave.id.desc())
        .limit(6)
    )
    leaves = leaves_result.scalars().all()

    evaluations_result = await db.execute(
        select(EmployeeEvaluation)
        .where(
            EmployeeEvaluation.employee_id == employee.id,
            EmployeeEvaluation.factory_id == user.factory_id,
            EmployeeEvaluation.is_active == True,
        )
        .order_by(EmployeeEvaluation.evaluation_year.desc(), EmployeeEvaluation.evaluation_month.desc(), EmployeeEvaluation.id.desc())
        .limit(6)
    )
    evaluations = evaluations_result.scalars().all()

    payslips_result = await db.execute(
        text(
            """
            SELECT
                pl.id,
                pl.payroll_run_id,
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
                pr.payroll_month,
                pr.payroll_year
            FROM payroll_lines pl
            JOIN payroll_runs pr ON pr.id = pl.payroll_run_id
            WHERE pl.factory_id = :factory_id
              AND pl.employee_id = :employee_id
            ORDER BY pr.payroll_year DESC, pr.payroll_month DESC, pl.id DESC
            LIMIT 6
            """
        ),
        {"factory_id": int(user.factory_id), "employee_id": int(employee.id)},
    )

    payslips = []
    for row in payslips_result.mappings().all():
        payslips.append(
            {
                "id": row["id"],
                "payroll_run_id": row["payroll_run_id"],
                "payroll_month": row["payroll_month"],
                "payroll_year": row["payroll_year"],
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
                "can_acknowledge_receipt": row["receipt_status"] == "paid",
            }
        )

    return {
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "username": user.username,
            "email": user.email,
            "phone": user.phone,
        },
        "employee": {
            "id": employee.id,
            "employee_code": employee.employee_code,
            "first_name": employee.first_name,
            "last_name": employee.last_name,
            "job_title": employee.job_title,
            "hire_date": employee.hire_date.isoformat() if employee.hire_date else None,
            "employment_status": employee.employment_status,
        },
        "factory": {
            "id": factory.id,
            "code": factory.code,
            "name": factory.name,
        } if factory else None,
        "department": {
            "id": department.id,
            "code": department.code,
            "name": department.name,
        } if department else None,
        "role": {
            "id": role.id,
            "code": role.code,
            "name": role.name,
        } if role else None,
        "policy": {
            "standard_work_hours_per_day": policy.standard_work_hours_per_day if policy else 8,
            "late_grace_minutes": policy.late_grace_minutes if policy else 15,
            "overtime_multiplier": as_float(policy.overtime_multiplier) if policy else 1.25,
            "half_day_deduction_ratio": as_float(policy.half_day_deduction_ratio) if policy else 0.50,
            "absence_deduction_multiplier": as_float(policy.absence_deduction_multiplier) if policy else 1.00,
            "unpaid_leave_deduction_multiplier": as_float(policy.unpaid_leave_deduction_multiplier) if policy else 1.00,
            "late_deduction_enabled": policy.late_deduction_enabled if policy else True,
            "overtime_enabled": policy.overtime_enabled if policy else True,
        },
        "compensation": {
            "basic_salary": as_float(compensation.basic_salary) if compensation else 0,
            "housing_allowance": as_float(compensation.housing_allowance) if compensation else 0,
            "transport_allowance": as_float(compensation.transport_allowance) if compensation else 0,
            "meal_allowance": as_float(compensation.meal_allowance) if compensation else 0,
            "other_allowance": as_float(compensation.other_allowance) if compensation else 0,
            "fixed_deductions": as_float(compensation.fixed_deductions) if compensation else 0,
            "daily_salary_divisor": compensation.daily_salary_divisor if compensation else 30,
            "currency": compensation.currency if compensation else "EGP",
            "effective_from": compensation.effective_from.isoformat() if compensation and compensation.effective_from else None,
        },
        "leaves": [
            {
                "id": row.id,
                "leave_type": row.leave_type,
                "start_date": row.start_date,
                "end_date": row.end_date,
                "total_days": row.total_days,
                "status": row.status,
                "is_paid": row.is_paid,
                "notes": row.notes,
            }
            for row in leaves
        ],
        "evaluations": [
            {
                "id": row.id,
                "evaluation_month": row.evaluation_month,
                "evaluation_year": row.evaluation_year,
                "rating_score": row.rating_score,
                "rating_label": row.rating_label,
                "strengths": row.strengths,
                "notes": row.notes,
                "bonus_amount": as_float(row.bonus_amount),
                "deduction_amount": as_float(row.deduction_amount),
            }
            for row in evaluations
        ],
        "payslips": payslips,
    }


@router.get("/leaves")
async def get_worker_leaves(
    actor=Depends(get_current_worker_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    user, employee = actor
    result = await db.execute(
        select(EmployeeLeave)
        .where(
            EmployeeLeave.employee_id == employee.id,
            EmployeeLeave.factory_id == user.factory_id,
            EmployeeLeave.is_active == True,
        )
        .order_by(EmployeeLeave.start_date.desc(), EmployeeLeave.id.desc())
    )
    rows = result.scalars().all()
    return [
        {
            "id": row.id,
            "leave_type": row.leave_type,
            "start_date": row.start_date,
            "end_date": row.end_date,
            "total_days": row.total_days,
            "status": row.status,
            "is_paid": row.is_paid,
            "notes": row.notes,
        }
        for row in rows
    ]


@router.get("/evaluations")
async def get_worker_evaluations(
    actor=Depends(get_current_worker_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    user, employee = actor
    result = await db.execute(
        select(EmployeeEvaluation)
        .where(
            EmployeeEvaluation.employee_id == employee.id,
            EmployeeEvaluation.factory_id == user.factory_id,
            EmployeeEvaluation.is_active == True,
        )
        .order_by(EmployeeEvaluation.evaluation_year.desc(), EmployeeEvaluation.evaluation_month.desc(), EmployeeEvaluation.id.desc())
    )
    rows = result.scalars().all()
    return [
        {
            "id": row.id,
            "evaluation_month": row.evaluation_month,
            "evaluation_year": row.evaluation_year,
            "rating_score": row.rating_score,
            "rating_label": row.rating_label,
            "strengths": row.strengths,
            "notes": row.notes,
            "bonus_amount": as_float(row.bonus_amount),
            "deduction_amount": as_float(row.deduction_amount),
        }
        for row in rows
    ]


@router.get("/payslips")
async def get_worker_payslips(
    actor=Depends(get_current_worker_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    user, employee = actor
    result = await db.execute(
        text(
            """
            SELECT
                pl.id,
                pl.payroll_run_id,
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
                pr.payroll_month,
                pr.payroll_year
            FROM payroll_lines pl
            JOIN payroll_runs pr ON pr.id = pl.payroll_run_id
            WHERE pl.factory_id = :factory_id
              AND pl.employee_id = :employee_id
            ORDER BY pr.payroll_year DESC, pr.payroll_month DESC, pl.id DESC
            """
        ),
        {"factory_id": int(user.factory_id), "employee_id": int(employee.id)},
    )
    rows = result.mappings().all()
    return [
        {
            "id": row["id"],
            "payroll_run_id": row["payroll_run_id"],
            "payroll_month": row["payroll_month"],
            "payroll_year": row["payroll_year"],
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
            "can_acknowledge_receipt": row["receipt_status"] == "paid",
        }
        for row in rows
    ]


@router.post("/payslips/{payroll_line_id}/acknowledge")
async def acknowledge_worker_payslip(
    payroll_line_id: int,
    payload: PayrollReceiptAcknowledgeRequest,
    actor=Depends(get_current_worker_user),
    db: AsyncSession = Depends(get_db),
):
    await ensure_hr_payroll_tables(db)
    user, employee = actor

    result = await db.execute(
        select(PayrollLine).where(
            PayrollLine.id == payroll_line_id,
            PayrollLine.employee_id == employee.id,
            PayrollLine.factory_id == user.factory_id,
        )
    )
    line = result.scalar_one_or_none()
    if not line:
        raise HTTPException(status_code=404, detail="Payroll receipt not found")

    if line.receipt_status == "pending":
        raise HTTPException(status_code=409, detail="Payroll receipt is not marked paid yet")

    if line.receipt_status == "received":
        raise HTTPException(status_code=409, detail="Payroll receipt already acknowledged")

    line.receipt_status = "received"
    line.received_at = datetime.now(timezone.utc)
    if payload.notes:
        line.received_notes = payload.notes

    await db.commit()
    await db.refresh(line)

    return {
        "id": line.id,
        "receipt_code": line.receipt_code,
        "receipt_status": line.receipt_status,
        "paid_at": line.paid_at,
        "received_at": line.received_at,
        "received_notes": line.received_notes,
    }
