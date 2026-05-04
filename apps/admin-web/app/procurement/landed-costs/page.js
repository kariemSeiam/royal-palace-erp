"use client";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../../components/hrExports";

const API = "https://api.royalpalace-group.com/api/v1/admin/landed-costs";
const PROD_API = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";
const btStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };

export default function LandedCostsPage() {
  const { user, ready } = useAdminAuth("procurement");
  const [costs, setCosts] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name:"", amount:"", date:"", currency:"EGP", items: [] });
  const [itemForm, setItemForm] = useState({ product_id:"", amount:"" });
  const [msg, setMsg] = useState("");

  async function load() {
    const [cRes, pRes] = await Promise.all([
      fetch(API, { headers: authHeaders() }),
      fetch(PROD_API, { headers: authHeaders() })
    ]);
    setCosts(await cRes.json()); setProducts(await pRes.json());
  }
  useEffect(() => { if (ready && user) load(); }, [ready, user]);

  function addItem() {
    if (itemForm.product_id && itemForm.amount) {
      setForm({...form, items: [...form.items, itemForm]});
      setItemForm({ product_id:"", amount:"" });
    }
  }
  async function save(e) {
    e.preventDefault();
    await fetch(API, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify(form) });
    setForm({ name:"", amount:"", date:"", currency:"EGP", items: [] });
    load();
  }

  const totalAmount = costs.reduce((s,c)=>s+Number(c.amount||0),0);

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">Loading...</div></main>;

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <div className="erp-hero"><div><div className="erp-hero-pill">Landed Costs</div><h2>تكاليف الشحن والجمارك</h2></div>
        <div className="erp-stat-panel">
          <div className="erp-stat-box"><div className="erp-stat-box-label">التكاليف</div><div className="erp-stat-box-value">{costs.length}</div></div>
          <div className="erp-stat-box"><div className="erp-stat-box-label">الإجمالي</div><div className="erp-stat-box-value">{totalAmount.toLocaleString()} ج.م</div></div>
        </div>
      </div>
      {msg && <div className="erp-form-message">{msg}</div>}
      <div className="erp-section-card" style={{marginBottom:18}}>
        <h3>إضافة تكلفة</h3>
        <form onSubmit={save} className="erp-form-grid">
          <input className="erp-input" placeholder="اسم التكلفة" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
          <input className="erp-input" type="number" placeholder="المبلغ" value={form.amount} onChange={e=>setForm({...form, amount:e.target.value})} required />
          <input className="erp-input" type="date" value={form.date} onChange={e=>setForm({...form, date:e.target.value})} />
          <div><h4>البنود</h4>
            <div style={{display:"flex", gap:8}}>
              <select className="erp-input" value={itemForm.product_id} onChange={e=>setItemForm({...itemForm, product_id:e.target.value})}><option value="">المنتج</option>{products.map(p=><option key={p.id} value={p.id}>{p.name_ar}</option>)}</select>
              <input className="erp-input" type="number" placeholder="المبلغ" value={itemForm.amount} onChange={e=>setItemForm({...itemForm, amount:e.target.value})} />
              <button type="button" className="erp-btn-secondary" onClick={addItem}>إضافة</button>
            </div>
            <ul>{form.items.map((it,i)=><li key={i}>{products.find(p=>p.id==it.product_id)?.name_ar} : {it.amount}</li>)}</ul>
          </div>
          <button className="erp-btn-primary" type="submit">حفظ التكلفة</button>
        </form>
      </div>
      <div className="erp-section-card">
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv("landed_costs.csv",["الاسم","المبلغ","التاريخ"], costs.map(c=>[c.name,c.amount,c.date]))}>CSV</button>
          <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx("landed_costs.xlsx",["الاسم","المبلغ","التاريخ"], costs.map(c=>[c.name,c.amount,c.date]))}>Excel</button>
          <button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("تكاليف الشحن","Landed Costs",[{label:"عدد",value:costs.length},{label:"الإجمالي",value:totalAmount.toLocaleString()}],["الاسم","المبلغ","التاريخ"], costs.map(c=>[c.name,c.amount,c.date]))}>PDF</button>
        </div>
        <table className="erp-table"><thead><tr><th>الاسم</th><th>المبلغ</th><th>التاريخ</th></tr></thead><tbody>{costs.map(c=><tr key={c.id}><td>{c.name}</td><td>{c.amount}</td><td>{c.date}</td></tr>)}</tbody></table>
      </div>
    </section></main>
  );
}
