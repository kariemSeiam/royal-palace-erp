"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";
import GanttChart from "../components/GanttChart";

const PROJ_URL = "https://api.royalpalace-group.com/api/v1/admin/project/projects";
const TASKS_URL = "https://api.royalpalace-group.com/api/v1/admin/project/tasks";
const FACTORIES_URL = "https://api.royalpalace-group.com/api/v1/admin/users/factories";

const STATUSES = ["planning","in_progress","completed","on_hold","cancelled"];
const STATUS_LABELS = { planning:"تخطيط", in_progress:"قيد التنفيذ", completed:"مكتمل", on_hold:"معلق", cancelled:"ملغي" };
const STATUS_COLORS = { planning:"#3b82f6", in_progress:"#f59e0b", completed:"#10b981", on_hold:"#8b5cf6", cancelled:"#6b7280" };

const topButtonStyle = { minHeight:"42px", borderRadius:"14px", fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };

function renderProjectCard(p) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:"14px" }}>{p.name}</div>
      <div style={{ fontSize:"12px", color:"var(--rp-text-muted)" }}>{p.code || "-"}</div>
      {p.factory_id && <div style={{ fontSize:"11px", color:"var(--rp-text-soft)" }}>مصنع #{p.factory_id}</div>}
    </div>
  );
}

export default function ProjectPage() {
  const { user, ready } = useAdminAuth("project");
  const [projects, setProjects] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [factories, setFactories] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name:"", code:"", factory_id:"", description:"", status:"planning" });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("kanban");

  async function loadAll() {
    try {
      const [projRes, taskRes, factRes] = await Promise.all([
        fetch(PROJ_URL, { headers: authHeaders() }),
        fetch(TASKS_URL, { headers: authHeaders() }),
        fetch(FACTORIES_URL, { headers: authHeaders() }),
      ]);
      setProjects(projRes.ok ? await projRes.json() : []);
      setTasks(taskRes.ok ? await taskRes.json() : []);
      setFactories(factRes.ok ? await factRes.json() : []);
    } catch (err) { setMessage("تعذر التحميل: " + err.message); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  const filteredProjects = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return projects;
    return projects.filter((p) => [p.name, p.code].join(" ").toLowerCase().includes(q));
  }, [projects, search]);

  function resetForm() { setForm({ name:"", code:"", factory_id:"", description:"", status:"planning" }); setEditingId(null); }
  function startEdit(p) { setEditingId(p.id); setForm({ name:p.name, code:p.code, factory_id:p.factory_id||"", description:p.description||"", status:p.status }); }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const url = editingId ? `${PROJ_URL}/${editingId}` : PROJ_URL;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الحفظ");
      setMessage(editingId ? "تم تعديل المشروع" : "تم إنشاء المشروع");
      resetForm(); loadAll();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function deleteProject(id) { if (!confirm("حذف المشروع؟")) return; await fetch(`${PROJ_URL}/${id}`,{method:"DELETE",headers:authHeaders()}); loadAll(); }

  function handleExportCsv() { exportTableCsv("projects_export.csv", ["الكود","الاسم","الحالة","المصنع","المدير"], filteredProjects.map((p) => [p.code, p.name, p.status, factories.find((f)=>f.id===p.factory_id)?.name||"", p.manager_user_id||""])); }
  function handleExportPdf() { exportTablePdf("تقرير المشاريع","إدارة المشاريع",[{label:"عدد المشاريع",value:projects.length}],["الكود","الاسم","الحالة","المصنع","المدير"],filteredProjects.map((p)=>[p.code,p.name,p.status,factories.find((f)=>f.id===p.factory_id)?.name||"",p.manager_user_id||""])); }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Projects</div><h2>المشاريع</h2><p>إدارة المشاريع والمهام.</p></div></section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <h3>{editingId ? "تعديل مشروع" : "إضافة مشروع جديد"}</h3>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}>
            <input className="erp-input" placeholder="اسم المشروع" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required />
            <input className="erp-input" placeholder="الكود" value={form.code} onChange={(e)=>setForm({...form,code:e.target.value})} />
            <select className="erp-input" value={form.factory_id} onChange={(e)=>setForm({...form,factory_id:e.target.value})}><option value="">اختر المصنع</option>{factories.map((f)=><option key={f.id} value={f.id}>{f.name}</option>)}</select>
            <select className="erp-input" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}>{STATUSES.map((s)=><option key={s} value={s}>{STATUS_LABELS[s]||s}</option>)}</select>
            <textarea className="erp-input" rows="3" placeholder="وصف المشروع" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} />
            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":editingId?"حفظ التعديل":"إنشاء"}</button>
              {editingId && <button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء</button>}
            </div>
          </form>
        </div>

        <div className="erp-section-card">
          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"12px", alignItems:"center" }}>
            <input className="erp-input" placeholder="بحث..." value={search} onChange={(e)=>setSearch(e.target.value)} />
            <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={topButtonStyle}>Kanban</button>
            <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={topButtonStyle}>جدول</button>
            <button className={viewMode==="gantt"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("gantt")} style={topButtonStyle}>Gantt</button>
            <button className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>CSV</button>
            <button className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>PDF</button>
          </div>

          {viewMode==="table" && (
            <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>#</th><th>الكود</th><th>الاسم</th><th>المصنع</th><th>الحالة</th><th>إجراءات</th></tr></thead>
              <tbody>{filteredProjects.length===0? <tr><td colSpan="6">لا توجد مشاريع. </td></tr>:filteredProjects.map((p)=>(<tr key={p.id}><td>{p.id}</td><td>{p.code}</td><td>{p.name}</td><td>{factories.find((f)=>f.id===p.factory_id)?.name||"-"}</td><td>{p.status}</td>
              <td><div style={{ display:"flex", gap:"6px" }}><button className="erp-btn-secondary" onClick={()=>startEdit(p)}>تعديل</button><button className="erp-btn-danger" onClick={()=>deleteProject(p.id)}>حذف</button></div></td>
              </tr>))}</tbody></table></div>
          )}

          {viewMode==="kanban" && (
            <KanbanBoard items={filteredProjects} statusField="status" statusOptions={STATUSES} statusLabels={STATUS_LABELS} statusColors={STATUS_COLORS}
              renderCard={renderProjectCard}
              onAction={(p)=>(<><button className="erp-btn-secondary" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>startEdit(p)}>تعديل</button><button className="erp-btn-danger" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>deleteProject(p.id)}>حذف</button></>)}
              emptyMessage="لا توجد مشاريع في هذه الحالة" />
          )}
        </div>
      </section>
    </main>
  );
}
