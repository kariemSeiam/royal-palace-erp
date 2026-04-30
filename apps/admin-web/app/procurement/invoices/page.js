"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { hasPermission } from "../../components/access";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";

const INVOICES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/supplier-invoices";
const SUPPLIERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/suppliers";
const PURCHASE_ORDERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/purchase-orders";
const FACTORIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";
const PAYABLES_SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/supplier-payables-summary";
const PROCUREMENT_POSTING_CHECK_API_URL = "https://api.royalpalace-group.com/api/v1/admin/accounting/postings/source-check";
const SUPPLIER_INVOICE_POSTING_API_PREFIX = "https://api.royalpalace-group.com/api/v1/admin/accounting/postings/supplier-invoices";

const emptyForm = {
  factory_id: "",
  supplier_id: "",
  purchase_order_id: "",
  invoice_number: "",
  invoice_date: "",
  due_date: "",
  subtotal_amount: "",
  vat_amount: "",
  total_amount: "",
  notes: "",
};

const emptyPaymentForm = {
  supplier_invoice_id: "",
  payment_date: "",
  amount: "",
  payment_method: "",
  reference_number: "",
  notes: "",
};

const AUDIT_ENTITY_HISTORY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/audit/entity-history";

function formatHistoryDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("en-GB");
}

function invoiceStatusLabel(value) {
  const map = {
    open: "مفتوحة",
    partially_paid: "مدفوعة جزئياً",
    paid: "مدفوعة بالكامل",
  };
  return map[value] || value || "-";
}

