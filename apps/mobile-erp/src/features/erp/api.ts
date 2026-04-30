import { apiFetch } from "../../lib/api/client";

export type FactoryRow = {
  id: number;
  code: string;
  name: string;
  is_active?: boolean;
};

export type DepartmentRow = {
  id: number;
  factory_id: number;
  name: string;
  code: string;
  is_active?: boolean;
};

export type EmployeeRow = {
  id: number;
  factory_id: number;
  department_id: number;
  employee_code?: string | null;
  first_name?: string | null;
  last_name?: string | null;
  job_title?: string | null;
  hire_date?: string | null;
  phone?: string | null;
  email?: string | null;
  employment_status?: string | null;
  is_active?: boolean;
};

export type AttendanceRow = {
  id: number;
  factory_id: number;
  employee_id: number;
  attendance_date: string;
  check_in_at?: string | null;
  check_out_at?: string | null;
  source?: string | null;
  status?: string | null;
  notes?: string | null;
  is_active?: boolean;
};

export async function getFactories(): Promise<FactoryRow[]> {
  return apiFetch("/admin/erp/factories");
}

export async function getDepartments(): Promise<DepartmentRow[]> {
  return apiFetch("/admin/erp/departments");
}

export async function getEmployees(): Promise<EmployeeRow[]> {
  return apiFetch("/admin/erp/employees");
}

export async function getAttendance(): Promise<AttendanceRow[]> {
  return apiFetch("/admin/attendance");
}
