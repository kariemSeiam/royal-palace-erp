"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../components/hrExports";

const API = "https://api.royalpalace-group.com/api/v1/admin/barcode";
const btStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };

export default function BarcodePage() {
  const { user, ready } = useAdminAuth("barcode");
  const [products, setProducts] = useState([]);
  const [history, setHistory] = useState([]);
  const [selected, setSelected] = useState(null);
  const [useSerial, setUseSerial] = useState(false);
  const [msg, setMsg] = useState("");
  const [tab, setTab] = useState("print");
  const [busy, setBusy] = useState(false);

  async function load() {
    try {
      const [prodRes, histRes] = await Promise.all([
        fetch(`${API}/products`, { headers: authHeaders() }),
        fetch(`${API}/history`, { headers: authHeaders() })
      ]);
      const prodData = await prodRes.json();
      const histData = await histRes.json();
      setProducts(Array.isArray(prodData) ? prodData : []);
      setHistory(Array.isArray(histData) ? histData : []);
    } catch(e) { setMsg(e.message); }
  }
  useEffect(() => { if (ready && user) load(); }, [ready, user]);

  async function handleSave() {
    setBusy(true); setMsg("");
    try {
      const payload = { product_id: selected?.id, use_serial: useSerial, label_format: "code128" };
      const res = await fetch(`${API}/generate`, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Error");
      setMsg("تم التوليد بنجاح");
      load();
    } catch(e) { setMsg(e.message); } finally { setBusy(false); }
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">Loading...</div></main>;

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <div className="erp-hero"><div><div className="erp-hero-pill">Barcode</div><h2>الباركود</h2></div>
        <div className="erp-stat-panel">
          <div className="erp-stat-box"><div className="erp-stat-box-label">المنتجات الجاهزة</div><div className="erp-stat-box-value">{products.length}</div></div>
          <div className="erp-stat-box"><div className="erp-stat-box-label">تم توليدها</div><div className="erp-stat-box-value">{history.length}</div></div>
        </div>
      </div>
      {msg && <div className="erp-form-message">{msg}</div>}
      <nav style={{display:"flex",gap:6,borderBottom:"1px solid var(--rp-border)",marginBottom:16}}>
        {["print","history"].map(t=>(
          <button key={t} className="erp-btn-ghost" style={{fontWeight:tab===t?900:400, borderBottom:tab===t?"2px solid var(--rp-primary)":"none"}} onClick={()=>setTab(t)}>{t==="print"?"طباعة":"السجل"}</button>
        ))}
      </nav>
      {tab==="print" && (
        <div className="erp-section-card">
          <div style={{display:"grid", gap:12}}>
            <select className="erp-input" value={selected?.id||""} onChange={e=>setSelected(products.find(p=>p.id===Number(e.target.value)))}>
              <option value="">اختر منتج</option>
              {products.map(p=><option key={p.id} value={p.id}>{p.name_ar||p.name_en||p.sku}</option>)}
            </select>
            <label><input type="checkbox" checked={useSerial} onChange={e=>setUseSerial(e.target.checked)} /> متسلسل</label>
            <button className="erp-btn-primary" onClick={handleSave} disabled={busy}>حفظ التعديل</button>
          </div>
        </div>
      )}
      {tab==="history" && (
        <div className="erp-section-card">
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv("barcode_history.csv",["ID","منتج","تاريخ"], history.map(h=>[h.id,h.product_name||h.product_id,h.created_at]))}>CSV</button>
            <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx("barcode_history.xlsx",["ID","منتج","تاريخ"], history.map(h=>[h.id,h.product_name||h.product_id,h.created_at]))}>Excel</button>
            <button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("سجل الباركود","Barcode",[{label:"عدد",value:history.length}],["ID","منتج","تاريخ"], history.map(h=>[h.id,h.product_name||h.product_id,h.created_at]))}>PDF</button>
          </div>
          {history.length===0 ? <div className="erp-form-message">لا توجد سجلات بعد.</div> : (
            <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>ID</th><th>المنتج</th><th>التاريخ</th></tr></thead><tbody>{history.map(h=><tr key={h.id}><td>{h.id}</td><td>{h.product_name||h.product_id}</td><td>{h.created_at ? new Date(h.created_at).toLocaleDateString("ar-EG") : "-"}</td></tr>)}</tbody></table></div>
          )}
        </div>
      )}
    </section></main>
  );
}
