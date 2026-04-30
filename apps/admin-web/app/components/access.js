export function normalizeRole(user) {
  const raw = user?.role_code || user?.role || user?.role_name || user?.roleCode || "";
  return String(raw).trim().toLowerCase();
}

export function getUserPermissions(user) {
  if (!Array.isArray(user?.permissions)) return [];
  return user.permissions
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
}

const permissionAliases = {
  "dashboard.view": ["dashboard.view", "dashboard.read"],
  "users.view": ["users.view", "users.read"],
  "users.manage": ["users.manage", "users.create", "users.update"],
  "roles.view": ["roles.view", "roles.read"],
  "roles.manage": ["roles.manage", "roles.create", "roles.update"],
  "factories.view": ["factories.view", "factories.read"],
  "factories.manage": ["factories.manage", "factories.create", "factories.update"],
  "categories.view": ["categories.view", "categories.read"],
  "categories.manage": ["categories.manage", "categories.create", "categories.update"],
  "departments.view": ["departments.view", "departments.read"],
  "departments.manage": ["departments.manage", "departments.create", "departments.update"],
  "employees.view": ["employees.view", "employees.read"],
  "employees.manage": ["employees.manage", "employees.create", "employees.update"],
  "attendance.view": ["attendance.view", "attendance.read"],
  "attendance.manage": ["attendance.manage", "attendance.review", "attendance.create", "attendance.update"],
  "orders.view": ["orders.view", "orders.read"],
  "orders.manage": ["orders.manage", "orders.create", "orders.update", "orders.approve"],
  "sales_invoices.view": ["sales_invoices.view", "sales_invoices.read"],
  "sales_invoices.manage": ["sales_invoices.manage", "sales_invoices.create", "sales_invoices.update"],
  "sales_quotations.view": ["sales_quotations.view", "sales_quotations.read"],
  "sales_quotations.manage": ["sales_quotations.manage", "sales_quotations.create", "sales_quotations.update"],
  "b2b.view": ["b2b.view", "b2b.read"],
  "b2b.manage": ["b2b.manage", "b2b.create", "b2b.update"],
  "warehouses.view": ["warehouses.view", "warehouses.read"],
  "warehouses.manage": ["warehouses.manage", "warehouses.create", "warehouses.update"],
  "inventory.view": ["inventory.view", "inventory.read", "stock.view", "stock.read"],
  "inventory.manage": ["inventory.manage", "inventory.adjust", "stock.manage"],
  "products.view": ["products.view", "products.read", "catalog.view", "catalog.read"],
  "products.manage": ["products.manage", "products.create", "products.update", "catalog.manage"],
  "procurement.view": ["procurement.view", "procurement.read"],
  "procurement.manage": ["procurement.manage", "procurement.create", "procurement.update"],
  "finance.view": ["finance.view", "finance.read"],
  "finance.manage": ["finance.manage", "finance.view", "finance.read"],
  "it.view": ["it.view", "it.read"],
  "it.manage": ["it.manage", "it.update", "it.configure"],
  "hr.view": [
    "hr.view","hr.read","employees.view","employees.read","attendance.view","attendance.read",
    "employee_leaves.view","employee_leaves.read","employee_evaluations.view","employee_evaluations.read",
    "employee_compensations.view","employee_compensations.read","payroll.view","payroll.read",
  ],
  "hr.manage": [
    "hr.manage","employees.manage","attendance.manage","employee_leaves.manage","employee_evaluations.manage",
    "employee_compensations.manage","payroll.manage","payroll.generate","payroll.mark_paid",
  ],
  "crm.view": ["crm.view", "crm.read"],
  "crm.manage": ["crm.manage", "crm.view", "crm.read"],
  "project.view": ["project.view", "project.read"],
  "project.manage": ["project.manage", "project.view", "project.read"],
  "notifications.view": ["notifications.view", "notifications.read"],
  "stock.view": ["stock.view", "stock.read", "picking.view", "picking.read"],
  "stock.manage": ["stock.manage", "stock.adjust", "picking.manage"],
  "pos.view": ["pos.view", "pos.read"],
  "pos.manage": ["pos.manage", "pos.view", "pos.read"],
  "website.view": ["website.view", "website.read"],
  "website.manage": ["website.manage", "website.view", "website.read"],
  "helpdesk.view": ["helpdesk.view", "helpdesk.read"],
  "helpdesk.manage": ["helpdesk.manage", "helpdesk.view", "helpdesk.read"],
};

