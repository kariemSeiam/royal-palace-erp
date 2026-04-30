"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { hasPermission } from "../../components/access";
import {
  exportPayrollRunsCsv,
  exportPayrollRunsPdf,
  exportPayrollDetailsCsv,
  exportPayrollDetailsPdf,
} from "../../components/hrExports";

const FACTORIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";
const SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/hr/summary";
const GENERATE_API_URL = "https://api.royalpalace-group.com/api/v1/admin/hr/payroll-runs/generate";
const PAYROLL_RUNS_API_PREFIX = "https://api.royalpalace-group.com/api/v1/admin/hr/payroll-runs";
const PAYROLL_LINES_API_PREFIX = "https://api.royalpalace-group.com/api/v1/admin/hr/payroll-lines";
const PAYROLL_POSTING_CHECK_API_URL = "https://api.royalpalace-group.com/api/v1/admin/accounting/postings/source-check";
const PAYROLL_RUN_POSTING_API_PREFIX = "https://api.royalpalace-group.com/api/v1/admin/accounting/postings/payroll-runs";

function resolvePreferredFactoryId(user, factories) {
  if (!Array.isArray(factories) || factories.length === 0) return "";
  const userFactoryId = user?.factory_id || user?.factory?.id || "";
  if (userFactoryId && factories.some((f) => String(f.id) === String(userFactoryId))) return String(userFactoryId);
  return String(factories[0]?.id || "");
}

function money(value) {
  return Number(value || 0).toFixed(2);
}

function postingStatusLabel(value) {
  if (value === "posted") return "مقيد محاسبيًا";
  if (value === "ready") return "جاهز للترحيل";
  if (value === "error") return "خطأ";
  return "غير مفحوص";
}

function postingStatusTone(value) {
  if (value === "posted") return "success";
  if (value === "ready") return "warning";
  if (value === "error") return "danger";
  return "";
}

