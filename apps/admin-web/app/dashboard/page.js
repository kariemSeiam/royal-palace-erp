"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const DASHBOARD_API_URL = "https://api.royalpalace-group.com/api/v1/admin/dashboard/stats";
const FINANCE_SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/finance/summary";
const FACTORY_PROFIT_API_URL = "https://api.royalpalace-group.com/api/v1/admin/finance/factory-profitability";
const SALES_TREND_API_URL = "https://api.royalpalace-group.com/api/v1/admin/finance/sales-trend";
const COST_TREND_API_URL = "https://api.royalpalace-group.com/api/v1/admin/finance/cost-trend";
const TOP_PRODUCTS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/finance/top-products";
const STOCK_SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/stock-summary";
const STOCK_ALERTS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/stock-alerts";
const PROCUREMENT_PAYABLES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/supplier-payables-summary";
const WORK_ORDERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/work-orders/summary";
const IT_ACCESS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/it/access-center/summary";

function formatNumber(value) {
  let num = Number(value || 0);
  if (isNaN(num)) num = 0;
  return num.toLocaleString("ar-EG");
}

function formatCurrency(value) {
  let num = Number(value || 0);
  if (isNaN(num)) num = 0;
  return num.toLocaleString("ar-EG");
}

function formatPercent(value) {
  let num = Number(value || 0);
  if (isNaN(num)) num = 0;
  return num.toFixed(1);
}

function humanizeOrderStatus(status) {
  const map = {
    order_received: "تم استلام الطلب",
    materials_allocated: "تخصيص المواد",
    manufacturing_started: "بدأ التصنيع",
    assembly: "التجميع",
    quality_control: "فحص الجودة",
    packaging: "التغليف",
    delivery_dispatched: "خرج للتسليم",
    delivered: "تم التسليم",
    cancelled: "ملغي",
    confirmed: "مؤكد",
    pending: "قيد الانتظار"
  };
  return map[status] || status || "-";
}

function AnimatedCounter({ value, duration = 800, prefix = "", suffix = "" }) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    const end = Number(value) || 0;
    if (end === 0) { setCount(0); return; }
    let current = 0;
    const increment = end / (duration / 16);
    const timer = setInterval(() => {
      current += increment;
      if (current >= end) {
        setCount(end);
        clearInterval(timer);
      } else {
        setCount(Math.floor(current));
      }
    }, 16);
    return () => clearInterval(timer);
  }, [value, duration]);
  return <span>{prefix}{count.toLocaleString("ar-EG")}{suffix}</span>;
}

function MetricCard({ title, value, note, color, icon, delay, prefix = "", suffix = "" }) {
  const [isHovered, setIsHovered] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setIsVisible(true), delay || 0);
    return () => clearTimeout(timer);
  }, [delay]);
  return (
    <div
      style={{
        background: "rgba(255, 255, 255, 0.85)",
        backdropFilter: "blur(12px)",
        borderRadius: "24px",
        padding: "18px",
        border: "1px solid " + color + "30",
        boxShadow: isHovered ? "0 20px 35px -12px " + color + "40" : "0 8px 20px -6px rgba(0,0,0,0.08)",
        transform: isHovered ? "translateY(-4px)" : "translateY(0)",
        transition: "all 0.3s cubic-bezier(0.2, 0.9, 0.4, 1.1)",
        opacity: isVisible ? 1 : 0,
        transform: isVisible ? "translateY(0)" : "translateY(20px)",
        cursor: "pointer",
        position: "relative",
        overflow: "hidden",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ position: "absolute", top: 0, right: 0, width: "100%", height: "3px", background: "linear-gradient(90deg, " + color + ", " + color + "80, transparent)" }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ color: "#64748b", fontSize: "11px", fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: "26px", fontWeight: 900, color: color, marginTop: "4px" }}><AnimatedCounter value={value} prefix={prefix} suffix={suffix} /></div>
          <div style={{ color: "#94a3b8", fontSize: "10px", marginTop: "4px" }}>{note}</div>
        </div>
        <div style={{ fontSize: "32px", opacity: 0.6, transform: isHovered ? "scale(1.05) rotate(3deg)" : "scale(1) rotate(0)", transition: "transform 0.3s ease" }}>{icon}</div>
      </div>
    </div>
  );
}

