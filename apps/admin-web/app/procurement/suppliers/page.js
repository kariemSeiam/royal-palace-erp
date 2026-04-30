"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";

const SUPPLIERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/suppliers";
const FACTORIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";
const PURCHASE_ORDERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/purchase-orders";
const INVOICES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/supplier-invoices";

const emptyForm = { factory_id:"", code:"", name:"", contact_name:"", phone:"", email:"", address:"", notes:"", is_active:true };
const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

function normalizeText(value){ return String(value || "").trim().toLowerCase(); }

export default function SuppliersPage() {
  const { user, ready } = useAdminAuth("procurement");
  const [items,setItems]=useState([]);
  const [factories,setFactories]=useState([]);
  const [purchaseOrders,setPurchaseOrders]=useState([]);
  const [invoices,setInvoices]=useState([]);
  const [form,setForm]=useState(emptyForm);
  const [editingId,setEditingId]=useState(null);
  const [submitting,setSubmitting]=useState(false);
  const [message,setMessage]=useState("");
  const [search,setSearch]=useState("");

  async function loadAll(){
    const [suppliersRes,factoriesRes,purchaseOrdersRes,invoicesRes]=await Promise.all([
      fetch(SUPPLIERS_API_URL,{headers:authHeaders(),cache:"no-store"}),
      fetch(FACTORIES_API_URL,{headers:authHeaders(),cache:"no-store"}),
      fetch(PURCHASE_ORDERS_API_URL,{headers:authHeaders(),cache:"no-store"}),
      fetch(INVOICES_API_URL,{headers:authHeaders(),cache:"no-store"}),
    ]);
    const suppliersData=await suppliersRes.json().catch(()=>[]);
    const factoriesData=await factoriesRes.json().catch(()=>[]);
    const purchaseOrdersData=await purchaseOrdersRes.json().catch(()=>[]);
    const invoicesData=await invoicesRes.json().catch(()=>[]);
    if(!suppliersRes.ok) throw new Error(suppliersData.detail || "فشل تحميل الموردين");
    if(!factoriesRes.ok) throw new Error(factoriesData.detail || "فشل تحميل المصانع");
    if(!purchaseOrdersRes.ok) throw new Error(purchaseOrdersData.detail || "فشل تحميل أوامر الشراء");
    if(!invoicesRes.ok) throw new Error(invoicesData.detail || "فشل تحميل فواتير الموردين");
    setItems(Array.isArray(suppliersData)?suppliersData:[]);
    setFactories(Array.isArray(factoriesData)?factoriesData:[]);
    setPurchaseOrders(Array.isArray(purchaseOrdersData)?purchaseOrdersData:[]);
    setInvoices(Array.isArray(invoicesData)?invoicesData:[]);
  }

  useEffect(()=>{ if(!ready || !user) return; loadAll().catch((err)=>setMessage(err.message || "حدث خطأ أثناء التحميل")); },[ready,user]);

  const supplierStatsMap = useMemo(()=>{
    const map=new Map();
    items.forEach((item)=>map.set(Number(item.id),{poCount:0,openInvoices:0,totalRemaining:0}));
    purchaseOrders.forEach((po)=>{ const key=Number(po.supplier_id); if(!map.has(key)) map.set(key,{poCount:0,openInvoices:0,totalRemaining:0}); map.get(key).poCount+=1; });
    invoices.forEach((invoice)=>{ const key=Number(invoice.supplier_id); if(!map.has(key)) map.set(key,{poCount:0,openInvoices:0,totalRemaining:0}); if(Number(invoice.remaining_amount || 0)>0) map.get(key).openInvoices+=1; map.get(key).totalRemaining += Number(invoice.remaining_amount || 0); });
    return map;
  },[items,purchaseOrders,invoices]);

  const filteredItems = useMemo(()=>{
    const q=normalizeText(search);
    if(!q) return items;
    return items.filter((item)=>{
      const stats=supplierStatsMap.get(Number(item.id)) || {poCount:0,openInvoices:0,totalRemaining:0};
      const haystack=[item.id,item.factory_name,item.code,item.name,item.contact_name,item.phone,item.email,item.address,item.notes,stats.poCount,stats.openInvoices,stats.totalRemaining].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  },[items,search,supplierStatsMap]);

  function updateField(field,value){ setForm((prev)=>({...prev,[field]:value})); }
  function resetForm(){ setForm(emptyForm); setEditingId(null); }
  function startEdit(item){
    setEditingId(item.id);
    setForm({ factory_id:String(item.factory_id||""), code:item.code||"", name:item.name||"", contact_name:item.contact_name||"", phone:item.phone||"", email:item.email||"", address:item.address||"", notes:item.notes||"", is_active:item.is_active!==false });
    setMessage(""); window.scrollTo({top:0,behavior:"smooth"});
  }

  async function handleSubmit(e){
    e.preventDefault(); setSubmitting(true); setMessage("");
    try{
      const payload={ factory_id:form.factory_id?Number(form.factory_id):null, code:form.code.trim(), name:form.name.trim(), contact_name:form.contact_name.trim()||null, phone:form.phone.trim()||null, email:form.email.trim()||null, address:form.address.trim()||null, notes:form.notes.trim()||null, is_active:Boolean(form.is_active) };
      const url=editingId?`${SUPPLIERS_API_URL}/${editingId}`:SUPPLIERS_API_URL;
      const method=editingId?"PUT":"POST";
      const res=await fetch(url,{method,headers:{"Content-Type":"application/json",...authHeaders()},body:JSON.stringify(payload)});
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.detail || "فشل حفظ المورد");
      setMessage(editingId?"تم تعديل المورد بنجاح":"تم إنشاء المورد بنجاح"); resetForm(); await loadAll();
    }catch(err){ setMessage(err.message || "حدث خطأ أثناء حفظ المورد"); } finally { setSubmitting(false); }
  }

  async function handleDelete(id){
    if(!confirm("هل تريد حذف هذا المورد؟")) return;
    try{
      const res=await fetch(`${SUPPLIERS_API_URL}/${id}`,{method:"DELETE",headers:authHeaders()});
      const data=await res.json().catch(()=>({}));
      if(!res.ok) throw new Error(data.detail || "فشل حذف المورد");
      setMessage("تم حذف المورد بنجاح"); if(editingId===id) resetForm(); await loadAll();
    }catch(err){ setMessage(err.message || "حدث خطأ أثناء حذف المورد"); }
  }

  function handleExportCsv() {
    const headers = ["ID","المصنع","الكود","الاسم","التواصل","الهاتف","POs","فواتير مفتوحة","المتبقي","نشط"];
    const rows = filteredItems.map((item) => {
      const stats = supplierStatsMap.get(Number(item.id)) || {poCount:0,openInvoices:0,totalRemaining:0};
      return [item.id, item.factory_name || `مصنع #${item.factory_id}`, item.code, item.name, item.contact_name || "", item.phone || "", stats.poCount, stats.openInvoices, stats.totalRemaining.toFixed(2), item.is_active ? "نعم" : "لا"];
    });
    exportTableCsv("suppliers_export.csv", headers, rows);
  }

  function handleExportPdf() {
    const headers = ["ID","المصنع","الكود","الاسم","التواصل","الهاتف","POs","فواتير مفتوحة","المتبقي","نشط"];
    const rows = filteredItems.map((item) => {
      const stats = supplierStatsMap.get(Number(item.id)) || {poCount:0,openInvoices:0,totalRemaining:0};
      return [item.id, item.factory_name || `مصنع #${item.factory_id}`, item.code, item.name, item.contact_name || "", item.phone || "", stats.poCount, stats.openInvoices, stats.totalRemaining.toFixed(2), item.is_active ? "نعم" : "لا"];
    });
    exportTablePdf("تقرير الموردين", "المشتريات / الموردين", [{ label: "عدد الموردين", value: items.length }], headers, rows);
  }

  if(!ready || !user){ return <main className="loading-shell"><div className="loading-card">جارٍ تحميل الموردين...</div></main>; }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user}/>
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">Suppliers / Procurement Start Point</div>
            <h2>إدارة الموردين</h2>
            <p>هذه الصفحة هي بداية الدورة: المورد ثم أمر الشراء ثم الاستلام ثم فاتورة المورد ثم السداد.</p>
            <div className="erp-hero-actions">
              <div className="erp-hero-pill">إجمالي الموردين: {items.length}</div>
              <div className="erp-hero-pill">POs: {purchaseOrders.length}</div>
              <div className="erp-hero-pill">Supplier Invoices: {invoices.length}</div>
            </div>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box"><div className="erp-stat-box-label">الموردون</div><div className="erp-stat-box-value">{items.length}</div></div>
            <div className="erp-stat-box"><div className="erp-stat-box-label">الدورة التالية</div><div className="erp-stat-box-value" style={{fontSize:"14px"}}>PO</div></div>
            <div className="erp-hero-visual"/>
          </div>
        </section>

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">الموردين</div><div className="erp-card-value">{items.length}</div></div>
          <div className="erp-card"><div className="erp-card-title">أوامر الشراء</div><div className="erp-card-value">{purchaseOrders.length}</div></div>
          <div className="erp-card"><div className="erp-card-title">فواتير الموردين</div><div className="erp-card-value">{invoices.length}</div></div>
        </section>

        {items.length===0 ? <div className="erp-form-message" style={{marginBottom:"16px"}}>لا توجد بيانات بعد. ابدأ هنا بإضافة المورد، ثم انتقل إلى أوامر الشراء لإكمال الدورة.</div> : null}
        {message ? <div className="erp-form-message">{message}</div> : null}

        <div className="erp-form-shell">
          <div className="erp-section-head" style={{marginBottom:"18px"}}>
            <div>
              <h3 style={{margin:0,fontSize:"22px",fontWeight:900}}>{editingId ? "تعديل المورد" : "إضافة مورد جديد"}</h3>
              <p style={{margin:"6px 0 0",color:"var(--rp-text-muted)",lineHeight:1.8}}>اربط المورد بالمصنع الصحيح ليصبح جاهزًا لأوامر الشراء والفواتير.</p>
            </div>
            <div className="erp-mini-note">{editingId ? `تحرير #${editingId}` : "Step 1 / 5"}</div>
          </div>

          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}>
            <div><label className="erp-label">المصنع</label><select className="erp-input" value={form.factory_id} onChange={(e)=>updateField("factory_id",e.target.value)}><option value="">اختر المصنع</option>{factories.map((factory)=><option key={factory.id} value={factory.id}>{factory.name}</option>)}</select></div>
            <div><label className="erp-label">كود المورد</label><input className="erp-input" value={form.code} onChange={(e)=>updateField("code",e.target.value)}/></div>
            <div><label className="erp-label">اسم المورد</label><input className="erp-input" value={form.name} onChange={(e)=>updateField("name",e.target.value)}/></div>
            <div><label className="erp-label">اسم مسؤول التواصل</label><input className="erp-input" value={form.contact_name} onChange={(e)=>updateField("contact_name",e.target.value)}/></div>
            <div><label className="erp-label">الهاتف</label><input className="erp-input" value={form.phone} onChange={(e)=>updateField("phone",e.target.value)}/></div>
            <div><label className="erp-label">البريد الإلكتروني</label><input className="erp-input" value={form.email} onChange={(e)=>updateField("email",e.target.value)}/></div>
            <div style={{gridColumn:"1 / -1"}}><label className="erp-label">العنوان</label><textarea className="erp-input" rows="3" value={form.address} onChange={(e)=>updateField("address",e.target.value)}/></div>
            <div style={{gridColumn:"1 / -1"}}><label className="erp-label">ملاحظات</label><textarea className="erp-input" rows="4" value={form.notes} onChange={(e)=>updateField("notes",e.target.value)}/></div>
            <div><label className="erp-label">الحالة</label><select className="erp-input" value={form.is_active?"1":"0"} onChange={(e)=>updateField("is_active",e.target.value==="1")}><option value="1">نشط</option><option value="0">غير نشط</option></select></div>
            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة المورد"}</button>
              {editingId ? <button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء</button> : null}
            </div>
          </form>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <div><h3>قائمة الموردين</h3><p>مع traceability سريع نحو أوامر الشراء وفواتير الموردين</p></div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center",width:"100%"}}>
              <input className="erp-search" style={{flex:"1 1 260px",minWidth:"220px"}} placeholder="ابحث بالاسم أو الكود أو الهاتف..." value={search} onChange={(e)=>setSearch(e.target.value)}/>
              <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button>
              <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button>
            </div>
          </div>

          <div className="erp-table-shell">
            <table className="erp-table" style={{minWidth:"1400px"}}>
              <thead><tr><th>ID</th><th>المصنع</th><th>الكود</th><th>الاسم</th><th>التواصل</th><th>الهاتف</th><th>POs</th><th>فواتير مفتوحة</th><th>المتبقي</th><th>الحالة</th><th>إجراءات</th></tr></thead>
              <tbody>
                {filteredItems.length===0 ? <tr><td colSpan="11">{items.length===0 ? "لا يوجد موردون حالياً." : "لا توجد نتائج مطابقة."}</td></tr> : filteredItems.map((item)=>{
                  const stats=supplierStatsMap.get(Number(item.id)) || {poCount:0,openInvoices:0,totalRemaining:0};
                  return (
                    <tr key={item.id}>
                      <td>{item.id}</td><td>{item.factory_name || `مصنع #${item.factory_id}`}</td><td>{item.code}</td><td>{item.name}</td><td>{item.contact_name || "—"}</td><td>{item.phone || "—"}</td><td>{stats.poCount}</td><td>{stats.openInvoices}</td><td>{stats.totalRemaining.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                      <td>{item.is_active ? <span className="erp-badge success">نشط</span> : <span className="erp-badge warning">غير نشط</span>}</td>
                      <td><div style={{display:"flex",gap:"8px",flexWrap:"wrap"}}><button type="button" className="erp-btn-secondary" onClick={()=>startEdit(item)}>تعديل</button><button type="button" className="erp-btn-danger" onClick={()=>handleDelete(item.id)}>حذف</button></div></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
