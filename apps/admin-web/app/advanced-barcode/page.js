"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../components/hrExports";

const API = "https://api.royalpalace-group.com/api/v1/admin/barcode/templates";
const btStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };

export default function AdvancedBarcodePage() {
  const { user, ready } = useAdminAuth("advanced_barcode");
  const [templates, setTemplates] = useState([]);
  const [page, setPage] = useState(1);
  const pageSize = 20;
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ name:"", format_type:"code128", width:300, height:100, include_text:true });

  async function load() {
    try {
      const res = await fetch(API, { headers: authHeaders() });
      const data = await res.json();
      setTemplates(Array.isArray(data) ? data : []);
    } catch(e) { setMsg(e.message); }
  }
  useEffect(() => { if (ready && user) load(); }, [ready, user]);

  const filtered = useMemo(() => {
    const q = search.toLowerCase();
    return q ? templates.filter(t => t.name.toLowerCase().includes(q)) : templates;
  }, [templates, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const pageItems = filtered.slice((page-1)*pageSize, page*pageSize);

  async function save(e) {
    e.preventDefault(); setMsg("");
    await fetch(API, { method:"POST", headers: {"Content-Type":"application/json", ...authHeaders()}, body: JSON.stringify(form) });
    setForm({ name:"", format_type:"code128", width:300, height:100, include_text:true });
    load();
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">Loading...</div></main>;

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <div className="erp-hero"><div><div className="erp-hero-pill">Advanced Barcode</div><h2>الباركود المتقدم</h2></div>
        <div className="erp-stat-panel">
          <div className="erp-stat-box"><div className="erp-stat-box-label">القوالب</div><div className="erp-stat-box-value">{templates.length}</div></div>
        </div>
      </div>
      {msg && <div className="erp-form-message">{msg}</div>}
      <div className="erp-form-grid erp-form-grid-2" style={{marginBottom:18}}>
        <div className="erp-section-card">
          <h3>قالب جديد</h3>
          <form onSubmit={save} className="erp-form-grid">
            <input className="erp-input" placeholder="اسم القالب" value={form.name} onChange={e=>setForm({...form, name:e.target.value})} required />
            <select className="erp-input" value={form.format_type} onChange={e=>setForm({...form, format_type:e.target.value})}>
              <option value="code128">Code128</option><option value="code39">Code39</option><option value="qr">QR Code</option>
            </select>
            <input className="erp-input" type="number" placeholder="العرض" value={form.width} onChange={e=>setForm({...form, width:e.target.value})} />
            <input className="erp-input" type="number" placeholder="الارتفاع" value={form.height} onChange={e=>setForm({...form, height:e.target.value})} />
            <label><input type="checkbox" checked={form.include_text} onChange={e=>setForm({...form, include_text:e.target.checked})} /> تضمين النص</label>
            <button className="erp-btn-primary" type="submit">حفظ</button>
          </form>
        </div>
        <div className="erp-section-card">
          <div style={{display:"flex",gap:8,marginBottom:12}}>
            <input className="erp-input" placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)} />
            <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv("barcode_templates.csv",["ID","Name","Format","Width","Height"], pageItems.map(t=>[t.id,t.name,t.format_type,t.width,t.height]))}>CSV</button>
            <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx("barcode_templates.xlsx",["ID","Name","Format","Width","Height"], pageItems.map(t=>[t.id,t.name,t.format_type,t.width,t.height]))}>Excel</button>
            <button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("الباركود المتقدم","Barcode",[{label:"قوالب",value:templates.length}],["ID","Name","Format","Width","Height"], pageItems.map(t=>[t.id,t.name,t.format_type,t.width,t.height]))}>PDF</button>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead><tr><th>ID</th><th>الاسم</th><th>الصيغة</th><th>العرض</th><th>الارتفاع</th></tr></thead>
              <tbody>{pageItems.map(t=>(<tr key={t.id}><td>{t.id}</td><td>{t.name}</td><td>{t.format_type}</td><td>{t.width}</td><td>{t.height}</td></tr>))}</tbody>
            </table>
          </div>
          <div style={{display:"flex",gap:8,justifyContent:"center",marginTop:12}}>
            <button className="erp-btn-secondary" disabled={page===1} onClick={()=>setPage(p=>Math.max(1,p-1))}>السابقة</button>
            <span>صفحة {page} من {totalPages}</span>
            <button className="erp-btn-secondary" disabled={page===totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))}>التالية</button>
          </div>
        </div>
      </div>
    </section></main>
  );
}
