"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";

const WAREHOUSES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/warehouses";
const FACTORIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";

const emptyForm = {
  factory_id: "",
  code: "",
  name: "",
  description: "",
  is_active: true,
};

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

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

export default function WarehousesPage() {
  const { user, ready } = useAdminAuth("warehouses");
  const [items, setItems] = useState([]);
  const [factories, setFactories] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  async function loadAll() {
    const [warehousesRes, factoriesRes] = await Promise.all([
      fetch(WAREHOUSES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(FACTORIES_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);
    const warehousesData = await warehousesRes.json().catch(() => []);
    const factoriesData = await factoriesRes.json().catch(() => []);
    if (!warehousesRes.ok) throw new Error(warehousesData.detail || "فشل تحميل المخازن");
    if (!factoriesRes.ok) throw new Error(factoriesData.detail || "فشل تحميل المصانع");
    setItems(Array.isArray(warehousesData) ? warehousesData : []);
    setFactories(Array.isArray(factoriesData) ? factoriesData : []);
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء التحميل"));
  }, [ready, user]);

  const factoryMap = useMemo(() => {
    const map = {};
    factories.forEach((f) => { map[f.id] = f.name || `مصنع #${f.id}`; });
    return map;
  }, [factories]);

  const filteredItems = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return items;
    return items.filter((item) => [item.factory_name, item.code, item.name, item.description].join(" ").toLowerCase().includes(q));
  }, [items, search]);

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter((x) => x.is_active).length,
    products: items.reduce((sum, x) => sum + Number(x.products_count || 0), 0),
    stockUnits: items.reduce((sum, x) => sum + Number(x.stock_units_total || 0), 0),
  }), [items]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      factory_id: String(item.factory_id || ""),
      code: item.code || "",
      name: item.name || "",
      description: item.description || "",
      is_active: Boolean(item.is_active),
    });
    setMessage("");
  }

  async function handleSave(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const payload = {
        factory_id: Number(form.factory_id),
        code: form.code.trim(),
        name: form.name.trim(),
        description: form.description.trim() || null,
        is_active: Boolean(form.is_active),
      };
      const url = editingId ? `${WAREHOUSES_API_URL}/${editingId}` : WAREHOUSES_API_URL;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حفظ المخزن");
      setMessage(editingId ? "تم تعديل المخزن بنجاح" : "تم إنشاء المخزن بنجاح");
      resetForm();
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء الحفظ");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    const ok = window.confirm("هل تريد حذف المخزن؟");
    if (!ok) return;
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch(`${WAREHOUSES_API_URL}/${id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف المخزن");
      setMessage("تم حذف المخزن بنجاح");
      if (editingId === id) resetForm();
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء الحذف");
    } finally {
      setSubmitting(false);
    }
  }

  function handleExportCsv() {
    const headers = ["ID", "الكود", "الاسم", "المصنع", "المنتجات", "الوحدات", "نشط"];
    const rows = filteredItems.map((item) => [
      item.id, item.code || "", item.name || "", factoryMap[item.factory_id] || "",
      item.products_count || 0, item.stock_units_total || 0, item.is_active ? "نعم" : "لا"
    ]);
    exportTableCsv("warehouses_export.csv", headers, rows);
  }

  function handleExportPdf() {
    const headers = ["ID", "الكود", "الاسم", "المصنع", "المنتجات", "الوحدات", "نشط"];
    const rows = filteredItems.map((item) => [
      item.id, item.code || "", item.name || "", factoryMap[item.factory_id] || "",
      item.products_count || 0, item.stock_units_total || 0, item.is_active ? "نعم" : "لا"
    ]);
    exportTablePdf("تقرير المخازن", "المخزون / المخازن",
      [
        { label: "عدد المخازن", value: stats.total },
        { label: "النشطة", value: stats.active },
      ],
      headers, rows);
  }

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل المخازن...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">Inventory / Warehouses</div>
            <h2>المخازن</h2>
            <p>إدارة المخازن وربطها بالمصانع مع نظرة تشغيلية على الحركات والمنتجات والوحدات المخزنية.</p>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box"><div className="erp-stat-box-label">عدد المخازن</div><div className="erp-stat-box-value">{stats.total}</div></div>
            <div className="erp-stat-box"><div className="erp-stat-box-label">مخازن نشطة</div><div className="erp-stat-box-value">{stats.active}</div></div>
          </div>
        </section>

        {message ? <div className="erp-form-message">{message}</div> : null}

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">المخازن</div><div className="erp-card-value">{stats.total}</div></div>
          <div className="erp-card"><div className="erp-card-title">نشطة</div><div className="erp-card-value">{stats.active}</div></div>
          <div className="erp-card"><div className="erp-card-title">منتجات مرتبطة</div><div className="erp-card-value">{stats.products}</div></div>
          <div className="erp-card"><div className="erp-card-title">إجمالي وحدات</div><div className="erp-card-value">{formatAmount(stats.stockUnits)}</div></div>
        </section>

        <div className="erp-form-grid erp-form-grid-2">
          <div className="erp-section-card">
            <div className="erp-section-head">
              <h3 style={{ margin: 0 }}>{editingId ? "تعديل مخزن" : "إنشاء مخزن"}</h3>
            </div>
            <form className="erp-form-grid" onSubmit={handleSave}>
              <select className="erp-input" value={form.factory_id} onChange={(e) => setForm((p) => ({ ...p, factory_id: e.target.value }))}>
                <option value="">اختر المصنع</option>
                {factories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
              </select>
              <input className="erp-input" placeholder="الكود" value={form.code} onChange={(e) => setForm((p) => ({ ...p, code: e.target.value }))} />
              <input className="erp-input" placeholder="اسم المخزن" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              <textarea className="erp-input" rows="4" placeholder="الوصف" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
              <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700 }}>
                <input type="checkbox" checked={form.is_active} onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))} />
                المخزن نشط
              </label>
              <div className="erp-form-actions">
                <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : (editingId ? "حفظ التعديل" : "إنشاء المخزن")}</button>
                {editingId ? <button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء التعديل</button> : null}
              </div>
            </form>
          </div>

          <div className="erp-section-card">
            <div className="erp-section-head">
              <div style={{ textAlign: "right" }}>
                <h3 style={{ marginBottom: "4px" }}>قائمة المخازن</h3>
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <input className="erp-input" style={{ maxWidth: "420px", minHeight: "42px" }} placeholder="ابحث بالمصنع أو الاسم أو الكود..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button>
                <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button>
              </div>
            </div>
            <div style={{ display: "grid", gap: "12px", maxHeight: "70vh", overflowY: "auto" }}>
              {filteredItems.length === 0 ? (
                <div className="erp-form-message">{items.length === 0 ? "لا توجد مخازن حالياً." : "لا توجد نتائج مطابقة."}</div>
              ) : filteredItems.map((item) => (
                <div key={item.id} style={{ border: "1px solid var(--rp-border)", borderRadius: "16px", padding: "12px", background: "var(--rp-surface)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", alignItems: "center", marginBottom: "10px" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 900 }}>{item.name} ({item.code})</div>
                      <div style={{ color: "var(--rp-text-muted)", fontSize: "13px" }}>{item.factory_name}</div>
                    </div>
                    <span className={`erp-badge ${item.is_active ? "success" : "warning"}`}>{item.is_active ? "نشط" : "غير نشط"}</span>
                  </div>
                  <div className="erp-kpi-grid">
                    <div className="erp-card"><div className="erp-card-title">الحركات</div><div className="erp-card-value">{item.movements_count || 0}</div></div>
                    <div className="erp-card"><div className="erp-card-title">المنتجات</div><div className="erp-card-value">{item.products_count || 0}</div></div>
                    <div className="erp-card"><div className="erp-card-title">وحدات المخزون</div><div className="erp-card-value">{formatAmount(item.stock_units_total)}</div></div>
                  </div>
                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                    <button type="button" className="erp-btn-secondary" onClick={() => startEdit(item)}>تعديل</button>
                    <button type="button" className="erp-btn-danger" onClick={() => handleDelete(item.id)} disabled={submitting}>حذف</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
