import { apiFetch } from "../../lib/api/client";
import type { CategoryRow, ProductRow } from "../catalog/api";

export type RoleRow = {
  id: number;
  name: string;
  code: string;
  is_active?: boolean;
  users_count?: number;
};

export type PermissionCatalogRow = {
  id: number;
  code: string;
  name: string;
  module: string;
  is_active?: boolean;
};

export type RolePermissionsResponse = {
  role_id: number;
  permissions: string[];
};

export type ItAccessSummaryResponse = {
  summary: {
    active_users_with_it_access: number;
    superusers_count: number;
    factory_scoped_users_count: number;
    total_roles_with_it_permissions: number;
    total_users_with_it_access: number;
    viewer_factory_scope: number | null;
    scope_mode: string;
  };
  roles: Array<{
    id: number;
    name: string;
    code: string;
    users_count?: number;
  }>;
  users: Array<{
    id: number;
    full_name?: string | null;
    email?: string | null;
    factory_id?: number | null;
    factory_name?: string | null;
    role_code?: string | null;
    role_name?: string | null;
    is_superuser?: boolean;
    is_active?: boolean;
  }>;
};

export type ItOverviewResponse = {
  generated_at: string;
  scope: {
    is_superuser: boolean;
    factory_id: number | null;
    role_id: number | null;
    role_code: string | null;
  };
  database_probe: {
    status: string;
    detail?: string | null;
  };
  summary_counts: {
    users_count: number;
    roles_count: number;
    factories_count: number;
    departments_count: number;
    employees_count: number;
    attendance_count: number;
    products_count: number;
    categories_count: number;
    orders_count: number;
    b2b_accounts_count: number;
  };
  permission_catalog_counts: {
    it_permissions: number;
    infra_permissions: number;
    digital_governance_permissions: number;
  };
  service_probes: Array<{
    key: string;
    label: string;
    type: string;
    note?: string | null;
    status: string;
    status_code?: number | null;
    detail?: string | null;
  }>;
  path_visibility: Record<
    string,
    {
      path: string;
      exists_from_api_container: boolean;
      is_dir: boolean;
      is_file: boolean;
      modified_at?: string | null;
      size_bytes?: number | null;
    }
  >;
};

export type ItBackupsResponse = {
  generated_at: string;
  configured_backups_path: string;
  backups_path_visibility: {
    path: string;
    exists_from_api_container: boolean;
    is_dir: boolean;
    is_file: boolean;
    modified_at?: string | null;
    size_bytes?: number | null;
  };
  visible_entries: Array<{
    name: string;
    path: string;
    exists_from_api_container: boolean;
    is_dir: boolean;
    is_file: boolean;
    modified_at?: string | null;
    size_bytes?: number | null;
    detail?: string | null;
  }>;
  database_probe: {
    status: string;
    detail?: string | null;
  };
  notes?: string[];
};

export type ItGovernanceSummaryResponse = {
  generated_at: string;
  media_total: number;
  media_active: number;
  theme: {
    theme_name?: string | null;
    primary_color?: string | null;
    secondary_color?: string | null;
    accent_color?: string | null;
    surface_color?: string | null;
    text_color?: string | null;
    is_rtl?: boolean;
    font_family?: string | null;
  };
  branding: {
    brand_name_ar?: string | null;
    brand_name_en?: string | null;
    support_email?: string | null;
    support_phone?: string | null;
    company_address?: string | null;
  };
  ui_settings: {
    admin_title_ar?: string | null;
    admin_title_en?: string | null;
    dashboard_layout?: string | null;
    cards_density?: string | null;
    enable_animations?: boolean;
    sidebar_style?: string | null;
  };
};

export async function getRoles(): Promise<RoleRow[]> {
  return apiFetch("/admin/users/roles");
}

export async function getPermissionCatalog(): Promise<PermissionCatalogRow[]> {
  return apiFetch("/admin/users/permissions/catalog");
}

export async function getRolePermissions(roleId: number | string): Promise<RolePermissionsResponse> {
  return apiFetch(`/admin/users/roles/${roleId}/permissions`);
}

export async function getItAccessCenterSummary(): Promise<ItAccessSummaryResponse> {
  return apiFetch("/admin/it/access-center/summary");
}

export async function getItOverview(): Promise<ItOverviewResponse> {
  return apiFetch("/admin/it/overview");
}

export async function getItBackups(): Promise<ItBackupsResponse> {
  return apiFetch("/admin/it/backups");
}

export async function getItGovernanceSummary(): Promise<ItGovernanceSummaryResponse> {
  return apiFetch("/admin/it/governance/summary");
}

export async function getMediaProducts(): Promise<ProductRow[]> {
  return apiFetch("/admin/catalog/products");
}

export async function getMediaCategories(): Promise<CategoryRow[]> {
  return apiFetch("/admin/catalog/categories");
}
