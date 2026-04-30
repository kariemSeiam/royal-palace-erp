"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const QUOTATIONS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/sales-quotations";
const FACTORIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";
const PRODUCTS_API_URL = "https://api.royalpalace-group.com/api/v1/catalog/products";
const AUDIT_ENTITY_HISTORY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/audit/entity-history";

const STATUS_OPTIONS = [
  { value: "draft", label: "مسودة" },
  { value: "sent", label: "تم الإرسال" },
  { value: "approved", label: "معتمد" },
  { value: "rejected", label: "مرفوض" },
  { value: "expired", label: "منتهي" },
  { value: "converted", label: "تم التحويل" },
  { value: "cancelled", label: "ملغي" },
];

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
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function toDateValue(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB");
}

function getStatusLabel(value) {
  return STATUS_OPTIONS.find((x) => x.value === value)?.label || value || "-";
}

function getStatusTone(status) {
  if (status === "approved" || status === "converted") return "success";
  if (status === "rejected" || status === "cancelled" || status === "expired") return "warning";
  return "warning";
}

function emptyItem() {
  return {
    product_id: "",
    quantity: 1,
    unit_price: "",
  };
}

function canEdit(item) {
  return !["converted", "cancelled"].includes(String(item?.status || ""));
}

function canConvert(item) {
  return ["draft", "sent", "approved"].includes(String(item?.status || "")) && !item?.converted_order_id;
}

function canSend(item) {
  return ["draft", "rejected", "expired"].includes(String(item?.status || ""));
}

function canApprove(item) {
  return ["draft", "sent", "rejected", "expired"].includes(String(item?.status || ""));
}

function canReject(item) {
  return ["draft", "sent", "approved"].includes(String(item?.status || ""));
}

function canExpire(item) {
  return ["draft", "sent", "approved"].includes(String(item?.status || ""));
}

function canCancel(item) {
  return !["converted", "cancelled"].includes(String(item?.status || ""));
}

