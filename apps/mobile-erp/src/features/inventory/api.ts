import { apiFetch } from "../../lib/api/client";

export type WarehouseRow = {
  id: number;
  factory_id: number;
  factory_name?: string | null;
  code?: string | null;
  name?: string | null;
  description?: string | null;
  is_active?: boolean;
};

export type InventoryMovementRow = {
  id: number;
  factory_id: number;
  factory_name?: string | null;
  warehouse_id: number;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  product_id: number;
  product_name?: string | null;
  product_sku?: string | null;
  movement_type?: string | null;
  quantity?: number | string | null;
  reference_type?: string | null;
  reference_id?: number | null;
  notes?: string | null;
  created_by_user_id?: number | null;
  created_by_name?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
};

export type StockSummaryRow = {
  factory_id: number;
  factory_name?: string | null;
  warehouse_id: number;
  warehouse_name?: string | null;
  warehouse_code?: string | null;
  product_id: number;
  product_name?: string | null;
  product_sku?: string | null;
  current_stock?: number | string | null;
};

export async function getWarehouses(): Promise<WarehouseRow[]> {
  return apiFetch("/admin/inventory/warehouses");
}

export async function getInventoryMovements(): Promise<InventoryMovementRow[]> {
  return apiFetch("/admin/inventory/movements");
}

export async function getStockSummary(): Promise<StockSummaryRow[]> {
  return apiFetch("/admin/inventory/stock-summary");
}
