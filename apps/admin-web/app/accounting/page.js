"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { hasPermission } from "../components/access";
import { authHeaders } from "../components/api";

const CHART_API_URL = "https://api.royalpalace-group.com/api/v1/admin/accounting/chart-of-accounts";
const JOURNAL_API_URL = "https://api.royalpalace-group.com/api/v1/admin/accounting/journal-entries";
const TRIAL_BALANCE_API_URL = "https://api.royalpalace-group.com/api/v1/admin/accounting/trial-balance";

const SOURCE_CHECK_API_BASE = "https://api.royalpalace-group.com/api/v1/admin/accounting/postings/source-check";
const SALES_INVOICE_POSTING_API_PREFIX = "https://api.royalpalace-group.com/api/v1/admin/accounting/postings/sales-invoices";
const SALES_RETURN_POSTING_API_PREFIX = "https://api.royalpalace-group.com/api/v1/admin/accounting/postings/sales-returns";
const SUPPLIER_INVOICE_POSTING_API_PREFIX = "https://api.royalpalace-group.com/api/v1/admin/accounting/postings/supplier-invoices";
const SUPPLIER_PAYMENT_POSTING_API_PREFIX = "https://api.royalpalace-group.com/api/v1/admin/accounting/postings/supplier-payments";
const PAYROLL_RUN_POSTING_API_PREFIX = "https://api.royalpalace-group.com/api/v1/admin/accounting/postings/payroll-runs";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function companyName() {
  return "Royal Palace Group";
}

function companyLogoUrl() {
  return "https://royalpalace-group.com/brand/logo.png";
}

function emptyAccountForm() {
  return {
    account_code: "",
    account_name: "",
    account_type: "asset",
    parent_account_id: "",
    allow_manual_entries: true,
    is_active: true,
  };
}

function emptyJournalForm() {
  return {
    entry_date: "",
    source_module: "",
    source_type: "",
    source_id: "",
    factory_id: "",
    currency: "EGP",
    description: "",
    lines_json: JSON.stringify(
      [
        { account_id: 0, line_description: "مدين", debit_amount: 0, credit_amount: 0 },
        { account_id: 0, line_description: "دائن", debit_amount: 0, credit_amount: 0 },
      ],
      null,
      2
    ),
  };
}

function emptyPostingForm() {
  return {
    source_module: "sales",
    source_type: "sales_invoice",
    source_id: "",
  };
}

