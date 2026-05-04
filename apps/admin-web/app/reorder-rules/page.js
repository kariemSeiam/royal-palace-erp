"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../components/hrExports";

const API = "https://api.royalpalace-group.com/api/v1/admin/inventory/reorder-rules";
const WH_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/warehouses";
const PROD_API = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";
const PO_API = "https://api.royalpalace-group.com/api/v1/admin/procurement/purchase-orders";
const SUP_API = "https://api.royalpalace-group.com/api/v1/admin/procurement/suppliers";
const AUTO_REPLENISH_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/auto-replenish";
const btStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };

export default function ReorderRulesPage() {
  const { user, ready } = useAdminAuth("inventory");
  const [rules, setRules] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [form, setForm] = useState({ warehouse_id:"", product_id:"", min_stock_level:"", reorder_level:"", reorder_quantity:"", notes:"" });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [modal, setModal] = useState({ open: false, rule: null });
  const [poForm, setPoForm] = useState({ supplier_id: "", warehouse_id: "" });

  async function load() {
    const [rRes, wRes, pRes, sRes] = await Promise.all([
      fetch(API, { headers: authHeaders() }), fetch(WH_API, { headers: authHeaders() }), fetch(PROD_API, { headers: authHeaders() }), fetch(SUP_API, { headers: authHeaders() }),
    ]);
    const rData = await rRes.json(); const wData = await wRes.json(); const pData = await pRes.json(); const sData = await sRes.json();
    setRules(Array.isArray(rData)?rData:[]); setWarehouses(Array.isArray(wData)?wData:[]); setProducts(Array.isArray(pData)?pData:[]); setSuppliers(Array.isArray(sData)?sData:[]);
  }
  useEffect(() => { if (ready && user) load().catch(e=>setMsg(e.message)); }, [ready, user]);

  const stats = { total: rules.length, active: rules.filter(r=>r.is_active).length, products: new Set(rules.map(r=>r.product_id)).size };

  async function save(e) { e.preventDefault(); setBusy(true); setMsg(""); try {
    const res = await fetch(API, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify({ warehouse_id: Number(form.warehouse_id), product_id: Number(form.product_id), min_stock_level: Number(form.min_stock_level), reorder_level: Number(form.reorder_level), reorder_quantity: Number(form.reorder_quantity), notes: form.notes }) });
    const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.detail);
    setForm({ warehouse_id:"", product_id:"", min_stock_level:"", reorder_level:"", reorder_quantity:"", notes:"" }); load();
  } catch(e) { setMsg(e.message); } finally { setBusy(false); } }

  async function del(id) { if (!confirm("Delete?")) return; await fetch(`${API}/${id}`, { method:"DELETE", headers: authHeaders() }); load(); }

  async function batchReplenish() { setBusy(true); setMsg(""); try {
    const res = await fetch(AUTO_REPLENISH_API, { method:"POST", headers: authHeaders() });
    const data = await res.json().catch(()=>({}));
    if (!res.ok) throw new Error(data.detail||"Failed");
    setMsg(`تم إنشاء ${data.created_pos?.length || 0} أوامر شراء تلقائياً`); load();
  } catch(e) { setMsg(e.message); } finally { setBusy(false); } }

  function openPoModal(rule) { setModal({ open: true, rule }); setPoForm({ supplier_id: "", warehouse_id: String(rule.warehouse_id || "") }); }
  async function createPurchaseOrder(e) { e.preventDefault(); setBusy(true); setMsg(""); if (!modal.rule) return; try {
    const supplier = suppliers.find(s => s.id === Number(poForm.supplier_id)); const wh = warehouses.find(w => w.id === Number(poForm.warehouse_id)); const product = products.find(p => p.id === modal.rule.product_id);
    const poNumber = `PO-REORDER-${Date.now()}`;
    const payload = { supplier_id: Number(poForm.supplier_id), warehouse_id: Number(poForm.warehouse_id), po_number: poNumber, factory_id: wh?.factory_id || supplier?.factory_id, status: "draft", notes: `إنشاء آلي من قاعدة إعادة الطلب #${modal.rule.id} - ${product?.name_ar || ''}`, items: [{ product_id: modal.rule.product_id, quantity: modal.rule.reorder_quantity, unit_cost: 0 }] };
    const res = await fetch(PO_API, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify(payload) });
    const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.detail || "Failed to create PO");
    setMsg(`تم إنشاء أمر الشراء ${poNumber} بنجاح`); setModal({ open: false, rule: null }); load();
  } catch(e) { setMsg(e.message); } finally { setBusy(false); } }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">Loading...</div></main>;

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <div className="erp-hero"><div><div className="erp-hero-pill">Smart Replenishment</div><h2>قواعد إعادة الطلب الذكية</h2></div>
        <div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">القواعد</div><div className="erp-stat-box-value">{stats.total}</div></div><div className="erp-stat-box"><div className="erp-stat-box-label">نشطة</div><div className="erp-stat-box-value">{stats.active}</div></div></div>
      </div>
      {msg && <div className="erp-form-message">{msg}</div>}
      <div className="erp-kpi-grid" style={{marginBottom:18}}><div className="erp-card"><div className="erp-card-title">القواعد</div><div className="erp-card-value">{stats.total}</div></div><div className="erp-card"><div className="erp-card-title">نشطة</div><div className="erp-card-value">{stats.active}</div></div><div className="erp-card"><div className="erp-card-title">منتجات مغطاة</div><div className="erp-card-value">{stats.products}</div></div></div>
      <div style={{display:"flex",gap:8,marginBottom:12}}><button className="erp-btn-primary" style={btStyle} onClick={batchReplenish} disabled={busy}>{busy?"جاري...":"توليد أوامر شراء للجميع"}</button></div>
      <div className="erp-form-grid erp-form-grid-2">
        <div className="erp-section-card"><h3>قاعدة جديدة</h3><form onSubmit={save} className="erp-form-grid"><select className="erp-input" value={form.warehouse_id} onChange={e=>setForm({...form, warehouse_id:e.target.value})} required><option value="">المخزن</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><select className="erp-input" value={form.product_id} onChange={e=>setForm({...form, product_id:e.target.value})} required><option value="">المنتج</option>{products.map(p=><option key={p.id} value={p.id}>{p.name_ar} ({p.sku})</option>)}</select><input type="number" className="erp-input" placeholder="الحد الأدنى" value={form.min_stock_level} onChange={e=>setForm({...form, min_stock_level:e.target.value})} required /><input type="number" className="erp-input" placeholder="مستوى إعادة الطلب" value={form.reorder_level} onChange={e=>setForm({...form, reorder_level:e.target.value})} required /><input type="number" className="erp-input" placeholder="كمية إعادة الطلب" value={form.reorder_quantity} onChange={e=>setForm({...form, reorder_quantity:e.target.value})} required /><textarea className="erp-input" rows="2" placeholder="ملاحظات" value={form.notes} onChange={e=>setForm({...form, notes:e.target.value})} /><button className="erp-btn-primary" type="submit" disabled={busy}>حفظ</button></form></div>
        <div className="erp-section-card"><div style={{display:"flex",gap:8,marginBottom:12}}><button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv("reorder_rules.csv",["ID","مخزن","منتج","حد أدنى","إعادة طلب","الكمية"], rules.map(r=>[r.id,r.warehouse_name,r.product_name,r.min_stock_level,r.reorder_level,r.reorder_quantity]))}>CSV</button><button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx("reorder_rules.xlsx",["ID","مخزن","منتج","حد أدنى","إعادة طلب","الكمية"], rules.map(r=>[r.id,r.warehouse_name,r.product_name,r.min_stock_level,r.reorder_level,r.reorder_quantity]))}>Excel</button><button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("قواعد إعادة الطلب","Inventory",[{label:"عدد القواعد",value:rules.length}],["ID","مخزن","منتج","حد أدنى","إعادة طلب","الكمية"], rules.map(r=>[r.id,r.warehouse_name,r.product_name,r.min_stock_level,r.reorder_level,r.reorder_quantity]))}>PDF</button></div><table className="erp-table"><thead><tr><th>ID</th><th>مخزن</th><th>منتج</th><th>حد أدنى</th><th>إعادة طلب</th><th>الكمية</th><th></th></tr></thead><tbody>{rules.map(r=>(<tr key={r.id}><td>{r.id}</td><td>{r.warehouse_name}</td><td>{r.product_name}</td><td>{r.min_stock_level}</td><td>{r.reorder_level}</td><td>{r.reorder_quantity}</td><td style={{display:"flex",gap:6}}><button className="erp-btn-primary" style={{fontSize:11}} onClick={() => openPoModal(r)}>إنشاء أمر شراء</button><button className="erp-btn-danger" style={{fontSize:11}} onClick={()=>del(r.id)}>حذف</button></td></tr>))}</tbody></table></div>
      </div>
      {modal.open && (<div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}><div style={{background:'white',borderRadius:24,padding:24,width:480,maxWidth:'90%'}}><h3>إنشاء أمر شراء من قاعدة إعادة الطلب</h3><p style={{color:"var(--rp-text-muted)",fontSize:13}}>المنتج: {products.find(p=>p.id===modal.rule?.product_id)?.name_ar || "-"} | الكمية المقترحة: {modal.rule?.reorder_quantity}</p><form onSubmit={createPurchaseOrder} style={{display:'grid',gap:12}}><select className="erp-input" value={poForm.supplier_id} onChange={e=>setPoForm({...poForm, supplier_id:e.target.value})} required><option value="">اختر المورد</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select><select className="erp-input" value={poForm.warehouse_id} onChange={e=>setPoForm({...poForm, warehouse_id:e.target.value})} required><option value="">اختر المخزن المستلم</option>{warehouses.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}</select><div style={{display:'flex',gap:8}}><button className="erp-btn-primary" type="submit" disabled={busy}>{busy ? "جاري..." : "إنشاء أمر الشراء"}</button><button className="erp-btn-secondary" type="button" onClick={()=>setModal({open:false,rule:null})}>إلغاء</button></div></form></div></div>)}
    </section></main>
  );
}
