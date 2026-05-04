"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { getVisibleNavTree, normalizeRole } from "./access";
import { useI18n } from "./I18nProvider";

const navHintsAr = {
  "/documents":"إدارة المستندات والملفات",
  "/events":"إدارة الفعاليات والمناسبات",
  "/fleet":"أسطول المركبات",
  "/sms_marketing":"حملات التسويق بالرسائل",
  "/forum":"المنتدى وتبادل النقاش",
  "/elearning":"منصة التعليم الإلكتروني",
  "/rental":"إدارة عمليات الإيجار",
  "/timesheets":"جداول توقيت الموظفين",
  "/equity":"إدارة الحصص المالية",
  "/survey":"الاستبيانات ونماذج الرأي",
  "/dashboard":"نظرة تنفيذية موحدة على أداء النظام",
  "/users":"إدارة المستخدمين والصلاحيات التشغيلية",
  "/roles":"تعريف الأدوار وبنية الوصول",
  "/factories":"إدارة المصانع وربط النطاق التشغيلي",
  "/categories":"تصنيف المنتجات والهيكل التجاري",
  "/departments":"تنظيم الأقسام والهيكل الإداري",
  "/employees":"إدارة بيانات الموظفين",
  "/attendance":"متابعة الحضور والانضباط اليومي",
  "/hr/leaves":"إدارة الإجازات والطلبات",
  "/hr/evaluations":"التقييمات الدورية والأداء",
  "/hr/compensations":"البدلات والاستحقاقات",
  "/hr/payroll":"تشغيل الرواتب والفترات",
  "/hr/policies":"السياسات وقواعد الموارد البشرية",
  "/hr/reports":"تقارير الموارد البشرية",
  "/products":"المنتجات والتسعير والجاهزية",
  "/quotations":"إنشاء ومتابعة عروض الأسعار",
  "/orders":"متابعة دورة الطلبات التشغيلية",
  "/sales-invoices":"فواتير المبيعات وربط المالية",
  "/work-orders":"تشغيل ومتابعة أوامر العمل",
  "/procurement/suppliers":"إدارة الموردين",
  "/procurement/purchase-orders":"أوامر الشراء",
  "/procurement/receipts":"الاستلامات والحركات",
  "/procurement/invoices":"فواتير الموردين",
  "/procurement/aging":"أعمار الديون والمستحقات",
  "/procurement/performance":"مؤشرات أداء الموردين",
  "/procurement/rfqs":"طلبات عروض الأسعار",
  "/finance":"المؤشرات والملخصات المالية",
  "/finance/costing":"تحليل التكاليف والربحية",
  "/accounting":"دليل الحسابات والقيود والميزان",
  "/b2b":"حسابات العملاء التجاريين",
  "/warehouses":"إدارة المخازن",
  "/inventory":"حالة المخزون والتحركات",
  "/it":"تشغيل وإدارة التقنية",
  "/it/access-center":"مركز الصلاحيات والوصول",
  "/it/operations-center":"متابعة العمليات التقنية",
  "/it/audit-center":"الضوابط المؤسسية وسطح الحوكمة",
  "/it/maker-checker-center":"حوكمة الاعتماد والمراجعة المزدوجة",
  "/infrastructure":"البنية التحتية والخدمات",
  "/backups":"النسخ الاحتياطية",
  "/media":"إدارة الوسائط",
  "/themes":"الثيمات والمظهر",
  "/branding":"الهوية المؤسسية",
  "/ui-settings":"إعدادات الواجهة",
  "/deployments":"عمليات النشر",
  "/global-settings":"الإعدادات العامة",
  "/logs-viewer":"السجلات والمتابعة",
  "/pages-studio":"إدارة صفحات النظام",
  "/inventory/lots":"التشغيلات والأرقام التسلسلية",
  "/accounting/taxes":"إدارة الضرائب",
  "/manufacturing/work-centers":"محطات العمل والتكاليف",
  "/inventory/scraps":"تسجيل هالك المخزون",
  "/accounting/payment-terms":"شروط وأجال الدفع",
  "/procurement/supplier-products":"معلومات الموردين للمنتجات",
};

