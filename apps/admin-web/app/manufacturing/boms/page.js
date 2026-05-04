"use client";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";
import KanbanBoard from "../../components/KanbanBoard";

const API = "https://api.royalpalace-group.com/api/v1/admin/mrp/boms";
const LINES_API = API + "/lines";
const VERSIONS_API = "https://api.royalpalace-group.com/api/v1/admin/mrp/bom-versions";
const ATTACH_API = "https://api.royalpalace-group.com/api/v1/admin/mrp/attachments";
const VARIANTS_API = "https://api.royalpalace-group.com/api/v1/admin/mrp/variants";

const BOM_TYPES = ["manufacture","kit","sub"];
const BOM_TYPE_LABELS = { manufacture:"تصنيع", kit:"طقم", sub:"نصف مصنع" };
const BOM_TYPE_COLORS = { manufacture:"#3b82f6", kit:"#f59e0b", sub:"#8b5cf6" };

function renderBomCard(b) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:14 }}>{b.name}</div>
      <div style={{ fontSize:12, color:"var(--rp-text-muted)" }}>{b.code}</div>
      <div style={{ fontSize:11 }}>{BOM_TYPE_LABELS[b.bom_type]||b.bom_type}</div>
    </div>
  );
}

export default function BomsPage() {
  const { user, ready } = useAdminAuth("work_orders");
  const [boms, setBoms] = useState([]);
  const [activeBom, setActiveBom] = useState(null);
  const [lines, setLines] = useState([]);
  const [versions, setVersions] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [variants, setVariants] = useState([]);
  const [detailTab, setDetailTab] = useState("lines");
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ name:"", code:"", product_id:"", bom_type:"manufacture", notes:"" });
  const [lineForm, setLineForm] = useState({ bom_id:"", line_no:1, raw_material_name:"", quantity:0, unit:"" });
  const [viewMode, setViewMode] = useState("table");
  const [submitting, setSubmitting] = useState(false);

  async function loadBoms() {
    try { const res = await fetch(API, { headers: authHeaders() }); setBoms(res.ok ? await res.json() : []); } catch {}
  }

  async function loadBomDetails(bomId) {
    setActiveBom(bomId);
    const [lRes, vRes, aRes, varRes] = await Promise.all([
      fetch(`${LINES_API}?bom_id=${bomId}`, { headers: authHeaders() }),
      fetch(`${VERSIONS_API}?bom_id=${bomId}`, { headers: authHeaders() }),
      fetch(`${ATTACH_API}?bom_id=${bomId}`, { headers: authHeaders() }),
      fetch(`${VARIANTS_API}?bom_id=${bomId}`, { headers: authHeaders() })
    ]);
    setLines(lRes.ok ? await lRes.json() : []);
    setVersions(vRes.ok ? await vRes.json() : []);
    setAttachments(aRes.ok ? await aRes.json() : []);
    setVariants(varRes.ok ? await varRes.json() : []);
    setLineForm(prev => ({...prev, bom_id: bomId}));
  }

  useEffect(() => { if (ready && user) loadBoms(); }, [ready, user]);

  async function handleCreate(e) {
    e.preventDefault(); setSubmitting(true);
    try {
      const payload = { ...form, product_id: form.product_id ? Number(form.product_id) : null };
      const res = await fetch(API, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل");
      setForm({ name:"", code:"", product_id:"", bom_type:"manufacture", notes:"" });
      loadBoms();
    } catch(err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function addLine(e) {
    e.preventDefault();
    const payload = { ...lineForm, quantity: Number(lineForm.quantity) };
    const res = await fetch(LINES_API, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) });
    if (!res.ok) return setMessage("فشل إضافة المكون");
    setLineForm({ bom_id: activeBom, line_no:1, raw_material_name:"", quantity:0, unit:"" });
    loadBomDetails(activeBom);
  }

  async function deleteLine(id) { await fetch(`${LINES_API}/${id}`, { method:"DELETE", headers: authHeaders() }); loadBomDetails(activeBom); }
  async function deleteBom(id) { if (!confirm("حذف BOM؟")) return; await fetch(`${API}/${id}`, { method:"DELETE", headers: authHeaders() }); setActiveBom(null); loadBoms(); }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">تحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Bills of Materials</div><h2>قوائم المواد</h2><p>إدارة وصفات المنتجات والمكونات.</p></div></section>
        <section className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">عدد BOMs</div><div className="erp-card-value">{boms.length}</div></div>
          <div className="erp-card"><div className="erp-card-title">نشطة</div><div className="erp-card-value">{boms.filter(b=>b.is_active).length}</div></div>
        </section>
        {message && <div className="erp-form-message">{message}</div>}
        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <h3>إنشاء BOM جديد</h3>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleCreate}>
            <input className="erp-input" placeholder="الاسم" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required />
            <input className="erp-input" placeholder="الكود" value={form.code} onChange={e=>setForm({...form,code:e.target.value})} required />
            <select className="erp-input" value={form.bom_type} onChange={e=>setForm({...form,bom_type:e.target.value})}>
              {BOM_TYPES.map(t=><option key={t} value={t}>{BOM_TYPE_LABELS[t]}</option>)}
            </select>
            <input className="erp-input" type="number" placeholder="معرف المنتج" value={form.product_id} onChange={e=>setForm({...form,product_id:e.target.value})} />
            <textarea className="erp-input" placeholder="ملاحظات" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"حفظ...":"إنشاء"}</button></div>
          </form>
        </div>
        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <div className="erp-section-head"><h3>قائمة BOMs</h3>
            <div className="flex gap-2">
              <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")}>Kanban</button>
              <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")}>جدول</button>
            </div>
          </div>
          {viewMode==="table" ? (
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead><tr><th>ID</th><th>الاسم</th><th>الكود</th><th>المنتج</th><th>النوع</th><th>نشط</th><th>تفاصيل</th><th>حذف</th></tr></thead>
                <tbody>{boms.map(b=><tr key={b.id}><td>{b.id}</td><td>{b.name}</td><td>{b.code}</td><td>{b.product_id||"-"}</td><td>{BOM_TYPE_LABELS[b.bom_type]||b.bom_type}</td><td>{b.is_active?"✅":"❌"}</td><td><button onClick={()=>loadBomDetails(b.id)}>فتح</button></td><td><button className="erp-btn-danger" onClick={()=>deleteBom(b.id)}>حذف</button></td></tr>)}</tbody>
              </table>
            </div>
          ) : (
            <KanbanBoard items={boms} statusField="bom_type" statusOptions={BOM_TYPES} statusLabels={BOM_TYPE_LABELS} statusColors={BOM_TYPE_COLORS} renderCard={renderBomCard} onAction={(b)=>(<div><button onClick={()=>loadBomDetails(b.id)}>فتح</button> <button className="erp-btn-danger" onClick={()=>deleteBom(b.id)}>حذف</button></div>)} emptyMessage="لا توجد BOMs" />
          )}
        </div>
        {activeBom && (
          <div className="erp-section-card">
            <h3>تفاصيل BOM #{activeBom}</h3>
            <div style={{display:"flex", gap:8, marginBottom:12}}>
              <button className={detailTab==="lines"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setDetailTab("lines")}>المكونات</button>
              <button className={detailTab==="versions"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setDetailTab("versions")}>الإصدارات</button>
              <button className={detailTab==="attachments"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setDetailTab("attachments")}>المرفقات</button>
              <button className={detailTab==="variants"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setDetailTab("variants")}>المتغيرات</button>
            </div>
            {detailTab==="lines" && (
              <div>
                <form onSubmit={addLine} style={{display:"flex", gap:4, marginBottom:8}}>
                  <input className="erp-input" placeholder="خامة / منتج" value={lineForm.raw_material_name} onChange={e=>setLineForm({...lineForm, raw_material_name:e.target.value})} style={{width:150}} required />
                  <input className="erp-input" type="number" step="0.001" placeholder="كمية" value={lineForm.quantity} onChange={e=>setLineForm({...lineForm, quantity:e.target.value})} style={{width:80}} />
                  <input className="erp-input" placeholder="وحدة" value={lineForm.unit} onChange={e=>setLineForm({...lineForm, unit:e.target.value})} style={{width:70}} />
                  <button className="erp-btn-primary" type="submit">+</button>
                </form>
                <table className="erp-table"><tbody>{lines.map(l=><tr key={l.id}><td>{l.raw_material_name||l.product_id}</td><td>{l.quantity} {l.unit}</td><td><button onClick={()=>deleteLine(l.id)}>حذف</button></td></tr>)}</tbody></table>
              </div>
            )}
            {detailTab==="versions" && <div>{versions.map(v=><div key={v.id}>v{v.version_number} - ECO: {v.eco_number} - {v.eco_state}</div>)}</div>}
            {detailTab==="attachments" && <div>{attachments.map(a=><div key={a.id}><a href={a.file_url} target="_blank">{a.file_name}</a></div>)}</div>}
            {detailTab==="variants" && <div>{variants.map(v=><div key={v.id}>{v.variant_name}: {v.variant_value}</div>)}</div>}
            <div style={{marginTop:10, display:"flex", gap:8}}>
              <button className="erp-btn-secondary" onClick={async ()=>{
                const res = await fetch(`${API}/${activeBom}/check-availability?quantity=1`, {headers:authHeaders()});
                alert(JSON.stringify(await res.json()))
              }}>فحص التوفر</button>
              <button className="erp-btn-secondary" onClick={async ()=>{
                const res = await fetch(`${API}/${activeBom}/cost`, {headers:authHeaders()});
                alert(JSON.stringify(await res.json()))
              }}>حساب التكلفة</button>
              <button className="erp-btn-secondary" onClick={async ()=>{
                const res = await fetch(`${API}/${activeBom}/explode?quantity=1`, {headers:authHeaders()});
                alert(JSON.stringify(await res.json()))
              }}>تفجير BOM</button>
            </div>
          </div>
        )}
      </section>
    </main>
  );
}