export default function QuotationsPage() {
  const { user, ready } = useAdminAuth("orders");

  const [quotations, setQuotations] = useState([]);
  const [summary, setSummary] = useState(null);
  const [factories, setFactories] = useState([]);
  const [products, setProducts] = useState([]);

  const [editingId, setEditingId] = useState(null);
  const [expandedId, setExpandedId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [factoryFilter, setFactoryFilter] = useState("all");

  const [message, setMessage] = useState("");
  const [historyEntityId, setHistoryEntityId] = useState("");
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [actionKey, setActionKey] = useState("");

  const [form, setForm] = useState({
    factory_id: "",
    business_account_id: "",
    customer_name: "",
    customer_phone: "",
    shipping_address: "",
    notes: "",
    valid_until: "",
    items: [emptyItem()],
  });

  async function loadAll() {
    const [quotationsRes, summaryRes, factoriesRes, productsRes] = await Promise.all([
      fetch(QUOTATIONS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(`${QUOTATIONS_API_URL}/summary`, { headers: authHeaders(), cache: "no-store" }),
      fetch(FACTORIES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(PRODUCTS_API_URL, { cache: "no-store" }),
    ]);

    const quotationsData = await quotationsRes.json().catch(() => []);
    const summaryData = await summaryRes.json().catch(() => null);
    const factoriesData = await factoriesRes.json().catch(() => []);
    const productsData = await productsRes.json().catch(() => []);

    if (!quotationsRes.ok) throw new Error(quotationsData.detail || "تعذر تحميل عروض الأسعار");
    if (!summaryRes.ok) throw new Error(summaryData?.detail || "تعذر تحميل ملخص عروض الأسعار");
    if (!factoriesRes.ok) throw new Error(factoriesData.detail || "تعذر تحميل المصانع");

    setQuotations(Array.isArray(quotationsData) ? quotationsData : []);
    setSummary(summaryData || null);
    setFactories(Array.isArray(factoriesData) ? factoriesData : []);
    setProducts(Array.isArray(productsData) ? productsData : []);
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => {
      setQuotations([]);
      setSummary(null);
      setFactories([]);
      setProducts([]);
      setMessage(err?.message || "تعذر تحميل بيانات عروض الأسعار");
    });
  }, [ready, user]);

  const productOptions = useMemo(() => {
    return products.map((item) => ({
      value: String(item.id),
      label: `${item.name_ar || item.name_en || item.slug || `منتج #${item.id}`} ${item.sku ? `(${item.sku})` : ""}`.trim(),
      factory_id: item.factory_id ? String(item.factory_id) : "",
      base_price: item.base_price || item.price || "",
    }));
  }, [products]);

  const factoryOptions = useMemo(() => {
    const map = new Map();
    quotations.forEach((item) => {
      if (item.factory_id) {
        map.set(String(item.factory_id), item.factory_name || `مصنع #${item.factory_id}`);
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [quotations]);

  const filteredQuotations = useMemo(() => {
    const q = normalizeText(search);
    return quotations.filter((item) => {
      const statusMatched = statusFilter === "all" || String(item.status || "") === statusFilter;
      const factoryMatched = factoryFilter === "all" || String(item.factory_id || "") === factoryFilter;
      if (!statusMatched || !factoryMatched) return false;
      if (!q) return true;

      const haystack = [
        item.id,
        item.quotation_number,
        item.customer_name,
        item.customer_phone,
        item.factory_name,
        item.converted_order_number,
        item.status,
        item.total_amount,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [quotations, search, statusFilter, factoryFilter]);

  function resetForm() {
    setEditingId(null);
    setExpandedId(null);
    setForm({
      factory_id: "",
      business_account_id: "",
      customer_name: "",
      customer_phone: "",
      shipping_address: "",
      notes: "",
      valid_until: "",
      items: [emptyItem()],
    });
  }

  async function handleEdit(item) {
    setMessage("");
    try {
      const res = await fetch(`${QUOTATIONS_API_URL}/${item.id}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "تعذر تحميل تفاصيل عرض السعر");

      setEditingId(data.id);
      setForm({
        factory_id: data.factory_id ? String(data.factory_id) : "",
        business_account_id: data.business_account_id ? String(data.business_account_id) : "",
        customer_name: data.customer_name || "",
        customer_phone: data.customer_phone || "",
        shipping_address: data.shipping_address || "",
        notes: data.notes || "",
        valid_until: toDateValue(data.valid_until),
        items:
          Array.isArray(data.items) && data.items.length
            ? data.items.map((row) => ({
                product_id: row.product_id ? String(row.product_id) : "",
                quantity: row.quantity || 1,
                unit_price: row.unit_price || "",
              }))
            : [emptyItem()],
      });

      setExpandedId(data.id);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء تحميل العرض للتعديل");
    }
  }

  function updateItem(index, key, value) {
    setForm((prev) => {
      const nextItems = [...prev.items];
      const current = { ...nextItems[index], [key]: value };

      if (key === "product_id") {
        const selected = productOptions.find((item) => item.value === String(value));
        if (selected && !current.unit_price) {
          current.unit_price = selected.base_price ? String(selected.base_price) : "";
        }
      }

      nextItems[index] = current;
      return { ...prev, items: nextItems };
    });
  }

  function addItemRow() {
    setForm((prev) => ({ ...prev, items: [...prev.items, emptyItem()] }));
  }

  function removeItemRow(index) {
    setForm((prev) => {
      const nextItems = prev.items.filter((_, i) => i !== index);
      return { ...prev, items: nextItems.length ? nextItems : [emptyItem()] };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const payload = {
        factory_id: Number(form.factory_id),
        business_account_id: form.business_account_id ? Number(form.business_account_id) : null,
        customer_name: form.customer_name || null,
        customer_phone: form.customer_phone || null,
        shipping_address: form.shipping_address || null,
        notes: form.notes || null,
        valid_until: form.valid_until ? `${form.valid_until}T23:59:00` : null,
        items: form.items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          unit_price: item.unit_price === "" ? null : Number(item.unit_price),
        })),
      };

      if (!payload.factory_id) throw new Error("اختر المصنع أولًا");
      if (!payload.items.length || payload.items.some((item) => !item.product_id || !item.quantity)) {
        throw new Error("أضف بنود عرض السعر بشكل صحيح");
      }

      const isEdit = Boolean(editingId);
      const url = isEdit ? `${QUOTATIONS_API_URL}/${editingId}` : QUOTATIONS_API_URL;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حفظ عرض السعر");

      setMessage(isEdit ? "تم تحديث عرض السعر بنجاح" : "تم إنشاء عرض السعر بنجاح");
      resetForm();
      await loadAll();
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء حفظ عرض السعر");
    } finally {
      setSubmitting(false);
    }
  }

  async function quickAction(item, action, successMessage) {
    setActionKey(`${item.id}:${action}`);
    setMessage("");

    try {
      const res = await fetch(`${QUOTATIONS_API_URL}/${item.id}/${action}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({}),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تنفيذ الإجراء");

      setMessage(successMessage);
      await loadAll();
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء تنفيذ الإجراء");
    } finally {
      setActionKey("");
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
      const res = await fetch(
        `${AUDIT_ENTITY_HISTORY_API_URL}?entity_type=sales_quotation&entity_id=${encodeURIComponent(historyEntityId)}`,
        {
          headers: authHeaders(),
          cache: "no-store",
        }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحميل السجل التنفيذي");
      setHistoryRows(Array.isArray(data.history) ? data.history : []);
      if (!Array.isArray(data.history) || !data.history.length) {
        setMessage("لا يوجد سجل ظاهر لهذا المعرف حالياً");
      }
    } catch (err) {
      setHistoryRows([]);
      setMessage(err?.message || "حدث خطأ أثناء تحميل السجل التنفيذي");
    } finally {
      setHistoryLoading(false);
    }
  }

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل عروض الأسعار...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <header className="erp-workspace-topbar">
          <div className="erp-workspace-title-wrap">
            <div className="erp-page-eyebrow">Sales Workspace</div>
            <h1 className="erp-page-title">عروض الأسعار</h1>
            <p className="erp-page-subtitle">
              إدارة عروض الأسعار من المسودة حتى التحويل إلى الطلبات التشغيلية ضمن مسار تجاري منضبط وقابل للتتبع.
            </p>
          </div>
          <div className="erp-topbar-actions">
            <div className="erp-topbar-chip">إجمالي العروض: {summary?.total_count || 0}</div>
            <div className="erp-topbar-chip">المعتمدة: {summary?.approved_count || 0}</div>
            <div className="erp-topbar-chip">المحوّلة: {summary?.converted_count || 0}</div>
          </div>
        </header>

        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">Sales / Quotations</div>
            <h2>إدارة دورة عرض السعر</h2>
            <p>
              واجهة موحدة لإنشاء عروض الأسعار، إرسالها واعتمادها ورفضها أو تحويلها مباشرة إلى الطلبات، مع اتساق بصري وتشغيلي على نمط الأنظمة المؤسسية.
            </p>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">إجمالي العروض</div>
              <div className="erp-stat-box-value">{summary?.total_count || 0}</div>
            </div>
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">إجمالي القيمة</div>
              <div className="erp-stat-box-value">{formatAmount(summary?.total_amount || 0)}</div>
            </div>
            <div className="erp-hero-visual" />
          </div>
        </section>

        {message ? (
          <div className="erp-form-message" style={{ marginBottom: "16px" }}>
            {message}
          </div>
        ) : null}

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head" style={{ marginBottom: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ marginBottom: "4px" }}>السجل التنفيذي المضمن</h3>
              <p style={{ margin: 0 }}>استدعاء مباشر لتاريخ الكيان من audit logs داخل الصفحة الحالية.</p>
            </div>
          </div>
          <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom: "12px" }}>
            <div>
              <label className="erp-label">sales_quotation ID</label>
              <input
                className="erp-input"
                type="number"
                value={historyEntityId}
                onChange={(e) => setHistoryEntityId(e.target.value)}
                placeholder="أدخل المعرف"
              />
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
                  <tr>
                    <td colSpan="7">لا يوجد سجل ظاهر بعد.</td>
                  </tr>
                ) : (
                  historyRows.map((row) => (
                    <tr key={row.id}>
                      <td>{row.id}</td>
                      <td>{row.actor_name || row.actor_user_id || "-"}</td>
                      <td>{row.action || "-"}</td>
                      <td>{row.title || "-"}</td>
                      <td>{row.description || "-"}</td>
                      <td>{row.reference_type ? `${row.reference_type} #${row.reference_id || ""}` : "-"}</td>
                      <td>{formatHistoryDate(row.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <section className="erp-kpi-grid" style={{ marginBottom: "16px" }}>
          <div className="erp-card">
            <div className="erp-card-title">مسودات</div>
            <div className="erp-card-value">{summary?.draft_count || 0}</div>
            <div className="erp-card-note">عروض تحتاج متابعة</div>
          </div>
          <div className="erp-card">
            <div className="erp-card-title">تم الإرسال</div>
            <div className="erp-card-value">{summary?.sent_count || 0}</div>
            <div className="erp-card-note">عروض مرسلة للعميل</div>
          </div>
          <div className="erp-card">
            <div className="erp-card-title">معتمدة</div>
            <div className="erp-card-value">{summary?.approved_count || 0}</div>
            <div className="erp-card-note">جاهزة للتحويل إلى طلب</div>
          </div>
          <div className="erp-card">
            <div className="erp-card-title">تم التحويل</div>
            <div className="erp-card-value">{summary?.converted_count || 0}</div>
            <div className="erp-card-note">مرتبطة بطلبات تشغيلية</div>
          </div>
        </section>

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head" style={{ marginBottom: "18px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>
                {editingId ? "تعديل عرض السعر" : "إنشاء عرض سعر جديد"}
              </h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8 }}>
                أنشئ عرض سعر مرتبطًا بمصنع واحد، ثم أرسله أو اعتمده أو حوّله إلى طلب تشغيلي.
              </p>
            </div>
            {editingId ? <div className="erp-mini-note">Quotation #{editingId}</div> : null}
          </div>

          <form className="erp-form-grid" onSubmit={handleSubmit}>
            <div className="erp-form-grid erp-form-grid-2">
              <div>
                <label className="erp-label">المصنع</label>
                <select
                  className="erp-input"
                  value={form.factory_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, factory_id: e.target.value }))}
                  disabled={Boolean(editingId)}
                >
                  <option value="">اختر المصنع</option>
                  {factories.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.name || item.factory_name || `مصنع #${item.id}`}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="erp-label">رقم حساب B2B</label>
                <input
                  className="erp-input"
                  value={form.business_account_id}
                  onChange={(e) => setForm((prev) => ({ ...prev, business_account_id: e.target.value }))}
                  placeholder="اختياري"
                />
              </div>

              <div>
                <label className="erp-label">اسم العميل</label>
                <input
                  className="erp-input"
                  value={form.customer_name}
                  onChange={(e) => setForm((prev) => ({ ...prev, customer_name: e.target.value }))}
                />
              </div>

              <div>
                <label className="erp-label">هاتف العميل</label>
                <input
                  className="erp-input"
                  value={form.customer_phone}
                  onChange={(e) => setForm((prev) => ({ ...prev, customer_phone: e.target.value }))}
                />
              </div>

              <div>
                <label className="erp-label">عنوان الشحن</label>
                <input
                  className="erp-input"
                  value={form.shipping_address}
                  onChange={(e) => setForm((prev) => ({ ...prev, shipping_address: e.target.value }))}
                />
              </div>

              <div>
                <label className="erp-label">صالح حتى</label>
                <input
                  className="erp-input"
                  type="date"
                  value={form.valid_until}
                  onChange={(e) => setForm((prev) => ({ ...prev, valid_until: e.target.value }))}
                />
              </div>
            </div>

            <div>
              <label className="erp-label">ملاحظات</label>
              <textarea
                className="erp-input"
                rows={3}
                value={form.notes}
                onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
              />
            </div>

            <div className="erp-section-card" style={{ padding: "14px", marginTop: "8px" }}>
              <div className="erp-section-head" style={{ marginBottom: "12px" }}>
                <div style={{ textAlign: "right" }}>
                  <h4 style={{ margin: 0 }}>بنود عرض السعر</h4>
                  <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)" }}>
                    اختر المنتجات وأدخل الكمية والسعر عند الحاجة.
                  </p>
                </div>
                <button type="button" className="erp-btn-secondary" onClick={addItemRow}>
                  إضافة بند
                </button>
              </div>

              <div style={{ display: "grid", gap: "10px" }}>
                {form.items.map((item, index) => {
                  const filteredProducts = productOptions.filter(
                    (p) => !form.factory_id || p.factory_id === String(form.factory_id)
                  );
                  return (
                    <div
                      key={`item-${index}`}
                      style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 1.8fr) 120px 140px 110px",
                        gap: "10px",
                        alignItems: "end",
                      }}
                    >
                      <div>
                        <label className="erp-label">المنتج</label>
                        <select
                          className="erp-input"
                          value={item.product_id}
                          onChange={(e) => updateItem(index, "product_id", e.target.value)}
                        >
                          <option value="">اختر المنتج</option>
                          {filteredProducts.map((product) => (
                            <option key={product.value} value={product.value}>
                              {product.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="erp-label">الكمية</label>
                        <input
                          className="erp-input"
                          type="number"
                          min="1"
                          value={item.quantity}
                          onChange={(e) => updateItem(index, "quantity", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="erp-label">سعر الوحدة</label>
                        <input
                          className="erp-input"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.unit_price}
                          onChange={(e) => updateItem(index, "unit_price", e.target.value)}
                        />
                      </div>

                      <div>
                        <button type="button" className="erp-btn-danger" onClick={() => removeItemRow(index)}>
                          حذف البند
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="erp-form-actions" style={{ gap: "10px", flexWrap: "wrap", marginTop: "12px" }}>
              <button className="erp-btn-primary" type="submit" disabled={submitting}>
                {submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إنشاء عرض السعر"}
              </button>
              <button type="button" className="erp-btn-secondary" onClick={resetForm}>
                {editingId ? "إلغاء التعديل" : "تفريغ النموذج"}
              </button>
            </div>
          </form>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ marginBottom: "4px" }}>سجل عروض الأسعار</h3>
              <p style={{ margin: 0 }}>عرض تشغيلي يوضح حالة العرض وقيمته والطلب الناتج عنه والإجراءات المتاحة.</p>
            </div>

            <div style={{ display: "grid", gap: "10px", width: "100%" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input
                  className="erp-input"
                  style={{
                    minHeight: "42px",
                    borderRadius: "14px",
                    fontWeight: 700,
                    paddingInline: "12px",
                    flex: "1 1 260px",
                    minWidth: "220px",
                  }}
                  placeholder="ابحث برقم العرض أو العميل أو الطلب المحول..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                <select
                  className="erp-input"
                  style={{
                    minHeight: "42px",
                    borderRadius: "14px",
                    fontWeight: 700,
                    paddingInline: "12px",
                    flex: "1 1 160px",
                    minWidth: "150px",
                  }}
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">كل الحالات</option>
                  {STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="erp-input"
                  style={{
                    minHeight: "42px",
                    borderRadius: "14px",
                    fontWeight: 700,
                    paddingInline: "12px",
                    flex: "1 1 160px",
                    minWidth: "150px",
                  }}
                  value={factoryFilter}
                  onChange={(e) => setFactoryFilter(e.target.value)}
                >
                  <option value="all">كل المصانع</option>
                  {factoryOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </div>
              <div className="erp-mini-note">المعروض: {filteredQuotations.length}</div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            {filteredQuotations.length === 0 ? (
              <div className="erp-form-message">
                {quotations.length === 0 ? "لا توجد عروض أسعار حالياً." : "لا توجد نتائج مطابقة للبحث."}
              </div>
            ) : (
              filteredQuotations.map((item) => (
                <div
                  key={item.id}
                  style={{
                    border: "1px solid var(--rp-border)",
                    borderRadius: "18px",
                    background: "var(--rp-surface)",
                    overflow: "hidden",
                    boxShadow: "var(--rp-shadow-soft)",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.8fr) minmax(0, 1.2fr)",
                      gap: "12px",
                      alignItems: "center",
                      padding: "16px",
                      background: "rgba(15, 23, 42, 0.04)",
                    }}
                  >
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "12px", color: "var(--rp-text-muted)", marginBottom: "4px", fontWeight: 800 }}>
                        رقم العرض
                      </div>
                      <div style={{ fontWeight: 900, fontSize: "15px" }}>{item.quotation_number || `SQ #${item.id}`}</div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "12px", color: "var(--rp-text-muted)", marginBottom: "4px", fontWeight: 800 }}>
                        العميل
                      </div>
                      <div style={{ fontWeight: 800, fontSize: "13px" }}>{item.customer_name || "-"}</div>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: "12px", color: "var(--rp-text-muted)", marginBottom: "4px", fontWeight: 800 }}>
                        الحالة
                      </div>
                      <span className={`erp-badge ${getStatusTone(item.status)}`}>{getStatusLabel(item.status)}</span>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button type="button" className="erp-btn-secondary" onClick={() => handleEdit(item)} disabled={!canEdit(item)}>
                        تعديل
                      </button>
                      <button
                        type="button"
                        className="erp-btn-secondary"
                        onClick={() => setExpandedId(expandedId === item.id ? null : item.id)}
                      >
                        {expandedId === item.id ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                      </button>
                    </div>
                  </div>

                  <div style={{ padding: "14px 16px", display: "grid", gap: "12px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "12px" }}>
                      <div className="erp-mini-note">المصنع: {item.factory_name || `مصنع #${item.factory_id || "-"}`}</div>
                      <div className="erp-mini-note">القيمة: {formatAmount(item.total_amount)}</div>
                      <div className="erp-mini-note">صالح حتى: {formatDateTime(item.valid_until)}</div>
                      <div className="erp-mini-note">الطلب المحول: {item.converted_order_number || "-"}</div>
                      <div className="erp-mini-note">هاتف العميل: {item.customer_phone || "-"}</div>
                    </div>

                    {item.notes ? (
                      <div
                        style={{
                          fontSize: "12px",
                          color: "var(--rp-text)",
                          background: "#f8fafc",
                          border: "1px solid var(--rp-border)",
                          borderRadius: "14px",
                          padding: "10px 12px",
                        }}
                      >
                        <strong>ملاحظات:</strong> {item.notes}
                      </div>
                    ) : null}

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                      <button
                        type="button"
                        className="erp-btn-primary"
                        disabled={!canSend(item) || actionKey === `${item.id}:send`}
                        onClick={() => quickAction(item, "send", "تم إرسال عرض السعر بنجاح")}
                      >
                        {actionKey === `${item.id}:send` ? "..." : "إرسال"}
                      </button>

                      <button
                        type="button"
                        className="erp-btn-primary"
                        disabled={!canApprove(item) || actionKey === `${item.id}:approve`}
                        onClick={() => quickAction(item, "approve", "تم اعتماد عرض السعر بنجاح")}
                      >
                        {actionKey === `${item.id}:approve` ? "..." : "اعتماد"}
                      </button>

                      <button
                        type="button"
                        className="erp-btn-secondary"
                        disabled={!canReject(item) || actionKey === `${item.id}:reject`}
                        onClick={() => quickAction(item, "reject", "تم رفض عرض السعر")}
                      >
                        {actionKey === `${item.id}:reject` ? "..." : "رفض"}
                      </button>

                      <button
                        type="button"
                        className="erp-btn-secondary"
                        disabled={!canExpire(item) || actionKey === `${item.id}:expire`}
                        onClick={() => quickAction(item, "expire", "تم تعليم عرض السعر كمنتهي")}
                      >
                        {actionKey === `${item.id}:expire` ? "..." : "إنهاء"}
                      </button>

                      <button
                        type="button"
                        className="erp-btn-primary"
                        disabled={!canConvert(item) || actionKey === `${item.id}:convert`}
                        onClick={() => quickAction(item, "convert", "تم تحويل عرض السعر إلى طلب بنجاح")}
                      >
                        {actionKey === `${item.id}:convert` ? "..." : "تحويل إلى طلب"}
                      </button>

                      <button
                        type="button"
                        className="erp-btn-danger"
                        disabled={!canCancel(item) || actionKey === `${item.id}:cancel`}
                        onClick={() => quickAction(item, "cancel", "تم إلغاء عرض السعر")}
                      >
                        {actionKey === `${item.id}:cancel` ? "..." : "إلغاء"}
                      </button>
                    </div>
                  </div>

                  {expandedId === item.id ? (
                    <div style={{ padding: "0 16px 16px", display: "grid", gap: "12px" }}>
                      <div className="erp-section-card" style={{ padding: "14px" }}>
                        <div className="erp-section-head" style={{ marginBottom: "10px" }}>
                          <div style={{ textAlign: "right" }}>
                            <h4 style={{ margin: 0 }}>تفاصيل العرض</h4>
                            <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)" }}>
                              تفاصيل سريعة للعرض المحفوظ في سجل المرحلة الحالية.
                            </p>
                          </div>
                          <div className="erp-mini-note">ID #{item.id}</div>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
                          <div className="erp-mini-note">B2B: {item.business_account_id || "-"}</div>
                          <div className="erp-mini-note">العنوان: {item.shipping_address || "-"}</div>
                          <div className="erp-mini-note">الإجمالي قبل الضريبة: {formatAmount(item.subtotal_amount)}</div>
                          <div className="erp-mini-note">الضريبة: {formatAmount(item.vat_amount)}</div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
