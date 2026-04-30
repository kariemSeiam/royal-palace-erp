import { apiFetch } from "../../lib/api/client";

export type WorkerHrOverview = {
  user: {
    id: number;
    full_name?: string;
    username?: string;
    email?: string | null;
    phone?: string | null;
  };
  employee: {
    id: number;
    employee_code?: string;
    first_name?: string;
    last_name?: string;
    job_title?: string | null;
    hire_date?: string | null;
    employment_status?: string;
  };
  factory?: {
    id: number;
    code: string;
    name: string;
  } | null;
  department?: {
    id: number;
    code: string;
    name: string;
  } | null;
  role?: {
    id: number;
    code: string;
    name: string;
  } | null;
  policy?: {
    standard_work_hours_per_day?: number;
    late_grace_minutes?: number;
    overtime_multiplier?: number;
  } | null;
  compensation: {
    basic_salary: number;
    housing_allowance: number;
    transport_allowance: number;
    meal_allowance: number;
    other_allowance: number;
    fixed_deductions: number;
    daily_salary_divisor: number;
    currency: string;
    effective_from?: string | null;
  };
  leaves: Array<{
    id: number;
    leave_type: string;
    start_date: string;
    end_date: string;
    total_days?: number;
    days_count?: number;
    status?: string;
    workflow_status?: string;
    is_paid: boolean;
    notes?: string | null;
  }>;
  evaluations: Array<{
    id: number;
    evaluation_month: number;
    evaluation_year: number;
    rating_score: number;
    rating_label: string;
    strengths?: string | null;
    notes?: string | null;
    bonus_amount: number;
    deduction_amount: number;
  }>;
  payslips: Array<{
    id: number;
    payroll_run_id: number;
    payroll_month: number;
    payroll_year: number;
    basic_salary: number;
    allowances_total: number;
    bonuses_total: number;
    deductions_total: number;
    absence_days: number;
    absence_deduction: number;
    late_minutes: number;
    late_deduction: number;
    half_day_days: number;
    half_day_deduction: number;
    unpaid_leave_days: number;
    unpaid_leave_deduction: number;
    overtime_minutes: number;
    overtime_amount: number;
    evaluation_bonus: number;
    evaluation_deduction: number;
    net_salary: number;
    currency: string;
    receipt_code: string;
    receipt_status: string;
    workflow_status?: string;
    paid_at?: string | null;
    received_at?: string | null;
    acknowledged_at?: string | null;
    received_notes?: string | null;
    can_acknowledge_receipt?: boolean;
  }>;
  attendance_summary?: {
    expected_minutes?: number;
    worked_minutes?: number;
    late_minutes?: number;
    overtime_minutes?: number;
  } | null;
};

export async function getWorkerHrOverview(): Promise<WorkerHrOverview> {
  return apiFetch("/worker/hr/overview", { method: "GET" });
}

export async function acknowledgeWorkerPayslip(payrollLineId: number, notes?: string) {
  return apiFetch(`/worker/hr/payslips/${payrollLineId}/acknowledge`, {
    method: "POST",
    body: JSON.stringify({
      notes: notes || null,
    }),
  });
}
