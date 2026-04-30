"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportLeavesCsv, exportLeavesPdf } from "../../components/hrExports";

const LEAVES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/hr/leaves";
const FACTORIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";
const EMPLOYEES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/erp/employees";

const STATUS_OPTIONS = [
  { value: "draft", label: "مسودة" },
  { value: "approved", label: "معتمد" },
  { value: "rejected", label: "مرفوض" },
  { value: "cancelled", label: "ملغي" },
];

const LEAVE_TYPE_OPTIONS = [
  { value: "annual", label: "سنوية" },
  { value: "sick", label: "مرضية" },
  { value: "casual", label: "عارضة" },
  { value: "unpaid", label: "غير مدفوعة" },
];

const emptyForm = {
  factory_id: "",
  employee_id: "",
  leave_type: "annual",
  start_date: "",
  end_date: "",
  total_days: "1",
  status: "draft",
  is_paid: true,
  notes: "",
};

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

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

export default function LeavesPage() {
  const { user, ready } = useAdminAuth("employees");
  const [factories, setFactories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const lockedFactoryId = !user?.is_superuser && user?.factory_id ? String(user.factory_id) : "";

  async function loadAll() {
    const [leavesRes, factoriesRes, employeesRes] = await Promise.all([
      fetch(LEAVES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(FACTORIES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(EMPLOYEES_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);
    const leavesData = leavesRes.ok ? await leavesRes.json() : [];
    const factoriesData = factoriesRes.ok ? await factoriesRes.json() : [];
    const employeesData = employeesRes.ok ? await employeesRes.json() : [];
    if (!leavesRes.ok) throw new Error(leavesData.detail || "فشل تحميل الإجازات");
    if (!factoriesRes.ok) throw new Error(factoriesData.detail || "فشل تحميل المصانع");
    if (!employeesRes.ok) throw new Error(employeesData.detail || "فشل تحميل الموظفين");
    setRows(Array.isArray(leavesData) ? leavesData : []);
    setFactories(Array.isArray(factoriesData) ? factoriesData : []);
    setEmployees(Array.isArray(employeesData) ? employeesData : []);
    setForm((prev) => {
      if (prev.factory_id) return prev;
      return { ...prev, factory_id: lockedFactoryId || resolvePreferredFactoryId(user, factoriesData) };
    });
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء التحميل"));
  }, [ready, user]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => {
      if (statusFilter !== "all" && row.status !== statusFilter) return false;
      if (factoryFilter !== "all" && String(row.factory_id) !== String(factoryFilter)) return false;
      if (!search) return true;
      const emp = employees.find((e) => e.id === row.employee_id);
      const haystack = [row.id, employeeLabel(emp), row.leave_type, row.status].join(" ").toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [rows, search, statusFilter, factoryFilter, employees]);

  const stats = useMemo(() => ({ total: rows.length }), [rows]);

  function resetForm() { setForm(emptyForm); setEditingId(null); setMessage(""); }
  function startEdit(item) { setEditingId(item.id); setForm({ factory_id: String(item.factory_id || ""), employee_id: String(item.employee_id || ""), leave_type: item.leave_type || "annual", start_date: item.start_date || "", end_date: item.end_date || "", total_days: String(item.total_days || 1), status: item.status || "draft", is_paid: !!item.is_paid, notes: item.notes || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const payload = { factory_id: Number(form.factory_id), employee_id: Number(form.employee_id), leave_type: form.leave_type, start_date: form.start_date, end_date: form.end_date, total_days: Number(form.total_days), status: form.status, is_paid: !!form.is_paid, notes: form.notes };
      const url = editingId ? `${LEAVES_API_URL}/${editingId}` : LEAVES_API_URL;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حفظ الإجازة");
      setMessage(editingId ? "تم تعديل الإجازة بنجاح" : "تم إنشاء الإجازة بنجاح");
      resetForm(); await loadAll();
    } catch (err) { setMessage(err.message || "حدث خطأ أثناء حفظ الإجازة"); } finally { setSubmitting(false); }
  }

  async function handleDelete(id) {
    if (!confirm("هل تريد حذف هذه الإجازة؟")) return;
    try {
      const res = await fetch(`${LEAVES_API_URL}/${id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف الإجازة");
      setMessage("تم حذف الإجازة بنجاح"); if (editingId === id) resetForm(); await loadAll();
    } catch (err) { setMessage(err.message || "حدث خطأ أثناء حذف الإجازة"); }
  }

  async function quickAction(id, action, successMessage) {
    setMessage("");
    try {
      const res = await fetch(`${LEAVES_API_URL}/${id}/status`, { method: "PUT", headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify({ status: action }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحديث الحالة");
      setMessage(successMessage); await loadAll();
    } catch (err) { setMessage(err.message || "حدث خطأ أثناء تحديث الحالة"); }
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ تحميل الإجازات...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">الموارد البشرية / الإجازات</div><h2>إدارة الإجازات</h2><p>متابعة طلبات الإجازات واعتمادها حسب نوعها وسياسات العمل.</p></div>
          <div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">الإجمالي</div><div className="erp-stat-box-value">{stats.total}</div></div></div>
        </section>

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">إجمالي الطلبات</div><div className="erp-card-value">{stats.total}</div></div>
        </section>

        {message ? <div className="erp-form-message">{message}</div> : null}

        <div className="erp-form-shell">
          <div className="erp-section-head"><h3>{editingId ? "تعديل الإجازة" : "إضافة إجازة جديدة"}</h3></div>
          <form className="erp-form-grid" onSubmit={handleSubmit}>
            <select className="erp-input" value={form.factory_id} onChange={(e) => setForm({ ...form, factory_id: e.target.value, employee_id: "" })} disabled={!!lockedFactoryId}>
              <option value="">اختر المصنع</option>
              {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select className="erp-input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">اختر الموظف</option>
              {employees.filter((e) => !form.factory_id || String(e.factory_id) === String(form.factory_id)).map((e) => <option key={e.id} value={e.id}>{employeeLabel(e)}</option>)}
            </select>
            <select className="erp-input" value={form.leave_type} onChange={(e) => setForm({ ...form, leave_type: e.target.value })}>
              {LEAVE_TYPE_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <input className="erp-input" type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
            <input className="erp-input" type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
            <input className="erp-input" type="number" placeholder="عدد الأيام" value={form.total_days} onChange={(e) => setForm({ ...form, total_days: e.target.value })} />
            <label><input type="checkbox" checked={form.is_paid} onChange={(e) => setForm({ ...form, is_paid: e.target.checked })} /> مدفوعة</label>
            <textarea className="erp-input" rows="3" placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إنشاء الإجازة"}</button>
              {editingId && <button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء</button>}
            </div>
          </form>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <h3>سجل الإجازات</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input className="erp-input" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="erp-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">كل الحالات</option>
                {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
              <select className="erp-input" value={factoryFilter} onChange={(e) => setFactoryFilter(e.target.value)}>
                <option value="all">كل المصانع</option>
                {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
              <button className="erp-btn-secondary" style={topButtonStyle} onClick={() => exportLeavesCsv(filteredRows, (r) => employeeLabel(employees.find((e) => e.id === r.employee_id)))}>Export CSV</button>
              <button className="erp-btn-primary" style={topButtonStyle} onClick={() => exportLeavesPdf(filteredRows, (r) => employeeLabel(employees.find((e) => e.id === r.employee_id)))}>Export PDF</button>
            </div>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead><tr><th>ID</th><th>الموظف</th><th>النوع</th><th>من</th><th>إلى</th><th>الأيام</th><th>مدفوعة</th><th>الحالة</th><th>إجراءات</th></tr></thead>
              <tbody>
                {filteredRows.length === 0 ? <tr><td colSpan="9">لا توجد نتائج.</td></tr> : filteredRows.map((row) => {
                  const emp = employees.find((e) => e.id === row.employee_id);
                  return (
                    <tr key={row.id}>
                      <td>{row.id}</td><td>{employeeLabel(emp)}</td><td>{row.leave_type}</td><td>{row.start_date}</td><td>{row.end_date}</td><td>{row.total_days}</td><td>{row.is_paid ? "نعم" : "لا"}</td>
                      <td><span className={`erp-badge ${row.status === "approved" ? "success" : row.status === "rejected" ? "warning" : ""}`}>{STATUS_OPTIONS.find((o) => o.value === row.status)?.label || row.status}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <button className="erp-btn-secondary" onClick={() => startEdit(row)}>تعديل</button>
                          <button className="erp-btn-primary" onClick={() => quickAction(row.id, "approved", "تمت الموافقة على الإجازة")}>اعتماد</button>
                          <button className="erp-btn-danger" onClick={() => quickAction(row.id, "rejected", "تم رفض الإجازة")}>رفض</button>
                          <button className="erp-btn-danger" onClick={() => handleDelete(row.id)}>حذف</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