const navHintsEn = {
  "/dashboard":"Unified executive system overview",
  "/users":"User and operational permissions management",
  "/roles":"Role definition and access structure",
  "/factories":"Factory management and operational scope",
  "/categories":"Product classification and commercial structure",
  "/departments":"Department organization and admin structure",
  "/employees":"Employee data management",
  "/attendance":"Daily attendance and discipline tracking",
  "/hr/leaves":"Leave and request management",
  "/hr/evaluations":"Periodic reviews and performance",
  "/hr/compensations":"Allowances and entitlements",
  "/hr/payroll":"Payroll runs and periods",
  "/hr/policies":"HR policies and rules",
  "/hr/reports":"HR reports",
  "/products":"Products, pricing and readiness",
  "/quotations":"Quotation creation and tracking",
  "/orders":"Operational order cycle tracking",
  "/sales-invoices":"Sales invoices and financial linking",
  "/work-orders":"Work order execution and tracking",
  "/procurement/suppliers":"Supplier management",
  "/procurement/purchase-orders":"Purchase orders",
  "/procurement/receipts":"Receipts and movements",
  "/procurement/invoices":"Supplier invoices",
  "/procurement/aging":"Debt aging and payables",
  "/procurement/performance":"Supplier performance indicators",
  "/procurement/rfqs":"Requests for Quotations (RFQs)",
  "/finance":"Financial indicators and summaries",
  "/finance/costing":"Cost and profitability analysis",
  "/accounting":"Chart of accounts, entries and balance",
  "/b2b":"Business customer accounts",
  "/warehouses":"Warehouse management",
  "/inventory":"Inventory status and movements",
  "/it":"IT operations and management",
  "/it/access-center":"Permissions and access center",
  "/it/operations-center":"IT operations monitoring",
  "/it/audit-center":"Institutional controls and governance",
  "/it/maker-checker-center":"Dual approval governance",
  "/infrastructure":"Infrastructure and services",
  "/backups":"Backup governance",
  "/media":"Media management",
  "/themes":"Themes and appearance",
  "/branding":"Institutional identity",
  "/ui-settings":"UI settings",
  "/deployments":"Deployment operations",
  "/global-settings":"General settings",
  "/logs-viewer":"Logs and monitoring",
  "/pages-studio":"System page management",
  "/documents":"Document and file management",
  "/events":"Event and occasion management",
  "/fleet":"Fleet vehicle management",
  "/sms_marketing":"SMS campaign management",
  "/forum":"Discussion forum",
  "/elearning":"eLearning platform",
  "/rental":"Rental operations management",
  "/timesheets":"Employee timesheets",
  "/equity":"Equity share management",
  "/survey":"Survey and questionnaires",
};

const GROUP_STORAGE_KEY = "rp_admin_sidebar_open_groups_v3";

function resolveRoleLabel(user, locale){
  if(!user) return "-";
  if(user?.is_superuser===true) return locale==="ar" ? "مدير عام" : "Super Admin";
  return String(user?.role_name || user?.role || user?.role_code || normalizeRole(user) || "-");
}

function resolveFactoryLabel(user, locale){
  if(!user) return "-";
  if(user?.is_superuser===true || user?.scope==="group") return locale==="ar" ? "نطاق المجموعة" : "Group Scope";
  return user?.factory_name || user?.factory?.name || (user?.factory_id ? (locale==="ar" ? `مصنع #${user.factory_id}` : `Factory #${user.factory_id}`) : "—");
}

function isPathActive(pathname, href){
  if(!href || !pathname) return false;
  return pathname===href || (href !== "/" && pathname.startsWith(`${href}/`));
}

function nodeHasActivePath(node, pathname){
  if(!node) return false;
  if(node.type==="item") return isPathActive(pathname,node.href);
  return (node.children || []).some((child)=>nodeHasActivePath(child,pathname));
}

function collectDefaultOpenGroups(nodes, pathname, acc = {}){
  for(const node of nodes || []){
    if(node.type==="group"){
      if(nodeHasActivePath(node,pathname)) acc[node.key]=true;
      collectDefaultOpenGroups(node.children || [], pathname, acc);
    }
  }
  return acc;
}

function resolveCurrentLabel(nodes, pathname, locale){
  for(const node of nodes || []){
    if(node.type==="item" && isPathActive(pathname,node.href)) return node.label;
    if(node.type==="group"){
      const nested=resolveCurrentLabel(node.children || [], pathname, locale);
      if(nested) return nested;
    }
  }
  return locale==="ar" ? "مساحة العمل" : "Workspace";
}

