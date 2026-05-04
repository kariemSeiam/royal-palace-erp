"use client";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../../components/hrExports";

const API = "https://api.royalpalace-group.com/api/v1/admin/inventory/putaway-rules";
const PROD_API = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";
const LOC_API = "https://api.royalpalace-group.com/api/v1/admin/advanced-inventory/locations";
const btStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };

export default function PutawayRulesPage() {
  const { user, ready } = useAdminAuth("inventory");
  const [rules, setRules] = useState([]);
  const [products, setProducts] = useState([]);
  const [locations, setLocations] = useState([]);
  const [form, setForm] = useState({ product_id:"", location_src_id:"", location_out_id:"" });
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    const [rRes, pRes, lRes] = await Promise.all([
      fetch(API, { headers: authHeaders() }),
      fetch(PROD_API, { headers: authHeaders() }),
      fetch(LOC_API, { headers: authHeaders() })
    ]);
    setRules(await rRes.json()); setProducts(await pRes.json()); setLocations(await lRes.json());
  }
  useEffect(() => { if (ready && user) load(); }, [ready, user]);

  async function save(e) {
    e.preventDefault();
    await fetch(API, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify(form) });
    setForm({ product_id:"", location_src_id:"", location_out_id:"" });
    load();
  }

  const filtered = rules.filter(r => [r.product_id, r.location_src_id, r.location_out_id].join(" ").toLowerCase().includes(search.toLowerCase()));

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">Loading...</div></main>;

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <div className="erp-hero"><div><div className="erp-hero-pill">Putaway Rules</div><h2>قواعد التخزين</h2></div>
        <div className="erp-stat-panel">
          <div className="erp-stat-box"><div className="erp-stat-box-label">القواعد</div><div className="erp-stat-box-value">{rules.length}</div></div>
        </div>
      </div>
      {msg && <div className="erp-form-message">{msg}</div>}
      <div className="erp-section-card" style={{marginBottom:18}}>
        <h3>إضافة قاعدة</h3>
        <form onSubmit={save} className="erp-form-grid">
          <select className="erp-input" value={form.product_id} onChange={e=>setForm({...form, product_id:e.target.value})}><option value="">المنتج</option>{products.map(p=><option key={p.id} value={p.id}>{p.name_ar}</option>)}</select>
          <select className="erp-input" value={form.location_src_id} onChange={e=>setForm({...form, location_src_id:e.target.value})}><option value="">موقع الاستلام</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <select className="erp-input" value={form.location_out_id} onChange={e=>setForm({...form, location_out_id:e.target.value})}><option value="">موقع التخزين</option>{locations.map(l=><option key={l.id} value={l.id}>{l.name}</option>)}</select>
          <button className="erp-btn-primary" type="submit">حفظ</button>
        </form>
      </div>
      <div className="erp-section-card">
        <div style={{display:"flex",gap:8,marginBottom:12}}>
          <input className="erp-input" placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)} />
          <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv("putaway_rules.csv",["المنتج","من","إلى"], filtered.map(r=>[r.product_id,r.location_src_id,r.location_out_id]))}>CSV</button>
          <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx("putaway_rules.xlsx",["المنتج","من","إلى"], filtered.map(r=>[r.product_id,r.location_src_id,r.location_out_id]))}>Excel</button>
          <button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("قواعد التخزين","Inventory",[{label:"عدد",value:filtered.length}],["المنتج","من","إلى"], filtered.map(r=>[r.product_id,r.location_src_id,r.location_out_id]))}>PDF</button>
        </div>
        <table className="erp-table"><thead><tr><th>المنتج</th><th>من</th><th>إلى</th></tr></thead><tbody>{filtered.map(r=><tr key={r.id}><td>{products.find(p=>p.id==r.product_id)?.name_ar||r.product_id}</td><td>{locations.find(l=>l.id==r.location_src_id)?.name||r.location_src_id}</td><td>{locations.find(l=>l.id==r.location_out_id)?.name||r.location_out_id}</td></tr>)}</tbody></table>
      </div>
    </section></main>
  );
}
