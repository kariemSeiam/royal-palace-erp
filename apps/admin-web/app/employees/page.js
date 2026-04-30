"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportEmployeesCsv, exportEmployeesPdf } from "../components/hrExports";

const EMPLOYEES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/erp/employees";
const DEPARTMENTS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/erp/departments";
const FACTORIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function resolvePreferredFactoryId(user, factories) {
  if (!Array.isArray(factories) || factories.length === 0) return "";
  const userFactoryId = user?.factory_id || user?.factory?.id || "";
  if (userFactoryId && factories.some((f) => String(f.id) === String(userFactoryId))) return String(userFactoryId);
  return String(factories[0]?.id || "");
}

const emptyForm = {
  factory_id: "",
  department_id: "",
  employee_code: "",
  first_name: "",
  last_name: "",
  job_title: "",
  hire_date: "",
  phone: "",
  email: "",
  employment_status: "active",
  is_active: true,
};

export default function EmployeesPage() {
  const { user, ready } = useAdminAuth("employees");
  const [employees, setEmployees] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [factories, setFactories] = useState([]);
  const [search, setSearch] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);

  const lockedFactoryId = !user?.is_superuser && user?.factory_id ? String(user.factory_id) : "";

  async function loadAll() {
    const [employeesRes, departmentsRes, factoriesRes] = await Promise.all([
      fetch(EMPLOYEES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(DEPARTMENTS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(FACTORIES_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);

    const employeesData = await employeesRes.json().catch(() => []);
    const departmentsData = await departmentsRes.json().catch(() => []);
    const factoriesData = await factoriesRes.json().catch(() => []);

    if (!employeesRes.ok) throw new Error(employeesData.detail || "تعذر تحميل الموظفين");
    if (!departmentsRes.ok) throw new Error(departmentsData.detail || "تعذر تحميل الأقسام");
    if (!factoriesRes.ok) throw new Error(factoriesData.detail || "تعذر تحميل المصانع");

    setEmployees(Array.isArray(employeesData) ? employeesData : []);
    setDepartments(Array.isArray(departmentsData) ? departmentsData : []);
    setFactories(Array.isArray(factoriesData) ? factoriesData : []);

    const nextFactoryId = lockedFactoryId || resolvePreferredFactoryId(user, Array.isArray(factoriesData) ? factoriesData : []);
    setForm((prev) => ({ ...prev, factory_id: prev.factory_id || nextFactoryId }));
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => {
      setEmployees([]);
      setDepartments([]);
      setFactories([]);
      setMessage(err.message || "تعذر تحميل بيانات الموظفين");
    });
  }, [ready, user]);

  const visibleFactories = useMemo(() => {
    if (!lockedFactoryId) return factories;
    return factories.filter((f) => String(f.id) === lockedFactoryId);
  }, [factories, lockedFactoryId]);

  const filteredDepartments = useMemo(() => {
    const factoryId = lockedFactoryId || form.factory_id;
    return departments.filter((d) => String(d.factory_id) === String(factoryId || ""));
  }, [departments, form.factory_id, lockedFactoryId]);

  const factoryMap = useMemo(() => {
    const map = {};
    factories.forEach((f) => { map[f.id] = f.name; });
    return map;
  }, [factories]);

  const departmentMap = useMemo(() => {
    const map = {};
    departments.forEach((d) => { map[d.id] = d.name; });
    return map;
  }, [departments]);

  const filteredEmployees = useMemo(() => {
    const q = normalizeText(search);
    return employees.filter((employee) => {
      if (lockedFactoryId && String(employee.factory_id) !== lockedFactoryId) return false;
      if (!q) return true;
      const haystack = [
        employee.id,
        employee.employee_code,
        employee.first_name,
        employee.last_name,
        employee.job_title,
        employee.phone,
        employee.email,
        employee.employment_status,
        factoryMap[employee.factory_id],
        departmentMap[employee.department_id],
      ].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [employees, search, factoryMap, departmentMap, lockedFactoryId]);

  const stats = useMemo(() => {
    const list = lockedFactoryId ? employees.filter((e) => String(e.factory_id) === lockedFactoryId) : employees;
    return {
      total: list.length,
      active: list.filter((e) => e.is_active !== false).length,
      inactive: list.filter((e) => e.is_active === false).length,
      departmentsCovered: new Set(list.map((e) => e.department_id).filter(Boolean)).size,
    };
  }, [employees, lockedFactoryId]);

  function resetForm() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      factory_id: lockedFactoryId || resolvePreferredFactoryId(user, factories),
    });
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const payload = {
        factory_id: Number(lockedFactoryId || form.factory_id),
        department_id: Number(form.department_id),
        employee_code: form.employee_code.trim(),
        first_name: form.first_name.trim(),
        last_name: form.last_name.trim(),
        job_title: form.job_title.trim() || null,
        hire_date: form.hire_date || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        employment_status: form.employment_status.trim() || "active",
        is_active: Boolean(form.is_active),
      };

      if (!payload.factory_id) throw new Error("اختر المصنع أولًا");
      if (!payload.department_id) throw new Error("اختر القسم أولًا");
      if (!payload.employee_code || !payload.first_name || !payload.last_name) {
        throw new Error("أدخل كود الموظف والاسم الأول واسم العائلة");
      }

      const url = editingId ? `${EMPLOYEES_API_URL}/${editingId}` : EMPLOYEES_API_URL;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حفظ الموظف");

      setMessage(editingId ? "تم تحديث الموظف بنجاح" : "تم إنشاء الموظف بنجاح");
      resetForm();
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء حفظ الموظف");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(employee) {
    setEditingId(employee.id);
    setForm({
      factory_id: String(employee.factory_id || lockedFactoryId || ""),
      department_id: String(employee.department_id || ""),
      employee_code: employee.employee_code || "",
      first_name: employee.first_name || "",
      last_name: employee.last_name || "",
      job_title: employee.job_title || "",
      hire_date: employee.hire_date || "",
      phone: employee.phone || "",
      email: employee.email || "",
      employment_status: employee.employment_status || "active",
      is_active: !!employee.is_active,
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleDelete(id) {
    if (!window.confirm("هل تريد حذف الموظف؟")) return;
    try {
      const res = await fetch(`${EMPLOYEES_API_URL}/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف الموظف");
      setMessage("تم حذف الموظف بنجاح");
      if (editingId === id) resetForm();
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء حذف الموظف");
    }
  }

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل الموظفين...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">الموارد البشرية / الموظفون</div>
            <h2>إدارة الموظفين</h2>
            <p>سجل موحد للموظفين مع المصنع والقسم والحالة الوظيفية والبيانات الأساسية على أسلوب مؤسسي منظم.</p>
            <div className="erp-hero-actions">
              <div className="erp-hero-pill">إجمالي الموظفين: {stats.total}</div>
              <div className="erp-hero-pill">النشطون: {stats.active}</div>
              <div className="erp-hero-pill">الأقسام المغطاة: {stats.departmentsCovered}</div>
            </div>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">غير النشطين</div>
              <div className="erp-stat-box-value">{stats.inactive}</div>
            </div>
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">النطاق</div>
              <div className="erp-stat-box-value" style={{ fontSize: 24 }}>
                {lockedFactoryId ? `مصنع #${lockedFactoryId}` : "المجموعة"}
              </div>
            </div>
            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">إجمالي الموظفين</div><div className="erp-card-value">{stats.total}</div><div className="erp-card-note">كل السجلات الحالية</div></div>
          <div className="erp-card"><div className="erp-card-title">النشطون</div><div className="erp-card-value">{stats.active}</div><div className="erp-card-note">حالة تشغيلية فعالة</div></div>
          <div className="erp-card"><div className="erp-card-title">غير النشطين</div><div className="erp-card-value">{stats.inactive}</div><div className="erp-card-note">بحاجة إلى متابعة</div></div>
          <div className="erp-card"><div className="erp-card-title">الأقسام المغطاة</div><div className="erp-card-value">{stats.departmentsCovered}</div><div className="erp-card-note">توزيع مؤسسي</div></div>
        </section>

        <div className="erp-form-shell">
          <div className="erp-section-head" style={{ marginBottom: 18 }}>
            <div>
              <h3 style={{ margin: 0, fontSize: 22, fontWeight: 900 }}>{editingId ? "تعديل موظف" : "إضافة موظف جديد"}</h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8 }}>
                أدخل بيانات الموظف الأساسية واربطه بالمصنع والقسم الصحيحين.
              </p>
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <button type="button" className="erp-btn-secondary" onClick={() => exportEmployeesCsv(filteredEmployees, factoryMap, departmentMap)}>Export CSV</button>
              <button type="button" className="erp-btn-primary" onClick={() => exportEmployeesPdf(filteredEmployees, factoryMap, departmentMap, stats)}>Export PDF</button>
              <div className="erp-mini-note">{editingId ? `#${editingId}` : "New"}</div>
            </div>
          </div>

          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}>
            <div>
              <label className="erp-label">المصنع</label>
              <select className="erp-input" value={lockedFactoryId || form.factory_id} disabled={Boolean(lockedFactoryId)} onChange={(e) => setForm((prev) => ({ ...prev, factory_id: e.target.value, department_id: "" }))}>
                <option value="">اختر المصنع</option>
                {visibleFactories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>

            <div>
              <label className="erp-label">القسم</label>
              <select className="erp-input" value={form.department_id} onChange={(e) => setForm((prev) => ({ ...prev, department_id: e.target.value }))}>
                <option value="">اختر القسم</option>
                {filteredDepartments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>

            <div>
              <label className="erp-label">كود الموظف</label>
              <input className="erp-input" value={form.employee_code} onChange={(e) => setForm((prev) => ({ ...prev, employee_code: e.target.value }))} />
            </div>

            <div>
              <label className="erp-label">الاسم الأول</label>
              <input className="erp-input" value={form.first_name} onChange={(e) => setForm((prev) => ({ ...prev, first_name: e.target.value }))} />
            </div>

            <div>
              <label className="erp-label">اسم العائلة</label>
              <input className="erp-input" value={form.last_name} onChange={(e) => setForm((prev) => ({ ...prev, last_name: e.target.value }))} />
            </div>

            <div>
              <label className="erp-label">المسمى الوظيفي</label>
              <input className="erp-input" value={form.job_title} onChange={(e) => setForm((prev) => ({ ...prev, job_title: e.target.value }))} />
            </div>

            <div>
              <label className="erp-label">تاريخ التعيين</label>
              <input className="erp-input" type="date" value={form.hire_date} onChange={(e) => setForm((prev) => ({ ...prev, hire_date: e.target.value }))} />
            </div>

            <div>
              <label className="erp-label">الهاتف</label>
              <input className="erp-input" value={form.phone} onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))} />
            </div>

            <div>
              <label className="erp-label">البريد الإلكتروني</label>
              <input className="erp-input" value={form.email} onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))} />
            </div>

            <div>
              <label className="erp-label">الحالة الوظيفية</label>
              <input className="erp-input" value={form.employment_status} onChange={(e) => setForm((prev) => ({ ...prev, employment_status: e.target.value }))} />
            </div>

            <div>
              <label className="erp-label">الحالة</label>
              <select className="erp-input" value={form.is_active ? "1" : "0"} onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.value === "1" }))}>
                <option value="1">نشط</option>
                <option value="0">غير نشط</option>
              </select>
            </div>

            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={submitting}>
                {submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة الموظف"}
              </button>
              {editingId ? (
                <button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء</button>
              ) : null}
            </div>
          </form>

          {message ? <div className="erp-form-message">{message}</div> : null}
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <div>
              <h3>سجل الموظفين</h3>
              <p>ابحث واستعرض وعدّل السجلات الحالية</p>
            </div>
            <div style={{ width: 320, maxWidth: "100%" }}>
              <input className="erp-search" placeholder="ابحث بالاسم أو الكود أو القسم..." value={search} onChange={(e) => setSearch(e.target.value)} />
            </div>
          </div>

          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>الكود</th>
                  <th>الاسم</th>
                  <th>المصنع</th>
                  <th>القسم</th>
                  <th>المسمى</th>
                  <th>الحالة</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredEmployees.length === 0 ? (
                  <tr><td colSpan="8">{employees.length === 0 ? "لا توجد سجلات موظفين حالياً." : "لا توجد نتائج مطابقة."}</td></tr>
                ) : (
                  filteredEmployees.map((e) => (
                    <tr key={e.id}>
                      <td>{e.id}</td>
                      <td>{e.employee_code}</td>
                      <td>{e.first_name} {e.last_name}</td>
                      <td>{factoryMap[e.factory_id] || `مصنع #${e.factory_id}`}</td>
                      <td>{departmentMap[e.department_id] || `قسم #${e.department_id}`}</td>
                      <td>{e.job_title || "-"}</td>
                      <td>{e.is_active ? <span className="erp-badge success">نشط</span> : <span className="erp-badge warning">غير نشط</span>}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                          <button type="button" className="erp-btn-secondary" onClick={() => handleEdit(e)}>تعديل</button>
                          <button type="button" className="erp-btn-danger" onClick={() => handleDelete(e.id)}>حذف</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