function exportAccountingCsv({ trialRows, journalRows, chartRows }) {
  const sections = [];
  const escapeCsv = (value) => {
    const s = String(value ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  sections.push("ميزان المراجعة");
  sections.push(["الكود", "الحساب", "النوع", "إجمالي المدين", "إجمالي الدائن", "الرصيد"].join(","));
  trialRows.forEach((row) => {
    sections.push(
      [row.account_code, row.account_name, row.account_type, row.total_debit, row.total_credit, row.balance]
        .map(escapeCsv)
        .join(",")
    );
  });

  sections.push("");
  sections.push("القيود اليومية");
  sections.push(["رقم القيد", "التاريخ", "المصنع", "المصدر", "العملة", "إجمالي المدين", "إجمالي الدائن", "الوصف"].join(","));
  journalRows.forEach((row) => {
    sections.push(
      [
        row.entry_number,
        row.entry_date,
        row.factory_name || row.factory_id || "",
        [row.source_module, row.source_type, row.source_id].filter(Boolean).join(" / "),
        row.currency,
        row.total_debit,
        row.total_credit,
        row.description || "",
      ]
        .map(escapeCsv)
        .join(",")
    );
  });

  sections.push("");
  sections.push("دليل الحسابات");
  sections.push(["الكود", "الاسم", "النوع", "الأب", "يدوي", "نشط"].join(","));
  chartRows.forEach((row) => {
    sections.push(
      [
        row.account_code,
        row.account_name,
        row.account_type,
        row.parent_account_id || "",
        row.allow_manual_entries ? "نعم" : "لا",
        row.is_active ? "نعم" : "لا",
      ]
        .map(escapeCsv)
        .join(",")
    );
  });

  const csv = sections.join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "accounting_export.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function exportAccountingPdf({ trialRows, journalRows, chartRows, stats }) {
  const printWindow = window.open("", "_blank", "width=1400,height=950");
  if (!printWindow) return;

  const trialRowsHtml = trialRows
    .map((row) => `
      <tr>
        <td>${row.account_code || "-"}</td>
        <td>${row.account_name || "-"}</td>
        <td>${row.account_type || "-"}</td>
        <td>${formatAmount(row.total_debit)}</td>
        <td>${formatAmount(row.total_credit)}</td>
        <td>${formatAmount(row.balance)}</td>
      </tr>
    `)
    .join("");

  const chartRowsHtml = chartRows
    .map((row) => `
      <tr>
        <td>${row.account_code || "-"}</td>
        <td>${row.account_name || "-"}</td>
        <td>${row.account_type || "-"}</td>
        <td>${row.parent_account_id || "-"}</td>
        <td>${row.allow_manual_entries ? "نعم" : "لا"}</td>
        <td>${row.is_active ? "نعم" : "لا"}</td>
      </tr>
    `)
    .join("");

  const journalRowsHtml = journalRows
    .map((row) => `
      <tr>
        <td>${row.entry_number || "-"}</td>
        <td>${row.entry_date || "-"}</td>
        <td>${row.factory_name || row.factory_id || "-"}</td>
        <td>${[row.source_module, row.source_type, row.source_id].filter(Boolean).join(" / ") || "-"}</td>
        <td>${row.currency || "EGP"}</td>
        <td>${formatAmount(row.total_debit)}</td>
        <td>${formatAmount(row.total_credit)}</td>
        <td>${row.description || "-"}</td>
      </tr>
    `)
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>تقرير المحاسبة</title>
        <style>
          * { box-sizing: border-box; }
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: Arial, sans-serif; margin: 0; color: #0f172a; background: #ffffff; }
          .page-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand img { width: 56px; height: 56px; object-fit: contain; }
          .brand h1 { margin: 0; font-size: 22px; }
          .brand p { margin: 6px 0 0; color: #475569; font-size: 12px; }
          .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
          .summary-card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; background: #f8fafc; }
          .summary-card .label { font-size: 11px; color: #64748b; margin-bottom: 6px; }
          .summary-card .value { font-size: 17px; font-weight: 800; color: #0f172a; }
          h2 { margin: 18px 0 10px; font-size: 18px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 18px; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; text-align: right; vertical-align: top; }
          thead th { background: #e2e8f0; font-weight: 800; }
          tbody tr:nth-child(even) { background: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="page-header">
          <div class="brand">
            <img src="${companyLogoUrl()}" alt="logo" />
            <div>
              <h1>${companyName()}</h1>
              <p>تقرير المحاسبة</p>
            </div>
          </div>
          <div>Accounting Report</div>
        </div>

        <div class="summary">
          <div class="summary-card"><div class="label">إجمالي الحسابات</div><div class="value">${stats.totalAccounts}</div></div>
          <div class="summary-card"><div class="label">إجمالي القيود</div><div class="value">${stats.totalEntries}</div></div>
          <div class="summary-card"><div class="label">إجمالي المدين</div><div class="value">${formatAmount(stats.totalDebit)}</div></div>
          <div class="summary-card"><div class="label">إجمالي الدائن</div><div class="value">${formatAmount(stats.totalCredit)}</div></div>
        </div>

        <h2>ميزان المراجعة</h2>
        <table>
          <thead><tr><th>الكود</th><th>الحساب</th><th>النوع</th><th>إجمالي المدين</th><th>إجمالي الدائن</th><th>الرصيد</th></tr></thead>
          <tbody>${trialRowsHtml || `<tr><td colspan="6">لا توجد بيانات حالياً.</td></tr>`}</tbody>
        </table>

        <h2>القيود اليومية</h2>
        <table>
          <thead><tr><th>رقم القيد</th><th>التاريخ</th><th>المصنع</th><th>المصدر</th><th>العملة</th><th>إجمالي المدين</th><th>إجمالي الدائن</th><th>الوصف</th></tr></thead>
          <tbody>${journalRowsHtml || `<tr><td colspan="8">لا توجد بيانات حالياً.</td></tr>`}</tbody>
        </table>

        <h2>دليل الحسابات</h2>
        <table>
          <thead><tr><th>الكود</th><th>الاسم</th><th>النوع</th><th>الأب</th><th>يدوي</th><th>نشط</th></tr></thead>
          <tbody>${chartRowsHtml || `<tr><td colspan="6">لا توجد بيانات حالياً.</td></tr>`}</tbody>
        </table>

        <script>window.onload = function() { setTimeout(() => window.print(), 400); };</script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

const compactControlStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 700, paddingInline: "12px" };
const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };
const compactTableHeaderStyle = { position: "sticky", top: 0, zIndex: 2, background: "#fff", boxShadow: "0 1px 0 rgba(15, 23, 42, 0.06)", fontSize: "12px", padding: "10px 12px", whiteSpace: "nowrap" };
const compactCellStyle = { padding: "10px 12px", fontSize: "12px", verticalAlign: "middle" };
const paginationButtonStyle = { minWidth: "88px", minHeight: "38px", borderRadius: "12px", fontWeight: 800 };
const sectionCardStyle = { border: "1px solid var(--rp-border)", borderRadius: "18px", background: "var(--rp-surface)", padding: "16px", boxShadow: "var(--rp-shadow-soft)" };
const sectionTitleStyle = { margin: 0, fontSize: "18px", fontWeight: 900, color: "var(--rp-text)" };
const sectionNoteStyle = { margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8, fontSize: "13px" };

const postingSourceOptions = [
  { key: "sales:sales_invoice", label: "فاتورة مبيعات", method: "POST", postPrefix: SALES_INVOICE_POSTING_API_PREFIX },
  { key: "sales:sales_return", label: "مرتجع / إشعار دائن", method: "POST", postPrefix: SALES_RETURN_POSTING_API_PREFIX },
  { key: "procurement:supplier_invoice", label: "فاتورة مورد", method: "POST", postPrefix: SUPPLIER_INVOICE_POSTING_API_PREFIX },
  { key: "procurement:supplier_payment", label: "سداد مورد", method: "POST", postPrefix: SUPPLIER_PAYMENT_POSTING_API_PREFIX },
  { key: "hr_payroll:payroll_run", label: "تشغيل رواتب", method: "POST", postPrefix: PAYROLL_RUN_POSTING_API_PREFIX },
];

function postingOptionByKey(sourceModule, sourceType) {
  return postingSourceOptions.find((item) => item.key === `${sourceModule}:${sourceType}`) || postingSourceOptions[0];
}

function serializePostingStatus(value) {
  if (!value) return "غير مفحوص";
  if (value === "exists") return "مقيد مسبقًا";
  if (value === "not_found") return "غير موجود";
  if (value === "ready") return "جاهز للترحيل";
  if (value === "created") return "تم إنشاء القيد";
  if (value === "error") return "خطأ";
  return value;
}

function postingBadgeClass(value) {
  if (value === "exists" || value === "created") return "success";
  if (value === "ready") return "warning";
  if (value === "error") return "danger";
  return "";
}

function mapPostingCandidatesFromJournalRows(rows) {
  const seen = new Set();
  return rows
    .filter((row) => row.source_module && row.source_type && row.source_id)
    .map((row) => ({
      source_module: row.source_module,
      source_type: row.source_type,
      source_id: String(row.source_id),
      posting_state: "exists",
      entry_number: row.entry_number || "",
      factory_name: row.factory_name || "",
      description: row.description || "",
    }))
    .filter((row) => {
      const key = `${row.source_module}:${row.source_type}:${row.source_id}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
}

export default function AccountingPage() {
  const { user, ready } = useAdminAuth("finance");
  const [chartAccounts, setChartAccounts] = useState([]);
  const [journalEntries, setJournalEntries] = useState([]);
  const [trialBalancePayload, setTrialBalancePayload] = useState(null);
  const [accountForm, setAccountForm] = useState(emptyAccountForm());
  const [journalForm, setJournalForm] = useState(emptyJournalForm());
  const [postingForm, setPostingForm] = useState(emptyPostingForm());
  const [postingMessage, setPostingMessage] = useState("");
  const [postingBusy, setPostingBusy] = useState(false);
  const [postingCheckBusy, setPostingCheckBusy] = useState(false);
  const [postingRows, setPostingRows] = useState([]);
  const [postingSearch, setPostingSearch] = useState("");
  const [postingStatusFilter, setPostingStatusFilter] = useState("all");
  const [postingPageSize, setPostingPageSize] = useState(20);
  const [postingPage, setPostingPage] = useState(1);

  const [message, setMessage] = useState("");
  const [submittingAccount, setSubmittingAccount] = useState(false);
  const [submittingJournal, setSubmittingJournal] = useState(false);
  const [showAccountForm, setShowAccountForm] = useState(true);
  const [showJournalForm, setShowJournalForm] = useState(true);
  const [showAutomationForm, setShowAutomationForm] = useState(true);

  const [chartSearch, setChartSearch] = useState("");
  const [chartTypeFilter, setChartTypeFilter] = useState("all");
  const [chartStatusFilter, setChartStatusFilter] = useState("all");
  const [chartPageSize, setChartPageSize] = useState(20);
  const [chartPage, setChartPage] = useState(1);

  const [journalSearch, setJournalSearch] = useState("");
  const [journalCurrencyFilter, setJournalCurrencyFilter] = useState("all");
  const [journalPageSize, setJournalPageSize] = useState(20);
  const [journalPage, setJournalPage] = useState(1);

  const [trialSearch, setTrialSearch] = useState("");
  const [trialTypeFilter, setTrialTypeFilter] = useState("all");
  const [trialPageSize, setTrialPageSize] = useState(20);
  const [trialPage, setTrialPage] = useState(1);

  const canManage = useMemo(() => hasPermission(user, "finance.manage"), [user]);

  async function loadAll() {
    const [chartRes, journalRes, trialRes] = await Promise.all([
      fetch(CHART_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(JOURNAL_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(TRIAL_BALANCE_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);

    const chartData = await chartRes.json().catch(() => []);
    const journalData = await journalRes.json().catch(() => []);
    const trialData = await trialRes.json().catch(() => ({}));

    if (!chartRes.ok) throw new Error(chartData.detail || "فشل تحميل دليل الحسابات");
    if (!journalRes.ok) throw new Error(journalData.detail || "فشل تحميل القيود اليومية");
    if (!trialRes.ok) throw new Error(trialData.detail || "فشل تحميل ميزان المراجعة");

    setChartAccounts(Array.isArray(chartData) ? chartData : []);
    setJournalEntries(Array.isArray(journalData) ? journalData : []);
    setTrialBalancePayload(trialData || null);

    setPostingRows((prev) => {
      const fromJournal = mapPostingCandidatesFromJournalRows(Array.isArray(journalData) ? journalData : []);
      const map = new Map();
      [...fromJournal, ...prev].forEach((item) => {
        const key = `${item.source_module}:${item.source_type}:${item.source_id}`;
        map.set(key, { ...map.get(key), ...item });
      });
      return Array.from(map.values());
    });
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء التحميل"));
  }, [ready, user]);

  useEffect(() => { setChartPage(1); }, [chartSearch, chartTypeFilter, chartStatusFilter, chartPageSize]);
  useEffect(() => { setJournalPage(1); }, [journalSearch, journalCurrencyFilter, journalPageSize]);
  useEffect(() => { setTrialPage(1); }, [trialSearch, trialTypeFilter, trialPageSize]);
  useEffect(() => { setPostingPage(1); }, [postingSearch, postingStatusFilter, postingPageSize]);

  const chartTypeOptions = useMemo(() => Array.from(new Set(chartAccounts.map((item) => String(item.account_type || "")).filter(Boolean))), [chartAccounts]);
  const journalCurrencyOptions = useMemo(() => Array.from(new Set(journalEntries.map((item) => String(item.currency || "")).filter(Boolean))), [journalEntries]);

  const filteredChartAccounts = useMemo(() => {
    const q = normalizeText(chartSearch);
    let rows = [...chartAccounts];
    rows = rows.filter((item) => {
      if (chartTypeFilter !== "all" && String(item.account_type || "") !== chartTypeFilter) return false;
      if (chartStatusFilter === "active" && item.is_active === false) return false;
      if (chartStatusFilter === "inactive" && item.is_active !== false) return false;
      if (!q) return true;
      return [item.id, item.account_code, item.account_name, item.account_type, item.parent_account_id].join(" ").toLowerCase().includes(q);
    });
    rows.sort((a, b) => String(a.account_code || "").localeCompare(String(b.account_code || "")));
    return rows;
  }, [chartAccounts, chartSearch, chartTypeFilter, chartStatusFilter]);

  const filteredJournalEntries = useMemo(() => {
    const q = normalizeText(journalSearch);
    let rows = [...journalEntries];
    rows = rows.filter((item) => {
      if (journalCurrencyFilter !== "all" && String(item.currency || "") !== journalCurrencyFilter) return false;
      if (!q) return true;
      return [
        item.id, item.entry_number, item.entry_date, item.description, item.source_module,
        item.source_type, item.source_id, item.factory_name, item.factory_id, item.currency,
      ].join(" ").toLowerCase().includes(q);
    });
    rows.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
    return rows;
  }, [journalEntries, journalSearch, journalCurrencyFilter]);

  const trialRows = Array.isArray(trialBalancePayload?.rows) ? trialBalancePayload.rows : [];
  const filteredTrialRows = useMemo(() => {
    const q = normalizeText(trialSearch);
    let rows = [...trialRows];
    rows = rows.filter((item) => {
      if (trialTypeFilter !== "all" && String(item.account_type || "") !== trialTypeFilter) return false;
      if (!q) return true;
      return [item.account_id, item.account_code, item.account_name, item.account_type].join(" ").toLowerCase().includes(q);
    });
    rows.sort((a, b) => String(a.account_code || "").localeCompare(String(b.account_code || "")));
    return rows;
  }, [trialRows, trialSearch, trialTypeFilter]);

  const filteredPostingRows = useMemo(() => {
    const q = normalizeText(postingSearch);
    let rows = [...postingRows];
    rows = rows.filter((item) => {
      if (postingStatusFilter !== "all" && String(item.posting_state || "") !== postingStatusFilter) return false;
      if (!q) return true;
      return [
        item.source_module,
        item.source_type,
        item.source_id,
        item.entry_number,
        item.factory_name,
        item.description,
        serializePostingStatus(item.posting_state),
      ].join(" ").toLowerCase().includes(q);
    });
    rows.sort((a, b) => {
      if (String(a.posting_state || "") === "exists" && String(b.posting_state || "") !== "exists") return -1;
      if (String(a.posting_state || "") !== "exists" && String(b.posting_state || "") === "exists") return 1;
      return String(a.source_module || "").localeCompare(String(b.source_module || ""));
    });
    return rows;
  }, [postingRows, postingSearch, postingStatusFilter]);

  const chartPagedRows = useMemo(() => filteredChartAccounts.slice((chartPage - 1) * chartPageSize, (chartPage - 1) * chartPageSize + chartPageSize), [filteredChartAccounts, chartPage, chartPageSize]);
  const journalPagedRows = useMemo(() => filteredJournalEntries.slice((journalPage - 1) * journalPageSize, (journalPage - 1) * journalPageSize + journalPageSize), [filteredJournalEntries, journalPage, journalPageSize]);
  const trialPagedRows = useMemo(() => filteredTrialRows.slice((trialPage - 1) * trialPageSize, (trialPage - 1) * trialPageSize + trialPageSize), [filteredTrialRows, trialPage, trialPageSize]);
  const postingPagedRows = useMemo(() => filteredPostingRows.slice((postingPage - 1) * postingPageSize, (postingPage - 1) * postingPageSize + postingPageSize), [filteredPostingRows, postingPage, postingPageSize]);

  const chartTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredChartAccounts.length / chartPageSize)), [filteredChartAccounts.length, chartPageSize]);
  const journalTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredJournalEntries.length / journalPageSize)), [filteredJournalEntries.length, journalPageSize]);
  const trialTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredTrialRows.length / trialPageSize)), [filteredTrialRows.length, trialPageSize]);
  const postingTotalPages = useMemo(() => Math.max(1, Math.ceil(filteredPostingRows.length / postingPageSize)), [filteredPostingRows.length, postingPageSize]);

  const stats = useMemo(() => {
    const totals = trialBalancePayload?.totals || {};
    return {
      totalAccounts: chartAccounts.length,
      activeAccounts: chartAccounts.filter((item) => item.is_active !== false).length,
      totalEntries: journalEntries.length,
      totalDebit: totals.total_debit || 0,
      totalCredit: totals.total_credit || 0,
      isBalanced: !!totals.is_balanced,
      totalPostingCandidates: postingRows.length,
      postedCandidates: postingRows.filter((item) => item.posting_state === "exists" || item.posting_state === "created").length,
    };
  }, [chartAccounts, journalEntries, trialBalancePayload, postingRows]);

  async function submitAccount(event) {
    event.preventDefault();
    if (!canManage) return;
    try {
      setSubmittingAccount(true);
      setMessage("");
      const res = await fetch(CHART_API_URL, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          account_code: accountForm.account_code.trim(),
          account_name: accountForm.account_name.trim(),
          account_type: accountForm.account_type,
          parent_account_id: accountForm.parent_account_id ? Number(accountForm.parent_account_id) : null,
          allow_manual_entries: !!accountForm.allow_manual_entries,
          is_active: !!accountForm.is_active,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "تعذر إنشاء الحساب");
      setAccountForm(emptyAccountForm());
      await loadAll();
      setMessage("تم إنشاء الحساب المحاسبي بنجاح.");
    } catch (err) {
      setMessage(err.message || "تعذر إنشاء الحساب");
    } finally {
      setSubmittingAccount(false);
    }
  }

  async function submitJournalEntry(event) {
    event.preventDefault();
    if (!canManage) return;
    try {
      setSubmittingJournal(true);
      setMessage("");
      let parsedLines = JSON.parse(journalForm.lines_json);
      if (!Array.isArray(parsedLines)) throw new Error("صيغة أسطر القيد غير صحيحة.");
      parsedLines = parsedLines.map((line) => ({
        account_id: Number(line.account_id || 0),
        line_description: line.line_description || null,
        debit_amount: Number(line.debit_amount || 0),
        credit_amount: Number(line.credit_amount || 0),
      }));

      const res = await fetch(JOURNAL_API_URL, {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          entry_date: journalForm.entry_date || null,
          source_module: journalForm.source_module.trim() || null,
          source_type: journalForm.source_type.trim() || null,
          source_id: journalForm.source_id ? Number(journalForm.source_id) : null,
          factory_id: journalForm.factory_id ? Number(journalForm.factory_id) : null,
          currency: journalForm.currency.trim() || "EGP",
          description: journalForm.description.trim() || null,
          lines: parsedLines,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "تعذر إنشاء القيد");
      setJournalForm(emptyJournalForm());
      await loadAll();
      setMessage(`تم إنشاء القيد ${data.entry_number || ""} بنجاح.`);
    } catch (err) {
      setMessage(err.message || "تعذر إنشاء القيد");
    } finally {
      setSubmittingJournal(false);
    }
  }

  function pagingSummary(total, page, pageSize) {
    const start = total === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, total);
    return { start, end, total };
  }

  const chartSummary = pagingSummary(filteredChartAccounts.length, chartPage, chartPageSize);
  const journalSummary = pagingSummary(filteredJournalEntries.length, journalPage, journalPageSize);
  const trialSummary = pagingSummary(filteredTrialRows.length, trialPage, trialPageSize);
  const postingSummary = pagingSummary(filteredPostingRows.length, postingPage, postingPageSize);

  async function checkPostingSource(sourceModule, sourceType, sourceId) {
    if (!sourceModule || !sourceType || !sourceId) return;

    try {
      setPostingCheckBusy(true);
      setPostingMessage("");
      const url = `${SOURCE_CHECK_API_BASE}?source_module=${encodeURIComponent(sourceModule)}&source_type=${encodeURIComponent(sourceType)}&source_id=${encodeURIComponent(sourceId)}`;
      const res = await fetch(url, { headers: authHeaders(), cache: "no-store" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "تعذر فحص حالة الترحيل");

      setPostingRows((prev) => {
        const key = `${sourceModule}:${sourceType}:${sourceId}`;
        const existing = prev.find((item) => `${item.source_module}:${item.source_type}:${item.source_id}` === key);
        const nextItem = {
          source_module: sourceModule,
          source_type: sourceType,
          source_id: String(sourceId),
          posting_state: data.exists ? "exists" : "ready",
          entry_number: data.entry?.entry_number || existing?.entry_number || "",
          factory_name: data.entry?.factory_name || existing?.factory_name || "",
          description: data.entry?.description || existing?.description || "",
        };
        return [nextItem, ...prev.filter((item) => `${item.source_module}:${item.source_type}:${item.source_id}` !== key)];
      });

      setPostingMessage(data.exists ? "تم العثور على قيد سابق لهذا المصدر." : "لا يوجد قيد سابق، المصدر جاهز للترحيل.");
    } catch (err) {
      setPostingMessage(err.message || "تعذر فحص حالة الترحيل");
    } finally {
      setPostingCheckBusy(false);
    }
  }

  async function triggerPosting(sourceModule, sourceType, sourceId) {
    if (!canManage) return;
    if (!sourceModule || !sourceType || !sourceId) return;

    const option = postingOptionByKey(sourceModule, sourceType);
    try {
      setPostingBusy(true);
      setPostingMessage("");

      const res = await fetch(`${option.postPrefix}/${encodeURIComponent(sourceId)}`, {
        method: "POST",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "تعذر إنشاء القيد التشغيلي");

      setPostingRows((prev) => {
        const key = `${sourceModule}:${sourceType}:${sourceId}`;
        const nextItem = {
          source_module: sourceModule,
          source_type: sourceType,
          source_id: String(sourceId),
          posting_state: "created",
          entry_number: data.entry_number || "",
          factory_name: data.factory_name || "",
          description: data.description || "",
        };
        return [nextItem, ...prev.filter((item) => `${item.source_module}:${item.source_type}:${item.source_id}` !== key)];
      });

      await loadAll();
      setPostingMessage(`تم إنشاء قيد تشغيلي بنجاح للمصدر ${sourceModule}/${sourceType}/${sourceId}.`);
    } catch (err) {
      setPostingMessage(err.message || "تعذر إنشاء القيد التشغيلي");
      setPostingRows((prev) => {
        const key = `${sourceModule}:${sourceType}:${sourceId}`;
        const existing = prev.find((item) => `${item.source_module}:${item.source_type}:${item.source_id}` === key);
        const nextItem = {
          source_module: sourceModule,
          source_type: sourceType,
          source_id: String(sourceId),
          posting_state: "error",
          entry_number: existing?.entry_number || "",
          factory_name: existing?.factory_name || "",
          description: err.message || existing?.description || "",
        };
        return [nextItem, ...prev.filter((item) => `${item.source_module}:${item.source_type}:${item.source_id}` !== key)];
      });
    } finally {
      setPostingBusy(false);
    }
  }

  async function handlePostingFormCheck(event) {
    event.preventDefault();
    await checkPostingSource(postingForm.source_module, postingForm.source_type, postingForm.source_id.trim());
  }

  async function handlePostingFormSubmit(event) {
    event.preventDefault();
    await triggerPosting(postingForm.source_module, postingForm.source_type, postingForm.source_id.trim());
  }

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل المحاسبة...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">Accounting Workspace</div>
            <h2>المحاسبة</h2>
            <p>
              سطح محاسبي احترافي على نفس pattern صفحة المنتجات، يشمل ميزان المراجعة، دليل الحسابات، القيود اليومية،
              وتصدير CSV/PDF، مع سطح تشغيلي جديد للترحيل المحاسبي من المبيعات والمشتريات والرواتب.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={() => setShowAutomationForm((prev) => !prev)}>
              {showAutomationForm ? "إخفاء ترحيل التشغيل" : "فتح ترحيل التشغيل"}
            </button>
            <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={() => setShowAccountForm((prev) => !prev)}>
              {showAccountForm ? "إخفاء نموذج الحسابات" : "فتح نموذج الحسابات"}
            </button>
            <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={() => setShowJournalForm((prev) => !prev)}>
              {showJournalForm ? "إخفاء نموذج القيود" : "فتح نموذج القيود"}
            </button>
            <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={() => exportAccountingCsv({ trialRows: filteredTrialRows, journalRows: filteredJournalEntries, chartRows: filteredChartAccounts })}>
              Export CSV
            </button>
            <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={() => exportAccountingPdf({ trialRows: filteredTrialRows, journalRows: filteredJournalEntries, chartRows: filteredChartAccounts, stats })}>
              Export PDF
            </button>
          </div>
        </section>

        {message ? <div className="erp-form-message" style={{ marginBottom: "18px" }}>{message}</div> : null}
        {postingMessage ? <div className="erp-form-message" style={{ marginBottom: "18px" }}>{postingMessage}</div> : null}

        <section className="erp-kpi-grid" style={{ marginBottom: "16px" }}>
          <div className="erp-card"><div className="erp-card-title">إجمالي الحسابات</div><div className="erp-card-value">{stats.totalAccounts}</div><div className="erp-card-note">الحسابات الموجودة في الدليل</div></div>
          <div className="erp-card"><div className="erp-card-title">الحسابات النشطة</div><div className="erp-card-value">{stats.activeAccounts}</div><div className="erp-card-note">الحسابات القابلة للاستخدام</div></div>
          <div className="erp-card"><div className="erp-card-title">إجمالي القيود</div><div className="erp-card-value">{stats.totalEntries}</div><div className="erp-card-note">القيود اليومية المسجلة</div></div>
          <div className="erp-card"><div className="erp-card-title">حالة التوازن</div><div className="erp-card-value">{stats.isBalanced ? "Yes" : "No"}</div><div className="erp-card-note">ميزان المراجعة الحالي</div></div>
          <div className="erp-card"><div className="erp-card-title">مصادر الترحيل</div><div className="erp-card-value">{stats.totalPostingCandidates}</div><div className="erp-card-note">سجل المصادر المفحوصة أو المقيدة</div></div>
          <div className="erp-card"><div className="erp-card-title">مصادر مقيدة</div><div className="erp-card-value">{stats.postedCandidates}</div><div className="erp-card-note">مقيدة مسبقًا أو تم ترحيلها الآن</div></div>
        </section>

        <div className="erp-section-card" style={{ marginBottom: "18px", display: "grid", gap: "16px" }}>
          <div className="erp-section-head" style={{ marginBottom: 0 }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ margin: 0 }}>ترحيل التشغيل إلى القيود</h3>
              <p style={{ margin: "6px 0 0" }}>
                سطح ترحيل محاسبي مباشر من الـ admin surface للمصادر التي أصبحت مدعومة في backend:
                فواتير المبيعات، المرتجعات، فواتير الموردين، مدفوعات الموردين، وتشغيل الرواتب.
              </p>
            </div>
            <div className="erp-mini-note">{showAutomationForm ? "نموذج الترحيل ظاهر" : "نموذج الترحيل مخفي"}</div>
          </div>

          {showAutomationForm ? (
            <div style={sectionCardStyle}>
              <h4 style={sectionTitleStyle}>فحص مصدر وتشغيل الترحيل</h4>
              <p style={sectionNoteStyle}>استخدم هذا النموذج بنفس نمط صفحات الإدارة الحالية لفحص حالة المصدر أولًا ثم تنفيذ POST على endpoint المناسب.</p>

              {canManage ? (
                <form className="erp-form-grid" style={{ gap: "16px", marginTop: "14px" }}>
                  <div className="erp-form-grid erp-form-grid-3">
                    <div>
                      <label className="erp-label">نوع المصدر</label>
                      <select
                        className="erp-input"
                        value={`${postingForm.source_module}:${postingForm.source_type}`}
                        onChange={(e) => {
                          const [sourceModule, sourceType] = String(e.target.value).split(":");
                          setPostingForm((prev) => ({ ...prev, source_module: sourceModule, source_type: sourceType }));
                        }}
                      >
                        {postingSourceOptions.map((option) => (
                          <option key={option.key} value={option.key}>{option.label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="erp-label">Source Module</label>
                      <input className="erp-input" value={postingForm.source_module} onChange={(e) => setPostingForm((prev) => ({ ...prev, source_module: e.target.value }))} />
                    </div>
                    <div>
                      <label className="erp-label">Source Type</label>
                      <input className="erp-input" value={postingForm.source_type} onChange={(e) => setPostingForm((prev) => ({ ...prev, source_type: e.target.value }))} />
                    </div>
                    <div>
                      <label className="erp-label">Source ID</label>
                      <input className="erp-input" value={postingForm.source_id} onChange={(e) => setPostingForm((prev) => ({ ...prev, source_id: e.target.value }))} />
                    </div>
                  </div>

                  <div className="erp-form-actions" style={{ gridColumn: "1 / -1", gap: "10px", flexWrap: "wrap" }}>
                    <button className="erp-btn-secondary" type="button" onClick={handlePostingFormCheck} disabled={postingCheckBusy || !postingForm.source_id.trim()}>
                      {postingCheckBusy ? "جارٍ الفحص..." : "فحص المصدر"}
                    </button>
                    <button className="erp-btn-primary" type="button" onClick={handlePostingFormSubmit} disabled={postingBusy || !postingForm.source_id.trim()}>
                      {postingBusy ? "جارٍ الترحيل..." : "تشغيل الترحيل"}
                    </button>
                    <button className="erp-btn-secondary" type="button" onClick={() => setPostingForm(emptyPostingForm())}>
                      إعادة تعيين
                    </button>
                  </div>
                </form>
              ) : (
                <div className="erp-mini-note">ليس لديك صلاحية تشغيل الترحيل المحاسبي.</div>
              )}
            </div>
          ) : null}

          <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px", marginTop: "2px" }}>
            <div style={{ textAlign: "right" }}>
              <h4 style={{ ...sectionTitleStyle, marginBottom: "4px" }}>سجل الترحيل التشغيلي</h4>
              <p style={{ margin: 0, color: "var(--rp-text-muted)" }}>سجل فحص وترحيل المصادر من نفس صفحة المحاسبة بدون الحاجة للانتقال بين الشاشات.</p>
            </div>

            <div style={{ display: "grid", gap: "10px", width: "100%" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input
                  className="erp-input"
                  style={{ ...compactControlStyle, flex: "1 1 260px", minWidth: "220px" }}
                  placeholder="ابحث بالمصدر أو الرقم أو الوصف..."
                  value={postingSearch}
                  onChange={(e) => setPostingSearch(e.target.value)}
                />
                <select
                  className="erp-input"
                  style={{ ...compactControlStyle, flex: "1 1 160px", minWidth: "150px" }}
                  value={postingStatusFilter}
                  onChange={(e) => setPostingStatusFilter(e.target.value)}
                >
                  <option value="all">كل الحالات</option>
                  <option value="exists">مقيد مسبقًا</option>
                  <option value="ready">جاهز للترحيل</option>
                  <option value="created">تم الترحيل</option>
                  <option value="error">أخطاء</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <div className="erp-mini-note">المعروض: {postingSummary.start}-{postingSummary.end} من {postingSummary.total}</div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <span className="erp-mini-note">عدد الصفوف</span>
                  <select
                    className="erp-input"
                    style={{ ...compactControlStyle, width: "96px" }}
                    value={postingPageSize}
                    onChange={(e) => setPostingPageSize(Number(e.target.value))}
                  >
                    {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="erp-table-shell" style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "16px", maxHeight: "70vh", background: "var(--rp-surface)" }}>
            <table className="erp-table" style={{ minWidth: "1220px" }}>
              <thead>
                <tr>
                  <th style={compactTableHeaderStyle}>المصدر</th>
                  <th style={compactTableHeaderStyle}>Source ID</th>
                  <th style={compactTableHeaderStyle}>الحالة</th>
                  <th style={compactTableHeaderStyle}>رقم القيد</th>
                  <th style={compactTableHeaderStyle}>المصنع</th>
                  <th style={compactTableHeaderStyle}>الوصف</th>
                  <th style={compactTableHeaderStyle}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {postingPagedRows.length === 0 ? (
                  <tr><td colSpan="7" style={compactCellStyle}>لا توجد مصادر ترحيل بعد. ابدأ بفحص أي source من النموذج أعلاه.</td></tr>
                ) : (
                  postingPagedRows.map((row) => (
                    <tr key={`${row.source_module}:${row.source_type}:${row.source_id}`}>
                      <td style={compactCellStyle}>{postingOptionByKey(row.source_module, row.source_type)?.label || `${row.source_module}/${row.source_type}`}</td>
                      <td style={compactCellStyle}>{row.source_id}</td>
                      <td style={compactCellStyle}>
                        <span className={`erp-badge ${postingBadgeClass(row.posting_state)}`}>
                          {serializePostingStatus(row.posting_state)}
                        </span>
                      </td>
                      <td style={compactCellStyle}>{row.entry_number || "-"}</td>
                      <td style={compactCellStyle}>{row.factory_name || "-"}</td>
                      <td style={compactCellStyle}>{row.description || "-"}</td>
                      <td style={compactCellStyle}>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button className="erp-btn-secondary" style={{ ...topButtonStyle, minHeight: "36px" }} type="button" onClick={() => checkPostingSource(row.source_module, row.source_type, row.source_id)} disabled={postingCheckBusy}>
                            فحص
                          </button>
                          <button className="erp-btn-primary" style={{ ...topButtonStyle, minHeight: "36px" }} type="button" onClick={() => triggerPosting(row.source_module, row.source_type, row.source_id)} disabled={postingBusy || row.posting_state === "exists"}>
                            ترحيل
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "14px" }}>
            <div className="erp-mini-note">صفحة {postingPage} من {postingTotalPages}</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setPostingPage(1)} disabled={postingPage === 1}>الأولى</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setPostingPage((prev) => Math.max(1, prev - 1))} disabled={postingPage === 1}>السابقة</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setPostingPage((prev) => Math.min(postingTotalPages, prev + 1))} disabled={postingPage === postingTotalPages}>التالية</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setPostingPage(postingTotalPages)} disabled={postingPage === postingTotalPages}>الأخيرة</button>
            </div>
          </div>
        </div>

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ marginBottom: "4px" }}>ميزان المراجعة</h3>
              <p style={{ margin: 0 }}>جدول احترافي لعرض أرصدة الحسابات مع فلترة وبحث وتصفح.</p>
            </div>
            <div style={{ display: "grid", gap: "10px", width: "100%" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input className="erp-input" style={{ ...compactControlStyle, flex: "1 1 260px", minWidth: "220px" }} placeholder="ابحث بالكود أو اسم الحساب أو النوع..." value={trialSearch} onChange={(e) => setTrialSearch(e.target.value)} />
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 150px", minWidth: "140px" }} value={trialTypeFilter} onChange={(e) => setTrialTypeFilter(e.target.value)}>
                  <option value="all">كل الأنواع</option>
                  {chartTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <div className={`erp-badge ${stats.isBalanced ? "success" : "warning"}`}>{stats.isBalanced ? "Balanced" : "Needs Review"}</div>
                </div>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <span className="erp-mini-note">المعروض: {trialSummary.start}-{trialSummary.end} من {trialSummary.total}</span>
                  <span className="erp-mini-note">عدد الصفوف</span>
                  <select className="erp-input" style={{ ...compactControlStyle, width: "96px" }} value={trialPageSize} onChange={(e) => setTrialPageSize(Number(e.target.value))}>
                    {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="erp-table-shell" style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "16px", maxHeight: "70vh", background: "var(--rp-surface)" }}>
            <table className="erp-table" style={{ minWidth: "1120px" }}>
              <thead>
                <tr>
                  <th style={compactTableHeaderStyle}>الكود</th>
                  <th style={compactTableHeaderStyle}>الحساب</th>
                  <th style={compactTableHeaderStyle}>النوع</th>
                  <th style={compactTableHeaderStyle}>إجمالي المدين</th>
                  <th style={compactTableHeaderStyle}>إجمالي الدائن</th>
                  <th style={compactTableHeaderStyle}>الرصيد</th>
                </tr>
              </thead>
              <tbody>
                {trialPagedRows.length === 0 ? (
                  <tr><td colSpan="6" style={compactCellStyle}>لا توجد بيانات مطابقة.</td></tr>
                ) : (
                  trialPagedRows.map((row) => (
                    <tr key={row.account_id}>
                      <td style={compactCellStyle}>{row.account_code || "-"}</td>
                      <td style={compactCellStyle}>{row.account_name || "-"}</td>
                      <td style={compactCellStyle}>{row.account_type || "-"}</td>
                      <td style={compactCellStyle}>{formatAmount(row.total_debit)}</td>
                      <td style={compactCellStyle}>{formatAmount(row.total_credit)}</td>
                      <td style={compactCellStyle}>{formatAmount(row.balance)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "14px" }}>
            <div className="erp-mini-note">صفحة {trialPage} من {trialTotalPages}</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setTrialPage(1)} disabled={trialPage === 1}>الأولى</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setTrialPage((prev) => Math.max(1, prev - 1))} disabled={trialPage === 1}>السابقة</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setTrialPage((prev) => Math.min(trialTotalPages, prev + 1))} disabled={trialPage === trialTotalPages}>التالية</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setTrialPage(trialTotalPages)} disabled={trialPage === trialTotalPages}>الأخيرة</button>
            </div>
          </div>
        </div>

        <div className="erp-section-card" style={{ marginBottom: "18px", display: "grid", gap: "16px" }}>
          <div className="erp-section-head" style={{ marginBottom: 0 }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ margin: 0 }}>دليل الحسابات</h3>
              <p style={{ margin: "6px 0 0" }}>نفس pattern صفحة المنتجات: جدول واضح + فلترة + نموذج منفصل ومنظم.</p>
            </div>
            <div className="erp-mini-note">{showAccountForm ? "نموذج الحسابات ظاهر" : "نموذج الحسابات مخفي"}</div>
          </div>

          {showAccountForm ? (
            <div style={sectionCardStyle}>
              <h4 style={sectionTitleStyle}>إنشاء حساب جديد</h4>
              <p style={sectionNoteStyle}>إضافة حساب جديد إلى دليل الحسابات مع النوع والحساب الأب وخيارات التفعيل.</p>

              {canManage ? (
                <form className="erp-form-grid" onSubmit={submitAccount} style={{ gap: "16px", marginTop: "14px" }}>
                  <div className="erp-form-grid erp-form-grid-2">
                    <div><label className="erp-label">كود الحساب</label><input className="erp-input" value={accountForm.account_code} onChange={(e) => setAccountForm((prev) => ({ ...prev, account_code: e.target.value }))} /></div>
                    <div><label className="erp-label">اسم الحساب</label><input className="erp-input" value={accountForm.account_name} onChange={(e) => setAccountForm((prev) => ({ ...prev, account_name: e.target.value }))} /></div>
                    <div>
                      <label className="erp-label">نوع الحساب</label>
                      <select className="erp-input" value={accountForm.account_type} onChange={(e) => setAccountForm((prev) => ({ ...prev, account_type: e.target.value }))}>
                        <option value="asset">Asset</option><option value="liability">Liability</option><option value="equity">Equity</option><option value="revenue">Revenue</option><option value="expense">Expense</option>
                      </select>
                    </div>
                    <div><label className="erp-label">الحساب الأب (اختياري)</label><input className="erp-input" value={accountForm.parent_account_id} onChange={(e) => setAccountForm((prev) => ({ ...prev, parent_account_id: e.target.value }))} /></div>
                  </div>

                  <div className="erp-checkbox-grid">
                    <label className="erp-check"><input type="checkbox" checked={accountForm.allow_manual_entries} onChange={(e) => setAccountForm((prev) => ({ ...prev, allow_manual_entries: e.target.checked }))} /><span>يسمح بقيود يدوية</span></label>
                    <label className="erp-check"><input type="checkbox" checked={accountForm.is_active} onChange={(e) => setAccountForm((prev) => ({ ...prev, is_active: e.target.checked }))} /><span>نشط</span></label>
                  </div>

                  <div className="erp-form-actions" style={{ gridColumn: "1 / -1", gap: "10px", flexWrap: "wrap" }}>
                    <button className="erp-btn-primary" type="submit" disabled={submittingAccount}>{submittingAccount ? "جارٍ الحفظ..." : "حفظ الحساب"}</button>
                    <button className="erp-btn-secondary" type="button" onClick={() => setAccountForm(emptyAccountForm())}>إعادة تعيين</button>
                  </div>
                </form>
              ) : (
                <div className="erp-mini-note">ليس لديك صلاحية إنشاء حسابات جديدة.</div>
              )}
            </div>
          ) : null}

          <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px", marginTop: "2px" }}>
            <div style={{ textAlign: "right" }}>
              <h4 style={{ ...sectionTitleStyle, marginBottom: "4px" }}>سجل الحسابات</h4>
              <p style={{ margin: 0, color: "var(--rp-text-muted)" }}>جدول احترافي مناسب لإدارة عدد كبير من الحسابات.</p>
            </div>

            <div style={{ display: "grid", gap: "10px", width: "100%" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input className="erp-input" style={{ ...compactControlStyle, flex: "1 1 260px", minWidth: "220px" }} placeholder="ابحث بالكود أو الاسم أو النوع..." value={chartSearch} onChange={(e) => setChartSearch(e.target.value)} />
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 150px", minWidth: "140px" }} value={chartTypeFilter} onChange={(e) => setChartTypeFilter(e.target.value)}>
                  <option value="all">كل الأنواع</option>
                  {chartTypeOptions.map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 150px", minWidth: "140px" }} value={chartStatusFilter} onChange={(e) => setChartStatusFilter(e.target.value)}>
                  <option value="all">كل الحالات</option><option value="active">نشط</option><option value="inactive">غير نشط</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={() => exportAccountingCsv({ trialRows: filteredTrialRows, journalRows: filteredJournalEntries, chartRows: filteredChartAccounts })}>Export CSV</button>
                  <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={() => exportAccountingPdf({ trialRows: filteredTrialRows, journalRows: filteredJournalEntries, chartRows: filteredChartAccounts, stats })}>Export PDF</button>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <span className="erp-mini-note">المعروض: {chartSummary.start}-{chartSummary.end} من {chartSummary.total}</span>
                  <span className="erp-mini-note">عدد الصفوف</span>
                  <select className="erp-input" style={{ ...compactControlStyle, width: "96px" }} value={chartPageSize} onChange={(e) => setChartPageSize(Number(e.target.value))}>
                    {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="erp-table-shell" style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "16px", maxHeight: "70vh", background: "var(--rp-surface)" }}>
            <table className="erp-table" style={{ minWidth: "1100px" }}>
              <thead><tr><th style={compactTableHeaderStyle}>الكود</th><th style={compactTableHeaderStyle}>الاسم</th><th style={compactTableHeaderStyle}>النوع</th><th style={compactTableHeaderStyle}>الأب</th><th style={compactTableHeaderStyle}>يدوي</th><th style={compactTableHeaderStyle}>نشط</th></tr></thead>
              <tbody>
                {chartPagedRows.length === 0 ? <tr><td colSpan="6" style={compactCellStyle}>لا توجد حسابات مطابقة.</td></tr> : chartPagedRows.map((row) => (
                  <tr key={row.id}>
                    <td style={compactCellStyle}>{row.account_code || "-"}</td>
                    <td style={compactCellStyle}>{row.account_name || "-"}</td>
                    <td style={compactCellStyle}>{row.account_type || "-"}</td>
                    <td style={compactCellStyle}>{row.parent_account_id || "-"}</td>
                    <td style={compactCellStyle}>{row.allow_manual_entries ? "نعم" : "لا"}</td>
                    <td style={compactCellStyle}>{row.is_active ? "نعم" : "لا"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "14px" }}>
            <div className="erp-mini-note">صفحة {chartPage} من {chartTotalPages}</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setChartPage(1)} disabled={chartPage === 1}>الأولى</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setChartPage((prev) => Math.max(1, prev - 1))} disabled={chartPage === 1}>السابقة</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setChartPage((prev) => Math.min(chartTotalPages, prev + 1))} disabled={chartPage === chartTotalPages}>التالية</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setChartPage(chartTotalPages)} disabled={chartPage === chartTotalPages}>الأخيرة</button>
            </div>
          </div>
        </div>

        <div className="erp-section-card" style={{ marginBottom: "18px", display: "grid", gap: "16px" }}>
          <div className="erp-section-head" style={{ marginBottom: 0 }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ margin: 0 }}>القيود اليومية</h3>
              <p style={{ margin: "6px 0 0" }}>سجل احترافي للقيود اليومية مع نموذج منفصل وواضح للإنشاء اليدوي.</p>
            </div>
            <div className="erp-mini-note">{showJournalForm ? "نموذج القيود ظاهر" : "نموذج القيود مخفي"}</div>
          </div>

          {showJournalForm ? (
            <div style={sectionCardStyle}>
              <h4 style={sectionTitleStyle}>إنشاء قيد يومية</h4>
              <p style={sectionNoteStyle}>نموذج منظم على نفس pattern صفحة المنتجات مع textarea للأسطر بصيغة JSON.</p>

              {canManage ? (
                <form className="erp-form-grid" onSubmit={submitJournalEntry} style={{ gap: "16px", marginTop: "14px" }}>
                  <div className="erp-form-grid erp-form-grid-3">
                    <div><label className="erp-label">التاريخ</label><input className="erp-input" type="datetime-local" value={journalForm.entry_date} onChange={(e) => setJournalForm((prev) => ({ ...prev, entry_date: e.target.value }))} /></div>
                    <div><label className="erp-label">Factory ID (اختياري)</label><input className="erp-input" value={journalForm.factory_id} onChange={(e) => setJournalForm((prev) => ({ ...prev, factory_id: e.target.value }))} /></div>
                    <div><label className="erp-label">Currency</label><input className="erp-input" value={journalForm.currency} onChange={(e) => setJournalForm((prev) => ({ ...prev, currency: e.target.value }))} /></div>
                    <div><label className="erp-label">Source Module</label><input className="erp-input" value={journalForm.source_module} onChange={(e) => setJournalForm((prev) => ({ ...prev, source_module: e.target.value }))} /></div>
                    <div><label className="erp-label">Source Type</label><input className="erp-input" value={journalForm.source_type} onChange={(e) => setJournalForm((prev) => ({ ...prev, source_type: e.target.value }))} /></div>
                    <div><label className="erp-label">Source ID</label><input className="erp-input" value={journalForm.source_id} onChange={(e) => setJournalForm((prev) => ({ ...prev, source_id: e.target.value }))} /></div>
                  </div>

                  <div><label className="erp-label">وصف القيد</label><textarea className="erp-input" rows="3" value={journalForm.description} onChange={(e) => setJournalForm((prev) => ({ ...prev, description: e.target.value }))} /></div>
                  <div>
                    <label className="erp-label">صيغة الأسطر (JSON Array)</label>
                    <textarea className="erp-input" rows="8" style={{ fontFamily: "monospace", direction: "ltr", textAlign: "left" }} value={journalForm.lines_json} onChange={(e) => setJournalForm((prev) => ({ ...prev, lines_json: e.target.value }))} />
                    <div className="erp-mini-note" style={{ marginTop: "8px" }}>يجب أن يكون القيد متوازنًا قبل الحفظ.</div>
                  </div>

                  <div className="erp-form-actions" style={{ gridColumn: "1 / -1", gap: "10px", flexWrap: "wrap" }}>
                    <button className="erp-btn-primary" type="submit" disabled={submittingJournal}>{submittingJournal ? "جارٍ الحفظ..." : "حفظ القيد"}</button>
                    <button className="erp-btn-secondary" type="button" onClick={() => setJournalForm(emptyJournalForm())}>إعادة تعيين</button>
                  </div>
                </form>
              ) : (
                <div className="erp-mini-note">ليس لديك صلاحية إنشاء قيود جديدة.</div>
              )}
            </div>
          ) : null}

          <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px", marginTop: "2px" }}>
            <div style={{ textAlign: "right" }}>
              <h4 style={{ ...sectionTitleStyle, marginBottom: "4px" }}>سجل القيود</h4>
              <p style={{ margin: 0, color: "var(--rp-text-muted)" }}>جدول احترافي مناسب للتصفح والفلترة والطباعة.</p>
            </div>

            <div style={{ display: "grid", gap: "10px", width: "100%" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input className="erp-input" style={{ ...compactControlStyle, flex: "1 1 260px", minWidth: "220px" }} placeholder="ابحث برقم القيد أو الوصف أو المصدر..." value={journalSearch} onChange={(e) => setJournalSearch(e.target.value)} />
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 150px", minWidth: "140px" }} value={journalCurrencyFilter} onChange={(e) => setJournalCurrencyFilter(e.target.value)}>
                  <option value="all">كل العملات</option>
                  {journalCurrencyOptions.map((currency) => <option key={currency} value={currency}>{currency}</option>)}
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={() => exportAccountingCsv({ trialRows: filteredTrialRows, journalRows: filteredJournalEntries, chartRows: filteredChartAccounts })}>Export CSV</button>
                  <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={() => exportAccountingPdf({ trialRows: filteredTrialRows, journalRows: filteredJournalEntries, chartRows: filteredChartAccounts, stats })}>Export PDF</button>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <span className="erp-mini-note">المعروض: {journalSummary.start}-{journalSummary.end} من {journalSummary.total}</span>
                  <span className="erp-mini-note">عدد الصفوف</span>
                  <select className="erp-input" style={{ ...compactControlStyle, width: "96px" }} value={journalPageSize} onChange={(e) => setJournalPageSize(Number(e.target.value))}>
                    {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="erp-table-shell" style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "16px", maxHeight: "70vh", background: "var(--rp-surface)" }}>
            <table className="erp-table" style={{ minWidth: "1280px" }}>
              <thead><tr><th style={compactTableHeaderStyle}>رقم القيد</th><th style={compactTableHeaderStyle}>التاريخ</th><th style={compactTableHeaderStyle}>المصنع</th><th style={compactTableHeaderStyle}>المصدر</th><th style={compactTableHeaderStyle}>العملة</th><th style={compactTableHeaderStyle}>إجمالي المدين</th><th style={compactTableHeaderStyle}>إجمالي الدائن</th><th style={compactTableHeaderStyle}>الوصف</th></tr></thead>
              <tbody>
                {journalPagedRows.length === 0 ? <tr><td colSpan="8" style={compactCellStyle}>لا توجد قيود مطابقة.</td></tr> : journalPagedRows.map((row) => (
                  <tr key={row.id}>
                    <td style={compactCellStyle}>{row.entry_number || "-"}</td>
                    <td style={compactCellStyle}>{row.entry_date || "-"}</td>
                    <td style={compactCellStyle}>{row.factory_name || row.factory_id || "-"}</td>
                    <td style={compactCellStyle}>{[row.source_module, row.source_type, row.source_id].filter(Boolean).join(" / ") || "-"}</td>
                    <td style={compactCellStyle}>{row.currency || "EGP"}</td>
                    <td style={compactCellStyle}>{formatAmount(row.total_debit)}</td>
                    <td style={compactCellStyle}>{formatAmount(row.total_credit)}</td>
                    <td style={compactCellStyle}>{row.description || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "14px" }}>
            <div className="erp-mini-note">صفحة {journalPage} من {journalTotalPages}</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setJournalPage(1)} disabled={journalPage === 1}>الأولى</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setJournalPage((prev) => Math.max(1, prev - 1))} disabled={journalPage === 1}>السابقة</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setJournalPage((prev) => Math.min(journalTotalPages, prev + 1))} disabled={journalPage === journalTotalPages}>التالية</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setJournalPage(journalTotalPages)} disabled={journalPage === journalTotalPages}>الأخيرة</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

