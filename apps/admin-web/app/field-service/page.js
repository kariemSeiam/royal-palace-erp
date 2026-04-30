"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";

const ORDERS_URL = "https://api.royalpalace-group.com/api/v1/admin/field-service/orders";
const TEAMS_URL = "https://api.royalpalace-group.com/api/v1/admin/field-service/teams";
const WORKERS_URL = "https://api.royalpalace-group.com/api/v1/admin/field-service/workers";

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };
const STATUSES = ["pending", "in_progress", "completed", "cancelled"];
const STATUS_LABELS = { pending:"معلق", in_progress:"قيد التنفيذ", completed:"مكتمل", cancelled:"ملغي" };
const STATUS_COLORS = { pending:"#3b82f6", in_progress:"#f59e0b", completed:"#10b981", cancelled:"#6b7280" };
const PRIORITIES = ["low", "normal", "high", "urgent"];

function renderServiceCard(o) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:"14px" }}>{o.customer_name}</div>
      <div style={{ fontSize:"12px", color:"var(--rp-text-muted)" }}>{o.customer_phone||"-"}</div>
      <div style={{ fontSize:"11px", color:"var(--rp-text-soft)" }}>{o.address||"-"}</div>
      <div style={{ display:"flex", gap:"6px", marginTop:"4px" }}><span className="erp-badge" style={{fontSize:"11px"}}>{o.priority}</span></div>
    </div>
  );
}

