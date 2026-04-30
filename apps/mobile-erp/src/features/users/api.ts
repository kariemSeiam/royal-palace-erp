import { apiFetch } from "../../lib/api/client";

export type AdminUserRow = {
  id: number;
  email: string;
  username?: string | null;
  full_name?: string | null;
  is_active?: boolean;
  is_superuser?: boolean;
  role_id?: number;
  role_name?: string | null;
  role_code?: string | null;
  employee_id?: number | null;
  employee_name?: string | null;
  factory_id?: number | null;
  factory_name?: string | null;
};

export type AdminRoleRow = {
  id: number;
  name: string;
  code: string;
  is_active?: boolean;
  users_count?: number;
};

export type AdminFactoryRow = {
  id: number;
  name: string;
  code: string;
  is_active?: boolean;
};

export type AdminEmployeeRow = {
  id: number;
  employee_code?: string | null;
  full_name?: string | null;
  factory_id?: number | null;
  department_id?: number | null;
  is_active?: boolean;
};

export async function getAdminUsers(): Promise<AdminUserRow[]> {
  return apiFetch("/admin/users");
}

export async function getAdminRoles(): Promise<AdminRoleRow[]> {
  return apiFetch("/admin/users/roles");
}

export async function getAdminFactoriesForUsers(): Promise<AdminFactoryRow[]> {
  return apiFetch("/admin/users/factories");
}

export async function getAdminEmployeesForUsers(): Promise<AdminEmployeeRow[]> {
  return apiFetch("/admin/users/employees");
}
