"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const PAGES_URL = "https://api.royalpalace-group.com/api/v1/admin/website/pages";
const MENUS_URL = "https://api.royalpalace-group.com/api/v1/admin/website/menus";

export default function WebsitePage() {
  const { user, ready } = useAdminAuth("website");
  const [pages, setPages] = useState([]);
  const [menus, setMenus] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ title: "", slug: "", content: "", meta_description: "", is_published: false });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    try {
      const [pagesRes, menusRes] = await Promise.all([
        fetch(PAGES_URL, { headers: authHeaders() }),
        fetch(MENUS_URL, { headers: authHeaders() }),
      ]);
      setPages(pagesRes.ok ? await pagesRes.json() : []);
      setMenus(menusRes.ok ? await menusRes.json() : []);
    } catch (e) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  function resetForm() { setForm({ title: "", slug: "", content: "", meta_description: "", is_published: false }); setEditingId(null); }
  function startEdit(p) { setEditingId(p.id); setForm({ title: p.title, slug: p.slug, content: p.content || "", meta_description: p.meta_description || "", is_published: p.is_published }); }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const payload = { ...form };
      const url = editingId ? `${PAGES_URL}/${editingId}` : PAGES_URL;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الحفظ");
      setMessage(editingId ? "تم تعديل الصفحة" : "تم إنشاء الصفحة");
      resetForm(); await loadAll();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function deletePage(id) {
    if (!confirm("حذف الصفحة؟")) return;
    await fetch(`${PAGES_URL}/${id}`, { method: "DELETE", headers: authHeaders() });
    loadAll();
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">Website Builder</div><h2>إدارة الموقع</h2><p>إنشاء وتعديل صفحات وقوائم الموقع.</p></div>
          <div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">صفحات</div><div className="erp-stat-box-value">{pages.length}</div></div><div className="erp-stat-box"><div className="erp-stat-box-label">قوائم</div><div className="erp-stat-box-value">{menus.length}</div></div></div>
        </section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head"><h3>{editingId ? "تعديل صفحة" : "إضافة صفحة جديدة"}</h3></div>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}>
            <input className="erp-input" placeholder="العنوان" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
            <input className="erp-input" placeholder="slug" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} required />
            <textarea className="erp-input" rows="8" placeholder="المحتوى" value={form.content} onChange={(e) => setForm({ ...form, content: e.target.value })} />
            <input className="erp-input" placeholder="Meta Description" value={form.meta_description} onChange={(e) => setForm({ ...form, meta_description: e.target.value })} />
            <label><input type="checkbox" checked={form.is_published} onChange={(e) => setForm({ ...form, is_published: e.target.checked })} /> منشورة</label>
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إنشاء الصفحة"}</button>{editingId && <button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء</button>}</div>
          </form>
        </div>
        <div className="erp-section-card">
          <div className="erp-section-head"><h3>الصفحات</h3></div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr><th>ID</th><th>العنوان</th><th>Slug</th><th>منشورة</th><th>إجراءات</th></tr>
              </thead>
              <tbody>
                {pages.length === 0 ? (
                  <tr><td colSpan="5">لا توجد صفحات. </td></tr>
                ) : (
                  pages.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.title}</td>
                      <td>{p.slug}</td>
                      <td>{p.is_published ? "نعم" : "لا"}</td>
                      <td>
                        <div style={{ display: "flex", gap: "6px" }}>
                          <button className="erp-btn-secondary" onClick={() => startEdit(p)}>تعديل</button>
                          <button className="erp-btn-danger" onClick={() => deletePage(p.id)}>حذف</button>
                        </div>
                      </td>
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
