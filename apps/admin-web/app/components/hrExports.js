"use client";

function companyName() {
  return "Royal Palace Group";
}

function companyLogoUrl() {
  return "https://royalpalace-group.com/brand/logo.png";
}

function csvEscape(value) {
  const s = String(value ?? "");
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function downloadCsv(filename, headers, rows) {
  const lines = rows.map((row) => row.map(csvEscape).join(","));
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function openPdfPrint(title, subtitle, summaryCards, headers, rows) {
  const printWindow = window.open("", "_blank", "width=1280,height=900");
  if (!printWindow) return;

  const rowsHtml = rows
    .map((row) => `<tr>${row.map((cell) => `<td>${String(cell ?? "-")}</td>`).join("")}</tr>`)
    .join("");

  const summaryHtml = (summaryCards || [])
    .map((card) => `<div class="summary-card"><div class="label">${card.label}</div><div class="value">${card.value}</div></div>`)
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>${title}</title>
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
          table { width: 100%; border-collapse: collapse; }
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
              <p>${subtitle}</p>
            </div>
          </div>
          <div>عدد السجلات: ${rows.length}</div>
        </div>
        <div class="summary">${summaryHtml}</div>
        <table>
          <thead><tr>${headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>window.onload = function() { setTimeout(() => window.print(), 400); };</script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export function exportTableCsv(filename, headers, rows) {
  downloadCsv(filename, headers, rows);
}

export function exportTablePdf(title, subtitle, summaryCards, headers, rows) {
  openPdfPrint(title, subtitle, summaryCards, headers, rows);
}

export function exportTableXlsx(filename, headers, rows) {
  if (typeof window === "undefined") return;
  import("xlsx").then((XLSX) => {
    const sheetData = [headers, ...rows];
    const ws = XLSX.utils.aoa_to_sheet(sheetData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
    XLSX.writeFile(wb, filename);
  });
}

export function exportEmployeesCsv(rows, factoryMap, departmentMap) {
  downloadCsv("hr_employees_export.csv", ["ID","الكود","الاسم","المصنع","القسم","المسمى","الهاتف","البريد","الحالة الوظيفية","نشط"], rows.map((e) => [
    e.id, e.employee_code || "", `${e.first_name || ""} ${e.last_name || ""}`.trim(),
    factoryMap[e.factory_id] || `مصنع #${e.factory_id || ""}`,
    departmentMap[e.department_id] || `قسم #${e.department_id || ""}`,
    e.job_title || "", e.phone || "", e.email || "", e.employment_status || "", e.is_active ? "نعم" : "لا"
  ]));
}

export function exportEmployeesPdf(rows, factoryMap, departmentMap, stats) {
  openPdfPrint("تقرير الموظفين", "الموارد البشرية / الموظفون",
    [
      { label: "إجمالي الموظفين", value: stats?.total ?? rows.length },
      { label: "النشطون", value: stats?.active ?? 0 },
      { label: "غير النشطين", value: stats?.inactive ?? 0 },
      { label: "الأقسام المغطاة", value: stats?.departmentsCovered ?? 0 }
    ],
    ["ID","الكود","الاسم","المصنع","القسم","المسمى","الهاتف","الحالة"],
    rows.map((e) => [
      e.id, e.employee_code || "-", `${e.first_name || ""} ${e.last_name || ""}`.trim() || "-",
      factoryMap[e.factory_id] || `مصنع #${e.factory_id || ""}`,
      departmentMap[e.department_id] || `قسم #${e.department_id || ""}`,
      e.job_title || "-", e.phone || "-", e.is_active ? "نشط" : "غير نشط"
    ])
  );
}

export function exportAttendanceCsv(rows, employeeLabelFn) {
  downloadCsv("hr_attendance_export.csv", ["ID","الموظف","التاريخ","الحالة","الدخول","الخروج","التأخير","الإضافي","نصف يوم","المصدر","ملاحظات"], rows.map((r) => [
    r.id, employeeLabelFn(r), r.attendance_date || "", r.status || "", r.check_in_at || "", r.check_out_at || "", r.late_minutes || 0, r.overtime_minutes || 0, r.half_day_minutes || 0, r.source || "", r.notes || ""
  ]));
}

export function exportAttendancePdf(rows, employeeLabelFn, stats) {
  openPdfPrint("تقرير الحضور", "الموارد البشرية / الحضور والانصراف",
    [
      { label: "إجمالي السجلات", value: stats?.total ?? rows.length },
      { label: "حاضر", value: stats?.present ?? 0 },
      { label: "متأخر", value: stats?.late ?? 0 },
      { label: "غائب", value: stats?.absent ?? 0 }
    ],
    ["ID","الموظف","التاريخ","الحالة","الدخول","الخروج","التأخير","الإضافي","المصدر"],
    rows.map((r) => [r.id, employeeLabelFn(r), r.attendance_date || "-", r.status || "-", r.check_in_at || "-", r.check_out_at || "-", r.late_minutes || 0, r.overtime_minutes || 0, r.source || "-"])
  );
}

export function exportLeavesCsv(rows, employeeLabelFn) {
  downloadCsv("hr_leaves_export.csv", ["ID","الموظف","النوع","من","إلى","الأيام","مدفوعة","الحالة","ملاحظات"], rows.map((r) => [
    r.id, employeeLabelFn(r), r.leave_type || "", r.start_date || "", r.end_date || "", r.total_days || 0, r.is_paid ? "نعم" : "لا", r.status || "", r.notes || ""
  ]));
}

export function exportLeavesPdf(rows, employeeLabelFn) {
  openPdfPrint("تقرير الإجازات", "الموارد البشرية / الإجازات",
    [{ label: "إجمالي الطلبات", value: rows.length }],
    ["ID","الموظف","النوع","من","إلى","الأيام","مدفوعة","الحالة"],
    rows.map((r) => [r.id, employeeLabelFn(r), r.leave_type || "-", r.start_date || "-", r.end_date || "-", r.total_days || 0, r.is_paid ? "نعم" : "لا", r.status || "-"])
  );
}

export function exportEvaluationsCsv(rows) {
  downloadCsv("hr_evaluations_export.csv", ["ID","الموظف","الشهر","السنة","الدرجة","الوصف","المكافأة","الخصم","الحالة","ملاحظات"], rows.map((r) => [
    r.id, r.employee_id || "", r.evaluation_month || "", r.evaluation_year || "", r.rating_score || "", r.rating_label || "", r.bonus_amount || 0, r.deduction_amount || 0, r.status || "", r.notes || ""
  ]));
}

export function exportEvaluationsPdf(rows) {
  openPdfPrint("تقرير التقييمات", "الموارد البشرية / التقييمات",
    [{ label: "إجمالي التقييمات", value: rows.length }],
    ["ID","الموظف","الفترة","الدرجة","الوصف","المكافأة","الخصم","الحالة"],
    rows.map((r) => [r.id, r.employee_id || "-", `${r.evaluation_month || "-"} / ${r.evaluation_year || "-"}`, r.rating_score || 0, r.rating_label || "-", r.bonus_amount || 0, r.deduction_amount || 0, r.status || "-"])
  );
}

export function exportCompensationsCsv(rows, employeeLabelFn) {
  downloadCsv("hr_compensations_export.csv", ["ID","الموظف","الأساسي","السكن","المواصلات","الوجبات","أخرى","خصومات ثابتة","العملة","ساري من"], rows.map((r) => [
    r.id, employeeLabelFn(r), r.basic_salary || 0, r.housing_allowance || 0, r.transport_allowance || 0, r.meal_allowance || 0, r.other_allowance || 0, r.fixed_deductions || 0, r.currency || "", r.effective_from || ""
  ]));
}

export function exportCompensationsPdf(rows, employeeLabelFn) {
  openPdfPrint("تقرير التعويضات", "الموارد البشرية / التعويضات",
    [{ label: "إجمالي الملفات", value: rows.length }],
    ["ID","الموظف","الأساسي","السكن","المواصلات","الوجبات","أخرى","خصومات","العملة","ساري من"],
    rows.map((r) => [r.id, employeeLabelFn(r), r.basic_salary || 0, r.housing_allowance || 0, r.transport_allowance || 0, r.meal_allowance || 0, r.other_allowance || 0, r.fixed_deductions || 0, r.currency || "-", r.effective_from || "-"])
  );
}

export function exportPayrollRunsCsv(rows) {
  downloadCsv("hr_payroll_runs_export.csv", ["ID","الحالة","الموظفون","إجمالي الصافي","المكافآت","الخصومات","معلق","مدفوع","مستلم"], rows.map((r) => [
    r.id, r.status || "", r.employees_count || 0, r.net_salary_total || 0, r.bonuses_total || 0, r.deductions_total || 0, r.pending_receipts || 0, r.paid_receipts || 0, r.received_receipts || 0
  ]));
}

export function exportPayrollRunsPdf(rows, summary) {
  openPdfPrint("تقرير مسيرات الرواتب", "الموارد البشرية / الرواتب",
    [
      { label: "عدد المسيرات", value: summary?.runs_count || rows.length },
      { label: "إجمالي الصافي", value: summary?.net_salary_total || 0 },
      { label: "إيصالات معلقة", value: summary?.pending_receipts || 0 },
      { label: "إيصالات مدفوعة", value: summary?.paid_receipts || 0 }
    ],
    ["ID","الحالة","الموظفون","إجمالي الصافي","المكافآت","الخصومات","معلق","مدفوع","مستلم"],
    rows.map((r) => [r.id, r.status || "-", r.employees_count || 0, r.net_salary_total || 0, r.bonuses_total || 0, r.deductions_total || 0, r.pending_receipts || 0, r.paid_receipts || 0, r.received_receipts || 0])
  );
}

export function exportPayrollDetailsCsv(rows) {
  downloadCsv("hr_payroll_lines_export.csv", ["الموظف","الكود","الأساسي","البدلات","المكافآت","الخصومات","التأخير","نصف يوم","إجازة غير مدفوعة","الإضافي","الصافي","الإيصال"], rows.map((r) => [
    r.employee_name || "", r.employee_code || "", r.basic_salary || 0, r.allowances_total || 0, r.bonuses_total || 0, r.deductions_total || 0, r.late_deduction || 0, r.half_day_deduction || 0, r.unpaid_leave_deduction || 0, r.overtime_amount || 0, r.net_salary || 0, r.receipt_status || ""
  ]));
}

export function exportPayrollDetailsPdf(rows, runId) {
  openPdfPrint(`تفاصيل المسير #${runId}`, "الموارد البشرية / تفاصيل الرواتب",
    [{ label: "عدد السطور", value: rows.length }],
    ["الموظف","الكود","الأساسي","البدلات","المكافآت","الخصومات","الإضافي","الصافي","الإيصال"],
    rows.map((r) => [r.employee_name || "-", r.employee_code || "-", r.basic_salary || 0, r.allowances_total || 0, r.bonuses_total || 0, r.deductions_total || 0, r.overtime_amount || 0, r.net_salary || 0, r.receipt_status || "-"])
  );
}

export function exportReportsSummaryCsv(summary) {
  downloadCsv("hr_reports_summary.csv", ["البند","القيمة"], [
    ["الموظفون", summary?.employee_count || 0],
    ["ملفات الرواتب", summary?.compensation_count || 0],
    ["طلبات الإجازات", summary?.leave_summary?.total || 0],
    ["التقييمات", summary?.evaluation_summary?.total || 0],
    ["إجمالي صافي الرواتب", summary?.payroll_summary?.net_salary_total || 0],
    ["إيصالات معلقة", summary?.payroll_summary?.pending_receipts || 0]
  ]);
}

export function exportReportsSummaryPdf(summary) {
  openPdfPrint("ملخص الموارد البشرية", "الموارد البشرية / التقارير",
    [
      { label: "الموظفون", value: summary?.employee_count || 0 },
      { label: "ملفات الرواتب", value: summary?.compensation_count || 0 },
      { label: "طلبات الإجازات", value: summary?.leave_summary?.total || 0 },
      { label: "التقييمات", value: summary?.evaluation_summary?.total || 0 }
    ],
    ["البند","القيمة"],
    [
      ["إجمالي صافي الرواتب", summary?.payroll_summary?.net_salary_total || 0],
      ["إيصالات معلقة", summary?.payroll_summary?.pending_receipts || 0],
      ["إيصالات مدفوعة", summary?.payroll_summary?.paid_receipts || 0],
      ["إيصالات مستلمة", summary?.payroll_summary?.received_receipts || 0]
    ]
  );
}

export function exportReportsLinesCsv(rows) {
  downloadCsv("hr_reports_payroll_lines.csv", ["الموظف","الكود","الأساسي","البدلات","الخصومات","المكافآت","الإضافي","الصافي","الإيصال"], rows.map((r) => [
    r.employee_name || "", r.employee_code || "", r.basic_salary || 0, r.allowances_total || 0, r.deductions_total || 0, r.bonuses_total || 0, r.overtime_amount || 0, r.net_salary || 0, r.receipt_status || ""
  ]));
}

export function exportReportsLinesPdf(rows) {
  openPdfPrint("تقرير بنود الرواتب", "الموارد البشرية / التقارير",
    [{ label: "عدد البنود", value: rows.length }],
    ["الموظف","الكود","الأساسي","البدلات","الخصومات","المكافآت","الإضافي","الصافي","الإيصال"],
    rows.map((r) => [r.employee_name || "-", r.employee_code || "-", r.basic_salary || 0, r.allowances_total || 0, r.deductions_total || 0, r.bonuses_total || 0, r.overtime_amount || 0, r.net_salary || 0, r.receipt_status || "-"])
  );
}
