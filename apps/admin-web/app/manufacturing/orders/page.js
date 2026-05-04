'use client'
import { useEffect, useState } from "react"
import Sidebar from "../../components/Sidebar"
import useAdminAuth from "../../components/useAdminAuth"
import { authHeaders } from "../../components/api"
import { exportTableCsv, exportTablePdf } from "../../components/hrExports"
import KanbanBoard from "../../components/KanbanBoard"
import GanttChart from "../../components/GanttChart"

const API = "https://api.royalpalace-group.com/api/v1/admin/manufacturing/orders"
const WO_API = "https://api.royalpalace-group.com/api/v1/admin/mrp/work-orders"

const STATUS_OPTIONS = ["draft","confirmed","in_progress","done","cancelled"]
const STATUS_LABELS = { draft:"مسودة", confirmed:"مؤكد", in_progress:"قيد التنفيذ", done:"مكتمل", cancelled:"ملغي" }
const STATUS_COLORS = { draft:"#6b7280", confirmed:"#3b82f6", in_progress:"#f59e0b", done:"#10b981", cancelled:"#ef4444" }

function renderCard(mo) {
  return (
    <div>
      <div style={{ fontWeight:900 }}>طلب #{mo.order_id}</div>
      <div style={{ fontSize:12 }}>{mo.order_number||"-"}</div>
      <div style={{ fontSize:11 }}>مصنع {mo.factory_name||mo.factory_id}</div>
    </div>
  )
}

