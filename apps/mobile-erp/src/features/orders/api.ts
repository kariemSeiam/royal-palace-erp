import { apiFetch } from "../../lib/api/client";

export type AdminOrderRow = {
  id: number;
  parent_order_id?: number | null;
  is_master_order?: boolean;
  factory_id?: number | null;
  factory_name?: string | null;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  order_number?: string | null;
  order_type?: string | null;
  status?: string | null;
  payment_status?: string | null;
  subtotal_amount?: string | null;
  vat_amount?: string | null;
  total_amount?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  shipping_address?: string | null;
  business_account_id?: number | null;
  user_id?: number | null;
};

export type OrderWarehouseOption = {
  id: number;
  factory_id: number;
  factory_name?: string | null;
  code?: string | null;
  name?: string | null;
  is_active?: boolean;
};

export async function getOrders(): Promise<AdminOrderRow[]> {
  return apiFetch("/admin/orders");
}

export async function getOrderWarehouseOptions(): Promise<OrderWarehouseOption[]> {
  return apiFetch("/admin/orders/warehouses/options");
}
