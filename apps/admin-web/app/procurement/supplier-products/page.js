"use client";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";
import KanbanBoard from "../../components/KanbanBoard";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/supplier-products";
const PRODUCTS_URL = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";
const SUPPLIERS_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/suppliers";

export default function SupplierProductsPage() {
  const { user, ready } = useAdminAuth("supplier_info");
  const [items, setItems] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ product_id:"", supplier_id:"", supplier_sku:"", product_name:"", min_order_qty:"", price:"", currency_id:"", date_start:"", date_end:"", lead_time_days:"7", is_preferred:false, notes:"" });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("table");

  async function loadData() { try { const [itemsRes, productsRes, suppliersRes] = await Promise.all([fetch(API_URL, { headers: authHeaders() }), fetch(PRODUCTS_URL, { headers: authHeaders() }), fetch(SUPPLIERS_URL, { headers: authHeaders() })]); setItems(itemsRes.ok ? await itemsRes.json() : []); setProducts(productsRes.ok ? await productsRes.json() : []); setSuppliers(suppliersRes.ok ? await suppliersRes.json() : []); } catch (e) { setMessage("تعذر التحميل"); } }
  useEffect(() => { if (ready && user) loadData(); }, [ready, user]);

  const filtered = useMemo(() => { const q = search.toLowerCase(); return q ? items.filter(i => JSON.stringify(i).toLowerCase().includes(q)) : items; }, [items, search]);

  function resetForm() { setForm({ product_id:"", supplier_id:"", supplier_sku:"", product_name:"", min_order_qty:"", price:"", currency_id:"", date_start:"", date_end:"", lead_time_days:"7", is_preferred:false, notes:"" }); setEditingId(null); }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const body = { product_id: Number(form.product_id), supplier_id: Number(form.supplier_id), supplier_sku: form.supplier_sku, product_name: form.product_name, min_order_qty: Number(form.min_order_qty)||0, price: Number(form.price)||0, currency_id: form.currency_id?Number(form.currency_id):null, date_start: form.date_start||null, date_end: form.date_end||null, lead_time_days: Number(form.lead_time_days)||7, is_preferred: form.is_preferred, notes: form.notes };
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("فشل الحفظ");
      setMessage(editingId ? "تم التحديث" : "تم الإنشاء");
      resetForm(); loadData();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function handleDelete(id) { if (!confirm("حذف معلومات المورد؟")) return; await fetch(`${API_URL}/${id}`, { method: "DELETE", headers: authHeaders() }); loadData(); }

  function handleCsv() { exportTableCsv("supplier_products.csv", ["المنتج","المورد","اسم المنتج عند المورد","السعر","العملة","تاريخ البداية","تاريخ النهاية","الحد الأدنى","أيام التوريد","مفضل"], filtered.map(i => [i.product_name, i.supplier_name, i.product_name||"-", i.price, i.currency_id||"", i.date_start||"", i.date_end||"", i.min_order_qty, i.lead_time_days+" يوم", i.is_preferred?"نعم":"لا"])); }
  function handlePdf() { exportTablePdf("تقرير معلومات الموردين", "المشتريات / موردي المنتجات", [{ label: "عدد السجلات", value: filtered.length }], ["المنتج","المورد","اسم المنتج عند المورد","السعر","العملة","تاريخ البداية","تاريخ النهاية","الحد الأدنى","أيام التوريد","مفضل"], filtered.map(i => [i.product_name, i.supplier_name, i.product_name||"-", i.price, i.currency_id||"", i.date_start||"", i.date_end||"", i.min_order_qty, i.lead_time_days+" يوم", i.is_preferred?"نعم":"لا"])); }


  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <section className="erp-hero"><div><div className="erp-hero-pill">المشتريات / موردي المنتجات</div><h2>معلومات الموردين للمنتجات</h2><p>تسجيل أسعار الموردين ومواصفاتهم لكل منتج.</p></div></section>
      <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">إجمالي السجلات</div><div className="erp-card-value">{items?.length || 0}</div></div><div className="erp-card"><div className="erp-card-title">نشط</div><div className="erp-card-value">{items?.filter(i=>i.is_active!==false).length || 0}</div></div></section>
      {message && <div className="erp-form-message">{message}</div>}
      <div className="erp-section-card" style={{ marginBottom:18 }}>
        <h3>{editingId ? "تعديل معلومات المورد" : "معلومات مورد جديدة"}</h3>
        <form className="erp-form-grid" onSubmit={handleSubmit}>
          <select className="erp-input" value={form.product_id} onChange={e => setForm({ ...form, product_id:e.target.value })} required><option value="">اختر المنتج</option>{products.map(p => <option key={p.id} value={p.id}>{p.name_ar} ({p.sku})</option>)}</select>
          <select className="erp-input" value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id:e.target.value })} required><option value="">اختر المورد</option>{suppliers.map(s => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}</select>
          <input className="erp-input" placeholder="SKU عند المورد" value={form.supplier_sku} onChange={e => setForm({ ...form, supplier_sku:e.target.value })} />
          <input className="erp-input" placeholder="اسم المنتج عند المورد" value={form.product_name} onChange={e => setForm({ ...form, product_name:e.target.value })} />
          <input className="erp-input" type="number" step="0.01" placeholder="الحد الأدنى للطلب" value={form.min_order_qty} onChange={e => setForm({ ...form, min_order_qty:e.target.value })} />
          <input className="erp-input" type="number" step="0.01" placeholder="السعر" value={form.price} onChange={e => setForm({ ...form, price:e.target.value })} />
          <input className="erp-input" type="number" placeholder="معرف العملة" value={form.currency_id} onChange={e => setForm({ ...form, currency_id:e.target.value })} />
          <input className="erp-input" type="date" placeholder="تاريخ بداية السعر" value={form.date_start} onChange={e => setForm({ ...form, date_start:e.target.value })} />
          <input className="erp-input" type="date" placeholder="تاريخ نهاية السعر" value={form.date_end} onChange={e => setForm({ ...form, date_end:e.target.value })} />
          <input className="erp-input" type="number" placeholder="أيام التوريد" value={form.lead_time_days} onChange={e => setForm({ ...form, lead_time_days:e.target.value })} />
          <label className="erp-check"><input type="checkbox" checked={form.is_preferred} onChange={e => setForm({ ...form, is_preferred:e.target.checked })} /><span>مورد مفضل</span></label>
          <textarea className="erp-input" rows="2" placeholder="ملاحظات" value={form.notes} onChange={e => setForm({ ...form, notes:e.target.value })} />
          <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":editingId?"تحديث":"إنشاء"}</button><button className="erp-btn-secondary" type="button" onClick={resetForm}>إلغاء</button></div>
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
        {viewMode==="table" && (<div className="erp-table-shell"><table className="erp-table"><thead><tr><th>#</th><th>المنتج</th><th>المورد</th><th>اسم المنتج عند المورد</th><th>السعر</th><th>العملة</th><th>تاريخ البداية</th><th>تاريخ النهاية</th><th>الحد الأدنى</th><th>أيام التوريد</th><th>مفضل</th><th>إجراءات</th></tr></thead><tbody>{filtered.map(item => (<tr key={item.id}><td>{item.id}</td><td>{item.product_name}</td><td>{item.supplier_name}</td><td>{item.product_name||"-"}</td><td>{item.price}</td><td>{item.currency_id||"-"}</td><td>{item.date_start||"-"}</td><td>{item.date_end||"-"}</td><td>{item.min_order_qty}</td><td>{item.lead_time_days} يوم</td><td>{item.is_preferred?"نعم":"لا"}</td><td><button className="erp-btn-secondary" style={{ marginInlineEnd:6 }} onClick={()=>{setEditingId(item.id);setForm({...item,product_id:String(item.product_id),supplier_id:String(item.supplier_id)})}}>تعديل</button><button className="erp-btn-danger" onClick={()=>handleDelete(item.id)}>حذف</button></td></tr>))}</tbody></table></div>)}
        {viewMode==="kanban" && <KanbanBoard items={filtered} statusField="is_preferred" statusOptions={[true,false]} statusLabels={{true:"مفضل",false:"عادي"}} statusColors={{true:"#10b981",false:"#6b7280"}} renderCard={item => <div><div style={{fontWeight:900}}>{item.product_name}</div><div>{item.supplier_name}</div><div>السعر: {item.price}</div><div>العملة: {item.currency_id||"-"}</div></div>} onAction={item => <><button className="erp-btn-secondary" style={{fontSize:11,padding:"4px 8px"}} onClick={()=>{setEditingId(item.id);setForm({...item,product_id:String(item.product_id),supplier_id:String(item.supplier_id)})}}>تعديل</button><button className="erp-btn-danger" style={{fontSize:11,padding:"4px 8px"}} onClick={()=>handleDelete(item.id)}>حذف</button></>} emptyMessage="لا توجد معلومات موردين" />}
      </div>
    </section></main>
  );
}
