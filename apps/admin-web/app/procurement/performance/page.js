"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";

const PERFORMANCE_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/supplier-performance";
const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function ProcurementPerformancePage() {
  const { user, ready } = useAdminAuth("procurement");
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  async function loadAll() {
    const res = await fetch(PERFORMANCE_API_URL, { headers: authHeaders(), cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.detail || "فشل تحميل أداء الموردين");
    setItems(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء التحميل"));
  }, [ready, user]);

  const filteredItems = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return items;
    return items.filter((item) => [item.factory_name, item.supplier_code, item.supplier_name].join(" ").toLowerCase().includes(q));
  }, [items, search]);

  function handleExportCsv() {
    const headers = ["المصنع","المورد","POs","الاستلامات","الكمية المستلمة","في الوقت","متأخرة","نسبة الالتزام %","متوسط التأخير"];
    const rows = filteredItems.map((item) => [item.factory_name || "", item.supplier_name || "", item.purchase_orders_count || 0, item.receipts_count || 0, formatAmount(item.received_quantity_total), item.on_time_purchase_orders_count || 0, item.delayed_purchase_orders_count || 0, formatAmount(item.on_time_rate), formatAmount(item.avg_delay_days)]);
    exportTableCsv("supplier_performance_export.csv", headers, rows);
  }

  function handleExportPdf() {
    const headers = ["المصنع","المورد","POs","الاستلامات","الكمية المستلمة","في الوقت","متأخرة","نسبة الالتزام %","متوسط التأخير"];
    const rows = filteredItems.map((item) => [item.factory_name || "", item.supplier_name || "", item.purchase_orders_count || 0, item.receipts_count || 0, formatAmount(item.received_quantity_total), item.on_time_purchase_orders_count || 0, item.delayed_purchase_orders_count || 0, formatAmount(item.on_time_rate), formatAmount(item.avg_delay_days)]);
    exportTablePdf("تقرير أداء الموردين", "المشتريات / أداء الموردين", [{ label: "عدد الموردين", value: filteredItems.length }], headers, rows);
  }

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل أداء الموردين...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <header className="erp-workspace-topbar">
          <div className="erp-workspace-title-wrap">
            <div className="erp-page-eyebrow">Supplier Performance</div>
            <h1 className="erp-page-title">أداء الموردين</h1>
            <p className="erp-page-subtitle">
              تقييم التزام الموردين حسب أوامر الشراء والاستلامات والتأخير ومعدل التسليم في الوقت.
            </p>
          </div>
          <div className="erp-topbar-actions">
            <div className="erp-topbar-chip">عدد الصفوف: {items.length}</div>
          </div>
        </header>

        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">Supplier Performance</div>
            <h2>مؤشرات الالتزام الزمني</h2>
            <p>مراجعة أوامر الشراء والاستلامات والتأخير ومعدل الالتزام الزمني لتقييم كفاءة الموردين.</p>
          </div>
          <div className="erp-stat-panel"><div className="erp-hero-visual" /></div>
        </section>

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">عدد الموردين</div><div className="erp-card-value">{items.length}</div></div>
        </section>

        {items.length === 0 ? <div className="erp-form-message" style={{ marginBottom: "16px" }}>لا توجد بيانات أداء بعد لأن purchase orders وreceipts ما زالت صفرية.</div> : null}
        {message ? <div className="erp-form-message" style={{ marginBottom: "16px" }}>{message}</div> : null}

        <div className="erp-section-card">
          <div className="erp-section-head">
            <div><h3>مؤشرات الموردين</h3><p>قراءة تشغيلية سريعة حسب المورد والمصنع</p></div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center",width:"100%"}}>
              <input className="erp-search" style={{flex:"1 1 260px",minWidth:"220px"}} placeholder="ابحث بالمورد أو المصنع..." value={search} onChange={(e) => setSearch(e.target.value)}/>
              <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button>
              <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button>
            </div>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table" style={{ minWidth: "1400px" }}>
              <thead><tr><th>المصنع</th><th>كود المورد</th><th>المورد</th><th>POs</th><th>الاستلامات</th><th>الكمية المستلمة</th><th>في الوقت</th><th>متأخرة</th><th>نسبة الالتزام</th><th>متوسط التأخير</th></tr></thead>
              <tbody>
                {filteredItems.length === 0 ? <tr><td colSpan="10">{items.length === 0 ? "لا توجد بيانات أداء حالياً." : "لا توجد نتائج مطابقة."}</td></tr> : filteredItems.map((item) => (
                  <tr key={`${item.factory_id}-${item.supplier_id}`}>
                    <td>{item.factory_name || `مصنع #${item.factory_id}`}</td>
                    <td>{item.supplier_code || "-"}</td>
                    <td>{item.supplier_name || "-"}</td>
                    <td>{item.purchase_orders_count || 0}</td>
                    <td>{item.receipts_count || 0}</td>
                    <td>{formatAmount(item.received_quantity_total)}</td>
                    <td>{item.on_time_purchase_orders_count || 0}</td>
                    <td>{item.delayed_purchase_orders_count || 0}</td>
                    <td>{formatAmount(item.on_time_rate)}%</td>
                    <td>{formatAmount(item.avg_delay_days)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
