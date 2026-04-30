"use client";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import KanbanBoard from "../components/KanbanBoard";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/marketing-automation";
const emptyForm = { name: "", trigger_type: "", action_config: {}, is_active: true };
const WORKFLOW_STATUSES = ["active","inactive","running"];
const WORKFLOW_STATUS_LABELS = { active:"نشط", inactive:"غير نشط", running:"قيد التشغيل" };
const WORKFLOW_STATUS_COLORS = { active:"#10b981", inactive:"#6b7280", running:"#3b82f6" };

function renderWorkflowCard(w) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:"14px" }}>{w.name}</div>
      <div style={{ fontSize:"12px", color:"var(--rp-text-muted)" }}>{w.trigger_type||"-"}</div>
    </div>
  );
}

export default function MarketingAutomationPage() {
  const { user, ready } = useAdminAuth("marketing_automation");
  const [workflows, setWorkflows] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState("kanban");
  const [search, setSearch] = useState("");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [activeFilter, setActiveFilter] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  async function loadWorkflows() { try { const res = await fetch(API_URL, { headers: authHeaders() }); const data = await res.json(); setWorkflows(Array.isArray(data) ? data : []); } catch (err) { setMessage(err.message); } }
  useEffect(() => { if (ready && user) loadWorkflows(); }, [ready, user]);

  const filtered = useMemo(() => { let list = [...workflows]; const q = (search || "").toLowerCase(); if (triggerFilter !== "all") list = list.filter(w => w.trigger_type === triggerFilter); if (activeFilter === "active") list = list.filter(w => w.is_active); if (activeFilter === "inactive") list = list.filter(w => !w.is_active); if (q) list = list.filter(w => w.name.toLowerCase().includes(q) || w.trigger_type.includes(q)); list.sort((a,b)=>b.id-a.id); return list; }, [workflows, search, triggerFilter, activeFilter]);
  const stats = useMemo(() => ({ total: workflows.length, active: workflows.filter(w=>w.is_active).length, types: new Set(workflows.map(w=>w.trigger_type)).size }), [workflows]);
  const paged = useMemo(() => { const start = (page-1)*pageSize; return filtered.slice(start, start+pageSize); }, [filtered, page, pageSize]);
  const totalPages = Math.ceil(filtered.length / pageSize);
  useEffect(() => setPage(1), [search, triggerFilter, activeFilter, pageSize]);

  async function handleSubmit(e) { e.preventDefault(); setSubmitting(true); try { const payload = { ...form, action_config: typeof form.action_config === "string" ? JSON.parse(form.action_config) : form.action_config }; const url = editingId ? `${API_URL}/${editingId}` : API_URL; const method = editingId ? "PUT" : "POST"; const res = await fetch(url, { method, headers: {"Content-Type":"application/json",...authHeaders()}, body: JSON.stringify(payload) }); if (!res.ok) throw new Error("فشل الحفظ"); setMessage(editingId ? "تم التحديث" : "تم الإنشاء"); setForm(emptyForm); setEditingId(null); setShowForm(false); await loadWorkflows(); } catch(err) { setMessage(err.message); } finally { setSubmitting(false); } }
  async function handleDelete(id) { if (!confirm("حذف الأتمتة؟")) return; setDeletingId(id); try { const res = await fetch(`${API_URL}/${id}`, { method: "DELETE", headers: authHeaders() }); if (!res.ok) throw new Error("فشل الحذف"); setMessage("تم الحذف"); await loadWorkflows(); } catch(err) { setMessage(err.message); } finally { setDeletingId(null); } }

  if (!ready || !user) return <main>جاري التحميل...</main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero"><div><div className="erp-hero-pill">Marketing Automation</div><h2>التسويق الآلي</h2><p>إدارة سير العمل الآلي</p></div><div><button className="erp-btn-secondary" onClick={() => setShowForm(!showForm)}>{showForm ? "إخفاء النموذج" : "فتح النموذج"}</button><button className="erp-btn-primary" onClick={()=>{setForm(emptyForm);setEditingId(null);setShowForm(true);}}>إضافة</button></div></section>
        <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">إجمالي</div><div className="erp-card-value">{stats.total}</div></div><div className="erp-card"><div className="erp-card-title">نشط</div><div className="erp-card-value">{stats.active}</div></div><div className="erp-card"><div className="erp-card-title">أنواع التشغيل</div><div className="erp-card-value">{stats.types}</div></div><div className="erp-card"><div className="erp-card-title">جاهزية</div><div className="erp-card-value">-</div></div></section>
        {showForm && (<div className="erp-section-card"><form className="erp-form-grid" onSubmit={handleSubmit}><input className="erp-input" placeholder="اسم السير" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required /><select className="erp-input" value={form.trigger_type} onChange={e=>setForm({...form,trigger_type:e.target.value})}><option value="">اختر نوع التشغيل</option><option value="form_submit">تقديم نموذج</option><option value="purchase">شراء</option><option value="abandoned_cart">سلة متروكة</option></select><textarea className="erp-input" rows="4" placeholder="إعدادات الإجراء (JSON)" value={typeof form.action_config === "object" ? JSON.stringify(form.action_config) : form.action_config} onChange={e=>setForm({...form,action_config:e.target.value})} /><label className="erp-check"><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form,is_active:e.target.checked})} /><span>نشط</span></label><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : (editingId ? "تحديث" : "إنشاء")}</button><button className="erp-btn-secondary" type="button" onClick={()=>{setShowForm(false);setEditingId(null);setForm(emptyForm);}}>إلغاء</button></div></form></div>)}

        <div className="erp-section-card">
          <div style={{display:"flex",gap:"10px",marginBottom:"12px"}}>
            <input className="erp-input" placeholder="بحث..." value={search} onChange={(e)=>setSearch(e.target.value)} />
            <select className="erp-input" value={triggerFilter} onChange={(e)=>setTriggerFilter(e.target.value)}><option value="all">كل الأنواع</option><option value="form_submit">تقديم نموذج</option><option value="purchase">شراء</option><option value="abandoned_cart">سلة متروكة</option></select>
            <select className="erp-input" value={activeFilter} onChange={(e)=>setActiveFilter(e.target.value)}><option value="all">الكل</option><option value="active">نشط</option><option value="inactive">غير نشط</option></select>
            <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={{minHeight:"38px",borderRadius:"12px",padding:"0 14px",fontWeight:800}}>Kanban</button>
            <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={{minHeight:"38px",borderRadius:"12px",padding:"0 14px",fontWeight:800}}>جدول</button>
          </div>

          {viewMode==="table" && (
          <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>#</th><th>الاسم</th><th>نوع التشغيل</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>{paged.map(w => (<tr key={w.id}><td>{w.id}</td><td>{w.name}</td><td>{w.trigger_type}</td><td><span className={`erp-badge ${w.is_active ? "success" : "warning"}`}>{w.is_active ? "نشط" : "غير نشط"}</span></td><td><button className="erp-btn-secondary" onClick={()=>{setEditingId(w.id);setForm({name:w.name,trigger_type:w.trigger_type,action_config:w.action_config||{},is_active:w.is_active});setShowForm(true);}}>تعديل</button><button className="erp-btn-danger" onClick={()=>handleDelete(w.id)}>حذف</button></td></tr>))}</tbody></table></div>)}

          {viewMode==="kanban" && (
            <KanbanBoard items={filtered} statusField="is_active" statusOptions={[true,false]} statusLabels={{true:"نشط",false:"غير نشط"}} statusColors={{true:"#10b981",false:"#6b7280"}}
              renderCard={renderWorkflowCard}
              onAction={(w)=>(<><button className="erp-btn-secondary" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>{setEditingId(w.id);setForm({name:w.name,trigger_type:w.trigger_type,action_config:w.action_config||{},is_active:w.is_active});setShowForm(true);}}>تعديل</button><button className="erp-btn-danger" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>handleDelete(w.id)}>حذف</button></>)}
              emptyMessage="لا توجد أتمتة" />
          )}
        </div>
      </section>
    </main>
  );
}
