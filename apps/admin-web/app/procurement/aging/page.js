"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";

const AGING_API_URL = "https://api.royalpalace-group.com/api/v1/admin/procurement/supplier-aging";
const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export default function ProcurementAgingPage() {
  const { user, ready } = useAdminAuth("procurement");
  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  async function loadAll() {
    const res = await fetch(AGING_API_URL, { headers: authHeaders(), cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.detail || "فشل تحميل أعمار الديون");
    setItems(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء التحميل"));
  }, [ready, user]);

  const filteredItems = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return items;
    return items.filter((item) => {
      const haystack = [item.factory_name, item.supplier_code, item.supplier_name, item.total_due].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [items, search]);

  function handleExportCsv() {
    const headers = ["المصنع","المورد","الحالي","1-30","31-60","61-90","90+","إجمالي المستحق"];
    const rows = filteredItems.map((item) => [item.factory_name || "", item.supplier_name || "", formatAmount(item.current), formatAmount(item.days_1_30), formatAmount(item.days_31_60), formatAmount(item.days_61_90), formatAmount(item.days_90_plus), formatAmount(item.total_due)]);
    exportTableCsv("supplier_aging_export.csv", headers, rows);
  }

  function handleExportPdf() {
    const headers = ["المصنع","المورد","الحالي","1-30","31-60","61-90","90+","إجمالي المستحق"];
    const rows = filteredItems.map((item) => [item.factory_name || "", item.supplier_name || "", formatAmount(item.current), formatAmount(item.days_1_30), formatAmount(item.days_31_60), formatAmount(item.days_61_90), formatAmount(item.days_90_plus), formatAmount(item.total_due)]);
    exportTablePdf("تقرير أعمار الديون", "المشتريات / أعمار الديون", [{ label: "عدد الصفوف", value: filteredItems.length }], headers, rows);
  }

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل أعمار ديون الموردين...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <header className="erp-workspace-topbar">
          <div className="erp-workspace-title-wrap">
            <div className="erp-page-eyebrow">Supplier Aging</div>
            <h1 className="erp-page-title">أعمار ديون الموردين</h1>
            <p className="erp-page-subtitle">
              قراءة تشغيلية لمستحقات الموردين حسب شرائح التأخير لدعم الأولوية والسداد والتخطيط النقدي.
            </p>
          </div>
          <div className="erp-topbar-actions">
            <div className="erp-topbar-chip">عدد الصفوف: {items.length}</div>
          </div>
        </header>

        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">Supplier Payables Aging</div>
            <h2>تحليل شرائح التأخير</h2>
            <p>متابعة أعمار الديون حسب المورد والمصنع مع عرض الحالي و1-30 و31-60 و61-90 و90+.</p>
          </div>
          <div className="erp-stat-panel"><div className="erp-hero-visual" /></div>
        </section>

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">عدد الصفوف</div><div className="erp-card-value">{items.length}</div></div>
        </section>

        {items.length === 0 ? <div className="erp-form-message" style={{ marginBottom: "16px" }}>لا توجد بيانات Aging بعد لأن supplier invoices وpayments ما زالت فارغة.</div> : null}
        {message ? <div className="erp-form-message" style={{ marginBottom: "16px" }}>{message}</div> : null}

        <div className="erp-section-card">
          <div className="erp-section-head">
            <div><h3>شرائح أعمار الديون</h3><p>المتابعة حسب المورد والمصنع</p></div>
            <div style={{display:"flex",gap:"8px",flexWrap:"wrap",alignItems:"center",width:"100%"}}>
              <input className="erp-search" style={{flex:"1 1 260px",minWidth:"220px"}} placeholder="ابحث بالمورد أو المصنع..." value={search} onChange={(e) => setSearch(e.target.value)}/>
              <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button>
              <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button>
            </div>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table" style={{ minWidth: "1300px" }}>
              <thead><tr><th>المصنع</th><th>كود المورد</th><th>المورد</th><th>الحالي</th><th>1-30</th><th>31-60</th><th>61-90</th><th>90+</th><th>إجمالي المستحق</th><th>فواتير متأخرة</th></tr></thead>
              <tbody>
                {filteredItems.length === 0 ? <tr><td colSpan="10">{items.length === 0 ? "لا توجد بيانات أعمار ديون حالياً." : "لا توجد نتائج مطابقة."}</td></tr> : filteredItems.map((item) => (
                  <tr key={`${item.factory_id}-${item.supplier_id}`}>
                    <td>{item.factory_name || `مصنع #${item.factory_id}`}</td>
                    <td>{item.supplier_code || "-"}</td>
                    <td>{item.supplier_name || "-"}</td>
                    <td>{formatAmount(item.current)}</td>
                    <td>{formatAmount(item.days_1_30)}</td>
                    <td>{formatAmount(item.days_31_60)}</td>
                    <td>{formatAmount(item.days_61_90)}</td>
                    <td>{formatAmount(item.days_90_plus)}</td>
                    <td><strong>{formatAmount(item.total_due)}</strong></td>
                    <td>{item.overdue_invoices_count || 0}</td>
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