export default function FieldServicePage() {
  const { user, ready } = useAdminAuth("field_service");
  const [orders, setOrders] = useState([]);
  const [teams, setTeams] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ customer_name:"",customer_phone:"",address:"",team_id:"",assigned_worker_id:"",priority:"normal",scheduled_date:"",description:"" });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("kanban");

  async function loadAll() {
    try {
      const [ordRes, teamRes, workRes] = await Promise.all([
        fetch(ORDERS_URL, { headers: authHeaders() }),
        fetch(TEAMS_URL, { headers: authHeaders() }),
        fetch(WORKERS_URL, { headers: authHeaders() }),
      ]);
      setOrders(ordRes.ok ? await ordRes.json() : []);
      setTeams(teamRes.ok ? await teamRes.json() : []);
      setWorkers(workRes.ok ? await workRes.json() : []);
    } catch (err) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  const filteredOrders = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return orders;
    return orders.filter((o) => [o.customer_name, o.customer_phone, o.address].join(" ").toLowerCase().includes(q));
  }, [orders, search]);

  function resetForm() { setForm({ customer_name:"",customer_phone:"",address:"",team_id:"",assigned_worker_id:"",priority:"normal",scheduled_date:"",description:"" }); setEditingId(null); }
  function startEdit(o) { setEditingId(o.id); setForm({ customer_name:o.customer_name||"",customer_phone:o.customer_phone||"",address:o.address||"",team_id:o.team_id||"",assigned_worker_id:o.assigned_worker_id||"",priority:o.priority||"normal",scheduled_date:o.scheduled_date||"",description:o.description||"" }); }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const payload = { ...form, team_id:form.team_id?Number(form.team_id):null, assigned_worker_id:form.assigned_worker_id?Number(form.assigned_worker_id):null };
      const url = editingId ? `${ORDERS_URL}/${editingId}` : ORDERS_URL;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الحفظ");
      setMessage(editingId ? "تم تعديل الطلب" : "تم إنشاء الطلب");
      resetForm(); await loadAll();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function deleteOrder(id) {
    if (!confirm("حذف الطلب؟")) return;
    await fetch(`${ORDERS_URL}/${id}`, { method:"DELETE", headers:authHeaders() });
    loadAll();
  }

  function handleExportCsv() {
    exportTableCsv("field_service_orders.csv", ["العميل","الهاتف","العنوان","الحالة","الأولوية","الفريق","الموظف"], filteredOrders.map((o) => [o.customer_name,o.customer_phone||"",o.address||"",o.status,o.priority,teams.find((t)=>t.id===o.team_id)?.name||"",workers.find((w)=>w.id===o.assigned_worker_id)?.id||""]));
  }
  function handleExportPdf() {
    exportTablePdf("تقرير الخدمات الميدانية","Field Service",[{ label:"عدد الطلبات", value:orders.length }],["العميل","الهاتف","العنوان","الحالة","الأولوية","الفريق","الموظف"], filteredOrders.map((o) => [o.customer_name,o.customer_phone||"",o.address||"",o.status,o.priority,teams.find((t)=>t.id===o.team_id)?.name||"",workers.find((w)=>w.id===o.assigned_worker_id)?.id||""]));
  }


  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Field Service</div><h2>الخدمات الميدانية</h2><p>إدارة طلبات الصيانة والخدمات الميدانية.</p></div><div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">طلبات</div><div className="erp-stat-box-value">{orders.length}</div></div></div></section>
        <section className="erp-kpi-grid" style={{ marginBottom:"18px" }}><div className="erp-card"><div className="erp-card-title">طلبات</div><div className="erp-card-value">{orders.length}</div></div></section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <div className="erp-section-head"><h3>{editingId ? "تعديل طلب" : "طلب خدمة جديد"}</h3></div>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}>
            <input className="erp-input" placeholder="اسم العميل" value={form.customer_name} onChange={(e)=>setForm({...form,customer_name:e.target.value})} required />
            <input className="erp-input" placeholder="الهاتف" value={form.customer_phone} onChange={(e)=>setForm({...form,customer_phone:e.target.value})} />
            <input className="erp-input" placeholder="العنوان" value={form.address} onChange={(e)=>setForm({...form,address:e.target.value})} />
            <select className="erp-input" value={form.team_id} onChange={(e)=>setForm({...form,team_id:e.target.value})}><option value="">اختر الفريق</option>{teams.map((t)=><option key={t.id} value={t.id}>{t.name}</option>)}</select>
            <select className="erp-input" value={form.assigned_worker_id} onChange={(e)=>setForm({...form,assigned_worker_id:e.target.value})}><option value="">اختر الموظف</option>{workers.map((w)=><option key={w.id} value={w.id}>موظف #{w.id}</option>)}</select>
            <select className="erp-input" value={form.priority} onChange={(e)=>setForm({...form,priority:e.target.value})}>{PRIORITIES.map((p)=><option key={p} value={p}>{p}</option>)}</select>
            <input className="erp-input" type="datetime-local" placeholder="التاريخ المجدول" value={form.scheduled_date} onChange={(e)=>setForm({...form,scheduled_date:e.target.value})} />
            <textarea className="erp-input" rows="4" placeholder="وصف المشكلة" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} />
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":editingId?"حفظ التعديل":"إنشاء الطلب"}</button>{editingId&&<button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء</button>}</div>
          </form>
        </div>
        <div className="erp-section-card">
          <div className="erp-section-head">
            <h3>قائمة الطلبات</h3>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}><input className="erp-input" placeholder="بحث..." value={search} onChange={(e)=>setSearch(e.target.value)} />
            <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={topButtonStyle}>Kanban</button>
            <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={topButtonStyle}>جدول</button>
            <button className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>CSV</button>
            <button className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>PDF</button></div>
          </div>
          {viewMode==="table" && (
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead><tr><th>ID</th><th>العميل</th><th>الهاتف</th><th>العنوان</th><th>الحالة</th><th>الأولوية</th><th>الفريق</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
              <tbody>{filteredOrders.length===0?<tr><td colSpan="9">لا توجد طلبات.</td></tr>:filteredOrders.map((o)=>(<tr key={o.id}><td>{o.id}</td><td>{o.customer_name}</td><td>{o.customer_phone||"-"}</td><td>{o.address||"-"}</td><td>{o.status}</td><td>{o.priority}</td><td>{teams.find((t)=>t.id===o.team_id)?.name||"-"}</td><td>{new Date(o.created_at).toLocaleString("ar-EG")}</td><td><div style={{ display:"flex",gap:"6px" }}><button className="erp-btn-secondary" onClick={()=>startEdit(o)}>تعديل</button><button className="erp-btn-danger" onClick={()=>deleteOrder(o.id)}>حذف</button></div></td></tr>))}</tbody>
            </table>
          </div>)}
          {viewMode==="kanban" && (
            <KanbanBoard items={filteredOrders} statusField="status" statusOptions={STATUSES} statusLabels={STATUS_LABELS} statusColors={STATUS_COLORS}
              renderCard={renderServiceCard}
              onAction={(o)=>(<><button className="erp-btn-secondary" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>startEdit(o)}>تعديل</button><button className="erp-btn-danger" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>deleteOrder(o.id)}>حذف</button></>)}
              emptyMessage="لا توجد طلبات" />
          )}
        </div>
      </section>
    </main>
  );
}
