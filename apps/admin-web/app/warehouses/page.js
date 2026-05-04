"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';

const API = "https://api.royalpalace-group.com/api/v1/admin/inventory/warehouses";
const FAC_API = "https://api.royalpalace-group.com/api/v1/admin/factories";
const DASH_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/dashboard-detailed";

const btStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];

export default function WarehousesPage() {
  const { user, ready } = useAdminAuth("warehouses");
  const [items, setItems] = useState([]);
  const [factories, setFactories] = useState([]);
  const [dash, setDash] = useState(null);
  const [form, setForm] = useState({ factory_id:"", code:"", name:"", description:"", is_active:true });
  const [editingId, setEditingId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [tab, setTab] = useState("dashboard");
  const [viewMode, setViewMode] = useState("table");

  async function load() {
    const [wRes, fRes, dRes] = await Promise.all([
      fetch(API, { headers: authHeaders(), cache:"no-store" }),
      fetch(FAC_API, { headers: authHeaders(), cache:"no-store" }),
      fetch(DASH_API, { headers: authHeaders(), cache:"no-store" })
    ]);
    const wData = await wRes.json(); const fData = await fRes.json(); const dData = await dRes.json();
    setItems(Array.isArray(wData) ? wData : []);
    setFactories(Array.isArray(fData) ? fData : []);
    setDash(dData);
  }
  useEffect(() => { if (ready && user) load().catch(e => setMsg(e.message)); }, [ready, user]);

  const filtered = useMemo(() => {
    const q = (search||"").toLowerCase();
    let list = items;
    if (tab === "active") list = list.filter(x => x.is_active);
    else if (tab === "inactive") list = list.filter(x => !x.is_active);
    if (q) list = list.filter(x => [x.name, x.code, x.factory_name].join(" ").toLowerCase().includes(q));
    return list;
  }, [items, search, tab]);

  const stats = useMemo(() => ({
    total: items.length, active: items.filter(x=>x.is_active).length,
    products: items.reduce((s,x)=>s+Number(x.products_count||0),0),
    stock: items.reduce((s,x)=>s+Number(x.stock_units_total||0),0),
  }), [items]);

  const reset = () => { setForm({ factory_id:"", code:"", name:"", description:"", is_active:true }); setEditingId(null); };
  const edit = (item) => { setEditingId(item.id); setForm({ factory_id: String(item.factory_id||""), code:item.code||"", name:item.name||"", description:item.description||"", is_active:item.is_active }); };

  async function save(e) {
    e.preventDefault(); setBusy(true); setMsg("");
    const payload = { factory_id: Number(form.factory_id), code: form.code.trim(), name: form.name.trim(), description: form.description.trim()||null, is_active: form.is_active };
    const url = editingId ? `${API}/${editingId}` : API;
    const method = editingId ? "PUT" : "POST";
    try {
      const res = await fetch(url, { method, headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Error");
      setMsg(editingId ? "Updated" : "Created"); reset(); load();
    } catch(e) { setMsg(e.message); } finally { setBusy(false); }
  }

  async function del(id) {
    if (!confirm("Delete?")) return;
    await fetch(`${API}/${id}`, { method:"DELETE", headers: authHeaders() });
    load();
  }

  function expCsv() { exportTableCsv("warehouses.csv", ["ID","Code","Name","Factory","Active","Products","Stock"], filtered.map(x => [x.id, x.code, x.name, x.factory_name, x.is_active, x.products_count, x.stock_units_total])); }
  function expXls() { exportTableXlsx("warehouses.xlsx", ["ID","Code","Name","Factory","Active","Products","Stock"], filtered.map(x => [x.id, x.code, x.name, x.factory_name, x.is_active, x.products_count, x.stock_units_total])); }
  function expPdf() { exportTablePdf("Warehouses","Inventory",[{label:"Total",value:stats.total},{label:"Active",value:stats.active}],["ID","Code","Name","Factory","Active","Products","Stock"], filtered.map(x => [x.id, x.code, x.name, x.factory_name, x.is_active, x.products_count, x.stock_units_total])); }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">Loading...</div></main>;

  const pieData = dash?.movement_type_distribution
    ? Object.entries(dash.movement_type_distribution).map(([key, value]) => ({ name: key === 'in' ? 'داخل' : key === 'out' ? 'خارج' : 'تسوية', value }))
    : [];

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <div className="erp-hero"><div><div className="erp-hero-pill">Inventory Command Center</div><h2>مركز قيادة المخازن</h2></div>
        <div className="erp-stat-panel">
          <div className="erp-stat-box"><div className="erp-stat-box-label">إجمالي المخازن</div><div className="erp-stat-box-value">{stats.total}</div></div>
          <div className="erp-stat-box"><div className="erp-stat-box-label">قيمة المخزون</div><div className="erp-stat-box-value">{dash?.total_stock_value?.toLocaleString() || 0} ج.م</div></div>
        </div>
      </div>
      {msg && <div className="erp-form-message">{msg}</div>}
      <nav style={{display:"flex",gap:6,borderBottom:"1px solid var(--rp-border)",marginBottom:16,flexWrap:"wrap"}}>
        {["dashboard","all","active","inactive"].map(t => (
          <button key={t} className={`erp-btn-ghost`} style={{ fontWeight: tab===t?900:400, borderBottom: tab===t?"2px solid var(--rp-primary)":"none" }} onClick={()=>setTab(t)}>
            {t==="dashboard"?"لوحة القيادة":t==="all"?"الكل":t==="active"?"نشطة":"غير نشطة"}
          </button>
        ))}
        <div style={{marginLeft:"auto", display:"flex", gap:8}}>
          <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={btStyle}>Kanban</button>
          <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={btStyle}>جدول</button>
          <button className="erp-btn-secondary" style={btStyle} onClick={expCsv}>CSV</button>
          <button className="erp-btn-secondary" style={btStyle} onClick={expXls}>Excel</button>
          <button className="erp-btn-primary" style={btStyle} onClick={expPdf}>PDF</button>
        </div>
      </nav>

      {tab==="dashboard" && (
        <div style={{display:"grid", gap:18}}>
          <div className="erp-kpi-grid">
            <div className="erp-card"><div className="erp-card-title">حركات</div><div className="erp-card-value">{dash?.total_movements || 0}</div></div>
            <div className="erp-card"><div className="erp-card-title">منتجات مخزنة</div><div className="erp-card-value">{dash?.total_products_in_stock || 0}</div></div>
            <div className="erp-card"><div className="erp-card-title">منتجات راكدة</div><div className="erp-card-value">{dash?.idle_products?.length || 0}</div></div>
            <div className="erp-card"><div className="erp-card-title">تنبيهات</div><div className="erp-card-value">{dash?.idle_products?.length > 0 ? 'نشطة' : 'لا يوجد'}</div></div>
          </div>
          <div className="erp-form-grid erp-form-grid-2">
            <div className="erp-section-card"><h4>أعلى المنتجات حركة</h4><BarChart width={400} height={200} data={dash?.top_moved_products?.slice(0,5) || []}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="product_name" tick={{fontSize:10}} /><YAxis /><Tooltip /><Bar dataKey="movement_count" fill="#3b82f6" /></BarChart></div>
            <div className="erp-section-card"><h4>نسب أنواع الحركات</h4>{pieData.length > 0 ? (<PieChart width={300} height={200}><Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} label>{pieData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip /></PieChart>) : <p>لا بيانات كافية</p>}</div>
          </div>
          {dash?.idle_products?.length > 0 && (<div className="erp-section-card"><h4>تنبيهات المنتجات الراكدة</h4><table className="erp-table"><thead><tr><th>المنتج</th><th>المخزون الحالي</th><th>آخر حركة</th></tr></thead><tbody>{dash.idle_products.map(p => (<tr key={p.product_id}><td>{p.product_name}</td><td>{p.current_stock}</td><td>منذ 30+ يوم</td></tr>))}</tbody></table></div>)}
        </div>
      )}

      {tab!=="dashboard" && viewMode==="kanban" && (
        <KanbanBoard items={filtered} statusField="is_active" statusOptions={[true,false]} statusLabels={{true:"نشط",false:"غير نشط"}} statusColors={{true:"#10b981",false:"#6b7280"}} renderCard={item => <div><div style={{fontWeight:900}}>{item.name}</div><div>{item.code} - {item.factory_name}</div><div>حركات: {item.movements_count} | منتجات: {item.products_count}</div></div>} onAction={item => <div style={{display:"flex",gap:6}}><button className="erp-btn-secondary" style={{fontSize:11}} onClick={()=>edit(item)}>تعديل</button><button className="erp-btn-danger" style={{fontSize:11}} onClick={()=>del(item.id)}>حذف</button></div>} emptyMessage="لا توجد مخازن" />
      )}

      {tab!=="dashboard" && viewMode==="table" && (
        <div className="erp-form-grid erp-form-grid-2">
          <div className="erp-section-card">
            <h3>{editingId ? "تعديل" : "مخزن جديد"}</h3>
            <form onSubmit={save} className="erp-form-grid">
              <select className="erp-input" value={form.factory_id} onChange={e=>setForm({...form, factory_id:e.target.value})}><option value="">اختر المصنع</option>{factories.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select>
              <input className="erp-input" placeholder="الكود" value={form.code} onChange={e=>setForm({...form, code:e.target.value})} required />
              <input className="erp-input" placeholder="الاسم" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
              <textarea className="erp-input" rows="2" placeholder="وصف" value={form.description} onChange={e=>setForm({...form, description:e.target.value})} />
              <label><input type="checkbox" checked={form.is_active} onChange={e=>setForm({...form, is_active:e.target.checked})} /> نشط</label>
              <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={busy}>{busy?"جاري...":editingId?"حفظ":"إضافة"}</button>{editingId && <button className="erp-btn-secondary" type="button" onClick={reset}>إلغاء</button>}</div>
            </form>
          </div>
          <div className="erp-section-card">
            <div style={{display:"flex", justifyContent:"space-between", marginBottom:12}}><input className="erp-input" placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)} style={{maxWidth:300}} /></div>
            <div style={{display:"grid", gap:12}}>
              {filtered.map(item => (<div key={item.id} style={{border:"1px solid var(--rp-border)", borderRadius:16, padding:12}}><div style={{display:"flex", justifyContent:"space-between"}}><div><b>{item.name}</b> ({item.code}) <br/><small>{item.factory_name}</small></div><span className={`erp-badge ${item.is_active?"success":"warning"}`}>{item.is_active?"نشط":"غير نشط"}</span></div><div className="erp-kpi-grid" style={{marginTop:8}}><div className="erp-card"><div className="erp-card-title">حركات</div><div className="erp-card-value">{item.movements_count}</div></div><div className="erp-card"><div className="erp-card-title">منتجات</div><div className="erp-card-value">{item.products_count}</div></div><div className="erp-card"><div className="erp-card-title">مخزون</div><div className="erp-card-value">{item.stock_units_total}</div></div></div><div style={{display:"flex", gap:8, marginTop:8}}><button className="erp-btn-secondary" onClick={()=>edit(item)}>تعديل</button><button className="erp-btn-danger" onClick={()=>del(item.id)}>حذف</button></div></div>))}
              {filtered.length===0 && <div className="erp-form-message">لا توجد مخازن</div>}
            </div>
          </div>
        </div>
      )}
    </section></main>
  );
}