function expandPermission(code) {
  const normalized = String(code || "").trim().toLowerCase();
  if (!normalized) return [];
  return permissionAliases[normalized] || [normalized];
}

export function hasPermission(user, code) {
  if (!code) return false;
  if (user?.is_superuser === true) return true;
  const permissions = getUserPermissions(user);
  if (!permissions.length) return false;
  return expandPermission(code).some((item) => permissions.includes(item));
}

export function hasAnyPermission(user, codes = []) {
  if (user?.is_superuser === true) return true;
  if (!Array.isArray(codes) || codes.length === 0) return false;
  return codes.some((code) => hasPermission(user, code));
}

export function isBlockedAdminRole(user) {
  const role = normalizeRole(user);
  return ["customer", "store_customer", "customer_user"].includes(role);
}

export function isAdminPanelUser(user) {
  if (!user) return false;
  if (user?.is_active === false) return false;
  if (isBlockedAdminRole(user)) return false;
  if (user?.is_superuser === true) return true;
  return !!normalizeRole(user) && getUserPermissions(user).length > 0;
}

const navTranslations = {
  "لوحة التحكم": { en: "Dashboard" },
  "المبيعات": { en: "Sales" },
  "المشتريات": { en: "Purchase" },
  "المخازن": { en: "Warehouses" },
  "التصنيع": { en: "Manufacturing" },
  "المالية": { en: "Finance" },
  "الموارد البشرية": { en: "Human Resources" },
  "الخدمات": { en: "Services" },
  "التسويق": { en: "Marketing" },
  "الإنتاجية": { en: "Productivity" },
  "الموقع الإلكتروني": { en: "Website" },
  "الشحن والتوصيل": { en: "Logistics" },
  "الإيجار": { en: "Rental" },
  "الاستبيانات": { en: "Surveys" },
  "تقنية المعلومات والحوكمة": { en: "IT Governance" },
  "الإعدادات": { en: "Settings" },
  "عروض الأسعار": { en: "Quotations" },
  "الطلبات": { en: "Orders" },
  "فواتير المبيعات": { en: "Sales Invoices" },
  "نقطة البيع": { en: "Point of Sale" },
  "الاشتراكات": { en: "Subscriptions" },
  "الولاء والخصومات": { en: "Loyalty & Discounts" },
  "التجارة الإلكترونية": { en: "eCommerce" },
  "الموردون": { en: "Suppliers" },
  "أوامر الشراء": { en: "Purchase Orders" },
  "الاستلامات": { en: "Receipts" },
  "فواتير الموردين": { en: "Supplier Invoices" },
  "أعمار الديون": { en: "Aging" },
  "أداء الموردين": { en: "Supplier Performance" },
  "المخزون": { en: "Inventory" },
  "المخزون المتقدم": { en: "Advanced Inventory" },
  "الجرد الدوري": { en: "Cycle Count" },
  "الباركود": { en: "Barcode" },
  "الباركود المتقدم": { en: "Advanced Barcode" },
  "أوامر التشغيل": { en: "Work Orders" },
  "التخطيط": { en: "Planning" },
  "الجودة": { en: "Quality" },
  "الصيانة": { en: "Maintenance" },
  "الأصول": { en: "Assets" },
  "الملخصات المالية": { en: "Financial Summary" },
  "المحاسبة": { en: "Accounting" },
  "تحليل التكاليف": { en: "Cost Analysis" },
  "حسابات الأعمال": { en: "B2B Accounts" },
  "المصاريف": { en: "Expenses" },
  "التوقيع الإلكتروني": { en: "Sign" },
  "الحصص": { en: "Equity" },
  "الموظفون": { en: "Employees" },
  "الحضور": { en: "Attendance" },
  "الإجازات": { en: "Time Off" },
  "التقييمات": { en: "Appraisals" },
  "التعويضات": { en: "Compensations" },
  "الرواتب": { en: "Payroll" },
  "السياسات": { en: "Policies" },
  "تقارير الموارد البشرية": { en: "HR Reports" },
  "التوظيف المتقدم": { en: "Recruitment" },
  "الموارد البشرية المتقدمة": { en: "Advanced HR" },
  "جداول التوقيت": { en: "Timesheets" },
  "CRM": { en: "CRM" },
  "المشاريع": { en: "Projects" },
  "الدعم الفني": { en: "Helpdesk" },
  "الخدمات الميدانية": { en: "Field Service" },
  "المواعيد": { en: "Appointments" },
  "بوابة العملاء": { en: "Customer Portal" },
  "الفعاليات": { en: "Events" },
  "التسويق البريدي": { en: "Email Marketing" },
  "التسويق عبر وسائل التواصل": { en: "Social Marketing" },
  "التسويق الآلي": { en: "Marketing Automation" },
  "التسويق بالرسائل": { en: "SMS Marketing" },
  "الموافقات": { en: "Approvals" },
  "قاعدة المعرفة": { en: "Knowledge" },
  "التقارير المتقدمة": { en: "Advanced Reports" },
  "المنتدى": { en: "Forum" },
  "التعليم الإلكتروني": { en: "eLearning" },
  "إدارة الموقع": { en: "Website Management" },
  "المستندات": { en: "Documents" },
  "إدارة الشحن والتوصيل": { en: "Logistics Management" },
  "أسطول المركبات": { en: "Fleet" },
  "منتجات الإيجار": { en: "Rental Products" },
  "الاستبيانات": { en: "Surveys" },
  "نظرة عامة": { en: "Overview" },
  "مركز الصلاحيات": { en: "Access Center" },
  "مركز العمليات": { en: "Operations Center" },
  "مركز التدقيق": { en: "Audit Center" },
  "الاعتماد المزدوج": { en: "Maker-Checker" },
  "البنية التحتية": { en: "Infrastructure" },
  "النسخ الاحتياطية": { en: "Backups" },
  "الوسائط": { en: "Media" },
  "الثيمات": { en: "Themes" },
  "الهوية": { en: "Branding" },
  "إعدادات الواجهة": { en: "UI Settings" },
  "عمليات النشر": { en: "Deployments" },
  "الإعدادات العامة": { en: "Global Settings" },
  "السجلات": { en: "Logs" },
  "استوديو الصفحات": { en: "Pages Studio" },
  "المستخدمون": { en: "Users" },
  "الأدوار": { en: "Roles" },
  "المصانع": { en: "Factories" },
  "الأقسام": { en: "Departments" },
  "المنتجات": { en: "Products" },
  "فئات المنتجات": { en: "Product Categories" },
  "الإشعارات": { en: "Notifications" },
};

