"use client";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";

const CHART_API = "https://api.royalpalace-group.com/api/v1/admin/accounting/chart-of-accounts";
const LEDGER_API = "https://api.royalpalace-group.com/api/v1/admin/finance/general-ledger";

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export default function GeneralLedgerPage() {
  const { user, ready } = useAdminAuth("finance");
  const [accounts, setAccounts] = useState([]);
  const [accountId, setAccountId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ready || !user) return;
    fetch(CHART_API, { headers: authHeaders() })
      .then(r => r.json())
      .then(data => setAccounts(Array.isArray(data) ? data : []))
      .catch(() => setMessage("تعذر تحميل دليل الحسابات"));
  }, [ready, user]);

  async function handleSearch(e) {
    e.preventDefault();
    if (!accountId) { setMessage("اختر حساباً"); return; }
    setLoading(true); setMessage("");
    try {
      const params = new URLSearchParams({ account_id: accountId });
      if (fromDate) params.set("from_date", fromDate);
      if (toDate) params.set("to_date", toDate);
      const res = await fetch(`${LEDGER_API}?${params.toString()}`, { headers: authHeaders() });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data.detail || "فشل تحميل الحركات");
      setRows(Array.isArray(data) ? data : []);
    } catch (err) {
      setMessage(err.message);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  const csvHeaders = ["رقم القيد","التاريخ","الوصف","الحساب","مدين","دائن"];
  const csvRows = rows.map(r => [r.entry_number, r.entry_date?.slice(0,10)||"", r.description||"", `${r.account_code} - ${r.account_name}`, r.debit_amount, r.credit_amount]);

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Accounting / General Ledger</div><h2>الأستاذ العام</h2><p>تفاصيل حركات أي حساب خلال فترة زمنية.</p></div></section>
        {message && <div className="erp-form-message">{message}</div>}
        <div className="erp-section-card" style={{ marginBottom: 18 }}>
          <form className="erp-form-grid erp-form-grid-3" onSubmit={handleSearch}>
            <div><label className="erp-label">الحساب</label><select className="erp-input" value={accountId} onChange={e => setAccountId(e.target.value)}><option value="">اختر حساب</option>{accounts.map(a => <option key={a.id} value={a.id}>{a.account_code} - {a.account_name}</option>)}</select></div>
            <div><label className="erp-label">من تاريخ</label><input className="erp-input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} /></div>
            <div><label className="erp-label">إلى تاريخ</label><input className="erp-input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} /></div>
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={loading}>{loading ? "جارٍ التحميل..." : "عرض الحركات"}</button></div>
          </form>
        </div>
        <div className="erp-section-card">
          <div style={{ display:"flex", gap:10, marginBottom:12 }}>
            <button className="erp-btn-secondary" onClick={() => exportTableCsv("general_ledger.csv", csvHeaders, csvRows)}>CSV</button>
            <button className="erp-btn-primary" onClick={() => exportTablePdf("تقرير الأستاذ العام", "General Ledger", [{label:"عدد الحركات",value:rows.length}], csvHeaders, csvRows)}>PDF</button>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead><tr><th>رقم القيد</th><th>التاريخ</th><th>الوصف</th><th>الحساب</th><th>مدين</th><th>دائن</th></tr></thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan="6">لا توجد حركات.</td></tr> :
                  rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r.entry_number}</td>
                      <td>{r.entry_date?.slice(0,10)}</td>
                      <td>{r.description}</td>
                      <td>{r.account_code} - {r.account_name}</td>
                      <td>{formatAmount(r.debit_amount)}</td>
                      <td>{formatAmount(r.credit_amount)}</td>
                    </tr>
                  ))
                }
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