function LineChart({ data, color, height = 200 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.clientWidth;
    const h = height;
    canvas.width = width;
    canvas.height = h;
    ctx.clearRect(0, 0, width, h);
    
    const values = data.map(d => Number(d.value) || 0);
    const max = Math.max(...values, 1);
    const stepX = width / (values.length - 1);
    
    ctx.beginPath();
    ctx.moveTo(0, h - (values[0] / max) * (h - 40) - 20);
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(i * stepX, h - (values[i] / max) * (h - 40) - 20);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 2.5;
    ctx.stroke();
    
    ctx.beginPath();
    ctx.moveTo(0, h - (values[0] / max) * (h - 40) - 20);
    for (let i = 1; i < values.length; i++) {
      ctx.lineTo(i * stepX, h - (values[i] / max) * (h - 40) - 20);
    }
    ctx.lineTo(width, h);
    ctx.lineTo(0, h);
    ctx.fillStyle = color + "20";
    ctx.fill();
    
    for (let i = 0; i < values.length; i++) {
      ctx.beginPath();
      ctx.arc(i * stepX, h - (values[i] / max) * (h - 40) - 20, 3, 0, 2 * Math.PI);
      ctx.fillStyle = color;
      ctx.fill();
    }
  }, [data, color, height]);
  
  return (
    <div>
      <canvas ref={canvasRef} style={{ width: "100%", height: height + "px" }} />
      <div style={{ display: "flex", justifyContent: "space-around", marginTop: "8px", fontSize: "10px", color: "#94a3b8" }}>
        {data && data.map((d, i) => (
          <span key={i}>{d.label}</span>
        ))}
      </div>
    </div>
  );
}

function BarChart({ data, color, height = 200 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = canvas.clientWidth;
    const h = height;
    canvas.width = width;
    canvas.height = h;
    ctx.clearRect(0, 0, width, h);
    
    const values = data.map(d => Number(d.value) || 0);
    const max = Math.max(...values, 1);
    const barWidth = (width / values.length) * 0.7;
    const spacing = (width / values.length) * 0.3;
    
    for (let i = 0; i < values.length; i++) {
      const barHeight = (values[i] / max) * (h - 40);
      const x = i * (barWidth + spacing) + spacing / 2;
      const y = h - barHeight - 20;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, barWidth, barHeight);
      ctx.fillStyle = color + "40";
      ctx.fillRect(x, h - 20, barWidth, 2);
      
      ctx.fillStyle = "#1e293b";
      ctx.font = "10px Arial";
      ctx.fillText(data[i].label, x + barWidth / 4, h - 5);
    }
  }, [data, color, height]);
  
  return <canvas ref={canvasRef} style={{ width: "100%", height: height + "px" }} />;
}

function PieChart({ data, colors, size = 180 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    if (!canvasRef.current || !data || data.length === 0) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const width = size;
    const height = size;
    canvas.width = width;
    canvas.height = height;
    ctx.clearRect(0, 0, width, height);
    
    const total = data.reduce((sum, d) => sum + (Number(d.value) || 0), 0);
    if (total === 0) return;
    
    let startAngle = -Math.PI / 2;
    for (let i = 0; i < data.length; i++) {
      const angle = (Number(data[i].value) / total) * Math.PI * 2;
      const endAngle = startAngle + angle;
      ctx.beginPath();
      ctx.fillStyle = colors[i % colors.length];
      ctx.moveTo(width / 2, height / 2);
      ctx.arc(width / 2, height / 2, width / 2 - 10, startAngle, endAngle);
      ctx.fill();
      startAngle = endAngle;
    }
  }, [data, colors, size]);
  
  return <canvas ref={canvasRef} width={size} height={size} style={{ width: size + "px", height: size + "px" }} />;
}

