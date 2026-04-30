"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const FINANCE_SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/finance/summary";
const FACTORY_PROFITABILITY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/finance/factory-profitability";
const RECENT_ORDERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/finance/recent-orders";
const SUPPLIER_PAYABLES_SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/supplier-payables-summary";
const SUPPLIER_AGING_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/supplier-aging";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function companyName() { return "Royal Palace Group"; }
function companyLogoUrl() { return "https://royalpalace-group.com/brand/logo.png"; }

function paymentStatusLabel(value) {
  const map = {
    pending: "معلق", partially_paid: "مدفوع جزئياً", paid: "مدفوع بالكامل",
    failed: "فشل", refunded: "مسترجع", partially_refunded: "مسترجع جزئياً", cod: "الدفع عند الاستلام",
  };
  return map[value] || value || "-";
}

function orderStatusLabel(value) {
  const map = {
    order_received: "تم استلام الطلب", pending: "قيد الانتظار", confirmed: "مؤكد",
    materials_allocated: "تم تخصيص الخامات", manufacturing_started: "بدأ التصنيع",
    assembly: "التجميع", quality_control: "مراجعة الجودة", packaging: "التعبئة",
    delivery_dispatched: "تم الشحن", delivered: "تم التسليم", cancelled: "ملغي",
  };
  return map[value] || value || "-";
}

function paymentTone(value) {
  if (value === "paid") return "success";
  if (value === "partially_paid" || value === "partially_refunded") return "warning";
  return "";
}

function exportProfitabilityCsv(rows) {
  const headers = ["Factory","Sales Invoices Total","Collected Revenue","Outstanding Receivables","Credit Notes Total","Refunds Total","Net Sales Total","Supplier Invoices Total","Supplier Remaining Total","Procurement Cost Total","Payroll Total","Estimated Gross Profit","Estimated Operating Profit"];
  const escapeCsv = (v) => { const s = String(v ?? ""); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g,'""')}"` : s; };
  const lines = rows.map((row) => [row.factory_name||"",row.sales_total||0,row.sales_collected_total||0,row.sales_remaining_total||0,row.credit_notes_total||0,row.refunds_total||0,row.net_sales_total||0,row.supplier_invoices_total||0,row.supplier_remaining_total||0,row.procurement_cost_total||0,row.payroll_total||0,row.estimated_gross_profit||0,row.estimated_operating_profit||0].map(escapeCsv).join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "finance_factory_profitability.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
}

