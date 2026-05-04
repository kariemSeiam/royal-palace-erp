"use client";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../../components/hrExports";

const API = "https://api.royalpalace-group.com/api/v1/admin/inventory/uom";
const PACK_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/packaging";
const PROD_API = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";
const btStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };

export default function UoMPage() {
  const { user, ready } = useAdminAuth("products");
  const [uoms, setUoms] = useState([]);
  const [packagings, setPackagings] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({ name:"", code:"", factor:1, rounding:0.01 });
  const [packForm, setPackForm] = useState({ product_id:"", name:"", uom_id:"", qty:1 });
  const [tab, setTab] = useState("uom");

  async function load() {
    const [uRes, pRes, prodRes] = await Promise.all([
      fetch(API, { headers: authHeaders() }),
      fetch(PACK_API, { headers: authHeaders() }),
      fetch(PROD_API, { headers: authHeaders() })
    ]);
    setUoms(await uRes.json()); setPackagings(await pRes.json()); setProducts(await prodRes.json());
  }
  useEffect(() => { if (ready && user) load(); }, [ready, user]);

  async function saveUoM(e) {
    e.preventDefault();
    await fetch(API, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify(form) });
    setForm({ name:"", code:"", factor:1, rounding:0.01 });
    load();
  }
  async function savePack(e) {
    e.preventDefault();
    await fetch(PACK_API, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify(packForm) });
    setPackForm({ product_id:"", name:"", uom_id:"", qty:1 });
    load();
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">Loading...</div></main>;

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <div className="erp-hero"><div><div className="erp-hero-pill">UoM & Packaging</div><h2>وحدات القياس والتعبئة</h2></div>
        <div className="erp-stat-panel">
          <div className="erp-stat-box"><div className="erp-stat-box-label">الوحدات</div><div className="erp-stat-box-value">{uoms.length}</div></div>
          <div className="erp-stat-box"><div className="erp-stat-box-label">التعبئة</div><div className="erp-stat-box-value">{packagings.length}</div></div>
        </div>
      </div>
      <nav style={{display:"flex",gap:6,borderBottom:"1px solid var(--rp-border)",marginBottom:16}}>
        <button className={`erp-btn-ghost`} style={{fontWeight:tab==="uom"?900:400}} onClick={()=>setTab("uom")}>وحدات القياس</button>
        <button className={`erp-btn-ghost`} style={{fontWeight:tab==="pack"?900:400}} onClick={()=>setTab("pack")}>التعبئة</button>
      </nav>
      {tab==="uom" && (
        <div className="erp-form-grid erp-form-grid-2">
          <div className="erp-section-card">
            <form onSubmit={saveUoM} className="erp-form-grid">
              <input className="erp-input" placeholder="اسم الوحدة" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
              <input className="erp-input" placeholder="الكود" value={form.code} onChange={e=>setForm({...form, code:e.target.value})} required />
              <input className="erp-input" type="number" step="0.0001" placeholder="المعامل" value={form.factor} onChange={e=>setForm({...form, factor:e.target.value})} />
              <input className="erp-input" type="number" step="0.0001" placeholder="التقريب" value={form.rounding} onChange={e=>setForm({...form, rounding:e.target.value})} />
              <button className="erp-btn-primary" type="submit">حفظ</button>
            </form>
          </div>
          <div className="erp-section-card">
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv("uom.csv",["الاسم","الكود","المعامل"], uoms.map(u=>[u.name,u.code,u.factor]))}>CSV</button>
              <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx("uom.xlsx",["الاسم","الكود","المعامل"], uoms.map(u=>[u.name,u.code,u.factor]))}>Excel</button>
              <button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("وحدات القياس","UoM",[{label:"عدد",value:uoms.length}],["الاسم","الكود","المعامل"], uoms.map(u=>[u.name,u.code,u.factor]))}>PDF</button>
            </div>
            <table className="erp-table"><thead><tr><th>الاسم</th><th>الكود</th><th>المعامل</th></tr></thead><tbody>{uoms.map(u=><tr key={u.id}><td>{u.name}</td><td>{u.code}</td><td>{u.factor}</td></tr>)}</tbody></table>
          </div>
        </div>
      )}
      {tab==="pack" && (
        <div className="erp-form-grid erp-form-grid-2">
          <div className="erp-section-card">
            <form onSubmit={savePack} className="erp-form-grid">
              <select className="erp-input" value={packForm.product_id} onChange={e=>setPackForm({...packForm, product_id:e.target.value})}><option value="">المنتج</option>{products.map(p=><option key={p.id} value={p.id}>{p.name_ar}</option>)}</select>
              <input className="erp-input" placeholder="اسم التعبئة" value={packForm.name} onChange={e=>setPackForm({...packForm, name:e.target.value})} required />
              <select className="erp-input" value={packForm.uom_id} onChange={e=>setPackForm({...packForm, uom_id:e.target.value})}><option value="">وحدة القياس</option>{uoms.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select>
              <input className="erp-input" type="number" step="0.01" placeholder="الكمية" value={packForm.qty} onChange={e=>setPackForm({...packForm, qty:e.target.value})} />
              <button className="erp-btn-primary" type="submit">حفظ</button>
            </form>
          </div>
          <div className="erp-section-card">
            <div style={{display:"flex",gap:8,marginBottom:12}}>
              <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv("packaging.csv",["المنتج","التعبئة","الوحدة","الكمية"], packagings.map(p=>[p.product_name,p.name,p.uom_name,p.qty]))}>CSV</button>
              <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx("packaging.xlsx",["المنتج","التعبئة","الوحدة","الكمية"], packagings.map(p=>[p.product_name,p.name,p.uom_name,p.qty]))}>Excel</button>
              <button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("التعبئة","Packaging",[{label:"عدد",value:packagings.length}],["المنتج","التعبئة","الوحدة","الكمية"], packagings.map(p=>[p.product_name,p.name,p.uom_name,p.qty]))}>PDF</button>
            </div>
            <table className="erp-table"><thead><tr><th>المنتج</th><th>التعبئة</th><th>الوحدة</th><th>الكمية</th></tr></thead><tbody>{packagings.map(p=><tr key={p.id}><td>{p.product_name}</td><td>{p.name}</td><td>{p.uom_name}</td><td>{p.qty}</td></tr>)}</tbody></table>
          </div>
        </div>
      )}
    </section></main>
  );
}
