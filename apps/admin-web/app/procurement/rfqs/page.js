"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";
import KanbanBoard from "../../components/KanbanBoard";

const API_RFQ = "https://api.royalpalace-group.com/api/v1/admin/procurement/rfqs";
const API_SUPPLIERS = "https://api.royalpalace-group.com/api/v1/admin/procurement/suppliers";
const API_FACTORIES = "https://api.royalpalace-group.com/api/v1/admin/factories";
const API_PRODUCTS = "https://api.royalpalace-group.com/api/v1/catalog/products";

const RFQ_STATUSES = ["draft","sent","received","evaluated","awarded","cancelled"];
const RFQ_STATUS_LABELS = { draft:"مسودة", sent:"مرسل", received:"تم الاستلام", evaluated:"تم التقييم", awarded:"تمت الترسية", cancelled:"ملغي" };
const RFQ_STATUS_COLORS = { draft:"#6b7280", sent:"#3b82f6", received:"#f59e0b", evaluated:"#8b5cf6", awarded:"#10b981", cancelled:"#ef4444" };

const btnStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };
function fmt(v) { return Number(v||0).toLocaleString("ar-EG"); }

function RfqCard({ rfq }) {
  if (!rfq) return null;
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:14 }}>{rfq.rfq_number||rfq.name||"-"}</div>
      <div style={{ fontSize:12, color:"var(--rp-text-muted)" }}>{rfq.supplier_name||"-"}</div>
      <div style={{ fontSize:11, marginTop:4 }}>الإجمالي: {fmt(rfq.total_amount)}</div>
    </div>
  );
}

