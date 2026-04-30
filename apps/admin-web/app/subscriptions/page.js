"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import KanbanBoard from "../components/KanbanBoard";

const SUBS_URL = "https://api.royalpalace-group.com/api/v1/admin/subscriptions";
const PLANS_URL = "https://api.royalpalace-group.com/api/v1/admin/subscriptions/plans";

const SUB_STATUSES = ["active","inactive","cancelled"];
const SUB_STATUS_LABELS = { active:"نشط", inactive:"غير نشط", cancelled:"ملغي" };
const SUB_STATUS_COLORS = { active:"#10b981", inactive:"#f59e0b", cancelled:"#6b7280" };

function renderSubCard(s) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:"14px" }}>{s.customer_name}</div>
      <div style={{ fontSize:"12px", color:"var(--rp-text-muted)" }}>{s.email||"-"}</div>
    </div>
  );
}

export default function SubscriptionsPage() {
  const { user, ready } = useAdminAuth("subscription");
  const [subs, setSubs] = useState([]);
  const [plans, setPlans] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ customer_name:"", email:"", plan_id:"", start_date:"" });
  const [planForm, setPlanForm] = useState({ name:"", code:"", price:"", interval:"monthly" });
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("kanban");

  async function loadAll() { try { const [subRes, planRes] = await Promise.all([fetch(SUBS_URL, { headers: authHeaders() }), fetch(PLANS_URL, { headers: authHeaders() })]); setSubs(subRes.ok ? await subRes.json() : []); setPlans(planRes.ok ? await planRes.json() : []); } catch (err) { setMessage("تعذر التحميل"); } }
  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);
  async function handleCreateSub(e) { e.preventDefault(); setSubmitting(true); try { const payload = { ...form, plan_id: form.plan_id ? Number(form.plan_id) : null }; const res = await fetch(SUBS_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) }); if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء"); setForm({ customer_name:"", email:"", plan_id:"", start_date:"" }); loadAll(); } catch (err) { setMessage(err.message); } finally { setSubmitting(false); } }
  async function handleCreatePlan(e) { e.preventDefault(); setSubmitting(true); try { const payload = { ...planForm, price: Number(planForm.price) }; const res = await fetch(PLANS_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) }); if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء"); setPlanForm({ name:"", code:"", price:"", interval:"monthly" }); loadAll(); } catch (err) { setMessage(err.message); } finally { setSubmitting(false); } }
  async function deleteSub(id) { if (!confirm("حذف الاشتراك؟")) return; await fetch(`${SUBS_URL}/${id}`,{method:"DELETE",headers:authHeaders()}); loadAll(); }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Subscriptions</div><h2>الاشتراكات</h2><p>إدارة خطط الاشتراك والعملاء المشتركين.</p></div></section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom:"18px" }}>
          <div className="erp-section-card"><h3>اشتراك جديد</h3><form className="erp-form-grid" onSubmit={handleCreateSub}><input className="erp-input" placeholder="اسم العميل" value={form.customer_name} onChange={(e)=>setForm({...form,customer_name:e.target.value})} required /><input className="erp-input" placeholder="البريد الإلكتروني" value={form.email} onChange={(e)=>setForm({...form,email:e.target.value})} /><select className="erp-input" value={form.plan_id} onChange={(e)=>setForm({...form,plan_id:e.target.value})}><option value="">اختر الخطة</option>{plans.map((p)=><option key={p.id} value={p.id}>{p.name}</option>)}</select><input className="erp-input" type="date" value={form.start_date} onChange={(e)=>setForm({...form,start_date:e.target.value})} /><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":"إنشاء الاشتراك"}</button></div></form></div>
          <div className="erp-section-card"><h3>خطة جديدة</h3><form className="erp-form-grid" onSubmit={handleCreatePlan}><input className="erp-input" placeholder="اسم الخطة" value={planForm.name} onChange={(e)=>setPlanForm({...planForm,name:e.target.value})} required /><input className="erp-input" placeholder="الكود" value={planForm.code} onChange={(e)=>setPlanForm({...planForm,code:e.target.value})} required /><input className="erp-input" type="number" step="0.01" placeholder="السعر" value={planForm.price} onChange={(e)=>setPlanForm({...planForm,price:e.target.value})} /><select className="erp-input" value={planForm.interval} onChange={(e)=>setPlanForm({...planForm,interval:e.target.value})}><option value="monthly">شهري</option><option value="yearly">سنوي</option></select><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":"إنشاء الخطة"}</button></div></form></div>
        </div>
        <div className="erp-section-card">
          <div className="erp-section-head">
            <h3>الاشتراكات النشطة</h3>
            <div style={{display:"flex", gap:"8px"}}>
              <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={{minHeight:"38px",borderRadius:"12px",padding:"0 14px",fontWeight:800}}>Kanban</button>
              <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={{minHeight:"38px",borderRadius:"12px",padding:"0 14px",fontWeight:800}}>جدول</button>
            </div>
          </div>
          {viewMode==="table" && (
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead>
                  <tr><th>ID</th><th>العميل</th><th>البريد</th><th>الخطة</th><th>الحالة</th><th>إجراءات</th></tr>
                </thead>
                <tbody>
                  {subs.length===0? (
                    <tr><td colSpan="6">لا توجد اشتراكات. </td></tr>
                  ) : (
                    subs.map((s)=>(
                      <tr key={s.id}>
                        <td>{s.id}</td>
                        <td>{s.customer_name}</td>
                        <td>{s.email||"-"}</td>
                        <td>{plans.find((p)=>p.id===s.plan_id)?.name||"-"}</td>
                        <td>{s.status}</td>
                        <td><button className="erp-btn-danger" onClick={()=>deleteSub(s.id)}>حذف</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {viewMode==="kanban" && (
            <KanbanBoard items={subs} statusField="status" statusOptions={SUB_STATUSES} statusLabels={SUB_STATUS_LABELS} statusColors={SUB_STATUS_COLORS}
              renderCard={renderSubCard}
              onAction={(s)=>(<button className="erp-btn-danger" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>deleteSub(s.id)}>حذف</button>)}
              emptyMessage="لا توجد اشتراكات" />
          )}
        </div>
      </section>
    </main>
  );
}
