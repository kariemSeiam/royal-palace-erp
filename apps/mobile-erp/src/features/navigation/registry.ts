import type { MobileErpUser } from "../auth/api";
import { hasAnyPermission, isAdminPanelUser } from "../auth/api";

export type ModuleItem = {
  key: string;
  label: string;
  hint: string;
  routePath: string;
  permissions: string[];
  accent: "navy" | "gold";
  group: "core" | "operations" | "catalog" | "commercial" | "it";
};

export const moduleRegistry: ModuleItem[] = [
  {
    key: "dashboard",
    label: "لوحة التحكم",
    hint: "المؤشرات التنفيذية العامة",
    routePath: "/dashboard",
    permissions: ["dashboard.view"],
    accent: "navy",
    group: "core"
  },
  {
    key: "users",
    label: "المستخدمون",
    hint: "الحسابات وربطها بالمصانع والموظفين",
    routePath: "/users",
    permissions: ["users.view", "users.manage"],
    accent: "navy",
    group: "core"
  },
  {
    key: "roles",
    label: "الأدوار والصلاحيات",
    hint: "RBAC وكتالوج الصلاحيات",
    routePath: "/roles",
    permissions: ["roles.view", "roles.manage"],
    accent: "gold",
    group: "core"
  },
  {
    key: "factories",
    label: "المصانع",
    hint: "إدارة المصانع ونطاقات الوصول",
    routePath: "/factories",
    permissions: ["factories.view", "factories.manage"],
    accent: "navy",
    group: "operations"
  },
  {
    key: "departments",
    label: "الأقسام",
    hint: "الهيكل التنظيمي والإداري",
    routePath: "/departments",
    permissions: ["departments.view", "departments.manage"],
    accent: "gold",
    group: "operations"
  },
  {
    key: "employees",
    label: "الموظفون",
    hint: "القوى العاملة والربط الوظيفي",
    routePath: "/employees",
    permissions: ["employees.view", "employees.manage"],
    accent: "navy",
    group: "operations"
  },
  {
    key: "attendance",
    label: "الحضور والانصراف",
    hint: "سجلات الحضور والمتابعة اليومية",
    routePath: "/attendance",
    permissions: ["attendance.view", "attendance.manage"],
    accent: "gold",
    group: "operations"
  },
  {
    key: "warehouses",
    label: "المخازن",
    hint: "المخازن التابعة لكل مصنع",
    routePath: "/warehouses",
    permissions: ["warehouses.view", "warehouses.manage"],
    accent: "navy",
    group: "operations"
  },
  {
    key: "inventory",
    label: "المخزون",
    hint: "الحركات وملخص الأرصدة",
    routePath: "/inventory",
    permissions: ["inventory.view", "inventory.manage", "stock.view", "stock.manage"],
    accent: "gold",
    group: "operations"
  },
  {
    key: "orders",
    label: "الطلبات",
    hint: "إدارة الطلبات ومراحلها",
    routePath: "/orders",
    permissions: ["orders.view", "orders.manage"],
    accent: "navy",
    group: "commercial"
  },
  {
    key: "work-orders",
    label: "أوامر التشغيل",
    hint: "ربط الطلبات بالمصانع ومراحل التصنيع",
    routePath: "/work-orders",
    permissions: ["orders.view", "orders.manage"],
    accent: "gold",
    group: "operations"
  },
  {
    key: "b2b",
    label: "حسابات B2B",
    hint: "العملاء والشركاء التجاريون",
    routePath: "/b2b",
    permissions: ["b2b.view", "b2b.manage"],
    accent: "navy",
    group: "commercial"
  },
  {
    key: "categories",
    label: "التصنيفات الرئيسية",
    hint: "هيكلة الكتالوج والتقسيمات",
    routePath: "/categories",
    permissions: ["categories.view", "categories.manage"],
    accent: "gold",
    group: "catalog"
  },
  {
    key: "products",
    label: "المنتجات",
    hint: "الكتالوج والمنتجات والوسائط",
    routePath: "/products",
    permissions: ["products.view", "products.manage", "catalog.view", "catalog.manage"],
    accent: "navy",
    group: "catalog"
  },
  {
    key: "it",
    label: "تقنية المعلومات",
    hint: "بوابة IT الرئيسية",
    routePath: "/it",
    permissions: ["it.view", "it.manage"],
    accent: "gold",
    group: "it"
  },
  {
    key: "infrastructure",
    label: "البنية التحتية",
    hint: "الخوادم والخدمات والبنية التقنية",
    routePath: "/infrastructure",
    permissions: ["infrastructure.view", "infrastructure.manage", "servers.view", "servers.manage"],
    accent: "navy",
    group: "it"
  },
  {
    key: "deployments",
    label: "النشرات",
    hint: "النشر والإصدارات والتسليم",
    routePath: "/deployments",
    permissions: ["deployments.view", "deployments.manage"],
    accent: "gold",
    group: "it"
  },
  {
    key: "backups",
    label: "النسخ الاحتياطية",
    hint: "النسخ والاستعادة",
    routePath: "/backups",
    permissions: ["backups.view", "backups.manage"],
    accent: "navy",
    group: "it"
  },
  {
    key: "logs-viewer",
    label: "عارض السجلات",
    hint: "السجلات والمراقبة والتحليل",
    routePath: "/logs-viewer",
    permissions: ["logs.view", "monitoring.view"],
    accent: "gold",
    group: "it"
  },
  {
    key: "media",
    label: "الوسائط",
    hint: "الصور والبنرات والملفات وأصول العرض",
    routePath: "/media",
    permissions: ["media.view", "media.manage"],
    accent: "navy",
    group: "it"
  },
  {
    key: "themes",
    label: "الثيمات",
    hint: "الألوان والثيمات والهوية اللونية",
    routePath: "/themes",
    permissions: ["themes.view", "themes.manage"],
    accent: "gold",
    group: "it"
  },
  {
    key: "branding",
    label: "الهوية البصرية",
    hint: "الشعارات والأصول وقواعد العلامة",
    routePath: "/branding",
    permissions: ["branding.view", "branding.manage"],
    accent: "navy",
    group: "it"
  },
  {
    key: "pages-studio",
    label: "استوديو الصفحات",
    hint: "الصفحات وبلوكات المحتوى والتخطيط",
    routePath: "/pages-studio",
    permissions: ["pages.view", "pages.manage"],
    accent: "gold",
    group: "it"
  },
  {
    key: "ui-settings",
    label: "إعدادات الواجهة",
    hint: "RTL والإعدادات البصرية العامة",
    routePath: "/ui-settings",
    permissions: ["ui_settings.manage"],
    accent: "navy",
    group: "it"
  },
  {
    key: "global-settings",
    label: "الإعدادات العامة",
    hint: "الإعدادات المركزية العامة للمجموعة",
    routePath: "/global-settings",
    permissions: ["global_settings.manage", "layout.manage"],
    accent: "gold",
    group: "it"
  }
];

export function getVisibleModules(user?: MobileErpUser | null) {
  if (!isAdminPanelUser(user)) return [];
  if (user?.is_superuser === true) return moduleRegistry;
  return moduleRegistry.filter((item) => hasAnyPermission(user, item.permissions));
}

export function getGroupedVisibleModules(user?: MobileErpUser | null) {
  const visible = getVisibleModules(user);

  return {
    core: visible.filter((item) => item.group === "core"),
    operations: visible.filter((item) => item.group === "operations"),
    catalog: visible.filter((item) => item.group === "catalog"),
    commercial: visible.filter((item) => item.group === "commercial"),
    it: visible.filter((item) => item.group === "it")
  };
}

export function getDefaultModule(user?: MobileErpUser | null) {
  const modules = getVisibleModules(user);
  return modules[0] || null;
}