export default function RfqsPage() {
  const { user, ready } = useAdminAuth("procurement");
  const [rfqs, setRfqs] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [factories, setFactories] = useState([]);
  const [products, setProducts] = useState([]);
  const [msg, setMsg] = useState("");
  const [viewMode, setViewMode] = useState("kanban");
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({
    supplier_id:"", factory_id:"", rfq_number:"", name:"", expected_date:"",
    notes:"", items: [{ product_id:"", quantity:"", notes:"" }]
  });
  const [editingId, setEditingId] = useState(null);

  async function loadAll() {
    try {
      const [rfqRes, suppRes, factRes, prodRes] = await Promise.all([
        fetch(API_RFQ, { headers: authHeaders() }),
        fetch(API_SUPPLIERS, { headers: authHeaders() }),
        fetch(API_FACTORIES, { headers: authHeaders() }),
        fetch(API_PRODUCTS, { headers: authHeaders() }),
      ]);
      setRfqs(rfqRes.ok ? await rfqRes.json() : []);
      setSuppliers(suppRes.ok ? await suppRes.json() : []);
      setFactories(factRes.ok ? await factRes.json() : []);
      setProducts(prodRes.ok ? await prodRes.json() : []);
    } catch(e) { setMsg(e.message); }
  }
  useEffect(() => { if (ready && user) loadAll(); }, [ready, user]);

  function resetForm() {
    setForm({ supplier_id:"", factory_id:"", rfq_number:"", name:"", expected_date:"", notes:"", items: [{ product_id:"", quantity:"", notes:"" }] });
    setEditingId(null);
  }

  function startEdit(rfq) {
    setEditingId(rfq.id);
    setForm({
      supplier_id: String(rfq.supplier_id||""),
      factory_id: String(rfq.factory_id||""),
      rfq_number: rfq.rfq_number||"",
      name: rfq.name||"",
      expected_date: rfq.expected_date||"",
      notes: rfq.notes||"",
      items: rfq.items && rfq.items.length ? rfq.items.map(i=>({ product_id: String(i.product_id||""), quantity: String(i.quantity||""), notes: i.notes||"" })) : [{ product_id:"", quantity:"", notes:"" }]
    });
  }

  function addItem() { setForm(prev => ({ ...prev, items: [...prev.items, { product_id:"", quantity:"", notes:"" }] })); }
  function removeItem(index) { setForm(prev => ({ ...prev, items: prev.items.filter((_,i)=>i!==index) })); }
  function updateItem(index, field, value) {
    setForm(prev => {
      const items = [...prev.items];
      items[index] = { ...items[index], [field]: value };
      return { ...prev, items };
    });
  }

  async function handleSubmit(e) {
    e.preventDefault(); setBusy(true); setMsg("");
    try {
      const payload = {
        supplier_id: Number(form.supplier_id),
        factory_id: Number(form.factory_id),
        rfq_number: form.rfq_number,
        name: form.name,
        expected_date: form.expected_date,
        notes: form.notes,
        items: form.items.map(i=>({ product_id: Number(i.product_id), quantity: Number(i.quantity), notes: i.notes }))
      };
      const url = editingId ? `${API_RFQ}/${editingId}` : API_RFQ;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: {"Content-Type":"application/json",...authHeaders()}, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).detail);
      setMsg(editingId ? "تم تعديل طلب عرض السعر" : "تم إنشاء طلب عرض السعر");
      resetForm(); loadAll();
    } catch(e) { setMsg(e.message); } finally { setBusy(false); }
  }

  async function changeStatus(id, status) {
    await fetch(`${API_RFQ}/${id}/status`, { method:"PATCH", headers: {"Content-Type":"application/json",...authHeaders()}, body: JSON.stringify({ status }) });
    loadAll();
  }

  async function delRfq(id) { if (!confirm("حذف طلب عرض السعر؟")) return; await fetch(`${API_RFQ}/${id}`, { method:"DELETE", headers: authHeaders() }); loadAll(); }

  function exportCsvFn() {
    exportTableCsv("rfqs.csv",
      ["رقم RFQ","المورد","المصنع","الحالة","التاريخ المتوقع","الإجمالي","ملاحظات"],
      rfqs.map(r=>[r.rfq_number||"",r.supplier_name||"",r.factory_name||"",r.status||"",r.expected_date||"",r.total_amount||"",r.notes||""])
    );
  }
  function exportPdfFn() {
    exportTablePdf("طلبات عروض الأسعار", "المشتريات / RFQ",
      [{label:"عدد الطلبات",value:rfqs.length},{label:"مسودة",value:rfqs.filter(r=>r.status==="draft").length}],
      ["رقم RFQ","المورد","المصنع","الحالة","التاريخ المتوقع","الإجمالي","ملاحظات"],
      rfqs.map(r=>[r.rfq_number||"",r.supplier_name||"",r.factory_name||"",r.status||"",r.expected_date||"",r.total_amount||"",r.notes||""])
    );
  }
  function exportExcelFn() {
    if (typeof window === "undefined") return;
    import("xlsx").then(XLSX => {
      const headers = ["رقم RFQ","المورد","المصنع","الحالة","التاريخ المتوقع","الإجمالي","ملاحظات"];
      const rows = rfqs.map(r=>[r.rfq_number||"",r.supplier_name||"",r.factory_name||"",r.status||"",r.expected_date||"",r.total_amount||"",r.notes||""]);
      const data = [headers, ...rows];
      const ws = XLSX.utils.aoa_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "RFQs");
      XLSX.writeFile(wb, "rfqs.xlsx");
    });
  }

  const stats = useMemo(() => ({
    total: rfqs.length,
    draft: rfqs.filter(r=>r.status==="draft").length,
    awarded: rfqs.filter(r=>r.status==="awarded").length
  }), [rfqs]);

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جاري تحميل طلبات عروض الأسعار...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main">
        <div className="erp-hero">
          <div>
            <div className="erp-hero-pill">RFQ Management</div>
            <h2>طلبات عروض الأسعار</h2>
            <p>إدارة طلبات عروض الأسعار من الموردين، تقييمها وترسيتها.</p>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box"><div className="erp-stat-box-label">إجمالي الطلبات</div><div className="erp-stat-box-value">{stats.total}</div></div>
            <div className="erp-stat-box"><div className="erp-stat-box-label">مسودة</div><div className="erp-stat-box-value">{stats.draft}</div></div>
            <div className="erp-stat-box"><div className="erp-stat-box-label">تمت الترسية</div><div className="erp-stat-box-value">{stats.awarded}</div></div>
          </div>
        </div>

        <section className="erp-kpi-grid" style={{marginBottom:18}}>
          <div className="erp-card"><div className="erp-card-title">الإجمالي</div><div className="erp-card-value">{stats.total}</div></div>
          <div className="erp-card"><div className="erp-card-title">مسودة</div><div className="erp-card-value">{stats.draft}</div></div>
          <div className="erp-card"><div className="erp-card-title">ترسية</div><div className="erp-card-value">{stats.awarded}</div></div>
        </section>

        {msg && <div className="erp-form-message" style={{marginBottom:16}}>{msg}</div>}

        <div className="erp-section-card" style={{marginBottom:18}}>
          <h3>{editingId ? "تعديل طلب عرض سعر" : "إنشاء طلب عرض سعر جديد"}</h3>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit} style={{gap:12}}>
            <select className="erp-input" value={form.supplier_id} onChange={e=>setForm({...form,supplier_id:e.target.value})} required>
              <option value="">اختر المورد</option>
              {suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <select className="erp-input" value={form.factory_id} onChange={e=>setForm({...form,factory_id:e.target.value})} required>
              <option value="">اختر المصنع</option>
              {factories.map(f=><option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <input className="erp-input" placeholder="رقم RFQ" value={form.rfq_number} onChange={e=>setForm({...form,rfq_number:e.target.value})} />
            <input className="erp-input" placeholder="العنوان" value={form.name} onChange={e=>setForm({...form,name:e.target.value})} required />
            <input className="erp-input" type="date" placeholder="التاريخ المتوقع" value={form.expected_date} onChange={e=>setForm({...form,expected_date:e.target.value})} />
            <textarea className="erp-input" rows="2" placeholder="ملاحظات" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
            <div style={{gridColumn:"1/-1"}}>
              <div style={{display:"flex", justifyContent:"space-between", marginBottom:8}}>
                <span style={{fontWeight:800}}>بنود الطلب</span>
                <button type="button" className="erp-btn-secondary" style={btnStyle} onClick={addItem}>إضافة بند</button>
              </div>
              {form.items.map((item, idx) => (
                <div key={idx} style={{display:"flex", gap:8, marginBottom:8}}>
                  <select className="erp-input" value={item.product_id} onChange={e=>updateItem(idx, "product_id", e.target.value)} required>
                    <option value="">اختر المنتج</option>
                    {products.map(p=><option key={p.id} value={p.id}>{p.name_ar}</option>)}
                  </select>
                  <input className="erp-input" type="number" placeholder="الكمية" value={item.quantity} onChange={e=>updateItem(idx, "quantity", e.target.value)} required />
                  <input className="erp-input" placeholder="ملاحظات" value={item.notes} onChange={e=>updateItem(idx, "notes", e.target.value)} />
                  {form.items.length > 1 && <button type="button" className="erp-btn-danger" onClick={()=>removeItem(idx)}>حذف</button>}
                </div>
              ))}
            </div>
            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={busy}>{busy?"جارٍ الحفظ...":editingId?"حفظ التعديل":"إنشاء الطلب"}</button>
              {editingId && <button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء</button>}
            </div>
          </form>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <h3>قائمة الطلبات</h3>
            <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
              <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} style={btnStyle} onClick={()=>setViewMode("kanban")}>Kanban</button>
              <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} style={btnStyle} onClick={()=>setViewMode("table")}>جدول</button>
              <button className="erp-btn-secondary" style={btnStyle} onClick={exportCsvFn}>CSV</button>
              <button className="erp-btn-secondary" style={btnStyle} onClick={exportExcelFn}>Excel</button>
              <button className="erp-btn-primary" style={btnStyle} onClick={exportPdfFn}>PDF</button>
            </div>
          </div>

          {viewMode==="kanban" ? (
            <KanbanBoard
              items={rfqs}
              statusField="status"
              statusOptions={RFQ_STATUSES}
              statusLabels={RFQ_STATUS_LABELS}
              statusColors={RFQ_STATUS_COLORS}
              renderCard={RfqCard}
              onAction={(rfq)=>(
                <div style={{display:"flex",gap:4,flexWrap:"wrap"}}>
                  <button className="erp-btn-secondary" style={{fontSize:11}} onClick={()=>startEdit(rfq)}>تعديل</button>
                  {RFQ_STATUSES.filter(s=>s!==rfq.status).slice(0,3).map(s=>
                    <button key={s} className="erp-btn-secondary" style={{fontSize:11}} onClick={()=>changeStatus(rfq.id,s)}>→ {RFQ_STATUS_LABELS[s]}</button>
                  )}
                  <button className="erp-btn-danger" style={{fontSize:11}} onClick={()=>delRfq(rfq.id)}>حذف</button>
                </div>
              )}
              emptyMessage="لا توجد طلبات"
            />
          ) : (
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead>
                  <tr><th>رقم RFQ</th><th>المورد</th><th>المصنع</th><th>الحالة</th><th>التاريخ المتوقع</th><th>الإجمالي</th><th></th></tr>
                </thead>
                <tbody>
                  {rfqs.map(r=><tr key={r.id}>
                    <td>{r.rfq_number||"-"}</td><td>{r.supplier_name||"-"}</td><td>{r.factory_name||"-"}</td>
                    <td><span className="erp-badge" style={{background:RFQ_STATUS_COLORS[r.status]+"22",color:RFQ_STATUS_COLORS[r.status]}}>{RFQ_STATUS_LABELS[r.status]}</span></td>
                    <td>{r.expected_date||"-"}</td><td>{fmt(r.total_amount)}</td>
                    <td>
                      <div style={{display:"flex",gap:6}}>
                        <button className="erp-btn-secondary" style={{fontSize:12}} onClick={()=>startEdit(r)}>تعديل</button>
                        {RFQ_STATUSES.filter(s=>s!==r.status).slice(0,2).map(s=>
                          <button key={s} className="erp-btn-secondary" style={{fontSize:12}} onClick={()=>changeStatus(r.id,s)}>→ {RFQ_STATUS_LABELS[s]}</button>
                        )}
                        <button className="erp-btn-danger" style={{fontSize:12}} onClick={()=>delRfq(r.id)}>حذف</button>
                      </div>
                    </td>
                  </tr>)}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
