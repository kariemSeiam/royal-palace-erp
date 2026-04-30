"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";

const PURCHASE_RECEIPTS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/receipts";
const INVOICES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/supplier-invoices";

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

function normalizeText(value){ return String(value || "").trim().toLowerCase(); }
function formatAmount(value){ const num=Number(value || 0); if(!Number.isFinite(num)) return "0.00"; return num.toLocaleString("en-US",{minimumFractionDigits:2,maximumFractionDigits:2}); }

export default function ProcurementReceiptsPage() {
  const { user, ready } = useAdminAuth("procurement");
  const [items,setItems]=useState([]);
  const [invoices,setInvoices]=useState([]);
  const [message,setMessage]=useState("");
  const [search,setSearch]=useState("");

  async function loadAll(){
    const [receiptsRes,invoicesRes]=await Promise.all([
      fetch(PURCHASE_RECEIPTS_API_URL,{headers:authHeaders(),cache:"no-store"}),
      fetch(INVOICES_API_URL,{headers:authHeaders(),cache:"no-store"}),
    ]);
    const receiptsData=await receiptsRes.json().catch(()=>[]);
    const invoicesData=await invoicesRes.json().catch(()=>[]);
    if(!receiptsRes.ok) throw new Error(receiptsData.detail || "فشل تحميل الاستلامات");
    if(!invoicesRes.ok) throw new Error(invoicesData.detail || "فشل تحميل فواتير الموردين");
    setItems(Array.isArray(receiptsData)?receiptsData:[]);
    setInvoices(Array.isArray(invoicesData)?invoicesData:[]);
  }

  useEffect(()=>{ if(!ready || !user) return; loadAll().catch((err)=>setMessage(err.message || "حدث خطأ أثناء التحميل")); },[ready,user]);

  const invoiceByPoNumber = useMemo(()=>{ const map=new Map(); invoices.forEach((item)=>{ if(item.po_number) map.set(String(item.po_number),item); }); return map; },[invoices]);

  const filteredItems = useMemo(()=>{
    const q=normalizeText(search);
    if(!q) return items;
    return items.filter((item)=>{
      const linkedInvoice=invoiceByPoNumber.get(String(item.po_number));
      const haystack=[item.id,item.po_number,item.factory_name,item.supplier_name,item.supplier_code,item.warehouse_name,item.warehouse_code,item.product_name,item.product_sku,item.received_by_name,item.notes,linkedInvoice?.invoice_number].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  },[items,search,invoiceByPoNumber]);

  const stats = useMemo(()=>({ total:items.length, qty:items.reduce((sum,x)=>sum+Number(x.received_quantity || 0),0), value:items.reduce((sum,x)=>sum+(Number(x.received_quantity || 0)*Number(x.unit_cost || 0)),0) }),[items]);

  function handleExportCsv() {
    const headers = ["رقم أمر الشراء","فاتورة المورد","المصنع","المورد","المخزن","المنتج","SKU","الكمية","تكلفة الوحدة","المستلم"];
    const rows = filteredItems.map((item) => {
      const linkedInvoice = invoiceByPoNumber.get(String(item.po_number));
      return [item.po_number, linkedInvoice?.invoice_number || "", item.factory_name, `${item.supplier_name} (${item.supplier_code})`, `${item.warehouse_name} (${item.warehouse_code})`, item.product_name, item.product_sku, formatAmount(item.received_quantity), formatAmount(item.unit_cost), item.received_by_name || ""];
    });
    exportTableCsv("receipts_export.csv", headers, rows);
  }

  function handleExportPdf() {
    const headers = ["رقم أمر الشراء","فاتورة المورد","المصنع","المورد","المخزن","المنتج","SKU","الكمية","تكلفة الوحدة","المستلم"];
    const rows = filteredItems.map((item) => {
      const linkedInvoice = invoiceByPoNumber.get(String(item.po_number));
      return [item.po_number, linkedInvoice?.invoice_number || "", item.factory_name, `${item.supplier_name} (${item.supplier_code})`, `${item.warehouse_name} (${item.warehouse_code})`, item.product_name, item.product_sku, formatAmount(item.received_quantity), formatAmount(item.unit_cost), item.received_by_name || ""];
    });
    exportTablePdf("تقرير الاستلامات", "المشتريات / الاستلامات", [{ label: "عدد الاستلامات", value: stats.total }, { label: "الكمية الإجمالية", value: formatAmount(stats.qty) }], headers, rows);
  }

  if(!ready || !user){ return <main className="loading-shell"><div className="loading-card">جارٍ تحميل الاستلامات...</div></main>; }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user}/>
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div style={{textAlign:"right"}}>
            <div className="erp-hero-pill">Procurement Workflow / Step 3</div>
            <h2>سجل الاستلامات</h2>
            <p>كل استلام هنا يمثل نقطة الربط بين أمر الشراء والمخزون وفاتورة المورد.</p>
            <div className="erp-hero-actions">
              <div className="erp-hero-pill">عدد الاستلامات: {stats.total}</div>
              <div className="erp-hero-pill">إجمالي الكمية: {formatAmount(stats.qty)}</div>
              <div className="erp-hero-pill">القيمة: {formatAmount(stats.value)}</div>
            </div>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box"><div className="erp-stat-box-label">الدورة التالية</div><div className="erp-stat-box-value" style={{fontSize:"14px"}}>Supplier Invoice</div></div>
            <div className="erp-stat-box"><div className="erp-stat-box-label">الحركات</div><div className="erp-stat-box-value">{stats.total}</div></div>
          </div>
        </section>

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">عدد الاستلامات</div><div className="erp-card-value">{stats.total}</div></div>
          <div className="erp-card"><div className="erp-card-title">الكمية الإجمالية</div><div className="erp-card-value">{formatAmount(stats.qty)}</div></div>
          <div className="erp-card"><div className="erp-card-title">القيمة</div><div className="erp-card-value">{formatAmount(stats.value)}</div></div>
        </section>

        {items.length===0 ? <div className="erp-form-message" style={{marginBottom:"16px"}}>لا توجد استلامات حالياً. بعد اعتماد أمر شراء، استخدم زر الاستلام داخل صفحة أوامر الشراء.</div> : null}
        {message ? <div className="erp-form-message">{message}</div> : null}

        <div className="erp-section-card">
          <div className="erp-section-head">
            <div style={{textAlign:"right"}}><h3 style={{marginBottom:"4px"}}>قائمة الاستلامات</h3><p style={{margin:0}}>ابحث برقم أمر الشراء أو المورد أو المنتج أو الفاتورة المرتبطة.</p></div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center",width:"100%"}}>
              <input className="erp-input" style={{maxWidth:"420px",minHeight:"42px"}} placeholder="ابحث..." value={search} onChange={(e)=>setSearch(e.target.value)}/>
              <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button>
              <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button>
            </div>
          </div>
          <div className="erp-table-shell" style={{overflowX:"auto"}}>
            <table className="erp-table" style={{minWidth:"1500px"}}>
              <thead><tr><th>ID</th><th>أمر الشراء</th><th>فاتورة المورد</th><th>المصنع</th><th>المورد</th><th>المخزن</th><th>المنتج</th><th>SKU</th><th>الكمية</th><th>تكلفة الوحدة</th><th>المستلم بواسطة</th><th>ملاحظات</th></tr></thead>
              <tbody>
                {filteredItems.length===0 ? <tr><td colSpan="12">{items.length===0 ? "لا توجد استلامات حالياً." : "لا توجد نتائج مطابقة."}</td></tr> : filteredItems.map((item)=>{
                  const linkedInvoice=invoiceByPoNumber.get(String(item.po_number));
                  return <tr key={item.id}><td>{item.id}</td><td>{item.po_number}</td><td>{linkedInvoice?.invoice_number || "—"}</td><td>{item.factory_name}</td><td>{item.supplier_name} ({item.supplier_code})</td><td>{item.warehouse_name} ({item.warehouse_code})</td><td>{item.product_name}</td><td>{item.product_sku}</td><td>{formatAmount(item.received_quantity)}</td><td>{formatAmount(item.unit_cost)}</td><td>{item.received_by_name || "-"}</td><td>{item.notes || "-"}</td></tr>;
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
