import { apiFetch } from "../../lib/api/client";

export type WorkerWorkOrderItem = {
  id: number;
  order_id: number;
  product_id: number;
  name_ar?: string | null;
  name_en?: string | null;
  slug?: string | null;
  sku?: string | null;
  primary_image_url?: string | null;
  quantity: number;
};

export type WorkerWorkOrder = {
  id: number;
  order_id: number;
  order_number?: string | null;
  factory_id: number;
  factory_name?: string | null;
  status: string;
  notes?: string | null;
  assigned_employee_id?: number | null;
  assigned_employee_name?: string | null;
  assigned_employee_job_title?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  items_count: number;
  items_quantity_total: number;
  items: WorkerWorkOrderItem[];
};

export type WorkerWorkOrdersListResponse = {
  employee_id: number;
  employee_name?: string | null;
  factory_id: number;
  items: WorkerWorkOrder[];
};

export type WorkerWorkOrderDetailsResponse = {
  employee_id: number;
  employee_name?: string | null;
  factory_id: number;
  work_order: WorkerWorkOrder;
};

export async function getWorkerWorkOrders(): Promise<WorkerWorkOrdersListResponse> {
  return apiFetch("/worker/work-orders", {
    method: "GET",
  });
}

export async function getWorkerWorkOrderById(workOrderId: number | string): Promise<WorkerWorkOrderDetailsResponse> {
  return apiFetch(`/worker/work-orders/${workOrderId}`, {
    method: "GET",
  });
}
