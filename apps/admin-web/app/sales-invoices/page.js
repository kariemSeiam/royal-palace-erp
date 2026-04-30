"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { hasPermission } from "../components/access";

const SALES_INVOICES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/sales-invoices";
const SALES_INVOICES_SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/sales-invoices/summary";
const SALES_INVOICES_RETURNS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/sales-invoices/returns";
const SALES_INVOICES_RETURNS_SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/sales-invoices/returns/summary";
const SALES_INVOICES_CUSTOMER_STATEMENT_API_URL = "https://api.royalpalace-group.com/api/v1/admin/sales-invoices/customer-statement";
const ORDERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/orders";
const SALES_POSTING_CHECK_API_URL = "https://api.royalpalace-group.com/api/v1/admin/accounting/postings/source-check";
const SALES_INVOICE_POSTING_API_PREFIX = "https://api.royalpalace-group.com/api/v1/admin/accounting/postings/sales-invoices";
const SALES_RETURN_POSTING_API_PREFIX = "https://api.royalpalace-group.com/api/v1/admin/accounting/postings/sales-returns";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

const compactControlStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 700, paddingInline: "12px" };
const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };
const compactTableHeaderStyle = { position: "sticky", top: 0, zIndex: 2, background: "#fff", boxShadow: "0 1px 0 rgba(15, 23, 42, 0.06)", fontSize: "12px", padding: "10px 12px", whiteSpace: "nowrap" };
const compactCellStyle = { padding: "10px 12px", fontSize: "12px", verticalAlign: "middle" };
const paginationButtonStyle = { minWidth: "88px", minHeight: "38px", borderRadius: "12px", fontWeight: 800 };
const AUDIT_ENTITY_HISTORY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/audit/entity-history";

function formatHistoryDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB");
}
function normalizeText(value) { return String(value || "").trim().toLowerCase(); }
function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-GB");
}
function invoiceStatusLabel(value) {
  const map = { issued: "صادرة", paid: "مدفوعة", cancelled: "ملغاة", partially_refunded: "مردود جزئياً", refunded: "مردودة بالكامل" };
  return map[value] || value || "-";
}
function paymentStatusLabel(value) {
  const map = { pending: "معلق", paid: "مدفوع", failed: "فشل", refunded: "مسترجع", partially_refunded: "مسترجع جزئياً", cod: "الدفع عند الاستلام" };
  return map[value] || value || "-";
}
function returnTypeLabel(value) { return value === "refund" ? "استرداد" : value === "credit_note" ? "إشعار دائن" : value || "-"; }
function returnStatusLabel(value) {
  const map = { issued: "صادر", refunded: "مسترد", cancelled: "ملغي" };
  return map[value] || value || "-";
}
function badgeTone(value) {
  if (value === "paid" || value === "refunded") return "success";
  if (value === "cancelled" || value === "failed") return "warning";
  if (value === "partially_refunded") return "warning";
  return "warning";
}
function postingStatusLabel(value) {
  if (value === "posted") return "مقيد محاسبيًا";
  if (value === "ready") return "جاهز للترحيل";
  if (value === "error") return "خطأ";
  return "غير مفحوص";
}
function postingStatusTone(value) {
  if (value === "posted") return "success";
  if (value === "ready") return "warning";
  if (value === "error") return "danger";
  return "";
}
function getEligibilityReason(order) {
  if (!order?.id) return "الطلب غير صالح.";
  if (order?.is_master_order) return "لا يمكن إصدار فاتورة على الطلب الرئيسي المجمع.";
  if (!order?.factory_id) return "الطلب يحتاج مصنعًا محددًا.";
  if (order?.sales_invoice_id) return `الفاتورة موجودة بالفعل: ${order.sales_invoice_number}`;
  if (!["delivery_dispatched", "delivered"].includes(String(order?.status || ""))) return "إصدار الفاتورة يتطلب شحن الطلب أو تسليمه.";
  if (!order?.delivery_number) return "إصدار الفاتورة يتطلب إذن تسليم.";
  return "";
}