function exportOrdersCsv(rows) {
  const headers = ["Order Number","Factory","Order Status","Payment Status","Total Amount","Customer"];
  const escapeCsv = (v) => { const s = String(v ?? ""); return (s.includes(",") || s.includes('"') || s.includes("\n")) ? `"${s.replace(/"/g,'""')}"` : s; };
  const lines = rows.map((row) => [row.order_number||"",row.factory_name||row.factory_id||"",orderStatusLabel(row.status),paymentStatusLabel(row.payment_status),row.total_amount||0,row.customer_name||""].map(escapeCsv).join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "finance_recent_orders.csv";
  document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
}

function exportFinancePdf({ summary, payablesSummary, overdueAgingTotal, profitabilityRows, orderRows }) {
  const printWindow = window.open("", "_blank", "width=1280,height=900");
  if (!printWindow) return;

  const profitabilityHtml = (profitabilityRows || []).map((row) => `
    <tr>
      <td>${row.factory_name || "-"}</td>
      <td>${formatAmount(row.sales_total)}</td>
      <td>${formatAmount(row.sales_collected_total)}</td>
      <td>${formatAmount(row.sales_remaining_total)}</td>
      <td>${formatAmount(row.credit_notes_total)}</td>
      <td>${formatAmount(row.refunds_total)}</td>
      <td>${formatAmount(row.net_sales_total)}</td>
      <td>${formatAmount(row.supplier_invoices_total)}</td>
      <td>${formatAmount(row.supplier_remaining_total)}</td>
      <td>${formatAmount(row.procurement_cost_total)}</td>
      <td>${formatAmount(row.payroll_total)}</td>
      <td>${formatAmount(row.estimated_gross_profit)}</td>
      <td>${formatAmount(row.estimated_operating_profit)}</td>
    </tr>`).join("");

  const ordersHtml = (orderRows || []).map((row) => `
    <tr>
      <td>${row.order_number || "-"}</td>
      <td>${row.factory_name || `Factory #${row.factory_id || "-"}`}</td>
      <td>${orderStatusLabel(row.status)}</td>
      <td>${paymentStatusLabel(row.payment_status)}</td>
      <td>${formatAmount(row.total_amount)}</td>
      <td>${row.customer_name || "-"}</td>
    </tr>`).join("");

  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8"/>
  <title>Finance Operational Report</title>
  <style>
    * { box-sizing: border-box; }
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Arial, sans-serif; margin: 0; color: #0f172a; background: #fff; }
    .page-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .brand img { width: 56px; height: 56px; object-fit: contain; }
    .brand h1 { margin: 0; font-size: 22px; }
    .brand p { margin: 6px 0 0; color: #475569; font-size: 12px; }
    .summary { display: grid; grid-template-columns: repeat(5, minmax(0,1fr)); gap: 10px; margin-bottom: 18px; }
    .summary-card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; background: #f8fafc; }
    .summary-card .label { font-size: 11px; color: #64748b; margin-bottom: 6px; }
    .summary-card .value { font-size: 17px; font-weight: 800; color: #0f172a; }
    h2 { margin: 18px 0 10px; font-size: 18px; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
    th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; text-align: right; vertical-align: top; }
    thead th { background: #e2e8f0; font-weight: 800; }
    tbody tr:nth-child(even) { background: #f8fafc; }
  </style>
</head>
<body>
  <div class="page-header">
    <div class="brand">
      <img src="${companyLogoUrl()}" alt="logo"/>
      <div><h1>${companyName()}</h1><p>التقرير المالي التشغيلي</p></div>
    </div>
    <div>Finance Report</div>
  </div>
  <div class="summary">
    <div class="summary-card"><div class="label">إجمالي فواتير المبيعات</div><div class="value">${formatAmount(summary.sales_invoices_total)}</div></div>
    <div class="summary-card"><div class="label">الإشعارات الدائنة</div><div class="value">${formatAmount(summary.credit_notes_total)}</div></div>
    <div class="summary-card"><div class="label">الاستردادات</div><div class="value">${formatAmount(summary.refunds_total)}</div></div>
    <div class="summary-card"><div class="label">صافي المبيعات</div><div class="value">${formatAmount(summary.net_sales_total)}</div></div>
    <div class="summary-card"><div class="label">الذمم المدينة</div><div class="value">${formatAmount(summary.outstanding_receivables)}</div></div>
  </div>
  <div class="summary">
    <div class="summary-card"><div class="label">المحصل</div><div class="value">${formatAmount(summary.collected_revenue)}</div></div>
    <div class="summary-card"><div class="label">فواتير الموردين</div><div class="value">${formatAmount(payablesSummary?.invoices_total || 0)}</div></div>
    <div class="summary-card"><div class="label">المتبقي للموردين</div><div class="value">${formatAmount(payablesSummary?.remaining_total || 0)}</div></div>
    <div class="summary-card"><div class="label">المتأخر للموردين</div><div class="value">${formatAmount(overdueAgingTotal)}</div></div>
    <div class="summary-card"><div class="label">الربح التشغيلي</div><div class="value">${formatAmount(summary.estimated_operating_profit)}</div></div>
  </div>
  <h2>ربحية المصانع</h2>
  <table>
    <thead>
      <tr><th>المصنع</th><th>فواتير المبيعات</th><th>المحصل</th><th>الذمم المدينة</th><th>الإشعارات الدائنة</th><th>الاستردادات</th><th>صافي المبيعات</th><th>فواتير الموردين</th><th>المتبقي للموردين</th><th>تكلفة التوريد</th><th>المرتبات</th><th>الربح الإجمالي</th><th>الربح التشغيلي</th></tr>
    </thead>
    <tbody>${profitabilityHtml || `<tr><td colspan="13">لا توجد بيانات حالياً.</td></tr>`}</tbody>
  </table>
  <h2>أحدث الطلبات</h2>
  <table>
    <thead>
      <tr><th>الطلب</th><th>المصنع</th><th>الحالة</th><th>حالة الدفع</th><th>الإجمالي</th><th>العميل</th></tr>
    </thead>
    <tbody>${ordersHtml || `<tr><td colspan="6">لا توجد بيانات حالياً.</td></tr>`}</tbody>
  </table>
  <script>window.onload = function() { setTimeout(() => window.print(), 400); };</script>
</body>
</html>`;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

const compactControlStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 700, paddingInline: "12px" };
const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };
const compactTableHeaderStyle = { position: "sticky", top: 0, zIndex: 2, background: "#fff", boxShadow: "0 1px 0 rgba(15,23,42,0.06)", fontSize: "12px", padding: "10px 12px", whiteSpace: "nowrap" };
const compactCellStyle = { padding: "10px 12px", fontSize: "12px", verticalAlign: "middle" };
const paginationButtonStyle = { minWidth: "88px", minHeight: "38px", borderRadius: "12px", fontWeight: 800 };

export default function FinancePage() {
  const { user, ready } = useAdminAuth("finance");
  const [summaryPayload, setSummaryPayload] = useState(null);
  const [profitability, setProfitability] = useState([]);
  const [recentOrders, setRecentOrders] = useState([]);
  const [payablesSummary, setPayablesSummary] = useState(null);
  const [supplierAging, setSupplierAging] = useState([]);
  const [message, setMessage] = useState("");
  const [factorySearch, setFactorySearch] = useState("");
  const [factorySortBy, setFactorySortBy] = useState("operating_profit_desc");
  const [factoryPageSize, setFactoryPageSize] = useState(20);
  const [factoryPage, setFactoryPage] = useState(1);
  const [ordersSearch, setOrdersSearch] = useState("");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [orderStatusFilter, setOrderStatusFilter] = useState("all");
  const [ordersPageSize, setOrdersPageSize] = useState(20);
  const [ordersPage, setOrdersPage] = useState(1);

  async function loadAll() {
    const [summaryRes, profitabilityRes, recentOrdersRes, payablesRes, agingRes] = await Promise.all([
      fetch(FINANCE_SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(FACTORY_PROFITABILITY_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(RECENT_ORDERS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(SUPPLIER_PAYABLES_SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(SUPPLIER_AGING_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);
    const summaryData = await summaryRes.json().catch(() => ({}));
    const profitabilityData = await profitabilityRes.json().catch(() => []);
    const recentOrdersData = await recentOrdersRes.json().catch(() => []);
    const payablesData = await payablesRes.json().catch(() => ({}));
    const agingData = await agingRes.json().catch(() => []);
    if (!summaryRes.ok) throw new Error(summaryData.detail || "فشل تحميل الملخص المالي");
    setSummaryPayload(summaryData);
    setProfitability(Array.isArray(profitabilityData) ? profitabilityData : []);
    setRecentOrders(Array.isArray(recentOrdersData) ? recentOrdersData : []);
    setPayablesSummary(payablesData || null);
    setSupplierAging(Array.isArray(agingData) ? agingData : []);
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء التحميل"));
  }, [ready, user]);

  useEffect(() => { setFactoryPage(1); }, [factorySearch, factorySortBy, factoryPageSize]);
  useEffect(() => { setOrdersPage(1); }, [ordersSearch, paymentFilter, orderStatusFilter, ordersPageSize]);

  const summary = summaryPayload?.summary || {};

  const overdueAgingTotal = useMemo(() => {
    return supplierAging.reduce((sum, item) =>
      sum + Number(item.days_1_30||0) + Number(item.days_31_60||0) + Number(item.days_61_90||0) + Number(item.days_90_plus||0), 0);
  }, [supplierAging]);

  const filteredProfitability = useMemo(() => {
    const q = normalizeText(factorySearch);
    let rows = [...profitability];
    if (q) rows = rows.filter((row) => [row.factory_name, row.factory_id].join(" ").toLowerCase().includes(q));
    rows.sort((a, b) => {
      if (factorySortBy === "name") return String(a.factory_name || "").localeCompare(String(b.factory_name || ""), "ar");
      if (factorySortBy === "sales_desc") return Number(b.net_sales_total||0) - Number(a.net_sales_total||0);
      if (factorySortBy === "gross_profit_desc") return Number(b.estimated_gross_profit||0) - Number(a.estimated_gross_profit||0);
      return Number(b.estimated_operating_profit||0) - Number(a.estimated_operating_profit||0);
    });
    return rows;
  }, [profitability, factorySearch, factorySortBy]);

  const pagedProfitability = useMemo(() => {
    const start = (factoryPage - 1) * factoryPageSize;
    return filteredProfitability.slice(start, start + factoryPageSize);
  }, [filteredProfitability, factoryPage, factoryPageSize]);

  const factoryTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredProfitability.length / factoryPageSize)), [filteredProfitability.length, factoryPageSize]);

  const filteredOrders = useMemo(() => {
    const q = normalizeText(ordersSearch);
    let rows = [...recentOrders];
    rows = rows.filter((row) => {
      if (paymentFilter !== "all" && String(row.payment_status || "") !== paymentFilter) return false;
      if (orderStatusFilter !== "all" && String(row.status || "") !== orderStatusFilter) return false;
      if (!q) return true;
      return [row.order_number, row.factory_name, row.factory_id, row.status, row.payment_status, row.customer_name].join(" ").toLowerCase().includes(q);
    });
    return rows;
  }, [recentOrders, ordersSearch, paymentFilter, orderStatusFilter]);

  const pagedOrders = useMemo(() => {
    const start = (ordersPage - 1) * ordersPageSize;
    return filteredOrders.slice(start, start + ordersPageSize);
  }, [filteredOrders, ordersPage, ordersPageSize]);

  const ordersTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredOrders.length / ordersPageSize)), [filteredOrders.length, ordersPageSize]);

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل المالية...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">

        <header className="erp-workspace-topbar">
          <div className="erp-workspace-title-wrap">
            <div className="erp-page-eyebrow">Finance Workspace</div>
            <h1 className="erp-page-title">الملخص المالي التشغيلي</h1>
            <p className="erp-page-subtitle">متابعة موحدة للمبيعات الصافية والذمم المدينة وربحية المصانع وربطها بذمم الموردين وأحدث الطلبات.</p>
          </div>
          <div className="erp-topbar-actions">
            <div className="erp-topbar-chip">صافي المبيعات: {formatAmount(summary.net_sales_total)}</div>
            <div className="erp-topbar-chip">الذمم المدينة: {formatAmount(summary.outstanding_receivables)}</div>
            <div className="erp-topbar-chip">المتأخر للموردين: {formatAmount(overdueAgingTotal)}</div>
          </div>
        </header>

        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">المالية</div>
            <h2>نظرة مالية مؤسسية</h2>
            <p>عرض مالي موحد مبني على فواتير المبيعات، الإشعارات الدائنة، الاستردادات، المشتريات، والمرتبات ضمن انضباط مؤسسي واحد.</p>
            <div className="erp-hero-actions">
              <div className="erp-hero-pill">فواتير المبيعات: {formatAmount(summary.sales_invoices_total)}</div>
              <div className="erp-hero-pill">الإشعارات الدائنة: {formatAmount(summary.credit_notes_total)}</div>
              <div className="erp-hero-pill">الاستردادات: {formatAmount(summary.refunds_total)}</div>
              <div className="erp-hero-pill">صافي المبيعات: {formatAmount(summary.net_sales_total)}</div>
            </div>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">الربح التشغيلي التقديري</div>
              <div className="erp-stat-box-value">{formatAmount(summary.estimated_operating_profit)}</div>
            </div>
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">الذمم المدينة</div>
              <div className="erp-stat-box-value">{formatAmount(summary.outstanding_receivables)}</div>
            </div>
            <div className="erp-hero-visual" />
          </div>
        </section>

        {message ? <div className="erp-form-message">{message}</div> : null}

        <section className="erp-kpi-grid" style={{ marginBottom: "16px" }}>
          <div className="erp-card"><div className="erp-card-title">فواتير المبيعات</div><div className="erp-card-value">{formatAmount(summary.sales_invoices_total)}</div><div className="erp-card-note">إجمالي الفواتير المُصدرة</div></div>
          <div className="erp-card"><div className="erp-card-title">صافي المبيعات</div><div className="erp-card-value">{formatAmount(summary.net_sales_total)}</div><div className="erp-card-note">بعد الإشعارات والاستردادات</div></div>
          <div className="erp-card"><div className="erp-card-title">المحصّل</div><div className="erp-card-value">{formatAmount(summary.collected_revenue)}</div><div className="erp-card-note">إجمالي المبالغ المحصّلة</div></div>
          <div className="erp-card"><div className="erp-card-title">الذمم المدينة</div><div className="erp-card-value">{formatAmount(summary.outstanding_receivables)}</div><div className="erp-card-note">مستحق من العملاء</div></div>
          <div className="erp-card"><div className="erp-card-title">فواتير الموردين</div><div className="erp-card-value">{formatAmount(payablesSummary?.invoices_total || 0)}</div><div className="erp-card-note">إجمالي فواتير الموردين</div></div>
          <div className="erp-card"><div className="erp-card-title">المتأخر للموردين</div><div className="erp-card-value">{formatAmount(overdueAgingTotal)}</div><div className="erp-card-note">متأخرات الذمم الدائنة</div></div>
          <div className="erp-card"><div className="erp-card-title">الربح الإجمالي</div><div className="erp-card-value">{formatAmount(summary.estimated_gross_profit)}</div><div className="erp-card-note">صافي المبيعات - تكلفة التوريد</div></div>
          <div className="erp-card"><div className="erp-card-title">الربح التشغيلي</div><div className="erp-card-value">{formatAmount(summary.estimated_operating_profit)}</div><div className="erp-card-note">بعد خصم المرتبات</div></div>
        </section>

        {/* جدول ربحية المصانع */}
        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ margin: 0 }}>ربحية المصانع</h3>
              <p style={{ margin: "6px 0 0" }}>مقارنة المبيعات والتكاليف والربحية لكل مصنع</p>
            </div>
            <div style={{ display: "grid", gap: "10px", width: "100%" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input className="erp-input" style={{ ...compactControlStyle, flex: "1 1 260px", minWidth: "220px" }} placeholder="ابحث بالمصنع..." value={factorySearch} onChange={(e) => setFactorySearch(e.target.value)} />
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 180px" }} value={factorySortBy} onChange={(e) => setFactorySortBy(e.target.value)}>
                  <option value="operating_profit_desc">الربح التشغيلي: الأعلى</option>
                  <option value="gross_profit_desc">الربح الإجمالي: الأعلى</option>
                  <option value="sales_desc">المبيعات: الأعلى</option>
                  <option value="name">الاسم</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={() => exportProfitabilityCsv(filteredProfitability)}>Export CSV</button>
                  <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={() => exportFinancePdf({ summary, payablesSummary, overdueAgingTotal, profitabilityRows: filteredProfitability, orderRows: filteredOrders })}>Export PDF</button>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className="erp-mini-note">عدد الصفوف</span>
                  <select className="erp-input" style={{ ...compactControlStyle, width: "96px" }} value={factoryPageSize} onChange={(e) => setFactoryPageSize(Number(e.target.value))}>
                    {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="erp-table-shell" style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "16px", maxHeight: "60vh", background: "var(--rp-surface)", marginTop: "16px" }}>
            <table className="erp-table" style={{ minWidth: "1400px" }}>
              <thead>
                <tr>
                  <th style={compactTableHeaderStyle}>المصنع</th>
                  <th style={compactTableHeaderStyle}>فواتير المبيعات</th>
                  <th style={compactTableHeaderStyle}>المحصّل</th>
                  <th style={compactTableHeaderStyle}>الذمم المدينة</th>
                  <th style={compactTableHeaderStyle}>الإشعارات الدائنة</th>
                  <th style={compactTableHeaderStyle}>الاستردادات</th>
                  <th style={compactTableHeaderStyle}>صافي المبيعات</th>
                  <th style={compactTableHeaderStyle}>فواتير الموردين</th>
                  <th style={compactTableHeaderStyle}>المتبقي للموردين</th>
                  <th style={compactTableHeaderStyle}>تكلفة التوريد</th>
                  <th style={compactTableHeaderStyle}>المرتبات</th>
                  <th style={compactTableHeaderStyle}>الربح الإجمالي</th>
                  <th style={compactTableHeaderStyle}>الربح التشغيلي</th>
                </tr>
              </thead>
              <tbody>
                {pagedProfitability.length === 0 ? (
                  <tr><td colSpan="13" style={compactCellStyle}>لا توجد بيانات ربحية حالياً.</td></tr>
                ) : (
                  pagedProfitability.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ ...compactCellStyle, fontWeight: 700 }}>{row.factory_name || `مصنع #${row.factory_id}`}</td>
                      <td style={compactCellStyle}>{formatAmount(row.sales_total)}</td>
                      <td style={compactCellStyle}>{formatAmount(row.sales_collected_total)}</td>
                      <td style={compactCellStyle}>{formatAmount(row.sales_remaining_total)}</td>
                      <td style={compactCellStyle}>{formatAmount(row.credit_notes_total)}</td>
                      <td style={compactCellStyle}>{formatAmount(row.refunds_total)}</td>
                      <td style={{ ...compactCellStyle, fontWeight: 700 }}>{formatAmount(row.net_sales_total)}</td>
                      <td style={compactCellStyle}>{formatAmount(row.supplier_invoices_total)}</td>
                      <td style={compactCellStyle}>{formatAmount(row.supplier_remaining_total)}</td>
                      <td style={compactCellStyle}>{formatAmount(row.procurement_cost_total)}</td>
                      <td style={compactCellStyle}>{formatAmount(row.payroll_total)}</td>
                      <td style={{ ...compactCellStyle, fontWeight: 700 }}>{formatAmount(row.estimated_gross_profit)}</td>
                      <td style={{ ...compactCellStyle, fontWeight: 900, color: Number(row.estimated_operating_profit) >= 0 ? "var(--rp-success, #16a34a)" : "#dc2626" }}>{formatAmount(row.estimated_operating_profit)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "14px" }}>
            <div className="erp-mini-note">صفحة {factoryPage} من {factoryTotalPages}</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setFactoryPage(1)} disabled={factoryPage === 1}>الأولى</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setFactoryPage((p) => Math.max(1, p - 1))} disabled={factoryPage === 1}>السابقة</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setFactoryPage((p) => Math.min(factoryTotalPages, p + 1))} disabled={factoryPage === factoryTotalPages}>التالية</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setFactoryPage(factoryTotalPages)} disabled={factoryPage === factoryTotalPages}>الأخيرة</button>
            </div>
          </div>
        </div>

        {/* جدول أحدث الطلبات */}
        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ margin: 0 }}>أحدث الطلبات</h3>
              <p style={{ margin: "6px 0 0" }}>آخر الطلبات التشغيلية مع حالة الدفع والمصنع</p>
            </div>
            <div style={{ display: "grid", gap: "10px", width: "100%" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input className="erp-input" style={{ ...compactControlStyle, flex: "1 1 260px", minWidth: "220px" }} placeholder="ابحث برقم الطلب أو العميل..." value={ordersSearch} onChange={(e) => setOrdersSearch(e.target.value)} />
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 160px" }} value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                  <option value="all">كل حالات الدفع</option>
                  <option value="pending">معلق</option>
                  <option value="partially_paid">مدفوع جزئياً</option>
                  <option value="paid">مدفوع بالكامل</option>
                  <option value="cod">الدفع عند الاستلام</option>
                </select>
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 160px" }} value={orderStatusFilter} onChange={(e) => setOrderStatusFilter(e.target.value)}>
                  <option value="all">كل حالات الطلب</option>
                  <option value="order_received">تم استلام الطلب</option>
                  <option value="confirmed">مؤكد</option>
                  <option value="manufacturing_started">بدأ التصنيع</option>
                  <option value="delivery_dispatched">تم الشحن</option>
                  <option value="delivered">تم التسليم</option>
                  <option value="cancelled">ملغي</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={() => exportOrdersCsv(filteredOrders)}>Export CSV</button>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className="erp-mini-note">عدد الصفوف</span>
                  <select className="erp-input" style={{ ...compactControlStyle, width: "96px" }} value={ordersPageSize} onChange={(e) => setOrdersPageSize(Number(e.target.value))}>
                    {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="erp-table-shell" style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "16px", maxHeight: "60vh", background: "var(--rp-surface)", marginTop: "16px" }}>
            <table className="erp-table" style={{ minWidth: "900px" }}>
              <thead>
                <tr>
                  <th style={compactTableHeaderStyle}>رقم الطلب</th>
                  <th style={compactTableHeaderStyle}>المصنع</th>
                  <th style={compactTableHeaderStyle}>العميل</th>
                  <th style={compactTableHeaderStyle}>حالة الطلب</th>
                  <th style={compactTableHeaderStyle}>حالة الدفع</th>
                  <th style={compactTableHeaderStyle}>الإجمالي</th>
                </tr>
              </thead>
              <tbody>
                {pagedOrders.length === 0 ? (
                  <tr><td colSpan="6" style={compactCellStyle}>لا توجد طلبات مطابقة.</td></tr>
                ) : (
                  pagedOrders.map((row, idx) => (
                    <tr key={idx}>
                      <td style={{ ...compactCellStyle, fontWeight: 700 }}>{row.order_number || "-"}</td>
                      <td style={compactCellStyle}>{row.factory_name || `مصنع #${row.factory_id || "-"}`}</td>
                      <td style={compactCellStyle}>{row.customer_name || "-"}</td>
                      <td style={compactCellStyle}>{orderStatusLabel(row.status)}</td>
                      <td style={compactCellStyle}><span className={`erp-badge ${paymentTone(row.payment_status)}`}>{paymentStatusLabel(row.payment_status)}</span></td>
                      <td style={{ ...compactCellStyle, fontWeight: 700 }}>{formatAmount(row.total_amount)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "14px" }}>
            <div className="erp-mini-note">صفحة {ordersPage} من {ordersTotalPages} — إجمالي: {filteredOrders.length} طلب</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setOrdersPage(1)} disabled={ordersPage === 1}>الأولى</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setOrdersPage((p) => Math.max(1, p - 1))} disabled={ordersPage === 1}>السابقة</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setOrdersPage((p) => Math.min(ordersTotalPages, p + 1))} disabled={ordersPage === ordersTotalPages}>التالية</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setOrdersPage(ordersTotalPages)} disabled={ordersPage === ordersTotalPages}>الأخيرة</button>
            </div>
          </div>
        </div>

      </section>
    </main>
  );
}