function tone(value) {
  if (value === "paid") return "success";
  if (value === "partially_paid") return "warning";
  return "";
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

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

export default function ProcurementInvoicesPage() {
  const { user, ready } = useAdminAuth("procurement");
  const canPostAccounting = useMemo(() => hasPermission(user, "finance.manage"), [user]);

  const [items, setItems] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [factories, setFactories] = useState([]);
  const [summary, setSummary] = useState({});
  const [form, setForm] = useState(emptyForm);
  const [paymentForm, setPaymentForm] = useState(emptyPaymentForm);
  const [editingId, setEditingId] = useState(null);
  const [paymentInvoiceId, setPaymentInvoiceId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [historyEntityId, setHistoryEntityId] = useState("");
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [postingMap, setPostingMap] = useState({});
  const [actionKey, setActionKey] = useState("");

  async function loadAll() {
    const [invoicesRes, suppliersRes, poRes, factoriesRes, summaryRes] = await Promise.all([
      fetch(INVOICES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(SUPPLIERS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(PURCHASE_ORDERS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(FACTORIES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(PAYABLES_SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);

    const invoicesData = await invoicesRes.json().catch(() => []);
    const suppliersData = await suppliersRes.json().catch(() => []);
    const poData = await poRes.json().catch(() => []);
    const factoriesData = await factoriesRes.json().catch(() => []);
    const summaryData = await summaryRes.json().catch(() => ({}));

    if (!invoicesRes.ok) throw new Error(invoicesData.detail || "فشل تحميل فواتير الموردين");
    if (!suppliersRes.ok) throw new Error(suppliersData.detail || "فشل تحميل الموردين");
    if (!poRes.ok) throw new Error(poData.detail || "فشل تحميل أوامر الشراء");
    if (!factoriesRes.ok) throw new Error(factoriesData.detail || "فشل تحميل المصانع");
    if (!summaryRes.ok) throw new Error(summaryData.detail || "فشل تحميل ملخص المستحقات");

    setItems(Array.isArray(invoicesData) ? invoicesData : []);
    setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
    setPurchaseOrders(Array.isArray(poData) ? poData : []);
    setFactories(Array.isArray(factoriesData) ? factoriesData : []);
    setSummary(summaryData || {});
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء التحميل"));
  }, [ready, user]);

  const filteredPurchaseOrders = useMemo(() => {
    const factoryId = String(form.factory_id || "");
    const supplierId = String(form.supplier_id || "");
    return purchaseOrders.filter((po) => {
      if (factoryId && String(po.factory_id) !== factoryId) return false;
      if (supplierId && String(po.supplier_id) !== supplierId) return false;
      return true;
    });
  }, [purchaseOrders, form.factory_id, form.supplier_id]);

  const filteredItems = useMemo(() => {
    const q = normalizeText(search);
    return items.filter((item) => {
      if (statusFilter !== "all" && String(item.status || "") !== statusFilter) return false;
      if (supplierFilter !== "all" && String(item.supplier_id) !== String(supplierFilter)) return false;
      if (factoryFilter !== "all" && String(item.factory_id) !== String(factoryFilter)) return false;
      if (!q) return true;

      const haystack = [
        item.id,
        item.factory_name,
        item.supplier_name,
        item.supplier_code,
        item.po_number,
        item.invoice_number,
        item.invoice_date,
        item.due_date,
        item.status,
        item.total_amount,
        item.remaining_amount,
      ].join(" ").toLowerCase();

      return haystack.includes(q);
    });
  }, [items, search, statusFilter, supplierFilter, factoryFilter]);

  const stats = useMemo(() => ({
    count: items.length,
    open: items.filter((x) => x.status === "open").length,
    partial: items.filter((x) => x.status === "partially_paid").length,
    paid: items.filter((x) => x.status === "paid").length,
    total: items.reduce((sum, x) => sum + Number(x.total_amount || 0), 0),
    remaining: items.reduce((sum, x) => sum + Number(x.remaining_amount || 0), 0),
    paidAmount: items.reduce((sum, x) => sum + Number(x.paid_amount || 0), 0),
  }), [items]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function updatePaymentField(field, value) {
    setPaymentForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function resetPaymentForm() {
    setPaymentForm(emptyPaymentForm);
    setPaymentInvoiceId(null);
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      factory_id: String(item.factory_id || ""),
      supplier_id: String(item.supplier_id || ""),
      purchase_order_id: item.purchase_order_id ? String(item.purchase_order_id) : "",
      invoice_number: item.invoice_number || "",
      invoice_date: item.invoice_date || "",
      due_date: item.due_date || "",
      subtotal_amount: String(item.subtotal_amount ?? ""),
      vat_amount: String(item.vat_amount ?? ""),
      total_amount: String(item.total_amount ?? ""),
      notes: item.notes || "",
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startPayment(item) {
    setPaymentInvoiceId(item.id);
    setPaymentForm({
      supplier_invoice_id: String(item.id),
      payment_date: new Date().toISOString().slice(0, 10),
      amount: item.remaining_amount ? String(item.remaining_amount) : "",
      payment_method: "",
      reference_number: "",
      notes: "",
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function checkPosting(invoiceId) {
    const key = `procurement:supplier_invoice:${invoiceId}`;
    setActionKey(`check:${key}`);
    setMessage("");
    try {
      const res = await fetch(
        `${PROCUREMENT_POSTING_CHECK_API_URL}?source_module=procurement&source_type=supplier_invoice&source_id=${encodeURIComponent(invoiceId)}`,
        { headers: authHeaders(), cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل فحص حالة الترحيل");
      setPostingMap((prev) => ({
        ...prev,
        [key]: { status: data.exists ? "posted" : "ready", entry_number: data.entry?.entry_number || "" },
      }));
      setMessage(data.exists ? "فاتورة المورد مقيدة محاسبيًا بالفعل." : "فاتورة المورد جاهزة للترحيل المحاسبي.");
    } catch (err) {
      setPostingMap((prev) => ({ ...prev, [key]: { status: "error", entry_number: "" } }));
      setMessage(err?.message || "حدث خطأ أثناء فحص حالة الترحيل");
    } finally {
      setActionKey("");
    }
  }

  async function postInvoice(invoiceId) {
    const key = `procurement:supplier_invoice:${invoiceId}`;
    setActionKey(`post:${key}`);
    setMessage("");
    try {
      const res = await fetch(`${SUPPLIER_INVOICE_POSTING_API_PREFIX}/${invoiceId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل الترحيل المحاسبي لفاتورة المورد");
      setPostingMap((prev) => ({
        ...prev,
        [key]: { status: "posted", entry_number: data.entry_number || "" },
      }));
      setMessage("تم إنشاء القيد المحاسبي لفاتورة المورد بنجاح.");
    } catch (err) {
      setPostingMap((prev) => ({ ...prev, [key]: { status: "error", entry_number: "" } }));
      setMessage(err?.message || "حدث خطأ أثناء الترحيل المحاسبي لفاتورة المورد");
    } finally {
      setActionKey("");
    }
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const payload = {
        factory_id: form.factory_id ? Number(form.factory_id) : null,
        supplier_id: form.supplier_id ? Number(form.supplier_id) : null,
        purchase_order_id: form.purchase_order_id ? Number(form.purchase_order_id) : null,
        invoice_number: form.invoice_number.trim(),
        invoice_date: form.invoice_date || null,
        due_date: form.due_date || null,
        subtotal_amount: form.subtotal_amount === "" ? null : Number(form.subtotal_amount),
        vat_amount: form.vat_amount === "" ? 0 : Number(form.vat_amount),
        total_amount: form.total_amount === "" ? null : Number(form.total_amount),
        notes: form.notes.trim() || null,
      };

      const url = editingId ? `${INVOICES_API_URL}/${editingId}` : INVOICES_API_URL;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حفظ فاتورة المورد");

      setMessage(editingId ? "تم تعديل فاتورة المورد بنجاح" : "تم إنشاء فاتورة المورد بنجاح");
      resetForm();
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء حفظ فاتورة المورد");
    } finally {
      setSubmitting(false);
    }
  }

  async function submitPayment(e) {
    e.preventDefault();
    if (!paymentInvoiceId) return;
    setSubmitting(true);
    setMessage("");

    try {
      const payload = {
        payment_date: paymentForm.payment_date || null,
        amount: paymentForm.amount === "" ? null : Number(paymentForm.amount),
        payment_method: paymentForm.payment_method.trim() || null,
        reference_number: paymentForm.reference_number.trim() || null,
        notes: paymentForm.notes.trim() || null,
      };

      const res = await fetch(`${INVOICES_API_URL}/${paymentInvoiceId}/payments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تسجيل دفعة المورد");

      setMessage("تم تسجيل الدفعة وتحديث حالة الفاتورة");
      resetPaymentForm();
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء تسجيل الدفعة");
    } finally {
      setSubmitting(false);
    }
  }

  async function loadEntityHistory() {
    if (!historyEntityId) {
      setMessage("أدخل رقم السجل أولاً");
      setHistoryRows([]);
      return;
    }
    setHistoryLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${AUDIT_ENTITY_HISTORY_API_URL}?entity_type=supplier_invoice&entity_id=${encodeURIComponent(historyEntityId)}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحميل السجل التنفيذي");
      setHistoryRows(Array.isArray(data.history) ? data.history : []);
      if (!Array.isArray(data.history) || !data.history.length) setMessage("لا يوجد سجل ظاهر لهذا المعرف حالياً");
    } catch (err) {
      setHistoryRows([]);
      setMessage(err?.message || "حدث خطأ أثناء تحميل السجل التنفيذي");
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleExportCsv() {
    const headers = ["رقم الفاتورة","المورد","المصنع","أمر الشراء","تاريخ الفاتورة","الاستحقاق","الحالة","الإجمالي","المدفوع","المتبقي"];
    const rows = filteredItems.map((item) => [item.invoice_number || "", item.supplier_name || "", item.factory_name || "", item.po_number || "", formatDate(item.invoice_date), formatDate(item.due_date), invoiceStatusLabel(item.status), formatAmount(item.total_amount), formatAmount(item.paid_amount), formatAmount(item.remaining_amount)]);
    exportTableCsv("supplier_invoices_export.csv", headers, rows);
  }

  function handleExportPdf() {
    const headers = ["رقم الفاتورة","المورد","المصنع","أمر الشراء","تاريخ الفاتورة","الاستحقاق","الحالة","الإجمالي","المدفوع","المتبقي"];
    const rows = filteredItems.map((item) => [item.invoice_number || "", item.supplier_name || "", item.factory_name || "", item.po_number || "", formatDate(item.invoice_date), formatDate(item.due_date), invoiceStatusLabel(item.status), formatAmount(item.total_amount), formatAmount(item.paid_amount), formatAmount(item.remaining_amount)]);
    exportTablePdf("تقرير فواتير الموردين", "المشتريات / فواتير الموردين", [{ label: "عدد الفواتير", value: stats.count }, { label: "المتبقي", value: formatAmount(stats.remaining) }], headers, rows);
  }

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل فواتير الموردين...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <header className="erp-workspace-topbar">
          <div className="erp-workspace-title-wrap">
            <div className="erp-page-eyebrow">Procurement Workspace</div>
            <h1 className="erp-page-title">فواتير الموردين والمدفوعات</h1>
            <p className="erp-page-subtitle">
              إدارة فاتورة المورد وربطها بأمر الشراء، ومتابعة المتبقي وتسجيل الدفعات داخل نفس المسار التشغيلي.
            </p>
          </div>
          <div className="erp-topbar-actions">
            <div className="erp-topbar-chip">إجمالي الفواتير: {stats.count}</div>
            <div className="erp-topbar-chip">المتبقي: {formatAmount(stats.remaining)}</div>
            <div className="erp-topbar-chip">المسدّد: {formatAmount(stats.paidAmount)}</div>
          </div>
        </header>

        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">Procurement / Payables / Supplier Invoices</div>
            <h2>فواتير الموردين والانضباط المالي</h2>
            <p>إدارة فاتورة المورد، ربطها بأمر الشراء، متابعة المتبقي، وتسجيل المدفوعات مع وضوح المستحقات.</p>
            <div className="erp-hero-actions">
              <div className="erp-hero-pill">Invoices: {stats.count}</div>
              <div className="erp-hero-pill">Open Payables: {formatAmount(summary.remaining_total)}</div>
              <div className="erp-hero-pill">Paid: {formatAmount(stats.paidAmount)}</div>
            </div>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">المستحق المتبقي</div>
              <div className="erp-stat-box-value">{formatAmount(summary.remaining_total)}</div>
            </div>
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">فواتير متأخرة</div>
              <div className="erp-stat-box-value">{summary.overdue_invoices_count || 0}</div>
            </div>
            <div className="erp-hero-visual" />
          </div>
        </section>

        {items.length === 0 ? <div className="erp-form-message" style={{ marginBottom: "16px" }}>لا توجد فواتير موردين بعد. ابدأ بإضافة المورد ثم أمر الشراء ثم الاستلام، وبعدها أنشئ الفاتورة لبدء مسار المستحقات.</div> : null}
        {message ? <div className="erp-form-message" style={{ marginBottom: "16px" }}>{message}</div> : null}

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head" style={{ marginBottom: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ marginBottom: "4px" }}>السجل التنفيذي المضمن</h3>
              <p style={{ margin: 0 }}>استدعاء مباشر لتاريخ الكيان من audit logs داخل الصفحة الحالية.</p>
            </div>
          </div>
          <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom: "12px" }}>
            <div>
              <label className="erp-label">supplier_invoice ID</label>
              <input className="erp-input" type="number" value={historyEntityId} onChange={(e) => setHistoryEntityId(e.target.value)} placeholder="أدخل المعرف" />
            </div>
            <div className="erp-form-actions">
              <button type="button" className="erp-btn-secondary" onClick={loadEntityHistory} disabled={historyLoading}>
                {historyLoading ? "جارٍ التحميل..." : "عرض السجل"}
              </button>
            </div>
          </div>
          <div className="erp-table-shell" style={{ overflowX: "auto" }}>
            <table className="erp-table" style={{ minWidth: "1200px" }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.length === 0 ? (
                  <tr><td colSpan="7">لا يوجد سجل ظاهر بعد.</td></tr>
                ) : historyRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.actor_name || row.actor_user_id || "-"}</td>
                    <td>{row.action || "-"}</td>
                    <td>{row.title || "-"}</td>
                    <td>{row.description || "-"}</td>
                    <td>{row.reference_type ? `${row.reference_type} #${row.reference_id || ""}` : "-"}</td>
                    <td>{formatHistoryDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">عدد الفواتير</div><div className="erp-card-value">{stats.count}</div><div className="erp-card-note">فواتير الموردين الحالية</div></div>
          <div className="erp-card"><div className="erp-card-title">مفتوحة</div><div className="erp-card-value">{stats.open}</div><div className="erp-card-note">غير مسددة بعد</div></div>
          <div className="erp-card"><div className="erp-card-title">مدفوعة جزئياً</div><div className="erp-card-value">{stats.partial}</div><div className="erp-card-note">تحتاج متابعة</div></div>
          <div className="erp-card"><div className="erp-card-title">مدفوعة بالكامل</div><div className="erp-card-value">{stats.paid}</div><div className="erp-card-note">مقفلة تشغيليًا</div></div>
          <div className="erp-card"><div className="erp-card-title">إجمالي القيمة</div><div className="erp-card-value">{formatAmount(stats.total)}</div><div className="erp-card-note">إجمالي الفواتير</div></div>
          <div className="erp-card"><div className="erp-card-title">المتبقي</div><div className="erp-card-value">{formatAmount(stats.remaining)}</div><div className="erp-card-note">المطلوب سداده</div></div>
        </section>

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head" style={{ marginBottom: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ marginBottom: "4px" }}>{editingId ? "تعديل فاتورة المورد" : "إنشاء فاتورة مورد"}</h3>
              <p style={{ margin: 0 }}>إدخال أو تحديث فاتورة المورد وربطها بأمر الشراء والمصنع والمورد.</p>
            </div>
          </div>

          <form className="erp-form-grid erp-form-grid-3" onSubmit={handleSubmit}>
            <div><label className="erp-label">المصنع</label><select className="erp-input" value={form.factory_id} onChange={(e) => updateField("factory_id", e.target.value)}><option value="">اختر المصنع</option>{factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
            <div><label className="erp-label">المورد</label><select className="erp-input" value={form.supplier_id} onChange={(e) => updateField("supplier_id", e.target.value)}><option value="">اختر المورد</option>{suppliers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
            <div><label className="erp-label">أمر الشراء</label><select className="erp-input" value={form.purchase_order_id} onChange={(e) => updateField("purchase_order_id", e.target.value)}><option value="">اختر أمر الشراء</option>{filteredPurchaseOrders.map((po) => <option key={po.id} value={po.id}>{po.po_number}</option>)}</select></div>
            <div><label className="erp-label">رقم الفاتورة</label><input className="erp-input" value={form.invoice_number} onChange={(e) => updateField("invoice_number", e.target.value)} /></div>
            <div><label className="erp-label">تاريخ الفاتورة</label><input className="erp-input" type="date" value={form.invoice_date} onChange={(e) => updateField("invoice_date", e.target.value)} /></div>
            <div><label className="erp-label">تاريخ الاستحقاق</label><input className="erp-input" type="date" value={form.due_date} onChange={(e) => updateField("due_date", e.target.value)} /></div>
            <div><label className="erp-label">Subtotal</label><input className="erp-input" type="number" step="0.01" value={form.subtotal_amount} onChange={(e) => updateField("subtotal_amount", e.target.value)} /></div>
            <div><label className="erp-label">VAT</label><input className="erp-input" type="number" step="0.01" value={form.vat_amount} onChange={(e) => updateField("vat_amount", e.target.value)} /></div>
            <div><label className="erp-label">Total</label><input className="erp-input" type="number" step="0.01" value={form.total_amount} onChange={(e) => updateField("total_amount", e.target.value)} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label className="erp-label">ملاحظات</label><textarea className="erp-input" rows={4} value={form.notes} onChange={(e) => updateField("notes", e.target.value)} /></div>
            <div className="erp-form-actions" style={{ gridColumn: "1 / -1", gap: "10px", flexWrap: "wrap" }}>
              <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إنشاء الفاتورة"}</button>
              <button className="erp-btn-secondary" type="button" onClick={resetForm}>إعادة تعيين</button>
            </div>
          </form>
        </div>

        {paymentInvoiceId ? (
          <div className="erp-section-card" style={{ marginBottom: "18px" }}>
            <div className="erp-section-head" style={{ marginBottom: "14px" }}>
              <div style={{ textAlign: "right" }}>
                <h3 style={{ marginBottom: "4px" }}>تسجيل دفعة على الفاتورة #{paymentInvoiceId}</h3>
                <p style={{ margin: 0 }}>تسجيل الدفعة التشغيلية من نفس شاشة فاتورة المورد.</p>
              </div>
            </div>

            <form className="erp-form-grid erp-form-grid-3" onSubmit={submitPayment}>
              <div><label className="erp-label">تاريخ الدفع</label><input className="erp-input" type="date" value={paymentForm.payment_date} onChange={(e) => updatePaymentField("payment_date", e.target.value)} /></div>
              <div><label className="erp-label">المبلغ</label><input className="erp-input" type="number" step="0.01" value={paymentForm.amount} onChange={(e) => updatePaymentField("amount", e.target.value)} /></div>
              <div><label className="erp-label">طريقة الدفع</label><input className="erp-input" value={paymentForm.payment_method} onChange={(e) => updatePaymentField("payment_method", e.target.value)} /></div>
              <div><label className="erp-label">المرجع</label><input className="erp-input" value={paymentForm.reference_number} onChange={(e) => updatePaymentField("reference_number", e.target.value)} /></div>
              <div style={{ gridColumn: "1 / -1" }}><label className="erp-label">ملاحظات</label><textarea className="erp-input" rows={3} value={paymentForm.notes} onChange={(e) => updatePaymentField("notes", e.target.value)} /></div>
              <div className="erp-form-actions" style={{ gridColumn: "1 / -1", gap: "10px", flexWrap: "wrap" }}>
                <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ التسجيل..." : "تسجيل الدفعة"}</button>
                <button className="erp-btn-secondary" type="button" onClick={resetPaymentForm}>إلغاء</button>
              </div>
            </form>
          </div>
        ) : null}

        <div className="erp-section-card">
          <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ marginBottom: "4px" }}>سجل فواتير الموردين</h3>
              <p style={{ margin: 0 }}>عرض تشغيلي مع حالة السداد والذمم والمصدر المحاسبي native من نفس الصفحة.</p>
            </div>

            <div style={{ display: "grid", gap: "10px", width: "100%" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input className="erp-input" style={{ minHeight: "42px", minWidth: "220px", flex: "1 1 260px" }} placeholder="ابحث بالمورد أو الفاتورة أو أمر الشراء..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="erp-input" style={{ minHeight: "42px", minWidth: "150px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">كل الحالات</option>
                  <option value="open">مفتوحة</option>
                  <option value="partially_paid">مدفوعة جزئياً</option>
                  <option value="paid">مدفوعة بالكامل</option>
                </select>
                <select className="erp-input" style={{ minHeight: "42px", minWidth: "170px" }} value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
                  <option value="all">كل الموردين</option>
                  {suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}
                </select>
                <select className="erp-input" style={{ minHeight: "42px", minWidth: "150px" }} value={factoryFilter} onChange={(e) => setFactoryFilter(e.target.value)}>
                  <option value="all">كل المصانع</option>
                  {factories.map((factory) => <option key={factory.id} value={factory.id}>{factory.name}</option>)}
                </select>
                <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button>
                <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button>
              </div>
            </div>
          </div>

          <div className="erp-table-shell" style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "16px", background: "var(--rp-surface)" }}>
            <table className="erp-table" style={{ minWidth: "1800px" }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>المصنع</th>
                  <th>المورد</th>
                  <th>رقم أمر الشراء</th>
                  <th>رقم الفاتورة</th>
                  <th>تاريخ الفاتورة</th>
                  <th>تاريخ الاستحقاق</th>
                  <th>الحالة</th>
                  <th>الحالة المحاسبية</th>
                  <th>رقم القيد</th>
                  <th>الإجمالي</th>
                  <th>المدفوع</th>
                  <th>المتبقي</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr><td colSpan="14">لا توجد فواتير مطابقة.</td></tr>
                ) : filteredItems.map((item) => {
                  const postingState = postingMap[`procurement:supplier_invoice:${item.id}`] || { status: "", entry_number: "" };
                  return (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.factory_name || `مصنع #${item.factory_id}`}</td>
                      <td>{item.supplier_name || "-"}</td>
                      <td>{item.po_number || "-"}</td>
                      <td>{item.invoice_number || "-"}</td>
                      <td>{formatDate(item.invoice_date)}</td>
                      <td>{formatDate(item.due_date)}</td>
                      <td><span className={`erp-badge ${tone(item.status)}`}>{invoiceStatusLabel(item.status)}</span></td>
                      <td><span className={`erp-badge ${postingStatusTone(postingState.status)}`}>{postingStatusLabel(postingState.status)}</span></td>
                      <td>{postingState.entry_number || "-"}</td>
                      <td>{formatAmount(item.total_amount)}</td>
                      <td>{formatAmount(item.paid_amount)}</td>
                      <td>{formatAmount(item.remaining_amount)}</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                          {canPostAccounting ? (
                            <>
                              <button
                                type="button"
                                className="erp-btn-secondary"
                                style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }}
                                disabled={actionKey === `check:procurement:supplier_invoice:${item.id}`}
                                onClick={() => checkPosting(item.id)}
                              >
                                {actionKey === `check:procurement:supplier_invoice:${item.id}` ? "..." : "فحص الترحيل"}
                              </button>
                              <button
                                type="button"
                                className="erp-btn-secondary"
                                style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }}
                                disabled={postingState.status === "posted" || actionKey === `post:procurement:supplier_invoice:${item.id}`}
                                onClick={() => postInvoice(item.id)}
                              >
                                {actionKey === `post:procurement:supplier_invoice:${item.id}` ? "..." : "ترحيل محاسبي"}
                              </button>
                            </>
                          ) : null}
                          <button type="button" className="erp-btn-secondary" style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }} onClick={() => startEdit(item)}>تعديل</button>
                          <button type="button" className="erp-btn-primary" style={{ minHeight: "32px", padding: "0 10px", fontSize: "11px" }} disabled={item.status === "paid"} onClick={() => startPayment(item)}>تسجيل دفعة</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