const navTree = [
  { type: "item", label: "لوحة التحكم", href: "/dashboard", permissions: ["dashboard.view"] },
  {
    type: "group", key: "sales", label: "المبيعات", icon: "💰",
    permissions: ["sales_quotations.view", "sales_quotations.manage", "orders.view", "orders.manage", "sales_invoices.view", "sales_invoices.manage", "pos.view", "pos.manage", "subscription.view", "subscription.manage", "loyalty.view", "loyalty.manage", "website.view", "website.manage"],
    children: [
      { type: "item", label: "عروض الأسعار", href: "/quotations", permissions: ["sales_quotations.view", "sales_quotations.manage"] },
      { type: "item", label: "الطلبات", href: "/orders", permissions: ["orders.view", "orders.manage"] },
      { type: "item", label: "فواتير المبيعات", href: "/sales-invoices", permissions: ["sales_invoices.view", "sales_invoices.manage"] },
      { type: "item", label: "نقطة البيع", href: "/pos", permissions: ["pos.view", "pos.manage"] },
      { type: "item", label: "الاشتراكات", href: "/subscriptions", permissions: ["subscription.view", "subscription.manage"] },
      { type: "item", label: "الولاء والخصومات", href: "/loyalty", permissions: ["loyalty.view", "loyalty.manage"] },
      { type: "item", label: "التجارة الإلكترونية", href: "/ecommerce", permissions: ["website.view", "website.manage"] },
    ],
  },
  {
    type: "group", key: "procurement", label: "المشتريات", icon: "📦",
    permissions: ["procurement.view", "procurement.manage"],
    children: [
      { type: "item", label: "الموردون", href: "/procurement/suppliers", permissions: ["procurement.view", "procurement.manage"] },
      { type: "item", label: "أوامر الشراء", href: "/procurement/purchase-orders", permissions: ["procurement.view", "procurement.manage"] },
      { type: "item", label: "الاستلامات", href: "/procurement/receipts", permissions: ["procurement.view", "procurement.manage"] },
      { type: "item", label: "فواتير الموردين", href: "/procurement/invoices", permissions: ["procurement.view", "procurement.manage"] },
      { type: "item", label: "أعمار الديون", href: "/procurement/aging", permissions: ["procurement.view", "procurement.manage"] },
      { type: "item", label: "أداء الموردين", href: "/procurement/performance", permissions: ["procurement.view", "procurement.manage"] },
      { type: "item", label: "معلومات الموردين للمنتجات", href: "/procurement/supplier-products", permissions: ["supplier_info.view", "supplier_info.manage"] },
    ],
  },
  {
    type: "group", key: "warehouses", label: "المخازن", icon: "🏬",
    permissions: ["inventory.view", "inventory.manage", "warehouses.view", "warehouses.manage", "stock.view", "stock.manage", "picking.view", "picking.manage", "barcode.view", "barcode.manage", "advanced_barcode.view", "advanced_barcode.manage"],
    children: [
      { type: "item", label: "المخازن", href: "/warehouses", permissions: ["warehouses.view", "warehouses.manage"] },
      { type: "item", label: "المخزون", href: "/inventory", permissions: ["inventory.view", "inventory.manage", "stock.view", "stock.manage"] },
      { type: "item", label: "المخزون المتقدم", href: "/advanced-inventory", permissions: ["stock.view", "stock.manage", "picking.view", "picking.manage"] },
      { type: "item", label: "الجرد الدوري", href: "/inventory-adjustments", permissions: ["stock.view", "stock.manage"] },
      { type: "item", label: "الباركود", href: "/barcode", permissions: ["barcode.view", "barcode.manage"] },
      { type: "item", label: "الباركود المتقدم", href: "/advanced-barcode", permissions: ["advanced_barcode.view", "advanced_barcode.manage"] },
      { type: "item", label: "التشغيلات والأرقام التسلسلية", href: "/inventory/lots", permissions: ["lot.view", "lot.manage"] },
      { type: "item", label: "هالك المخزون", href: "/inventory/scraps", permissions: ["scrap.view", "scrap.manage"] },
    ],
  },
  {
    type: "group", key: "manufacturing", label: "التصنيع", icon: "🏭",
    permissions: ["work_orders.view", "work_orders.manage", "planning.view", "planning.manage", "quality.view", "quality.manage", "maintenance.view", "maintenance.manage", "assets.view", "assets.manage"],
    children: [
      { type: "item", label: "أوامر التشغيل", href: "/work-orders", permissions: ["work_orders.view", "work_orders.manage"] },
      { type: "item", label: "التخطيط", href: "/planning", permissions: ["planning.view", "planning.manage"] },
      { type: "item", label: "الجودة", href: "/quality", permissions: ["quality.view", "quality.manage"] },
      { type: "item", label: "الصيانة", href: "/maintenance", permissions: ["maintenance.view", "maintenance.manage"] },
      { type: "item", label: "الأصول", href: "/assets", permissions: ["assets.view", "assets.manage"] },
      { type: "item", label: "محطات العمل", href: "/manufacturing/work-centers", permissions: ["workcenter.view", "workcenter.manage"] },
    ],
  },
  {
    type: "group", key: "finance_group", label: "المالية", icon: "💵",
    permissions: ["finance.view", "finance.manage", "accounting.view", "accounting.manage", "costing.view", "b2b.view", "b2b.manage", "expenses.view", "expenses.manage", "sign.view", "sign.manage", "equity.view", "equity.manage"],
    children: [
      { type: "item", label: "الملخصات المالية", href: "/finance", permissions: ["finance.view", "finance.manage"] },
      { type: "item", label: "المحاسبة", href: "/accounting", permissions: ["accounting.view", "accounting.manage"] },
      { type: "item", label: "تحليل التكاليف", href: "/finance/costing", permissions: ["costing.view", "costing.read", "finance.view", "finance.manage"] },
      { type: "item", label: "حسابات الأعمال", href: "/b2b", permissions: ["b2b.view", "b2b.manage"] },
      { type: "item", label: "المصاريف", href: "/expenses", permissions: ["expenses.view", "expenses.manage"] },
      { type: "item", label: "التوقيع الإلكتروني", href: "/sign", permissions: ["sign.view", "sign.manage"] },
      { type: "item", label: "الحصص", href: "/equity", permissions: ["equity.view", "equity.manage"] },
      { type: "item", label: "الضرائب", href: "/accounting/taxes", permissions: ["tax.view", "tax.manage"] },
      { type: "item", label: "شروط الدفع", href: "/accounting/payment-terms", permissions: ["payment_terms.view", "payment_terms.manage"] },
    ],
  },
  {
    type: "group", key: "hr", label: "الموارد البشرية", icon: "👥",
    permissions: ["hr.view", "hr.manage", "employees.view", "employees.manage", "attendance.view", "attendance.manage", "advanced_recruitment.view", "advanced_recruitment.manage", "hr_advanced.view", "hr_advanced.manage", "timesheets.view", "timesheets.manage"],
    children: [
      { type: "item", label: "الموظفون", href: "/employees", permissions: ["employees.view", "employees.manage"] },
      { type: "item", label: "الحضور", href: "/attendance", permissions: ["attendance.view", "attendance.manage"] },
      { type: "item", label: "الإجازات", href: "/hr/leaves", permissions: ["hr.view", "hr.manage"] },
      { type: "item", label: "التقييمات", href: "/hr/evaluations", permissions: ["hr.view", "hr.manage"] },
      { type: "item", label: "التعويضات", href: "/hr/compensations", permissions: ["hr.view", "hr.manage"] },
      { type: "item", label: "الرواتب", href: "/hr/payroll", permissions: ["hr.view", "hr.manage"] },
      { type: "item", label: "السياسات", href: "/hr/policies", permissions: ["hr.view", "hr.manage"] },
      { type: "item", label: "تقارير الموارد البشرية", href: "/hr/reports", permissions: ["hr.view", "hr.manage"] },
      { type: "item", label: "التوظيف المتقدم", href: "/advanced-recruitment", permissions: ["advanced_recruitment.view", "advanced_recruitment.manage"] },
      { type: "item", label: "الموارد البشرية المتقدمة", href: "/hr-advanced", permissions: ["hr_advanced.view", "hr_advanced.manage"] },
      { type: "item", label: "جداول التوقيت", href: "/timesheets", permissions: ["timesheets.view", "timesheets.manage"] },
    ],
  },
  {
    type: "group", key: "services", label: "الخدمات", icon: "🤝",
    permissions: ["crm.view", "crm.manage", "project.view", "project.manage", "helpdesk.view", "helpdesk.manage", "field_service.view", "field_service.manage", "appointment.view", "appointment.manage", "portal.view", "portal.manage", "events.view", "events.manage"],
    children: [
      { type: "item", label: "CRM", href: "/crm", permissions: ["crm.view", "crm.manage"] },
      { type: "item", label: "المشاريع", href: "/project", permissions: ["project.view", "project.manage"] },
      { type: "item", label: "الدعم الفني", href: "/helpdesk", permissions: ["helpdesk.view", "helpdesk.manage"] },
      { type: "item", label: "الخدمات الميدانية", href: "/field-service", permissions: ["field_service.view", "field_service.manage"] },
      { type: "item", label: "المواعيد", href: "/appointments", permissions: ["appointment.view", "appointment.manage"] },
      { type: "item", label: "بوابة العملاء", href: "/portal", permissions: ["portal.view", "portal.manage"] },
      { type: "item", label: "الفعاليات", href: "/events", permissions: ["events.view", "events.manage"] },
    ],
  },
  {
    type: "group", key: "marketing", label: "التسويق", icon: "📣",
    permissions: ["email_marketing.view", "email_marketing.manage", "social_media.view", "social_media.manage", "marketing_automation.view", "marketing_automation.manage", "sms_marketing.view", "sms_marketing.manage"],
    children: [
      { type: "item", label: "التسويق البريدي", href: "/email-marketing", permissions: ["email_marketing.view", "email_marketing.manage"] },
      { type: "item", label: "التسويق عبر وسائل التواصل", href: "/social-media-marketing", permissions: ["social_media.view", "social_media.manage"] },
      { type: "item", label: "التسويق الآلي", href: "/marketing-automation", permissions: ["marketing_automation.view", "marketing_automation.manage"] },
      { type: "item", label: "التسويق بالرسائل", href: "/sms_marketing", permissions: ["sms_marketing.view", "sms_marketing.manage"] },
    ],
  },
  {
    type: "group", key: "productivity", label: "الإنتاجية", icon: "📚",
    permissions: ["it.view", "it.manage", "knowledge.view", "knowledge.manage", "reports.view", "reports.manage", "forum.view", "forum.manage", "elearning.view", "elearning.manage"],
    children: [
      { type: "item", label: "الموافقات", href: "/approvals", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "قاعدة المعرفة", href: "/knowledge", permissions: ["knowledge.view", "knowledge.manage"] },
      { type: "item", label: "التقارير المتقدمة", href: "/reports", permissions: ["reports.view", "reports.manage"] },
      { type: "item", label: "المنتدى", href: "/forum", permissions: ["forum.view", "forum.manage"] },
      { type: "item", label: "التعليم الإلكتروني", href: "/elearning", permissions: ["elearning.view", "elearning.manage"] },
    ],
  },
  {
    type: "group", key: "website_group", label: "الموقع الإلكتروني", icon: "🌐",
    permissions: ["website.view", "website.manage", "documents.view", "documents.manage"],
    children: [
      { type: "item", label: "إدارة الموقع", href: "/website", permissions: ["website.view", "website.manage"] },
      { type: "item", label: "المستندات", href: "/documents", permissions: ["documents.view", "documents.manage"] },
    ],
  },
  {
    type: "group", key: "logistics", label: "الشحن والتوصيل", icon: "🚚",
    permissions: ["delivery.view", "delivery.manage", "fleet.view", "fleet.manage"],
    children: [
      { type: "item", label: "إدارة الشحن والتوصيل", href: "/delivery", permissions: ["delivery.view", "delivery.manage"] },
      { type: "item", label: "أسطول المركبات", href: "/fleet", permissions: ["fleet.view", "fleet.manage"] },
    ],
  },
  {
    type: "group", key: "rental", label: "الإيجار", icon: "🏪",
    permissions: ["rental.view", "rental.manage"],
    children: [
      { type: "item", label: "منتجات الإيجار", href: "/rental", permissions: ["rental.view", "rental.manage"] },
    ],
  },
  {
    type: "group", key: "survey", label: "الاستبيانات", icon: "📊",
    permissions: ["survey.view", "survey.manage"],
    children: [
      { type: "item", label: "الاستبيانات", href: "/survey", permissions: ["survey.view", "survey.manage"] },
    ],
  },
  {
    type: "group", key: "it", label: "تقنية المعلومات والحوكمة", icon: "🖥️",
    permissions: ["it.view", "it.manage"],
    children: [
      { type: "item", label: "نظرة عامة", href: "/it", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "مركز الصلاحيات", href: "/it/access-center", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "مركز العمليات", href: "/it/operations-center", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "مركز التدقيق", href: "/it/audit-center", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "الاعتماد المزدوج", href: "/it/maker-checker-center", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "البنية التحتية", href: "/infrastructure", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "النسخ الاحتياطية", href: "/backups", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "الوسائط", href: "/media", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "الثيمات", href: "/themes", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "الهوية", href: "/branding", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "إعدادات الواجهة", href: "/ui-settings", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "عمليات النشر", href: "/deployments", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "الإعدادات العامة", href: "/global-settings", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "السجلات", href: "/logs-viewer", permissions: ["it.view", "it.manage"] },
      { type: "item", label: "استوديو الصفحات", href: "/pages-studio", permissions: ["it.view", "it.manage"] },
    ],
  },
  {
    type: "group", key: "settings", label: "الإعدادات", icon: "⚙️",
    permissions: ["users.view", "users.manage", "roles.view", "roles.manage", "factories.view", "factories.manage", "departments.view", "departments.manage", "products.view", "products.manage", "categories.view", "categories.manage", "notifications.view", "notifications.manage"],
    children: [
      { type: "item", label: "المستخدمون", href: "/users", permissions: ["users.view", "users.manage"] },
      { type: "item", label: "الأدوار", href: "/roles", permissions: ["roles.view", "roles.manage"] },
      { type: "item", label: "المصانع", href: "/factories", permissions: ["factories.view", "factories.manage"] },
      { type: "item", label: "الأقسام", href: "/departments", permissions: ["departments.view", "departments.manage"] },
      { type: "item", label: "المنتجات", href: "/products", permissions: ["products.view", "products.manage", "catalog.view", "catalog.manage"] },
      { type: "item", label: "فئات المنتجات", href: "/categories", permissions: ["categories.view", "categories.manage"] },
      { type: "item", label: "الإشعارات", href: "/notifications", permissions: ["notifications.view", "notifications.manage"] },
    ],
  },
];

