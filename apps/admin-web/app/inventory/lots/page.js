"use client";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";
import KanbanBoard from "../../components/KanbanBoard";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/stock-lots";
const FACTORIES_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";
const PRODUCTS_URL = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";

export default function StockLotsPage() {
  const { user, ready } = useAdminAuth("lot");
  const [items, setItems] = useState([]);
  const [factories, setFactories] = useState([]);
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ factory_id:"", product_id:"", lot_number:"", tracking:"lot", quantity:"", description:"", production_date:"", expiration_date:"", alert_date:"", removal_date:"" });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("table");

  async function loadData() {
    try {
      const [itemsRes, factoriesRes, productsRes] = await Promise.all([
        fetch(API_URL, { headers: authHeaders() }), fetch(FACTORIES_URL, { headers: authHeaders() }), fetch(PRODUCTS_URL, { headers: authHeaders() })
      ]);
      setItems(itemsRes.ok ? await itemsRes.json() : []);
      setFactories(factoriesRes.ok ? await factoriesRes.json() : []);
      setProducts(productsRes.ok ? await productsRes.json() : []);
    } catch (e) { setMessage("تعذر التحميل"); }
  }
  useEffect(() => { if (ready && user) loadData(); }, [ready, user]);

  const filtered = useMemo(() => { const q = search.toLowerCase(); return q ? items.filter(i => JSON.stringify(i).toLowerCase().includes(q)) : items; }, [items, search]);
  const stats = useMemo(() => ({ total: items.length, active: items.filter(i => i.quantity > 0).length }), [items]);

  function resetForm() { setForm({ factory_id:"", product_id:"", lot_number:"", tracking:"lot", quantity:"", description:"", production_date:"", expiration_date:"", alert_date:"", removal_date:"" }); setEditingId(null); }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const body = { factory_id: Number(form.factory_id), product_id: Number(form.product_id), lot_number: form.lot_number, tracking: form.tracking, quantity: Number(form.quantity), description: form.description, production_date: form.production_date||null, expiration_date: form.expiration_date||null, alert_date: form.alert_date||null, removal_date: form.removal_date||null };
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("فشل الحفظ");
      setMessage(editingId ? "تم التحديث" : "تم الإنشاء");
      resetForm(); loadData();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function handleDelete(id) { if (!confirm("حذف التشغيلة؟")) return; await fetch(`${API_URL}/${id}`, { method: "DELETE", headers: authHeaders() }); loadData(); }

  function handleCsv() { exportTableCsv("stock_lots.csv", ["المصنع","المنتج","رقم التشغيلة","النوع","الكمية","تاريخ الصلاحية","تاريخ الإنتاج","تنبيه","إزالة"], filtered.map(i => [i.factory_name||"", i.product_name||"", i.lot_number, i.tracking, i.quantity, i.expiration_date||"", i.production_date||"", i.alert_date||"", i.removal_date||""])); }
  function handlePdf() { exportTablePdf("تقرير التشغيلات", "المخزون / التشغيلات", [{ label: "إجمالي التشغيلات", value: stats.total }, { label: "نشطة", value: stats.active }], ["المصنع","المنتج","رقم التشغيلة","النوع","الكمية","تاريخ الصلاحية","تاريخ الإنتاج","تنبيه","إزالة"], filtered.map(i => [i.factory_name||"", i.product_name||"", i.lot_number, i.tracking, i.quantity, i.expiration_date||"", i.production_date||"", i.alert_date||"", i.removal_date||""])); }


  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <section className="erp-hero"><div><div className="erp-hero-pill">المخزون / التشغيلات</div><h2>التشغيلات والأرقام التسلسلية</h2><p>تتبع دفعات الإنتاج وتواريخ الصلاحية.</p></div></section>
      <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">إجمالي التشغيلات</div><div className="erp-card-value">{stats.total}</div></div><div className="erp-card"><div className="erp-card-title">نشطة</div><div className="erp-card-value">{stats.active}</div></div></section>
      {message && <div className="erp-form-message">{message}</div>}
      <div className="erp-section-card" style={{ marginBottom: 18 }}>
        <h3>{editingId ? "تعديل تشغيلة" : "تشغيلة جديدة"}</h3>
        <form className="erp-form-grid" onSubmit={handleSubmit}>
          <select className="erp-input" value={form.factory_id} onChange={e => setForm({ ...form, factory_id: e.target.value })} required><option value="">اختر المصنع</option>{factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          <select className="erp-input" value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })} required><option value="">اختر المنتج</option>{products.map(p => <option key={p.id} value={p.id}>{p.name_ar} ({p.sku})</option>)}</select>
          <input className="erp-input" placeholder="رقم التشغيلة" value={form.lot_number} onChange={e => setForm({ ...form, lot_number: e.target.value })} required />
          <select className="erp-input" value={form.tracking} onChange={e => setForm({ ...form, tracking: e.target.value })}><option value="lot">Lot (دفعة)</option><option value="serial">Serial (رقم تسلسلي)</option></select>
          <input className="erp-input" type="number" step="0.01" placeholder="الكمية" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} required />
          <input className="erp-input" placeholder="الوصف" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
          <input className="erp-input" type="date" value={form.production_date} onChange={e => setForm({ ...form, production_date: e.target.value })} />
          <input className="erp-input" type="date" value={form.expiration_date} onChange={e => setForm({ ...form, expiration_date: e.target.value })} />
          <input className="erp-input" type="date" placeholder="تاريخ التنبيه" value={form.alert_date} onChange={e => setForm({ ...form, alert_date: e.target.value })} />
          <input className="erp-input" type="date" placeholder="تاريخ الإزالة" value={form.removal_date} onChange={e => setForm({ ...form, removal_date: e.target.value })} />
          <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingId ? "تحديث" : "إنشاء"}</button><button className="erp-btn-secondary" type="button" onClick={resetForm}>إلغاء</button></div>
        </form>
      </div>
      <div className="erp-section-card">
        <div style={{ display:"flex", gap:10, marginBottom:12, flexWrap:"wrap", alignItems:"center" }}>
          <input className="erp-input" style={{ flex:"1 1 240px" }} placeholder="بحث..." value={search} onChange={e => setSearch(e.target.value)} />
          <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={{ minHeight:38, borderRadius:12, padding:"0 14px", fontWeight:800 }}>Kanban</button>
          <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={{ minHeight:38, borderRadius:12, padding:"0 14px", fontWeight:800 }}>جدول</button>
          <button className="erp-btn-secondary" onClick={handleCsv} style={{ minHeight:38, borderRadius:12, padding:"0 14px", fontWeight:800 }}>CSV</button>
          <button className="erp-btn-primary" onClick={handlePdf} style={{ minHeight:38, borderRadius:12, padding:"0 14px", fontWeight:800 }}>PDF</button>
        </div>
        {viewMode==="table" && (<div className="erp-table-shell"><table className="erp-table"><thead><tr><th>#</th><th>المصنع</th><th>المنتج</th><th>رقم التشغيلة</th><th>النوع</th><th>الكمية</th><th>تاريخ الإنتاج</th><th>تاريخ الصلاحية</th><th>تنبيه</th><th>إزالة</th><th>إجراءات</th></tr></thead><tbody>{filtered.map(item => (<tr key={item.id}><td>{item.id}</td><td>{item.factory_name||"-"}</td><td>{item.product_name||"-"}</td><td>{item.lot_number}</td><td>{item.tracking}</td><td>{item.quantity}</td><td>{item.production_date||"-"}</td><td>{item.expiration_date||"-"}</td><td>{item.alert_date||"-"}</td><td>{item.removal_date||"-"}</td><td><button className="erp-btn-danger" onClick={()=>handleDelete(item.id)}>حذف</button></td></tr>))}</tbody></table></div>)}
        {viewMode==="kanban" && <KanbanBoard items={filtered} statusField="is_active" statusOptions={[true,false]} statusLabels={{true:"نشط",false:"غير نشط"}} statusColors={{true:"#10b981",false:"#6b7280"}} renderCard={item => <div><div style={{fontWeight:900}}>{item.lot_number}</div><div>{item.product_name}</div><div>الكمية: {item.quantity}</div><div>تنبيه: {item.alert_date||"-"}</div><div>إزالة: {item.removal_date||"-"}</div></div>} onAction={item => <button className="erp-btn-danger" onClick={()=>handleDelete(item.id)}>حذف</button>} emptyMessage="لا توجد تشغيلات" />}
      </div>
    </section></main>
  );
}
