"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportCompensationsCsv, exportCompensationsPdf } from "../../components/hrExports";

const COMPENSATIONS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/hr/compensations";
const FACTORIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";
const EMPLOYEES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/erp/employees";

const emptyForm = {
  factory_id: "",
  employee_id: "",
  basic_salary: "0",
  housing_allowance: "0",
  transport_allowance: "0",
  meal_allowance: "0",
  other_allowance: "0",
  fixed_deductions: "0",
  daily_salary_divisor: "30",
  currency: "EGP",
  effective_from: "",
};

function resolvePreferredFactoryId(user, factories) {
  if (!Array.isArray(factories) || factories.length === 0) return "";
  const userFactoryId = user?.factory_id || user?.factory?.id || "";
  if (userFactoryId && factories.some((f) => String(f.id) === String(userFactoryId))) return String(userFactoryId);
  return String(factories[0]?.id || "");
}

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

export default function CompensationsPage() {
  const { user, ready } = useAdminAuth("employees");
  const [factories, setFactories] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [rows, setRows] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const lockedFactoryId = !user?.is_superuser && user?.factory_id ? String(user.factory_id) : "";

  async function loadAll() {
    const [compsRes, factoriesRes, employeesRes] = await Promise.all([
      fetch(COMPENSATIONS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(FACTORIES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(EMPLOYEES_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);
    const compsData = compsRes.ok ? await compsRes.json() : [];
    const factoriesData = factoriesRes.ok ? await factoriesRes.json() : [];
    const employeesData = employeesRes.ok ? await employeesRes.json() : [];
    if (!compsRes.ok) throw new Error(compsData.detail || "فشل تحميل التعويضات");
    if (!factoriesRes.ok) throw new Error(factoriesData.detail || "فشل تحميل المصانع");
    if (!employeesRes.ok) throw new Error(employeesData.detail || "فشل تحميل الموظفين");
    setRows(Array.isArray(compsData) ? compsData : []);
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

  const stats = useMemo(() => ({ total: rows.length }), [rows]);

  function resetForm() { setForm(emptyForm); setEditingId(null); setMessage(""); }
  function startEdit(item) { setEditingId(item.id); setForm({ factory_id: String(item.factory_id || ""), employee_id: String(item.employee_id || ""), basic_salary: String(item.basic_salary || ""), housing_allowance: String(item.housing_allowance || ""), transport_allowance: String(item.transport_allowance || ""), meal_allowance: String(item.meal_allowance || ""), other_allowance: String(item.other_allowance || ""), fixed_deductions: String(item.fixed_deductions || ""), daily_salary_divisor: String(item.daily_salary_divisor || ""), currency: item.currency || "EGP", effective_from: item.effective_from || "" }); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const payload = { factory_id: Number(form.factory_id), employee_id: Number(form.employee_id), basic_salary: Number(form.basic_salary), housing_allowance: Number(form.housing_allowance), transport_allowance: Number(form.transport_allowance), meal_allowance: Number(form.meal_allowance), other_allowance: Number(form.other_allowance), fixed_deductions: Number(form.fixed_deductions), daily_salary_divisor: Number(form.daily_salary_divisor), currency: form.currency, effective_from: form.effective_from || null };
      const url = editingId ? `${COMPENSATIONS_API_URL}/${editingId}` : COMPENSATIONS_API_URL;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حفظ التعويض");
      setMessage(editingId ? "تم تعديل التعويض بنجاح" : "تم إنشاء التعويض بنجاح");
      resetForm(); await loadAll();
    } catch (err) { setMessage(err.message || "حدث خطأ أثناء حفظ التعويض"); } finally { setSubmitting(false); }
  }

  async function handleDelete(id) {
    if (!confirm("هل تريد حذف هذا التعويض؟")) return;
    try {
      const res = await fetch(`${COMPENSATIONS_API_URL}/${id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف التعويض");
      setMessage("تم حذف التعويض بنجاح"); if (editingId === id) resetForm(); await loadAll();
    } catch (err) { setMessage(err.message || "حدث خطأ أثناء حذف التعويض"); }
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ تحميل التعويضات...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">الموارد البشرية / التعويضات</div><h2>إدارة التعويضات</h2><p>إدارة الرواتب والبدلات والخصومات للموظفين.</p></div>
          <div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">الإجمالي</div><div className="erp-stat-box-value">{stats.total}</div></div></div>
        </section>

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">إجمالي الملفات</div><div className="erp-card-value">{stats.total}</div></div>
        </section>

        {message ? <div className="erp-form-message">{message}</div> : null}

        <div className="erp-form-shell">
          <div className="erp-section-head"><h3>{editingId ? "تعديل التعويض" : "إضافة تعويض جديد"}</h3></div>
          <form className="erp-form-grid" onSubmit={handleSubmit}>
            <select className="erp-input" value={form.factory_id} onChange={(e) => setForm({ ...form, factory_id: e.target.value, employee_id: "" })} disabled={!!lockedFactoryId}>
              <option value="">اختر المصنع</option>
              {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select className="erp-input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">اختر الموظف</option>
              {employees.filter((e) => !form.factory_id || String(e.factory_id) === String(form.factory_id)).map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
            <input className="erp-input" type="number" placeholder="الأساسي" value={form.basic_salary} onChange={(e) => setForm({ ...form, basic_salary: e.target.value })} />
            <input className="erp-input" type="number" placeholder="السكن" value={form.housing_allowance} onChange={(e) => setForm({ ...form, housing_allowance: e.target.value })} />
            <input className="erp-input" type="number" placeholder="المواصلات" value={form.transport_allowance} onChange={(e) => setForm({ ...form, transport_allowance: e.target.value })} />
            <input className="erp-input" type="number" placeholder="الوجبات" value={form.meal_allowance} onChange={(e) => setForm({ ...form, meal_allowance: e.target.value })} />
            <input className="erp-input" type="number" placeholder="أخرى" value={form.other_allowance} onChange={(e) => setForm({ ...form, other_allowance: e.target.value })} />
            <input className="erp-input" type="number" placeholder="خصومات ثابتة" value={form.fixed_deductions} onChange={(e) => setForm({ ...form, fixed_deductions: e.target.value })} />
            <input className="erp-input" placeholder="العملة" value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} />
            <input className="erp-input" type="date" value={form.effective_from} onChange={(e) => setForm({ ...form, effective_from: e.target.value })} />
            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إنشاء التعويض"}</button>
              {editingId && <button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء</button>}
            </div>
          </form>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <h3>سجل التعويضات</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input className="erp-input" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="erp-btn-secondary" style={topButtonStyle} onClick={() => exportCompensationsCsv(rows, (r) => employees.find((e) => e.id === r.employee_id)?.first_name || "")}>Export CSV</button>
              <button className="erp-btn-primary" style={topButtonStyle} onClick={() => exportCompensationsPdf(rows, (r) => employees.find((e) => e.id === r.employee_id)?.first_name || "")}>Export PDF</button>
            </div>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead><tr><th>ID</th><th>الموظف</th><th>الأساسي</th><th>السكن</th><th>المواصلات</th><th>الوجبات</th><th>أخرى</th><th>خصومات</th><th>العملة</th><th>إجراءات</th></tr></thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan="10">لا توجد تعويضات.</td></tr> : rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td><td>{employees.find((e) => e.id === row.employee_id)?.first_name || "-"}</td>
                    <td>{row.basic_salary}</td><td>{row.housing_allowance}</td><td>{row.transport_allowance}</td><td>{row.meal_allowance}</td>
                    <td>{row.other_allowance}</td><td>{row.fixed_deductions}</td><td>{row.currency}</td>
                    <td><div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}><button className="erp-btn-secondary" onClick={() => startEdit(row)}>تعديل</button><button className="erp-btn-danger" onClick={() => handleDelete(row.id)}>حذف</button></div></td>
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
