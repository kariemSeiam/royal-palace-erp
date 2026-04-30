"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportAttendanceCsv, exportAttendancePdf } from "../components/hrExports";

const ATTENDANCE_API_URL = "https://api.royalpalace-group.com/api/v1/admin/attendance";
const FACTORIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";
const EMPLOYEES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/erp/employees";

const STATUS_OPTIONS = [
  { value: "present", label: "حاضر" },
  { value: "late", label: "متأخر" },
  { value: "absent", label: "غائب" },
  { value: "half_day", label: "نصف يوم" },
  { value: "paid_leave", label: "إجازة مدفوعة" },
  { value: "unpaid_leave", label: "إجازة غير مدفوعة" },
  { value: "incomplete", label: "غير مكتمل" },
];

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function resolvePreferredFactoryId(user, factories) {
  if (!Array.isArray(factories) || factories.length === 0) return "";
  const userFactoryId = user?.factory_id || user?.factory?.id || "";
  if (userFactoryId && factories.some((f) => String(f.id) === String(userFactoryId))) return String(userFactoryId);
  return String(factories[0]?.id || "");
}

function employeeLabel(employee) {
  const name = `${employee?.first_name || ""} ${employee?.last_name || ""}`.trim() || `موظف #${employee?.id || ""}`;
  return employee?.job_title ? `${name} — ${employee.job_title}` : name;
}

function statusLabel(status) {
  return STATUS_OPTIONS.find((x) => x.value === status)?.label || status || "-";
}

const emptyForm = {
  factory_id: "",
  employee_id: "",
  attendance_date: new Date().toISOString().slice(0, 10),
  check_in_at: "",
  check_out_at: "",
  source: "manual",
  status: "present",
  worked_minutes_override: "0",
  late_minutes: "0",
  overtime_minutes: "0",
  half_day_minutes: "0",
  notes: "",
};

