"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportEvaluationsCsv, exportEvaluationsPdf } from "../../components/hrExports";

const EVALUATIONS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/hr/evaluations";
const FACTORIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";
const EMPLOYEES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/erp/employees";

const STATUS_OPTIONS = [
  { value: "draft", label: "مسودة" },
  { value: "approved", label: "معتمد" },
  { value: "rejected", label: "مرفوض" },
];

const emptyForm = {
  factory_id: "",
  employee_id: "",
  evaluation_month: String(new Date().getMonth() + 1),
  evaluation_year: String(new Date().getFullYear()),
  rating_score: "80",
  rating_label: "Good",
  strengths: "",
  notes: "",
  bonus_amount: "0",
  deduction_amount: "0",
  status: "draft",
};

function resolvePreferredFactoryId(user, factories) {
  if (!Array.isArray(factories) || factories.length === 0) return "";
  const userFactoryId = user?.factory_id || user?.factory?.id || "";
  if (userFactoryId && factories.some((f) => String(f.id) === String(userFactoryId))) return String(userFactoryId);
  return String(factories[0]?.id || "");
}

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

export default function EvaluationsPage() {
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
    const [evaluationsRes, factoriesRes, employeesRes] = await Promise.all([
      fetch(EVALUATIONS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(FACTORIES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(EMPLOYEES_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);
    const evaluationsData = evaluationsRes.ok ? await evaluationsRes.json() : [];
    const factoriesData = factoriesRes.ok ? await factoriesRes.json() : [];
    const employeesData = employeesRes.ok ? await employeesRes.json() : [];
    if (!evaluationsRes.ok) throw new Error(evaluationsData.detail || "فشل تحميل التقييمات");
    if (!factoriesRes.ok) throw new Error(factoriesData.detail || "فشل تحميل المصانع");
    if (!employeesRes.ok) throw new Error(employeesData.detail || "فشل تحميل الموظفين");
    setRows(Array.isArray(evaluationsData) ? evaluationsData : []);
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
  function startEdit(item) { setEditingId(item.id); setForm({ factory_id: String(item.factory_id || ""), employee_id: String(item.employee_id || ""), evaluation_month: String(item.evaluation_month || ""), evaluation_year: String(item.evaluation_year || ""), rating_score: String(item.rating_score || ""), rating_label: item.rating_label || "", strengths: item.strengths || "", notes: item.notes || "", bonus_amount: String(item.bonus_amount || 0), deduction_amount: String(item.deduction_amount || 0), status: item.status || "draft" }); window.scrollTo({ top: 0, behavior: "smooth" }); }

  async function handleSubmit(e) {
    e.preventDefault(); setSubmitting(true); setMessage("");
    try {
      const payload = { factory_id: Number(form.factory_id), employee_id: Number(form.employee_id), evaluation_month: Number(form.evaluation_month), evaluation_year: Number(form.evaluation_year), rating_score: Number(form.rating_score), rating_label: form.rating_label, strengths: form.strengths, notes: form.notes, bonus_amount: Number(form.bonus_amount), deduction_amount: Number(form.deduction_amount), status: form.status };
      const url = editingId ? `${EVALUATIONS_API_URL}/${editingId}` : EVALUATIONS_API_URL;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حفظ التقييم");
      setMessage(editingId ? "تم تعديل التقييم بنجاح" : "تم إنشاء التقييم بنجاح");
      resetForm(); await loadAll();
    } catch (err) { setMessage(err.message || "حدث خطأ أثناء حفظ التقييم"); } finally { setSubmitting(false); }
  }

  async function handleDelete(id) {
    if (!confirm("هل تريد حذف هذا التقييم؟")) return;
    try {
      const res = await fetch(`${EVALUATIONS_API_URL}/${id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف التقييم");
      setMessage("تم حذف التقييم بنجاح"); if (editingId === id) resetForm(); await loadAll();
    } catch (err) { setMessage(err.message || "حدث خطأ أثناء حذف التقييم"); }
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ تحميل التقييمات...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">الموارد البشرية / التقييمات</div><h2>إدارة التقييمات</h2><p>تقييم أداء الموظفين الدوري مع المكافآت والخصومات.</p></div>
          <div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">الإجمالي</div><div className="erp-stat-box-value">{stats.total}</div></div></div>
        </section>

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">إجمالي التقييمات</div><div className="erp-card-value">{stats.total}</div></div>
        </section>

        {message ? <div className="erp-form-message">{message}</div> : null}

        <div className="erp-form-shell">
          <div className="erp-section-head"><h3>{editingId ? "تعديل التقييم" : "إضافة تقييم جديد"}</h3></div>
          <form className="erp-form-grid" onSubmit={handleSubmit}>
            <select className="erp-input" value={form.factory_id} onChange={(e) => setForm({ ...form, factory_id: e.target.value, employee_id: "" })} disabled={!!lockedFactoryId}>
              <option value="">اختر المصنع</option>
              {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
            </select>
            <select className="erp-input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })}>
              <option value="">اختر الموظف</option>
              {employees.filter((e) => !form.factory_id || String(e.factory_id) === String(form.factory_id)).map((e) => <option key={e.id} value={e.id}>{e.first_name} {e.last_name}</option>)}
            </select>
            <input className="erp-input" type="number" placeholder="الشهر" value={form.evaluation_month} onChange={(e) => setForm({ ...form, evaluation_month: e.target.value })} />
            <input className="erp-input" type="number" placeholder="السنة" value={form.evaluation_year} onChange={(e) => setForm({ ...form, evaluation_year: e.target.value })} />
            <input className="erp-input" type="number" placeholder="الدرجة" value={form.rating_score} onChange={(e) => setForm({ ...form, rating_score: e.target.value })} />
            <input className="erp-input" placeholder="الوصف" value={form.rating_label} onChange={(e) => setForm({ ...form, rating_label: e.target.value })} />
            <textarea className="erp-input" rows="3" placeholder="نقاط القوة" value={form.strengths} onChange={(e) => setForm({ ...form, strengths: e.target.value })} />
            <textarea className="erp-input" rows="3" placeholder="ملاحظات" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            <input className="erp-input" type="number" placeholder="المكافأة" value={form.bonus_amount} onChange={(e) => setForm({ ...form, bonus_amount: e.target.value })} />
            <input className="erp-input" type="number" placeholder="الخصم" value={form.deduction_amount} onChange={(e) => setForm({ ...form, deduction_amount: e.target.value })} />
            <select className="erp-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })}>
              {STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إنشاء التقييم"}</button>
              {editingId && <button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء</button>}
            </div>
          </form>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <h3>سجل التقييمات</h3>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              <input className="erp-input" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <button className="erp-btn-secondary" style={topButtonStyle} onClick={() => exportEvaluationsCsv(rows)}>Export CSV</button>
              <button className="erp-btn-primary" style={topButtonStyle} onClick={() => exportEvaluationsPdf(rows)}>Export PDF</button>
            </div>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead><tr><th>ID</th><th>الموظف</th><th>الفترة</th><th>الدرجة</th><th>الوصف</th><th>المكافأة</th><th>الخصم</th><th>الحالة</th><th>إجراءات</th></tr></thead>
              <tbody>
                {rows.length === 0 ? <tr><td colSpan="9">لا توجد تقييمات.</td></tr> : rows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td><td>{employees.find((e) => e.id === row.employee_id)?.first_name || "-"}</td>
                    <td>{row.evaluation_month}/{row.evaluation_year}</td><td>{row.rating_score}</td><td>{row.rating_label}</td>
                    <td>{row.bonus_amount}</td><td>{row.deduction_amount}</td>
                    <td><span className={`erp-badge ${row.status === "approved" ? "success" : "warning"}`}>{STATUS_OPTIONS.find((o) => o.value === row.status)?.label || row.status}</span></td>
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
