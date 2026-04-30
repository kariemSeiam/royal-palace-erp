"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";

const TICKETS_URL = "https://api.royalpalace-group.com/api/v1/admin/helpdesk/tickets";
const TEAMS_URL = "https://api.royalpalace-group.com/api/v1/admin/helpdesk/teams";

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };
const STATUSES = ["new", "in_progress", "resolved", "closed"];
const STATUS_LABELS = { new:"جديد", in_progress:"قيد المعالجة", resolved:"تم الحل", closed:"مغلق" };
const STATUS_COLORS = { new:"#3b82f6", in_progress:"#f59e0b", resolved:"#10b981", closed:"#6b7280" };
const PRIORITIES = ["low", "normal", "high", "urgent"];
const TYPES = ["issue", "question", "feature_request"];

function renderTicketCard(t) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:"14px" }}>{t.subject}</div>
      <div style={{ fontSize:"12px", color:"var(--rp-text-muted)" }}>{t.customer_name || "-"}</div>
      <div style={{ display:"flex", gap:"6px", marginTop:"4px", flexWrap:"wrap" }}>
        <span className="erp-badge" style={{ fontSize:"11px" }}>{t.priority}</span>
        <span className="erp-badge" style={{ fontSize:"11px" }}>{t.ticket_type}</span>
      </div>
    </div>
  );
}

export default function HelpdeskPage() {
  const { user, ready } = useAdminAuth("helpdesk");
  const [tickets, setTickets] = useState([]);
  const [teams, setTeams] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ subject: "", description: "", team_id: "", priority: "normal", ticket_type: "issue", customer_name: "", customer_email: "", customer_phone: "" });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("kanban");

  async function loadAll() {
    try {
      const [ticketRes, teamRes] = await Promise.all([
        fetch(TICKETS_URL, { headers: authHeaders() }),
        fetch(TEAMS_URL, { headers: authHeaders() }),
      ]);
      setTickets(ticketRes.ok ? await ticketRes.json() : []);
      setTeams(teamRes.ok ? await teamRes.json() : []);
    } catch (err) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  const filteredTickets = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return tickets;
    return tickets.filter((t) => [t.subject, t.customer_name, t.customer_email].join(" ").toLowerCase().includes(q));
  }, [tickets, search]);

  function resetForm() { setForm({ subject: "", description: "", team_id: "", priority: "normal", ticket_type: "issue", customer_name: "", customer_email: "", customer_phone: "" }); setEditingId(null); }
  function startEdit(t) { setEditingId(t.id); setForm({ subject: t.subject, description: t.description || "", team_id: t.team_id || "", priority: t.priority, ticket_type: t.ticket_type, customer_name: t.customer_name || "", customer_email: t.customer_email || "", customer_phone: t.customer_phone || "" }); }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const payload = { ...form, team_id: form.team_id ? Number(form.team_id) : null };
      const url = editingId ? `${TICKETS_URL}/${editingId}` : TICKETS_URL;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الحفظ");
      setMessage(editingId ? "تم تعديل التذكرة" : "تم إنشاء التذكرة");
      resetForm(); await loadAll();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function deleteTicket(id) {
    if (!confirm("حذف التذكرة؟")) return;
    try { await fetch(`${TICKETS_URL}/${id}`, { method: "DELETE", headers: authHeaders() }); loadAll(); }
    catch (err) { setMessage(err.message); }
  }

  function handleExportCsv() {
    exportTableCsv("helpdesk_tickets.csv", ["الموضوع", "العميل", "الحالة", "الأولوية", "النوع", "الفريق"], filteredTickets.map((t) => [t.subject, t.customer_name || "", t.status, t.priority, t.ticket_type, teams.find((team) => team.id === t.team_id)?.name || ""]));
  }
  function handleExportPdf() {
    exportTablePdf("تقرير تذاكر الدعم", "Helpdesk", [{ label: "عدد التذاكر", value: tickets.length }], ["الموضوع", "العميل", "الحالة", "الأولوية", "النوع", "الفريق"], filteredTickets.map((t) => [t.subject, t.customer_name || "", t.status, t.priority, t.ticket_type, teams.find((team) => team.id === t.team_id)?.name || ""]));
  }


  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">Helpdesk</div><h2>الدعم الفني</h2><p>إدارة تذاكر الدعم وفرق الخدمة.</p></div>
          <div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">تذاكر</div><div className="erp-stat-box-value">{tickets.length}</div></div></div>
        </section>
        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">تذاكر</div><div className="erp-card-value">{tickets.length}</div></div>
        </section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head"><h3>{editingId ? "تعديل تذكرة" : "تذكرة جديدة"}</h3></div>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}>
            <input className="erp-input" placeholder="الموضوع" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} required />
            <select className="erp-input" value={form.team_id} onChange={(e) => setForm({ ...form, team_id: e.target.value })}>
              <option value="">اختر الفريق</option>
              {teams.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
            <select className="erp-input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              {PRIORITIES.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
            <select className="erp-input" value={form.ticket_type} onChange={(e) => setForm({ ...form, ticket_type: e.target.value })}>
              {TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
            <input className="erp-input" placeholder="اسم العميل" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            <input className="erp-input" placeholder="بريد العميل" value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
            <input className="erp-input" placeholder="هاتف العميل" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            <textarea className="erp-input" rows="4" placeholder="وصف المشكلة" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إنشاء التذكرة"}</button>
              {editingId && <button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء</button>}
            </div>
          </form>
        </div>
        <div className="erp-section-card">
          <div className="erp-section-head">
            <h3>قائمة التذاكر</h3>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input className="erp-input" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={topButtonStyle}>Kanban</button>
              <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={topButtonStyle}>جدول</button>
              <button className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>CSV</button>
              <button className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>PDF</button>
            </div>
          </div>
          {viewMode==="table" && (
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead><tr><th>ID</th><th>الموضوع</th><th>العميل</th><th>الحالة</th><th>الأولوية</th><th>النوع</th><th>الفريق</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
              <tbody>{filteredTickets.length === 0 ? <tr><td colSpan="9">لا توجد تذاكر.</td></tr> : filteredTickets.map((t) => (<tr key={t.id}><td>{t.id}</td><td>{t.subject}</td><td>{t.customer_name || "-"}</td><td>{t.status}</td><td>{t.priority}</td><td>{t.ticket_type}</td><td>{teams.find((team) => team.id === t.team_id)?.name || "-"}</td><td>{new Date(t.created_at).toLocaleString("ar-EG")}</td><td><div style={{ display: "flex", gap: "6px" }}><button className="erp-btn-secondary" onClick={() => startEdit(t)}>تعديل</button><button className="erp-btn-danger" onClick={() => deleteTicket(t.id)}>حذف</button></div></td></tr>))}</tbody>
            </table>
          </div>)}
          {viewMode==="kanban" && (
            <KanbanBoard items={filteredTickets} statusField="status" statusOptions={STATUSES} statusLabels={STATUS_LABELS} statusColors={STATUS_COLORS}
              renderCard={renderTicketCard}
              onAction={(t)=>(<><button className="erp-btn-secondary" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>startEdit(t)}>تعديل</button><button className="erp-btn-danger" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>deleteTicket(t.id)}>حذف</button></>)}
              emptyMessage="لا توجد تذاكر" />
          )}
        </div>
      </section>
    </main>
  );
}
