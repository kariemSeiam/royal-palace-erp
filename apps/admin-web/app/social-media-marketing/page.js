"use client";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import KanbanBoard from "../components/KanbanBoard";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/social-media";
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

const emptyForm = { platform: "facebook", content: "", scheduled_at: "" };
const POST_STATUSES = ["draft","scheduled","published"];
const POST_STATUS_LABELS = { draft:"مسودة", scheduled:"مجدول", published:"منشور" };
const POST_STATUS_COLORS = { draft:"#6b7280", scheduled:"#3b82f6", published:"#10b981" };

function companyName() { return "Royal Palace Group"; }

function exportToCsv(items) { if (!items.length) return; const headers = ["ID", "المنصة", "المحتوى", "الحالة", "تاريخ الجدولة"]; const rows = items.map((item) => { const scheduled = item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : ""; return [item.id, item.platform, item.content, item.status, scheduled].map((cell) => { const s = String(cell ?? ""); if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`; return s; }).join(","); }); const csv = [headers.join(","), ...rows].join("\n"); const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }); const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = "social_media_export.csv"; link.click(); URL.revokeObjectURL(link.href); }

function exportToPdf(items) { const win = window.open("", "_blank", "width=1280,height=900"); if (!win) return; const rowsHtml = items.map((item) => { const scheduled = item.scheduled_at ? new Date(item.scheduled_at).toLocaleString() : "-"; return `<tr><td>${item.id}</td><td>${item.platform}</td><td>${(item.content || "").substring(0, 100)}</td><td>${item.status}</td><td>${scheduled}</td></tr>`; }).join(""); const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير منشورات وسائل التواصل</title><style>@page { size: A4 landscape; margin: 12mm; } body { font-family: Arial, sans-serif; color: #0f172a; margin: 20px; } table { width: 100%; border-collapse: collapse; } th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right; } thead th { background: #e2e8f0; }</style></head><body><h2>تقرير منشورات وسائل التواصل - ${companyName()}</h2><table><thead><tr><th>#</th><th>المنصة</th><th>المحتوى</th><th>الحالة</th><th>تاريخ الجدولة</th></tr></thead><tbody>${rowsHtml}</tbody></table><script>setTimeout(() => window.print(), 400);</script></body></html>`; win.document.open(); win.document.write(html); win.document.close(); }

function renderPostCard(p) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:"14px" }}>{p.platform}</div>
      <div style={{ fontSize:"12px", color:"var(--rp-text-muted)" }}>{(p.content||"").substring(0,60)}...</div>
      {p.scheduled_at && <div style={{ fontSize:"11px", color:"var(--rp-text-soft)" }}>{new Date(p.scheduled_at).toLocaleString()}</div>}
    </div>
  );
}

