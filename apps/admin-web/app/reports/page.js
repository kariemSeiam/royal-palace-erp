"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";

const TEMPLATES_URL = "https://api.royalpalace-group.com/api/v1/admin/reports/templates";
const SAVED_URL = "https://api.royalpalace-group.com/api/v1/admin/reports/saved";

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };
const MODULES = ["sales","procurement","inventory","manufacturing","finance","hr","crm","helpdesk","field_service","website","pos","email_marketing"];

export default function ReportsPage() {
  const { user, ready } = useAdminAuth("reports");
  const [templates, setTemplates] = useState([]);
  const [saved, setSaved] = useState([]);
  const [message, setMessage] = useState("");
  const [executionResult, setExecutionResult] = useState(null);
  const [form, setForm] = useState({ name:"", code:"", module:"sales", query_text:"", description:"" });
  const [editId, setEditId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    try {
      const [tempRes, savedRes] = await Promise.all([
        fetch(TEMPLATES_URL, { headers: authHeaders() }),
        fetch(SAVED_URL, { headers: authHeaders() }),
      ]);
      setTemplates(tempRes.ok ? await tempRes.json() : []);
      setSaved(savedRes.ok ? await savedRes.json() : []);
    } catch (err) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const url = editId ? `${TEMPLATES_URL}/${editId}` : TEMPLATES_URL;
      const method = editId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الحفظ");
      setMessage(editId ? "تم تعديل القالب" : "تم إنشاء القالب");
      resetForm(); loadAll();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function executeTemplate(id) {
    setSubmitting(true); setMessage("");
    try {
      const res = await fetch(`${TEMPLATES_URL}/${id}/execute`, { method:"POST", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "فشل التنفيذ");
      setExecutionResult(data);
      setMessage(`تم تنفيذ الاستعلام – ${data.count} صف`);
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function deleteTemplate(id) {
    if (!confirm("حذف القالب؟")) return;
    await fetch(`${TEMPLATES_URL}/${id}`, { method:"DELETE", headers: authHeaders() });
    loadAll();
  }

  function resetForm() { setForm({ name:"", code:"", module:"sales", query_text:"", description:"" }); setEditId(null); }
  function startEdit(t) { setEditId(t.id); setForm({ name:t.name, code:t.code, module:t.module, query_text:t.query_text, description:t.description||"" }); }

  function handleExportCsv() {
    if (!executionResult) return;
    exportTableCsv("report_export.csv", executionResult.columns, executionResult.rows.map((r) => executionResult.columns.map((c) => r[c] ?? "")));
  }
  function handleExportPdf() {
    if (!executionResult) return;
    exportTablePdf("تقرير مخصص", "التقارير المتقدمة", [{ label:"عدد الصفوف", value:executionResult.count }], executionResult.columns, executionResult.rows.map((r) => executionResult.columns.map((c) => r[c] ?? "")));
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">Advanced Reports</div><h2>التقارير المتقدمة</h2><p>إنشاء وتنفيذ تقارير مخصصة عبر استعلامات SQL.</p></div>
          <div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">قوالب</div><div className="erp-stat-box-value">{templates.length}</div></div><div className="erp-stat-box"><div className="erp-stat-box-label">تقارير محفوظة</div><div className="erp-stat-box-value">{saved.length}</div></div></div>
        </section>

        {message ? <div className="erp-form-message">{message}</div> : null}

        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <div className="erp-section-head"><h3>{editId ? "تعديل قالب" : "قالب تقرير جديد"}</h3></div>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}>
            <input className="erp-input" placeholder="اسم القالب" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required />
            <input className="erp-input" placeholder="الكود" value={form.code} onChange={(e)=>setForm({...form,code:e.target.value})} required />
            <select className="erp-input" value={form.module} onChange={(e)=>setForm({...form,module:e.target.value})}>
              {MODULES.map((m)=><option key={m} value={m}>{m}</option>)}
            </select>
            <input className="erp-input" placeholder="الوصف" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} />
            <textarea className="erp-input" rows="6" placeholder="استعلام SQL" value={form.query_text} onChange={(e)=>setForm({...form,query_text:e.target.value})} required />
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":editId?"حفظ التعديل":"إنشاء القالب"}</button>{editId&&<button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء</button>}</div>
          </form>
        </div>

        {executionResult && (
          <div className="erp-section-card" style={{ marginBottom:"18px" }}>
            <div className="erp-section-head">
              <h3>نتيجة التنفيذ ({executionResult.count} صف)</h3>
              <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
                <button className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button>
                <button className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button>
              </div>
            </div>
            <div className="erp-table-shell" style={{ maxHeight:"400px", overflowY:"auto" }}>
              <table className="erp-table" style={{ minWidth:"600px" }}>
                <thead>
                  <tr>
                    {executionResult.columns.map((c) => (
                      <th key={c}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {executionResult.rows.map((row, idx) => (
                    <tr key={idx}>
                      {executionResult.columns.map((c) => (
                        <td key={c}>{String(row[c] ?? "-")}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="erp-section-card">
          <div className="erp-section-head"><h3>قوالب التقارير</h3></div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr><th>ID</th><th>الاسم</th><th>الكود</th><th>الموديول</th><th>إجراءات</th></tr>
              </thead>
              <tbody>
                {templates.length === 0 ? (
                  <tr><td colSpan="5">لا توجد قوالب. </td></tr>
                ) : (
                  templates.map((t) => (
                    <tr key={t.id}>
                      <td>{t.id}</td>
                      <td>{t.name}</td>
                      <td>{t.code}</td>
                      <td>{t.module}</td>
                      <td>
                        <div style={{ display:"flex", gap:"6px" }}>
                          <button className="erp-btn-primary" onClick={() => executeTemplate(t.id)}>تنفيذ</button>
                          <button className="erp-btn-secondary" onClick={() => startEdit(t)}>تعديل</button>
                          <button className="erp-btn-danger" onClick={() => deleteTemplate(t.id)}>حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-section-card" style={{ marginTop:"18px" }}>
          <div className="erp-section-head"><h3>تقارير محفوظة</h3></div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr><th>ID</th><th>الاسم</th><th>القالب</th><th>التاريخ</th></tr>
              </thead>
              <tbody>
                {saved.length === 0 ? (
                  <tr><td colSpan="4">لا توجد تقارير محفوظة. </td></tr>
                ) : (
                  saved.map((s) => (
                    <tr key={s.id}>
                      <td>{s.id}</td>
                      <td>{s.name}</td>
                      <td>{templates.find((t)=>t.id===s.template_id)?.name || "-"}</td>
                      <td>{new Date(s.created_at).toLocaleString("ar-EG")}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
