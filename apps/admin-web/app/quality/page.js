"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";

const TEMPLATES_URL = "https://api.royalpalace-group.com/api/v1/admin/quality/templates";
const CHECKS_URL = "https://api.royalpalace-group.com/api/v1/admin/quality/checks";

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };
const RESULTS = ["pending","pass","fail","conditional_pass"];
const RESULTS_LABELS = { pending:"معلق", pass:"ناجح", fail:"فاشل", conditional_pass:"ناجح بشروط" };
const RESULTS_COLORS = { pending:"#3b82f6", pass:"#10b981", fail:"#ef4444", conditional_pass:"#f59e0b" };

function renderCheckCard(c) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:"14px" }}>فحص #{c.id}</div>
      <div style={{ fontSize:"12px", color:"var(--rp-text-muted)" }}>أمر تشغيل: {c.work_order_id||"-"}</div>
      <div style={{ fontSize:"11px", color:"var(--rp-text-soft)" }}>مفتش: {c.inspector_user_id||"-"}</div>
    </div>
  );
}

export default function QualityPage() {
  const { user, ready } = useAdminAuth("quality");
  const [templates, setTemplates] = useState([]);
  const [checks, setChecks] = useState([]);
  const [message, setMessage] = useState("");
  const [templateForm, setTemplateForm] = useState({ name:"", code:"", description:"" });
  const [checkForm, setCheckForm] = useState({ work_order_id:"", template_id:"", result:"pending", notes:"" });
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("kanban");

  async function loadAll() { try { const [tempRes, checkRes] = await Promise.all([fetch(TEMPLATES_URL, { headers: authHeaders() }), fetch(CHECKS_URL, { headers: authHeaders() })]); setTemplates(tempRes.ok ? await tempRes.json() : []); setChecks(checkRes.ok ? await checkRes.json() : []); } catch (err) { setMessage("تعذر التحميل"); } }
  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);
  async function handleCreateTemplate(e) { e.preventDefault(); setSubmitting(true); try { const res = await fetch(TEMPLATES_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(templateForm) }); if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء"); setTemplateForm({ name:"", code:"", description:"" }); loadAll(); } catch (err) { setMessage(err.message); } finally { setSubmitting(false); } }
  async function handleCreateCheck(e) { e.preventDefault(); setSubmitting(true); try { const payload = { ...checkForm, work_order_id: checkForm.work_order_id ? Number(checkForm.work_order_id) : null, template_id: checkForm.template_id ? Number(checkForm.template_id) : null }; const res = await fetch(CHECKS_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) }); if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء"); setCheckForm({ work_order_id:"", template_id:"", result:"pending", notes:"" }); loadAll(); } catch (err) { setMessage(err.message); } finally { setSubmitting(false); } }
  async function deleteTemplate(id) { if (!confirm("حذف القالب؟")) return; await fetch(`${TEMPLATES_URL}/${id}`, { method:"DELETE", headers: authHeaders() }); loadAll(); }
  async function deleteCheck(id) { if (!confirm("حذف الفحص؟")) return; await fetch(`${CHECKS_URL}/${id}`, { method:"DELETE", headers: authHeaders() }); loadAll(); }
  function handleExportChecksCsv() { exportTableCsv("quality_checks.csv", ["أمر التشغيل","القالب","النتيجة","المفتش","ملاحظات","التاريخ"], checks.map((c) => [c.work_order_id||"",templates.find((t)=>t.id===c.template_id)?.name||"",c.result,c.inspector_user_id||"",c.notes||"",c.checked_at||""])); }
  function handleExportChecksPdf() { exportTablePdf("تقرير فحوصات الجودة","الجودة",[{ label:"عدد الفحوصات", value:checks.length }],["أمر التشغيل","القالب","النتيجة","المفتش","ملاحظات","التاريخ"], checks.map((c) => [c.work_order_id||"",templates.find((t)=>t.id===c.template_id)?.name||"",c.result,c.inspector_user_id||"",c.notes||"",c.checked_at||""])); }

  // fix items is not defined
  const items = [];

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Quality Control</div><h2>إدارة الجودة</h2><p>إنشاء قوالب الفحص وتسجيل فحوصات الجودة.</p></div><div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">قوالب</div><div className="erp-stat-box-value">{templates.length}</div></div><div className="erp-stat-box"><div className="erp-stat-box-label">فحوصات</div><div className="erp-stat-box-value">{checks.length}</div></div></div></section>
        <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">إجمالي السجلات</div><div className="erp-card-value">{items?.length || 0}</div></div><div className="erp-card"><div className="erp-card-title">نشط</div><div className="erp-card-value">{items?.filter(i=>i.is_active!==false).length || 0}</div></div></section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom:"18px" }}>
          <div className="erp-section-card"><h3>قالب فحص جديد</h3><form className="erp-form-grid" onSubmit={handleCreateTemplate}><input className="erp-input" placeholder="اسم القالب" value={templateForm.name} onChange={(e)=>setTemplateForm({...templateForm,name:e.target.value})} required /><input className="erp-input" placeholder="الكود" value={templateForm.code} onChange={(e)=>setTemplateForm({...templateForm,code:e.target.value})} required /><textarea className="erp-input" rows="3" placeholder="الوصف" value={templateForm.description} onChange={(e)=>setTemplateForm({...templateForm,description:e.target.value})} /><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":"إنشاء القالب"}</button></div></form></div>
          <div className="erp-section-card"><h3>تسجيل فحص جديد</h3><form className="erp-form-grid" onSubmit={handleCreateCheck}><input className="erp-input" type="number" placeholder="رقم أمر التشغيل" value={checkForm.work_order_id} onChange={(e)=>setCheckForm({...checkForm,work_order_id:e.target.value})} /><select className="erp-input" value={checkForm.template_id} onChange={(e)=>setCheckForm({...checkForm,template_id:e.target.value})}><option value="">اختر القالب</option>{templates.map((t)=><option key={t.id} value={t.id}>{t.name}</option>)}</select><select className="erp-input" value={checkForm.result} onChange={(e)=>setCheckForm({...checkForm,result:e.target.value})}>{RESULTS.map((r)=><option key={r} value={r}>{r}</option>)}</select><textarea className="erp-input" rows="3" placeholder="ملاحظات" value={checkForm.notes} onChange={(e)=>setCheckForm({...checkForm,notes:e.target.value})} /><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":"تسجيل الفحص"}</button></div></form></div>
        </div>
        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <div className="erp-section-head"><h3>قوالب الفحص</h3></div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead><tr><th>ID</th><th>الاسم</th><th>الكود</th><th>الوصف</th><th>إجراءات</th></tr></thead>
              <tbody>
                {templates.length === 0 ? (
                  <tr><td colSpan="5">لا توجد قوالب.</td></tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td>{t.name}</td>
                      <td>{t.code}</td>
                      <td>{t.description || "-"}</td>
                      <td><button className="erp-btn-danger" onClick={() => deleteTemplate(t.id)}>حذف</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head"><h3>سجل الفحوصات</h3>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
              <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={topButtonStyle}>Kanban</button>
              <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={topButtonStyle}>جدول</button>
              <button className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportChecksCsv}>CSV</button>
              <button className="erp-btn-primary" style={topButtonStyle} onClick={handleExportChecksPdf}>PDF</button>
            </div>
          </div>
          {viewMode==="table" && (
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead><tr><th>ID</th><th>أمر التشغيل</th><th>القالب</th><th>النتيجة</th><th>المفتش</th><th>ملاحظات</th><th>التاريخ</th><th>إجراءات</th></tr></thead>
                <tbody>
                  {checks.length === 0 ? (
                    <tr><td colSpan="8">لا توجد فحوصات.</td></tr>
                  ) : (
                    checks.map((c) => (
                      <tr key={c.id}>
                        <td>{c.id}</td>
                        <td>{c.work_order_id || "-"}</td>
                        <td>{templates.find((t)=>t.id===c.template_id)?.name || "-"}</td>
                        <td>{c.result}</td>
                        <td>{c.inspector_user_id || "-"}</td>
                        <td>{c.notes || "-"}</td>
                        <td>{c.checked_at || "-"}</td>
                        <td><button className="erp-btn-danger" onClick={() => deleteCheck(c.id)}>حذف</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {viewMode==="kanban" && (
            <KanbanBoard items={checks} statusField="result" statusOptions={RESULTS} statusLabels={RESULTS_LABELS} statusColors={RESULTS_COLORS}
              renderCard={renderCheckCard}
              onAction={(c)=>(<button className="erp-btn-danger" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>deleteCheck(c.id)}>حذف</button>)}
              emptyMessage="لا توجد فحوصات" />
          )}
        </div>
      </section>
    </main>
  );
}
