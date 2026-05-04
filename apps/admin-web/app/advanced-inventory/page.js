"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../components/hrExports";

const BASE = "https://api.royalpalace-group.com/api/v1/admin/advanced-inventory";
const btStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };

export default function AdvancedInventoryPage() {
  const { user, ready } = useAdminAuth("inventory");
  const [tab, setTab] = useState("locations");
  const [locations, setLocations] = useState([]);
  const [pickings, setPickings] = useState([]);
  const [moves, setMoves] = useState([]);
  const [quants, setQuants] = useState([]);
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");

  async function load() {
    const [lRes, pRes, mRes, qRes] = await Promise.all([
      fetch(`${BASE}/locations`, { headers: authHeaders() }),
      fetch(`${BASE}/pickings`, { headers: authHeaders() }),
      fetch(`${BASE}/moves`, { headers: authHeaders() }),
      fetch(`${BASE}/quants`, { headers: authHeaders() }),
    ]);
    const lData = await lRes.json(); const pData = await pRes.json();
    const mData = await mRes.json(); const qData = await qRes.json();
    setLocations(Array.isArray(lData)?lData:[]);
    setPickings(Array.isArray(pData)?pData:[]);
    setMoves(Array.isArray(mData)?mData:[]);
    setQuants(Array.isArray(qData)?qData:[]);
  }
  useEffect(() => { if (ready && user) load().catch(e=>setMsg(e.message)); }, [ready, user]);

  const stats = { locations: locations.length, pickings: pickings.length, moves: moves.length, quants: quants.length };

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">Loading...</div></main>;

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <div className="erp-hero"><div><div className="erp-hero-pill">Advanced Inventory</div><h2>المخزون المتقدم</h2></div>
        <div className="erp-stat-panel">
          <div className="erp-stat-box"><div className="erp-stat-box-label">مواقع</div><div className="erp-stat-box-value">{stats.locations}</div></div>
          <div className="erp-stat-box"><div className="erp-stat-box-label">تحويلات</div><div className="erp-stat-box-value">{stats.pickings}</div></div>
        </div>
      </div>
      {msg && <div className="erp-form-message">{msg}</div>}
      <div className="erp-kpi-grid" style={{marginBottom:18}}>
        <div className="erp-card"><div className="erp-card-title">مواقع</div><div className="erp-card-value">{stats.locations}</div></div>
        <div className="erp-card"><div className="erp-card-title">تحويلات</div><div className="erp-card-value">{stats.pickings}</div></div>
        <div className="erp-card"><div className="erp-card-title">حركات</div><div className="erp-card-value">{stats.moves}</div></div>
        <div className="erp-card"><div className="erp-card-title">كميات</div><div className="erp-card-value">{stats.quants}</div></div>
      </div>
      <nav style={{display:"flex",gap:6,borderBottom:"1px solid var(--rp-border)",marginBottom:16}}>
        {["locations","pickings","moves","quants"].map(t=>(
          <button key={t} className="erp-btn-ghost" style={{fontWeight:tab===t?900:400, borderBottom:tab===t?"2px solid var(--rp-primary)":"none"}} onClick={()=>setTab(t)}>
            {t==="locations"?"المواقع":t==="pickings"?"التحويلات":t==="moves"?"الحركات":"الكميات"}
          </button>
        ))}
        <div style={{marginLeft:"auto",display:"flex",gap:8}}>
          <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv(`${tab}.csv`,["ID","Name"], [])}>CSV</button>
          <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx(`${tab}.xlsx`,["ID","Name"], [])}>Excel</button>
          <button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("المخزون المتقدم","Advanced Inventory",[{label:"عدد",value:stats[tab]||0}],["ID","Name"], [])}>PDF</button>
        </div>
      </nav>
      <input className="erp-input" placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:12,maxWidth:300}} />

      {tab==="locations" && (
        <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>ID</th><th>الاسم</th><th>الكود</th><th>النوع</th><th>المصنع</th></tr></thead><tbody>{locations.filter(l=>[l.name,l.code].join(" ").toLowerCase().includes(search.toLowerCase())).map(l=><tr key={l.id}><td>{l.id}</td><td>{l.name}</td><td>{l.code}</td><td>{l.location_type}</td><td>{l.factory_id||"-"}</td></tr>)}</tbody></table></div>
      )}
      {tab==="pickings" && (
        <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>ID</th><th>الحالة</th><th>من</th><th>إلى</th><th>مجدول</th></tr></thead><tbody>{pickings.map(p=><tr key={p.id}><td>{p.id}</td><td>{p.state}</td><td>{p.location_id}</td><td>{p.location_dest_id}</td><td>{p.scheduled_date||"-"}</td></tr>)}</tbody></table></div>
      )}
      {tab==="moves" && (
        <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>ID</th><th>المنتج</th><th>من</th><th>إلى</th><th>الكمية</th><th>الحالة</th></tr></thead><tbody>{moves.map(m=><tr key={m.id}><td>{m.id}</td><td>{m.product_id}</td><td>{m.location_id}</td><td>{m.location_dest_id}</td><td>{m.quantity}</td><td>{m.state}</td></tr>)}</tbody></table></div>
      )}
      {tab==="quants" && (
        <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>ID</th><th>المنتج</th><th>الموقع</th><th>الكمية</th><th>محجوز</th><th>التكلفة</th></tr></thead><tbody>{quants.map(q=><tr key={q.id}><td>{q.id}</td><td>{q.product_id}</td><td>{q.location_id}</td><td>{q.quantity}</td><td>{q.reserved_quantity}</td><td>{q.cost}</td></tr>)}</tbody></table></div>
      )}
    </section></main>
  );
}
