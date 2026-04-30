"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";

const FINANCE_SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/finance/summary";
const WORK_ORDERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/work-orders";
const STOCK_SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/stock-summary";
const PROCUREMENT_COST_URL = "https://api.royalpalace-group.com/api/v1/admin/finance/factory-profitability";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeText(value) { return String(value || "").trim().toLowerCase(); }
function companyName() { return "Royal Palace Group"; }
function companyLogoUrl() { return "https://royalpalace-group.com/brand/logo.png"; }

/* ── Donut Chart ── */
function DonutChart({ value = 0, total = 100, color = "#2563eb", size = 110, label = "", sub = "" }) {
  const pct = Math.min(100, total > 0 ? (value / total) * 100 : 0);
  const r = 40; const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "6px" }}>
      <svg width={size} height={size} viewBox="0 0 100 100">
        <circle cx="50" cy="50" r={r} fill="none" stroke="rgba(0,0,0,0.07)" strokeWidth="12" />
        <circle cx="50" cy="50" r={r} fill="none" stroke={color} strokeWidth="12"
          strokeDasharray={`${dash} ${circ - dash}`} strokeDashoffset={circ / 4}
          strokeLinecap="round" style={{ transition: "stroke-dasharray 0.7s ease" }} />
        <text x="50" y="46" textAnchor="middle" fontSize="14" fontWeight="900" fill="currentColor">{Math.round(pct)}%</text>
        <text x="50" y="62" textAnchor="middle" fontSize="8" fill="#64748b">{sub}</text>
      </svg>
      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--rp-text-muted)", textAlign: "center" }}>{label}</div>
    </div>
  );
}

