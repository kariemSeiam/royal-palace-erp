"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import KanbanBoard from "../components/KanbanBoard";

const REQUESTS_URL = "https://api.royalpalace-group.com/api/v1/admin/maker-checker/requests";
const SUMMARY_URL = "https://api.royalpalace-group.com/api/v1/admin/maker-checker/summary";

const STATUSES = ["pending","approved","rejected","overridden"];
const STATUS_LABELS = { pending:"معلق", approved:"معتمد", rejected:"مرفوض", overridden:"متجاوز" };
const STATUS_COLORS = { pending:"#f59e0b", approved:"#10b981", rejected:"#ef4444", overridden:"#8b5cf6" };

function renderApprovalCard(r) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:"14px" }}>{r.title||"-"}</div>
      <div style={{ fontSize:"12px", color:"var(--rp-text-muted)" }}>{r.request_type||"-"}</div>
      <div style={{ fontSize:"11px", color:"var(--rp-text-soft)" }}>مقدم من: {r.requested_by_name||"-"}</div>
    </div>
  );
}

export default function ApprovalsPage() {
  const { user, ready } = useAdminAuth("it");
  const [requests, setRequests] = useState([]);
  const [summary, setSummary] = useState({});
  const [message, setMessage] = useState("");
  const [actionLoading, setActionLoading] = useState(null);
  const [viewMode, setViewMode] = useState("kanban");

  async function loadAll() { try { const [reqRes, sumRes] = await Promise.all([fetch(REQUESTS_URL, { headers: authHeaders() }), fetch(SUMMARY_URL, { headers: authHeaders() })]); setRequests(reqRes.ok ? await reqRes.json() : []); setSummary(sumRes.ok ? await sumRes.json() : {}); } catch (err) { setMessage("تعذر التحميل"); } }
  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  async function handleAction(requestId, action) { setActionLoading(`${requestId}:${action}`); setMessage(""); try { const res = await fetch(`${REQUESTS_URL}/${requestId}/${action}`, { method: "POST", headers: authHeaders() }); const data = await res.json().catch(() => ({})); if (!res.ok) throw new Error(data.detail || "فشل الإجراء"); setMessage(`تم ${action === "approve" ? "اعتماد" : action === "reject" ? "رفض" : "تجاوز"} الطلب رقم ${requestId}`); loadAll(); } catch (err) { setMessage(err.message); } finally { setActionLoading(null); } }


  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Approvals</div><h2>الموافقات</h2><p>مركز إدارة طلبات الموافقة والاعتماد المزدوج.</p></div><div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">معلقة</div><div className="erp-stat-box-value">{summary.pending_count || 0}</div></div><div className="erp-stat-box"><div className="erp-stat-box-label">معتمدة</div><div className="erp-stat-box-value">{summary.approved_count || 0}</div></div></div></section>
        <section className="erp-kpi-grid" style={{ marginBottom:"18px" }}><div className="erp-card"><div className="erp-card-title">معلقة</div><div className="erp-card-value">{summary.pending_count || 0}</div></div><div className="erp-card"><div className="erp-card-title">معتمدة</div><div className="erp-card-value">{summary.approved_count || 0}</div></div><div className="erp-card"><div className="erp-card-title">مرفوضة</div><div className="erp-card-value">{summary.rejected_count || 0}</div></div></section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card">
          <div className="erp-section-head"><h3>طلبات الموافقة</h3>
            <div style={{display:"flex",gap:"8px"}}>
              <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={{minHeight:"38px",borderRadius:"12px",padding:"0 14px",fontWeight:800}}>Kanban</button>
              <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={{minHeight:"38px",borderRadius:"12px",padding:"0 14px",fontWeight:800}}>جدول</button>
            </div>
          </div>
          {viewMode==="table" && (
          <div className="erp-table-shell"><table className="erp-table"><thead><tr><th>ID</th><th>النوع</th><th>العنوان</th><th>مقدم الطلب</th><th>المدقق</th><th>الحالة</th><th>إجراءات</th></tr></thead><tbody>{requests.length === 0 ? <tr><td colSpan="7">لا توجد طلبات موافقة.</td></tr> : requests.map((r) => (<tr key={r.id}><td>{r.id}</td><td>{r.request_type || "-"}</td><td>{r.title || "-"}</td><td>{r.requested_by_name || "-"}</td><td>{r.assigned_checker_name || "-"}</td><td><span className={`erp-badge ${r.status === "approved" ? "success" : r.status === "rejected" ? "warning" : ""}`}>{r.status}</span></td><td>{r.status === "pending" ? (<div style={{ display:"flex", gap:"6px" }}><button className="erp-btn-primary" disabled={!!actionLoading} onClick={() => handleAction(r.id, "approve")}>اعتماد</button><button className="erp-btn-danger" disabled={!!actionLoading} onClick={() => handleAction(r.id, "reject")}>رفض</button><button className="erp-btn-secondary" disabled={!!actionLoading} onClick={() => handleAction(r.id, "override")}>تجاوز</button></div>) : null}</td></tr>))}</tbody></table></div>)}
          {viewMode==="kanban" && (
            <KanbanBoard items={requests} statusField="status" statusOptions={STATUSES} statusLabels={STATUS_LABELS} statusColors={STATUS_COLORS}
              renderCard={renderApprovalCard}
              onAction={(r)=>r.status==="pending"?(<><button className="erp-btn-primary" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>handleAction(r.id,"approve")}>اعتماد</button><button className="erp-btn-danger" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>handleAction(r.id,"reject")}>رفض</button><button className="erp-btn-secondary" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>handleAction(r.id,"override")}>تجاوز</button></>):null}
              emptyMessage="لا توجد طلبات" />
          )}
        </div>
      </section>
    </main>
  );
}
