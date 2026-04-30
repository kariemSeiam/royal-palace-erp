"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";

const AUDIT_SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/audit/summary";
const AUDIT_RECENT_API_URL = "https://api.royalpalace-group.com/api/v1/admin/audit/recent";
const AUDIT_ENTITY_HISTORY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/audit/entity-history";
const AUDIT_SURFACES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/audit/surfaces";

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function statusTone(value) {
  if (["success", "approved", "paid", "delivered"].includes(String(value || ""))) return "success";
  if (["warning", "partially_paid", "partially_received", "delivery_dispatched"].includes(String(value || ""))) return "warning";
  return "";
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return value;
  }
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

export default function AuditCenterPage() {
  const { user, ready } = useAdminAuth("it");

  const [summary, setSummary] = useState({});
  const [recent, setRecent] = useState([]);
  const [surfaces, setSurfaces] = useState({
    purchase_orders: [],
    inventory_movements: [],
    sales_quotations: [],
    orders: [],
    sales_invoices: [],
  });
  const [historyEntityType, setHistoryEntityType] = useState("purchase_order");
  const [historyEntityId, setHistoryEntityId] = useState("");
  const [entityHistory, setEntityHistory] = useState([]);
  const [message, setMessage] = useState("");
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function loadAll() {
    const [summaryRes, recentRes, surfacesRes] = await Promise.all([
      fetch(AUDIT_SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(`${AUDIT_RECENT_API_URL}?limit=60`, { headers: authHeaders(), cache: "no-store" }),
      fetch(AUDIT_SURFACES_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);

    const summaryData = await summaryRes.json().catch(() => ({}));
    const recentData = await recentRes.json().catch(() => []);
    const surfacesData = await surfacesRes.json().catch(() => ({}));

    if (!summaryRes.ok) throw new Error(summaryData.detail || "فشل تحميل ملخص السجل");
    if (!recentRes.ok) throw new Error(recentData.detail || "فشل تحميل آخر الأحداث");
    if (!surfacesRes.ok) throw new Error(surfacesData.detail || "فشل تحميل history surfaces");

    setSummary(summaryData?.summary || {});
    setRecent(safeArray(recentData));
    setSurfaces({
      purchase_orders: safeArray(surfacesData?.purchase_orders),
      inventory_movements: safeArray(surfacesData?.inventory_movements),
      sales_quotations: safeArray(surfacesData?.sales_quotations),
      orders: safeArray(surfacesData?.orders),
      sales_invoices: safeArray(surfacesData?.sales_invoices),
    });
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء التحميل"));
  }, [ready, user]);

  const counts = useMemo(() => ({
    purchase_orders: safeArray(surfaces.purchase_orders).length,
    inventory_movements: safeArray(surfaces.inventory_movements).length,
    sales_quotations: safeArray(surfaces.sales_quotations).length,
    orders: safeArray(surfaces.orders).length,
    sales_invoices: safeArray(surfaces.sales_invoices).length,
  }), [surfaces]);

  async function loadEntityHistory() {
    if (!historyEntityType || !historyEntityId) {
      setMessage("اختر نوع الكيان وأدخل ID صحيح");
      return;
    }

    setLoadingHistory(true);
    setMessage("");

    try {
      const res = await fetch(
        `${AUDIT_ENTITY_HISTORY_API_URL}?entity_type=${encodeURIComponent(historyEntityType)}&entity_id=${encodeURIComponent(historyEntityId)}`,
        { headers: authHeaders(), cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحميل تاريخ الكيان");
      setEntityHistory(safeArray(data.history));
      if (!safeArray(data.history).length) {
        setMessage("لا يوجد history لهذا الكيان حالياً");
      }
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء تحميل تاريخ الكيان");
      setEntityHistory([]);
    } finally {
      setLoadingHistory(false);
    }
  }

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل مركز السجل والحوكمة...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">Audit Logs / History Surfaces / Governance Readiness</div>
            <h2>مركز السجل والحوكمة</h2>
            <p>
              طبقة أولى لعرض readiness الحوكمة، history surfaces، وآخر الأحداث المسجلة، مع نقطة بداية واضحة للانتقال لاحقًا إلى audit trail أعمق.
            </p>
            <div className="erp-hero-actions">
              <div className="erp-hero-pill">Audit Logs: {summary.audit_logs_count || 0}</div>
              <div className="erp-hero-pill">Actors: {summary.actors_count || 0}</div>
              <div className="erp-hero-pill">Open Supplier Payables: {formatAmount(summary.open_supplier_payables)}</div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">PO approvals</div>
              <div className="erp-stat-box-value">{summary.po_approved_count || 0}</div>
            </div>
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">Inventory actor rows</div>
              <div className="erp-stat-box-value">{summary.inventory_with_actor || 0}</div>
            </div>
            <div className="erp-hero-visual" />
          </div>
        </section>

        {message ? <div className="erp-form-message" style={{ marginBottom: "16px" }}>{message}</div> : null}

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">Audit logs</div><div className="erp-card-value">{summary.audit_logs_count || 0}</div><div className="erp-card-note">السجل الموحد الحالي</div></div>
          <div className="erp-card"><div className="erp-card-title">Actors</div><div className="erp-card-value">{summary.actors_count || 0}</div><div className="erp-card-note">مشغلون ظاهرون في السجل</div></div>
          <div className="erp-card"><div className="erp-card-title">PO approved</div><div className="erp-card-value">{summary.po_approved_count || 0}</div><div className="erp-card-note">اعتمادات موثقة</div></div>
          <div className="erp-card"><div className="erp-card-title">Inventory actor</div><div className="erp-card-value">{summary.inventory_with_actor || 0}</div><div className="erp-card-note">حركات بعامل</div></div>
          <div className="erp-card"><div className="erp-card-title">Deliveries with actor</div><div className="erp-card-value">{summary.delivery_with_actor || 0}</div><div className="erp-card-note">تسليمات موثقة</div></div>
          <div className="erp-card"><div className="erp-card-title">Open Payables</div><div className="erp-card-value">{formatAmount(summary.open_supplier_payables)}</div><div className="erp-card-note">مستحقات الموردين</div></div>
        </section>

        <div className="erp-form-shell" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head" style={{ marginBottom: "16px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>استدعاء History كيان محدد</h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)" }}>
                استخدم نوع الكيان وID لعرض التاريخ المسجل له من جدول audit_logs.
              </p>
            </div>
          </div>

          <div className="erp-form-grid erp-form-grid-2">
            <div>
              <label className="erp-label">نوع الكيان</label>
              <select className="erp-input" value={historyEntityType} onChange={(e) => setHistoryEntityType(e.target.value)}>
                <option value="purchase_order">purchase_order</option>
                <option value="supplier_invoice">supplier_invoice</option>
                <option value="inventory_movement">inventory_movement</option>
                <option value="sales_invoice">sales_invoice</option>
                <option value="sales_quotation">sales_quotation</option>
                <option value="delivery_note">delivery_note</option>
              </select>
            </div>
            <div>
              <label className="erp-label">Entity ID</label>
              <input className="erp-input" type="number" value={historyEntityId} onChange={(e) => setHistoryEntityId(e.target.value)} />
            </div>
            <div className="erp-form-actions">
              <button type="button" className="erp-btn-primary" onClick={loadEntityHistory} disabled={loadingHistory}>
                {loadingHistory ? "جارٍ التحميل..." : "عرض التاريخ"}
              </button>
            </div>
          </div>
        </div>

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head">
            <div>
              <h3>آخر الأحداث المسجلة</h3>
              <p>قراءة موحدة من audit_logs</p>
            </div>
          </div>
          <div className="erp-table-shell" style={{ overflowX: "auto" }}>
            <table className="erp-table" style={{ minWidth: "1700px" }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>المصنع</th>
                  <th>Actor</th>
                  <th>Module</th>
                  <th>Entity</th>
                  <th>Action</th>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {safeArray(recent).length === 0 ? (
                  <tr><td colSpan="10">لا توجد أحداث مسجلة حالياً.</td></tr>
                ) : (
                  safeArray(recent).map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.factory_name || item.factory_id || "-"}</td>
                      <td>{item.actor_name || item.actor_user_id || "-"}</td>
                      <td>{item.module || "-"}</td>
                      <td>{item.entity_type}{item.entity_id ? ` #${item.entity_id}` : ""}</td>
                      <td><span className={`erp-badge ${statusTone(item.status)}`}>{item.action || "-"}</span></td>
                      <td>{item.title || "-"}</td>
                      <td>{item.description || "-"}</td>
                      <td>{item.reference_type ? `${item.reference_type} #${item.reference_id || ""}` : "-"}</td>
                      <td>{formatDateTime(item.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head">
            <div>
              <h3>Entity History</h3>
              <p>نتيجة الاستدعاء اليدوي للكيان المحدد</p>
            </div>
          </div>
          <div className="erp-table-shell" style={{ overflowX: "auto" }}>
            <table className="erp-table" style={{ minWidth: "1500px" }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Actor</th>
                  <th>Module</th>
                  <th>Action</th>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {safeArray(entityHistory).length === 0 ? (
                  <tr><td colSpan="7">لا يوجد تاريخ ظاهر بعد.</td></tr>
                ) : (
                  safeArray(entityHistory).map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.actor_name || item.actor_user_id || "-"}</td>
                      <td>{item.module || "-"}</td>
                      <td>{item.action || "-"}</td>
                      <td>{item.title || "-"}</td>
                      <td>{item.description || "-"}</td>
                      <td>{formatDateTime(item.created_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">Purchase Orders Surface</div>
            <div className="erp-card-value">{counts.purchase_orders}</div>
            <div className="erp-card-note">عينات تشغيلية</div>
          </div>
          <div className="erp-card">
            <div className="erp-card-title">Inventory Surface</div>
            <div className="erp-card-value">{counts.inventory_movements}</div>
            <div className="erp-card-note">حركات مخزون</div>
          </div>
          <div className="erp-card">
            <div className="erp-card-title">Quotations Surface</div>
            <div className="erp-card-value">{counts.sales_quotations}</div>
            <div className="erp-card-note">مرحلة ما قبل البيع</div>
          </div>
          <div className="erp-card">
            <div className="erp-card-title">Orders Surface</div>
            <div className="erp-card-value">{counts.orders}</div>
            <div className="erp-card-note">طلبات وتسليم</div>
          </div>
          <div className="erp-card">
            <div className="erp-card-title">Sales Invoices Surface</div>
            <div className="erp-card-value">{counts.sales_invoices}</div>
            <div className="erp-card-note">فواتير المبيعات</div>
          </div>
          <div className="erp-card">
            <div className="erp-card-title">Phase Direction</div>
            <div className="erp-card-value">Next</div>
            <div className="erp-card-note">write hooks + action history</div>
          </div>
        </section>
      </section>
    </main>
  );
}
