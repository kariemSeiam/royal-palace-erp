from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, ForeignKey, Integer, Numeric, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from src.core.db.base import Base, TimestampMixin


class EmployeeLeave(Base, TimestampMixin):
    __tablename__ = "employee_leaves"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    factory_id: Mapped[int] = mapped_column(ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)

    leave_type: Mapped[str] = mapped_column(String(50), nullable=False, default="annual")
    start_date: Mapped[date] = mapped_column(Date, nullable=False)
    end_date: Mapped[date] = mapped_column(Date, nullable=False)
    total_days: Mapped[int] = mapped_column(Integer, nullable=False, default=1)

    status: Mapped[str] = mapped_column(String(50), nullable=False, default="approved")
    is_paid: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class EmployeeEvaluation(Base, TimestampMixin):
    __tablename__ = "employee_evaluations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    factory_id: Mapped[int] = mapped_column(ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)

    evaluation_month: Mapped[int] = mapped_column(Integer, nullable=False)
    evaluation_year: Mapped[int] = mapped_column(Integer, nullable=False)

    rating_score: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    rating_label: Mapped[str] = mapped_column(String(100), nullable=False, default="Average")
    strengths: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)

    bonus_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    deduction_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class EmployeeCompensation(Base, TimestampMixin):
    __tablename__ = "employee_compensations"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    factory_id: Mapped[int] = mapped_column(ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)

    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    housing_allowance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    transport_allowance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    meal_allowance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    other_allowance: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    fixed_deductions: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    daily_salary_divisor: Mapped[int] = mapped_column(Integer, nullable=False, default=30)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="EGP")
    effective_from: Mapped[date] = mapped_column(Date, nullable=False)

    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class HrPayrollPolicy(Base, TimestampMixin):
    __tablename__ = "hr_payroll_policies"
    __table_args__ = (
        UniqueConstraint("factory_id", name="uq_hr_payroll_policies_factory_id"),
    )

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    factory_id: Mapped[int] = mapped_column(ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False)

    standard_work_hours_per_day: Mapped[int] = mapped_column(Integer, nullable=False, default=8)
    late_grace_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=15)
    overtime_multiplier: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=1.25)
    half_day_deduction_ratio: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=0.50)
    absence_deduction_multiplier: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=1.00)
    unpaid_leave_deduction_multiplier: Mapped[float] = mapped_column(Numeric(8, 2), nullable=False, default=1.00)
    late_deduction_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    overtime_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)

    created_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    is_active: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)


class PayrollRun(Base, TimestampMixin):
    __tablename__ = "payroll_runs"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    factory_id: Mapped[int] = mapped_column(ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False)

    payroll_month: Mapped[int] = mapped_column(Integer, nullable=False)
    payroll_year: Mapped[int] = mapped_column(Integer, nullable=False)

    status: Mapped[str] = mapped_column(String(50), nullable=False, default="generated")
    generated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    generated_by_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id", ondelete="SET NULL"),
        nullable=True,
    )
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class PayrollLine(Base, TimestampMixin):
    __tablename__ = "payroll_lines"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    payroll_run_id: Mapped[int] = mapped_column(ForeignKey("payroll_runs.id", ondelete="CASCADE"), nullable=False)

    factory_id: Mapped[int] = mapped_column(ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False)
    employee_id: Mapped[int] = mapped_column(ForeignKey("employees.id", ondelete="RESTRICT"), nullable=False)

    basic_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    allowances_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    bonuses_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    deductions_total: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    absence_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    absence_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    late_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    late_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    half_day_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    half_day_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    unpaid_leave_days: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    unpaid_leave_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    overtime_minutes: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    overtime_amount: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    evaluation_bonus: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    evaluation_deduction: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)

    net_salary: Mapped[float] = mapped_column(Numeric(12, 2), nullable=False, default=0)
    currency: Mapped[str] = mapped_column(String(10), nullable=False, default="EGP")

    receipt_code: Mapped[str] = mapped_column(String(100), nullable=False)
    receipt_status: Mapped[str] = mapped_column(String(50), nullable=False, default="pending")
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    received_notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
