"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import {
  exportReportsSummaryCsv,
  exportReportsSummaryPdf,
  exportReportsLinesCsv,
  exportReportsLinesPdf,
} from "../../components/hrExports";

function resolvePreferredFactoryId(user, factories) {
  if (!Array.isArray(factories) || factories.length === 0) return "";
  const userFactoryId = user?.factory_id || user?.factory?.id || "";
  if (userFactoryId && factories.some((f) => String(f.id) === String(userFactoryId))) return String(userFactoryId);
  return String(factories[0]?.id || "");
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

export default function HrReportsPage() {
  const { user, ready } = useAdminAuth("employees");
  const [factories, setFactories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [report, setReport] = useState(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    factory_id: "",
    payroll_month: String(new Date().getMonth() + 1),
    payroll_year: String(new Date().getFullYear()),
  });

  const lockedFactoryId = !user?.is_superuser && user?.factory_id ? String(user.factory_id) : "";

  async function loadFactories() {
    const factoriesRes = await fetch("https://api.royalpalace-group.com/api/v1/admin/erp/factories", {
      headers: authHeaders(),
      cache: "no-store",
    });
    const safeFactories = factoriesRes.ok ? await factoriesRes.json() : [];
    setFactories(safeFactories);
    setFilters((prev) => ({
      ...prev,
      factory_id: prev.factory_id || lockedFactoryId || resolvePreferredFactoryId(user, safeFactories),
    }));
    return safeFactories;
  }

  async function loadReportData(factoryId, month, year) {
    if (!factoryId || !month || !year) return;
    setLoading(true);
    setMessage("");

    try {
      const summaryUrl = `https://api.royalpalace-group.com/api/v1/admin/hr/summary?factory_id=${factoryId}&payroll_month=${month}&payroll_year=${year}`;
      const reportUrl = `https://api.royalpalace-group.com/api/v1/admin/hr/reports/payroll?factory_id=${factoryId}&payroll_month=${month}&payroll_year=${year}`;

      const [summaryRes, reportRes] = await Promise.all([
        fetch(summaryUrl, { headers: authHeaders(), cache: "no-store" }),
        fetch(reportUrl, { headers: authHeaders(), cache: "no-store" }),
      ]);

      const summaryData = await summaryRes.json().catch(() => ({}));
      const reportData = await reportRes.json().catch(() => ({}));

      if (!summaryRes.ok) throw new Error(summaryData.detail || "تعذر تحميل ملخص الموارد البشرية.");
      if (!reportRes.ok) throw new Error(reportData.detail || "تعذر تحميل تقرير الرواتب.");

      setSummary(summaryData);
      setReport(reportData);
    } catch (err) {
      setMessage(err.message || "تعذر تحميل تقارير الموارد البشرية.");
      setSummary(null);
      setReport(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadFactories()
      .then((safeFactories) => {
        const factoryId = lockedFactoryId || resolvePreferredFactoryId(user, safeFactories);
        if (factoryId) loadReportData(factoryId, filters.payroll_month, filters.payroll_year);
      })
      .catch(() => setMessage("تعذر تحميل بيانات المصانع."));
  }, [ready, user]);

  const runRows = useMemo(() => summary?.payroll_runs || [], [summary]);
  const lineRows = useMemo(() => report?.items || [], [report]);

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل تقارير الموارد البشرية...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">الموارد البشرية / التقارير</div>
            <h2>الملخص الشهري للموارد البشرية</h2>
            <p>ملخص على مستوى المصنع للإجازات والتقييمات ومسيرات الرواتب وحالات الصرف والإجماليات الشهرية.</p>
          </div>
        </section>

        <div className="erp-form-shell">
          <div className="erp-section-head" style={{ marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>مرشحات التقرير</h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8 }}>
                صدّر الملخص أو بنود الرواتب الحالية بنفس أسلوب PDF صفحة المنتجات.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="erp-btn-secondary" onClick={() => exportReportsSummaryCsv(summary)}>Export Summary CSV</button>
              <button type="button" className="erp-btn-primary" onClick={() => exportReportsSummaryPdf(summary)}>Export Summary PDF</button>
              <button type="button" className="erp-btn-secondary" onClick={() => exportReportsLinesCsv(lineRows)}>Export Lines CSV</button>
              <button type="button" className="erp-btn-primary" onClick={() => exportReportsLinesPdf(lineRows)}>Export Lines PDF</button>
            </div>
          </div>

          <div className="erp-form-grid erp-form-grid-4">
            <div><label className="erp-label">المصنع</label><select className="erp-input" value={filters.factory_id} disabled={Boolean(lockedFactoryId)} onChange={(e) => setFilters({ ...filters, factory_id: e.target.value })}>{factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
            <div><label className="erp-label">الشهر</label><input className="erp-input" type="number" min="1" max="12" value={filters.payroll_month} onChange={(e) => setFilters({ ...filters, payroll_month: e.target.value })} /></div>
            <div><label className="erp-label">السنة</label><input className="erp-input" type="number" min="2000" max="2100" value={filters.payroll_year} onChange={(e) => setFilters({ ...filters, payroll_year: e.target.value })} /></div>
            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="button" onClick={() => loadReportData(filters.factory_id, filters.payroll_month, filters.payroll_year)} disabled={loading}>
                {loading ? "جارٍ التحميل..." : "تحميل التقرير"}
              </button>
            </div>
          </div>

          {message ? <div className="erp-form-message">{message}</div> : null}
        </div>

        {!summary || !report ? (
          <div className="erp-form-message">لا يوجد تقرير موارد بشرية محمل حتى الآن.</div>
        ) : (
          <>
            <section className="erp-kpi-grid">
              <div className="erp-card"><div className="erp-card-title">الموظفون</div><div className="erp-card-value">{summary.employee_count || 0}</div><div className="erp-card-note">الموظفون النشطون داخل المصنع</div></div>
              <div className="erp-card"><div className="erp-card-title">ملفات الرواتب</div><div className="erp-card-value">{summary.compensation_count || 0}</div><div className="erp-card-note">ملفات التعويض النشطة</div></div>
              <div className="erp-card"><div className="erp-card-title">طلبات الإجازات</div><div className="erp-card-value">{summary.leave_summary?.total || 0}</div><div className="erp-card-note">كل حالات الطلبات</div></div>
              <div className="erp-card"><div className="erp-card-title">التقييمات</div><div className="erp-card-value">{summary.evaluation_summary?.total || 0}</div><div className="erp-card-note">التقييمات خلال الفترة</div></div>
              <div className="erp-card"><div className="erp-card-title">إجمالي صافي الرواتب</div><div className="erp-card-value">{money(summary.payroll_summary?.net_salary_total || 0)}</div><div className="erp-card-note">إجمالي صافي الرواتب</div></div>
              <div className="erp-card"><div className="erp-card-title">إيصالات معلقة</div><div className="erp-card-value">{summary.payroll_summary?.pending_receipts || 0}</div><div className="erp-card-note">بحاجة إلى متابعة</div></div>
            </section>

            <section className="erp-grid-2">
              <div className="erp-section-card">
                <div className="erp-section-head"><div style={{ textAlign: "right" }}><h3>ملخص الإجازات</h3><p>إجماليات سير عمل الإجازات</p></div></div>
                <div className="erp-table-shell">
                  <table className="erp-table">
                    <thead><tr><th>الحالة</th><th>العدد</th></tr></thead>
                    <tbody>
                      {(summary.leave_breakdown || []).length ? (
                        summary.leave_breakdown.map((item) => <tr key={item.status}><td>{item.status}</td><td>{item.count}</td></tr>)
                      ) : (
                        <tr><td colSpan="2">لا توجد سجلات إجازات خلال هذه الفترة.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="erp-section-card">
                <div className="erp-section-head"><div style={{ textAlign: "right" }}><h3>ملخص التقييمات</h3><p>إجماليات التقييمات والمكافآت والخصومات</p></div></div>
                <div className="erp-table-shell">
                  <table className="erp-table">
                    <thead><tr><th>الحالة</th><th>العدد</th><th>المكافآت</th><th>الخصومات</th></tr></thead>
                    <tbody>
                      {(summary.evaluation_breakdown || []).length ? (
                        summary.evaluation_breakdown.map((item) => (
                          <tr key={item.status}>
                            <td>{item.status}</td>
                            <td>{item.count}</td>
                            <td>{money(item.bonus_total)}</td>
                            <td>{money(item.deduction_total)}</td>
                          </tr>
                        ))
                      ) : (
                        <tr><td colSpan="4">لا توجد تقييمات خلال هذه الفترة.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>

            <section className="erp-section-card">
              <div className="erp-section-head"><div style={{ textAlign: "right" }}><h3>ملخص مسيرات الرواتب</h3><p>حالة المسيرات الشهرية ونظرة عامة على الصرف</p></div></div>
              <div className="erp-table-shell">
                <table className="erp-table">
                  <thead>
                    <tr><th>رقم المسير</th><th>الحالة</th><th>الموظفون</th><th>إجمالي الصافي</th><th>المكافآت</th><th>الخصومات</th><th>معلق</th><th>مدفوع</th><th>مستلم</th></tr>
                  </thead>
                  <tbody>
                    {runRows.length ? (
                      runRows.map((item) => (
                        <tr key={item.id}>
                          <td>{item.id}</td>
                          <td>{item.status}</td>
                          <td>{item.employees_count}</td>
                          <td>{money(item.net_salary_total)}</td>
                          <td>{money(item.bonuses_total)}</td>
                          <td>{money(item.deductions_total)}</td>
                          <td>{item.pending_receipts}</td>
                          <td>{item.paid_receipts}</td>
                          <td>{item.received_receipts}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="9">لا توجد مسيرات رواتب خلال هذه الفترة.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="erp-section-card">
              <div className="erp-section-head"><div style={{ textAlign: "right" }}><h3>تفاصيل بنود الرواتب</h3><p>تقرير تفصيلي شهري لبنود الرواتب للمراجعة الإدارية</p></div></div>
              <div className="erp-form-shell" style={{ marginBottom: 16 }}>
                <div className="erp-form-grid erp-form-grid-4">
                  <div><strong>عدد البنود:</strong> {report.summary?.lines_count || 0}</div>
                  <div><strong>إجمالي الأساسي:</strong> {money(report.summary?.basic_salary_total || 0)}</div>
                  <div><strong>إجمالي البدلات:</strong> {money(report.summary?.allowances_total || 0)}</div>
                  <div><strong>إجمالي الخصومات:</strong> {money(report.summary?.deductions_total || 0)}</div>
                  <div><strong>إجمالي المكافآت:</strong> {money(report.summary?.bonuses_total || 0)}</div>
                  <div><strong>إجمالي الإضافي:</strong> {money(report.summary?.overtime_amount_total || 0)}</div>
                  <div><strong>إجمالي الصافي:</strong> {money(report.summary?.net_salary_total || 0)}</div>
                  <div><strong>إيصالات معلقة:</strong> {report.summary?.pending_receipts || 0}</div>
                </div>
              </div>

              <div className="erp-table-shell">
                <table className="erp-table">
                  <thead>
                    <tr><th>الموظف</th><th>الكود</th><th>الأساسي</th><th>البدلات</th><th>الخصومات</th><th>المكافآت</th><th>الإضافي</th><th>الصافي</th><th>حالة الإيصال</th></tr>
                  </thead>
                  <tbody>
                    {lineRows.length ? (
                      lineRows.map((item) => (
                        <tr key={item.payroll_line_id || item.id}>
                          <td>{item.employee_name}</td>
                          <td>{item.employee_code}</td>
                          <td>{money(item.basic_salary)}</td>
                          <td>{money(item.allowances_total)}</td>
                          <td>{money(item.deductions_total)}</td>
                          <td>{money(item.bonuses_total)}</td>
                          <td>{money(item.overtime_amount)}</td>
                          <td>{money(item.net_salary)}</td>
                          <td>{item.receipt_status}</td>
                        </tr>
                      ))
                    ) : (
                      <tr><td colSpan="9">لا توجد بنود رواتب خلال هذه الفترة.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </section>
          </>
        )}
      </section>
    </main>
  );
}
