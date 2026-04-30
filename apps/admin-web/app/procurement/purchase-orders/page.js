"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";

const PURCHASE_ORDERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/purchase-orders";
const PURCHASE_RECEIPTS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/receipts";
const SUPPLIERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/suppliers";
const FACTORIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";
const WAREHOUSES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/warehouses";
const PRODUCTS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";

const emptyForm = {
  factory_id: "",
  supplier_id: "",
  warehouse_id: "",
  po_number: "",
  expected_date: "",
  notes: "",
  items: [{ product_id: "", quantity: "", unit_cost: "", notes: "" }],
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
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function purchaseStatusLabel(value) {
  const map = {
    draft: "مسودة",
    submitted: "مرسل",
    approved: "معتمد",
    partially_received: "استلام جزئي",
    received: "مستلم بالكامل",
    cancelled: "ملغي",
  };
  return map[value] || value || "-";
}

function productLabel(product) {
  return `${product?.name_ar || "منتج"} (${product?.sku || "-"})`;
}

function statusTone(value) {
  if (value === "approved" || value === "received") return "success";
  if (value === "partially_received") return "warning";
  return "";
}

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

export default function PurchaseOrdersPage() {
  const { user, ready } = useAdminAuth("procurement");

  const [items, setItems] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [factories, setFactories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [historyEntityId, setHistoryEntityId] = useState("");
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [supplierFilter, setSupplierFilter] = useState("all");
  const [receivePoId, setReceivePoId] = useState(null);
  const [receiveForm, setReceiveForm] = useState({ receipts: [] });
  const [actionKey, setActionKey] = useState("");

  async function loadAll() {
    const [poRes, receiptsRes, suppliersRes, factoriesRes, warehousesRes, productsRes] = await Promise.all([
      fetch(PURCHASE_ORDERS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(PURCHASE_RECEIPTS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(SUPPLIERS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(FACTORIES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(WAREHOUSES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(PRODUCTS_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);

    const poData = await poRes.json().catch(() => []);
    const receiptsData = await receiptsRes.json().catch(() => []);
    const suppliersData = await suppliersRes.json().catch(() => []);
    const factoriesData = await factoriesRes.json().catch(() => []);
    const warehousesData = await warehousesRes.json().catch(() => []);
    const productsData = await productsRes.json().catch(() => []);

    if (!poRes.ok) throw new Error(poData.detail || "فشل تحميل أوامر الشراء");
    if (!receiptsRes.ok) throw new Error(receiptsData.detail || "فشل تحميل الاستلامات");
    if (!suppliersRes.ok) throw new Error(suppliersData.detail || "فشل تحميل الموردين");
    if (!factoriesRes.ok) throw new Error(factoriesData.detail || "فشل تحميل المصانع");
    if (!warehousesRes.ok) throw new Error(warehousesData.detail || "فشل تحميل المخازن");
    if (!productsRes.ok) throw new Error(productsData.detail || "فشل تحميل المنتجات");

    setItems(Array.isArray(poData) ? poData : []);
    setReceipts(Array.isArray(receiptsData) ? receiptsData : []);
    setSuppliers(Array.isArray(suppliersData) ? suppliersData : []);
    setFactories(Array.isArray(factoriesData) ? factoriesData : []);
    setWarehouses(Array.isArray(warehousesData) ? warehousesData : []);
    setProducts(Array.isArray(productsData) ? productsData : []);
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء التحميل"));
  }, [ready, user]);

  const stats = useMemo(() => ({
    total: items.length,
    draft: items.filter((x) => x.status === "draft").length,
    approved: items.filter((x) => x.status === "approved").length,
    partial: items.filter((x) => x.status === "partially_received").length,
    received: items.filter((x) => x.status === "received").length,
    totalValue: items.reduce((sum, x) => sum + Number(x.total_value || 0), 0),
    totalReceipts: receipts.length,
  }), [items, receipts]);

  const filteredItems = useMemo(() => {
    const q = normalizeText(search);
    return items.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (factoryFilter !== "all" && String(item.factory_id) !== String(factoryFilter)) return false;
      if (supplierFilter !== "all" && String(item.supplier_id) !== String(supplierFilter)) return false;
      if (!q) return true;

      const haystack = [
        item.id, item.po_number, item.factory_name, item.supplier_name, item.supplier_code,
        item.warehouse_name, item.warehouse_code, item.status, item.notes,
        ...(Array.isArray(item.items) ? item.items.flatMap((x) => [x.product_name, x.product_sku, x.notes]) : []),
      ].join(" ").toLowerCase();

      return haystack.includes(q);
    });
  }, [items, search, statusFilter, factoryFilter, supplierFilter]);

  const scopedSuppliers = useMemo(() => {
    if (!form.factory_id) return suppliers;
    return suppliers.filter((item) => String(item.factory_id) === String(form.factory_id));
  }, [suppliers, form.factory_id]);

  const scopedWarehouses = useMemo(() => {
    if (!form.factory_id) return warehouses;
    return warehouses.filter((item) => String(item.factory_id) === String(form.factory_id));
  }, [warehouses, form.factory_id]);

  const scopedProducts = useMemo(() => {
    if (!form.factory_id) return products;
    return products.filter((item) => String(item.factory_id) === String(form.factory_id));
  }, [products, form.factory_id]);

  function updateField(field, value) {
    setForm((prev) => ({
      ...prev,
      [field]: value,
      ...(field === "factory_id" ? {
        supplier_id: "",
        warehouse_id: "",
        items: prev.items.map((x) => ({ ...x, product_id: "" })),
      } : {}),
    }));
  }

  function updateItemLine(index, field, value) {
    setForm((prev) => {
      const nextItems = [...prev.items];
      nextItems[index] = { ...nextItems[index], [field]: value };
      return { ...prev, items: nextItems };
    });
  }

  function addItemLine() {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { product_id: "", quantity: "", unit_cost: "", notes: "" }],
    }));
  }

  function removeItemLine(index) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(po) {
    setEditingId(po.id);
    setForm({
      factory_id: String(po.factory_id || ""),
      supplier_id: String(po.supplier_id || ""),
      warehouse_id: String(po.warehouse_id || ""),
      po_number: po.po_number || "",
      expected_date: po.expected_date || "",
      notes: po.notes || "",
      items: Array.isArray(po.items) && po.items.length
        ? po.items.map((item) => ({
            product_id: String(item.product_id || ""),
            quantity: String(item.quantity || ""),
            unit_cost: String(item.unit_cost || ""),
            notes: item.notes || "",
          }))
        : [{ product_id: "", quantity: "", unit_cost: "", notes: "" }],
    });
    setMessage("");
    setReceivePoId(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleCreateOrUpdate(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const payload = {
        factory_id: form.factory_id ? Number(form.factory_id) : null,
        supplier_id: Number(form.supplier_id),
        warehouse_id: Number(form.warehouse_id),
        po_number: form.po_number.trim(),
        expected_date: form.expected_date || null,
        notes: form.notes.trim() || null,
        items: form.items.map((item) => ({
          product_id: Number(item.product_id),
          quantity: Number(item.quantity),
          unit_cost: Number(item.unit_cost),
          notes: item.notes.trim() || null,
        })),
      };

      const url = editingId ? `${PURCHASE_ORDERS_API_URL}/${editingId}` : PURCHASE_ORDERS_API_URL;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || (editingId ? "فشل تعديل أمر الشراء" : "فشل إنشاء أمر الشراء"));

      setMessage(editingId ? "تم تعديل أمر الشراء بنجاح" : "تم إنشاء أمر الشراء بنجاح");
      resetForm();
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSubmitting(false);
    }
  }

  async function changeStatus(id, status) {
    setActionKey(`status:${id}:${status}`);
    setMessage("");

    try {
      const current = items.find((x) => x.id === id);
      const res = await fetch(`${PURCHASE_ORDERS_API_URL}/${id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          status,
          supplier_id: current?.supplier_id,
          warehouse_id: current?.warehouse_id,
          po_number: current?.po_number,
          expected_date: current?.expected_date,
          notes: current?.notes,
          items: (current?.items || []).map((item) => ({
            product_id: item.product_id,
            quantity: item.quantity,
            unit_cost: item.unit_cost,
            notes: item.notes,
          })),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحديث حالة أمر الشراء");

      setMessage("تم تحديث حالة أمر الشراء");
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء تحديث الحالة");
    } finally {
      setActionKey("");
    }
  }

  async function handleDelete(id) {
    const ok = window.confirm("هل تريد حذف أمر الشراء؟");
    if (!ok) return;

    setActionKey(`delete:${id}`);
    setMessage("");

    try {
      const res = await fetch(`${PURCHASE_ORDERS_API_URL}/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف أمر الشراء");

      if (editingId === id) resetForm();
      if (receivePoId === id) setReceivePoId(null);

      setMessage("تم حذف أمر الشراء بنجاح");
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء الحذف");
    } finally {
      setActionKey("");
    }
  }

  function startReceive(po) {
    setReceivePoId(po.id);
    setReceiveForm({
      receipts: (po.items || []).map((item) => ({
        purchase_order_item_id: item.id,
        received_quantity: "",
        notes: "",
      })),
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function setReceiveValue(index, field, value) {
    setReceiveForm((prev) => {
      const next = [...prev.receipts];
      next[index] = { ...next[index], [field]: value };
      return { ...prev, receipts: next };
    });
  }

  async function submitReceive(po) {
    setActionKey(`receive:${po.id}`);
    setMessage("");

    try {
      const payload = {
        receipts: receiveForm.receipts
          .filter((item) => Number(item.received_quantity || 0) > 0)
          .map((item) => ({
            purchase_order_item_id: Number(item.purchase_order_item_id),
            received_quantity: Number(item.received_quantity),
            notes: item.notes.trim() || null,
          })),
      };

      const res = await fetch(`${PURCHASE_ORDERS_API_URL}/${po.id}/receive`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تسجيل الاستلام");

      setReceivePoId(null);
      setMessage("تم تسجيل الاستلام بنجاح");
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء تسجيل الاستلام");
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
      const res = await fetch(`${AUDIT_ENTITY_HISTORY_API_URL}?entity_type=purchase_order&entity_id=${encodeURIComponent(historyEntityId)}`, {
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
    const headers = ["رقم الأمر", "المصنع", "المورد", "المخزن", "الحالة", "القيمة"];
    const rows = filteredItems.map((item) => [item.po_number, item.factory_name || "", item.supplier_name || "", item.warehouse_name || "", purchaseStatusLabel(item.status), formatAmount(item.total_value)]);
    exportTableCsv("purchase_orders_export.csv", headers, rows);
  }

  function handleExportPdf() {
    const headers = ["رقم الأمر", "المصنع", "المورد", "المخزن", "الحالة", "القيمة"];
    const rows = filteredItems.map((item) => [item.po_number, item.factory_name || "", item.supplier_name || "", item.warehouse_name || "", purchaseStatusLabel(item.status), formatAmount(item.total_value)]);
    exportTablePdf("تقرير أوامر الشراء", "المشتريات / أوامر الشراء", [{ label: "عدد الأوامر", value: stats.total }, { label: "القيمة الإجمالية", value: formatAmount(stats.totalValue) }], headers, rows);
  }

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل أوامر الشراء...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">Procurement / Purchase Orders</div>
            <h2>أوامر الشراء</h2>
            <p>إدارة أوامر الشراء والاستلامات وبنود الموردين على واجهة عربية نظيفة ومهنية.</p>
            <div className="erp-hero-actions">
              <div className="erp-hero-pill">الإجمالي: {stats.total}</div>
              <div className="erp-hero-pill">معتمد: {stats.approved}</div>
              <div className="erp-hero-pill">استلام جزئي: {stats.partial}</div>
              <div className="erp-hero-pill">مستلم بالكامل: {stats.received}</div>
            </div>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">قيمة الأوامر</div>
              <div className="erp-stat-box-value">{formatAmount(stats.totalValue)}</div>
            </div>
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">عدد الاستلامات</div>
              <div className="erp-stat-box-value">{stats.totalReceipts}</div>
            </div>
            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">إجمالي الأوامر</div><div className="erp-card-value">{stats.total}</div></div>
          <div className="erp-card"><div className="erp-card-title">معتمدة</div><div className="erp-card-value">{stats.approved}</div></div>
          <div className="erp-card"><div className="erp-card-title">استلامات</div><div className="erp-card-value">{stats.totalReceipts}</div></div>
          <div className="erp-card"><div className="erp-card-title">القيمة الإجمالية</div><div className="erp-card-value">{formatAmount(stats.totalValue)}</div></div>
        </section>

        {message ? <div className="erp-form-message">{message}</div> : null}

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head" style={{ marginBottom: "18px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ margin: 0 }}>{editingId ? "تعديل أمر شراء" : "إنشاء أمر شراء"}</h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)" }}>
                أنشئ أو حدّث أمر الشراء مع البنود والمخزن والمورد والمصنع المستهدف.
              </p>
            </div>
          </div>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleCreateOrUpdate}>
            <div>
              <label className="erp-label">المصنع</label>
              <select className="erp-input" value={form.factory_id} onChange={(e) => updateField("factory_id", e.target.value)}>
                <option value="">اختر المصنع</option>
                {factories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
            </div>
            <div>
              <label className="erp-label">المورد</label>
              <select className="erp-input" value={form.supplier_id} onChange={(e) => updateField("supplier_id", e.target.value)}>
                <option value="">اختر المورد</option>
                {scopedSuppliers.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
              </select>
            </div>
            <div>
              <label className="erp-label">المخزن</label>
              <select className="erp-input" value={form.warehouse_id} onChange={(e) => updateField("warehouse_id", e.target.value)}>
                <option value="">اختر المخزن</option>
                {scopedWarehouses.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
              </select>
            </div>
            <div>
              <label className="erp-label">رقم أمر الشراء</label>
              <input className="erp-input" value={form.po_number} onChange={(e) => updateField("po_number", e.target.value)} />
            </div>
            <div>
              <label className="erp-label">تاريخ التوقع</label>
              <input type="date" className="erp-input" value={form.expected_date} onChange={(e) => updateField("expected_date", e.target.value)} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <label className="erp-label">ملاحظات</label>
              <textarea className="erp-input" rows="3" value={form.notes} onChange={(e) => updateField("notes", e.target.value)} />
            </div>
            <div style={{ gridColumn: "1 / -1" }}>
              <div className="erp-section-head" style={{ marginBottom: "12px" }}>
                <h4 style={{ margin: 0 }}>بنود أمر الشراء</h4>
                <button type="button" className="erp-btn-secondary" onClick={addItemLine}>إضافة بند</button>
              </div>
              <div style={{ display: "grid", gap: "12px" }}>
                {form.items.map((item, index) => (
                  <div key={`line-${index}`} style={{ border: "1px solid var(--rp-border)", borderRadius: "16px", padding: "12px", background: "var(--rp-surface-soft)" }}>
                    <div className="erp-form-grid erp-form-grid-2">
                      <div>
                        <label className="erp-label">المنتج</label>
                        <select className="erp-input" value={item.product_id} onChange={(e) => updateItemLine(index, "product_id", e.target.value)}>
                          <option value="">اختر المنتج</option>
                          {scopedProducts.map((product) => <option key={product.id} value={product.id}>{productLabel(product)}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="erp-label">الكمية</label>
                        <input type="number" min="0" step="0.01" className="erp-input" value={item.quantity} onChange={(e) => updateItemLine(index, "quantity", e.target.value)} />
                      </div>
                      <div>
                        <label className="erp-label">تكلفة الوحدة</label>
                        <input type="number" min="0" step="0.01" className="erp-input" value={item.unit_cost} onChange={(e) => updateItemLine(index, "unit_cost", e.target.value)} />
                      </div>
                      <div>
                        <label className="erp-label">قيمة البند</label>
                        <input className="erp-input" readOnly value={formatAmount((Number(item.quantity || 0) * Number(item.unit_cost || 0)) || 0)} />
                      </div>
                      <div style={{ gridColumn: "1 / -1" }}>
                        <label className="erp-label">ملاحظات البند</label>
                        <input className="erp-input" value={item.notes} onChange={(e) => updateItemLine(index, "notes", e.target.value)} />
                      </div>
                    </div>
                    {form.items.length > 1 ? (
                      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "10px" }}>
                        <button type="button" className="erp-btn-danger" onClick={() => removeItemLine(index)}>حذف البند</button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            </div>
            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : (editingId ? "حفظ التعديل" : "إنشاء أمر الشراء")}</button>
              {editingId ? <button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء التعديل</button> : null}
            </div>
          </form>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ marginBottom: "4px" }}>سجل أوامر الشراء</h3>
              <p style={{ margin: 0 }}>فلترة وبحث وإدارة واستلام مباشر للبنود من نفس الصفحة.</p>
            </div>
            <div style={{ display: "grid", gap: "10px", width: "100%" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input className="erp-input" style={{ minHeight: "42px", borderRadius: "14px", flex: "1 1 240px" }} placeholder="ابحث برقم الأمر أو المورد أو المنتج..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="erp-input" style={{ minHeight: "42px", borderRadius: "14px", minWidth: "170px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">كل الحالات</option>
                  <option value="draft">مسودة</option>
                  <option value="submitted">مرسل</option>
                  <option value="approved">معتمد</option>
                  <option value="partially_received">استلام جزئي</option>
                  <option value="received">مستلم بالكامل</option>
                  <option value="cancelled">ملغي</option>
                </select>
                <select className="erp-input" style={{ minHeight: "42px", borderRadius: "14px", minWidth: "170px" }} value={factoryFilter} onChange={(e) => setFactoryFilter(e.target.value)}>
                  <option value="all">كل المصانع</option>
                  {factories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <select className="erp-input" style={{ minHeight: "42px", borderRadius: "14px", minWidth: "170px" }} value={supplierFilter} onChange={(e) => setSupplierFilter(e.target.value)}>
                  <option value="all">كل الموردين</option>
                  {suppliers.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
                </select>
                <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button>
                <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            {filteredItems.length === 0 ? (
              <div className="erp-form-message">{items.length === 0 ? "لا توجد أوامر شراء حالياً." : "لا توجد نتائج مطابقة."}</div>
            ) : filteredItems.map((item) => (
              <div key={item.id} style={{ border: "1px solid var(--rp-border)", borderRadius: "18px", background: "var(--rp-surface)", overflow: "hidden" }}>
                <div style={{ padding: "14px 16px", background: "rgba(15, 23, 42, 0.04)", display: "grid", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 900, fontSize: "16px" }}>{item.po_number}</div>
                      <div style={{ color: "var(--rp-text-muted)", fontSize: "13px" }}>
                        {item.factory_name} · {item.supplier_name} ({item.supplier_code}) · {item.warehouse_name}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <span className={`erp-badge ${statusTone(item.status)}`}>{purchaseStatusLabel(item.status)}</span>
                      <span className="erp-badge">{formatAmount(item.total_value)}</span>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button type="button" className="erp-btn-secondary" onClick={() => startEdit(item)}>تعديل</button>
                    <button type="button" className="erp-btn-primary" disabled={actionKey === `status:${item.id}:submitted`} onClick={() => changeStatus(item.id, "submitted")}>إرسال</button>
                    <button type="button" className="erp-btn-primary" disabled={actionKey === `status:${item.id}:approved`} onClick={() => changeStatus(item.id, "approved")}>اعتماد</button>
                    <button type="button" className="erp-btn-primary" disabled={actionKey === `receive:${item.id}`} onClick={() => startReceive(item)}>استلام</button>
                    <button type="button" className="erp-btn-danger" disabled={actionKey === `status:${item.id}:cancelled`} onClick={() => changeStatus(item.id, "cancelled")}>إلغاء</button>
                    <button type="button" className="erp-btn-danger" disabled={actionKey === `delete:${item.id}`} onClick={() => handleDelete(item.id)}>حذف</button>
                  </div>
                </div>

                <div style={{ padding: "14px 16px" }}>
                  <div className="erp-table-shell" style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "14px" }}>
                    <table className="erp-table" style={{ minWidth: "1000px" }}>
                      <thead>
                        <tr>
                          <th>المنتج</th>
                          <th>SKU</th>
                          <th>الكمية</th>
                          <th>المستلم</th>
                          <th>المتبقي</th>
                          <th>تكلفة الوحدة</th>
                          <th>إجمالي البند</th>
                          <th>ملاحظات</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(item.items || []).map((line) => (
                          <tr key={line.id}>
                            <td>{line.product_name}</td>
                            <td>{line.product_sku}</td>
                            <td>{formatAmount(line.quantity)}</td>
                            <td>{formatAmount(line.received_quantity)}</td>
                            <td>{formatAmount(line.remaining_quantity)}</td>
                            <td>{formatAmount(line.unit_cost)}</td>
                            <td>{formatAmount(line.line_total)}</td>
                            <td>{line.notes || "-"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {receivePoId === item.id ? (
                    <div style={{ marginTop: "14px", border: "1px solid var(--rp-border)", borderRadius: "16px", padding: "12px", background: "#f8fafc" }}>
                      <div style={{ fontWeight: 800, marginBottom: "10px" }}>تسجيل استلام جديد</div>
                      <div style={{ display: "grid", gap: "12px" }}>
                        {receiveForm.receipts.map((line, index) => {
                          const poLine = (item.items || []).find((x) => String(x.id) === String(line.purchase_order_item_id));
                          return (
                            <div key={`recv-${line.purchase_order_item_id}`} className="erp-form-grid erp-form-grid-2" style={{ border: "1px solid var(--rp-border)", borderRadius: "14px", padding: "12px", background: "#fff" }}>
                              <div>
                                <label className="erp-label">البند</label>
                                <input className="erp-input" readOnly value={`${poLine?.product_name || "بند"} (${poLine?.product_sku || "-"})`} />
                              </div>
                              <div>
                                <label className="erp-label">المتبقي</label>
                                <input className="erp-input" readOnly value={formatAmount(poLine?.remaining_quantity || 0)} />
                              </div>
                              <div>
                                <label className="erp-label">الكمية المستلمة الآن</label>
                                <input type="number" min="0" step="0.01" className="erp-input" value={line.received_quantity} onChange={(e) => setReceiveValue(index, "received_quantity", e.target.value)} />
                              </div>
                              <div>
                                <label className="erp-label">ملاحظات</label>
                                <input className="erp-input" value={line.notes} onChange={(e) => setReceiveValue(index, "notes", e.target.value)} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <div className="erp-form-actions" style={{ marginTop: "12px" }}>
                        <button type="button" className="erp-btn-primary" onClick={() => submitReceive(item)} disabled={actionKey === `receive:${item.id}`}>{actionKey === `receive:${item.id}` ? "جارٍ التسجيل..." : "حفظ الاستلام"}</button>
                        <button type="button" className="erp-btn-secondary" onClick={() => setReceivePoId(null)}>إغلاق</button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
