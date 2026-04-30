"use client";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/payment-terms";
const LINES_API = "https://api.royalpalace-group.com/api/v1/admin/payment-term-lines";

export default function PaymentTermsPage() {
  const { user, ready } = useAdminAuth("payment_terms");
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name:"", code:"", sequence:"10", description:"" });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [termLines, setTermLines] = useState({});
  const [lineForm, setLineForm] = useState({ term_id:"", sequence:"10", value_type:"percent", value:"", days:"", discount_percentage:"", discount_days:"", description:"" });

  async function loadData() { try { const res = await fetch(API_URL, { headers: authHeaders() }); setItems(res.ok ? await res.json() : []); } catch (e) { setMessage("تعذر التحميل"); } }
  useEffect(() => { if (ready && user) loadData(); }, [ready, user]);

  const filtered = useMemo(() => { const q = search.toLowerCase(); return q ? items.filter(i => JSON.stringify(i).toLowerCase().includes(q)) : items; }, [items, search]);
  const stats = useMemo(() => ({ total: items.length, active: items.filter(i => i.is_active).length }), [items]);

  function resetForm() { setForm({ name:"", code:"", sequence:"10", description:"" }); setEditingId(null); }
  async function loadLines(termId) {
    try {
      const res = await fetch(`${LINES_API}?term_id=${termId}`, { headers: authHeaders() });
      const data = res.ok ? await res.json() : [];
      setTermLines(prev => ({ ...prev, [termId]: data }));
    } catch(e) {}
  }
  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const body = { name: form.name, code: form.code, sequence: Number(form.sequence), description: form.description };
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("فشل الحفظ");
      setMessage(editingId ? "تم التحديث" : "تم الإنشاء");
      resetForm(); loadData();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }
  async function handleLineSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const res = await fetch(LINES_API, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(lineForm) });
      if (!res.ok) throw new Error("فشل الحفظ");
      setMessage("تم إضافة السطر");
      setLineForm({ term_id:lineForm.term_id, sequence:"10", value_type:"percent", value:"", days:"", discount_percentage:"", discount_days:"", description:"" });
      loadLines(lineForm.term_id);
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }
  async function deleteLine(lineId, termId) { await fetch(`${LINES_API}/${lineId}`, { method:"DELETE", headers:authHeaders() }); loadLines(termId); }
  async function handleDelete(id) { if (!confirm("حذف شرط الدفع؟")) return; await fetch(`${API_URL}/${id}`, { method:"DELETE", headers:authHeaders() }); loadData(); }

  function handleCsv() { exportTableCsv("payment_terms.csv", ["الاسم","الكود","الترتيب","الوصف","نشط"], filtered.map(i => [i.name, i.code, i.sequence, i.description, i.is_active?"نعم":"لا"])); }
  function handlePdf() { exportTablePdf("تقرير شروط الدفع", "المحاسبة / شروط الدفع", [{ label: "إجمالي الشروط", value: stats.total }, { label: "نشطة", value: stats.active }], ["الاسم","الكود","الترتيب","الوصف","نشط"], filtered.map(i => [i.name, i.code, i.sequence, i.description, i.is_active?"نعم":"لا"])); }


  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <section className="erp-hero"><div><div className="erp-hero-pill">المحاسبة / شروط الدفع</div><h2>شروط الدفع</h2><p>إدارة شروط وأجال الدفع للعملاء والموردين.</p></div></section>
      <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">إجمالي الشروط</div><div className="erp-card-value">{stats.total}</div></div><div className="erp-card"><div className="erp-card-title">نشطة</div><div className="erp-card-value">{stats.active}</div></div></section>
      {message && <div className="erp-form-message">{message}</div>}
      <div className="erp-section-card" style={{ marginBottom:18 }}>
        <h3>{editingId ? "تعديل شرط دفع" : "شرط دفع جديد"}</h3>
        <form className="erp-form-grid" onSubmit={handleSubmit}>
          <input className="erp-input" placeholder="اسم الشرط" value={form.name} onChange={e => setForm({ ...form, name:e.target.value })} required />
          <input className="erp-input" placeholder="كود الشرط" value={form.code} onChange={e => setForm({ ...form, code:e.target.value })} />
          <input className="erp-input" type="number" placeholder="الترتيب" value={form.sequence} onChange={e => setForm({ ...form, sequence:e.target.value })} />
          <textarea className="erp-input" rows="2" placeholder="ملاحظات" value={form.description} onChange={e => setForm({ ...form, description:e.target.value })} />
          <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":editingId?"تحديث":"إنشاء"}</button><button className="erp-btn-secondary" type="button" onClick={resetForm}>إلغاء</button></div>
        </form>
      </div>
      <div className="erp-section-card">
        <div style={{ display:"flex", gap:10, marginBottom:12, alignItems:"center" }}>
          <input className="erp-input" style={{ flex:"1 1 240px" }} placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className="erp-btn-secondary" onClick={handleCsv} style={{ minHeight:38, borderRadius:12, padding:"0 14px", fontWeight:800 }}>CSV</button>
          <button className="erp-btn-primary" onClick={handlePdf} style={{ minHeight:38, borderRadius:12, padding:"0 14px", fontWeight:800 }}>PDF</button>
        </div>
        <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>#</th><th>الاسم</th><th>الكود</th><th>الترتيب</th><th>الوصف</th><th>نشط</th><th>إجراءات</th></tr></thead><tbody>{filtered.map(item => (<tr key={item.id}><td>{item.id}</td><td>{item.name}</td><td>{item.code||"-"}</td><td>{item.sequence}</td><td>{item.description||"-"}</td><td><span className={`erp-badge ${item.is_active?"success":"warning"}`}>{item.is_active?"نشط":"غير نشط"}</span></td><td><button className="erp-btn-secondary" style={{ marginInlineEnd:6 }} onClick={()=>{setEditingId(item.id);setForm({name:item.name,code:item.code,sequence:item.sequence,description:item.description})}}>تعديل</button><button className="erp-btn-primary" style={{ marginInlineEnd:6 }} onClick={()=>{loadLines(item.id);setLineForm(prev=>({...prev,term_id:item.id}))}}>أسطر</button><button className="erp-btn-danger" onClick={()=>handleDelete(item.id)}>حذف</button></td></tr>))}</tbody></table></div>
      </div>
      {lineForm.term_id && (
        <div className="erp-section-card" style={{ marginTop:18 }}>
          <h3>أسطر شرط الدفع #{lineForm.term_id}</h3>
          <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:12 }}>
            {(termLines[lineForm.term_id]||[]).map(line => (
              <div key={line.id} style={{ border:"1px solid var(--rp-border)", borderRadius:12, padding:"10px", minWidth:200 }}>
                <div>النوع: {line.value_type} | القيمة: {line.value} | أيام: {line.days}</div>
                {line.discount_percentage && <div>خصم: {line.discount_percentage}% خلال {line.discount_days} يوم</div>}
                <button className="erp-btn-danger" style={{ marginTop:6 }} onClick={()=>deleteLine(line.id, lineForm.term_id)}>حذف</button>
              </div>
            ))}
          </div>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleLineSubmit}>
            <select className="erp-input" value={lineForm.value_type} onChange={e=>setLineForm({...lineForm,value_type:e.target.value})}><option value="percent">نسبة مئوية</option><option value="fixed">مبلغ ثابت</option></select>
            <input className="erp-input" type="number" step="0.01" placeholder="القيمة" value={lineForm.value} onChange={e=>setLineForm({...lineForm,value:e.target.value})} required />
            <input className="erp-input" type="number" placeholder="عدد الأيام" value={lineForm.days} onChange={e=>setLineForm({...lineForm,days:e.target.value})} required />
            <input className="erp-input" type="number" step="0.01" placeholder="خصم % (إن وجد)" value={lineForm.discount_percentage} onChange={e=>setLineForm({...lineForm,discount_percentage:e.target.value})} />
            <input className="erp-input" type="number" placeholder="أيام الخصم" value={lineForm.discount_days} onChange={e=>setLineForm({...lineForm,discount_days:e.target.value})} />
            <input className="erp-input" placeholder="ملاحظات" value={lineForm.description} onChange={e=>setLineForm({...lineForm,description:e.target.value})} />
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>إضافة سطر</button></div>
          </form>
        </div>
      )}
    </section></main>
  );
}