export default function ManufacturingOrdersPage() {
  const { user, ready } = useAdminAuth("work_orders")
  const [orders, setOrders] = useState([])
  const [viewMode, setViewMode] = useState("kanban")
  const [form, setForm] = useState({ order_id:"", factory_id:"", notes:"", priority:"normal" })
  const [submitting, setSubmitting] = useState(false)
  const [selectedMO, setSelectedMO] = useState(null)
  const [workOrders, setWorkOrders] = useState([])
  const [calendarEvents, setCalendarEvents] = useState([])
  const [splitQty, setSplitQty] = useState("")
  const [mergeParentId, setMergeParentId] = useState("")
  const [searchTerm, setSearchTerm] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const perPage = 10

  async function load() {
    try {
      const res = await fetch(API, { headers: authHeaders() })
      setOrders(res.ok ? await res.json() : [])
    } catch {}
  }

  async function loadCalendar() {
    const res = await fetch(API + "/calendar", { headers: authHeaders() })
    setCalendarEvents(res.ok ? await res.json() : [])
  }

  useEffect(() => { if (ready && user) { load(); loadCalendar() } }, [ready, user])

  async function loadWorkOrders(moId) {
    const res = await fetch(`${WO_API}?manufacturing_order_id=${moId}`, { headers: authHeaders() })
    setWorkOrders(res.ok ? await res.json() : [])
    setSelectedMO(moId)
  }

  async function createOrder(e) {
    e.preventDefault(); setSubmitting(true)
    try {
      const payload = { ...form, order_id: Number(form.order_id), factory_id: Number(form.factory_id) }
      const res = await fetch(API, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) })
      if (!res.ok) throw new Error(await res.text())
      setForm({ order_id:"", factory_id:"", notes:"", priority:"normal" })
      load()
    } catch(err) { alert(err.message) } finally { setSubmitting(false) }
  }

  async function changeStatus(moId, newStatus) {
    await fetch(`${API}/${moId}/status`, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify({status:newStatus}) })
    load()
  }

  async function produceAll(moId) {
    await fetch(`${API}/${moId}/produce-all-safe`, { method:"POST", headers: authHeaders() })
    load()
  }

  async function splitMO(moId) {
    if (!splitQty) return alert("ادخل الكمية")
    await fetch(`${API}/${moId}/split?quantity=${splitQty}`, { method:"POST", headers: authHeaders() })
    setSplitQty("")
    load()
  }

  async function mergeMO(childId) {
    if (!mergeParentId) return alert("ادخل ID الأمر الأب")
    await fetch(`${API}/${mergeParentId}/merge/${childId}`, { method:"POST", headers: authHeaders() })
    setMergeParentId("")
    load()
  }

  const filtered = orders.filter(o => {
    const s = searchTerm.toLowerCase()
    return (o.order_number||"").toLowerCase().includes(s) || String(o.id).includes(s) || (o.factory_name||"").toLowerCase().includes(s)
  })
  const totalPages = Math.ceil(filtered.length / perPage)
  const paged = filtered.slice((currentPage-1)*perPage, currentPage*perPage)

  const kpi = {
    total: orders.length,
    inProgress: orders.filter(o=>o.status==="in_progress").length,
    done: orders.filter(o=>o.status==="done").length,
    cancelled: orders.filter(o=>o.status==="cancelled").length,
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">تحميل...</div></main>

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Manufacturing Orders</div><h2>أوامر التصنيع</h2><p>إدارة الإنتاج.</p></div></section>
        <section className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">الإجمالي</div><div className="erp-card-value">{kpi.total}</div></div>
          <div className="erp-card"><div className="erp-card-title">قيد التنفيذ</div><div className="erp-card-value">{kpi.inProgress}</div></div>
          <div className="erp-card"><div className="erp-card-title">مكتمل</div><div className="erp-card-value">{kpi.done}</div></div>
          <div className="erp-card"><div className="erp-card-title">ملغي</div><div className="erp-card-value">{kpi.cancelled}</div></div>
        </section>
        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <h3>إنشاء أمر تصنيع</h3>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={createOrder}>
            <input className="erp-input" type="number" placeholder="رقم الطلب" value={form.order_id} onChange={e=>setForm({...form,order_id:e.target.value})} required />
            <input className="erp-input" type="number" placeholder="المصنع" value={form.factory_id} onChange={e=>setForm({...form,factory_id:e.target.value})} required />
            <textarea className="erp-input" placeholder="ملاحظات" value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} />
            <select className="erp-input" value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})}>
              <option value="low">منخفض</option><option value="normal">عادي</option><option value="high">عالي</option><option value="urgent">عاجل</option>
            </select>
            <button className="erp-btn-primary" type="submit" disabled={submitting}>إنشاء</button>
          </form>
        </div>
        <div className="erp-section-card">
          <div className="erp-section-head"><h3>الأوامر</h3>
            <div style={{display:"flex",gap:"8px", flexWrap:"wrap", alignItems:"center"}}>
              <input className="erp-input" placeholder="بحث..." value={searchTerm} onChange={e=>{setSearchTerm(e.target.value); setCurrentPage(1)}} style={{width:200}} />
              <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")}>Kanban</button>
              <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")}>جدول</button>
              <button className={viewMode==="calendar"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("calendar")}>تقويم</button>
            </div>
          </div>
          {viewMode==="table" && (
            <>
              <div className="erp-table-shell">
                <table className="erp-table">
                  <thead><tr><th>ID</th><th>الطلب</th><th>المصنع</th><th>الحالة</th><th>الكمية</th><th>إجراءات</th></tr></thead>
                  <tbody>
                    {paged.map(o=><tr key={o.id}><td>{o.id}</td><td>{o.order_number||o.order_id}</td><td>{o.factory_name||o.factory_id}</td><td>{STATUS_LABELS[o.status]||o.status}</td><td>{o.product_qty||1}</td>
                    <td>
                      <button onClick={()=>produceAll(o.id)} style={{fontSize:"11px",padding:"2px 6px",margin:"2px"}}>Produce</button>
                      <button onClick={()=>loadWorkOrders(o.id)} style={{fontSize:"11px",padding:"2px 6px",margin:"2px"}}>WO</button>
                      <input type="number" placeholder="كمية" style={{width:55,fontSize:"11px"}} onChange={e=>setSplitQty(e.target.value)} />
                      <button onClick={()=>splitMO(o.id)} style={{fontSize:"11px",padding:"2px 6px",margin:"2px"}}>Split</button>
                      <input type="number" placeholder="أب ID" style={{width:55,fontSize:"11px"}} onChange={e=>setMergeParentId(e.target.value)} />
                      <button onClick={()=>mergeMO(o.id)} style={{fontSize:"11px",padding:"2px 6px",margin:"2px"}}>Merge</button>
                    </td></tr>)}
                  </tbody>
                </table>
              </div>
              <div style={{marginTop:12, display:"flex", gap:8}}>
                <button disabled={currentPage===1} onClick={()=>setCurrentPage(p=>p-1)} className="erp-btn-secondary">← السابق</button>
                <span style={{fontWeight:800}}>{currentPage} من {totalPages}</span>
                <button disabled={currentPage===totalPages} onClick={()=>setCurrentPage(p=>p+1)} className="erp-btn-secondary">التالي →</button>
              </div>
            </>
          )}
          {viewMode==="kanban" && (
            <KanbanBoard
              items={orders}
              statusField="status"
              statusOptions={STATUS_OPTIONS}
              statusLabels={STATUS_LABELS}
              statusColors={STATUS_COLORS}
              renderCard={renderCard}
              onAction={(mo)=>(
                <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
                  {Object.keys(STATUS_LABELS).filter(s=>s!==mo.status).map(s=><button key={s} style={{fontSize:"10px",padding:"2px 6px"}} onClick={()=>changeStatus(mo.id,s)}>{STATUS_LABELS[s]}</button>)}
                  <button style={{fontSize:"10px"}} onClick={()=>produceAll(mo.id)}>✅ Produce</button>
                  <button style={{fontSize:"10px"}} onClick={()=>loadWorkOrders(mo.id)}>WO</button>
                </div>
              )}
            />
          )}
          {viewMode==="calendar" && (
            <div style={{ padding: 10 }}>
              <h3>التقويم</h3>
              <GanttChart items={calendarEvents.map(ev=>({id:ev.id, title:ev.title, start:ev.start, end:ev.end, color: STATUS_COLORS[ev.status] || "#3b82f6"}))} />
            </div>
          )}
        </div>
        {selectedMO && (
          <div className="erp-section-card">
            <h3>أوامر العمل للطلب #{selectedMO}</h3>
            <table className="erp-table"><thead><tr><th>ID</th><th>محطة العمل</th><th>الحالة</th></tr></thead><tbody>
              {workOrders.map(wo=><tr key={wo.id}><td>{wo.id}</td><td>{wo.workcenter_id||"-"}</td><td>{wo.state}</td></tr>)}
            </tbody></table>
          </div>
        )}
      </section>
    </main>
  );
}
