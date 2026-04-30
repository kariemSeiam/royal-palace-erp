from datetime import date, datetime
from pydantic import BaseModel, Field


class EmployeeLeaveCreateRequest(BaseModel):
    factory_id: int
    employee_id: int
    leave_type: str = "annual"
    start_date: date
    end_date: date
    total_days: int = Field(default=1, ge=1)
    status: str = "draft"
    is_paid: bool = True
    notes: str | None = None


class EmployeeLeaveStatusUpdateRequest(BaseModel):
    status: str
    notes: str | None = None


class EmployeeEvaluationCreateRequest(BaseModel):
    factory_id: int
    employee_id: int
    evaluation_month: int = Field(ge=1, le=12)
    evaluation_year: int = Field(ge=2000, le=2100)
    rating_score: int = Field(ge=0, le=100)
    rating_label: str
    strengths: str | None = None
    notes: str | None = None
    bonus_amount: float = 0
    deduction_amount: float = 0
    status: str = "draft"


class EmployeeEvaluationStatusUpdateRequest(BaseModel):
    status: str
    notes: str | None = None


class EmployeeCompensationCreateRequest(BaseModel):
    factory_id: int
    employee_id: int
    basic_salary: float = 0
    housing_allowance: float = 0
    transport_allowance: float = 0
    meal_allowance: float = 0
    other_allowance: float = 0
    fixed_deductions: float = 0
    daily_salary_divisor: int = Field(default=30, ge=1)
    currency: str = "EGP"
    effective_from: date


class HrPayrollPolicyUpsertRequest(BaseModel):
    factory_id: int
    standard_work_hours_per_day: int = Field(default=8, ge=1, le=24)
    late_grace_minutes: int = Field(default=15, ge=0, le=240)
    overtime_multiplier: float = Field(default=1.25, ge=0, le=10)
    half_day_deduction_ratio: float = Field(default=0.50, ge=0, le=1)
    absence_deduction_multiplier: float = Field(default=1.00, ge=0, le=5)
    unpaid_leave_deduction_multiplier: float = Field(default=1.00, ge=0, le=5)
    late_deduction_enabled: bool = True
    overtime_enabled: bool = True


class PayrollRunGenerateRequest(BaseModel):
    factory_id: int
    payroll_month: int = Field(ge=1, le=12)
    payroll_year: int = Field(ge=2000, le=2100)
    notes: str | None = None


class PayrollRunStatusUpdateRequest(BaseModel):
    status: str
    notes: str | None = None


class PayrollReceiptMarkPaidRequest(BaseModel):
    notes: str | None = None


class PayrollReceiptAcknowledgeRequest(BaseModel):
    notes: str | None = None


class EmployeeLeaveOut(BaseModel):
    id: int
    factory_id: int
    employee_id: int
    leave_type: str
    start_date: date
    end_date: date
    total_days: int
    status: str
    is_paid: bool
    notes: str | None = None
    approved_by_user_id: int | None = None
    approved_at: datetime | None = None
    rejected_by_user_id: int | None = None
    rejected_at: datetime | None = None
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class EmployeeEvaluationOut(BaseModel):
    id: int
    factory_id: int
    employee_id: int
    evaluation_month: int
    evaluation_year: int
    rating_score: int
    rating_label: str
    strengths: str | None = None
    notes: str | None = None
    bonus_amount: float
    deduction_amount: float
    status: str
    approved_by_user_id: int | None = None
    approved_at: datetime | None = None
    rejected_by_user_id: int | None = None
    rejected_at: datetime | None = None
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class EmployeeCompensationOut(BaseModel):
    id: int
    factory_id: int
    employee_id: int
    basic_salary: float
    housing_allowance: float
    transport_allowance: float
    meal_allowance: float
    other_allowance: float
    fixed_deductions: float
    daily_salary_divisor: int
    currency: str
    effective_from: date
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None


class HrPayrollPolicyOut(BaseModel):
    id: int
    factory_id: int
    standard_work_hours_per_day: int
    late_grace_minutes: int
    overtime_multiplier: float
    half_day_deduction_ratio: float
    absence_deduction_multiplier: float
    unpaid_leave_deduction_multiplier: float
    late_deduction_enabled: bool
    overtime_enabled: bool
    is_active: bool
    created_at: datetime | None = None
    updated_at: datetime | None = None