/* ── Gauge ── */
function GaugeBar({ value = 0, max = 100, color = "#2563eb", label = "" }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0);
  return (
    <div style={{ display: "grid", gap: "6px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
        <span style={{ fontWeight: 700, color: "var(--rp-text)" }}>{label}</span>
        <span style={{ fontWeight: 900, color }}>{formatAmount(value)}</span>
      </div>
      <div style={{ height: "10px", borderRadius: "999px", background: "rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${pct}%`, borderRadius: "999px", background: color, transition: "width 0.7s ease" }} />
      </div>
    </div>
  );
}

/* ── Waterfall Summary Card ── */
function WaterfallCard({ items = [] }) {
  return (
    <div style={{ display: "grid", gap: "0" }}>
      {items.map((item, idx) => (
        <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 0", borderBottom: idx < items.length - 1 ? "1px solid var(--rp-border)" : "none" }}>
          <span style={{ fontWeight: item.bold ? 900 : 500, fontSize: item.bold ? "14px" : "13px", color: item.color || "var(--rp-text)" }}>{item.label}</span>
          <span style={{ fontWeight: 800, fontSize: item.bold ? "15px" : "13px", color: item.color || "var(--rp-text)", direction: "ltr" }}>
            {item.sign || ""}{formatAmount(item.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

function exportCostSummaryCsv({ financeSummary, procurementCosts, workOrderRows, inventoryRows }) {
  const escapeCsv = (v) => { const s = String(v ?? ""); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g,'""')}"` : s; };
  const sections = [];
  sections.push("=== ملخص التكلفة ===");
  sections.push(["البيان","القيمة"].join(","));
  sections.push(["صافي المبيعات", escapeCsv(formatAmount(financeSummary?.net_sales_total||0))].join(","));
  sections.push(["تكلفة المشتريات", escapeCsv(formatAmount(financeSummary?.purchase_receipts_total_cost||0))].join(","));
  sections.push(["إجمالي الرواتب", escapeCsv(formatAmount(financeSummary?.payroll_total||0))].join(","));
  sections.push(["الربح الإجمالي", escapeCsv(formatAmount(financeSummary?.estimated_gross_profit||0))].join(","));
  sections.push(["الربح التشغيلي", escapeCsv(formatAmount(financeSummary?.estimated_operating_profit||0))].join(","));
  sections.push([""]);
  sections.push("=== تكلفة أوامر العمل ===");
  sections.push(["رقم الأمر","الطلب","العميل","الحالة","الدقائق الفعلية","التقدم","تكلفة المواد","تكلفة العمالة","الإجمالي"].join(","));
  workOrderRows.forEach((row) => sections.push([row.order_number||`WO#${row.id}`,row.order_id||"-",row.customer_name||"-",row.status||"-",row.actual_minutes||0,row.progress_percent||0,row.estimated_materials_cost||0,row.estimated_labor_cost||0,(row.estimated_materials_cost||0)+(row.estimated_labor_cost||0)].map(escapeCsv).join(",")));
  sections.push([""]);
  sections.push("=== تقييم المخزون ===");
  sections.push(["المنتج","SKU","الفئة","الكمية المتاحة","القيمة التقديرية"].join(","));
  inventoryRows.forEach((row) => sections.push([row.product_name||"-",row.sku||"-",row.category_name||"-",row.current_stock||0,row.estimated_value||0].map(escapeCsv).join(",")));
  const csv = sections.join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "costing_full_report.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
}

function exportCostingPdf({ financeSummary, workOrderRows, inventoryRows }) {
  const printWindow = window.open("", "_blank", "width=1280,height=900");
  if (!printWindow) return;
  const woHtml = (workOrderRows||[]).map((row) => `<tr><td>${row.order_number||`WO#${row.id}`}</td><td>${row.order_id||"-"}</td><td>${row.status||"-"}</td><td>${formatAmount(row.actual_minutes||0)}</td><td>${formatAmount(row.progress_percent||0)}%</td><td>${formatAmount(row.estimated_materials_cost||0)}</td><td>${formatAmount(row.estimated_labor_cost||0)}</td><td>${formatAmount((row.estimated_materials_cost||0)+(row.estimated_labor_cost||0))}</td></tr>`).join("");
  const invHtml = (inventoryRows||[]).map((row) => `<tr><td>${row.product_name||"-"}</td><td>${row.sku||"-"}</td><td>${formatAmount(row.current_stock||0)}</td><td>${formatAmount(row.estimated_value||0)}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"/><title>Costing Report</title><style>*{box-sizing:border-box;}@page{size:A4 landscape;margin:12mm;}body{font-family:Arial,sans-serif;margin:0;color:#0f172a;background:#fff;}.hdr{display:flex;align-items:center;justify-content:space-between;border-bottom:2px solid #0f172a;padding-bottom:12px;margin-bottom:18px;}.brand{display:flex;align-items:center;gap:12px;}.brand img{width:56px;height:56px;object-fit:contain;}.brand h1{margin:0;font-size:22px;}.brand p{margin:6px 0 0;color:#475569;font-size:12px;}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:18px;}.card{border:1px solid #cbd5e1;border-radius:12px;padding:12px;background:#f8fafc;}.card .l{font-size:11px;color:#64748b;margin-bottom:6px;}.card .v{font-size:17px;font-weight:800;color:#0f172a;}h2{margin:18px 0 10px;font-size:18px;}table{width:100%;border-collapse:collapse;margin-bottom:18px;}th,td{border:1px solid #cbd5e1;padding:8px 10px;font-size:11px;text-align:right;}thead th{background:#e2e8f0;font-weight:800;}tbody tr:nth-child(even){background:#f8fafc;}</style></head><body><div class="hdr"><div class="brand"><img src="${companyLogoUrl()}" alt="logo"/><div><h1>${companyName()}</h1><p>تقرير التكلفة والتشغيل</p></div></div><div>Costing Report – Pack 8</div></div><div class="grid"><div class="card"><div class="l">صافي المبيعات</div><div class="v">${formatAmount(financeSummary?.net_sales_total||0)}</div></div><div class="card"><div class="l">تكلفة المشتريات</div><div class="v">${formatAmount(financeSummary?.purchase_receipts_total_cost||0)}</div></div><div class="card"><div class="l">إجمالي الرواتب</div><div class="v">${formatAmount(financeSummary?.payroll_total||0)}</div></div><div class="card"><div class="l">الربح التشغيلي</div><div class="v">${formatAmount(financeSummary?.estimated_operating_profit||0)}</div></div></div><h2>تكلفة أوامر العمل</h2><table><thead><tr><th>رقم الأمر</th><th>الطلب</th><th>الحالة</th><th>الدقائق الفعلية</th><th>التقدم</th><th>تكلفة المواد</th><th>تكلفة العمالة</th><th>الإجمالي</th></tr></thead><tbody>${woHtml||`<tr><td colspan="8">لا توجد بيانات.</td></tr>`}</tbody></table><h2>تقييم المخزون التقريبي</h2><table><thead><tr><th>المنتج</th><th>SKU</th><th>الكمية المتاحة</th><th>القيمة التقديرية</th></tr></thead><tbody>${invHtml||`<tr><td colspan="4">لا توجد بيانات.</td></tr>`}</tbody></table><script>window.onload=function(){setTimeout(()=>window.print(),400);};</script></body></html>`;
  printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
}

function exportCostingWorkOrdersCsv(rows) {
  const escapeCsv = (v) => { const s = String(v ?? ""); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g,'""')}"` : s; };
  const headers = ["رقم الأمر","الطلب","العميل","الحالة","الدقائق الفعلية","التقدم","تكلفة المواد","تكلفة العمالة","إجمالي التكلفة"];
  const lines = rows.map((row) => [row.order_number||`WO#${row.id}`,row.order_id||"-",row.customer_name||"-",row.status||"-",row.actual_minutes||0,row.progress_percent||0,row.estimated_materials_cost||0,row.estimated_labor_cost||0,(row.estimated_materials_cost||0)+(row.estimated_labor_cost||0)].map(escapeCsv).join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "costing_work_orders.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
}

function exportCostingInventoryCsv(rows) {
  const escapeCsv = (v) => { const s = String(v ?? ""); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g,'""')}"` : s; };
  const headers = ["المنتج","SKU","الفئة","الكمية المتاحة","القيمة التقديرية"];
  const lines = rows.map((row) => [row.product_name||"-",row.sku||"-",row.category_name||"-",row.current_stock||0,row.estimated_value||0].map(escapeCsv).join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "costing_inventory_valuation.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
}

const compactControlStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 700, paddingInline: "12px" };
const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };
const compactTableHeaderStyle = { position: "sticky", top: 0, zIndex: 2, background: "#fff", boxShadow: "0 1px 0 rgba(15,23,42,0.06)", fontSize: "12px", padding: "10px 12px", whiteSpace: "nowrap" };
const compactCellStyle = { padding: "10px 12px", fontSize: "12px", verticalAlign: "middle" };
const paginationButtonStyle = { minWidth: "88px", minHeight: "38px", borderRadius: "12px", fontWeight: 800 };

export default function CostingPage() {
  const { user, ready } = useAdminAuth("finance");
  const [financeSummary, setFinanceSummary] = useState(null);
  const [workOrders, setWorkOrders] = useState([]);
  const [inventoryStock, setInventoryStock] = useState([]);
  const [procurementCosts, setProcurementCosts] = useState([]);
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState("summary");
  const [workOrderSearch, setWorkOrderSearch] = useState("");
  const [workOrderStatusFilter, setWorkOrderStatusFilter] = useState("all");
  const [workOrderPageSize, setWorkOrderPageSize] = useState(20);
  const [workOrderPage, setWorkOrderPage] = useState(1);
  const [inventorySearch, setInventorySearch] = useState("");
  const [inventoryPageSize, setInventoryPageSize] = useState(20);
  const [inventoryPage, setInventoryPage] = useState(1);

  async function loadAll() {
    const [financeRes, workOrdersRes, stockRes, procurementRes] = await Promise.all([
      fetch(FINANCE_SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(WORK_ORDERS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(STOCK_SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(PROCUREMENT_COST_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);
    const financeData = await financeRes.json().catch(() => ({}));
    const workOrdersData = await workOrdersRes.json().catch(() => []);
    const stockData = await stockRes.json().catch(() => []);
    const procurementData = await procurementRes.json().catch(() => []);
    if (!financeRes.ok) throw new Error(financeData.detail || "فشل تحميل الملخص المالي");
    setFinanceSummary(financeData?.summary || null);
    setWorkOrders(Array.isArray(workOrdersData) ? workOrdersData : []);
    setInventoryStock(Array.isArray(stockData) ? stockData : []);
    setProcurementCosts(Array.isArray(procurementData) ? procurementData : []);
  }

  useEffect(() => { if (!ready || !user) return; loadAll().catch((err) => setMessage(err.message || "حدث خطأ")); }, [ready, user]);
  useEffect(() => { setWorkOrderPage(1); }, [workOrderSearch, workOrderStatusFilter, workOrderPageSize]);
  useEffect(() => { setInventoryPage(1); }, [inventorySearch, inventoryPageSize]);

  const workOrdersWithCost = useMemo(() => workOrders.map((wo) => {
    const estimatedMaterialsCost = (wo.items||[]).reduce((sum, item) => sum + (Number(item.allocated_quantity||0) * (Number(item.unit_cost)||0)), 0);
    const estimatedLaborCost = (wo.actual_minutes||0) * 50;
    return { ...wo, estimated_materials_cost: estimatedMaterialsCost, estimated_labor_cost: estimatedLaborCost };
  }), [workOrders]);

  const filteredWorkOrders = useMemo(() => {
    const q = normalizeText(workOrderSearch);
    let rows = [...workOrdersWithCost];
    rows = rows.filter((item) => {
      if (workOrderStatusFilter !== "all" && item.status !== workOrderStatusFilter) return false;
      if (!q) return true;
      return [item.id, item.order_number, item.order_id, item.customer_name, item.status].join(" ").toLowerCase().includes(q);
    });
    rows.sort((a, b) => Number(b.id||0) - Number(a.id||0));
    return rows;
  }, [workOrdersWithCost, workOrderSearch, workOrderStatusFilter]);

  const pagedWorkOrders = useMemo(() => filteredWorkOrders.slice((workOrderPage-1)*workOrderPageSize, workOrderPage*workOrderPageSize), [filteredWorkOrders, workOrderPage, workOrderPageSize]);
  const workOrderTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredWorkOrders.length / workOrderPageSize)), [filteredWorkOrders.length, workOrderPageSize]);

  const inventoryWithValue = useMemo(() => {
    const procurementMap = {};
    procurementCosts.forEach((p) => { procurementMap[p.factory_id] = { procurement_cost: p.procurement_cost_total||0 }; });
    return inventoryStock.map((item) => {
      let estimatedValue = 0;
      if (item.current_stock > 0 && item.avg_unit_cost) estimatedValue = Number(item.current_stock) * Number(item.avg_unit_cost);
      else if (procurementMap[item.factory_id]?.procurement_cost > 0) {
        const totalStock = inventoryStock.reduce((sum, i) => sum + (Number(i.current_stock)||0), 0);
        if (totalStock > 0) estimatedValue = (Number(item.current_stock) / totalStock) * procurementMap[item.factory_id].procurement_cost;
      }
      return { ...item, estimated_value: estimatedValue };
    });
  }, [inventoryStock, procurementCosts]);

  const filteredInventory = useMemo(() => {
    const q = normalizeText(inventorySearch);
    let rows = [...inventoryWithValue];
    rows = rows.filter((item) => { if (!q) return true; return [item.product_name, item.sku, item.category_name].join(" ").toLowerCase().includes(q); });
    rows.sort((a, b) => Number(b.current_stock||0) - Number(a.current_stock||0));
    return rows;
  }, [inventoryWithValue, inventorySearch]);

  const pagedInventory = useMemo(() => filteredInventory.slice((inventoryPage-1)*inventoryPageSize, inventoryPage*inventoryPageSize), [filteredInventory, inventoryPage, inventoryPageSize]);
  const inventoryTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredInventory.length / inventoryPageSize)), [filteredInventory.length, inventoryPageSize]);
  const totalInventoryValue = useMemo(() => filteredInventory.reduce((sum, item) => sum + (item.estimated_value||0), 0), [filteredInventory]);
  const totalMaterialsCost = useMemo(() => filteredWorkOrders.reduce((sum, wo) => sum + (wo.estimated_materials_cost||0), 0), [filteredWorkOrders]);
  const totalLaborCost = useMemo(() => filteredWorkOrders.reduce((sum, wo) => sum + (wo.estimated_labor_cost||0), 0), [filteredWorkOrders]);

  const summaryStats = useMemo(() => ({
    netSales: financeSummary?.net_sales_total || 0,
    procurementCost: financeSummary?.purchase_receipts_total_cost || 0,
    payrollTotal: financeSummary?.payroll_total || 0,
    grossProfit: financeSummary?.estimated_gross_profit || 0,
    operatingProfit: financeSummary?.estimated_operating_profit || 0,
    inventoryValue: totalInventoryValue,
    workOrderMaterials: totalMaterialsCost,
    workOrderLabor: totalLaborCost,
  }), [financeSummary, totalInventoryValue, totalMaterialsCost, totalLaborCost]);

  const totalCost = summaryStats.procurementCost + summaryStats.payrollTotal;

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ تحميل التكلفة...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">

        <header className="erp-workspace-topbar">
          <div className="erp-workspace-title-wrap">
            <div className="erp-page-eyebrow">Costing Workspace – Pack 8</div>
            <h1 className="erp-page-title">التكلفة والتشغيل</h1>
            <p className="erp-page-subtitle">ملخص التكلفة الإجمالية، تكلفة أوامر العمل، وتقييم المخزون التقريبي.</p>
          </div>
          <div className="erp-topbar-actions">
            <div className="erp-topbar-chip">صافي المبيعات: {formatAmount(summaryStats.netSales)}</div>
            <div className="erp-topbar-chip">تكلفة التشغيل: {formatAmount(totalCost)}</div>
            <div className="erp-topbar-chip" style={{ color: Number(summaryStats.operatingProfit) >= 0 ? "#16a34a" : "#dc2626" }}>الربح: {formatAmount(summaryStats.operatingProfit)}</div>
          </div>
        </header>

        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">Pack 8 – Costing Visibility Layer</div>
            <h2>تحليل التكلفة المتكامل</h2>
            <p>عرض موحد لتكاليف المشتريات والرواتب وأوامر العمل وتقييم المخزون.</p>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box"><div className="erp-stat-box-label">الربح التشغيلي التقديري</div><div className="erp-stat-box-value" style={{ color: Number(summaryStats.operatingProfit)>=0?"#16a34a":"#dc2626" }}>{formatAmount(summaryStats.operatingProfit)}</div></div>
            <div className="erp-stat-box"><div className="erp-stat-box-label">قيمة المخزون التقديرية</div><div className="erp-stat-box-value">{formatAmount(summaryStats.inventoryValue)}</div></div>
            <div className="erp-hero-visual" />
          </div>
        </section>

        {message ? <div className="erp-form-message">{message}</div> : null}

        {/* KPI Cards */}
        <section className="erp-kpi-grid" style={{ marginBottom: "16px" }}>
          <div className="erp-card"><div className="erp-card-title">صافي المبيعات</div><div className="erp-card-value">{formatAmount(summaryStats.netSales)}</div><div className="erp-card-note">بعد الإشعارات والاستردادات</div></div>
          <div className="erp-card"><div className="erp-card-title">تكلفة المشتريات</div><div className="erp-card-value">{formatAmount(summaryStats.procurementCost)}</div><div className="erp-card-note">إجمالي فواتير الاستلام</div></div>
          <div className="erp-card"><div className="erp-card-title">إجمالي الرواتب</div><div className="erp-card-value">{formatAmount(summaryStats.payrollTotal)}</div><div className="erp-card-note">إجمالي net salary</div></div>
          <div className="erp-card"><div className="erp-card-title">الربح الإجمالي</div><div className="erp-card-value" style={{ color: Number(summaryStats.grossProfit)>=0?"#16a34a":"#dc2626" }}>{formatAmount(summaryStats.grossProfit)}</div><div className="erp-card-note">صافي المبيعات - المشتريات</div></div>
          <div className="erp-card"><div className="erp-card-title">قيمة المخزون</div><div className="erp-card-value">{formatAmount(summaryStats.inventoryValue)}</div><div className="erp-card-note">تقييم تقريبي</div></div>
          <div className="erp-card"><div className="erp-card-title">تكلفة أوامر التشغيل</div><div className="erp-card-value">{formatAmount(summaryStats.workOrderMaterials + summaryStats.workOrderLabor)}</div><div className="erp-card-note">مواد + عمالة</div></div>
        </section>

        {/* Visual Summary Row */}
        <section className="erp-grid-2" style={{ marginBottom: "20px" }}>
          {/* Waterfall */}
          <div className="erp-section-card">
            <div className="erp-section-head"><div style={{ textAlign: "right" }}><h3>تحليل الربحية التدريجي</h3><p>مسار الإيراد من المبيعات إلى الربح الصافي</p></div></div>
            <WaterfallCard items={[
              { label: "فواتير المبيعات", value: financeSummary?.sales_invoices_total||0, color: "#2563eb" },
              { label: "الإشعارات الدائنة والاستردادات", value: (financeSummary?.credit_notes_total||0)+(financeSummary?.refunds_total||0), color: "#dc2626", sign: "−" },
              { label: "صافي المبيعات", value: summaryStats.netSales, color: "#0b1f4d", bold: true },
              { label: "تكلفة المشتريات", value: summaryStats.procurementCost, color: "#dc2626", sign: "−" },
              { label: "الربح الإجمالي", value: summaryStats.grossProfit, color: "#16a34a", bold: true },
              { label: "إجمالي الرواتب", value: summaryStats.payrollTotal, color: "#dc2626", sign: "−" },
              { label: "الربح التشغيلي", value: summaryStats.operatingProfit, color: Number(summaryStats.operatingProfit)>=0?"#16a34a":"#dc2626", bold: true },
            ]} />
          </div>

          {/* Cost Donuts */}
          <div className="erp-section-card">
            <div className="erp-section-head"><div style={{ textAlign: "right" }}><h3>توزيع التكاليف التشغيلية</h3><p>نسبة كل عنصر من إجمالي التكلفة</p></div></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "20px", justifyItems: "center", marginTop: "8px" }}>
              <DonutChart value={summaryStats.procurementCost} total={totalCost} color="#2563eb" label="تكلفة المشتريات" sub="من التكلفة" />
              <DonutChart value={summaryStats.payrollTotal} total={totalCost} color="#d6b47a" label="الرواتب" sub="من التكلفة" />
              <DonutChart value={summaryStats.grossProfit} total={summaryStats.netSales} color="#16a34a" label="هامش الربح الإجمالي" sub="من المبيعات" />
              <DonutChart value={Math.max(summaryStats.operatingProfit,0)} total={summaryStats.netSales} color="#0b1f4d" label="هامش الربح التشغيلي" sub="من المبيعات" />
            </div>
          </div>
        </section>

        {/* Cost Gauges */}
        <div className="erp-section-card" style={{ marginBottom: "20px" }}>
          <div className="erp-section-head"><div style={{ textAlign: "right" }}><h3>مؤشرات التكلفة</h3><p>مقارنة عناصر التكلفة بصافي المبيعات</p></div></div>
          <div style={{ display: "grid", gap: "14px", marginTop: "8px" }}>
            <GaugeBar value={summaryStats.procurementCost} max={summaryStats.netSales} color="#2563eb" label="تكلفة المشتريات" />
            <GaugeBar value={summaryStats.payrollTotal} max={summaryStats.netSales} color="#d6b47a" label="إجمالي الرواتب" />
            <GaugeBar value={summaryStats.workOrderMaterials} max={summaryStats.netSales} color="#7c3aed" label="تكلفة مواد أوامر العمل" />
            <GaugeBar value={summaryStats.inventoryValue} max={summaryStats.netSales} color="#16a34a" label="قيمة المخزون التقديرية" />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", gap: "12px", marginBottom: "18px", borderBottom: "1px solid var(--rp-border)", paddingBottom: "12px", flexWrap: "wrap" }}>
          {[["summary","ملخص المصانع"],["workOrders","تكلفة أوامر العمل"],["inventory","تقييم المخزون"]].map(([key, label]) => (
            <button key={key} className="erp-btn-ghost" style={{ fontWeight: activeTab===key?900:400, borderBottom: activeTab===key?"2px solid var(--rp-primary)":"none", paddingBottom: "6px" }} onClick={() => setActiveTab(key)}>{label}</button>
          ))}
        </div>

        {activeTab === "summary" && (
          <div className="erp-section-card" style={{ marginBottom: "18px" }}>
            <div className="erp-section-head">
              <div style={{ textAlign: "right" }}><h3>ملخص التكلفة حسب المصنع</h3><p>نظرة على المبيعات والتكاليف والربحية لكل مصنع.</p></div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={() => exportCostSummaryCsv({ financeSummary, procurementCosts, workOrderRows: filteredWorkOrders, inventoryRows: filteredInventory })}>Export CSV</button>
                <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={() => exportCostingPdf({ financeSummary, workOrderRows: filteredWorkOrders, inventoryRows: filteredInventory })}>Export PDF</button>
              </div>
            </div>
            <div className="erp-table-shell" style={{ overflowX: "auto", marginTop: "16px", border: "1px solid var(--rp-border)", borderRadius: "16px" }}>
              <table className="erp-table" style={{ minWidth: "800px" }}>
                <thead>
                  <tr>
                    <th style={compactTableHeaderStyle}>المصنع</th>
                    <th style={compactTableHeaderStyle}>فواتير المبيعات</th>
                    <th style={compactTableHeaderStyle}>صافي المبيعات</th>
                    <th style={compactTableHeaderStyle}>تكلفة التوريد</th>
                    <th style={compactTableHeaderStyle}>المرتبات</th>
                    <th style={compactTableHeaderStyle}>الربح الإجمالي</th>
                    <th style={compactTableHeaderStyle}>الربح التشغيلي</th>
                  </tr>
                </thead>
                <tbody>
                  {procurementCosts.length === 0 ? (
                    <tr><td colSpan="7" style={compactCellStyle}>لا توجد بيانات حالياً.</td></tr>
                  ) : (
                    procurementCosts.map((row, idx) => (
                      <tr key={idx}>
                        <td style={{ ...compactCellStyle, fontWeight: 700 }}>{row.factory_name || `مصنع #${row.factory_id}`}</td>
                        <td style={compactCellStyle}>{formatAmount(row.sales_total)}</td>
                        <td style={{ ...compactCellStyle, fontWeight: 700 }}>{formatAmount(row.net_sales_total)}</td>
                        <td style={compactCellStyle}>{formatAmount(row.procurement_cost_total)}</td>
                        <td style={compactCellStyle}>{formatAmount(row.payroll_total)}</td>
                        <td style={{ ...compactCellStyle, fontWeight: 700, color: Number(row.estimated_gross_profit)>=0?"#16a34a":"#dc2626" }}>{formatAmount(row.estimated_gross_profit)}</td>
                        <td style={{ ...compactCellStyle, fontWeight: 900, color: Number(row.estimated_operating_profit)>=0?"#16a34a":"#dc2626" }}>{formatAmount(row.estimated_operating_profit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === "workOrders" && (
          <div className="erp-section-card" style={{ marginBottom: "18px" }}>
            <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px" }}>
              <div style={{ textAlign: "right" }}><h3>تكلفة أوامر العمل</h3><p>تقدير التكلفة بناءً على الدقائق الفعلية وتخصيص المواد والعمالة.</p></div>
              <div style={{ display: "grid", gap: "10px", width: "100%" }}>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  <input className="erp-input" style={{ ...compactControlStyle, flex: "1 1 260px" }} placeholder="ابحث برقم الأمر أو العميل..." value={workOrderSearch} onChange={(e) => setWorkOrderSearch(e.target.value)} />
                  <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 150px" }} value={workOrderStatusFilter} onChange={(e) => setWorkOrderStatusFilter(e.target.value)}>
                    <option value="all">كل الحالات</option>
                    <option value="pending">قيد الانتظار</option>
                    <option value="materials_allocated">تم تخصيص الخامات</option>
                    <option value="manufacturing_started">بدأ التصنيع</option>
                    <option value="assembly">التجميع</option>
                    <option value="quality_control">مراجعة الجودة</option>
                    <option value="packaging">التعبئة</option>
                    <option value="completed">مكتمل</option>
                    <option value="cancelled">ملغي</option>
                  </select>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <div className="erp-mini-note">تكلفة المواد: {formatAmount(totalMaterialsCost)} | تكلفة العمالة: {formatAmount(totalLaborCost)}</div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={() => exportCostingWorkOrdersCsv(filteredWorkOrders)}>Export CSV</button>
                    <select className="erp-input" style={{ ...compactControlStyle, width: "96px" }} value={workOrderPageSize} onChange={(e) => setWorkOrderPageSize(Number(e.target.value))}>
                      {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="erp-table-shell" style={{ overflowX: "auto", marginTop: "16px", border: "1px solid var(--rp-border)", borderRadius: "16px" }}>
              <table className="erp-table" style={{ minWidth: "1100px" }}>
                <thead>
                  <tr>
                    <th style={compactTableHeaderStyle}>رقم الأمر</th>
                    <th style={compactTableHeaderStyle}>الطلب</th>
                    <th style={compactTableHeaderStyle}>العميل</th>
                    <th style={compactTableHeaderStyle}>الحالة</th>
                    <th style={compactTableHeaderStyle}>الدقائق الفعلية</th>
                    <th style={compactTableHeaderStyle}>التقدم</th>
                    <th style={compactTableHeaderStyle}>تكلفة المواد</th>
                    <th style={compactTableHeaderStyle}>تكلفة العمالة</th>
                    <th style={compactTableHeaderStyle}>الإجمالي</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedWorkOrders.length === 0 ? <tr><td colSpan="9" style={compactCellStyle}>لا توجد أوامر مطابقة.</td></tr> : pagedWorkOrders.map((row) => (
                    <tr key={row.id}>
                      <td style={{ ...compactCellStyle, fontWeight: 700 }}>{row.order_number || `WO#${row.id}`}</td>
                      <td style={compactCellStyle}>{row.order_id || "-"}</td>
                      <td style={compactCellStyle}>{row.customer_name || "-"}</td>
                      <td style={compactCellStyle}>{row.status || "-"}</td>
                      <td style={compactCellStyle}>{formatAmount(row.actual_minutes || 0)}</td>
                      <td style={compactCellStyle}>{formatAmount(row.progress_percent || 0)}%</td>
                      <td style={compactCellStyle}>{formatAmount(row.estimated_materials_cost || 0)}</td>
                      <td style={compactCellStyle}>{formatAmount(row.estimated_labor_cost || 0)}</td>
                      <td style={{ ...compactCellStyle, fontWeight: 700 }}>{formatAmount((row.estimated_materials_cost||0)+(row.estimated_labor_cost||0))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", flexWrap: "wrap", gap: "12px" }}>
              <div className="erp-mini-note">صفحة {workOrderPage} من {workOrderTotalPages}</div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setWorkOrderPage(1)} disabled={workOrderPage===1}>الأولى</button>
                <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setWorkOrderPage(p=>Math.max(1,p-1))} disabled={workOrderPage===1}>السابقة</button>
                <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setWorkOrderPage(p=>Math.min(workOrderTotalPages,p+1))} disabled={workOrderPage===workOrderTotalPages}>التالية</button>
                <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setWorkOrderPage(workOrderTotalPages)} disabled={workOrderPage===workOrderTotalPages}>الأخيرة</button>
              </div>
            </div>
          </div>
        )}

        {activeTab === "inventory" && (
          <div className="erp-section-card" style={{ marginBottom: "18px" }}>
            <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px" }}>
              <div style={{ textAlign: "right" }}><h3>تقييم المخزون التقريبي</h3><p>تقدير قيمة المخزون الحالي بناءً على متوسط التكلفة.</p></div>
              <div style={{ display: "grid", gap: "10px", width: "100%" }}>
                <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                  <input className="erp-input" style={{ ...compactControlStyle, flex: "1 1 260px" }} placeholder="ابحث بالمنتج أو SKU..." value={inventorySearch} onChange={(e) => setInventorySearch(e.target.value)} />
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                  <div className="erp-mini-note">إجمالي قيمة المخزون: {formatAmount(totalInventoryValue)}</div>
                  <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                    <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={() => exportCostingInventoryCsv(filteredInventory)}>Export CSV</button>
                    <select className="erp-input" style={{ ...compactControlStyle, width: "96px" }} value={inventoryPageSize} onChange={(e) => setInventoryPageSize(Number(e.target.value))}>
                      {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                    </select>
                  </div>
                </div>
              </div>
            </div>
            <div className="erp-table-shell" style={{ overflowX: "auto", marginTop: "16px", border: "1px solid var(--rp-border)", borderRadius: "16px" }}>
              <table className="erp-table" style={{ minWidth: "800px" }}>
                <thead>
                  <tr>
                    <th style={compactTableHeaderStyle}>المنتج</th>
                    <th style={compactTableHeaderStyle}>SKU</th>
                    <th style={compactTableHeaderStyle}>الفئة</th>
                    <th style={compactTableHeaderStyle}>الكمية المتاحة</th>
                    <th style={compactTableHeaderStyle}>متوسط التكلفة</th>
                    <th style={compactTableHeaderStyle}>القيمة التقديرية</th>
                  </tr>
                </thead>
                <tbody>
                  {pagedInventory.length === 0 ? <tr><td colSpan="6" style={compactCellStyle}>لا توجد بيانات.</td></tr> : pagedInventory.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ ...compactCellStyle, fontWeight: 700 }}>{row.product_name || "-"}</td>
                      <td style={compactCellStyle}>{row.sku || "-"}</td>
                      <td style={compactCellStyle}>{row.category_name || "-"}</td>
                      <td style={{ ...compactCellStyle, fontWeight: 700 }}>{formatAmount(row.current_stock || 0)}</td>
                      <td style={compactCellStyle}>{formatAmount(row.avg_unit_cost || 0)}</td>
                      <td style={{ ...compactCellStyle, fontWeight: 700, color: "#16a34a" }}>{formatAmount(row.estimated_value || 0)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "14px", flexWrap: "wrap", gap: "12px" }}>
              <div className="erp-mini-note">صفحة {inventoryPage} من {inventoryTotalPages}</div>
              <div style={{ display: "flex", gap: "8px" }}>
                <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setInventoryPage(1)} disabled={inventoryPage===1}>الأولى</button>
                <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setInventoryPage(p=>Math.max(1,p-1))} disabled={inventoryPage===1}>السابقة</button>
                <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setInventoryPage(p=>Math.min(inventoryTotalPages,p+1))} disabled={inventoryPage===inventoryTotalPages}>التالية</button>
                <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setInventoryPage(inventoryTotalPages)} disabled={inventoryPage===inventoryTotalPages}>الأخيرة</button>
              </div>
            </div>
          </div>
        )}

      </section>
    </main>
  );
}