export default function SocialMediaMarketingPage() {
  const { user, ready } = useAdminAuth("social_media");
  const [posts, setPosts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [viewMode, setViewMode] = useState("kanban");

  const [tableSearch, setTableSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const loadPosts = async () => { const res = await fetch(API_URL, { headers: authHeaders(), cache: "no-store" }); const data = await res.json().catch(() => []); if (!res.ok) throw new Error(data.detail || "فشل تحميل المنشورات"); setPosts(Array.isArray(data) ? data : []); };
  useEffect(() => { if (!ready) return; loadPosts().catch((err) => setMessage(err.message)); }, [ready]);
  useEffect(() => { setPage(1); }, [tableSearch, platformFilter, statusFilter, sortBy, pageSize]);

  const filtered = useMemo(() => { const q = (tableSearch || "").trim().toLowerCase(); let list = [...posts]; if (platformFilter !== "all") list = list.filter((p) => p.platform === platformFilter); if (statusFilter !== "all") list = list.filter((p) => p.status === statusFilter); if (q) list = list.filter((p) => (p.content || "").toLowerCase().includes(q) || (p.platform || "").includes(q)); list.sort((a, b) => { if (sortBy === "oldest") return new Date(a.scheduled_at || a.created_at) - new Date(b.scheduled_at || b.created_at); if (sortBy === "platform") return String(a.platform || "").localeCompare(String(b.platform || "")); return new Date(b.scheduled_at || b.created_at) - new Date(a.scheduled_at || a.created_at); }); return list; }, [posts, tableSearch, platformFilter, statusFilter, sortBy]);

  const stats = useMemo(() => { const platforms = new Set(posts.map((p) => p.platform)); return { total: posts.length, platforms: platforms.size, scheduled: posts.filter((p) => p.status === "scheduled").length, published: posts.filter((p) => p.status === "published").length }; }, [posts]);
  const paged = useMemo(() => { const start = (page - 1) * pageSize; return filtered.slice(start, start + pageSize); }, [filtered, page, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); setMessage(""); };
  const startEdit = (post) => { setEditingId(post.id); setShowForm(true); setForm({ platform: post.platform || "facebook", content: post.content || "", scheduled_at: post.scheduled_at ? post.scheduled_at.substring(0, 16) : "" }); setMessage(""); };
  const handleDelete = async (id) => { if (!confirm("هل تريد حذف هذا المنشور؟")) return; setDeletingId(id); setMessage(""); try { const res = await fetch(`${API_URL}/${id}`, { method: "DELETE", headers: authHeaders() }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.detail || "فشل حذف المنشور"); setMessage("تم حذف المنشور بنجاح"); if (editingId === id) resetForm(); await loadPosts(); } catch (err) { setMessage(err.message); } finally { setDeletingId(null); } };
  const handleSubmit = async (e) => { e.preventDefault(); setSubmitting(true); setMessage(""); try { const payload = { platform: form.platform, content: form.content.trim(), scheduled_at: form.scheduled_at || null }; const url = editingId ? `${API_URL}/${editingId}` : API_URL; const method = editingId ? "PUT" : "POST"; const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(payload) }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.detail || (editingId ? "فشل تعديل المنشور" : "فشل إنشاء المنشور")); setMessage(editingId ? "تم تعديل المنشور بنجاح" : "تم إنشاء المنشور بنجاح"); resetForm(); await loadPosts(); } catch (err) { setMessage(err.message); } finally { setSubmitting(false); } };

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ تحميل وسائل التواصل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero"><div><div className="erp-hero-pill">Social Media Marketing</div><h2>إدارة منشورات وسائل التواصل</h2><p>جدولة ونشر المحتوى على فيسبوك، تويتر، انستغرام، ولينكدإن</p></div><div><button className="erp-btn-secondary" onClick={() => setShowForm(!showForm)}>{showForm ? "إخفاء" : "فتح"} النموذج</button><button className="erp-btn-primary" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}>إضافة منشور</button></div></section>
        <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">إجمالي المنشورات</div><div className="erp-card-value">{stats.total}</div></div><div className="erp-card"><div className="erp-card-title">منصات</div><div className="erp-card-value">{stats.platforms}</div></div><div className="erp-card"><div className="erp-card-title">مجدول</div><div className="erp-card-value">{stats.scheduled}</div></div><div className="erp-card"><div className="erp-card-title">منشور</div><div className="erp-card-value">{stats.published}</div></div></section>
        {message && <div className="erp-form-message" style={{ marginBottom: "16px" }}>{message}</div>}
        {showForm && (<div className="erp-section-card" style={{ marginBottom: "18px" }}><form className="erp-form-grid" onSubmit={handleSubmit}><select className="erp-input" value={form.platform} onChange={(e) => setForm({ ...form, platform: e.target.value })}><option value="facebook">فيسبوك</option><option value="twitter">تويتر</option><option value="instagram">انستغرام</option><option value="linkedin">لينكدإن</option></select><textarea className="erp-input" rows="4" placeholder="محتوى المنشور" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} required /><input className="erp-input" type="datetime-local" value={form.scheduled_at || ""} onChange={(e) => setForm({ ...form, scheduled_at: e.target.value })} /><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingId ? "حفظ" : "نشر"}</button><button className="erp-btn-secondary" type="button" onClick={resetForm}>إلغاء</button></div></form></div>)}

        <div className="erp-section-card">
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px", alignItems: "center" }}>
            <input className="erp-input" style={{ flex: "1 1 260px" }} placeholder="بحث في المحتوى أو المنصة" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} />
            <select className="erp-input" style={{ flex: "1 1 150px" }} value={platformFilter} onChange={(e) => setPlatformFilter(e.target.value)}><option value="all">كل المنصات</option><option value="facebook">فيسبوك</option><option value="twitter">تويتر</option><option value="instagram">انستغرام</option><option value="linkedin">لينكدإن</option></select>
            <select className="erp-input" style={{ flex: "1 1 150px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}><option value="all">كل الحالات</option><option value="draft">مسودة</option><option value="scheduled">مجدول</option><option value="published">منشور</option></select>
            <select className="erp-input" style={{ flex: "1 1 150px" }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}><option value="newest">الأحدث</option><option value="oldest">الأقدم</option><option value="platform">المنصة</option></select>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
            <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={{minHeight:"38px",borderRadius:"12px",padding:"0 14px",fontWeight:800}}>Kanban</button>
            <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={{minHeight:"38px",borderRadius:"12px",padding:"0 14px",fontWeight:800}}>جدول</button>
            <button className="erp-btn-secondary" onClick={() => exportToCsv(filtered)}>CSV</button>
            <button className="erp-btn-primary" onClick={() => exportToPdf(filtered)}>PDF</button>
            <div style={{ marginInlineStart: "auto" }}><span className="erp-mini-note">إجمالي: {filtered.length}</span><select className="erp-input" style={{ marginInlineStart: 8, width: 80 }} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>{PAGE_SIZE_OPTIONS.map((s) => (<option key={s} value={s}>{s}</option>))}</select></div>
          </div>

          {viewMode==="table" && (
          <div className="erp-table-shell" style={{ maxHeight: "60vh", overflow: "auto" }}><table className="erp-table"><thead><tr><th>#</th><th>المنصة</th><th>المحتوى</th><th>الحالة</th><th>تاريخ الجدولة</th><th>إجراءات</th></tr></thead><tbody>{paged.length === 0 ? (<tr><td colSpan="6">لا توجد منشورات مطابقة.</td></tr>) : (paged.map((p) => (<tr key={p.id}><td>{p.id}</td><td>{p.platform}</td><td>{(p.content || "").substring(0, 80)}...</td><td><span className={`erp-badge ${p.status === "published" ? "success" : "warning"}`}>{p.status}</span></td><td>{p.scheduled_at ? new Date(p.scheduled_at).toLocaleString() : "-"}</td><td><button className="erp-btn-secondary" style={{ marginInlineEnd: 6 }} onClick={() => startEdit(p)}>تعديل</button><button className="erp-btn-danger" onClick={() => handleDelete(p.id)} disabled={deletingId === p.id}>{deletingId === p.id ? "جاري الحذف" : "حذف"}</button></td></tr>)))}</tbody></table></div>)}

          {viewMode==="kanban" && (
            <KanbanBoard items={filtered} statusField="status" statusOptions={POST_STATUSES} statusLabels={POST_STATUS_LABELS} statusColors={POST_STATUS_COLORS}
              renderCard={renderPostCard}
              onAction={(p)=>(<><button className="erp-btn-secondary" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>startEdit(p)}>تعديل</button><button className="erp-btn-danger" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>handleDelete(p.id)}>حذف</button></>)}
              emptyMessage="لا توجد منشورات" />
          )}

          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}><span>صفحة {page} من {totalPages}</span><div><button className="erp-btn-secondary" disabled={page === 1} onClick={() => setPage(1)}>الأولى</button><button className="erp-btn-secondary" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابقة</button><button className="erp-btn-secondary" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>التالية</button><button className="erp-btn-secondary" disabled={page === totalPages} onClick={() => setPage(totalPages)}>الأخيرة</button></div></div>
        </div>
      </section>
    </main>
  );
}
