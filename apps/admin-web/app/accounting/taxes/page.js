"use client";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/taxes";

export default function TaxesPage() {
  const { user, ready } = useAdminAuth("tax");
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name:"", code:"", rate:"", tax_type:"sales", tax_scope:"goods", country_id:"", account_id:"", price_include:false, include_base_amount:false, description:"" });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function loadData() { try { const res = await fetch(API_URL, { headers: authHeaders() }); setItems(res.ok ? await res.json() : []); } catch (e) { setMessage("تعذر التحميل"); } }
  useEffect(() => { if (ready && user) loadData(); }, [ready, user]);

  const filtered = useMemo(() => { const q = search.toLowerCase(); return q ? items.filter(i => JSON.stringify(i).toLowerCase().includes(q)) : items; }, [items, search]);
  const stats = useMemo(() => ({ total: items.length, sales: items.filter(i => i.tax_type==="sales").length, purchase: items.filter(i => i.tax_type==="purchase").length }), [items]);

  function resetForm() { setForm({ name:"", code:"", rate:"", tax_type:"sales", tax_scope:"goods", country_id:"", account_id:"", price_include:false, include_base_amount:false, description:"" }); setEditingId(null); }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const body = { name: form.name, code: form.code, rate: Number(form.rate), tax_type: form.tax_type, tax_scope: form.tax_scope, country_id: form.country_id ? Number(form.country_id) : null, account_id: form.account_id ? Number(form.account_id) : null, price_include: form.price_include, include_base_amount: form.include_base_amount, description: form.description };
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("فشل الحفظ");
      setMessage(editingId ? "تم التحديث" : "تم الإنشاء");
      resetForm(); loadData();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function handleDelete(id) { if (!confirm("حذف الضريبة؟")) return; await fetch(`${API_URL}/${id}`, { method: "DELETE", headers: authHeaders() }); loadData(); }

  function handleCsv() { exportTableCsv("taxes.csv", ["الاسم","الكود","النسبة %","النوع","النطاق","شامل السعر","تضمين الأساس","نشط"], filtered.map(i => [i.name, i.code, i.rate, i.tax_type==="sales"?"مبيعات":"مشتريات", i.tax_scope, i.price_include?"نعم":"لا", i.include_base_amount?"نعم":"لا", i.is_active?"نعم":"لا"])); }
  function handlePdf() { exportTablePdf("تقرير الضرائب", "المحاسبة / الضرائب", [{ label: "إجمالي الضرائب", value: stats.total }, { label: "مبيعات", value: stats.sales }, { label: "مشتريات", value: stats.purchase }], ["الاسم","الكود","النسبة %","النوع","النطاق","شامل السعر","تضمين الأساس","نشط"], filtered.map(i => [i.name, i.code, i.rate, i.tax_type==="sales"?"مبيعات":"مشتريات", i.tax_scope, i.price_include?"نعم":"لا", i.include_base_amount?"نعم":"لا", i.is_active?"نعم":"لا"])); }


  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <section className="erp-hero"><div><div className="erp-hero-pill">المحاسبة / الضرائب</div><h2>إدارة الضرائب</h2><p>تكوين ضرائب المبيعات والمشتريات.</p></div></section>
      <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">إجمالي الضرائب</div><div className="erp-card-value">{stats.total}</div></div><div className="erp-card"><div className="erp-card-title">مبيعات</div><div className="erp-card-value">{stats.sales}</div></div><div className="erp-card"><div className="erp-card-title">مشتريات</div><div className="erp-card-value">{stats.purchase}</div></div></section>
      {message && <div className="erp-form-message">{message}</div>}
      <div className="erp-section-card" style={{ marginBottom: 18 }}>
        <h3>{editingId ? "تعديل ضريبة" : "ضريبة جديدة"}</h3>
        <form className="erp-form-grid" onSubmit={handleSubmit}>
          <input className="erp-input" placeholder="اسم الضريبة" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <input className="erp-input" placeholder="كود الضريبة" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required />
          <input className="erp-input" type="number" step="0.01" placeholder="النسبة %" value={form.rate} onChange={e => setForm({ ...form, rate: e.target.value })} />
          <select className="erp-input" value={form.tax_type} onChange={e => setForm({ ...form, tax_type: e.target.value })}><option value="sales">مبيعات</option><option value="purchase">مشتريات</option></select>
          <select className="erp-input" value={form.tax_scope} onChange={e => setForm({ ...form, tax_scope: e.target.value })}><option value="goods">سلع</option><option value="services">خدمات</option></select>
          <input className="erp-input" type="number" placeholder="معرف الدولة" value={form.country_id} onChange={e => setForm({ ...form, country_id: e.target.value })} />
          <input className="erp-input" type="number" placeholder="معرف الحساب المحاسبي" value={form.account_id} onChange={e => setForm({ ...form, account_id: e.target.value })} />
          <label className="erp-check"><input type="checkbox" checked={form.price_include} onChange={e => setForm({ ...form, price_include: e.target.checked })} /><span>السعر شامل الضريبة</span></label>
          <label className="erp-check"><input type="checkbox" checked={form.include_base_amount} onChange={e => setForm({ ...form, include_base_amount: e.target.checked })} /><span>تضمين المبلغ الأساسي</span></label>
          <textarea className="erp-input" rows="2" placeholder="ملاحظات" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingId ? "تحديث" : "إنشاء"}</button><button className="erp-btn-secondary" type="button" onClick={resetForm}>إلغاء</button></div>
        </form>
      </div>
      <div className="erp-section-card">
        <div style={{ display:"flex", gap:10, marginBottom:12, alignItems:"center" }}>
          <input className="erp-input" style={{ flex:"1 1 240px" }} placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="erp-btn-secondary" onClick={handleCsv} style={{ minHeight:38, borderRadius:12, padding:"0 14px", fontWeight:800 }}>CSV</button>
          <button className="erp-btn-primary" onClick={handlePdf} style={{ minHeight:38, borderRadius:12, padding:"0 14px", fontWeight:800 }}>PDF</button>
        </div>
        <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>النسبة %</th><th>النوع</th><th>النطاق</th><th>شامل السعر</th><th>تضمين الأساس</th><th>نشط</th><th>إجراءات</th></tr></thead><tbody>{filtered.map(item => (<tr key={item.id}><td>{item.id}</td><td>{item.name}</td><td>{item.code}</td><td>{item.rate}%</td><td>{item.tax_type==="sales"?"مبيعات":"مشتريات"}</td><td>{item.tax_scope||"-"}</td><td>{item.price_include?"نعم":"لا"}</td><td>{item.include_base_amount?"نعم":"لا"}</td><td>{item.is_active?"نعم":"لا"}</td><td><button className="erp-btn-secondary" style={{ marginInlineEnd:6 }} onClick={()=>{setEditingId(item.id);setForm(item);}}>تعديل</button><button className="erp-btn-danger" onClick={()=>handleDelete(item.id)}>حذف</button></td></tr>))}</tbody></table></div>
      </div>
    </section></main>
  );
}