function QuickLink({ label, href, color }) {
  const [isHovered, setIsHovered] = useState(false);
  return (
    <Link href={href} style={{ textDecoration: "none" }}>
      <div
        style={{
          padding: "10px",
          borderRadius: "12px",
          background: isHovered ? color + "10" : "white",
          border: "1px solid " + color + "25",
          textAlign: "center",
          fontWeight: 700,
          fontSize: "12px",
          color: color,
          transition: "all 0.2s ease",
          transform: isHovered ? "translateY(-2px)" : "translateY(0)",
          cursor: "pointer",
        }}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
      >
        {label}
      </div>
    </Link>
  );
}

function FactoryCard({ factory, idx }) {
  const [isHovered, setIsHovered] = useState(false);
  const name = factory?.factory_name || factory?.name || `مصنع ${idx + 1}`;
  const departments = factory?.departments_count || 0;
  const employees = factory?.employees_count || 0;
  const isActive = factory?.is_active !== false;
  
  return (
    <div
      style={{
        background: "white",
        borderRadius: "20px",
        padding: "16px",
        border: "1px solid #eef2f7",
        boxShadow: isHovered ? "0 8px 20px rgba(0,0,0,0.1)" : "0 1px 3px rgba(0,0,0,0.05)",
        transform: isHovered ? "translateY(-3px)" : "translateY(0)",
        transition: "all 0.2s ease",
        cursor: "pointer",
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
        <span style={{ fontSize: "24px" }}>🏭</span>
        <span className={`erp-badge ${isActive ? "success" : "warning"}`}>{isActive ? "نشط" : "متوقف"}</span>
      </div>
      <h3 style={{ fontSize: "16px", fontWeight: 800, margin: "0 0 8px 0", color: "#0b1f4d" }}>{name}</h3>
      <div style={{ display: "flex", gap: "16px", marginTop: "12px" }}>
        <div>
          <div style={{ fontSize: "11px", color: "#64748b" }}>الأقسام</div>
          <div style={{ fontSize: "20px", fontWeight: 800 }}>{formatNumber(departments)}</div>
        </div>
        <div>
          <div style={{ fontSize: "11px", color: "#64748b" }}>الموظفون</div>
          <div style={{ fontSize: "20px", fontWeight: 800 }}>{formatNumber(employees)}</div>
        </div>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { user, ready } = useAdminAuth("dashboard");
  const [dashboard, setDashboard] = useState({
    summary: {
      factories_count: 0, departments_count: 0, employees_count: 0, attendance_count: 0,
      orders_count: 0, users_count: 0, roles_count: 0, categories_count: 0,
      products_count: 0, b2b_accounts_count: 0
    },
    order_status_breakdown: [],
    factory_overview: []
  });
  const [financeSummary, setFinanceSummary] = useState(null);
  const [factoryProfit, setFactoryProfit] = useState([]);
  const [salesTrend, setSalesTrend] = useState([]);
  const [costTrend, setCostTrend] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [inventoryStock, setInventoryStock] = useState([]);
  const [stockAlerts, setStockAlerts] = useState([]);
  const [payablesSummary, setPayablesSummary] = useState(null);
  const [workOrdersSummary, setWorkOrdersSummary] = useState(null);
  const [itAccess, setItAccess] = useState({ summary: { active_users_with_it_access: 0, superusers_count: 0 } });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready || !user) return;
    async function loadAll() {
      try {
        const results = await Promise.all([
          fetch(DASHBOARD_API_URL, { headers: authHeaders(), cache: "no-store" }),
          fetch(FINANCE_SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
          fetch(FACTORY_PROFIT_API_URL, { headers: authHeaders(), cache: "no-store" }),
          fetch(SALES_TREND_API_URL, { headers: authHeaders(), cache: "no-store" }),
          fetch(COST_TREND_API_URL, { headers: authHeaders(), cache: "no-store" }),
          fetch(TOP_PRODUCTS_API_URL, { headers: authHeaders(), cache: "no-store" }),
          fetch(STOCK_SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
          fetch(STOCK_ALERTS_API_URL, { headers: authHeaders(), cache: "no-store" }),
          fetch(PROCUREMENT_PAYABLES_API_URL, { headers: authHeaders(), cache: "no-store" }),
          fetch(WORK_ORDERS_API_URL, { headers: authHeaders(), cache: "no-store" }),
          fetch(IT_ACCESS_API_URL, { headers: authHeaders(), cache: "no-store" }),
        ]);

        const jsonResults = await Promise.all(
          results.map(r => r.json().catch(() => ({})))
        );

        setDashboard({
          summary: {
            factories_count: Number(jsonResults[0]?.summary?.factories_count || 0),
            departments_count: Number(jsonResults[0]?.summary?.departments_count || 0),
            employees_count: Number(jsonResults[0]?.summary?.employees_count || 0),
            attendance_count: Number(jsonResults[0]?.summary?.attendance_count || 0),
            orders_count: Number(jsonResults[0]?.summary?.orders_count || 0),
            users_count: Number(jsonResults[0]?.summary?.users_count || 0),
            roles_count: Number(jsonResults[0]?.summary?.roles_count || 0),
            categories_count: Number(jsonResults[0]?.summary?.categories_count || 0),
            products_count: Number(jsonResults[0]?.summary?.products_count || 0),
            b2b_accounts_count: Number(jsonResults[0]?.summary?.b2b_accounts_count || 0)
          },
          order_status_breakdown: jsonResults[0]?.order_status_breakdown || [],
          factory_overview: jsonResults[0]?.factory_overview || []
        });
        setFinanceSummary(jsonResults[1]?.summary || null);
        setFactoryProfit(Array.isArray(jsonResults[2]) ? jsonResults[2] : []);
        setSalesTrend(Array.isArray(jsonResults[3]) ? jsonResults[3] : []);
        setCostTrend(Array.isArray(jsonResults[4]) ? jsonResults[4] : []);
        setTopProducts(Array.isArray(jsonResults[5]) ? jsonResults[5] : []);
        setInventoryStock(Array.isArray(jsonResults[6]) ? jsonResults[6] : []);
        setStockAlerts(Array.isArray(jsonResults[7]) ? jsonResults[7] : []);
        setPayablesSummary(jsonResults[8]?.summary || jsonResults[8] || null);
        setWorkOrdersSummary(jsonResults[9] || null);
        setItAccess({ summary: jsonResults[10]?.summary || {} });
      } catch (e) {
        console.error("Dashboard error:", e);
      } finally {
        setLoading(false);
      }
    }
    loadAll();
  }, [ready, user]);

  const s = dashboard.summary;
  const fs = financeSummary || {};
  const totalInventoryValue = inventoryStock.reduce((sum, i) => sum + (Number(i.current_stock || 0) * (Number(i.avg_unit_cost) || 0)), 0);
  const lowStockItems = stockAlerts.filter(a => a.alert_type === "reorder_needed" || a.alert_type === "below_min_stock").length;
  const netProfit = (fs.net_sales_total || 0) - (fs.purchase_receipts_total_cost || 0) - (fs.payroll_total || 0);
  const profitMargin = fs.net_sales_total > 0 ? (netProfit / fs.net_sales_total) * 100 : 0;
  
  const salesChartData = salesTrend.map(item => ({
    label: item.month ? item.month.slice(5) : "",
    value: item.total_sales
  }));
  
  const costChartData = costTrend.map(item => ({
    label: item.month ? item.month.slice(5) : "",
    value: item.procurement_cost
  }));
  
  const pieColors = ["#2563eb", "#16a34a", "#d97706", "#dc2626", "#7c3aed", "#0891b2", "#db2777", "#0b1f4d", "#d6b47a"];
  const orderStatusData = dashboard.order_status_breakdown.slice(0, 6).map(item => ({
    label: humanizeOrderStatus(item.status),
    value: item.count
  }));

  if (loading || !ready) {
    return (
      <main className="loading-shell" dir="rtl">
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "linear-gradient(135deg, #f5f7fa 0%, #eef2f7 100%)" }}>
          <div style={{ background: "rgba(255,255,255,0.9)", backdropFilter: "blur(10px)", borderRadius: "32px", padding: "32px 48px", textAlign: "center" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px" }}>📊</div>
            <div style={{ fontWeight: 700, fontSize: "18px", color: "#0f172a" }}>جاري تحميل المؤشرات التنفيذية</div>
            <div style={{ fontSize: "13px", color: "#64748b", marginTop: "8px" }}>يتم تجهيز بيانات المبيعات والمخزون والتكاليف...</div>
            <div style={{ width: "40px", height: "40px", margin: "20px auto 0", border: "3px solid #e2e8f0", borderTopColor: "#2563eb", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl" style={{ padding: "20px 28px", background: "transparent" }}>

        <div style={{
          background: "linear-gradient(135deg, #0b1f4d 0%, #1e3a5f 100%)",
          borderRadius: "28px",
          padding: "20px 28px",
          marginBottom: "28px",
          color: "white",
          position: "relative",
          overflow: "hidden"
        }}>
          <div style={{ position: "absolute", top: -50, left: -50, width: "200px", height: "200px", background: "rgba(255,255,255,0.05)", borderRadius: "50%" }} />
          <div style={{ position: "absolute", bottom: -80, right: -30, width: "250px", height: "250px", background: "rgba(255,255,255,0.03)", borderRadius: "50%" }} />
          <div style={{ position: "relative", zIndex: 1 }}>
            <div style={{ fontSize: "12px", opacity: 0.8, marginBottom: "4px", letterSpacing: "1px" }}>ROYAL PALACE ENTERPRISE OS</div>
            <h1 style={{ fontSize: "26px", fontWeight: 800, margin: 0, letterSpacing: "-0.5px" }}>مركز القيادة التنفيذي</h1>
            <p style={{ fontSize: "13px", opacity: 0.8, marginTop: "4px" }}>لوحة تحكم شاملة تعكس الأداء المالي والتشغيلي للمؤسسة</p>
            <div style={{ display: "flex", gap: "16px", marginTop: "16px", flexWrap: "wrap" }}>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "40px", padding: "4px 14px", fontSize: "12px" }}>🎯 جاهزية النظام</div>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "40px", padding: "4px 14px", fontSize: "12px" }}>💰 هامش الربح: {formatPercent(profitMargin)}%</div>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "40px", padding: "4px 14px", fontSize: "12px" }}>🏭 {formatNumber(s.factories_count)} مصانع</div>
              <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: "40px", padding: "4px 14px", fontSize: "12px" }}>📦 {formatNumber(s.products_count)} منتج</div>
            </div>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: "14px", marginBottom: "28px" }}>
          <MetricCard title="صافي المبيعات" value={fs.net_sales_total || 0} note="بعد الإشعارات الدائنة" color="#2563eb" icon="💰" delay={0} prefix="ج.م " />
          <MetricCard title="الربح التشغيلي" value={netProfit > 0 ? netProfit : 0} note={netProfit >= 0 ? "أرباح" : "خسائر"} color="#16a34a" icon="📈" delay={50} prefix="ج.م " />
          <MetricCard title="تكلفة المشتريات" value={fs.purchase_receipts_total_cost || 0} note="فواتير الاستلام" color="#dc2626" icon="📦" delay={100} prefix="ج.م " />
          <MetricCard title="إجمالي الرواتب" value={fs.payroll_total || 0} note="صافي الرواتب" color="#d97706" icon="👥" delay={150} prefix="ج.م " />
          <MetricCard title="المستحق للموردين" value={payablesSummary?.remaining_total || 0} note="ذمم دائنة" color="#7c3aed" icon="🏦" delay={200} prefix="ج.م " />
          <MetricCard title="قيمة المخزون" value={totalInventoryValue} note="تقديرية" color="#0891b2" icon="📊" delay={250} prefix="ج.م " />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "14px", marginBottom: "28px" }}>
          <MetricCard title="فواتير المبيعات" value={fs.sales_invoices_total || 0} note="إجمالي الفواتير" color="#0b1f4d" icon="📄" delay={0} prefix="ج.م " />
          <MetricCard title="الذمم المدينة" value={fs.outstanding_receivables || 0} note="غير محصلة" color="#dc2626" icon="⏳" delay={50} prefix="ج.م " />
          <MetricCard title="الطلبات" value={s.orders_count} note="دورة تشغيلية" color="#7c3aed" icon="📦" delay={100} />
          <MetricCard title="أوامر العمل" value={workOrdersSummary?.total || 0} note="قيد التشغيل" color="#d97706" icon="⚙️" delay={150} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(8, 1fr)", gap: "12px", marginBottom: "28px" }}>
          <MetricCard title="المصانع" value={s.factories_count} note="الوحدات الإنتاجية" color="#0b1f4d" icon="🏭" delay={0} />
          <MetricCard title="الأقسام" value={s.departments_count} note="الهيكل الإداري" color="#2563eb" icon="📊" delay={50} />
          <MetricCard title="الموظفون" value={s.employees_count} note="القوى العاملة" color="#d6b47a" icon="👥" delay={100} />
          <MetricCard title="سجلات الحضور" value={s.attendance_count} note="انضباط يومي" color="#16a34a" icon="⏱️" delay={150} />
          <MetricCard title="المستخدمون" value={s.users_count} note="حسابات النظام" color="#0891b2" icon="👤" delay={200} />
          <MetricCard title="الأدوار" value={s.roles_count} note="صلاحيات الوصول" color="#db2777" icon="🔐" delay={250} />
          <MetricCard title="الفئات" value={s.categories_count} note="تصنيف المنتجات" color="#d97706" icon="📁" delay={300} />
          <MetricCard title="حسابات B2B" value={s.b2b_accounts_count} note="العملاء التجاريون" color="#2563eb" icon="🤝" delay={350} />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "24px", marginBottom: "28px" }}>
          <div style={{ background: "white", borderRadius: "20px", padding: "18px", border: "1px solid #eef2f7" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 800, marginBottom: "12px" }}>اتجاه المبيعات الشهرية</h3>
            <p style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "16px" }}>آخر 12 شهر</p>
            {salesChartData.length > 0 ? (
              <LineChart data={salesChartData} color="#2563eb" height={200} />
            ) : (
              <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>لا توجد بيانات كافية</div>
            )}
          </div>

          <div style={{ background: "white", borderRadius: "20px", padding: "18px", border: "1px solid #eef2f7" }}>
            <h3 style={{ fontSize: "15px", fontWeight: 800, marginBottom: "12px" }}>اتجاه تكاليف المشتريات</h3>
            <p style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "16px" }}>آخر 12 شهر</p>
            {costChartData.length > 0 ? (
              <BarChart data={costChartData} color="#d97706" height={200} />
            ) : (
              <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>لا توجد بيانات كافية</div>
            )}
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "24px", marginBottom: "28px" }}>
          <div style={{ background: "white", borderRadius: "20px", padding: "18px", border: "1px solid #eef2f7" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 800, marginBottom: "12px" }}>حالات الطلبات</h3>
            <div style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
              {orderStatusData.length > 0 ? (
                <PieChart data={orderStatusData} colors={pieColors} size={160} />
              ) : (
                <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>لا توجد بيانات</div>
              )}
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px", fontSize: "10px" }}>
              {orderStatusData.slice(0, 6).map((item, idx) => (
                <div key={idx} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <div style={{ width: "10px", height: "10px", borderRadius: "10px", background: pieColors[idx % pieColors.length] }} />
                  <span>{item.label}: {formatNumber(item.value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ background: "white", borderRadius: "20px", padding: "18px", border: "1px solid #eef2f7" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 800, marginBottom: "12px" }}>أفضل المنتجات مبيعاً</h3>
            {topProducts.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>لا توجد بيانات</div>
            ) : (
              topProducts.slice(0, 5).map((prod, idx) => (
                <div key={idx} style={{ marginBottom: "12px", padding: "8px", background: "#f8fafc", borderRadius: "10px" }}>
                  <div style={{ fontWeight: 700, fontSize: "13px" }}>{prod.name_ar || prod.name_en || prod.sku}</div>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", marginTop: "4px" }}>
                    <span style={{ color: "#64748b" }}>الكمية: {formatNumber(prod.total_quantity_sold)}</span>
                    <span style={{ color: "#16a34a", fontWeight: 700 }}>{formatCurrency(prod.total_revenue)} ج.م</span>
                  </div>
                </div>
              ))
            )}
          </div>

          <div style={{ background: "white", borderRadius: "20px", padding: "18px", border: "1px solid #eef2f7" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 800, marginBottom: "12px" }}>تحليل الربحية</h3>
            <div style={{ marginBottom: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "4px" }}>
                <span>نسبة هامش الربح</span>
                <span style={{ fontWeight: 800, color: "#16a34a" }}>{formatPercent(profitMargin)}%</span>
              </div>
              <div style={{ height: "8px", background: "#e2e8f0", borderRadius: "999px", overflow: "hidden" }}>
                <div style={{ width: Math.min(profitMargin, 100) + "%", height: "100%", background: "#16a34a", borderRadius: "999px" }} />
              </div>
            </div>
            <div style={{ marginBottom: "12px", padding: "10px", background: "#f0fdf4", borderRadius: "10px" }}>
              <div style={{ fontSize: "11px", color: "#166534" }}>صافي الربح التشغيلي</div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#16a34a" }}>{formatCurrency(netProfit)} ج.م</div>
            </div>
            <div style={{ marginBottom: "12px", padding: "10px", background: "#fef3c7", borderRadius: "10px" }}>
              <div style={{ fontSize: "11px", color: "#92400e" }}>تنبيهات المخزون</div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#d97706" }}>{lowStockItems} منتج</div>
            </div>
            <div style={{ padding: "10px", background: "#e0f2fe", borderRadius: "10px" }}>
              <div style={{ fontSize: "11px", color: "#075985" }}>مستخدمو IT النشطون</div>
              <div style={{ fontSize: "20px", fontWeight: 800, color: "#0891b2" }}>{formatNumber(itAccess.summary.active_users_with_it_access)}</div>
            </div>
          </div>
        </div>

        <div style={{ marginBottom: "28px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
            <h3 style={{ fontSize: "16px", fontWeight: 800, color: "#0f172a" }}>المصانع</h3>
            <span className="erp-mini-note">{dashboard.factory_overview.length} مصنع</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
            {dashboard.factory_overview.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px", background: "white", borderRadius: "20px", color: "#94a3b8" }}>لا توجد بيانات مصانع حالياً</div>
            ) : (
              dashboard.factory_overview.map((factory, idx) => (
                <FactoryCard key={idx} factory={factory} idx={idx} />
              ))
            )}
          </div>
        </div>

        <div style={{ background: "white", borderRadius: "20px", padding: "16px", border: "1px solid #eef2f7" }}>
          <h3 style={{ fontSize: "15px", fontWeight: 800, marginBottom: "12px" }}>الوصول السريع</h3>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(110px, 1fr))", gap: "10px" }}>
            {[
              { label: "الطلبات", href: "/orders", color: "#2563eb" },
              { label: "فواتير المبيعات", href: "/sales-invoices", color: "#0b1f4d" },
              { label: "المشتريات", href: "/procurement/purchase-orders", color: "#7c3aed" },
              { label: "أوامر العمل", href: "/work-orders", color: "#d97706" },
              { label: "المخزون", href: "/inventory", color: "#16a34a" },
              { label: "الرواتب", href: "/hr/payroll", color: "#db2777" },
              { label: "المالية", href: "/finance", color: "#0891b2" },
              { label: "التكلفة", href: "/finance/costing", color: "#d6b47a" },
              { label: "المحاسبة", href: "/accounting", color: "#0b1f4d" },
              { label: "IT Governance", href: "/it", color: "#2563eb" },
            ].map((link) => (
              <QuickLink key={link.href} label={link.label} href={link.href} color={link.color} />
            ))}
          </div>
        </div>

      </section>
    </main>
  );
}
