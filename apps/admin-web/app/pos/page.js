"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";

const SESS_URL = "https://api.royalpalace-group.com/api/v1/admin/pos/sessions";
const ORDERS_URL = "https://api.royalpalace-group.com/api/v1/admin/pos/orders";
const PAYMENTS_URL = "https://api.royalpalace-group.com/api/v1/admin/pos/payment-methods";

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

export default function PosPage() {
  const { user, ready } = useAdminAuth("pos");
  const [sessions, setSessions] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [message, setMessage] = useState("");

  async function loadAll() {
    try {
      const [sessRes, ordRes, payRes] = await Promise.all([
        fetch(SESS_URL, { headers: authHeaders() }),
        fetch(ORDERS_URL, { headers: authHeaders() }),
        fetch(PAYMENTS_URL, { headers: authHeaders() }),
      ]);
      setSessions(sessRes.ok ? await sessRes.json() : []);
      setOrders(ordRes.ok ? await ordRes.json() : []);
      setPayments(payRes.ok ? await payRes.json() : []);
    } catch (err) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  function handleExportCsv() {
    exportTableCsv("pos_orders.csv", ["رقم الطلب","العميل","المبلغ","الحالة","طريقة الدفع"], orders.map((o) => [o.id, o.customer_name || "", o.total_amount, o.state, payments.find((p) => p.id === o.payment_method_id)?.name || ""]));
  }
  function handleExportPdf() {
    exportTablePdf("تقرير مبيعات POS", "نقاط البيع", [{ label: "عدد الطلبات", value: orders.length }], ["رقم الطلب","العميل","المبلغ","الحالة","طريقة الدفع"], orders.map((o) => [o.id, o.customer_name || "", o.total_amount, o.state, payments.find((p) => p.id === o.payment_method_id)?.name || ""]));
  }


  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">Point of Sale</div><h2>نقاط البيع</h2><p>إدارة جلسات البيع والطلبات وطرق الدفع.</p></div>
          <div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">جلسات</div><div className="erp-stat-box-value">{sessions.length}</div></div><div className="erp-stat-box"><div className="erp-stat-box-label">طلبات</div><div className="erp-stat-box-value">{orders.length}</div></div></div>
        </section>
        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">جلسات</div><div className="erp-card-value">{sessions.length}</div></div>
          <div className="erp-card"><div className="erp-card-title">طلبات</div><div className="erp-card-value">{orders.length}</div></div>
          <div className="erp-card"><div className="erp-card-title">طرق دفع</div><div className="erp-card-value">{payments.length}</div></div>
        </section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head"><h3>جلسات البيع</h3></div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead><tr><th>ID</th><th>الاسم</th><th>المصنع</th><th>الحالة</th><th>فتحت</th><th>أغلقت</th></tr></thead>
              <tbody>{sessions.length === 0 ? <tr><td colSpan="6">لا توجد جلسات.</td></tr> : sessions.map((s) => (<tr key={s.id}><td>{s.id}</td><td>{s.name}</td><td>{s.factory_id || "-"}</td><td>{s.state}</td><td>{s.opened_at || "-"}</td><td>{s.closed_at || "-"}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
        <div className="erp-section-card">
          <div className="erp-section-head">
            <h3>الطلبات</h3>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><button className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button><button className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button></div>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead><tr><th>ID</th><th>العميل</th><th>المبلغ</th><th>الحالة</th><th>طريقة الدفع</th><th>التاريخ</th></tr></thead>
              <tbody>{orders.length === 0 ? <tr><td colSpan="6">لا توجد طلبات.</td></tr> : orders.slice(0,30).map((o) => (<tr key={o.id}><td>{o.id}</td><td>{o.customer_name || "-"}</td><td>{o.total_amount}</td><td>{o.state}</td><td>{payments.find((p) => p.id === o.payment_method_id)?.name || "-"}</td><td>{new Date(o.created_at).toLocaleString("ar-EG")}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
