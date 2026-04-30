"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";

const EQUIP_URL = "https://api.royalpalace-group.com/api/v1/admin/maintenance/equipment";
const REPAIR_URL = "https://api.royalpalace-group.com/api/v1/admin/maintenance/repairs";

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };
const STATUSES = ["operational","maintenance","broken"];
const STATUS_LABELS = { operational:"تشغيلي", maintenance:"صيانة", broken:"معطل" };
const STATUS_COLORS = { operational:"#10b981", maintenance:"#f59e0b", broken:"#ef4444" };
const PRIORITIES = ["low","normal","high","urgent"];

function renderEquipmentCard(e) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:"14px" }}>{e.name}</div>
      <div style={{ fontSize:"12px", color:"var(--rp-text-muted)" }}>{e.code||"-"}</div>
      <div style={{ fontSize:"11px", color:"var(--rp-text-soft)" }}>مصنع #{e.factory_id||"-"}</div>
    </div>
  );
}

export default function MaintenancePage() {
  const { user, ready } = useAdminAuth("maintenance");
  const [equipment, setEquipment] = useState([]);
  const [repairs, setRepairs] = useState([]);
  const [message, setMessage] = useState("");
  const [equipForm, setEquipForm] = useState({ name:"", code:"" });
  const [repairForm, setRepairForm] = useState({ equipment_id:"", description:"", priority:"normal" });
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("kanban");

  // إضافة items لتفادي خطأ reference
  const items = [];

  async function loadAll() { try { const [equipRes, repairRes] = await Promise.all([fetch(EQUIP_URL, { headers: authHeaders() }), fetch(REPAIR_URL, { headers: authHeaders() })]); setEquipment(equipRes.ok ? await equipRes.json() : []); setRepairs(repairRes.ok ? await repairRes.json() : []); } catch (err) { setMessage("تعذر التحميل"); } }
  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);
  async function handleCreateEquipment(e) { e.preventDefault(); setSubmitting(true); try { const res = await fetch(EQUIP_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(equipForm) }); if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء"); setEquipForm({ name:"", code:"" }); loadAll(); } catch (err) { setMessage(err.message); } finally { setSubmitting(false); } }
  async function handleCreateRepair(e) { e.preventDefault(); setSubmitting(true); try { const payload = { ...repairForm, equipment_id: Number(repairForm.equipment_id) }; const res = await fetch(REPAIR_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) }); if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء"); setRepairForm({ equipment_id:"", description:"", priority:"normal" }); loadAll(); } catch (err) { setMessage(err.message); } finally { setSubmitting(false); } }
  async function deleteEquipment(id) { if (!confirm("حذف المعدة؟")) return; await fetch(`${EQUIP_URL}/${id}`,{method:"DELETE",headers:authHeaders()}); loadAll(); }
  async function deleteRepair(id) { if (!confirm("حذف طلب الصيانة؟")) return; await fetch(`${REPAIR_URL}/${id}`,{method:"DELETE",headers:authHeaders()}); loadAll(); }
  function handleExportEquipCsv() { exportTableCsv("equipment.csv", ["الاسم","الكود","الحالة","المصنع","الوصف"], equipment.map((e) => [e.name, e.code, e.status, e.factory_id||"", e.description||""])); }
  function handleExportEquipPdf() { exportTablePdf("تقرير المعدات","الصيانة",[{ label:"عدد المعدات", value:equipment.length }], ["الاسم","الكود","الحالة","المصنع","الوصف"], equipment.map((e) => [e.name, e.code, e.status, e.factory_id||"", e.description||""])); }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Maintenance</div><h2>الصيانة</h2><p>إدارة المعدات وطلبات الصيانة والإصلاح.</p></div><div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">معدات</div><div className="erp-stat-box-value">{equipment.length}</div></div><div className="erp-stat-box"><div className="erp-stat-box-label">طلبات صيانة</div><div className="erp-stat-box-value">{repairs.length}</div></div></div></section>
        <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">إجمالي السجلات</div><div className="erp-card-value">{items?.length || 0}</div></div><div className="erp-card"><div className="erp-card-title">نشط</div><div className="erp-card-value">{items?.filter(i=>i.is_active!==false).length || 0}</div></div></section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom:"18px" }}>
          <div className="erp-section-card"><h3>إضافة معدة جديدة</h3><form className="erp-form-grid" onSubmit={handleCreateEquipment}><input className="erp-input" placeholder="اسم المعدة" value={equipForm.name} onChange={(e)=>setEquipForm({...equipForm,name:e.target.value})} required /><input className="erp-input" placeholder="الكود" value={equipForm.code} onChange={(e)=>setEquipForm({...equipForm,code:e.target.value})} required /><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":"إضافة"}</button></div></form></div>
          <div className="erp-section-card"><h3>طلب صيانة جديد</h3><form className="erp-form-grid" onSubmit={handleCreateRepair}><select className="erp-input" value={repairForm.equipment_id} onChange={(e)=>setRepairForm({...repairForm,equipment_id:e.target.value})} required><option value="">اختر المعدة</option>{equipment.map((e)=><option key={e.id} value={e.id}>{e.name} ({e.code})</option>)}</select><textarea className="erp-input" rows="3" placeholder="وصف العطل" value={repairForm.description} onChange={(e)=>setRepairForm({...repairForm,description:e.target.value})} required /><select className="erp-input" value={repairForm.priority} onChange={(e)=>setRepairForm({...repairForm,priority:e.target.value})}>{PRIORITIES.map((p)=><option key={p} value={p}>{p}</option>)}</select><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":"إنشاء الطلب"}</button></div></form></div>
        </div>
        <div className="erp-form-grid erp-form-grid-2">
          <div className="erp-section-card">
            <div className="erp-section-head"><h3>المعدات</h3>
              <div style={{display:"flex",gap:"8px"}}>
                <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={topButtonStyle}>Kanban</button>
                <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={topButtonStyle}>جدول</button>
                <button className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportEquipCsv}>CSV</button>
                <button className="erp-btn-primary" style={topButtonStyle} onClick={handleExportEquipPdf}>PDF</button>
              </div>
            </div>
            {viewMode==="table" && (
              <div className="erp-table-shell">
                <table className="erp-table">
                  <thead><tr><th>ID</th><th>الاسم</th><th>الكود</th><th>الحالة</th><th>إجراءات</th></tr></thead>
                  <tbody>
                    {equipment.length === 0 ? (
                      <tr><td colSpan="5">لا توجد معدات.</td></tr>
                    ) : (
                      equipment.map((e) => (
                        <tr key={e.id}>
                          <td>{e.id}</td>
                          <td>{e.name}</td>
                          <td>{e.code}</td>
                          <td>{e.status}</td>
                          <td><button className="erp-btn-danger" onClick={() => deleteEquipment(e.id)}>حذف</button></td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            {viewMode==="kanban" && (
              <KanbanBoard items={equipment} statusField="status" statusOptions={STATUSES} statusLabels={STATUS_LABELS} statusColors={STATUS_COLORS}
                renderCard={renderEquipmentCard}
                onAction={(e)=>(<button className="erp-btn-danger" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>deleteEquipment(e.id)}>حذف</button>)}
                emptyMessage="لا توجد معدات" />
            )}
          </div>
          <div className="erp-section-card">
            <div className="erp-section-head"><h3>طلبات الصيانة</h3></div>
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead><tr><th>ID</th><th>المعدة</th><th>الوصف</th><th>الأولوية</th><th>الحالة</th><th>إجراءات</th></tr></thead>
                <tbody>
                  {repairs.length === 0 ? (
                    <tr><td colSpan="6">لا توجد طلبات.</td></tr>
                  ) : (
                    repairs.map((r) => (
                      <tr key={r.id}>
                        <td>{r.id}</td>
                        <td>{equipment.find((e)=>e.id===r.equipment_id)?.name||"-"}</td>
                        <td>{r.description||"-"}</td>
                        <td>{r.priority}</td>
                        <td>{r.status}</td>
                        <td><button className="erp-btn-danger" onClick={()=>deleteRepair(r.id)}>حذف</button></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
