"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";

const LISTS_URL = "https://api.royalpalace-group.com/api/v1/admin/email-marketing/lists";
const SUBS_URL = "https://api.royalpalace-group.com/api/v1/admin/email-marketing/subscribers";
const CAMPAIGNS_URL = "https://api.royalpalace-group.com/api/v1/admin/email-marketing/campaigns";

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };
const CAMPAIGN_STATUSES = ["draft","scheduled","sent","paused"];
const CAMPAIGN_STATUS_LABELS = { draft:"مسودة", scheduled:"مجدول", sent:"مرسل", paused:"معلق" };
const CAMPAIGN_STATUS_COLORS = { draft:"#6b7280", scheduled:"#3b82f6", sent:"#10b981", paused:"#f59e0b" };

function renderCampaignCard(c) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:"14px" }}>{c.name}</div>
      <div style={{ fontSize:"12px", color:"var(--rp-text-muted)" }}>{c.subject||"-"}</div>
      <div style={{ fontSize:"11px", color:"var(--rp-text-soft)" }}>{c.scheduled_at||"-"}</div>
    </div>
  );
}

export default function EmailMarketingPage() {
  const { user, ready } = useAdminAuth("email_marketing");
  const [lists, setLists] = useState([]);
  const [subscribers, setSubscribers] = useState([]);
  const [campaigns, setCampaigns] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [listForm, setListForm] = useState({ name:"", code:"" });
  const [subForm, setSubForm] = useState({ list_id:"", email:"", name:"" });
  const [campForm, setCampForm] = useState({ name:"", subject:"", body:"", list_id:"", scheduled_at:"" });
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("kanban");

  async function loadAll() { try { const [listRes, subRes, campRes] = await Promise.all([fetch(LISTS_URL, { headers: authHeaders() }), fetch(SUBS_URL, { headers: authHeaders() }), fetch(CAMPAIGNS_URL, { headers: authHeaders() })]); setLists(listRes.ok ? await listRes.json() : []); setSubscribers(subRes.ok ? await subRes.json() : []); setCampaigns(campRes.ok ? await campRes.json() : []); } catch (err) { setMessage("تعذر التحميل"); } }
  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);
  async function handleCreateList(e) { e.preventDefault(); setSubmitting(true); try { const res = await fetch(LISTS_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(listForm) }); if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء"); setListForm({ name:"", code:"" }); loadAll(); } catch (err) { setMessage(err.message); } finally { setSubmitting(false); } }
  async function handleAddSubscriber(e) { e.preventDefault(); setSubmitting(true); try { const res = await fetch(SUBS_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(subForm) }); if (!res.ok) throw new Error((await res.json()).detail || "فشل الإضافة"); setSubForm({ list_id:"", email:"", name:"" }); loadAll(); } catch (err) { setMessage(err.message); } finally { setSubmitting(false); } }
  async function handleCreateCampaign(e) { e.preventDefault(); setSubmitting(true); try { const payload = { ...campForm, list_id: campForm.list_id ? Number(campForm.list_id) : null }; const res = await fetch(CAMPAIGNS_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) }); if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء"); setCampForm({ name:"", subject:"", body:"", list_id:"", scheduled_at:"" }); loadAll(); } catch (err) { setMessage(err.message); } finally { setSubmitting(false); } }
  function handleExportCsv() { exportTableCsv("email_subscribers.csv", ["البريد","الاسم","القائمة","نشط"], subscribers.map((s) => [s.email, s.name || "", lists.find((l)=>l.id===s.list_id)?.name || "", s.is_active?"نعم":"لا"])); }
  function handleExportPdf() { exportTablePdf("تقرير المشتركين", "التسويق البريدي", [{ label:"عدد المشتركين", value:subscribers.length }], ["البريد","الاسم","القائمة","نشط"], subscribers.map((s) => [s.email, s.name || "", lists.find((l)=>l.id===s.list_id)?.name || "", s.is_active?"نعم":"لا"])); }


  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Email Marketing</div><h2>التسويق البريدي</h2><p>إدارة القوائم والحملات والمشتركين.</p></div><div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">قوائم</div><div className="erp-stat-box-value">{lists.length}</div></div><div className="erp-stat-box"><div className="erp-stat-box-label">مشتركين</div><div className="erp-stat-box-value">{subscribers.length}</div></div></div></section>
        <section className="erp-kpi-grid" style={{ marginBottom:"18px" }}><div className="erp-card"><div className="erp-card-title">قوائم</div><div className="erp-card-value">{lists.length}</div></div><div className="erp-card"><div className="erp-card-title">مشتركين</div><div className="erp-card-value">{subscribers.length}</div></div><div className="erp-card"><div className="erp-card-title">حملات</div><div className="erp-card-value">{campaigns.length}</div></div></section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom:"18px" }}>
          <div className="erp-section-card"><div className="erp-section-head"><h3>إنشاء قائمة جديدة</h3></div><form className="erp-form-grid" onSubmit={handleCreateList}><input className="erp-input" placeholder="اسم القائمة" value={listForm.name} onChange={(e)=>setListForm({...listForm,name:e.target.value})} required /><input className="erp-input" placeholder="الكود" value={listForm.code} onChange={(e)=>setListForm({...listForm,code:e.target.value})} required /><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":"إنشاء القائمة"}</button></div></form></div>
          <div className="erp-section-card"><div className="erp-section-head"><h3>إضافة مشترك</h3></div><form className="erp-form-grid" onSubmit={handleAddSubscriber}><select className="erp-input" value={subForm.list_id} onChange={(e)=>setSubForm({...subForm,list_id:e.target.value})} required><option value="">اختر القائمة</option>{lists.map((l)=><option key={l.id} value={l.id}>{l.name}</option>)}</select><input className="erp-input" placeholder="البريد الإلكتروني" value={subForm.email} onChange={(e)=>setSubForm({...subForm,email:e.target.value})} required /><input className="erp-input" placeholder="الاسم (اختياري)" value={subForm.name} onChange={(e)=>setSubForm({...subForm,name:e.target.value})} /><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":"إضافة مشترك"}</button></div></form></div>
        </div>
        <div className="erp-section-card" style={{ marginBottom:"18px" }}><div className="erp-section-head"><h3>حملة جديدة</h3></div><form className="erp-form-grid erp-form-grid-2" onSubmit={handleCreateCampaign}><input className="erp-input" placeholder="اسم الحملة" value={campForm.name} onChange={(e)=>setCampForm({...campForm,name:e.target.value})} required /><input className="erp-input" placeholder="الموضوع" value={campForm.subject} onChange={(e)=>setCampForm({...campForm,subject:e.target.value})} required /><select className="erp-input" value={campForm.list_id} onChange={(e)=>setCampForm({...campForm,list_id:e.target.value})}><option value="">كل القوائم</option>{lists.map((l)=><option key={l.id} value={l.id}>{l.name}</option>)}</select><input className="erp-input" type="datetime-local" placeholder="تاريخ الجدولة" value={campForm.scheduled_at} onChange={(e)=>setCampForm({...campForm,scheduled_at:e.target.value})} /><textarea className="erp-input" rows="6" placeholder="محتوى الرسالة" value={campForm.body} onChange={(e)=>setCampForm({...campForm,body:e.target.value})} /><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":"إنشاء الحملة"}</button></div></form></div>

        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <div className="erp-section-head"><h3>الحملات</h3>
            <div style={{display:"flex",gap:"8px"}}>
              <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={topButtonStyle}>Kanban</button>
              <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={topButtonStyle}>جدول</button>
            </div>
          </div>
          {viewMode==="table" && (
          <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>ID</th><th>الاسم</th><th>الموضوع</th><th>الحالة</th><th>الجدولة</th><th>القائمة</th></tr></thead><tbody>{campaigns.length === 0 ? <tr><td colSpan="6">لا توجد حملات.</td></tr> : campaigns.map((c)=>(<tr key={c.id}><td>{c.id}</td><td>{c.name}</td><td>{c.subject}</td><td>{c.status}</td><td>{c.scheduled_at || "-"}</td><td>{lists.find((l)=>l.id===c.list_id)?.name || "-"}</td></tr>))}</tbody></table></div>)}
          {viewMode==="kanban" && (
            <KanbanBoard items={campaigns} statusField="status" statusOptions={CAMPAIGN_STATUSES} statusLabels={CAMPAIGN_STATUS_LABELS} statusColors={CAMPAIGN_STATUS_COLORS}
              renderCard={renderCampaignCard}
              emptyMessage="لا توجد حملات" />
          )}
        </div>

        <div className="erp-section-card"><div className="erp-section-head"><h3>المشتركون</h3><div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}><input className="erp-input" placeholder="بحث..." value={search} onChange={(e)=>setSearch(e.target.value)} /><button className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>CSV</button><button className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>PDF</button></div></div><div className="erp-table-shell"><table className="erp-table"><thead><tr><th>ID</th><th>البريد</th><th>الاسم</th><th>القائمة</th><th>نشط</th></tr></thead><tbody>{subscribers.length === 0 ? <tr><td colSpan="5">لا يوجد مشتركون.</td></tr> : subscribers.filter((s) => s.email.includes(search)).slice(0,50).map((s)=>(<tr key={s.id}><td>{s.id}</td><td>{s.email}</td><td>{s.name || "-"}</td><td>{lists.find((l)=>l.id===s.list_id)?.name || "-"}</td><td>{s.is_active?"نعم":"لا"}</td></tr>))}</tbody></table></div></div>
      </section>
    </main>
  );
}
