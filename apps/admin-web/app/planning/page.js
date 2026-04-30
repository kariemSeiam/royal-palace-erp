"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const SLOTS_URL = "https://api.royalpalace-group.com/api/v1/admin/planning/slots";
const RESOURCES_URL = "https://api.royalpalace-group.com/api/v1/admin/planning/resources";

const COLORS = ["#3b82f6","#ef4444","#10b981","#f59e0b","#8b5cf6","#ec4899","#06b6d4","#84cc16"];

export default function PlanningPage() {
  const { user, ready } = useAdminAuth("planning");
  const [slots, setSlots] = useState([]);
  const [resources, setResources] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ resource_id:"", planned_start_at:"", planned_end_at:"", notes:"" });
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    try {
      const [slotRes, resRes] = await Promise.all([
        fetch(SLOTS_URL, { headers: authHeaders() }),
        fetch(RESOURCES_URL, { headers: authHeaders() }),
      ]);
      setSlots(slotRes.ok ? await slotRes.json() : []);
      setResources(resRes.ok ? await resRes.json() : []);
    } catch (err) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  async function handleCreate(e) {
    e.preventDefault(); setSubmitting(true);
    try {
      const payload = { ...form, resource_id: Number(form.resource_id) };
      const res = await fetch(SLOTS_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء");
      setForm({ resource_id:"", planned_start_at:"", planned_end_at:"", notes:"" });
      loadAll();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function deleteSlot(id) {
    if (!confirm("حذف الفترة؟")) return;
    await fetch(`${SLOTS_URL}/${id}`, { method:"DELETE", headers: authHeaders() });
    loadAll();
  }

  const minDate = slots.length ? new Date(Math.min(...slots.map((s) => new Date(s.planned_start_at).getTime()))) : new Date();
  const maxDate = slots.length ? new Date(Math.max(...slots.map((s) => new Date(s.planned_end_at).getTime()))) : new Date();
  const totalDays = Math.max(1, Math.ceil((maxDate - minDate) / (1000 * 60 * 60 * 24)) + 1);
  const dayWidth = Math.max(40, Math.min(120, 900 / totalDays));

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  // تعريف items لاستخدامها في KPI grid (إذا وجد)
  const items = slots;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">Planning / Gantt</div><h2>التخطيط المتقدم</h2><p>جدولة الموظفين والمعدات على مدار زمني.</p></div>
          <div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">فترات</div><div className="erp-stat-box-value">{slots.length}</div></div><div className="erp-stat-box"><div className="erp-stat-box-label">موارد</div><div className="erp-stat-box-value">{resources.length}</div></div></div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">إجمالي الفترات</div><div className="erp-card-value">{slots.length}</div></div>
          <div className="erp-card"><div className="erp-card-title">الموارد</div><div className="erp-card-value">{resources.length}</div></div>
        </section>

        {message ? <div className="erp-form-message">{message}</div> : null}

        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <div className="erp-section-head"><h3>إضافة فترة زمنية</h3></div>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleCreate}>
            <select className="erp-input" value={form.resource_id} onChange={(e)=>setForm({...form,resource_id:e.target.value})} required>
              <option value="">اختر المورد</option>
              {resources.map((r)=><option key={r.id} value={r.id}>{r.name} ({r.resource_type})</option>)}
            </select>
            <input className="erp-input" type="datetime-local" placeholder="البداية المخططة" value={form.planned_start_at} onChange={(e)=>setForm({...form,planned_start_at:e.target.value})} required />
            <input className="erp-input" type="datetime-local" placeholder="النهاية المخططة" value={form.planned_end_at} onChange={(e)=>setForm({...form,planned_end_at:e.target.value})} required />
            <input className="erp-input" placeholder="ملاحظات" value={form.notes} onChange={(e)=>setForm({...form,notes:e.target.value})} />
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":"إضافة الفترة"}</button></div>
          </form>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head"><h3>مخطط Gantt</h3></div>
          {slots.length === 0 ? <div className="erp-mini-note">لا توجد فترات زمنية بعد.</div> : (
            <div style={{ overflowX:"auto", border:"1px solid var(--rp-border)", borderRadius:"16px", background:"#fff" }}>
              <div style={{ minWidth: totalDays * dayWidth + 250 }}>
                <div style={{ display:"flex", borderBottom:"1px solid var(--rp-border)", position:"sticky", top:0, background:"#f8fafc", zIndex:2 }}>
                  <div style={{ width:250, padding:"10px", fontWeight:800 }}>المورد</div>
                  {Array.from({ length: totalDays }).map((_, i) => {
                    const d = new Date(minDate); d.setDate(d.getDate() + i);
                    return <div key={i} style={{ width:dayWidth, padding:"6px 2px", textAlign:"center", fontSize:10, borderRight:"1px solid #eee" }}>{d.toLocaleDateString("ar-EG",{month:"short",day:"numeric"})}</div>;
                  })}
                </div>
                {resources.filter((r) => slots.some((s) => s.resource_id === r.id)).map((resource, idx) => {
                  const resourceSlots = slots.filter((s) => s.resource_id === resource.id);
                  return (
                    <div key={resource.id} style={{ display:"flex", borderBottom:"1px solid var(--rp-border)", background: idx%2===0?"#fff":"#f8fafc" }}>
                      <div style={{ width:250, padding:"8px 10px", fontWeight:700, fontSize:13 }}>{resource.name}</div>
                      <div style={{ position:"relative", height:40, width: totalDays * dayWidth }}>
                        {resourceSlots.map((slot) => {
                          const start = new Date(slot.planned_start_at);
                          const end = new Date(slot.planned_end_at);
                          const left = Math.max(0, (start - minDate) / (1000 * 60 * 60 * 24));
                          const width = Math.max(1, (end - start) / (1000 * 60 * 60 * 24));
                          const color = COLORS[slot.id % COLORS.length];
                          return (
                            <div key={slot.id} style={{ position:"absolute", left: left * dayWidth, width: width * dayWidth - 4, top:4, height:32, background:color, borderRadius:8, color:"#fff", fontSize:10, padding:"2px 6px", overflow:"hidden", whiteSpace:"nowrap", cursor:"pointer" }} onClick={()=>deleteSlot(slot.id)} title={`${start.toLocaleString("ar-EG")} - ${end.toLocaleString("ar-EG")} | ${slot.notes||""}`}>
                              {slot.notes || `#${slot.id}`}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
