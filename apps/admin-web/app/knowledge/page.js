"use client";

import { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/knowledge";

const emptyForm = { title: "", content: "", category: "", tags: "", is_published: false };

function exportToCsv(items, filename = "knowledge_export.csv") {
  if (!items.length) return;
  const headers = ["ID", "العنوان", "التصنيف", "الوسوم", "الحالة", "تاريخ النشر"];
  const rows = items.map(item => [
    item.id,
    item.title,
    item.category || "",
    item.tags || "",
    item.is_published ? "منشور" : "مسودة",
    new Date(item.created_at).toLocaleDateString()
  ]);
  const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(",")).join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

function exportToPdf(items, title = "قاعدة المعرفة") {
  const win = window.open("", "_blank");
  if (!win) return;
  const rowsHtml = items.map(item => `
    <tr>
      <td>${item.id}</td>
      <td>${item.title}</td>
      <td>${item.category || "-"}</td>
      <td>${item.tags || "-"}</td>
      <td>${item.is_published ? "منشور" : "مسودة"}</td>
      <td>${new Date(item.created_at).toLocaleDateString()}</td>
    </tr>
  `).join("");
  win.document.write(`
    <html dir="rtl"><head><meta charset="UTF-8"><title>${title}</title>
    <style>body{font-family:Arial;margin:20px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ddd;padding:8px;text-align:right}th{background:#f2f2f2}</style>
    </head><body><h2>${title}</h2><table><thead><tr><th>#</th><th>العنوان</th><th>التصنيف</th><th>الوسوم</th><th>الحالة</th><th>تاريخ النشر</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    <script>window.onload = () => setTimeout(() => window.print(), 200);</script>
    </body></html>
  `);
  win.document.close();
}

export default function KnowledgePage() {
  const { user, ready } = useAdminAuth("knowledge");
  const [articles, setArticles] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  async function loadArticles() {
    try {
      const res = await fetch(API_URL, { headers: authHeaders(), cache: "no-store" });
      if (!res.ok) throw new Error("فشل تحميل المقالات");
      const data = await res.json();
      setArticles(Array.isArray(data) ? data : []);
    } catch (err) { setMessage(err.message); }
  }

  useEffect(() => { if (ready && user) loadArticles(); }, [ready, user]);

  const filtered = useMemo(() => {
    let list = [...articles];
    const q = (search || "").toLowerCase();
    if (categoryFilter !== "all") list = list.filter(a => a.category === categoryFilter);
    if (statusFilter === "published") list = list.filter(a => a.is_published);
    if (statusFilter === "draft") list = list.filter(a => !a.is_published);
    if (q) {
      list = list.filter(a => a.title.toLowerCase().includes(q) || (a.category && a.category.toLowerCase().includes(q)) || (a.tags && a.tags.toLowerCase().includes(q)));
    }
    list.sort((a,b) => b.id - a.id);
    return list;
  }, [articles, search, categoryFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: articles.length,
    published: articles.filter(a => a.is_published).length,
    draft: articles.filter(a => !a.is_published).length,
    categories: new Set(articles.map(a => a.category).filter(Boolean)).size,
  }), [articles]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);
  const totalPages = Math.ceil(filtered.length / pageSize);
  useEffect(() => setPage(1), [search, categoryFilter, statusFilter, pageSize]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setShowForm(false);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...form, tags: form.tags || null, category: form.category || null };
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || (editingId ? "فشل التعديل" : "فشل الإنشاء"));
      setMessage(editingId ? "تم التعديل" : "تم الإنشاء");
      resetForm();
      await loadArticles();
    } catch (err) { setMessage(err.message); }
    finally { setSubmitting(false); }
  }

  async function handleDelete(id) {
    if (!confirm("حذف المقال؟")) return;
    setDeletingId(id);
    try {
      const res = await fetch(`${API_URL}/${id}`, { method: "DELETE", headers: authHeaders() });
      if (!res.ok) throw new Error("فشل الحذف");
      setMessage("تم الحذف");
      if (editingId === id) resetForm();
      await loadArticles();
    } catch (err) { setMessage(err.message); }
    finally { setDeletingId(null); }
  }

  function startEdit(article) {
    setEditingId(article.id);
    setForm({
      title: article.title,
      content: article.content,
      category: article.category || "",
      tags: article.tags || "",
      is_published: article.is_published,
    });
    setShowForm(true);
  }

  if (!ready || !user) return <main className="loading-shell"><div>جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">Knowledge Base</div><h2>قاعدة المعرفة</h2><p>إدارة المقالات والمحتوى التعليمي</p></div>
          <div style={{display:"flex",gap:8}}>
            <button className="erp-btn-secondary" onClick={() => setShowForm(!showForm)}>{showForm ? "إخفاء النموذج" : "فتح النموذج"}</button>
            <button className="erp-btn-primary" onClick={() => { resetForm(); setShowForm(true); }}>إضافة مقال</button>
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">إجمالي المقالات</div><div className="erp-card-value">{stats.total}</div></div>
          <div className="erp-card"><div className="erp-card-title">منشور</div><div className="erp-card-value">{stats.published}</div></div>
          <div className="erp-card"><div className="erp-card-title">مسودة</div><div className="erp-card-value">{stats.draft}</div></div>
          <div className="erp-card"><div className="erp-card-title">تصنيفات</div><div className="erp-card-value">{stats.categories}</div></div>
        </section>

        {showForm && (
          <div className="erp-section-card" style={{marginBottom:18}}>
            <div className="erp-section-head"><h3>{editingId ? "تعديل مقال" : "مقال جديد"}</h3></div>
            <form className="erp-form-grid" onSubmit={handleSubmit}>
              <div><label className="erp-label">العنوان</label><input className="erp-input" value={form.title} onChange={e => setForm({...form, title: e.target.value})} required /></div>
              <div><label className="erp-label">التصنيف</label><input className="erp-input" value={form.category} onChange={e => setForm({...form, category: e.target.value})} /></div>
              <div><label className="erp-label">الوسوم (مفصولة بفواصل)</label><input className="erp-input" value={form.tags} onChange={e => setForm({...form, tags: e.target.value})} /></div>
              <div><label className="erp-label">المحتوى</label><textarea className="erp-input" rows="6" value={form.content} onChange={e => setForm({...form, content: e.target.value})} required /></div>
              <div><label className="erp-check"><input type="checkbox" checked={form.is_published} onChange={e => setForm({...form, is_published: e.target.checked})} /><span>منشور</span></label></div>
              <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : (editingId ? "حفظ" : "إنشاء")}</button><button className="erp-btn-secondary" type="button" onClick={() => setShowForm(false)}>إلغاء</button></div>
            </form>
          </div>
        )}

        <div className="erp-section-card">
          <div className="erp-section-head">
            <div><h3>المقالات</h3><p>جدول المحتوى</p></div>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <input className="erp-input" placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} style={{width:200}} />
              <select className="erp-input" value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}><option value="all">كل التصنيفات</option>{Array.from(new Set(articles.map(a => a.category).filter(Boolean))).map(c => <option key={c} value={c}>{c}</option>)}</select>
              <select className="erp-input" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}><option value="all">الكل</option><option value="published">منشور</option><option value="draft">مسودة</option></select>
              <button className="erp-btn-secondary" onClick={() => exportToCsv(filtered)}>CSV</button>
              <button className="erp-btn-primary" onClick={() => exportToPdf(filtered)}>PDF</button>
            </div>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table"><thead><tr><th>#</th><th>العنوان</th><th>التصنيف</th><th>الوسوم</th><th>الحالة</th><th>تاريخ النشر</th><th>إجراءات</th></tr></thead>
            <tbody>{paged.map(a => (
              <tr key={a.id}><td>{a.id}</td><td>{a.title}</td><td>{a.category || "-"}</td><td>{a.tags || "-"}</td><td><span className={`erp-badge ${a.is_published ? "success" : "warning"}`}>{a.is_published ? "منشور" : "مسودة"}</span></td><td>{new Date(a.created_at).toLocaleDateString()}</td>
              <td><button className="erp-btn-secondary" onClick={() => startEdit(a)}>تعديل</button><button className="erp-btn-danger" onClick={() => handleDelete(a.id)} disabled={deletingId === a.id}>حذف</button></td></tr>
            ))}</tbody></table>
          </div>
          <div style={{display:"flex",justifyContent:"space-between",marginTop:12}}><div>صفحة {page} من {totalPages}</div><div><button disabled={page===1} onClick={() => setPage(p=>p-1)}>السابقة</button><button disabled={page===totalPages} onClick={() => setPage(p=>p+1)}>التالية</button></div></div>
        </div>
      </section>
    </main>
  );
}
