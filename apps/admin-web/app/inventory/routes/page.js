"use client";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../../components/hrExports";

const API = "https://api.royalpalace-group.com/api/v1/admin/inventory";
const btStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };

export default function RoutesPage() {
  const { user, ready } = useAdminAuth("inventory");
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [rules, setRules] = useState([]);
  const [form, setForm] = useState({ name:"", code:"" });
  const [ruleForm, setRuleForm] = useState({ name:"", action:"pull", location_src_id:"", location_dest_id:"", picking_type_id:"", auto:false });
  const [msg, setMsg] = useState("");

  async function loadRoutes() {
    const res = await fetch(`${API}/routes`, { headers: authHeaders() });
    setRoutes(await res.json());
  }
  async function loadRules(rid) {
    const res = await fetch(`${API}/route-rules/${rid}`, { headers: authHeaders() });
    setRules(await res.json());
  }
  useEffect(() => { if (ready && user) loadRoutes(); }, [ready, user]);

  async function createRoute(e) {
    e.preventDefault();
    await fetch(`${API}/routes`, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify(form) });
    setForm({ name:"", code:"" });
    loadRoutes();
  }
  async function createRule(e) {
    e.preventDefault();
    if (!selectedRoute) return;
    await fetch(`${API}/route-rules`, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify({ route_id: selectedRoute.id, ...ruleForm }) });
    setRuleForm({ name:"", action:"pull", location_src_id:"", location_dest_id:"", picking_type_id:"", auto:false });
    loadRules(selectedRoute.id);
  }
  async function deleteRule(id) {
    await fetch(`${API}/route-rules/${id}`, { method:"DELETE", headers: authHeaders() });
    loadRules(selectedRoute.id);
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">Loading...</div></main>;

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <div className="erp-hero"><div><div className="erp-hero-pill">Stock Routes</div><h2>مسارات المخزون</h2></div>
        <div className="erp-stat-panel">
          <div className="erp-stat-box"><div className="erp-stat-box-label">المسارات</div><div className="erp-stat-box-value">{routes.length}</div></div>
          <div className="erp-stat-box"><div className="erp-stat-box-label">القواعد</div><div className="erp-stat-box-value">{rules.length}</div></div>
        </div>
      </div>
      {msg && <div className="erp-form-message">{msg}</div>}
      <div style={{display:"flex",gap:8,marginBottom:12}}>
        <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv("routes.csv",["ID","Name","Code"], routes.map(r=>[r.id,r.name,r.code]))}>CSV</button>
        <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx("routes.xlsx",["ID","Name","Code"], routes.map(r=>[r.id,r.name,r.code]))}>Excel</button>
        <button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("المسارات","Inventory",[{label:"عدد",value:routes.length}],["ID","Name","Code"], routes.map(r=>[r.id,r.name,r.code]))}>PDF</button>
      </div>
      <div className="erp-form-grid erp-form-grid-2">
        <div className="erp-section-card">
          <h3>إضافة مسار</h3>
          <form onSubmit={createRoute} className="erp-form-grid">
            <input className="erp-input" placeholder="اسم المسار" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
            <input className="erp-input" placeholder="الكود" value={form.code} onChange={e=>setForm({...form, code:e.target.value})} required />
            <button className="erp-btn-primary" type="submit">حفظ</button>
          </form>
        </div>
        <div className="erp-section-card">
          <h3>قائمة المسارات</h3>
          <ul>{routes.map(r=><li key={r.id} style={{cursor:"pointer",marginBottom:8, fontWeight: selectedRoute?.id===r.id?"bold":"normal"}} onClick={()=>{setSelectedRoute(r); loadRules(r.id);}}>{r.name} ({r.code})</li>)}</ul>
        </div>
      </div>
      {selectedRoute && (
        <div className="erp-section-card" style={{marginTop:18}}>
          <h3>قواعد المسار: {selectedRoute.name}</h3>
          <form onSubmit={createRule} className="erp-form-grid erp-form-grid-2" style={{marginBottom:16}}>
            <input className="erp-input" placeholder="اسم القاعدة" value={ruleForm.name} onChange={e=>setRuleForm({...ruleForm, name:e.target.value})} required />
            <select className="erp-input" value={ruleForm.action} onChange={e=>setRuleForm({...ruleForm, action:e.target.value})}>
              <option value="push">Push</option><option value="pull">Pull</option>
            </select>
            <input className="erp-input" placeholder="موقع المصدر" value={ruleForm.location_src_id} onChange={e=>setRuleForm({...ruleForm, location_src_id:e.target.value})} />
            <input className="erp-input" placeholder="موقع الوجهة" value={ruleForm.location_dest_id} onChange={e=>setRuleForm({...ruleForm, location_dest_id:e.target.value})} />
            <input className="erp-input" placeholder="نوع العملية" value={ruleForm.picking_type_id} onChange={e=>setRuleForm({...ruleForm, picking_type_id:e.target.value})} />
            <label><input type="checkbox" checked={ruleForm.auto} onChange={e=>setRuleForm({...ruleForm, auto:e.target.checked})} /> تلقائي</label>
            <button className="erp-btn-primary" type="submit">إضافة قاعدة</button>
          </form>
          <table className="erp-table"><thead><tr><th>الاسم</th><th>الإجراء</th><th>من</th><th>إلى</th><th>تلقائي</th><th></th></tr></thead><tbody>{rules.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.action}</td><td>{r.location_src_id}</td><td>{r.location_dest_id}</td><td>{r.auto?"نعم":"لا"}</td><td><button className="erp-btn-danger" style={{fontSize:11}} onClick={()=>deleteRule(r.id)}>حذف</button></td></tr>)}</tbody></table>
        </div>
      )}
    </section></main>
  );
}
