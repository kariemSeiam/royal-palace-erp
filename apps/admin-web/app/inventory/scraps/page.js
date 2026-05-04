"use client";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../../components/hrExports";
import KanbanBoard from "../../components/KanbanBoard";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/stock-scraps";
const FACTORIES_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";
const WAREHOUSES_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/warehouses";
const PRODUCTS_URL = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";
const LOTS_URL = "https://api.royalpalace-group.com/api/v1/admin/stock-lots";
const UOM_URL = "https://api.royalpalace-group.com/api/v1/admin/uom";

export default function StockScrapsPage() {
  const { user, ready } = useAdminAuth("scrap");
  const [items, setItems] = useState([]);
  const [factories, setFactories] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [lots, setLots] = useState([]);
  const [uoms, setUoms] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ factory_id:"", warehouse_id:"", product_id:"", lot_id:"", quantity:"", uom_id:"", scrap_reason:"", notes:"" });
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("table");

  async function loadData() {
    try {
      const [itemsRes, factoriesRes, warehousesRes, productsRes, lotsRes, uomRes] = await Promise.all([
        fetch(API_URL, { headers: authHeaders() }), fetch(FACTORIES_URL, { headers: authHeaders() }), fetch(WAREHOUSES_URL, { headers: authHeaders() }), fetch(PRODUCTS_URL, { headers: authHeaders() }), fetch(LOTS_URL, { headers: authHeaders() }), fetch(UOM_URL, { headers: authHeaders() })
      ]);
      setItems(itemsRes.ok ? await itemsRes.json() : []);
      setFactories(factoriesRes.ok ? await factoriesRes.json() : []);
      setWarehouses(warehousesRes.ok ? await warehousesRes.json() : []);
      setProducts(productsRes.ok ? await productsRes.json() : []);
      setLots(lotsRes.ok ? await lotsRes.json() : []);
      setUoms(uomRes.ok ? await uomRes.json() : []);
    } catch (e) { setMessage("تعذر التحميل"); }
  }
  useEffect(() => { if (ready && user) loadData(); }, [ready, user]);

  const filtered = useMemo(() => { const q = search.toLowerCase(); return q ? items.filter(i => JSON.stringify(i).toLowerCase().includes(q)) : items; }, [items, search]);
  const stats = useMemo(() => ({ total: items.length, qty: items.reduce((s, i) => s + Number(i.quantity||0), 0) }), [items]);
  const getUomName = (uomId) => { const u = uoms.find(u => u.id === uomId); return u ? u.name : ""; };

  async function handleSubmit(e) { e.preventDefault(); setSubmitting(true); setMessage(""); try {
    const body = { factory_id: Number(form.factory_id), warehouse_id: Number(form.warehouse_id), product_id: Number(form.product_id), lot_id: form.lot_id?Number(form.lot_id):null, quantity: Number(form.quantity), uom_id: form.uom_id?Number(form.uom_id):null, scrap_reason: form.scrap_reason, notes: form.notes };
    const res = await fetch(API_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(body) });
    if (!res.ok) throw new Error("فشل تسجيل الهالك");
    setMessage("تم تسجيل الهالك"); setForm({ factory_id:"", warehouse_id:"", product_id:"", lot_id:"", quantity:"", uom_id:"", scrap_reason:"", notes:"" }); loadData();
  } catch (err) { setMessage(err.message); } finally { setSubmitting(false); } }

  async function markDone(id) { if (!confirm("تأكيد الهالك؟")) return; const res = await fetch(`${API_URL}/${id}/done`, { method:"PUT", headers:authHeaders() }); if (!res.ok) { setMessage("فشل التأكيد"); return; } loadData(); }
  async function handleDelete(id) { if (!confirm("حذف سجل الهالك؟")) return; await fetch(`${API_URL}/${id}`, { method:"DELETE", headers:authHeaders() }); loadData(); }

  function handleCsv() { exportTableCsv("stock_scraps.csv", ["المخزن","المنتج","الكمية","الوحدة","السبب","التشغيلة","الحالة","تاريخ الإكمال"], filtered.map(i => [i.warehouse_name||"", i.product_name||"", i.quantity, getUomName(i.uom_id), i.scrap_reason||"", i.lot_number||"", i.state, i.date_done?new Date(i.date_done).toLocaleDateString("ar-EG"):"-"])); }
  function handleXlsx() { exportTableXlsx("stock_scraps.xlsx", ["المخزن","المنتج","الكمية","الوحدة","السبب","التشغيلة","الحالة","تاريخ الإكمال"], filtered.map(i => [i.warehouse_name||"", i.product_name||"", i.quantity, getUomName(i.uom_id), i.scrap_reason||"", i.lot_number||"", i.state, i.date_done?new Date(i.date_done).toLocaleDateString("ar-EG"):"-"])); }
  function handlePdf() { exportTablePdf("تقرير هالك المخزون", "المخزون / الهوالك", [{ label: "عدد الهوالك", value: stats.total }, { label: "إجمالي الكمية", value: stats.qty }], ["المخزن","المنتج","الكمية","الوحدة","السبب","التشغيلة","الحالة","تاريخ الإكمال"], filtered.map(i => [i.warehouse_name||"", i.product_name||"", i.quantity, getUomName(i.uom_id), i.scrap_reason||"", i.lot_number||"", i.state, i.date_done?new Date(i.date_done).toLocaleDateString("ar-EG"):"-"])); }

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <section className="erp-hero"><div><div className="erp-hero-pill">المخزون / الهوالك</div><h2>تسجيل هالك المخزون</h2><p>تسجيل الكميات التالفة أو المنتهية الصلاحية.</p></div></section>
      <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">عدد الهوالك</div><div className="erp-card-value">{stats.total}</div></div><div className="erp-card"><div className="erp-card-title">إجمالي الكمية المهدرة</div><div className="erp-card-value">{stats.qty}</div></div></section>
      {message && <div className="erp-form-message">{message}</div>}
      <div className="erp-section-card" style={{ marginBottom:18 }}><h3>تسجيل هالك جديد</h3><form className="erp-form-grid" onSubmit={handleSubmit}><select className="erp-input" value={form.factory_id} onChange={e => setForm({ ...form, factory_id:e.target.value })} required><option value="">اختر المصنع</option>{factories.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}</select><select className="erp-input" value={form.warehouse_id} onChange={e => setForm({ ...form, warehouse_id:e.target.value })} required><option value="">اختر المخزن</option>{warehouses.map(w=><option key={w.id} value={w.id}>{w.name} ({w.code})</option>)}</select><select className="erp-input" value={form.product_id} onChange={e => setForm({ ...form, product_id:e.target.value })} required><option value="">اختر المنتج</option>{products.map(p=><option key={p.id} value={p.id}>{p.name_ar} ({p.sku})</option>)}</select><select className="erp-input" value={form.lot_id} onChange={e => setForm({ ...form, lot_id:e.target.value })}><option value="">اختر التشغيلة (اختياري)</option>{lots.filter(l=>!form.product_id||l.product_id===Number(form.product_id)).map(l=><option key={l.id} value={l.id}>{l.lot_number} ({l.quantity})</option>)}</select><input className="erp-input" type="number" step="0.01" placeholder="الكمية" value={form.quantity} onChange={e => setForm({ ...form, quantity:e.target.value })} required /><select className="erp-input" value={form.uom_id} onChange={e => setForm({ ...form, uom_id:e.target.value })}><option value="">وحدة القياس</option>{uoms.map(u=><option key={u.id} value={u.id}>{u.name}</option>)}</select><select className="erp-input" value={form.scrap_reason} onChange={e => setForm({ ...form, scrap_reason:e.target.value })}><option value="">سبب الهالك</option><option value="تالف">تالف</option><option value="منتهي الصلاحية">منتهي الصلاحية</option><option value="إنتاج معيب">إنتاج معيب</option><option value="مفقود">مفقود</option></select><textarea className="erp-input" rows="2" placeholder="ملاحظات" value={form.notes} onChange={e => setForm({ ...form, notes:e.target.value })} /><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ التسجيل...":"تسجيل الهالك"}</button></div></form></div>
      <div className="erp-section-card"><div style={{ display:"flex", gap:10, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}><input className="erp-input" style={{ flex:"1 1 240px" }} placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} /><button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={{ minHeight:38, borderRadius:12, padding:"0 14px", fontWeight:800 }}>Kanban</button><button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={{ minHeight:38, borderRadius:12, padding:"0 14px", fontWeight:800 }}>جدول</button><button className="erp-btn-secondary" onClick={handleCsv} style={{ minHeight:38, borderRadius:12, padding:"0 14px", fontWeight:800 }}>CSV</button><button className="erp-btn-secondary" onClick={handleXlsx} style={{ minHeight:38, borderRadius:12, padding:"0 14px", fontWeight:800 }}>Excel</button><button className="erp-btn-primary" onClick={handlePdf} style={{ minHeight:38, borderRadius:12, padding:"0 14px", fontWeight:800 }}>PDF</button></div>
        {viewMode==="table" && (<div className="erp-table-shell"><table className="erp-table"><thead><tr><th>#</th><th>المخزن</th><th>المنتج</th><th>الكمية</th><th>الوحدة</th><th>السبب</th><th>التشغيلة</th><th>الحالة</th><th>تاريخ الإكمال</th><th>إجراءات</th></tr></thead><tbody>{filtered.map(item => (<tr key={item.id}><td>{item.id}</td><td>{item.warehouse_name||"-"}</td><td>{item.product_name||"-"}</td><td>{item.quantity}</td><td>{getUomName(item.uom_id)}</td><td>{item.scrap_reason||"-"}</td><td>{item.lot_number||"-"}</td><td><span className={`erp-badge ${item.state==='done'?"success":"warning"}`}>{item.state}</span></td><td>{item.date_done?new Date(item.date_done).toLocaleDateString("ar-EG"):"-"}</td><td><button className="erp-btn-primary" style={{marginInlineEnd:6}} disabled={item.state==='done'} onClick={()=>markDone(item.id)}>تأكيد</button><button className="erp-btn-danger" onClick={()=>handleDelete(item.id)}>حذف</button></td></tr>))}</tbody></table></div>)}
        {viewMode==="kanban" && <KanbanBoard items={filtered} statusField="state" statusOptions={["draft","done"]} statusLabels={{"draft":"مسودة","done":"مكتمل"}} statusColors={{"draft":"#f59e0b","done":"#10b981"}} renderCard={item => <div><div style={{fontWeight:900}}>{item.product_name}</div><div>الكمية: {item.quantity} {getUomName(item.uom_id)}</div><div>السبب: {item.scrap_reason}</div></div>} onAction={item => <><button className="erp-btn-primary" style={{fontSize:11,padding:"4px 8px"}} disabled={item.state==='done'} onClick={()=>markDone(item.id)}>تأكيد</button><button className="erp-btn-danger" style={{fontSize:11,padding:"4px 8px"}} onClick={()=>handleDelete(item.id)}>حذف</button></>} emptyMessage="لا توجد هوالك" />}
      </div>
    </section></main>
  );
}
