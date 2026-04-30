"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import KanbanBoard from "../components/KanbanBoard";

const JOBS_API = "https://api.royalpalace-group.com/api/v1/admin/hr-advanced/jobs";
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

const emptyForm = { title:"", department_id:"", description:"", requirements:"", closing_date:"", status:"open" };
const JOB_STATUSES = ["open", "closed"];
const JOB_STATUS_LABELS = { open:"مفتوحة", closed:"مغلقة" };
const JOB_STATUS_COLORS = { open:"#10b981", closed:"#6b7280" };

function companyName() { return "Royal Palace Group"; }

function exportRecruitmentCsv(rows) {
  const headers = ["ID", "المسمى الوظيفي", "القسم", "تاريخ النشر", "تاريخ الإغلاق", "الحالة"];
  const escapeCsv = (v) => { const s = String(v??""); if (s.includes(",")||s.includes('"')||s.includes("\n")) return `"${s.replace(/"/g,'""')}"`; return s; };
  const lines = rows.map((job) => [job.id, job.title||"", job.department_id||"-", job.posted_date?new Date(job.posted_date).toLocaleDateString():"-", job.closing_date?new Date(job.closing_date).toLocaleDateString():"-", job.status==="open"?"مفتوحة":"مغلقة"].map(escapeCsv).join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF"+csv],{type:"text/csv;charset=utf-8;"});
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = "recruitment_jobs.csv"; document.body.appendChild(a); a.click(); document.body.removeChild(a); window.URL.revokeObjectURL(url);
}

function exportRecruitmentPdf(rows) {
  const printWindow = window.open("","_blank","width=1280,height=900");
  if (!printWindow) return;
  const rowsHtml = rows.map((job) => `<tr><td>${job.id||""}</td><td>${job.title||"-"}</td><td>${job.department_id||"-"}</td><td>${job.posted_date?new Date(job.posted_date).toLocaleDateString():"-"}</td><td>${job.closing_date?new Date(job.closing_date).toLocaleDateString():"-"}</td><td>${job.status==="open"?"مفتوحة":"مغلقة"}</td></tr>`).join("");
  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير الوظائف</title><style>@page{size:A4 landscape;margin:12mm;}body{font-family:Arial,sans-serif;color:#0f172a;}table{width:100%;border-collapse:collapse;}th,td{border:1px solid #cbd5e1;padding:8px;font-size:12px;text-align:right;}thead th{background:#e2e8f0;}</style></head><body><h2>تقرير الوظائف</h2><table><thead><tr><th>#</th><th>المسمى الوظيفي</th><th>القسم</th><th>تاريخ النشر</th><th>تاريخ الإغلاق</th><th>الحالة</th></tr></thead><tbody>${rowsHtml}</tbody></table><script>setTimeout(()=>window.print(),400);</script></body></html>`;
  printWindow.document.open(); printWindow.document.write(html); printWindow.document.close();
}

function renderJobCard(job) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:"14px" }}>{job.title}</div>
      <div style={{ fontSize:"12px", color:"var(--rp-text-muted)" }}>{job.department_id ? `قسم ${job.department_id}` : "-"}</div>
      {job.closing_date && <div style={{ fontSize:"11px", color:"var(--rp-text-soft)" }}>ينتهي: {new Date(job.closing_date).toLocaleDateString()}</div>}
    </div>
  );
}

