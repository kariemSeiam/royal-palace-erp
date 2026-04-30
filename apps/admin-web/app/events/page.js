"use client";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/events/";
const PAGE_SIZE = [10, 20, 30, 50];

export default function EventsPage() {
  const { user, ready } = useAdminAuth("events");
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", location: "", event_type: "meeting", start_at: "", end_at: "", status: "planned", is_active: true });
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
    planned: items.filter(it => it.status === "planned").length,
    active: items.filter(it => it.status === "in_progress" || it.status === "planned").length,
  }), [items]);

  function resetForm() { setForm({ name: "", description: "", location: "", event_type: "meeting", start_at: "", end_at: "", status: "planned", is_active: true }); setEditingId(null); setShowForm(false); }
  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      description: item.description || "",
      location: item.location || "",
      event_type: item.event_type || "meeting",
      start_at: item.start_at ? item.start_at.substring(0, 16) : "",
      end_at: item.end_at ? item.end_at.substring(0, 16) : "",
      status: item.status || "planned",
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
    if (!confirm("حذف الفعالية؟")) return;
    try { await fetch(API_URL + id, { method: "DELETE", headers: authHeaders() }); loadData(); } catch (e) {}
  }

  function csvExport() {
    exportTableCsv("events.csv", ["الاسم", "المكان", "النوع", "البداية", "النهاية", "الحالة"], filtered.map(i => [i.name || "-", i.location || "-", i.event_type || "-", i.start_at || "-", i.end_at || "-", i.status || "-"]));
  }

  function pdfExport() {
    exportTablePdf("تقرير الفعاليات", "الفعاليات", [{ label: "العدد", value: items.length }], ["الاسم", "المكان", "النوع", "البداية", "النهاية", "الحالة"], filtered.map(i => [i.name || "-", i.location || "-", i.event_type || "-", i.start_at || "-", i.end_at || "-", i.status || "-"]));
  }

  function renderCard(item) {
    return (
      <div>
        <div style={{ fontWeight: 900, fontSize: "14px" }}>{item.name || "-"}</div>
        <div style={{ fontSize: "12px", color: "var(--rp-text-muted)" }}>{item.location || "-"} | {item.event_type || "-"}</div>
        <div style={{ fontSize: "11px", marginTop: 4 }}>{item.start_at ? new Date(item.start_at).toLocaleDateString("ar-EG") : "-"} → {item.end_at ? new Date(item.end_at).toLocaleDateString("ar-EG") : "-"}</div>
        <div style={{ marginTop: 4 }}><span className={`erp-badge ${item.status === "planned" ? "info" : "success"}`}>{item.status || "-"}</span></div>
      </div>
    );
  }


  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">الفعاليات</div>
            <h2>إدارة الفعاليات</h2>
            <p>جدولة الفعاليات والمناسبات</p>
          </div>
          <div>
            <button className="erp-btn-secondary" onClick={() => setShowForm(!showForm)}>{showForm ? "إخفاء" : "فتح"} النموذج</button>
            <button className="erp-btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>إضافة فعالية</button>
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">إجمالي الفعاليات</div><div className="erp-card-value">{stats.total}</div></div>
          <div className="erp-card"><div className="erp-card-title">مخطط لها</div><div className="erp-card-value">{stats.planned}</div></div>
          <div className="erp-card"><div className="erp-card-title">نشطة</div><div className="erp-card-value">{stats.active}</div></div>
        </section>

        {message && <div className="erp-form-message">{message}</div>}

        {showForm && (
          <div className="erp-section-card" style={{ marginBottom: 18 }}>
            <h3>{editingId ? "تعديل فعالية" : "فعالية جديدة"}</h3>
            <form className="erp-form-grid" onSubmit={handleSubmit}>
              <input className="erp-input" placeholder="اسم الفعالية" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              <textarea className="erp-input" rows="3" placeholder="الوصف" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <input className="erp-input" placeholder="المكان" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} />
              <select className="erp-input" value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}>
                <option value="meeting">اجتماع</option>
                <option value="conference">مؤتمر</option>
                <option value="workshop">ورشة عمل</option>
                <option value="party">حفل</option>
              </select>
              <input className="erp-input" type="datetime-local" value={form.start_at} onChange={e => setForm({ ...form, start_at: e.target.value })} />
              <input className="erp-input" type="datetime-local" value={form.end_at} onChange={e => setForm({ ...form, end_at: e.target.value })} />
              <select className="erp-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="planned">مخطط</option>
                <option value="in_progress">قيد التنفيذ</option>
                <option value="completed">مكتمل</option>
                <option value="cancelled">ملغي</option>
              </select>
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
                    <th>المكان</th>
                    <th>النوع</th>
                    <th>البداية</th>
                    <th>النهاية</th>
                    <th>الحالة</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(item => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.name || "-"}</td>
                      <td>{item.location || "-"}</td>
                      <td>{item.event_type || "-"}</td>
                      <td>{item.start_at ? new Date(item.start_at).toLocaleDateString("ar-EG") : "-"}</td>
                      <td>{item.end_at ? new Date(item.end_at).toLocaleDateString("ar-EG") : "-"}</td>
                      <td><span className={`erp-badge ${item.status === "planned" ? "info" : "success"}`}>{item.status || "-"}</span></td>
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
              statusOptions={["planned", "in_progress", "completed", "cancelled"]}
              statusLabels={{ planned: "مخطط", in_progress: "قيد التنفيذ", completed: "مكتمل", cancelled: "ملغي" }}
              statusColors={{ planned: "#3b82f6", in_progress: "#f59e0b", completed: "#10b981", cancelled: "#6b7280" }}
              renderCard={renderCard}
              onAction={(item) => (
                <>
                  <button className="erp-btn-secondary" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => startEdit(item)}>تعديل</button>
                  <button className="erp-btn-danger" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => handleDelete(item.id)}>حذف</button>
                </>
              )}
              emptyMessage="لا توجد فعاليات"
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
