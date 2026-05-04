"use client";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";
import KanbanBoard from "../../components/KanbanBoard";

const API = "https://api.royalpalace-group.com/api/v1/admin/mrp/routings";
const STEPS_API = "https://api.royalpalace-group.com/api/v1/admin/mrp/routings/steps";

function renderRoutingCard(r) {
  return (<div><div style={{ fontWeight:900, fontSize:14 }}>{r.name}</div><div style={{ fontSize:12 }}>{r.code}</div></div>);
}

export default function RoutingsPage() {
  const { user, ready } = useAdminAuth("work_orders");
  const [routings, setRoutings] = useState([]);
  const [activeRouting, setActiveRouting] = useState(null);
  const [steps, setSteps] = useState([]);
  const [form, setForm] = useState({ name:"", code:"" });
  const [stepForm, setStepForm] = useState({ routing_id:"", step_no:1, step_name:"", workcenter_id:"", standard_minutes:0 });
  const [viewMode, setViewMode] = useState("table");
  const [message, setMessage] = useState("");

  async function loadRoutings() {
    const res = await fetch(API, { headers: authHeaders() });
    setRoutings(res.ok ? await res.json() : []);
  }

  async function loadSteps(rId) {
    setActiveRouting(rId);
    const res = await fetch(`${STEPS_API}?routing_id=${rId}`, { headers: authHeaders() });
    setSteps(res.ok ? await res.json() : []);
  }

  useEffect(() => { if (ready && user) loadRoutings(); }, [ready, user]);

  async function createRouting(e) {
    e.preventDefault();
    const res = await fetch(API, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(form) });
    if (!res.ok) return setMessage("فشل");
    setForm({ name:"", code:"" });
    loadRoutings();
  }

  async function addStep(e) {
    e.preventDefault();
    const payload = { ...stepForm, routing_id: activeRouting, workcenter_id: stepForm.workcenter_id ? Number(stepForm.workcenter_id) : null, standard_minutes: Number(stepForm.standard_minutes) };
    const res = await fetch(STEPS_API, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) });
    if (!res.ok) return setMessage("فشل إضافة الخطوة");
    setStepForm({ routing_id:"", step_no:1, step_name:"", workcenter_id:"", standard_minutes:0 });
    loadSteps(activeRouting);
  }

  async function deleteStep(id) {
    await fetch(`${STEPS_API}/${id}`, { method:"DELETE", headers: authHeaders() });
    loadSteps(activeRouting);
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Routings</div><h2>مسارات التصنيع</h2></div></section>
        <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">المسارات</div><div className="erp-card-value">{routings.length}</div></div></section>
        <div className="erp-section-card" style={{ marginBottom:18 }}>
          <form onSubmit={createRouting}>
            <input className="erp-input" placeholder="اسم المسار" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
            <input className="erp-input" placeholder="كود" value={form.code} onChange={e=>setForm({...form, code:e.target.value})} required />
            <button className="erp-btn-primary" type="submit">إنشاء</button>
          </form>
        </div>
        <div className="erp-section-card">
          <div className="erp-section-head"><h3>القائمة</h3>
            <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode(viewMode==="table"?"kanban":"table")}>Kanban/جدول</button>
          </div>
          {viewMode==="table" ? (
            <table className="erp-table"><thead><tr><th>ID</th><th>الاسم</th><th>الكود</th><th>خطوات</th></tr></thead><tbody>{routings.map(r=><tr key={r.id}><td>{r.id}</td><td>{r.name}</td><td>{r.code}</td><td><button onClick={()=>loadSteps(r.id)}>عرض</button></td></tr>)}</tbody></table>
          ) : (
            <KanbanBoard items={routings} statusField="is_active" statusOptions={[true, false]} statusLabels={{true:"نشط",false:"غير نشط"}} statusColors={{true:"#10b981",false:"#6b7280"}} renderCard={renderRoutingCard} onAction={(r)=><button onClick={()=>loadSteps(r.id)}>خطوات</button>} />
          )}
        </div>
        {activeRouting && (
          <div className="erp-section-card">
            <h3>خطوات المسار #{activeRouting}</h3>
            <form onSubmit={addStep} style={{display:"flex", gap:4, marginBottom:8}}>
              <input className="erp-input" placeholder="اسم الخطوة" value={stepForm.step_name} onChange={e=>setStepForm({...stepForm, step_name:e.target.value})} required />
              <input className="erp-input" type="number" placeholder="محطة العمل" value={stepForm.workcenter_id} onChange={e=>setStepForm({...stepForm, workcenter_id:e.target.value})} />
              <input className="erp-input" type="number" step="0.1" placeholder="دقائق" value={stepForm.standard_minutes} onChange={e=>setStepForm({...stepForm, standard_minutes:e.target.value})} />
              <button className="erp-btn-primary" type="submit">+</button>
            </form>
            <table className="erp-table"><tbody>{steps.map(s=><tr key={s.id}><td>{s.step_no}. {s.step_name}</td><td>محطة: {s.workcenter_id||"-"}</td><td>{s.standard_minutes} دقيقة</td><td><button onClick={()=>deleteStep(s.id)}>حذف</button></td></tr>)}</tbody></table>
          </div>
        )}
      </section>
    </main>
  );
}