export default function AdvancedRecruitmentPage() {
  const { user, ready } = useAdminAuth("hr_advanced");
  const [jobs, setJobs] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState("kanban");

  const [tableSearch, setTableSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  async function loadJobs() {
    const res = await fetch(JOBS_API, { headers: authHeaders(), cache:"no-store" });
    const data = await res.json().catch(()=>[]);
    if (!res.ok) throw new Error(data.detail || "فشل تحميل الوظائف");
    setJobs(Array.isArray(data)?data:[]);
  }

  useEffect(() => { if (!ready) return; loadJobs().catch((err)=>setMessage(err.message)); }, [ready]);
  useEffect(() => { setPage(1); }, [tableSearch, statusFilter, sortBy, pageSize]);

  const filtered = useMemo(() => {
    const q = (tableSearch||"").trim().toLowerCase();
    let list = [...jobs];
    if (statusFilter!=="all") list = list.filter((j)=>j.status===statusFilter);
    if (q) list = list.filter((j)=>(j.title||"").toLowerCase().includes(q)||String(j.department_id||"").includes(q));
    list.sort((a,b)=>{ if (sortBy==="title") return String(a.title||"").localeCompare(String(b.title||""),"ar"); return Number(b.id||0)-Number(a.id||0); });
    return list;
  }, [jobs, tableSearch, statusFilter, sortBy]);

  const stats = useMemo(() => ({ total:jobs.length, open:jobs.filter((j)=>j.status==="open").length, closed:jobs.filter((j)=>j.status==="closed").length }), [jobs]);
  const paged = useMemo(() => { const start = (page-1)*pageSize; return filtered.slice(start, start+pageSize); }, [filtered, page, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length/pageSize));

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); setMessage(""); };
  const startEdit = (job) => { setEditingId(job.id); setShowForm(true); setForm({ title:job.title||"", department_id:job.department_id||"", description:job.description||"", requirements:job.requirements||"", closing_date:job.closing_date||"", status:job.status||"open" }); setMessage(""); };
  const handleDelete = async (id) => { if (!confirm("هل تريد حذف هذه الوظيفة؟")) return; setDeletingId(id); setMessage(""); try { const res = await fetch(`${JOBS_API}/${id}`,{method:"DELETE",headers:authHeaders()}); const data = await res.json().catch(()=>({})); if (!res.ok) throw new Error(data.detail||"فشل حذف الوظيفة"); setMessage("تم حذف الوظيفة بنجاح"); if (editingId===id) resetForm(); await loadJobs(); } catch (err) { setMessage(err.message); } finally { setDeletingId(null); } };
  const handleSubmit = async (e) => { e.preventDefault(); setSubmitting(true); setMessage(""); try { const payload = { title:form.title.trim(), department_id:form.department_id||null, description:form.description.trim()||null, requirements:form.requirements.trim()||null, closing_date:form.closing_date||null, status:form.status }; const url = editingId?`${JOBS_API}/${editingId}`:JOBS_API; const method = editingId?"PUT":"POST"; const res = await fetch(url,{method,headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify(payload)}); const data = await res.json().catch(()=>({})); if (!res.ok) throw new Error(data.detail||(editingId?"فشل تعديل الوظيفة":"فشل إنشاء الوظيفة")); setMessage(editingId?"تم تعديل الوظيفة بنجاح":"تم إنشاء الوظيفة بنجاح"); resetForm(); await loadJobs(); } catch (err) { setMessage(err.message); } finally { setSubmitting(false); } };

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جاري التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero"><div><div className="erp-hero-pill">Advanced Recruitment</div><h2>التوظيف المتقدم</h2><p>إدارة الوظائف والمتقدمين</p></div><div><button className="erp-btn-secondary" onClick={()=>setShowForm(!showForm)}>{showForm?"إخفاء":"فتح"} النموذج</button><button className="erp-btn-primary" onClick={()=>{setForm(emptyForm);setEditingId(null);setShowForm(true);}}>إضافة وظيفة</button></div></section>
        <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">إجمالي الوظائف</div><div className="erp-card-value">{stats.total}</div></div><div className="erp-card"><div className="erp-card-title">مفتوحة</div><div className="erp-card-value">{stats.open}</div></div><div className="erp-card"><div className="erp-card-title">مغلقة</div><div className="erp-card-value">{stats.closed}</div></div></section>
        {message && <div className="erp-form-message" style={{ marginBottom:"16px" }}>{message}</div>}
        {showForm && (
          <div className="erp-section-card" style={{ marginBottom:"18px" }}>
            <form className="erp-form-grid" onSubmit={handleSubmit}>
              <input className="erp-input" placeholder="المسمى الوظيفي" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} required />
              <select className="erp-input" value={form.department_id||""} onChange={(e)=>setForm({...form,department_id:e.target.value})}><option value="">اختر القسم</option><option value="1">الإدارة</option><option value="2">الإنتاج</option><option value="3">المبيعات</option><option value="4">الموارد البشرية</option><option value="5">تقنية المعلومات</option></select>
              <textarea className="erp-input" rows="3" placeholder="الوصف الوظيفي" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} />
              <textarea className="erp-input" rows="3" placeholder="المتطلبات" value={form.requirements} onChange={(e)=>setForm({...form,requirements:e.target.value})} />
              <input className="erp-input" type="date" placeholder="تاريخ الإغلاق" value={form.closing_date||""} onChange={(e)=>setForm({...form,closing_date:e.target.value})} />
              <select className="erp-input" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}><option value="open">مفتوحة</option><option value="closed">مغلقة</option></select>
              <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":editingId?"تحديث":"إنشاء"}</button><button className="erp-btn-secondary" type="button" onClick={resetForm}>إلغاء</button></div>
            </form>
          </div>
        )}

        <div className="erp-section-card">
          <div style={{ display:"flex", gap:"10px", flexWrap:"wrap", marginBottom:"12px", alignItems:"center" }}>
            <input className="erp-input" style={{ flex:"1 1 260px" }} placeholder="بحث بالمسمى أو القسم" value={tableSearch} onChange={(e)=>setTableSearch(e.target.value)} />
            <select className="erp-input" style={{ flex:"1 1 150px" }} value={statusFilter} onChange={(e)=>setStatusFilter(e.target.value)}><option value="all">كل الحالات</option><option value="open">مفتوحة</option><option value="closed">مغلقة</option></select>
            <select className="erp-input" style={{ flex:"1 1 150px" }} value={sortBy} onChange={(e)=>setSortBy(e.target.value)}><option value="newest">الأحدث</option><option value="title">المسمى</option></select>
          </div>
          <div style={{ display:"flex", gap:"8px", flexWrap:"wrap", marginBottom:"12px" }}>
            <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={{ minHeight:"38px", borderRadius:"12px", padding:"0 14px", fontWeight:800 }}>Kanban</button>
            <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={{ minHeight:"38px", borderRadius:"12px", padding:"0 14px", fontWeight:800 }}>جدول</button>
            <button className="erp-btn-secondary" onClick={()=>exportRecruitmentCsv(filtered)}>Export CSV</button>
            <button className="erp-btn-primary" onClick={()=>exportRecruitmentPdf(filtered)}>Export PDF</button>
            <div style={{ marginInlineStart:"auto" }}><span className="erp-mini-note">إجمالي: {filtered.length}</span></div>
          </div>

          {viewMode==="table" && (
            <div className="erp-table-shell" style={{ maxHeight:"60vh", overflow:"auto" }}>
              <table className="erp-table"><thead><tr><th>#</th><th>المسمى</th><th>القسم</th><th>تاريخ النشر</th><th>تاريخ الإغلاق</th><th>الحالة</th><th>إجراءات</th></tr></thead>
                <tbody>{paged.map((job)=>(<tr key={job.id}><td>{job.id}</td><td>{job.title}</td><td>{job.department_id||"-"}</td><td>{job.posted_date?new Date(job.posted_date).toLocaleDateString():"-"}</td><td>{job.closing_date?new Date(job.closing_date).toLocaleDateString():"-"}</td><td><span className={`erp-badge ${job.status==="open"?"success":"warning"}`}>{job.status==="open"?"مفتوحة":"مغلقة"}</span></td><td><button className="erp-btn-secondary" style={{ marginInlineEnd:6 }} onClick={()=>startEdit(job)}>تعديل</button><button className="erp-btn-danger" onClick={()=>handleDelete(job.id)} disabled={deletingId===job.id}>{deletingId===job.id?"جاري الحذف":"حذف"}</button></td></tr>))}</tbody></table>
            </div>
          )}

          {viewMode==="kanban" && (
            <KanbanBoard items={filtered} statusField="status" statusOptions={JOB_STATUSES} statusLabels={JOB_STATUS_LABELS} statusColors={JOB_STATUS_COLORS}
              renderCard={renderJobCard}
              onAction={(job)=>(<><button className="erp-btn-secondary" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>startEdit(job)}>تعديل</button><button className="erp-btn-danger" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>handleDelete(job.id)}>حذف</button></>)}
              emptyMessage="لا توجد وظائف" />
          )}

          <div style={{ marginTop:12, display:"flex", justifyContent:"space-between" }}><span>صفحة {page} من {totalPages}</span><div><button className="erp-btn-secondary" disabled={page===1} onClick={()=>setPage(1)}>الأولى</button><button className="erp-btn-secondary" disabled={page===1} onClick={()=>setPage((p)=>Math.max(1,p-1))}>السابقة</button><button className="erp-btn-secondary" disabled={page===totalPages} onClick={()=>setPage((p)=>Math.min(totalPages,p+1))}>التالية</button><button className="erp-btn-secondary" disabled={page===totalPages} onClick={()=>setPage(totalPages)}>الأخيرة</button></div></div>
        </div>
      </section>
    </main>
  );
}
