import { apiFetch } from "../../lib/api/client";

export type DashboardStatsResponse = {
  factory_scope: number | null;
  summary: {
    factories_count: number;
    departments_count: number;
    employees_count: number;
    attendance_count: number;
    orders_count: number;
    users_count: number;
    roles_count: number;
    categories_count: number;
    products_count: number;
    b2b_accounts_count: number;
  };
  order_status_breakdown: Array<{
    status: string;
    count: number;
  }>;
  factory_overview: Array<{
    id: number;
    code: string;
    name: string;
    is_active: boolean;
    departments_count: number;
    employees_count: number;
  }>;
};

export async function getDashboardStats(): Promise<DashboardStatsResponse> {
  return apiFetch("/admin/dashboard/stats");
}
