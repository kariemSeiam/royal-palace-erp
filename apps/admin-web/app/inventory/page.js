"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts';

const MOV_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/movements";
const STOCK_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/stock-summary";
const WH_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/warehouses";
const PROD_API = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";
const TRANSFER_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/movements/transfer";
const ALERTS_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/stock-alerts";
const REORDER_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/reorder-rules";
const DASH_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/dashboard-detailed";
const LEDGER_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/stock-ledger";

const btStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };

export default function InventoryPage() {
  const { user, ready } = useAdminAuth("inventory");
  const [movements, setMovements] = useState([]);
  const [stockSummary, setStockSummary] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [rules, setRules] = useState([]);
  const [dash, setDash] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("movements");
  const [search, setSearch] = useState("");
  const [ledgerProduct, setLedgerProduct] = useState("");
  const [ledger, setLedger] = useState([]);

  const [movForm, setMovForm] = useState({ warehouse_id:"", product_id:"", movement_type:"in", quantity:"", reference_type:"", notes:"" });
  const [transferForm, setTransferForm] = useState({ from_warehouse_id:"", to_warehouse_id:"", product_id:"", quantity:"", notes:"" });
  const [ruleForm, setRuleForm] = useState({ warehouse_id:"", product_id:"", min_stock_level:"", reorder_level:"", reorder_quantity:"", notes:"" });

  async function load() {
    const [mRes, sRes, wRes, pRes, aRes, rRes, dRes] = await Promise.all([
      fetch(`${MOV_API}?limit=500`, { headers: authHeaders() }),
      fetch(`${STOCK_API}?limit=500`, { headers: authHeaders() }),
      fetch(WH_API, { headers: authHeaders() }),
      fetch(PROD_API, { headers: authHeaders() }),
      fetch(ALERTS_API, { headers: authHeaders() }),
      fetch(REORDER_API, { headers: authHeaders() }),
      fetch(DASH_API, { headers: authHeaders() }),
    ]);
    const mData = await mRes.json(); const sData = await sRes.json(); const wData = await wRes.json();
    const pData = await pRes.json(); const aData = await aRes.json(); const rData = await rRes.json(); const dData = await dRes.json();
    setMovements(Array.isArray(mData) ? mData : []);
    setStockSummary(Array.isArray(sData) ? sData : []);
    setWarehouses(Array.isArray(wData) ? wData : []);
    setProducts(Array.isArray(pData) ? pData : []);
    setAlerts(Array.isArray(aData) ? aData : []);
    setRules(Array.isArray(rData) ? rData : []);
    setDash(dData);
  }
  useEffect(() => { if (ready && user) load().catch(e => setMsg(e.message)); }, [ready, user]);

  async function loadLedger() {
    if (!ledgerProduct) return;
    const res = await fetch(`${LEDGER_API}?product_id=${ledgerProduct}`, { headers: authHeaders() });
    setLedger(await res.json());
  }
  useEffect(() => { if (ledgerProduct) loadLedger(); }, [ledgerProduct]);

  const stats = useMemo(() => ({
    movements: movements.length,
    products: stockSummary.length,
    warehouses: warehouses.length,
    alerts: alerts.filter(a => a.alert_status !== "healthy").length,
  }), [movements, stockSummary, warehouses, alerts]);

  async function handleMovement(e) { e.preventDefault(); setBusy(true); setMsg(""); try {
    const res = await fetch(MOV_API, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify({ warehouse_id: Number(movForm.warehouse_id), product_id: Number(movForm.product_id), movement_type: movForm.movement_type, quantity: Number(movForm.quantity), reference_type: movForm.reference_type, notes: movForm.notes }) });
    const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.detail);
    setMovForm({ warehouse_id:"", product_id:"", movement_type:"in", quantity:"", reference_type:"", notes:"" }); load();
  } catch(e) { setMsg(e.message); } finally { setBusy(false); } }

  async function handleTransfer(e) { e.preventDefault(); setBusy(true); setMsg(""); try {
    const res = await fetch(TRANSFER_API, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify({ from_warehouse_id: Number(transferForm.from_warehouse_id), to_warehouse_id: Number(transferForm.to_warehouse_id), product_id: Number(transferForm.product_id), quantity: Number(transferForm.quantity), notes: transferForm.notes }) });
    const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.detail);
    setTransferForm({ from_warehouse_id:"", to_warehouse_id:"", product_id:"", quantity:"", notes:"" }); load();
  } catch(e) { setMsg(e.message); } finally { setBusy(false); } }

  async function handleRule(e) { e.preventDefault(); setBusy(true); setMsg(""); try {
    const res = await fetch(REORDER_API, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify({ warehouse_id: Number(ruleForm.warehouse_id), product_id: Number(ruleForm.product_id), min_stock_level: Number(ruleForm.min_stock_level), reorder_level: Number(ruleForm.reorder_level), reorder_quantity: Number(ruleForm.reorder_quantity), notes: ruleForm.notes }) });
    const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.detail);
    setRuleForm({ warehouse_id:"", product_id:"", min_stock_level:"", reorder_level:"", reorder_quantity:"", notes:"" }); load();
  } catch(e) { setMsg(e.message); } finally { setBusy(false); } }

  async function deleteMovement(id) { if (!confirm("Delete movement?")) return; await fetch(`${MOV_API}/${id}`, { method:"DELETE", headers: authHeaders() }); load(); }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">Loading...</div></main>;

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <div className="erp-hero"><div><div className="erp-hero-pill">Inventory Deep</div><h2>المخزون والتحليلات</h2></div>
        <div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">حركات</div><div className="erp-stat-box-value">{stats.movements}</div></div><div className="erp-stat-box"><div className="erp-stat-box-label">تنبيهات</div><div className="erp-stat-box-value">{stats.alerts}</div></div></div>
      </div>
      {msg && <div className="erp-form-message">{msg}</div>}
      <nav style={{display:"flex",gap:6,borderBottom:"1px solid var(--rp-border)",marginBottom:16,flexWrap:"wrap"}}>
        {[{key:"movements",label:"الحركات"},{key:"stock",label:"الرصيد"},{key:"transfer",label:"التحويلات"},{key:"alerts",label:"التنبيهات"},{key:"reorder",label:"قواعد إعادة الطلب"},{key:"reports",label:"التقارير"},{key:"ledger",label:"دفتر الأستاذ"}].map(t=>(
          <button key={t.key} className="erp-btn-ghost" style={{fontWeight:tab===t.key?900:400, borderBottom:tab===t.key?"2px solid var(--rp-primary)":"none"}} onClick={()=>setTab(t.key)}>{t.label}</button>
        ))}
      </nav>

      {tab==="reports" && dash && (<div style={{display:"grid", gap:18}}><div className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">حركات</div><div className="erp-card-value">{dash.total_movements}</div></div><div className="erp-card"><div className="erp-card-title">منتجات مخزنة</div><div className="erp-card-value">{dash.total_products_in_stock}</div></div><div className="erp-card"><div className="erp-card-title">قيمة المخزون</div><div className="erp-card-value">{dash.total_stock_value?.toLocaleString()} ج.م</div></div><div className="erp-card"><div className="erp-card-title">راكدة</div><div className="erp-card-value">{dash.idle_products?.length||0}</div></div></div><div className="erp-section-card"><h4>أعلى 10 منتجات حركة</h4><BarChart width={500} height={250} data={dash.top_moved_products?.slice(0,5) || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="product_name" tick={{fontSize:10}} /><YAxis /><Tooltip /><Bar dataKey="movement_count" fill="#3b82f6" /></BarChart></div><div className="erp-section-card"><h4>توزيع أنواع الحركات</h4><div style={{display:"flex", gap:20, flexWrap:"wrap"}}>{dash.movement_type_distribution && Object.entries(dash.movement_type_distribution).map(([type, count]) => (<div key={type} className="erp-card" style={{flex:1,minWidth:120}}><div className="erp-card-title">{type==='in'?'داخل':type==='out'?'خارج':'تسوية'}</div><div className="erp-card-value">{count}</div></div>))}</div></div></div>)}

      {tab==="ledger" && (<div className="erp-section-card"><h3>دفتر أستاذ المخزون</h3><div style={{display:"flex",gap:8,marginBottom:12}}><select className="erp-input" value={ledgerProduct} onChange={e=>setLedgerProduct(e.target.value)}><option value="">اختر المنتج</option>{products.map(p=><option key={p.id} value={p.id}>{p.name_ar} ({p.sku})</option>)}</select><button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv("stock_ledger.csv",["ID","النوع","الكمية","المخزن","مرجع","التاريخ"], ledger.map(l=>[l.id,l.movement_type,l.quantity,l.warehouse_name,l.reference_type||"",l.created_at]))}>CSV</button><button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx("stock_ledger.xlsx",["ID","النوع","الكمية","المخزن","مرجع","التاريخ"], ledger.map(l=>[l.id,l.movement_type,l.quantity,l.warehouse_name,l.reference_type||"",l.created_at]))}>Excel</button><button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("دفتر الأستاذ","Inventory",[{label:"حركات",value:ledger.length}],["ID","النوع","الكمية","المخزن","مرجع","التاريخ"], ledger.map(l=>[l.id,l.movement_type,l.quantity,l.warehouse_name,l.reference_type||"",l.created_at]))}>PDF</button></div><div className="erp-table-shell"><table className="erp-table"><thead><tr><th>ID</th><th>النوع</th><th>الكمية</th><th>المخزن</th><th>مرجع</th><th>التاريخ</th></tr></thead><tbody>{ledger.map(l=>(<tr key={l.id}><td>{l.id}</td><td>{l.movement_type}</td><td>{l.quantity}</td><td>{l.warehouse_name}</td><td>{l.reference_type||"-"}</td><td>{new Date(l.created_at).toLocaleDateString("ar-EG")}</td></tr>))}</tbody></table></div></div>)}

      {tab==="movements" && (<div className="erp-form-grid erp-form-grid-2" style={{marginBottom:18}}><div className="erp-section-card"><h3>حركة جديدة</h3><form onSubmit={handleMovement} className="erp-form-grid"><select className="erp-input" value={movForm.warehouse_id} onChange={e=>setMovForm({...movForm, warehouse_id:e.target.value})} required><option value="">اختر المخزن</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><select className="erp-input" value={movForm.product_id} onChange={e=>setMovForm({...movForm, product_id:e.target.value})} required><option value="">اختر المنتج</option>{products.map(p=><option key={p.id} value={p.id}>{p.name_ar} ({p.sku})</option>)}</select><select className="erp-input" value={movForm.movement_type} onChange={e=>setMovForm({...movForm, movement_type:e.target.value})}><option value="in">داخل</option><option value="out">خارج</option><option value="adjustment">تسوية</option></select><input type="number" step="0.01" min="0.01" className="erp-input" placeholder="الكمية" value={movForm.quantity} onChange={e=>setMovForm({...movForm, quantity:e.target.value})} required /><input className="erp-input" placeholder="مرجع" value={movForm.reference_type} onChange={e=>setMovForm({...movForm, reference_type:e.target.value})} /><textarea className="erp-input" rows="2" placeholder="ملاحظات" value={movForm.notes} onChange={e=>setMovForm({...movForm, notes:e.target.value})} /><button className="erp-btn-primary" type="submit" disabled={busy}>إضافة</button></form></div><div className="erp-section-card"><h3>آخر الحركات</h3><div style={{display:"flex",gap:8,marginBottom:12}}><button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv("movements.csv",["ID","النوع","الكمية","المخزن","المنتج","مرجع","ملاحظات"], movements.slice(0,50).map(m=>[m.id, m.movement_type, m.quantity, m.warehouse_name, m.product_name, m.reference_type||"", m.notes||""]))}>CSV</button><button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx("movements.xlsx",["ID","النوع","الكمية","المخزن","المنتج","مرجع","ملاحظات"], movements.slice(0,50).map(m=>[m.id, m.movement_type, m.quantity, m.warehouse_name, m.product_name, m.reference_type||"", m.notes||""]))}>Excel</button><button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("الحركات","Inventory",[{label:"إجمالي",value:movements.length}],["ID","النوع","الكمية","المخزن","المنتج","مرجع","ملاحظات"], movements.slice(0,50).map(m=>[m.id, m.movement_type, m.quantity, m.warehouse_name, m.product_name, m.reference_type||"", m.notes||""]))}>PDF</button></div><div className="erp-table-shell" style={{maxHeight:"60vh", overflowY:"auto"}}><table className="erp-table"><thead><tr><th>ID</th><th>نوع</th><th>كمية</th><th>مخزن</th><th>منتج</th><th></th></tr></thead><tbody>{movements.slice(0,100).map(m=>(<tr key={m.id}><td>{m.id}</td><td>{m.movement_type}</td><td>{m.quantity}</td><td>{m.warehouse_name}</td><td>{m.product_name}</td><td><button className="erp-btn-danger" style={{fontSize:12}} onClick={()=>deleteMovement(m.id)}>حذف</button></td></tr>))}</tbody></table></div></div></div>)}

      {tab==="stock" && (<div className="erp-section-card"><h3>رصيد المخزون</h3><div style={{display:"flex",gap:8,marginBottom:12}}><input className="erp-input" placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)} /><button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv("stock.csv",["مصنع","مخزن","منتج","SKU","الرصيد"], stockSummary.filter(s=>[s.factory_name,s.warehouse_name,s.product_name,s.product_sku].join(" ").includes(search.toLowerCase())).map(s=>[s.factory_name, s.warehouse_name, s.product_name, s.product_sku, s.current_stock]))}>CSV</button><button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx("stock.xlsx",["مصنع","مخزن","منتج","SKU","الرصيد"], stockSummary.filter(s=>[s.factory_name,s.warehouse_name,s.product_name,s.product_sku].join(" ").includes(search.toLowerCase())).map(s=>[s.factory_name, s.warehouse_name, s.product_name, s.product_sku, s.current_stock]))}>Excel</button><button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("الرصيد","Inventory",[{label:"عناصر",value:stockSummary.length}],["مصنع","مخزن","منتج","SKU","الرصيد"], stockSummary.filter(s=>[s.factory_name,s.warehouse_name,s.product_name,s.product_sku].join(" ").includes(search.toLowerCase())).map(s=>[s.factory_name, s.warehouse_name, s.product_name, s.product_sku, s.current_stock]))}>PDF</button></div><div className="erp-table-shell" style={{maxHeight:"60vh",overflowY:"auto"}}><table className="erp-table"><thead><tr><th>مصنع</th><th>مخزن</th><th>منتج</th><th>SKU</th><th>الرصيد</th></tr></thead><tbody>{stockSummary.filter(s=>[s.factory_name,s.warehouse_name,s.product_name,s.product_sku].join(" ").includes(search.toLowerCase())).slice(0,200).map((s,i)=>(<tr key={i}><td>{s.factory_name}</td><td>{s.warehouse_name}</td><td>{s.product_name}</td><td>{s.product_sku}</td><td>{s.current_stock}</td></tr>))}</tbody></table></div></div>)}

      {tab==="transfer" && (<div className="erp-section-card"><h3>تحويل بين المخازن</h3><form onSubmit={handleTransfer} className="erp-form-grid erp-form-grid-2"><select className="erp-input" value={transferForm.from_warehouse_id} onChange={e=>setTransferForm({...transferForm, from_warehouse_id:e.target.value})} required><option value="">من مخزن</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><select className="erp-input" value={transferForm.to_warehouse_id} onChange={e=>setTransferForm({...transferForm, to_warehouse_id:e.target.value})} required><option value="">إلى مخزن</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><select className="erp-input" value={transferForm.product_id} onChange={e=>setTransferForm({...transferForm, product_id:e.target.value})} required><option value="">المنتج</option>{products.map(p=><option key={p.id} value={p.id}>{p.name_ar}</option>)}</select><input type="number" step="0.01" min="0.01" className="erp-input" placeholder="الكمية" value={transferForm.quantity} onChange={e=>setTransferForm({...transferForm, quantity:e.target.value})} required /><textarea className="erp-input" rows="2" placeholder="ملاحظات" value={transferForm.notes} onChange={e=>setTransferForm({...transferForm, notes:e.target.value})} /><button className="erp-btn-primary" type="submit" disabled={busy}>تحويل</button></form></div>)}

      {tab==="alerts" && (<div className="erp-section-card"><h3>تنبيهات المخزون</h3><div className="erp-table-shell"><table className="erp-table"><thead><tr><th>مخزن</th><th>منتج</th><th>الرصيد</th><th>الحد الأدنى</th><th>إعادة الطلب</th><th>الحالة</th></tr></thead><tbody>{alerts.map(a=>(<tr key={a.reorder_rule_id}><td>{a.warehouse_name}</td><td>{a.product_name}</td><td>{a.current_stock}</td><td>{a.min_stock_level}</td><td>{a.reorder_level}</td><td><span className="erp-badge warning">{a.alert_status}</span></td></tr>))}</tbody></table></div></div>)}

      {tab==="reorder" && (<div className="erp-section-card"><h3>قواعد إعادة الطلب</h3><form onSubmit={handleRule} className="erp-form-grid erp-form-grid-2" style={{marginBottom:18}}><select className="erp-input" value={ruleForm.warehouse_id} onChange={e=>setRuleForm({...ruleForm, warehouse_id:e.target.value})} required><option value="">المخزن</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select><select className="erp-input" value={ruleForm.product_id} onChange={e=>setRuleForm({...ruleForm, product_id:e.target.value})} required><option value="">المنتج</option>{products.map(p=><option key={p.id} value={p.id}>{p.name_ar}</option>)}</select><input type="number" className="erp-input" placeholder="الحد الأدنى" value={ruleForm.min_stock_level} onChange={e=>setRuleForm({...ruleForm, min_stock_level:e.target.value})} required /><input type="number" className="erp-input" placeholder="مستوى إعادة الطلب" value={ruleForm.reorder_level} onChange={e=>setRuleForm({...ruleForm, reorder_level:e.target.value})} required /><input type="number" className="erp-input" placeholder="كمية إعادة الطلب" value={ruleForm.reorder_quantity} onChange={e=>setRuleForm({...ruleForm, reorder_quantity:e.target.value})} required /><textarea className="erp-input" rows="2" placeholder="ملاحظات" value={ruleForm.notes} onChange={e=>setRuleForm({...ruleForm, notes:e.target.value})} /><button className="erp-btn-primary" type="submit" disabled={busy}>إضافة قاعدة</button></form><div className="erp-table-shell"><table className="erp-table"><thead><tr><th>مخزن</th><th>منتج</th><th>حد أدنى</th><th>إعادة طلب</th><th>الكمية</th></tr></thead><tbody>{rules.map(r=>(<tr key={r.id}><td>{r.warehouse_name}</td><td>{r.product_name}</td><td>{r.min_stock_level}</td><td>{r.reorder_level}</td><td>{r.reorder_quantity}</td></tr>))}</tbody></table></div></div>)}
    </section></main>
  );
}