export default function HrPayrollPage() {
  const { user, ready } = useAdminAuth("hr");
  const canPostAccounting = useMemo(() => hasPermission(user, "finance.manage"), [user]);

  const [factories, setFactories] = useState([]);
  const [summary, setSummary] = useState(null);
  const [selectedRun, setSelectedRun] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState({
    factory_id: "",
    payroll_month: String(new Date().getMonth() + 1),
    payroll_year: String(new Date().getFullYear()),
  });
  const [generateForm, setGenerateForm] = useState({ notes: "" });
  const [postingMap, setPostingMap] = useState({});
  const [postingActionKey, setPostingActionKey] = useState("");

  const lockedFactoryId = !user?.is_superuser && user?.factory_id ? String(user.factory_id) : "";

  async function loadFactories() {
    const res = await fetch(FACTORIES_API_URL, { headers: authHeaders(), cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error("تعذر تحميل المصانع");
    const safeFactories = Array.isArray(data) ? data : [];
    setFactories(safeFactories);
    const nextFactoryId = lockedFactoryId || resolvePreferredFactoryId(user, safeFactories);
    setFilters((prev) => ({ ...prev, factory_id: prev.factory_id || nextFactoryId }));
    return nextFactoryId;
  }

  async function loadSummary(factoryId, month, year) {
    if (!factoryId || !month || !year) return;
    const res = await fetch(`${SUMMARY_API_URL}?factory_id=${factoryId}&payroll_month=${month}&payroll_year=${year}`, {
      headers: authHeaders(),
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "تعذر تحميل ملخص الرواتب");
    setSummary(data);
  }

  async function loadRunDetails(runId) {
    const res = await fetch(`${PAYROLL_RUNS_API_PREFIX}/${runId}`, { headers: authHeaders(), cache: "no-store" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "تعذر تحميل تفاصيل المسير");
    setSelectedRun(data);
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadFactories()
      .then((factoryId) => loadSummary(factoryId, filters.payroll_month, filters.payroll_year))
      .catch((err) => setMessage(err.message || "تعذر تحميل بيانات الرواتب"));
  }, [ready, user]);

  const runRows = useMemo(() => summary?.payroll_runs || [], [summary]);

  async function handleGenerate(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const payload = {
        factory_id: Number(lockedFactoryId || filters.factory_id),
        payroll_month: Number(filters.payroll_month),
        payroll_year: Number(filters.payroll_year),
        notes: generateForm.notes.trim() || null,
      };
      const res = await fetch(GENERATE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل إنشاء مسير الرواتب");
      setMessage("تم إنشاء مسير الرواتب");
      await loadSummary(String(payload.factory_id), String(payload.payroll_month), String(payload.payroll_year));
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء إنشاء المسير");
    } finally {
      setSubmitting(false);
    }
  }

  async function updateRunStatus(runId, status) {
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch(`${PAYROLL_RUNS_API_PREFIX}/${runId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ status }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحديث حالة المسير");
      setMessage("تم تحديث حالة المسير");
      await loadSummary(lockedFactoryId || filters.factory_id, filters.payroll_month, filters.payroll_year);
      await loadRunDetails(runId);
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء تحديث الحالة");
    } finally {
      setSubmitting(false);
    }
  }

  async function markLinePaid(lineId) {
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch(`${PAYROLL_LINES_API_PREFIX}/${lineId}/mark-paid`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ notes: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تعليم السطر كمدفوع");
      setMessage("تم تعليم سطر الرواتب كمدفوع");
      if (selectedRun?.id) await loadRunDetails(selectedRun.id);
      await loadSummary(lockedFactoryId || filters.factory_id, filters.payroll_month, filters.payroll_year);
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء تعليم السطر");
    } finally {
      setSubmitting(false);
    }
  }

  async function checkRunPosting(runId) {
    const stateKey = `hr_payroll:payroll_run:${runId}`;
    setPostingActionKey(`check:${stateKey}`);
    setMessage("");
    try {
      const res = await fetch(
        `${PAYROLL_POSTING_CHECK_API_URL}?source_module=hr_payroll&source_type=payroll_run&source_id=${encodeURIComponent(runId)}`,
        { headers: authHeaders(), cache: "no-store" }
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل فحص حالة الترحيل");
      setPostingMap((prev) => ({
        ...prev,
        [stateKey]: {
          status: data.exists ? "posted" : "ready",
          entry_number: data.entry?.entry_number || "",
        },
      }));
      setMessage(data.exists ? "مسير الرواتب مقيد محاسبيًا بالفعل." : "مسير الرواتب جاهز للترحيل المحاسبي.");
    } catch (err) {
      setPostingMap((prev) => ({
        ...prev,
        [stateKey]: {
          status: "error",
          entry_number: "",
        },
      }));
      setMessage(err.message || "حدث خطأ أثناء فحص حالة الترحيل");
    } finally {
      setPostingActionKey("");
    }
  }

  async function postRunAccounting(runId) {
    const stateKey = `hr_payroll:payroll_run:${runId}`;
    setPostingActionKey(`post:${stateKey}`);
    setMessage("");
    try {
      const res = await fetch(`${PAYROLL_RUN_POSTING_API_PREFIX}/${runId}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل الترحيل المحاسبي لمسير الرواتب");
      setPostingMap((prev) => ({
        ...prev,
        [stateKey]: {
          status: "posted",
          entry_number: data.entry_number || "",
        },
      }));
      setMessage("تم إنشاء القيد المحاسبي لمسير الرواتب بنجاح");
    } catch (err) {
      setPostingMap((prev) => ({
        ...prev,
        [stateKey]: {
          status: "error",
          entry_number: "",
        },
      }));
      setMessage(err.message || "حدث خطأ أثناء الترحيل المحاسبي");
    } finally {
      setPostingActionKey("");
    }
  }

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل الرواتب...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">الموارد البشرية / الرواتب</div>
            <h2>إدارة مسيرات الرواتب</h2>
            <p>إنشاء مسيرات الرواتب ومراجعة تفاصيلها واعتمادها وتعليم السطور كمدفوعة.</p>
          </div>
        </section>

        <div className="erp-form-shell">
          <div className="erp-section-head" style={{ marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>مرشحات ومسير جديد</h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8 }}>
                يمكنك أيضًا تصدير المسيرات الحالية أو تفاصيل المسير المفتوح بنفس شكل PDF صفحة المنتجات.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="erp-btn-secondary" onClick={() => exportPayrollRunsCsv(runRows)}>Export CSV</button>
              <button type="button" className="erp-btn-primary" onClick={() => exportPayrollRunsPdf(runRows, summary?.payroll_summary)}>Export PDF</button>
              {selectedRun ? (
                <>
                  <button type="button" className="erp-btn-secondary" onClick={() => exportPayrollDetailsCsv(selectedRun.items || [])}>Export Lines CSV</button>
                  <button type="button" className="erp-btn-primary" onClick={() => exportPayrollDetailsPdf(selectedRun.items || [], selectedRun.id)}>Export Lines PDF</button>
                </>
              ) : null}
            </div>
          </div>

          <form className="erp-form-grid erp-form-grid-4" onSubmit={handleGenerate}>
            <div><label className="erp-label">المصنع</label><select className="erp-input" value={lockedFactoryId || filters.factory_id} disabled={Boolean(lockedFactoryId)} onChange={(e) => setFilters((prev) => ({ ...prev, factory_id: e.target.value }))}>{factories.map((factory) => <option key={factory.id} value={factory.id}>{factory.name}</option>)}</select></div>
            <div><label className="erp-label">الشهر</label><input className="erp-input" type="number" min="1" max="12" value={filters.payroll_month} onChange={(e) => setFilters((prev) => ({ ...prev, payroll_month: e.target.value }))} /></div>
            <div><label className="erp-label">السنة</label><input className="erp-input" type="number" min="2000" max="2100" value={filters.payroll_year} onChange={(e) => setFilters((prev) => ({ ...prev, payroll_year: e.target.value }))} /></div>
            <div className="erp-form-actions"><button type="button" className="erp-btn-secondary" onClick={() => loadSummary(lockedFactoryId || filters.factory_id, filters.payroll_month, filters.payroll_year)}>تحميل الملخص</button></div>
            <div style={{ gridColumn: "1 / -1" }}><label className="erp-label">ملاحظات إنشاء المسير</label><textarea className="erp-input" rows="2" value={generateForm.notes} onChange={(e) => setGenerateForm({ notes: e.target.value })} /></div>
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الإنشاء..." : "إنشاء مسير جديد"}</button></div>
          </form>
          {message ? <div className="erp-form-message">{message}</div> : null}
        </div>

        {!summary ? null : (
          <>
            <section className="erp-kpi-grid">
              <div className="erp-card"><div className="erp-card-title">عدد المسيرات</div><div className="erp-card-value">{summary.payroll_summary?.runs_count || 0}</div></div>
              <div className="erp-card"><div className="erp-card-title">إجمالي الصافي</div><div className="erp-card-value">{money(summary.payroll_summary?.net_salary_total || 0)}</div></div>
              <div className="erp-card"><div className="erp-card-title">إيصالات معلقة</div><div className="erp-card-value">{summary.payroll_summary?.pending_receipts || 0}</div></div>
              <div className="erp-card"><div className="erp-card-title">إيصالات مدفوعة</div><div className="erp-card-value">{summary.payroll_summary?.paid_receipts || 0}</div></div>
            </section>

            <div className="erp-section-card" style={{ marginBottom: 18 }}>
              <div className="erp-section-head"><div><h3>مسيرات الرواتب</h3><p>عرض المسيرات خلال الفترة المحددة</p></div></div>
              <div className="erp-table-shell">
                <table className="erp-table" style={{ minWidth: 1500 }}>
                  <thead>
                    <tr>
                      <th>ID</th>
                      <th>الحالة</th>
                      <th>الحالة المحاسبية</th>
                      <th>رقم القيد</th>
                      <th>الموظفون</th>
                      <th>إجمالي الصافي</th>
                      <th>إيصالات معلقة</th>
                      <th>إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runRows.length === 0 ? (
                      <tr><td colSpan="8">لا توجد مسيرات رواتب في هذه الفترة.</td></tr>
                    ) : (
                      runRows.map((run) => {
                        const postingState = postingMap[`hr_payroll:payroll_run:${run.id}`] || { status: "", entry_number: "" };
                        return (
                          <tr key={run.id}>
                            <td>{run.id}</td>
                            <td><span className={`erp-badge ${run.status === "finalized" ? "success" : "warning"}`}>{run.status}</span></td>
                            <td><span className={`erp-badge ${postingStatusTone(postingState.status)}`}>{postingStatusLabel(postingState.status)}</span></td>
                            <td>{postingState.entry_number || "-"}</td>
                            <td>{run.employees_count}</td>
                            <td>{money(run.net_salary_total)}</td>
                            <td>{run.pending_receipts}</td>
                            <td>
                              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                                {canPostAccounting ? (
                                  <>
                                    <button
                                      type="button"
                                      className="erp-btn-secondary"
                                      disabled={postingActionKey === `check:hr_payroll:payroll_run:${run.id}`}
                                      onClick={() => checkRunPosting(run.id)}
                                    >
                                      {postingActionKey === `check:hr_payroll:payroll_run:${run.id}` ? "..." : "فحص الترحيل"}
                                    </button>
                                    <button
                                      type="button"
                                      className="erp-btn-secondary"
                                      disabled={postingState.status === "posted" || postingActionKey === `post:hr_payroll:payroll_run:${run.id}`}
                                      onClick={() => postRunAccounting(run.id)}
                                    >
                                      {postingActionKey === `post:hr_payroll:payroll_run:${run.id}` ? "..." : "ترحيل محاسبي"}
                                    </button>
                                  </>
                                ) : null}
                                <button type="button" className="erp-btn-secondary" onClick={() => loadRunDetails(run.id)}>تفاصيل</button>
                                <button type="button" className="erp-btn-primary" disabled={run.status === "finalized" || submitting} onClick={() => updateRunStatus(run.id, "finalized")}>اعتماد</button>
                                <button type="button" className="erp-btn-danger" disabled={submitting} onClick={() => updateRunStatus(run.id, "cancelled")}>إلغاء</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {selectedRun ? (
              <div className="erp-section-card">
                <div className="erp-section-head"><div><h3>تفاصيل المسير #{selectedRun.id}</h3><p>تفاصيل السطور مع حالات الإيصال</p></div></div>
                <div className="erp-form-shell" style={{ marginBottom: 16 }}>
                  <div className="erp-form-grid erp-form-grid-4">
                    <div><strong>عدد الموظفين:</strong> {selectedRun.summary?.employees || 0}</div>
                    <div><strong>إجمالي الصافي:</strong> {money(selectedRun.summary?.net_salary_total || 0)}</div>
                    <div><strong>المكافآت:</strong> {money(selectedRun.summary?.bonuses_total || 0)}</div>
                    <div><strong>الخصومات:</strong> {money(selectedRun.summary?.deductions_total || 0)}</div>
                  </div>
                </div>

                <div className="erp-table-shell">
                  <table className="erp-table" style={{ minWidth: 1700 }}>
                    <thead>
                      <tr><th>الموظف</th><th>الكود</th><th>الأساسي</th><th>البدلات</th><th>المكافآت</th><th>الخصومات</th><th>التأخير</th><th>نصف يوم</th><th>إجازة غير مدفوعة</th><th>الإضافي</th><th>الصافي</th><th>الإيصال</th><th>الإجراء</th></tr>
                    </thead>
                    <tbody>
                      {(selectedRun.items || []).length === 0 ? (
                        <tr><td colSpan="13">لا توجد سطور داخل هذا المسير.</td></tr>
                      ) : (
                        selectedRun.items.map((item) => (
                          <tr key={item.id}>
                            <td>{item.employee_name}</td>
                            <td>{item.employee_code}</td>
                            <td>{money(item.basic_salary)}</td>
                            <td>{money(item.allowances_total)}</td>
                            <td>{money(item.bonuses_total)}</td>
                            <td>{money(item.deductions_total)}</td>
                            <td>{item.late_minutes} / {money(item.late_deduction)}</td>
                            <td>{item.half_day_days} / {money(item.half_day_deduction)}</td>
                            <td>{item.unpaid_leave_days} / {money(item.unpaid_leave_deduction)}</td>
                            <td>{item.overtime_minutes} / {money(item.overtime_amount)}</td>
                            <td>{money(item.net_salary)}</td>
                            <td><span className={`erp-badge ${item.receipt_status === "received" || item.receipt_status === "paid" ? "success" : "warning"}`}>{item.receipt_status}</span></td>
                            <td><button type="button" className="erp-btn-primary" disabled={selectedRun.status !== "finalized" || item.receipt_status === "paid" || item.receipt_status === "received" || submitting} onClick={() => markLinePaid(item.id)}>تعليم كمدفوع</button></td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}
          </>
        )}
      </section>
    </main>
  );
}

