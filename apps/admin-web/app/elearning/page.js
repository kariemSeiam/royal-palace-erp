"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/elearning/";

export default function ElearningPage() {
  const { user, ready } = useAdminAuth("elearning");
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", description: "" });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  async function loadData() {
    try { const res = await fetch(API_URL, { headers: authHeaders() }); setItems(res.ok ? await res.json() : []); } catch (e) { setMessage("تعذر التحميل"); }
  }
  useEffect(() => { if (ready && user) loadData(); }, [ready, user]);

  const filtered = items.filter(it => [it.name, it.description].join(" ").toLowerCase().includes(search.toLowerCase()));
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);
  const totalPages = Math.ceil(filtered.length / pageSize);
  const stats = { total: items.length };

  function resetForm() { setForm({ name: "", description: "" }); setEditingId(null); setShowForm(false); }
  function startEdit(item) { setEditingId(item.id); setForm({ name: item.name || "", description: item.description || "" }); setShowForm(true); }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true);
    try {
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? API_URL + editingId : API_URL;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(form) });
      if (!res.ok) throw new Error("فشل الحفظ");
      resetForm(); loadData();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function handleDelete(id) { if (!confirm("حذف؟")) return; try { await fetch(API_URL + id, { method: "DELETE", headers: authHeaders() }); loadData(); } catch (e) {} }

  function csvExport() { exportTableCsv("elearning.csv", ["الاسم","الوصف"], filtered.map(i => [i.name||"", i.description||""])); }
  function pdfExport() { exportTablePdf("تقرير elearning", "تقرير", [{label:"العدد",value:items.length}], ["الاسم","الوصف"], filtered.map(i => [i.name||"", i.description||""])); }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero"><div><div className="erp-hero-pill">elearning</div><h2>elearning</h2><p>إدارة elearning</p></div><div><button className="erp-btn-secondary" onClick={()=>setShowForm(!showForm)}>{showForm ? "إخفاء النموذج" : "فتح النموذج"}</button><button className="erp-btn-primary" onClick={()=>{resetForm();setShowForm(true);}}>إضافة جديد</button></div></section>
        <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">الإجمالي</div><div className="erp-card-value">{stats.total}</div></div></section>
        {message && <div className="erp-form-message">{message}</div>}
        {showForm && (<div className="erp-section-card" style={{marginBottom:18}}><form className="erp-form-grid" onSubmit={handleSubmit}><input className="erp-input" placeholder="الاسم" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required /><textarea className="erp-input" rows="3" placeholder="الوصف" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} /><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":editingId?"تحديث":"إنشاء"}</button><button className="erp-btn-secondary" type="button" onClick={resetForm}>إلغاء</button></div></form></div>)}
        <div className="erp-section-card"><div style={{display:"flex", gap:10, marginBottom:12}}><input className="erp-input" placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)} style={{flex:1}} /><button className="erp-btn-secondary" onClick={csvExport}>CSV</button><button className="erp-btn-primary" onClick={pdfExport}>PDF</button></div><div className="erp-table-shell"><table className="erp-table"><thead><tr><th>#</th><th>الاسم</th><th>الوصف</th><th>إجراءات</th></tr></thead><tbody>{paged.map(item => (<tr key={item.id}><td>{item.id}</td><td>{item.name || "-"}</td><td>{item.description || "-"}</td><td><button className="erp-btn-secondary" onClick={()=>startEdit(item)} style={{marginInlineEnd:6}}>تعديل</button><button className="erp-btn-danger" onClick={()=>handleDelete(item.id)}>حذف</button></td></tr>))}</tbody></table></div><div style={{marginTop:12, display:"flex", justifyContent:"space-between"}}><span>صفحة {page} من {totalPages}</span><div><button className="erp-btn-secondary" disabled={page===1} onClick={()=>setPage(1)}>الأولى</button><button className="erp-btn-secondary" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>السابقة</button><button className="erp-btn-secondary" disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>التالية</button><button className="erp-btn-secondary" disabled={page===totalPages} onClick={()=>setPage(totalPages)}>الأخيرة</button></div></div></div>
      </section>
    </main>
  );
}
