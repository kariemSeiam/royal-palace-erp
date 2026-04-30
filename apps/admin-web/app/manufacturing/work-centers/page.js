"use client";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";
import KanbanBoard from "../../components/KanbanBoard";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/work-centers";
const FACTORIES_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";

export default function WorkCentersPage() {
  const { user, ready } = useAdminAuth("workcenter");
  const [items, setItems] = useState([]);
  const [factories, setFactories] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({ factory_id:"", name:"", code:"", capacity_per_day:"", time_efficiency:"100", hourly_cost:"", hourly_overhead:"", costs_hour_account_id:"", resource_calendar_id:"", time_start:"08:00", time_end:"17:00", notes:"" });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("table");

  async function loadData() { try { const [itemsRes, factoriesRes] = await Promise.all([fetch(API_URL, { headers: authHeaders() }), fetch(FACTORIES_URL, { headers: authHeaders() })]); setItems(itemsRes.ok ? await itemsRes.json() : []); setFactories(factoriesRes.ok ? await factoriesRes.json() : []); } catch (e) { setMessage("تعذر التحميل"); } }
  useEffect(() => { if (ready && user) loadData(); }, [ready, user]);

  const filtered = useMemo(() => { const q = search.toLowerCase(); return q ? items.filter(i => JSON.stringify(i).toLowerCase().includes(q)) : items; }, [items, search]);
  const stats = useMemo(() => ({ total: items.length, active: items.filter(i => i.is_active).length }), [items]);

  function resetForm() { setForm({ factory_id:"", name:"", code:"", capacity_per_day:"", time_efficiency:"100", hourly_cost:"", hourly_overhead:"", costs_hour_account_id:"", resource_calendar_id:"", time_start:"08:00", time_end:"17:00", notes:"" }); setEditingId(null); }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const body = { factory_id: Number(form.factory_id), name: form.name, code: form.code, capacity_per_day: Number(form.capacity_per_day)||0, time_efficiency: Number(form.time_efficiency)||100, hourly_cost: Number(form.hourly_cost)||0, hourly_overhead: Number(form.hourly_overhead)||0, costs_hour_account_id: form.costs_hour_account_id?Number(form.costs_hour_account_id):null, resource_calendar_id: form.resource_calendar_id?Number(form.resource_calendar_id):null, time_start: form.time_start, time_end: form.time_end, notes: form.notes };
      const method = editingId ? "PUT" : "POST";
      const url = editingId ? `${API_URL}/${editingId}` : API_URL;
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(body) });
      if (!res.ok) throw new Error("فشل الحفظ");
      setMessage(editingId ? "تم التحديث" : "تم الإنشاء");
      resetForm(); loadData();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function handleDelete(id) { if (!confirm("حذف محطة العمل؟")) return; await fetch(`${API_URL}/${id}`, { method: "DELETE", headers: authHeaders() }); loadData(); }

  function handleCsv() { exportTableCsv("work_centers.csv", ["المصنع","الاسم","الكود","طاقة/يوم","كفاءة وقت %","تكلفة/س","تكلفة إضافية/س","حساب التكلفة","تقويم الموارد"], filtered.map(i => [i.factory_name||"", i.name, i.code, i.capacity_per_day, i.time_efficiency+"%", i.hourly_cost, i.hourly_overhead, i.costs_hour_account_id||"", i.resource_calendar_id||""])); }
  function handlePdf() { exportTablePdf("تقرير محطات العمل", "التصنيع / محطات العمل", [{ label: "عدد المحطات", value: stats.total }, { label: "نشطة", value: stats.active }], ["المصنع","الاسم","الكود","طاقة/يوم","كفاءة وقت %","تكلفة/س","تكلفة إضافية/س","حساب التكلفة","تقويم الموارد"], filtered.map(i => [i.factory_name||"", i.name, i.code, i.capacity_per_day, i.time_efficiency+"%", i.hourly_cost, i.hourly_overhead, i.costs_hour_account_id||"", i.resource_calendar_id||""])); }


  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <section className="erp-hero"><div><div className="erp-hero-pill">التصنيع / محطات العمل</div><h2>محطات العمل</h2><p>إدارة محطات العمل والطاقة الإنتاجية والتكاليف.</p></div></section>
      <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">إجمالي المحطات</div><div className="erp-card-value">{stats.total}</div></div><div className="erp-card"><div className="erp-card-title">نشطة</div><div className="erp-card-value">{stats.active}</div></div></section>
      {message && <div className="erp-form-message">{message}</div>}
      <div className="erp-section-card" style={{ marginBottom: 18 }}>
        <h3>{editingId ? "تعديل محطة عمل" : "محطة عمل جديدة"}</h3>
        <form className="erp-form-grid" onSubmit={handleSubmit}>
          <select className="erp-input" value={form.factory_id} onChange={e => setForm({ ...form, factory_id: e.target.value })} required><option value="">اختر المصنع</option>{factories.map(f => <option key={f.id} value={f.id}>{f.name}</option>)}</select>
          <input className="erp-input" placeholder="اسم المحطة" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} required />
          <input className="erp-input" placeholder="الكود" value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} required />
          <input className="erp-input" type="number" step="0.01" placeholder="الطاقة اليومية" value={form.capacity_per_day} onChange={e => setForm({ ...form, capacity_per_day: e.target.value })} />
          <input className="erp-input" type="number" step="0.01" placeholder="كفاءة الوقت %" value={form.time_efficiency} onChange={e => setForm({ ...form, time_efficiency: e.target.value })} />
          <input className="erp-input" type="number" step="0.0001" placeholder="تكلفة الساعة" value={form.hourly_cost} onChange={e => setForm({ ...form, hourly_cost: e.target.value })} />
          <input className="erp-input" type="number" step="0.0001" placeholder="تكلفة إضافية/ساعة" value={form.hourly_overhead} onChange={e => setForm({ ...form, hourly_overhead: e.target.value })} />
          <input className="erp-input" type="number" placeholder="معرف حساب التكلفة" value={form.costs_hour_account_id} onChange={e => setForm({ ...form, costs_hour_account_id: e.target.value })} />
          <input className="erp-input" type="number" placeholder="تقويم الموارد" value={form.resource_calendar_id} onChange={e => setForm({ ...form, resource_calendar_id: e.target.value })} />
          <input className="erp-input" type="time" value={form.time_start} onChange={e => setForm({ ...form, time_start: e.target.value })} />
          <input className="erp-input" type="time" value={form.time_end} onChange={e => setForm({ ...form, time_end: e.target.value })} />
          <textarea className="erp-input" rows="2" placeholder="ملاحظات" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
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
        {viewMode==="table" && (<div className="erp-table-shell"><table className="erp-table"><thead><tr><th>#</th><th>المصنع</th><th>الاسم</th><th>الكود</th><th>طاقة/يوم</th><th>كفاءة وقت %</th><th>تكلفة/س</th><th>تكلفة إضافية</th><th>حساب التكلفة</th><th>التقويم</th><th>حالة</th><th>إجراءات</th></tr></thead><tbody>{filtered.map(item => (<tr key={item.id}><td>{item.id}</td><td>{item.factory_name||"-"}</td><td>{item.name}</td><td>{item.code}</td><td>{item.capacity_per_day}</td><td>{item.time_efficiency}%</td><td>{item.hourly_cost}</td><td>{item.hourly_overhead}</td><td>{item.costs_hour_account_id||"-"}</td><td>{item.resource_calendar_id||"-"}</td><td><span className={`erp-badge ${item.is_active?"success":"warning"}`}>{item.is_active?"نشط":"غير نشط"}</span></td><td><button className="erp-btn-secondary" style={{ marginInlineEnd:6 }} onClick={()=>{ setEditingId(item.id); setForm({...item, factory_id:String(item.factory_id)}) }}>تعديل</button><button className="erp-btn-danger" onClick={()=>handleDelete(item.id)}>حذف</button></td></tr>))}</tbody></table></div>)}
        {viewMode==="kanban" && <KanbanBoard items={filtered} statusField="is_active" statusOptions={[true,false]} statusLabels={{true:"نشط",false:"غير نشط"}} statusColors={{true:"#10b981",false:"#6b7280"}} renderCard={item => <div><div style={{fontWeight:900}}>{item.name}</div><div>{item.code}</div><div>طاقة: {item.capacity_per_day}</div><div>تكلفة إضافية: {item.hourly_overhead}</div><div>حساب التكلفة: {item.costs_hour_account_id||"-"}</div></div>} onAction={item => <><button className="erp-btn-secondary" style={{fontSize:11,padding:"4px 8px"}} onClick={()=>{setEditingId(item.id);setForm({...item,factory_id:String(item.factory_id)})}}>تعديل</button><button className="erp-btn-danger" style={{fontSize:11,padding:"4px 8px"}} onClick={()=>handleDelete(item.id)}>حذف</button></>} emptyMessage="لا توجد محطات عمل" />}
      </div>
    </section></main>
  );
}