export default function Sidebar({ user = null }) {
  const pathname=usePathname();
  const router=useRouter();
  const [mobileOpen,setMobileOpen]=useState(false);
  const [isMobile,setIsMobile]=useState(false);
  const [openGroups,setOpenGroups]=useState({});
  const { locale, setLocale } = useI18n();

  const navTree=useMemo(()=>user ? getVisibleNavTree(user, locale) : [], [user, locale]);
  const currentLabel=useMemo(()=>resolveCurrentLabel(navTree,pathname,locale),[navTree,pathname,locale]);

  const hints = locale === "ar" ? navHintsAr : navHintsEn;

  useEffect(()=>{
    const handleResize=()=>setIsMobile(window.innerWidth <= 991);
    handleResize();
    window.addEventListener("resize",handleResize);
    return ()=>window.removeEventListener("resize",handleResize);
  },[]);

  useEffect(()=>{ setMobileOpen(false); },[pathname]);
  useEffect(()=>{
    if(typeof document==="undefined") return;
    document.body.classList.toggle("erp-mobile-open",mobileOpen);
    return ()=>document.body.classList.remove("erp-mobile-open");
  },[mobileOpen]);

  useEffect(()=>{
    if(typeof window==="undefined") return;
    let stored={};
    try{ stored=JSON.parse(localStorage.getItem(GROUP_STORAGE_KEY) || "{}"); }catch{ stored={}; }
    setOpenGroups({ ...stored, ...collectDefaultOpenGroups(navTree, pathname, {}) });
  },[navTree,pathname]);

  function toggleGroup(groupKey){
    const nextState={ ...openGroups, [groupKey]: !openGroups[groupKey] };
    setOpenGroups(nextState);
    try{ localStorage.setItem(GROUP_STORAGE_KEY, JSON.stringify(nextState)); }catch{}
  }

  function logout(){
    localStorage.removeItem("access_token");
    localStorage.removeItem("refresh_token");
    router.push("/login");
  }

  function GroupHeader({ label, isOpen, onToggle, icon }) {
    return (
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') onToggle(); }}
        className={`erp-nav-item erp-nav-group-header ${isOpen ? "group-open" : ""}`}
        aria-expanded={isOpen}
        style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%", textAlign: "right", padding: "10px 14px", cursor: "pointer", background: "transparent", border: "none" }}
      >
        {icon && (
          <span style={{ fontSize: "18px", lineHeight: 1, flexShrink: 0 }}>
            {icon}
          </span>
        )}
        <div style={{ flex: 1, minWidth: 0, textAlign: "right" }}>
          <div className="erp-nav-item-label" style={{ fontWeight: 800, fontSize: "14px", color: "#ffffff" }}>{label}</div>
          <div className="erp-nav-item-hint" style={{ fontSize: "11px", color: "var(--rp-text-muted)", marginTop: "2px" }}>
            {isOpen ? (locale === "ar" ? "إخفاء العناصر" : "Hide items") : (locale === "ar" ? "إظهار العناصر" : "Show items")}
          </div>
        </div>
        <span className={`erp-chevron ${isOpen ? "open" : ""}`} aria-hidden="true" style={{ flexShrink: 0 }}>
          ›
        </span>
      </div>
    );
  }

  function ItemLink({item,pathname,level=0}){
    const active=isPathActive(pathname,item.href);
    return (
      <Link href={item.href} className={`erp-nav-item ${active ? "active" : ""} ${level > 0 ? "erp-nav-child" : ""}`} style={{marginInlineStart:level > 0 ? 12 : 0}}>
        <div className="erp-nav-item-text" style={{textAlign:"right",width:"100%"}}>
          <span className="erp-nav-item-label">{item.label}</span>
          <span className="erp-nav-item-hint">{hints[item.href] || (locale==="ar" ? "قسم تشغيلي" : "Operational Section")}</span>
        </div>
      </Link>
    );
  }

  function NavTree({nodes,pathname,openGroups,onToggleGroup,level=0}){
    return (
      <>
        {(nodes || []).map((node,index)=>{
          if(node.type==="group"){
            const isOpen=!!openGroups[node.key];
            return (
              <div key={`${node.key}-${index}`} className="erp-nav-group">
                <GroupHeader
                  label={node.label}
                  isOpen={isOpen}
                  onToggle={()=>onToggleGroup(node.key)}
                  icon={node.icon}
                />
                {isOpen ? (
                  <div className="erp-nav-group-children">
                    <NavTree nodes={node.children || []} pathname={pathname} openGroups={openGroups} onToggleGroup={onToggleGroup} level={level+1}/>
                  </div>
                ) : null}
              </div>
            );
          }
          return <ItemLink key={`${node.href}-${index}`} item={node} pathname={pathname} level={level}/>;
        })}
      </>
    );
  }

  const navContent = (
    <>
      <div className="erp-brand" dir="rtl">
        <div className="erp-brand-mark">RP</div>
        <div className="erp-brand-text">
          <h2 style={{margin:0,fontSize:18,lineHeight:1.2,fontWeight:900}}>Royal Palace ERP</h2>
          <p style={{margin:"5px 0 0",fontSize:12,color:"rgba(255,255,255,0.72)"}}>{locale==="ar" ? "مساحة التحكم المؤسسي" : "Enterprise Control Workspace"}</p>
        </div>
      </div>
      <div className="erp-sidebar-current">
        <div className="erp-sidebar-current-label">{locale==="ar" ? "الصفحة الحالية" : "Current Page"}</div>
        <div className="erp-sidebar-current-value">{currentLabel}</div>
      </div>
      <div className="erp-sidebar-profile" dir="rtl">
        <div className="erp-sidebar-profile-item">
          <span className="erp-sidebar-profile-key">{locale==="ar" ? "الدور" : "Role"}</span>
          <strong>{resolveRoleLabel(user, locale)}</strong>
        </div>
        <div className="erp-sidebar-profile-item">
          <span className="erp-sidebar-profile-key">{locale==="ar" ? "النطاق" : "Scope"}</span>
          <strong>{resolveFactoryLabel(user, locale)}</strong>
        </div>
      </div>
      <button
        type="button"
        className="erp-lang-toggle"
        onClick={() => setLocale(locale === "ar" ? "en" : "ar")}
        style={{
          marginBottom: "12px",
          width: "100%",
          minHeight: "38px",
          borderRadius: "12px",
          background: "rgba(255,255,255,0.08)",
          border: "1px solid rgba(255,255,255,0.12)",
          color: "#fff",
          fontWeight: 800,
          cursor: "pointer",
          fontSize: "13px",
          padding: "8px 12px",
        }}
      >
        {locale === "ar" ? "EN English" : "AR العربية"}
      </button>
      <div className="erp-sidebar-section-title" style={{ marginBottom: 12, textAlign: "right" }}>
        {locale === "ar" ? "التطبيقات" : "Applications"}
      </div>
      <nav className="erp-nav" dir="rtl" aria-label={locale === "ar" ? "التنقل الإداري" : "Admin Navigation"}>
        <NavTree nodes={navTree} pathname={pathname} openGroups={openGroups} onToggleGroup={toggleGroup} />
      </nav>
      <div className="erp-sidebar-footer">
        <button type="button" className="erp-logout-btn" onClick={logout}>
          {locale === "ar" ? "تسجيل الخروج" : "Logout"}
        </button>
      </div>
    </>
  );

  if (isMobile) {
    return (
      <>
        <button type="button" className="erp-mobile-menu-btn" onClick={() => setMobileOpen(true)} aria-label="فتح القائمة">
          ☰
        </button>
        {mobileOpen ? (
          <>
            <div className="erp-mobile-overlay" onClick={() => setMobileOpen(false)} />
            <aside className="erp-mobile-sidebar" dir="rtl" aria-label="القائمة الجانبية">
              <div className="erp-mobile-sidebar-head">
                <div className="erp-mobile-sidebar-title">Royal Palace ERP</div>
                <button type="button" className="erp-mobile-close-btn" onClick={() => setMobileOpen(false)} aria-label="إغلاق القائمة">
                  ×
                </button>
              </div>
              {navContent}
            </aside>
          </>
        ) : null}
      </>
    );
  }

  return (
    <aside className="erp-sidebar" dir="rtl" aria-label="القائمة الجانبية">
      {navContent}
    </aside>
  );
}