export default function AttendancePage() {
  const { user, ready } = useAdminAuth("attendance");
  const [rows, setRows] = useState([]);
  const [factories, setFactories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);

  const lockedFactoryId = !user?.is_superuser && user?.factory_id ? String(user.factory_id) : "";

  async function loadAll() {
    const [attendanceRes, factoriesRes, employeesRes] = await Promise.all([
      fetch(ATTENDANCE_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(FACTORIES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(EMPLOYEES_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);

    const attendanceData = await attendanceRes.json().catch(() => []);
    const factoriesData = await factoriesRes.json().catch(() => []);
    const employeesData = await employeesRes.json().catch(() => []);

    if (!attendanceRes.ok) throw new Error(attendanceData.detail || "تعذر تحميل الحضور");
    if (!factoriesRes.ok) throw new Error(factoriesData.detail || "تعذر تحميل المصانع");
    if (!employeesRes.ok) throw new Error(employeesData.detail || "تعذر تحميل الموظفين");

    setRows(Array.isArray(attendanceData) ? attendanceData : []);
    setFactories(Array.isArray(factoriesData) ? factoriesData : []);
    setEmployees(Array.isArray(employeesData) ? employeesData : []);

    const nextFactoryId = lockedFactoryId || resolvePreferredFactoryId(user, Array.isArray(factoriesData) ? factoriesData : []);
    setForm((prev) => ({ ...prev, factory_id: prev.factory_id || nextFactoryId }));
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => {
      setRows([]);
      setFactories([]);
      setEmployees([]);
      setMessage(err.message || "تعذر تحميل بيانات الحضور");
    });
  }, [ready, user]);

  const filteredEmployees = useMemo(() => {
    const factoryId = lockedFactoryId || form.factory_id;
    return employees.filter((employee) => String(employee.factory_id) === String(factoryId || ""));
  }, [employees, form.factory_id, lockedFactoryId]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    return rows.filter((item) => {
      if (lockedFactoryId && String(item.factory_id) !== lockedFactoryId) return false;
      if (!q) return true;
      const employee = employees.find((e) => Number(e.id) === Number(item.employee_id));
      const haystack = [
        item.id, item.attendance_date, item.status, item.source, item.notes, item.employee_id,
        employee?.employee_code, employee?.first_name, employee?.last_name, employee?.job_title,
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [rows, search, employees, lockedFactoryId]);

  const stats = useMemo(() => {
    const list = lockedFactoryId ? rows.filter((r) => String(r.factory_id) === lockedFactoryId) : rows;
    return {
      total: list.length,
      present: list.filter((r) => r.status === "present").length,
      late: list.filter((r) => r.status === "late").length,
      absent: list.filter((r) => r.status === "absent").length,
    };
  }, [rows, lockedFactoryId]);

  function labelForExport(row) {
    const employee = employees.find((e) => Number(e.id) === Number(row.employee_id));
    return employeeLabel(employee);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const payload = {
        factory_id: Number(lockedFactoryId || form.factory_id),
        employee_id: Number(form.employee_id),
        attendance_date: form.attendance_date,
        check_in_at: form.check_in_at || null,
        check_out_at: form.check_out_at || null,
        source: form.source || "manual",
        status: form.status,
        worked_minutes_override: Number(form.worked_minutes_override || 0),
        late_minutes: Number(form.late_minutes || 0),
        overtime_minutes: Number(form.overtime_minutes || 0),
        half_day_minutes: Number(form.half_day_minutes || 0),
        notes: form.notes.trim() || null,
      };

      if (!payload.factory_id || !payload.employee_id || !payload.attendance_date) {
        throw new Error("اختر المصنع والموظف وتاريخ الحضور");
      }

      const res = await fetch(ATTENDANCE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تسجيل الحضور");

      setMessage("تم تسجيل الحضور بنجاح");
      setForm((prev) => ({
        ...emptyForm,
        factory_id: lockedFactoryId || prev.factory_id,
        attendance_date: new Date().toISOString().slice(0, 10),
      }));
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء تسجيل الحضور");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("هل تريد حذف سجل الحضور؟")) return;
    try {
      const res = await fetch(`${ATTENDANCE_API_URL}/${id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف السجل");
      setMessage("تم حذف سجل الحضور");
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء حذف السجل");
    }
  }

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل الحضور...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">الموارد البشرية / الحضور</div>
            <h2>متابعة الحضور والانصراف</h2>
            <p>تسجيل الحضور يدويًا مع التأخير والعمل الإضافي ونصف اليوم والإجازات، ضمن واجهة تشغيلية واضحة.</p>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box"><div className="erp-stat-box-label">إجمالي السجلات</div><div className="erp-stat-box-value">{stats.total}</div></div>
            <div className="erp-stat-box"><div className="erp-stat-box-label">حاضر</div><div className="erp-stat-box-value">{stats.present}</div></div>
            <div className="erp-stat-box"><div className="erp-stat-box-label">متأخر / غائب</div><div className="erp-stat-box-value">{stats.late + stats.absent}</div></div>
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">حاضر</div><div className="erp-card-value">{stats.present}</div></div>
          <div className="erp-card"><div className="erp-card-title">متأخر</div><div className="erp-card-value">{stats.late}</div></div>
          <div className="erp-card"><div className="erp-card-title">غائب</div><div className="erp-card-value">{stats.absent}</div></div>
          <div className="erp-card"><div className="erp-card-title">إجمالي السجلات</div><div className="erp-card-value">{stats.total}</div></div>
        </section>

        <div className="erp-form-shell">
          <div className="erp-section-head" style={{ marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>تسجيل حضور جديد</h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8 }}>
                أضف سجل حضور جديد أو صدّر السجلات الحالية بنفس نمط تقارير المنتجات.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="erp-btn-secondary" onClick={() => exportAttendanceCsv(filteredRows, labelForExport)}>Export CSV</button>
              <button type="button" className="erp-btn-primary" onClick={() => exportAttendancePdf(filteredRows, labelForExport, stats)}>Export PDF</button>
            </div>
          </div>

          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}>
            <div><label className="erp-label">المصنع</label><select className="erp-input" value={lockedFactoryId || form.factory_id} disabled={Boolean(lockedFactoryId)} onChange={(e) => setForm((prev) => ({ ...prev, factory_id: e.target.value, employee_id: "" }))}><option value="">اختر المصنع</option>{factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}</select></div>
            <div><label className="erp-label">الموظف</label><select className="erp-input" value={form.employee_id} onChange={(e) => setForm((prev) => ({ ...prev, employee_id: e.target.value }))}><option value="">اختر الموظف</option>{filteredEmployees.map((employee) => <option key={employee.id} value={employee.id}>{employeeLabel(employee)}</option>)}</select></div>
            <div><label className="erp-label">التاريخ</label><input className="erp-input" type="date" value={form.attendance_date} onChange={(e) => setForm((prev) => ({ ...prev, attendance_date: e.target.value }))} /></div>
            <div><label className="erp-label">الحالة</label><select className="erp-input" value={form.status} onChange={(e) => setForm((prev) => ({ ...prev, status: e.target.value }))}>{STATUS_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}</select></div>
            <div><label className="erp-label">وقت الدخول</label><input className="erp-input" type="datetime-local" value={form.check_in_at} onChange={(e) => setForm((prev) => ({ ...prev, check_in_at: e.target.value }))} /></div>
            <div><label className="erp-label">وقت الخروج</label><input className="erp-input" type="datetime-local" value={form.check_out_at} onChange={(e) => setForm((prev) => ({ ...prev, check_out_at: e.target.value }))} /></div>
            <div><label className="erp-label">دقائق التأخير</label><input className="erp-input" type="number" min="0" value={form.late_minutes} onChange={(e) => setForm((prev) => ({ ...prev, late_minutes: e.target.value }))} /></div>
            <div><label className="erp-label">دقائق العمل الإضافي</label><input className="erp-input" type="number" min="0" value={form.overtime_minutes} onChange={(e) => setForm((prev) => ({ ...prev, overtime_minutes: e.target.value }))} /></div>
            <div><label className="erp-label">دقائق نصف اليوم</label><input className="erp-input" type="number" min="0" value={form.half_day_minutes} onChange={(e) => setForm((prev) => ({ ...prev, half_day_minutes: e.target.value }))} /></div>
            <div><label className="erp-label">تعديل الدقائق الفعلية</label><input className="erp-input" type="number" min="0" value={form.worked_minutes_override} onChange={(e) => setForm((prev) => ({ ...prev, worked_minutes_override: e.target.value }))} /></div>
            <div style={{ gridColumn: "1 / -1" }}><label className="erp-label">ملاحظات</label><textarea className="erp-input" rows="3" value={form.notes} onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))} /></div>
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : "تسجيل الحضور"}</button></div>
          </form>
          {message ? <div className="erp-form-message">{message}</div> : null}
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <div><h3>سجل الحضور</h3><p>استعراض السجلات الحالية وحذف السجل عند الحاجة</p></div>
            <div style={{ width: 320, maxWidth: "100%" }}><input className="erp-search" placeholder="ابحث بالموظف أو الحالة أو التاريخ..." value={search} onChange={(e) => setSearch(e.target.value)} /></div>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table" style={{ minWidth: 1400 }}>
              <thead>
                <tr><th>ID</th><th>الموظف</th><th>التاريخ</th><th>الحالة</th><th>الدخول</th><th>الخروج</th><th>التأخير</th><th>الإضافي</th><th>المصدر</th><th>الإجراءات</th></tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 ? (
                  <tr><td colSpan="10">لا توجد سجلات حضور حالياً.</td></tr>
                ) : (
                  filteredRows.map((item) => {
                    const employee = employees.find((e) => Number(e.id) === Number(item.employee_id));
                    return (
                      <tr key={item.id}>
                        <td>{item.id}</td>
                        <td>{employeeLabel(employee)}</td>
                        <td>{item.attendance_date}</td>
                        <td><span className={`erp-badge ${item.status === "present" ? "success" : "warning"}`}>{statusLabel(item.status)}</span></td>
                        <td>{item.check_in_at || "-"}</td>
                        <td>{item.check_out_at || "-"}</td>
                        <td>{item.late_minutes || 0}</td>
                        <td>{item.overtime_minutes || 0}</td>
                        <td>{item.source || "-"}</td>
                        <td><button type="button" className="erp-btn-danger" onClick={() => handleDelete(item.id)}>حذف</button></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
