import { apiFetch } from "../../lib/api/client";
import type { AdminOrderRow } from "../orders/api";

export type WorkOrderRow = {
  id: number;
  order_id: number;
  order_number?: string | null;
  factory_id?: number | null;
  factory_name?: string | null;
  status?: string | null;
  notes?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type WorkOrderCreatePayload = {
  order_id: number;
  factory_id: number;
  notes?: string | null;
};

export type WorkOrderUpdatePayload = {
  status: string;
  notes?: string | null;
};

export async function getWorkOrders(): Promise<WorkOrderRow[]> {
  return apiFetch("/admin/work-orders");
}

export async function createWorkOrder(payload: WorkOrderCreatePayload): Promise<WorkOrderRow> {
  return apiFetch("/admin/work-orders", {
    method: "POST",
    body: JSON.stringify(payload)
  });
}

export async function updateWorkOrder(
  workOrderId: number | string,
  payload: WorkOrderUpdatePayload
): Promise<WorkOrderRow> {
  return apiFetch(`/admin/work-orders/${workOrderId}`, {
    method: "PUT",
    body: JSON.stringify(payload)
  });
}

export async function deleteWorkOrder(workOrderId: number | string): Promise<{ message: string }> {
  return apiFetch(`/admin/work-orders/${workOrderId}`, {
    method: "DELETE"
  });
}

export function buildEligibleOrderOptions(orders: AdminOrderRow[]) {
  return orders
    .filter((item) => !item.parent_order_id && !item.is_master_order && item.factory_id)
    .map((item) => ({
      id: item.id,
      order_number: item.order_number || `#${item.id}`,
      factory_id: item.factory_id || 0,
      factory_name: item.factory_name || "",
      label: item.order_number
        ? `${item.order_number} - ${item.customer_name || "بدون عميل"} - ${item.factory_name || `Factory #${item.factory_id}`}`
        : `#${item.id} - ${item.customer_name || "بدون عميل"}`
    }));
}
