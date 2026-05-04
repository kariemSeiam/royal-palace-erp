"use client";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import KanbanBoard from "../../components/KanbanBoard";

const API = "https://api.royalpalace-group.com/api/v1/admin/mrp/work-orders";

const WO_STATES = ["pending","in_progress","done","cancelled"];
const WO_STATE_LABELS = { pending:"معلق", in_progress:"قيد التنفيذ", done:"مكتمل", cancelled:"ملغي" };
const WO_STATE_COLORS = { pending:"#6b7280", in_progress:"#f59e0b", done:"#10b981", cancelled:"#ef4444" };

function renderWOCard(wo) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:14 }}>{wo.step_name || `WO #${wo.id}`}</div>
      <div style={{ fontSize:12, color:"var(--rp-text-muted)" }}>{wo.workcenter_name || "-"}</div>
      <div style={{ fontSize:11 }}>البدء: {wo.actual_start_at ? new Date(wo.actual_start_at).toLocaleTimeString("ar-EG") : "—"}</div>
      <div style={{ fontSize:11 }}>المدة: {wo.duration_minutes ? wo.duration_minutes + " دقيقة" : "—"}</div>
    </div>
  );
}

export default function WorkOrdersPage() {
  const { user, ready } = useAdminAuth("work_orders");
  const [workOrders, setWorkOrders] = useState([]);
  const [selectedMO, setSelectedMO] = useState("");
  const [message, setMessage] = useState("");

  async function load() {
    if (!selectedMO) return;
    try {
      const res = await fetch(`${API}?manufacturing_order_id=${selectedMO}`, { headers: authHeaders() });
      setWorkOrders(res.ok ? await res.json() : []);
    } catch { setMessage("فشل التحميل"); }
  }

  async function updateState(woId, newState) {
    const body = { state: newState };
    if (newState === "in_progress") body.actual_start_at = new Date().toISOString();
    if (newState === "done") body.actual_end_at = new Date().toISOString();
    await fetch(`${API}/${woId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify(body)
    });
    load();
  }

  useEffect(() => { if (ready && user && selectedMO) load(); }, [ready, user, selectedMO]);

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">تحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Work Orders</div><h2>أوامر العمل</h2><p>إدارة مهام الإنتاج.</p></div></section>
        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <h3>اختر أمر التصنيع</h3>
          <input className="erp-input" type="number" placeholder="معرف أمر التصنيع" value={selectedMO} onChange={e => setSelectedMO(e.target.value)} />
        </div>
        {message && <div className="erp-form-message">{message}</div>}
        <div className="erp-section-card">
          <KanbanBoard
            items={workOrders}
            statusField="state"
            statusOptions={WO_STATES}
            statusLabels={WO_STATE_LABELS}
            statusColors={WO_STATE_COLORS}
            renderCard={renderWOCard}
            onAction={(wo) => (
              <div style={{display:"flex",gap:"4px",flexWrap:"wrap"}}>
                {Object.keys(WO_STATE_LABELS).filter(s => s !== wo.state).map(s => (
                  <button key={s} style={{fontSize:"10px",padding:"2px 6px"}} onClick={() => updateState(wo.id, s)}>
                    {WO_STATE_LABELS[s]}
                  </button>
                ))}
              </div>
            )}
            emptyMessage="لا توجد أوامر عمل"
          />
        </div>
      </section>
    </main>
  );
}
