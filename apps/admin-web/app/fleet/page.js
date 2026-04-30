"use client";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/fleet/";
const PAGE_SIZE = [10, 20, 30, 50];

export default function FleetPage() {
  const { user, ready } = useAdminAuth("fleet");
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", model: "", plate_number: "", vin: "", status: "active", description: "", is_active: true });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [viewMode, setViewMode] = useState("kanban");

  async function loadData() {
    try {
      const res = await fetch(API_URL, { headers: authHeaders() });
      const data = await res.json().catch(() => []);
      if (res.ok) setItems(Array.isArray(data) ? data : []);
    } catch (e) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (ready && user) loadData(); }, [ready, user]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? items.filter(it => JSON.stringify(it).toLowerCase().includes(q)) : items;
  }, [items, search]);

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);

  const stats = useMemo(() => ({
    total: items.length,
    active: items.filter(it => it.status === "active").length,
    maintenance: items.filter(it => it.status === "maintenance").length,
    broken: items.filter(it => it.status === "broken").length,
  }), [items]);

  function resetForm() { setForm({ name: "", model: "", plate_number: "", vin: "", status: "active", description: "", is_active: true }); setEditingId(null); setShowForm(false); }
  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      model: item.model || "",
      plate_number: item.plate_number || "",
      vin: item.vin || "",
      status: item.status || "active",
      description: item.description || "",
      is_active: item.is_active !== false,
    });
    setShowForm(true);
  }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? API_URL + editingId : API_URL;
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(form),
      });
      if (!res.ok) throw new Error("فشل الحفظ");
      resetForm(); loadData();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function handleDelete(id) {
    if (!confirm("حذف المركبة؟")) return;
    try { await fetch(API_URL + id, { method: "DELETE", headers: authHeaders() }); loadData(); } catch (e) {}
  }

  function csvExport() {
    exportTableCsv("fleet.csv", ["الاسم", "الموديل", "رقم اللوحة", "VIN", "الحالة", "نشط"], filtered.map(i => [i.name || "-", i.model || "-", i.plate_number || "-", i.vin || "-", i.status || "-", i.is_active ? "نعم" : "لا"]));
  }

  function pdfExport() {
    exportTablePdf("تقرير أسطول المركبات", "أسطول المركبات", [{ label: "العدد", value: items.length }], ["الاسم", "الموديل", "رقم اللوحة", "VIN", "الحالة", "نشط"], filtered.map(i => [i.name || "-", i.model || "-", i.plate_number || "-", i.vin || "-", i.status || "-", i.is_active ? "نعم" : "لا"]));
  }

  function renderCard(item) {
    return (
      <div>
        <div style={{ fontWeight: 900, fontSize: "14px" }}>{item.name || "-"}</div>
        <div style={{ fontSize: "12px", color: "var(--rp-text-muted)" }}>{item.model || "-"} | {item.plate_number || "-"}</div>
        <div style={{ fontSize: "11px", marginTop: 4 }}>VIN: {item.vin || "-"}</div>
        <div style={{ marginTop: 4 }}><span className={`erp-badge ${item.status === "active" ? "success" : item.status === "maintenance" ? "warning" : "danger"}`}>{item.status || "-"}</span></div>
      </div>
    );
  }


  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">أسطول المركبات</div>
            <h2>إدارة أسطول المركبات</h2>
            <p>تتبع المركبات والصيانة</p>
          </div>
          <div>
            <button className="erp-btn-secondary" onClick={() => setShowForm(!showForm)}>{showForm ? "إخفاء" : "فتح"} النموذج</button>
            <button className="erp-btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>إضافة مركبة</button>
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">الإجمالي</div><div className="erp-card-value">{stats.total}</div></div>
          <div className="erp-card"><div className="erp-card-title">نشطة</div><div className="erp-card-value">{stats.active}</div></div>
          <div className="erp-card"><div className="erp-card-title">صيانة</div><div className="erp-card-value">{stats.maintenance}</div></div>
          <div className="erp-card"><div className="erp-card-title">معطلة</div><div className="erp-card-value">{stats.broken}</div></div>
        </section>

        {message && <div className="erp-form-message">{message}</div>}

        {showForm && (
          <div className="erp-section-card" style={{ marginBottom: 18 }}>
            <h3>{editingId ? "تعديل مركبة" : "مركبة جديدة"}</h3>
            <form className="erp-form-grid" onSubmit={handleSubmit}>
              <input className="erp-input" placeholder="اسم المركبة" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              <input className="erp-input" placeholder="الموديل" value={form.model} onChange={e => setForm({ ...form, model: e.target.value })} />
              <input className="erp-input" placeholder="رقم اللوحة" value={form.plate_number} onChange={e => setForm({ ...form, plate_number: e.target.value })} />
              <input className="erp-input" placeholder="رقم الشاسيه (VIN)" value={form.vin} onChange={e => setForm({ ...form, vin: e.target.value })} />
              <select className="erp-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="active">نشطة</option>
                <option value="maintenance">صيانة</option>
                <option value="broken">معطلة</option>
              </select>
              <textarea className="erp-input" rows="3" placeholder="ملاحظات" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <label className="erp-check"><input type="checkbox" checked={form.is_active} onChange={e => setForm({ ...form, is_active: e.target.checked })} /><span>نشط</span></label>
              <div className="erp-form-actions">
                <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingId ? "تحديث" : "إنشاء"}</button>
                <button className="erp-btn-secondary" type="button" onClick={resetForm}>إلغاء</button>
              </div>
            </form>
          </div>
        )}

        <div className="erp-section-card">
          <div style={{ display: "flex", gap: 10, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
            <input className="erp-input" style={{ flex: "1 1 240px" }} placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} />
            <button className={viewMode === "kanban" ? "erp-btn-primary" : "erp-btn-secondary"} style={{ minHeight: 38, borderRadius: 12, padding: "0 14px", fontWeight: 800 }} onClick={() => setViewMode("kanban")}>Kanban</button>
            <button className={viewMode === "table" ? "erp-btn-primary" : "erp-btn-secondary"} style={{ minHeight: 38, borderRadius: 12, padding: "0 14px", fontWeight: 800 }} onClick={() => setViewMode("table")}>جدول</button>
            <button className="erp-btn-secondary" onClick={csvExport}>CSV</button>
            <button className="erp-btn-primary" onClick={pdfExport}>PDF</button>
            <select className="erp-input" style={{ width: 80 }} value={pageSize} onChange={e => setPageSize(Number(e.target.value))}>
              {PAGE_SIZE.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          {viewMode === "table" && (
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>#</th>
                    <th>الاسم</th>
                    <th>الموديل</th>
                    <th>رقم اللوحة</th>
                    <th>VIN</th>
                    <th>الحالة</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(item => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.name || "-"}</td>
                      <td>{item.model || "-"}</td>
                      <td>{item.plate_number || "-"}</td>
                      <td>{item.vin || "-"}</td>
                      <td><span className={`erp-badge ${item.status === "active" ? "success" : item.status === "maintenance" ? "warning" : "danger"}`}>{item.status || "-"}</span></td>
                      <td>
                        <button className="erp-btn-secondary" style={{ marginInlineEnd: 6 }} onClick={() => startEdit(item)}>تعديل</button>
                        <button className="erp-btn-danger" onClick={() => handleDelete(item.id)}>حذف</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {viewMode === "kanban" && (
            <KanbanBoard
              items={filtered}
              statusField="status"
              statusOptions={["active", "maintenance", "broken"]}
              statusLabels={{ active: "نشطة", maintenance: "صيانة", broken: "معطلة" }}
              statusColors={{ active: "#10b981", maintenance: "#f59e0b", broken: "#ef4444" }}
              renderCard={renderCard}
              onAction={(item) => (
                <>
                  <button className="erp-btn-secondary" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => startEdit(item)}>تعديل</button>
                  <button className="erp-btn-danger" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => handleDelete(item.id)}>حذف</button>
                </>
              )}
              emptyMessage="لا توجد مركبات"
            />
          )}

          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}>
            <span>صفحة {page} من {totalPages}</span>
            <div>
              <button className="erp-btn-secondary" disabled={page === 1} onClick={() => setPage(1)}>الأولى</button>
              <button className="erp-btn-secondary" disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))}>السابقة</button>
              <button className="erp-btn-secondary" disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))}>التالية</button>
              <button className="erp-btn-secondary" disabled={page === totalPages} onClick={() => setPage(totalPages)}>الأخيرة</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