const routeAccessConfig = [
  { matchers: ["/dashboard"], permissions: ["dashboard.view"] },
  { matchers: ["/quotations", "/orders", "/sales-invoices", "/pos", "/subscriptions", "/loyalty", "/ecommerce"], permissions: ["sales_quotations.view", "sales_quotations.manage", "orders.view", "orders.manage", "sales_invoices.view", "sales_invoices.manage", "pos.view", "pos.manage", "subscription.view", "subscription.manage", "loyalty.view", "loyalty.manage", "website.view", "website.manage"] },
  { matchers: ["/procurement/suppliers", "/procurement/purchase-orders", "/procurement/receipts", "/procurement/invoices", "/procurement/aging", "/procurement/performance"], permissions: ["procurement.view", "procurement.manage"] },
  { matchers: ["/warehouses", "/inventory", "/advanced-inventory", "/inventory-adjustments", "/barcode", "/advanced-barcode"], permissions: ["inventory.view", "inventory.manage", "warehouses.view", "warehouses.manage", "stock.view", "stock.manage", "picking.view", "picking.manage", "barcode.view", "barcode.manage", "advanced_barcode.view", "advanced_barcode.manage"] },
  { matchers: ["/work-orders", "/planning", "/quality", "/maintenance", "/assets"], permissions: ["work_orders.view", "work_orders.manage", "planning.view", "planning.manage", "quality.view", "quality.manage", "maintenance.view", "maintenance.manage", "assets.view", "assets.manage"] },
  { matchers: ["/finance", "/accounting", "/finance/costing", "/b2b", "/expenses", "/sign", "/equity"], permissions: ["finance.view", "finance.manage", "accounting.view", "accounting.manage", "costing.view", "b2b.view", "b2b.manage", "expenses.view", "expenses.manage", "sign.view", "sign.manage", "equity.view", "equity.manage"] },
  { matchers: ["/employees", "/attendance", "/hr/leaves", "/hr/evaluations", "/hr/compensations", "/hr/payroll", "/hr/policies", "/hr/reports", "/advanced-recruitment", "/hr-advanced", "/timesheets"], permissions: ["hr.view", "hr.manage", "employees.view", "employees.manage", "attendance.view", "attendance.manage", "advanced_recruitment.view", "advanced_recruitment.manage", "hr_advanced.view", "hr_advanced.manage", "timesheets.view", "timesheets.manage"] },
  { matchers: ["/crm", "/project", "/helpdesk", "/field-service", "/appointments", "/portal", "/events"], permissions: ["crm.view", "crm.manage", "project.view", "project.manage", "helpdesk.view", "helpdesk.manage", "field_service.view", "field_service.manage", "appointment.view", "appointment.manage", "portal.view", "portal.manage", "events.view", "events.manage"] },
  { matchers: ["/email-marketing", "/social-media-marketing", "/marketing-automation", "/sms_marketing"], permissions: ["email_marketing.view", "email_marketing.manage", "social_media.view", "social_media.manage", "marketing_automation.view", "marketing_automation.manage", "sms_marketing.view", "sms_marketing.manage"] },
  { matchers: ["/approvals", "/knowledge", "/reports", "/forum", "/elearning"], permissions: ["it.view", "it.manage", "knowledge.view", "knowledge.manage", "reports.view", "reports.manage", "forum.view", "forum.manage", "elearning.view", "elearning.manage"] },
  { matchers: ["/website", "/documents"], permissions: ["website.view", "website.manage", "documents.view", "documents.manage"] },
  { matchers: ["/delivery", "/fleet"], permissions: ["delivery.view", "delivery.manage", "fleet.view", "fleet.manage"] },
  { matchers: ["/rental"], permissions: ["rental.view", "rental.manage"] },
  { matchers: ["/survey"], permissions: ["survey.view", "survey.manage"] },
  { matchers: ["/it", "/it/access-center", "/it/operations-center", "/it/audit-center", "/it/maker-checker-center", "/infrastructure", "/backups", "/media", "/themes", "/branding", "/ui-settings", "/deployments", "/global-settings", "/logs-viewer", "/pages-studio"], permissions: ["it.view", "it.manage"] },
  { matchers: ["/inventory/lots"], permissions: ["lot.view", "lot.manage"] },
  { matchers: ["/accounting/taxes"], permissions: ["tax.view", "tax.manage"] },
  { matchers: ["/manufacturing/work-centers"], permissions: ["workcenter.view", "workcenter.manage"] },
  { matchers: ["/inventory/scraps"], permissions: ["scrap.view", "scrap.manage"] },
  { matchers: ["/accounting/payment-terms"], permissions: ["payment_terms.view", "payment_terms.manage"] },
  { matchers: ["/procurement/supplier-products"], permissions: ["supplier_info.view", "supplier_info.manage"] },
  { matchers: ["/users", "/roles", "/factories", "/departments", "/products", "/categories", "/notifications"], permissions: ["users.view", "users.manage", "roles.view", "roles.manage", "factories.view", "factories.manage", "departments.view", "departments.manage", "products.view", "products.manage", "categories.view", "categories.manage", "notifications.view", "notifications.manage"] },
];

