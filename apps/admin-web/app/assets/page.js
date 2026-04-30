"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";

const ASSETS_URL = "https://api.royalpalace-group.com/api/v1/admin/assets";

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

export default function AssetsPage() {
  const { user, ready } = useAdminAuth("assets");
  const [assets, setAssets] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name:"", code:"", purchase_value:"", salvage_value:"", useful_life_years:"5" });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const items = [];

  async function loadAll() {
    try {
      const res = await fetch(ASSETS_URL, { headers: authHeaders() });
      setAssets(res.ok ? await res.json() : []);
    } catch (err) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  function resetForm() { setForm({ name:"", code:"", purchase_value:"", salvage_value:"", useful_life_years:"5" }); setEditingId(null); }
  function startEdit(a) { setEditingId(a.id); setForm({ name:a.name, code:a.code, purchase_value: String(a.purchase_value||""), salvage_value: String(a.salvage_value||""), useful_life_years: String(a.useful_life_years||5) }); }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const payload = { ...form, purchase_value: Number(form.purchase_value), salvage_value: Number(form.salvage_value), useful_life_years: Number(form.useful_life_years) };
      const url = editingId ? `${ASSETS_URL}/${editingId}` : ASSETS_URL;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الحفظ");
      setMessage(editingId ? "تم تعديل الأصل" : "تم إنشاء الأصل");
      resetForm(); loadAll();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function handleDepreciate(id) {
    setSubmitting(true); setMessage("");
    try {
      const res = await fetch(`${ASSETS_URL}/${id}/depreciate`, { method:"POST", headers: authHeaders() });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "فشل حساب الإهلاك");
      setMessage(`تم حساب الإهلاك – القيمة الدفترية الحالية: ${data.net_book_value}`);
      loadAll();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function deleteAsset(id) {
    if (!confirm("حذف الأصل؟")) return;
    await fetch(`${ASSETS_URL}/${id}`, { method:"DELETE", headers:authHeaders() });
    loadAll();
  }

  function handleExportCsv() {
    exportTableCsv("assets.csv", ["الاسم","الكود","قيمة الشراء","قيمة الإنقاذ","العمر","القيمة الحالية","الحالة"], assets.map((a) => [a.name, a.code, a.purchase_value, a.salvage_value, a.useful_life_years, a.current_value, a.status]));
  }
  function handleExportPdf() {
    exportTablePdf("تقرير الأصول","الأصول",[{ label:"عدد الأصول", value:assets.length }], ["الاسم","الكود","قيمة الشراء","قيمة الإنقاذ","العمر","القيمة الحالية","الحالة"], assets.map((a) => [a.name, a.code, a.purchase_value, a.salvage_value, a.useful_life_years, a.current_value, a.status]));
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Assets Management</div><h2>إدارة الأصول</h2><p>إدارة الأصول الثابتة وحساب الإهلاك.</p></div><div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">أصول</div><div className="erp-stat-box-value">{assets.length}</div></div></div></section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <div className="erp-section-head"><h3>{editingId ? "تعديل أصل" : "إضافة أصل جديد"}</h3></div>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}>
            <input className="erp-input" placeholder="اسم الأصل" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} required />
            <input className="erp-input" placeholder="الكود" value={form.code} onChange={(e)=>setForm({...form,code:e.target.value})} required />
            <input className="erp-input" type="number" step="0.01" placeholder="قيمة الشراء" value={form.purchase_value} onChange={(e)=>setForm({...form,purchase_value:e.target.value})} />
            <input className="erp-input" type="number" step="0.01" placeholder="قيمة الإنقاذ" value={form.salvage_value} onChange={(e)=>setForm({...form,salvage_value:e.target.value})} />
            <input className="erp-input" type="number" placeholder="العمر الإنتاجي (سنوات)" value={form.useful_life_years} onChange={(e)=>setForm({...form,useful_life_years:e.target.value})} />
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":editingId?"حفظ التعديل":"إنشاء الأصل"}</button>{editingId&&<button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء</button>}</div>
          </form>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <h3>قائمة الأصول</h3>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}><button className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button><button className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button></div>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr><th>ID</th><th>الاسم</th><th>الكود</th><th>قيمة الشراء</th><th>القيمة الحالية</th><th>الحالة</th><th>إجراءات</th></tr>
              </thead>
              <tbody>
                {assets.length === 0 ? (
                  <tr><td colSpan="7">لا توجد أصول. </td></tr>
                ) : (
                  assets.map((a) => (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td>{a.name}</td>
                      <td>{a.code}</td>
                      <td>{a.purchase_value}</td>
                      <td>{a.current_value}</td>
                      <td>{a.status}</td>
                      <td>
                        <button className="erp-btn-secondary" onClick={() => startEdit(a)}>تعديل</button>
                        <button className="erp-btn-primary" onClick={() => handleDepreciate(a.id)}>إهلاك</button>
                        <button className="erp-btn-danger" onClick={() => deleteAsset(a.id)}>حذف</button>
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
