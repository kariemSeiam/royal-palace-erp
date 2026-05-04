"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";

const ADJ_API = "https://api.royalpalace-group.com/api/v1/admin/advanced-inventory/inventory-adjustments";
const LINES_API = "https://api.royalpalace-group.com/api/v1/admin/advanced-inventory/inventory-adjustment-lines";
const PROD_API = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";
const MOV_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/movements";
const WH_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/warehouses";
const btStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };

export default function AdjustmentsPage() {
  const { user, ready } = useAdminAuth("inventory");
  const [adjustments, setAdjustments] = useState([]);
  const [lines, setLines] = useState({});
  const [products, setProducts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [showLines, setShowLines] = useState(false);
  const [msg, setMsg] = useState("");
  const [newName, setNewName] = useState("");
  const [lineModal, setLineModal] = useState({ open: false, adjId: null });
  const [lineForm, setLineForm] = useState({ product_id:"", warehouse_id:"", expected_quantity:"", counted_quantity:"" });
  const [viewMode, setViewMode] = useState("table");

  async function load() {
    const [aRes, pRes, wRes] = await Promise.all([
      fetch(ADJ_API, { headers: authHeaders() }),
      fetch(PROD_API, { headers: authHeaders() }),
      fetch(WH_API, { headers: authHeaders() })
    ]);
    const aData = await aRes.json(); const pData = await pRes.json(); const wData = await wRes.json();
    setAdjustments(Array.isArray(aData)?aData:[]);
    setProducts(Array.isArray(pData)?pData:[]);
    setWarehouses(Array.isArray(wData)?wData:[]);
  }
  useEffect(() => { if (ready && user) load().catch(e=>setMsg(e.message)); }, [ready, user]);

  async function createAdjustment() {
    if (!newName.trim()) return;
    await fetch(ADJ_API, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify({ name: newName }) });
    setNewName("");
    load();
  }

  async function apply(id) {
    const adjLines = lines[id] || [];
    // إنشاء حركات تسوية لكل سطر
    for (const line of adjLines) {
      if (line.product_id && line.difference_quantity && Number(line.difference_quantity) !== 0) {
        await fetch(MOV_API, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify({
          warehouse_id: line.warehouse_id || line.location_id,
          product_id: line.product_id,
          movement_type: "adjustment",
          quantity: Math.abs(Number(line.difference_quantity)),
          reference_type: "inventory_adjustment",
          reference_id: id,
          notes: `تسوية جرد #${id}`
        }) });
      }
    }
    await fetch(`${ADJ_API}/${id}/apply`, { method:"PUT", headers: authHeaders() });
    load();
  }

  async function loadLines(adjId) {
    const res = await fetch(`${LINES_API}/${adjId}`, { headers: authHeaders() });
    const data = await res.json();
    setLines(prev=>({...prev, [adjId]: Array.isArray(data)?data:[]}));
  }

  async function addLine(e) {
    e.preventDefault();
    const adjId = lineModal.adjId;
    await fetch(LINES_API, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify({
      adjustment_id: adjId,
      product_id: Number(lineForm.product_id),
      location_id: lineForm.warehouse_id ? Number(lineForm.warehouse_id) : null,
      expected_quantity: Number(lineForm.expected_quantity||0),
      counted_quantity: Number(lineForm.counted_quantity||0),
      difference_quantity: Number(lineForm.counted_quantity||0) - Number(lineForm.expected_quantity||0)
    }) });
    setLineForm({ product_id:"", warehouse_id:"", expected_quantity:"", counted_quantity:"" });
    setLineModal({ open: false, adjId: null });
    loadLines(adjId);
  }

  const stats = { total: adjustments.length, draft: adjustments.filter(a=>a.state==='draft').length, done: adjustments.filter(a=>a.state==='done').length };

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">Loading...</div></main>;

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <div className="erp-hero"><div><div className="erp-hero-pill">Inventory Adjustments</div><h2>الجرد الدوري</h2></div>
        <div className="erp-stat-panel">
          <div className="erp-stat-box"><div className="erp-stat-box-label">إجمالي الجرد</div><div className="erp-stat-box-value">{stats.total}</div></div>
          <div className="erp-stat-box"><div className="erp-stat-box-label">مسودة</div><div className="erp-stat-box-value">{stats.draft}</div></div>
        </div>
      </div>
      {msg && <div className="erp-form-message">{msg}</div>}
      <div className="erp-kpi-grid" style={{marginBottom:18}}>
        <div className="erp-card"><div className="erp-card-title">إجمالي</div><div className="erp-card-value">{stats.total}</div></div>
        <div className="erp-card"><div className="erp-card-title">مسودة</div><div className="erp-card-value">{stats.draft}</div></div>
        <div className="erp-card"><div className="erp-card-title">مكتمل</div><div className="erp-card-value">{stats.done}</div></div>
      </div>
      <div style={{display:"flex",gap:8,marginBottom:16}}>
        <input className="erp-input" placeholder="اسم الجرد" value={newName} onChange={e=>setNewName(e.target.value)} />
        <button className="erp-btn-primary" style={btStyle} onClick={createAdjustment}>جرد جديد</button>
        <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={btStyle}>Kanban</button>
        <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={btStyle}>جدول</button>
        <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv("adjustments.csv",["ID","الاسم","الحالة","التاريخ"], adjustments.map(a=>[a.id,a.name,a.state,a.scheduled_date||"-"]))}>CSV</button>
        <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx("adjustments.xlsx",["ID","الاسم","الحالة","التاريخ"], adjustments.map(a=>[a.id,a.name,a.state,a.scheduled_date||"-"]))}>Excel</button>
        <button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("الجرد الدوري","Inventory",[{label:"إجمالي",value:stats.total}],["ID","الاسم","الحالة","التاريخ"], adjustments.map(a=>[a.id,a.name,a.state,a.scheduled_date||"-"]))}>PDF</button>
      </div>

      {viewMode==="table" && (
        <div className="erp-table-shell">
          <table className="erp-table">
            <thead><tr><th>ID</th><th>الاسم</th><th>الحالة</th><th>التاريخ</th><th></th></tr></thead>
            <tbody>
              {adjustments.map(a=>(
                <tr key={a.id}>
                  <td>{a.id}</td><td>{a.name}</td><td><span className={`erp-badge ${a.state==='done'?'success':'warning'}`}>{a.state}</span></td><td>{a.scheduled_date||"-"}</td>
                  <td>
                    <button className="erp-btn-secondary" style={{fontSize:12}} onClick={()=>{ setSelected(a.id); setShowLines(true); loadLines(a.id); }}>سطور</button>
                    <button className="erp-btn-primary" style={{fontSize:12,marginLeft:4}} onClick={()=>apply(a.id)} disabled={a.state!=="draft"}>تطبيق</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {viewMode==="kanban" && (
        <KanbanBoard items={adjustments} statusField="state" statusOptions={["draft","done"]} statusLabels={{"draft":"مسودة","done":"مكتمل"}} statusColors={{"draft":"#f59e0b","done":"#10b981"}} renderCard={a=><div><div style={{fontWeight:900}}>{a.name}</div><div>{a.scheduled_date||"-"}</div></div>} onAction={a=><><button className="erp-btn-secondary" style={{fontSize:11}} onClick={()=>{ setSelected(a.id); setShowLines(true); loadLines(a.id); }}>سطور</button><button className="erp-btn-primary" style={{fontSize:11}} onClick={()=>apply(a.id)} disabled={a.state!=="draft"}>تطبيق</button></>} />
      )}

      {showLines && selected && (
        <div className="erp-section-card" style={{marginTop:18}}>
          <h3>سطور الجرد #{selected}</h3>
          <button className="erp-btn-primary" style={{...btStyle, marginBottom:12}} onClick={()=>{ setLineModal({open:true, adjId:selected}); setLineForm({product_id:"",warehouse_id:"",expected_quantity:"",counted_quantity:""}); }}>إضافة سطر</button>
          <table className="erp-table">
            <thead><tr><th>ID</th><th>منتج</th><th>متوقع</th><th>معدود</th><th>الفرق</th></tr></thead>
            <tbody>
              {(lines[selected]||[]).map(l=>(
                <tr key={l.id}><td>{l.id}</td><td>{products.find(p=>p.id===l.product_id)?.name_ar || l.product_id}</td><td>{l.expected_quantity}</td><td>{l.counted_quantity}</td><td>{l.difference_quantity}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {lineModal.open && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000}}>
          <div style={{background:'white',borderRadius:24,padding:24,width:480,maxWidth:'90%'}}>
            <h3>إضافة سطر جرد</h3>
            <form onSubmit={addLine} style={{display:'grid',gap:12}}>
              <select className="erp-input" value={lineForm.product_id} onChange={e=>setLineForm({...lineForm, product_id:e.target.value})} required><option value="">المنتج</option>{products.map(p=><option key={p.id} value={p.id}>{p.name_ar}</option>)}</select>
              <select className="erp-input" value={lineForm.warehouse_id} onChange={e=>setLineForm({...lineForm, warehouse_id:e.target.value})}><option value="">المخزن</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select>
              <input type="number" step="0.01" className="erp-input" placeholder="الكمية المتوقعة" value={lineForm.expected_quantity} onChange={e=>setLineForm({...lineForm, expected_quantity:e.target.value})} required />
              <input type="number" step="0.01" className="erp-input" placeholder="الكمية المعدودة" value={lineForm.counted_quantity} onChange={e=>setLineForm({...lineForm, counted_quantity:e.target.value})} required />
              <div style={{display:'flex',gap:8}}>
                <button className="erp-btn-primary" type="submit">إضافة</button>
                <button className="erp-btn-secondary" type="button" onClick={()=>setLineModal({open:false,adjId:null})}>إلغاء</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section></main>
  );
}