function matchesPath(pathname, matcher) {
  return !!pathname && !!matcher && (pathname === matcher || pathname.startsWith(`${matcher}/`));
}

function isNodeVisible(user, node) {
  if (!node) return false;
  if (user?.is_superuser === true) return true;
  return hasAnyPermission(user, node.permissions || []);
}

function buildVisibleTree(user, nodes = [], lang = "ar") {
  if (!isAdminPanelUser(user)) return [];
  return nodes
    .map((node) => {
      if (node.type === "item") {
        if (!isNodeVisible(user, node)) return null;
        return { ...node, label: translateLabel(node.label, lang) };
      }
      if (node.type === "group") {
        const visibleChildren = buildVisibleTree(user, node.children || [], lang);
        if (!visibleChildren.length || !isNodeVisible(user, node)) return null;
        return { ...node, label: translateLabel(node.label, lang), children: visibleChildren };
      }
      return null;
    })
    .filter(Boolean);
}

function translateLabel(arLabel, lang) {
  if (lang === "en" && navTranslations[arLabel]) {
    return navTranslations[arLabel].en;
  }
  return arLabel;
}

function flattenVisibleNav(nodes, level = 0) {
  const output = [];
  for (const node of nodes) {
    if (node.type === "item") {
      output.push({ type: "item", label: node.label, href: node.href, isChild: level > 0, level });
      continue;
    }
    if (node.type === "group") {
      output.push({ type: "group", key: node.key, label: node.label, href: null, isChild: false, level, icon: node.icon });
      output.push(...flattenVisibleNav(node.children || [], level + 1));
    }
  }
  return output;
}

export function getVisibleNavTree(user, lang = "ar") {
  return buildVisibleTree(user, navTree, lang);
}

export function getVisibleNavItems(user, lang = "ar") {
  if (!isAdminPanelUser(user)) return [];
  return flattenVisibleNav(getVisibleNavTree(user, lang), 0);
}

export function getDefaultAuthorizedPath(user) {
  const items = getVisibleNavItems(user).filter((item) => item.type === "item" && item.href);
  return items.length ? items[0].href : "/login";
}

export function canAccessPath(user, pathname) {
  if (!isAdminPanelUser(user)) return false;
  if (pathname === "/" || pathname === "/login") return true;
  const matchedEntry = routeAccessConfig.find((entry) => entry.matchers.some((matcher) => matchesPath(pathname, matcher)));
  if (!matchedEntry) return false;
  if (user?.is_superuser === true) return true;
  return hasAnyPermission(user, matchedEntry.permissions);
}
