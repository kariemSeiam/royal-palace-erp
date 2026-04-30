"use client";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/sms_marketing/";
const PAGE_SIZE = [10, 20, 30, 50];

export default function SmsMarketingPage() {
  const { user, ready } = useAdminAuth("sms_marketing");
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", scheduled_at: "", status: "draft" });
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
    scheduled: items.filter(it => it.status === "scheduled").length,
    sent: items.filter(it => it.status === "sent").length,
  }), [items]);

  function resetForm() { setForm({ name: "", description: "", scheduled_at: "", status: "draft" }); setEditingId(null); setShowForm(false); }
  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name: item.name || "",
      description: item.description || "",
      scheduled_at: item.scheduled_at ? item.scheduled_at.substring(0, 16) : "",
      status: item.status || "draft",
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
    if (!confirm("حذف الحملة؟")) return;
    try { await fetch(API_URL + id, { method: "DELETE", headers: authHeaders() }); loadData(); } catch (e) {}
  }

  function csvExport() {
    exportTableCsv("sms_marketing.csv", ["الاسم", "الوصف", "تاريخ الجدولة", "الحالة"], filtered.map(i => [i.name || "-", i.description || "-", i.scheduled_at || "-", i.status || "-"]));
  }

  function pdfExport() {
    exportTablePdf("تقرير حملات SMS", "حملات SMS", [{ label: "العدد", value: items.length }], ["الاسم", "الوصف", "تاريخ الجدولة", "الحالة"], filtered.map(i => [i.name || "-", i.description || "-", i.scheduled_at || "-", i.status || "-"]));
  }

  function renderCard(item) {
    return (
      <div>
        <div style={{ fontWeight: 900, fontSize: "14px" }}>{item.name || "-"}</div>
        <div style={{ fontSize: "12px", color: "var(--rp-text-muted)" }}>{item.description || "-"}</div>
        <div style={{ fontSize: "11px", marginTop: 4 }}>جدولة: {item.scheduled_at ? new Date(item.scheduled_at).toLocaleDateString("ar-EG") : "-"}</div>
        <div style={{ marginTop: 4 }}><span className={`erp-badge ${item.status === "sent" ? "success" : "warning"}`}>{item.status || "-"}</span></div>
      </div>
    );
  }


  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">التسويق بالرسائل</div>
            <h2>إدارة حملات SMS</h2>
            <p>جدولة وإرسال حملات الرسائل</p>
          </div>
          <div>
            <button className="erp-btn-secondary" onClick={() => setShowForm(!showForm)}>{showForm ? "إخفاء" : "فتح"} النموذج</button>
            <button className="erp-btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>إضافة حملة</button>
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">الإجمالي</div><div className="erp-card-value">{stats.total}</div></div>
          <div className="erp-card"><div className="erp-card-title">مجدولة</div><div className="erp-card-value">{stats.scheduled}</div></div>
          <div className="erp-card"><div className="erp-card-title">مرسلة</div><div className="erp-card-value">{stats.sent}</div></div>
        </section>

        {message && <div className="erp-form-message">{message}</div>}

        {showForm && (
          <div className="erp-section-card" style={{ marginBottom: 18 }}>
            <h3>{editingId ? "تعديل حملة" : "حملة جديدة"}</h3>
            <form className="erp-form-grid" onSubmit={handleSubmit}>
              <input className="erp-input" placeholder="اسم الحملة" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
              <textarea className="erp-input" rows="4" placeholder="نص الرسالة" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              <input className="erp-input" type="datetime-local" value={form.scheduled_at} onChange={e => setForm({ ...form, scheduled_at: e.target.value })} />
              <select className="erp-input" value={form.status} onChange={e => setForm({ ...form, status: e.target.value })}>
                <option value="draft">مسودة</option>
                <option value="scheduled">مجدولة</option>
                <option value="sent">مرسلة</option>
                <option value="failed">فشلت</option>
              </select>
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
                    <th>الوصف</th>
                    <th>تاريخ الجدولة</th>
                    <th>الحالة</th>
                    <th>إجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {paged.map(item => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.name || "-"}</td>
                      <td>{item.description || "-"}</td>
                      <td>{item.scheduled_at ? new Date(item.scheduled_at).toLocaleDateString("ar-EG") : "-"}</td>
                      <td><span className={`erp-badge ${item.status === "sent" ? "success" : "warning"}`}>{item.status || "-"}</span></td>
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
              statusOptions={["draft", "scheduled", "sent", "failed"]}
              statusLabels={{ draft: "مسودة", scheduled: "مجدولة", sent: "مرسلة", failed: "فشلت" }}
              statusColors={{ draft: "#6b7280", scheduled: "#3b82f6", sent: "#10b981", failed: "#ef4444" }}
              renderCard={renderCard}
              onAction={(item) => (
                <>
                  <button className="erp-btn-secondary" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => startEdit(item)}>تعديل</button>
                  <button className="erp-btn-danger" style={{ fontSize: 11, padding: "4px 8px" }} onClick={() => handleDelete(item.id)}>حذف</button>
                </>
              )}
              emptyMessage="لا توجد حملات"
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
