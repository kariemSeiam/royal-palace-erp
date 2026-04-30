import { apiFetch } from "../../lib/api/client";

export type WorkerProfileResponse = {
  user: {
    id: number;
    full_name: string;
    username: string;
    email?: string | null;
    phone?: string | null;
    is_active: boolean;
    is_superuser: boolean;
    factory_id?: number | null;
    role_id?: number | null;
    employee_id?: number | null;
  };
  employee: {
    id: number;
    factory_id: number;
    department_id: number;
    employee_code: string;
    first_name: string;
    last_name: string;
    job_title?: string | null;
    hire_date?: string | null;
    phone?: string | null;
    email?: string | null;
    employment_status: string;
    is_active: boolean;
  };
  factory?: {
    id: number;
    code: string;
    name: string;
    is_active: boolean;
  } | null;
  department?: {
    id: number;
    name: string;
    code: string;
    is_active: boolean;
  } | null;
  role?: {
    id: number;
    code: string;
    name: string;
    is_active: boolean;
  } | null;
  assignments?: {
    machine?: string | null;
    workstation?: string | null;
    production_line?: string | null;
    shift?: string | null;
  } | null;
};

export async function getWorkerProfile(): Promise<WorkerProfileResponse> {
  return apiFetch("/worker/profile", {
    method: "GET",
  });
}