export default function SalesInvoicesPage() {
  const { user, ready } = useAdminAuth("orders");
  const canPostAccounting = useMemo(() => hasPermission(user, "finance.manage"), [user]);
  const [summary, setSummary] = useState({});
  const [returnsSummary, setReturnsSummary] = useState({});
  const [invoices, setInvoices] = useState([]);
  const [returnsRows, setReturnsRows] = useState([]);
  const [orders, setOrders] = useState([]);
  const [statementPayload, setStatementPayload] = useState(null);
  const [statementSearch, setStatementSearch] = useState("");
  const [message, setMessage] = useState("");
  const [historyEntityId, setHistoryEntityId] = useState("");
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [customerSearch, setCustomerSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [receivableFilter, setReceivableFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const [createOrderId, setCreateOrderId] = useState("");
  const [createNotes, setCreateNotes] = useState("");
  const [createBillingAddress, setCreateBillingAddress] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [returnModal, setReturnModal] = useState({ open: false, invoiceId: "", returnType: "credit_note", amount: "", reason: "", notes: "" });
  const [invoicePostingMap, setInvoicePostingMap] = useState({});
  const [returnPostingMap, setReturnPostingMap] = useState({});

  async function loadAll() {
    const [summaryRes, returnsSummaryRes, invoicesRes, returnsRes, ordersRes] = await Promise.all([
      fetch(SALES_INVOICES_SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(SALES_INVOICES_RETURNS_SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(SALES_INVOICES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(SALES_INVOICES_RETURNS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(ORDERS_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);
    const summaryData = await summaryRes.json().catch(() => ({}));
    const returnsSummaryData = await returnsSummaryRes.json().catch(() => ({}));
    const invoicesData = await invoicesRes.json().catch(() => []);
    const returnsData = await returnsRes.json().catch(() => []);
    const ordersData = await ordersRes.json().catch(() => []);
    if (!summaryRes.ok) throw new Error(summaryData.detail || "فشل تحميل ملخص الفواتير");
    if (!returnsSummaryRes.ok) throw new Error(returnsSummaryData.detail || "فشل تحميل ملخص القيود العكسية");
    if (!invoicesRes.ok) throw new Error(invoicesData.detail || "فشل تحميل فواتير المبيعات");
    if (!returnsRes.ok) throw new Error(returnsData.detail || "فشل تحميل الإشعارات الدائنة والاستردادات");
    if (!ordersRes.ok) throw new Error(ordersData.detail || "فشل تحميل الطلبات");
    setSummary(summaryData || {});
    setReturnsSummary(returnsSummaryData || {});
    setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
    setReturnsRows(Array.isArray(returnsData) ? returnsData : []);
    setOrders(Array.isArray(ordersData) ? ordersData : []);
  }

  useEffect(() => { if (!ready || !user) return; loadAll().catch((err) => setMessage(err?.message || "حدث خطأ أثناء التحميل")); }, [ready, user]);
  useEffect(() => { setPage(1); }, [customerSearch, statusFilter, paymentFilter, factoryFilter, receivableFilter, sortBy, pageSize]);

  const invoicesByOrderId = useMemo(() => { const map = new Map(); invoices.forEach((item) => map.set(Number(item.order_id), item)); return map; }, [invoices]);
  const candidateOrders = useMemo(() => orders.map((order) => ({ ...order, sales_invoice_id: invoicesByOrderId.get(Number(order.id))?.id || null, sales_invoice_number: invoicesByOrderId.get(Number(order.id))?.invoice_number || "" })).filter((order) => !getEligibilityReason(order)), [orders, invoicesByOrderId]);
  const invoiceCandidatesWithReasons = useMemo(() => orders.map((order) => ({ ...order, sales_invoice_id: invoicesByOrderId.get(Number(order.id))?.id || null, sales_invoice_number: invoicesByOrderId.get(Number(order.id))?.invoice_number || "", eligibility_reason: getEligibilityReason({ ...order, sales_invoice_id: invoicesByOrderId.get(Number(order.id))?.id || null, sales_invoice_number: invoicesByOrderId.get(Number(order.id))?.invoice_number || "" }) })).filter((order) => order.eligibility_reason), [orders, invoicesByOrderId]);
  const factoryOptions = useMemo(() => { const map = new Map(); invoices.forEach((item) => { if (item.factory_id) map.set(String(item.factory_id), item.factory_name || `مصنع #${item.factory_id}`); }); return Array.from(map.entries()).map(([value, label]) => ({ value, label })); }, [invoices]);
  const eligibleInvoicesForReturn = useMemo(() => invoices.filter((row) => Number(row.net_invoice_amount || row.total_amount || 0) > 0 && String(row.status || "") !== "cancelled"), [invoices]);
  const filteredInvoices = useMemo(() => {
    const q = normalizeText(customerSearch);
    const list = [...invoices].filter((row) => {
      if (statusFilter !== "all" && String(row.status || "") !== statusFilter) return false;
      if (paymentFilter !== "all" && String(row.payment_status || "") !== paymentFilter) return false;
      if (factoryFilter !== "all" && String(row.factory_id || "") !== factoryFilter) return false;
      const remainingAmount = Number(row.remaining_amount || 0);
      if (receivableFilter === "open" && remainingAmount <= 0) return false;
      if (receivableFilter === "closed" && remainingAmount > 0) return false;
      if (!q) return true;
      const haystack = [row.invoice_number, row.order_number, row.customer_name, row.customer_phone, row.factory_name, row.factory_id, row.status, row.payment_status, row.delivery_number, row.delivery_status].join(" ").toLowerCase();
      return haystack.includes(q);
    });
    list.sort((a, b) => {
      if (sortBy === "oldest") return Number(a.id || 0) - Number(b.id || 0);
      if (sortBy === "amount_desc") return Number(b.total_amount || 0) - Number(a.total_amount || 0);
      if (sortBy === "amount_asc") return Number(a.total_amount || 0) - Number(b.total_amount || 0);
      if (sortBy === "remaining_desc") return Number(b.remaining_amount || 0) - Number(a.remaining_amount || 0);
      if (sortBy === "customer") return String(a.customer_name || "").localeCompare(String(b.customer_name || ""), "ar");
      return Number(b.id || 0) - Number(a.id || 0);
    });
    return list;
  }, [invoices, customerSearch, statusFilter, paymentFilter, factoryFilter, receivableFilter, sortBy]);
  const pagedInvoices = useMemo(() => filteredInvoices.slice((page - 1) * pageSize, (page - 1) * pageSize + pageSize), [filteredInvoices, page, pageSize]);
  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredInvoices.length / pageSize)), [filteredInvoices.length, pageSize]);
  const tableSummary = useMemo(() => ({ start: filteredInvoices.length === 0 ? 0 : (page - 1) * pageSize + 1, end: Math.min(page * pageSize, filteredInvoices.length), total: filteredInvoices.length }), [filteredInvoices.length, page, pageSize]);

  async function checkPosting(sourceModule, sourceType, sourceId, target) {
    const mapSetter = target === "return" ? setReturnPostingMap : setInvoicePostingMap;
    const stateKey = `${sourceModule}:${sourceType}:${sourceId}`;
    setActionKey(`check:${stateKey}`);
    setMessage("");
    try {
      const res = await fetch(`${SALES_POSTING_CHECK_API_URL}?source_module=${encodeURIComponent(sourceModule)}&source_type=${encodeURIComponent(sourceType)}&source_id=${encodeURIComponent(sourceId)}`, { headers: authHeaders(), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل فحص حالة الترحيل");
      mapSetter((prev) => ({ ...prev, [stateKey]: { status: data.exists ? "posted" : "ready", entry_number: data.entry?.entry_number || "" } }));
      setMessage(data.exists ? "هذا المصدر مقيد محاسبيًا بالفعل." : "هذا المصدر جاهز للترحيل المحاسبي.");
    } catch (err) {
      mapSetter((prev) => ({ ...prev, [stateKey]: { status: "error", entry_number: "" } }));
      setMessage(err?.message || "حدث خطأ أثناء فحص حالة الترحيل");
    } finally { setActionKey(""); }
  }

  async function postSource(sourceModule, sourceType, sourceId, target) {
    const mapSetter = target === "return" ? setReturnPostingMap : setInvoicePostingMap;
    const stateKey = `${sourceModule}:${sourceType}:${sourceId}`;
    const prefix = target === "return" ? SALES_RETURN_POSTING_API_PREFIX : SALES_INVOICE_POSTING_API_PREFIX;
    setActionKey(`post:${stateKey}`);
    setMessage("");
    try {
      const res = await fetch(`${prefix}/${sourceId}`, { method: "POST", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل الترحيل المحاسبي");
      mapSetter((prev) => ({ ...prev, [stateKey]: { status: "posted", entry_number: data.entry_number || "" } }));
      setMessage("تم إنشاء القيد المحاسبي بنجاح.");
    } catch (err) {
      mapSetter((prev) => ({ ...prev, [stateKey]: { status: "error", entry_number: "" } }));
      setMessage(err?.message || "حدث خطأ أثناء الترحيل المحاسبي");
    } finally { setActionKey(""); }
  }

  async function handleCreateInvoice(e) {
    e.preventDefault();
    if (!createOrderId) { setMessage("اختر طلبًا مؤهلاً أولًا قبل إنشاء الفاتورة"); return; }
    setSubmitting(true); setMessage("");
    try {
      const res = await fetch(`${SALES_INVOICES_API_URL}/from-order/${createOrderId}`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ notes: createNotes || null, billing_address: createBillingAddress || null }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل إنشاء فاتورة المبيعات");
      setCreateOrderId(""); setCreateNotes(""); setCreateBillingAddress(""); setMessage("تم إنشاء فاتورة المبيعات بنجاح"); await loadAll();
    } catch (err) { setMessage(err?.message || "حدث خطأ أثناء إنشاء الفاتورة"); }
    finally { setSubmitting(false); }
  }

  async function quickAction(invoiceId, action, successMessage) {
    const key = `${invoiceId}:${action}`; setActionKey(key); setMessage("");
    try {
      const res = await fetch(`${SALES_INVOICES_API_URL}/${invoiceId}/${action}`, { method: "POST", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تنفيذ الإجراء");
      setMessage(successMessage); await loadAll();
    } catch (err) { setMessage(err?.message || "حدث خطأ أثناء تنفيذ الإجراء"); }
    finally { setActionKey(""); }
  }

  async function quickReturnAction(returnId, action, successMessage) {
    const key = `return:${returnId}:${action}`; setActionKey(key); setMessage("");
    try {
      const endpoint = action === "mark-refunded" ? `${SALES_INVOICES_API_URL}/returns/${returnId}/mark-refunded` : `${SALES_INVOICES_API_URL}/returns/${returnId}/cancel`;
      const res = await fetch(endpoint, { method: "POST", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تنفيذ الإجراء");
      setMessage(successMessage); await loadAll();
    } catch (err) { setMessage(err?.message || "حدث خطأ أثناء تنفيذ الإجراء"); }
    finally { setActionKey(""); }
  }

  async function handleLoadStatement(name = statementSearch) {
    const customerName = String(name || "").trim();
    if (!customerName) { setMessage("اكتب اسم العميل أولًا لعرض كشف الحساب"); setStatementPayload(null); return; }
    try {
      const res = await fetch(`${SALES_INVOICES_CUSTOMER_STATEMENT_API_URL}?customer_name=${encodeURIComponent(customerName)}`, { headers: authHeaders(), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحميل كشف حساب العميل");
      setStatementPayload(data || null); setStatementSearch(customerName);
    } catch (err) { setStatementPayload(null); setMessage(err?.message || "حدث خطأ أثناء تحميل كشف الحساب"); }
  }

  async function submitReturnModal() {
    if (!returnModal.invoiceId || !returnModal.amount || Number(returnModal.amount) <= 0) { setMessage("اختر فاتورة وأدخل مبلغاً صحيحاً أكبر من صفر"); return; }
    setSubmitting(true); setMessage("");
    try {
      const res = await fetch(`${SALES_INVOICES_API_URL}/${returnModal.invoiceId}/create-return`, { method: "POST", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ return_type: returnModal.returnType, amount: Number(returnModal.amount), reason: returnModal.reason || null, notes: returnModal.notes || null }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل إنشاء القيد العكسي");
      setReturnModal({ open: false, invoiceId: "", returnType: "credit_note", amount: "", reason: "", notes: "" }); setMessage("تم إنشاء القيد العكسي بنجاح"); await loadAll();
    } catch (err) { setMessage(err?.message || "حدث خطأ أثناء إنشاء القيد العكسي"); }
    finally { setSubmitting(false); }
  }

  function openReturnModal(invoice) { setReturnModal({ open: true, invoiceId: String(invoice.id), returnType: "credit_note", amount: "", reason: "", notes: "" }); }

  async function loadEntityHistory() {
    if (!historyEntityId) { setMessage("أدخل رقم السجل أولاً"); setHistoryRows([]); return; }
    setHistoryLoading(true); setMessage("");
    try {
      const res = await fetch(`${AUDIT_ENTITY_HISTORY_API_URL}?entity_type=sales_invoice&entity_id=${encodeURIComponent(historyEntityId)}`, { headers: authHeaders(), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحميل السجل التنفيذي");
      setHistoryRows(Array.isArray(data.history) ? data.history : []);
      if (!Array.isArray(data.history) || !data.history.length) setMessage("لا يوجد سجل ظاهر لهذا المعرف حالياً");
    } catch (err) { setHistoryRows([]); setMessage(err?.message || "حدث خطأ أثناء تحميل السجل التنفيذي"); }
    finally { setHistoryLoading(false); }
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ تحميل فواتير المبيعات...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <header className="erp-workspace-topbar">
          <div className="erp-workspace-title-wrap">
            <div className="erp-page-eyebrow">Sales Invoicing Workspace</div>
            <h1 className="erp-page-title">فواتير المبيعات والانضباط التجاري</h1>
            <p className="erp-page-subtitle">ربط موحد بين الطلب وإذن التسليم والفاتورة والتحصيل والقيود العكسية، مع كشف حساب العميل وسجل فواتير قابل للتصفية والتتبع.</p>
          </div>
          <div className="erp-topbar-actions">
            <div className="erp-topbar-chip">الفواتير: {summary.total_count || 0}</div>
            <div className="erp-topbar-chip">صافي المبيعات: {formatAmount(summary.net_sales_total)}</div>
            <div className="erp-topbar-chip">الذمم: {formatAmount(summary.remaining_amount)}</div>
          </div>
        </header>

        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">Sales Invoicing / Delivery / Refund Traceability</div>
            <h2>فواتير المبيعات والانضباط التجاري</h2>
            <p>واجهة موحدة تربط بين الطلب، إذن التسليم، الفاتورة، التحصيل، الإشعار الدائن، والاسترداد داخل مسار واحد واضح ومؤسسي.</p>
            <div className="erp-hero-actions">
              <div className="erp-hero-pill">Invoices: {summary.total_count || 0}</div>
              <div className="erp-hero-pill">Net Sales: {formatAmount(summary.net_sales_total)}</div>
              <div className="erp-hero-pill">Credit Notes: {formatAmount(summary.credit_notes_total)}</div>
              <div className="erp-hero-pill">Refunds: {formatAmount(summary.refunds_total)}</div>
            </div>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box"><div className="erp-stat-box-label">المحصل</div><div className="erp-stat-box-value">{formatAmount(summary.paid_amount)}</div></div>
            <div className="erp-stat-box"><div className="erp-stat-box-label">الذمم المدينة</div><div className="erp-stat-box-value">{formatAmount(summary.remaining_amount)}</div></div>
            <div className="erp-hero-visual" />
          </div>
        </section>

        {message ? <div className="erp-form-message" style={{ marginBottom: "16px" }}>{message}</div> : null}

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head" style={{ marginBottom: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ marginBottom: "4px" }}>السجل التنفيذي المضمن</h3>
              <p style={{ margin: 0 }}>استدعاء مباشر لتاريخ الكيان من audit logs داخل الصفحة الحالية.</p>
            </div>
          </div>
          <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom: "12px" }}>
            <div><label className="erp-label">sales_invoice ID</label><input className="erp-input" type="number" value={historyEntityId} onChange={(e) => setHistoryEntityId(e.target.value)} placeholder="أدخل المعرف" /></div>
            <div className="erp-form-actions"><button type="button" className="erp-btn-secondary" onClick={loadEntityHistory} disabled={historyLoading}>{historyLoading ? "جارٍ التحميل..." : "عرض السجل"}</button></div>
          </div>
          <div className="erp-table-shell" style={{ overflowX: "auto" }}>
            <table className="erp-table" style={{ minWidth: "1200px" }}>
              <thead><tr><th>ID</th><th>Actor</th><th>Action</th><th>Title</th><th>Description</th><th>Reference</th><th>Created At</th></tr></thead>
              <tbody>{historyRows.length === 0 ? <tr><td colSpan="7">لا يوجد سجل ظاهر بعد.</td></tr> : historyRows.map((row) => <tr key={row.id}><td>{row.id}</td><td>{row.actor_name || row.actor_user_id || "-"}</td><td>{row.action || "-"}</td><td>{row.title || "-"}</td><td>{row.description || "-"}</td><td>{row.reference_type ? `${row.reference_type} #${row.reference_id || ""}` : "-"}</td><td>{formatHistoryDate(row.created_at)}</td></tr>)}</tbody>
            </table>
          </div>
        </div>

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">إجمالي القيمة</div><div className="erp-card-value">{formatAmount(summary.total_amount)}</div><div className="erp-card-note">إجمالي الفواتير الصادرة</div></div>
          <div className="erp-card"><div className="erp-card-title">الإشعارات الدائنة</div><div className="erp-card-value">{formatAmount(summary.credit_notes_total)}</div><div className="erp-card-note">خصومات ومرتجعات</div></div>
          <div className="erp-card"><div className="erp-card-title">الاستردادات</div><div className="erp-card-value">{formatAmount(summary.refunds_total)}</div><div className="erp-card-note">مبالغ معادة</div></div>
          <div className="erp-card"><div className="erp-card-title">صافي المبيعات</div><div className="erp-card-value">{formatAmount(summary.net_sales_total)}</div><div className="erp-card-note">بعد القيود العكسية</div></div>
          <div className="erp-card"><div className="erp-card-title">الذمم المدينة</div><div className="erp-card-value">{formatAmount(summary.remaining_amount)}</div><div className="erp-card-note">مستحقات العملاء</div></div>
          <div className="erp-card"><div className="erp-card-title">القيود العكسية</div><div className="erp-card-value">{returnsSummary.total_count || 0}</div><div className="erp-card-note">إشعارات دائنة واستردادات</div></div>
        </section>

        <div className="erp-section-card" style={{ marginBottom: "20px" }}>
          <div className="erp-section-head" style={{ marginBottom: "18px" }}>
            <div style={{ textAlign: "right" }}><h3 style={{ marginBottom: "4px" }}>إصدار فاتورة جديدة</h3><p style={{ margin: 0 }}>تظهر هنا الطلبات المؤهلة فقط للفوترة بعد الشحن أو التسليم ومع وجود إذن تسليم.</p></div>
            <div className="erp-mini-note">Issue Sales Invoice</div>
          </div>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleCreateInvoice}>
            <div><label className="erp-label">الطلب المؤهل</label><select className="erp-input" value={createOrderId} onChange={(e) => setCreateOrderId(e.target.value)}><option value="">اختر طلباً مؤهلاً</option>{candidateOrders.map((order) => <option key={order.id} value={order.id}>{order.order_number} - {order.customer_name || "-"} - {order.delivery_number || "بدون إذن"}</option>)}</select></div>
            <div><label className="erp-label">عنوان الفوترة</label><input className="erp-input" value={createBillingAddress} onChange={(e) => setCreateBillingAddress(e.target.value)} placeholder="يترك فارغاً لاستخدام عنوان الطلب" /></div>
            <div style={{ gridColumn: "1 / -1" }}><label className="erp-label">ملاحظات الفاتورة</label><textarea className="erp-input" style={{ minHeight: "110px", resize: "vertical", paddingBlock: "12px" }} value={createNotes} onChange={(e) => setCreateNotes(e.target.value)} placeholder="ملاحظات إضافية" /></div>
            <div className="erp-form-actions" style={{ gap: "10px", flexWrap: "wrap" }}><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ إنشاء الفاتورة..." : "إصدار فاتورة"}</button></div>
          </form>
          <div style={{ marginTop: "16px", display: "grid", gap: "8px" }}>
            <div className="erp-mini-note">طلبات غير مؤهلة للفوترة الآن:</div>
            {invoiceCandidatesWithReasons.length === 0 ? <div className="erp-mini-note">لا توجد طلبات غير مؤهلة حاليًا.</div> : invoiceCandidatesWithReasons.slice(0, 12).map((order) => <div key={`reason-${order.id}`} style={{ background: "#f8fafc", border: "1px solid var(--rp-border)", borderRadius: "12px", padding: "10px 12px", fontSize: "12px" }}><strong>{order.order_number}</strong> — {order.eligibility_reason}</div>)}
          </div>
        </div>

        <div className="erp-section-card" style={{ marginBottom: "20px" }}>
          <div className="erp-section-head" style={{ marginBottom: "18px" }}><div style={{ textAlign: "right" }}><h3 style={{ marginBottom: "4px" }}>كشف حساب العميل</h3><p style={{ margin: 0 }}>عرض traceability بين الفاتورة والطلب وإذن التسليم مع الصافي والمحصل والمتبقي.</p></div></div>
          <div style={{ display: "grid", gap: "12px" }}>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <input className="erp-input" style={{ ...compactControlStyle, flex: "1 1 320px", minWidth: "240px" }} placeholder="اكتب اسم العميل" value={statementSearch} onChange={(e) => setStatementSearch(e.target.value)} />
              <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={() => handleLoadStatement()}>عرض كشف الحساب</button>
            </div>
            {statementPayload ? <><section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">العميل</div><div className="erp-card-value" style={{ fontSize: "18px" }}>{statementPayload.customer_name}</div><div className="erp-card-note">كشف حساب فواتير المبيعات</div></div><div className="erp-card"><div className="erp-card-title">إجمالي القيمة</div><div className="erp-card-value">{formatAmount(statementPayload.summary?.total_amount)}</div><div className="erp-card-note">إجمالي الفواتير</div></div><div className="erp-card"><div className="erp-card-title">المدفوع</div><div className="erp-card-value">{formatAmount(statementPayload.summary?.paid_amount)}</div><div className="erp-card-note">المحصل</div></div><div className="erp-card"><div className="erp-card-title">الإشعارات الدائنة</div><div className="erp-card-value">{formatAmount(statementPayload.summary?.credit_notes_total)}</div><div className="erp-card-note">خصومات ومرتجعات</div></div><div className="erp-card"><div className="erp-card-title">الاستردادات</div><div className="erp-card-value">{formatAmount(statementPayload.summary?.refunds_total)}</div><div className="erp-card-note">مبالغ معادة</div></div><div className="erp-card"><div className="erp-card-title">صافي المبيعات</div><div className="erp-card-value">{formatAmount(statementPayload.summary?.net_sales_total)}</div><div className="erp-card-note">بعد القيود العكسية</div></div></section><div className="erp-table-shell" style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "16px", maxHeight: "54vh", background: "var(--rp-surface)" }}><table className="erp-table" style={{ minWidth: "1600px" }}><thead><tr><th style={compactTableHeaderStyle}>رقم الفاتورة</th><th style={compactTableHeaderStyle}>رقم الطلب</th><th style={compactTableHeaderStyle}>إذن التسليم</th><th style={compactTableHeaderStyle}>حالة التسليم</th><th style={compactTableHeaderStyle}>المصنع</th><th style={compactTableHeaderStyle}>حالة الفاتورة</th><th style={compactTableHeaderStyle}>حالة الدفع</th><th style={compactTableHeaderStyle}>الإجمالي</th><th style={compactTableHeaderStyle}>الصافي</th><th style={compactTableHeaderStyle}>المتبقي</th><th style={compactTableHeaderStyle}>تاريخ الإصدار</th></tr></thead><tbody>{(statementPayload.invoices || []).length === 0 ? <tr><td colSpan="11" style={compactCellStyle}>لا توجد فواتير لهذا العميل حالياً.</td></tr> : statementPayload.invoices.map((row) => <tr key={`statement-${row.id}`}><td style={compactCellStyle}>{row.invoice_number}</td><td style={compactCellStyle}>{row.order_number || "-"}</td><td style={compactCellStyle}>{row.delivery_number || "-"}</td><td style={compactCellStyle}>{row.delivery_status || "-"}</td><td style={compactCellStyle}>{row.factory_name || `مصنع #${row.factory_id}`}</td><td style={compactCellStyle}><span className={`erp-badge ${badgeTone(row.status)}`}>{invoiceStatusLabel(row.status)}</span></td><td style={compactCellStyle}><span className={`erp-badge ${badgeTone(row.payment_status)}`}>{paymentStatusLabel(row.payment_status)}</span></td><td style={compactCellStyle}>{formatAmount(row.total_amount)}</td><td style={compactCellStyle}>{formatAmount(row.net_invoice_amount)}</td><td style={compactCellStyle}>{formatAmount(row.remaining_amount)}</td><td style={compactCellStyle}>{formatDateTime(row.issued_at)}</td></tr>)}</tbody></table></div></> : null}
          </div>
        </div>

        <div className="erp-section-card" style={{ marginBottom: "20px" }}>
          <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px" }}>
            <div style={{ textAlign: "right" }}><h3 style={{ marginBottom: "4px" }}>سجل فواتير المبيعات</h3><p style={{ margin: 0 }}>جدول تشغيلي يوضح الربط بين order / delivery / invoice / payment / refund.</p></div>
            <div style={{ display: "grid", gap: "10px", width: "100%" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input className="erp-input" style={{ ...compactControlStyle, flex: "1 1 260px", minWidth: "220px" }} placeholder="ابحث برقم الفاتورة أو الطلب أو العميل أو إذن التسليم..." value={customerSearch} onChange={(e) => setCustomerSearch(e.target.value)} />
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 160px", minWidth: "150px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">كل حالات الفاتورة</option><option value="issued">صادرة</option><option value="paid">مدفوعة</option><option value="partially_refunded">مردود جزئياً</option><option value="refunded">مردودة بالكامل</option><option value="cancelled">ملغاة</option></select>
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 160px", minWidth: "150px" }} value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}><option value="all">كل حالات الدفع</option><option value="pending">معلق</option><option value="paid">مدفوع</option><option value="partially_refunded">مسترجع جزئياً</option><option value="refunded">مسترجع</option><option value="failed">فشل</option><option value="cod">الدفع عند الاستلام</option></select>
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 150px", minWidth: "140px" }} value={factoryFilter} onChange={(e) => setFactoryFilter(e.target.value)}><option value="all">كل المصانع</option>{factoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select>
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 150px", minWidth: "140px" }} value={receivableFilter} onChange={(e) => setReceivableFilter(e.target.value)}><option value="all">كل الذمم</option><option value="open">ذمم مفتوحة</option><option value="closed">ذمم مغلقة</option></select>
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 150px", minWidth: "140px" }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="newest">الأحدث</option><option value="oldest">الأقدم</option><option value="amount_desc">الإجمالي: الأعلى</option><option value="amount_asc">الإجمالي: الأقل</option><option value="remaining_desc">الذمم: الأعلى</option><option value="customer">العميل</option></select>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={() => setReturnModal({ open: true, invoiceId: "", returnType: "credit_note", amount: "", reason: "", notes: "" })}>إنشاء قيد عكسي</button></div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}><span className="erp-mini-note">المعروض: {tableSummary.start}-{tableSummary.end} من {tableSummary.total}</span><span className="erp-mini-note">عدد الصفوف</span><select className="erp-input" style={{ ...compactControlStyle, width: "96px" }} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>{PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}</select></div>
              </div>
            </div>
          </div>
          <div className="erp-table-shell" style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "16px", maxHeight: "68vh", background: "var(--rp-surface)" }}>
            <table className="erp-table" style={{ minWidth: "2200px" }}>
              <thead><tr><th style={compactTableHeaderStyle}>رقم الفاتورة</th><th style={compactTableHeaderStyle}>رقم الطلب</th><th style={compactTableHeaderStyle}>إذن التسليم</th><th style={compactTableHeaderStyle}>حالة التسليم</th><th style={compactTableHeaderStyle}>المصنع</th><th style={compactTableHeaderStyle}>حالة الفاتورة</th><th style={compactTableHeaderStyle}>حالة الدفع</th><th style={compactTableHeaderStyle}>الحالة المحاسبية</th><th style={compactTableHeaderStyle}>رقم القيد</th><th style={compactTableHeaderStyle}>العميل</th><th style={compactTableHeaderStyle}>الإجمالي</th><th style={compactTableHeaderStyle}>الإشعارات الدائنة</th><th style={compactTableHeaderStyle}>الاستردادات</th><th style={compactTableHeaderStyle}>الصافي</th><th style={compactTableHeaderStyle}>المدفوع</th><th style={compactTableHeaderStyle}>المتبقي</th><th style={compactTableHeaderStyle}>تاريخ الإصدار</th><th style={compactTableHeaderStyle}>الإجراءات</th></tr></thead>
              <tbody>{pagedInvoices.length === 0 ? <tr><td colSpan="18" style={compactCellStyle}>لا توجد فواتير مبيعات مطابقة حالياً.</td></tr> : pagedInvoices.map((row) => { const postingState = invoicePostingMap[`sales:sales_invoice:${row.id}`] || { status: "", entry_number: "" }; return <tr key={row.id}><td style={compactCellStyle}>{row.invoice_number}</td><td style={compactCellStyle}>{row.order_number || "-"}</td><td style={compactCellStyle}>{row.delivery_number || "-"}</td><td style={compactCellStyle}>{row.delivery_status || "-"}</td><td style={compactCellStyle}>{row.factory_name || `مصنع #${row.factory_id}`}</td><td style={compactCellStyle}><span className={`erp-badge ${badgeTone(row.status)}`}>{invoiceStatusLabel(row.status)}</span></td><td style={compactCellStyle}><span className={`erp-badge ${badgeTone(row.payment_status)}`}>{paymentStatusLabel(row.payment_status)}</span></td><td style={compactCellStyle}><span className={`erp-badge ${postingStatusTone(postingState.status)}`}>{postingStatusLabel(postingState.status)}</span></td><td style={compactCellStyle}>{postingState.entry_number || "-"}</td><td style={compactCellStyle}>{row.customer_name || "-"}</td><td style={compactCellStyle}>{formatAmount(row.total_amount)}</td><td style={compactCellStyle}>{formatAmount(row.credit_notes_total)}</td><td style={compactCellStyle}>{formatAmount(row.refunds_total)}</td><td style={compactCellStyle}>{formatAmount(row.net_invoice_amount)}</td><td style={compactCellStyle}>{formatAmount(row.paid_amount)}</td><td style={compactCellStyle}>{formatAmount(row.remaining_amount)}</td><td style={compactCellStyle}>{formatDateTime(row.issued_at)}</td><td style={compactCellStyle}><div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>{canPostAccounting ? <><button type="button" className="erp-btn-secondary" style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }} disabled={actionKey === `check:sales:sales_invoice:${row.id}`} onClick={() => checkPosting("sales", "sales_invoice", row.id, "invoice")}>{actionKey === `check:sales:sales_invoice:${row.id}` ? "..." : "فحص الترحيل"}</button><button type="button" className="erp-btn-secondary" style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }} disabled={postingState.status === "posted" || actionKey === `post:sales:sales_invoice:${row.id}`} onClick={() => postSource("sales", "sales_invoice", row.id, "invoice")}>{actionKey === `post:sales:sales_invoice:${row.id}` ? "..." : "ترحيل محاسبي"}</button></> : null}<button type="button" className="erp-btn-primary" style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }} disabled={String(row.payment_status || "") === "paid" || String(row.payment_status || "") === "refunded" || String(row.status || "") === "cancelled" || actionKey === `${row.id}:mark-paid`} onClick={() => quickAction(row.id, "mark-paid", "تم تعليم فاتورة المبيعات كمدفوعة")}>{actionKey === `${row.id}:mark-paid` ? "..." : "تعليم كمدفوعة"}</button><button type="button" className="erp-btn-secondary" style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }} disabled={Number(row.net_invoice_amount || row.total_amount || 0) <= 0 || String(row.status || "") === "cancelled"} onClick={() => openReturnModal(row)}>قيد عكسي</button><button type="button" className="erp-btn-danger" style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }} disabled={String(row.payment_status || "") === "paid" || actionKey === `${row.id}:cancel`} onClick={() => quickAction(row.id, "cancel", "تم إلغاء فاتورة المبيعات")} title={row.delivery_status === "delivered" ? "الإلغاء المباشر سيُرفض على الفواتير المرتبطة بتسليم مؤكد." : ""}>{actionKey === `${row.id}:cancel` ? "..." : "إلغاء مباشر"}</button></div></td></tr>; })}</tbody>
            </table>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "14px" }}><div className="erp-mini-note">صفحة {page} من {totalPages}</div><div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setPage(1)} disabled={page === 1}>الأولى</button><button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>السابقة</button><button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages}>التالية</button><button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setPage(totalPages)} disabled={page === totalPages}>الأخيرة</button></div></div>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px" }}><div style={{ textAlign: "right" }}><h3 style={{ marginBottom: "4px" }}>سجل الإشعارات الدائنة والاستردادات</h3><p style={{ margin: 0 }}>قيود عكسية مرتبطة بالفواتير مع traceability واضح على مستوى الحالة والمبلغ.</p></div></div>
          <div className="erp-table-shell" style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "16px", maxHeight: "60vh", background: "var(--rp-surface)" }}>
            <table className="erp-table" style={{ minWidth: "1800px" }}>
              <thead><tr><th style={compactTableHeaderStyle}>رقم القيد</th><th style={compactTableHeaderStyle}>رقم الفاتورة</th><th style={compactTableHeaderStyle}>رقم الطلب</th><th style={compactTableHeaderStyle}>المصنع</th><th style={compactTableHeaderStyle}>النوع</th><th style={compactTableHeaderStyle}>الحالة</th><th style={compactTableHeaderStyle}>الحالة المحاسبية</th><th style={compactTableHeaderStyle}>رقم القيد المحاسبي</th><th style={compactTableHeaderStyle}>السبب</th><th style={compactTableHeaderStyle}>المبلغ</th><th style={compactTableHeaderStyle}>تاريخ الإنشاء</th><th style={compactTableHeaderStyle}>الإجراءات</th></tr></thead>
              <tbody>{returnsRows.length === 0 ? <tr><td colSpan="12" style={compactCellStyle}>لا توجد إشعارات دائنة أو استردادات حالياً.</td></tr> : returnsRows.map((row) => { const postingState = returnPostingMap[`sales:sales_return:${row.id}`] || { status: "", entry_number: "" }; return <tr key={row.id}><td style={compactCellStyle}>{row.return_number}</td><td style={compactCellStyle}>{row.invoice_number || "-"}</td><td style={compactCellStyle}>{row.order_number || "-"}</td><td style={compactCellStyle}>{row.factory_name || `مصنع #${row.factory_id}`}</td><td style={compactCellStyle}><span className={`erp-badge ${badgeTone(row.return_type === "refund" ? "refunded" : "issued")}`}>{returnTypeLabel(row.return_type)}</span></td><td style={compactCellStyle}><span className={`erp-badge ${badgeTone(row.status)}`}>{returnStatusLabel(row.status)}</span></td><td style={compactCellStyle}><span className={`erp-badge ${postingStatusTone(postingState.status)}`}>{postingStatusLabel(postingState.status)}</span></td><td style={compactCellStyle}>{postingState.entry_number || "-"}</td><td style={compactCellStyle}>{row.reason || "-"}</td><td style={compactCellStyle}>{formatAmount(row.amount)}</td><td style={compactCellStyle}>{formatDateTime(row.created_at)}</td><td style={compactCellStyle}><div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>{canPostAccounting ? <><button type="button" className="erp-btn-secondary" style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }} disabled={actionKey === `check:sales:sales_return:${row.id}`} onClick={() => checkPosting("sales", "sales_return", row.id, "return")}>{actionKey === `check:sales:sales_return:${row.id}` ? "..." : "فحص الترحيل"}</button><button type="button" className="erp-btn-secondary" style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }} disabled={postingState.status === "posted" || actionKey === `post:sales:sales_return:${row.id}`} onClick={() => postSource("sales", "sales_return", row.id, "return")}>{actionKey === `post:sales:sales_return:${row.id}` ? "..." : "ترحيل محاسبي"}</button></> : null}<button type="button" className="erp-btn-primary" style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }} disabled={String(row.status || "") !== "issued" || actionKey === `return:${row.id}:mark-refunded`} onClick={() => quickReturnAction(row.id, "mark-refunded", "تم تحويل القيد إلى استرداد")}>{actionKey === `return:${row.id}:mark-refunded` ? "..." : "تعليم كمسترد"}</button><button type="button" className="erp-btn-danger" style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }} disabled={String(row.status || "") === "cancelled" || actionKey === `return:${row.id}:cancel`} onClick={() => quickReturnAction(row.id, "cancel", "تم إلغاء القيد العكسي")}>{actionKey === `return:${row.id}:cancel` ? "..." : "إلغاء"}</button></div></td></tr>; })}</tbody>
            </table>
          </div>
        </div>

        {returnModal.open ? <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}><div style={{ width: "min(720px, 100%)", background: "#fff", borderRadius: "22px", boxShadow: "0 25px 60px rgba(15,23,42,0.25)", padding: "22px", display: "grid", gap: "14px" }}><div style={{ textAlign: "right" }}><h3 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>إنشاء إشعار دائن / استرداد</h3><p style={{ margin: "8px 0 0", color: "var(--rp-text-muted)" }}>أنشئ قيداً عكسياً مرتبطًا بالفاتورة مع المحافظة على net sales وremaining amount.</p></div><div className="erp-form-grid erp-form-grid-2"><div><label className="erp-label">الفاتورة</label><select className="erp-input" value={returnModal.invoiceId} onChange={(e) => setReturnModal((prev) => ({ ...prev, invoiceId: e.target.value }))}><option value="">اختر فاتورة</option>{eligibleInvoicesForReturn.map((row) => <option key={row.id} value={row.id}>{row.invoice_number} - {row.customer_name || "-"} - صافي متاح: {formatAmount(row.net_invoice_amount)}</option>)}</select></div><div><label className="erp-label">نوع القيد</label><select className="erp-input" value={returnModal.returnType} onChange={(e) => setReturnModal((prev) => ({ ...prev, returnType: e.target.value }))}><option value="credit_note">إشعار دائن</option><option value="refund">استرداد</option></select></div><div><label className="erp-label">المبلغ</label><input className="erp-input" type="number" min="0" step="0.01" value={returnModal.amount} onChange={(e) => setReturnModal((prev) => ({ ...prev, amount: e.target.value }))} /></div><div><label className="erp-label">السبب</label><input className="erp-input" value={returnModal.reason} onChange={(e) => setReturnModal((prev) => ({ ...prev, reason: e.target.value }))} /></div></div><div><label className="erp-label">ملاحظات إضافية</label><textarea className="erp-input" rows={4} value={returnModal.notes} onChange={(e) => setReturnModal((prev) => ({ ...prev, notes: e.target.value }))} /></div><div className="erp-form-actions" style={{ gap: "10px", flexWrap: "wrap" }}><button className="erp-btn-primary" type="button" disabled={submitting} onClick={submitReturnModal}>{submitting ? "جارٍ الإنشاء..." : "إنشاء القيد العكسي"}</button><button className="erp-btn-secondary" type="button" onClick={() => setReturnModal({ open: false, invoiceId: "", returnType: "credit_note", amount: "", reason: "", notes: "" })}>إغلاق</button></div></div></div> : null}
      </section>
    </main>
  );
}
