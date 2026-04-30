import { apiFetch } from "../../lib/api/client";

export type CategoryRow = {
  id: number;
  name_ar?: string | null;
  name_en?: string | null;
  slug?: string | null;
  description_ar?: string | null;
  description_en?: string | null;
  image_url?: string | null;
  banner_image_url?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
};

export type ProductRow = {
  id: number;
  factory_id?: number | null;
  factory_name?: string | null;
  name_ar?: string | null;
  name_en?: string | null;
  slug?: string | null;
  sku?: string | null;
  category_id?: number | null;
  category_name?: string | null;
  base_price?: string | number | null;
  description_ar?: string | null;
  description_en?: string | null;
  technical_specifications?: string | null;
  specifications?: string | null;
  materials?: string | null;
  dimensions?: string | null;
  color_options?: string | null;
  primary_image_url?: string | null;
  preview_image_url?: string | null;
  glb_url?: string | null;
  usdz_url?: string | null;
  is_featured?: boolean;
  ar_enabled?: boolean;
  is_active?: boolean;
};

export async function getCategories(): Promise<CategoryRow[]> {
  return apiFetch("/admin/catalog/categories");
}

export async function getProducts(): Promise<ProductRow[]> {
  return apiFetch("/admin/catalog/products");
}
