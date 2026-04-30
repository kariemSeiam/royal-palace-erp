"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";

function resolvePreferredFactoryId(user, factories) {
  if (!Array.isArray(factories) || factories.length === 0) return "";

  const userFactoryId = user?.factory_id || user?.factory?.id || "";
  if (userFactoryId && factories.some((f) => String(f.id) === String(userFactoryId))) {
    return String(userFactoryId);
  }

  return String(factories[0]?.id || "");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

export default function DepartmentsPage() {
  const { user, ready } = useAdminAuth("departments");
  const [departments, setDepartments] = useState([]);
  const [factories, setFactories] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState({
    factory_id: "",
    name: "",
    code: "",
    is_active: true,
  });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const lockedFactoryId = !user?.is_superuser && user?.factory_id ? String(user.factory_id) : "";

  const visibleFactories = useMemo(() => {
    if (!lockedFactoryId) return factories;
    return factories.filter((f) => String(f.id) === lockedFactoryId);
  }, [factories, lockedFactoryId]);

  const factoryMap = useMemo(() => {
    const map = {};
    factories.forEach((f) => {
      map[f.id] = f.name;
    });
    return map;
  }, [factories]);

  async function loadAll() {
    const [departmentsRes, factoriesRes] = await Promise.all([
      fetch("https://api.royalpalace-group.com/api/v1/admin/erp/departments", {
        headers: authHeaders(),
        cache: "no-store",
      }),
      fetch("https://api.royalpalace-group.com/api/v1/admin/erp/factories", {
        headers: authHeaders(),
        cache: "no-store",
      }),
    ]);

    const departmentsData = departmentsRes.ok ? await departmentsRes.json() : [];
    const factoriesData = factoriesRes.ok ? await factoriesRes.json() : [];

    const safeDepartments = Array.isArray(departmentsData) ? departmentsData : [];
    const safeFactories = Array.isArray(factoriesData) ? factoriesData : [];

    setDepartments(safeDepartments);
    setFactories(safeFactories);

    setForm((prev) => {
      if (prev.factory_id) return prev;
      return {
        ...prev,
        factory_id: lockedFactoryId || resolvePreferredFactoryId(user, safeFactories),
      };
    });
  }

  useEffect(() => {
    if (!ready || !user) return;

    loadAll().catch(() => {
      setDepartments([]);
      setFactories([]);
      setMessage("تعذر تحميل بيانات الأقسام");
    });
  }, [ready, user]);

  useEffect(() => {
    if (!ready || !user || factories.length === 0) return;
    if (editingId) return;

    const preferredFactoryId = lockedFactoryId || resolvePreferredFactoryId(user, factories);
    setForm((prev) => ({
      ...prev,
      factory_id: preferredFactoryId,
    }));
  }, [ready, user, factories, lockedFactoryId, editingId]);

  const filteredDepartments = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return departments;

    return departments.filter((department) => {
      const haystack = [
        department.id,
        department.name,
        department.code,
        factoryMap[department.factory_id],
        department.factory_id,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [departments, search, factoryMap]);

  const stats = useMemo(() => {
    const total = departments.length;
    const active = departments.filter((item) => item.is_active !== false).length;
    const inactive = total - active;
    const factoriesCount = new Set(departments.map((item) => item.factory_id).filter(Boolean)).size;

    return { total, active, inactive, factoriesCount };
  }, [departments]);

  const executiveNotes = useMemo(() => {
    const notes = [];

    if (stats.total === 0) {
      notes.push({
        title: "لا توجد أقسام تشغيلية بعد",
        body: "ابدأ بتجهيز الهيكل الإداري لكل مصنع قبل ربط الموظفين والحضور والصلاحيات التشغيلية.",
      });
    }

    if (stats.inactive > 0) {
      notes.push({
        title: "يوجد أقسام غير نشطة",
        body: "راجع الأقسام المعطلة قبل اعتماد الهيكل النهائي للمصنع أو ربط الموظفين عليها.",
      });
    }

    if (notes.length === 0) {
      notes.push({
        title: "هيكل الأقسام مستقر",
        body: "الوضع الحالي مناسب لاستكمال التوزيع على الموظفين وربط الحضور والصلاحيات التشغيلية.",
      });
    }

    return notes;
  }, [stats]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const selectedFactoryId = lockedFactoryId || form.factory_id;

      if (!selectedFactoryId) {
        throw new Error("يجب اختيار المصنع أولًا");
      }

      const url = editingId
        ? `https://api.royalpalace-group.com/api/v1/admin/erp/departments/${editingId}`
        : "https://api.royalpalace-group.com/api/v1/admin/erp/departments";

      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          factory_id: Number(selectedFactoryId),
          name: form.name.trim(),
          code: form.code.trim(),
          is_active: Boolean(form.is_active),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || (editingId ? "فشل تعديل القسم" : "فشل إنشاء القسم"));
      }

      setForm({
        factory_id: lockedFactoryId || resolvePreferredFactoryId(user, factories),
        name: "",
        code: "",
        is_active: true,
      });
      setEditingId(null);
      setMessage(editingId ? "تم تعديل القسم بنجاح" : "تم إنشاء القسم بنجاح");
      await loadAll();
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء حفظ القسم");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(department) {
    setEditingId(department.id);
    setForm({
      factory_id: String(department.factory_id || lockedFactoryId || ""),
      name: department.name || "",
      code: department.code || "",
      is_active: !!department.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm({
      factory_id: lockedFactoryId || resolvePreferredFactoryId(user, factories),
      name: "",
      code: "",
      is_active: true,
    });
    setMessage("");
  }

  async function handleDelete(id) {
    if (!confirm("هل تريد حذف هذا القسم؟")) return;

    try {
      const res = await fetch(`https://api.royalpalace-group.com/api/v1/admin/erp/departments/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف القسم");

      setMessage("تم حذف القسم بنجاح");
      if (editingId === id) {
        handleCancelEdit();
      }
      await loadAll();
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء حذف القسم");
    }
  }

  function handleExportCsv() {
    const headers = ["ID", "المصنع", "الاسم", "الكود", "نشط"];
    const rows = filteredDepartments.map((d) => [
      d.id,
      factoryMap[d.factory_id] || `مصنع #${d.factory_id}`,
      d.name,
      d.code,
      d.is_active ? "نعم" : "لا",
    ]);
    exportTableCsv("departments_export.csv", headers, rows);
  }

  function handleExportPdf() {
    const headers = ["ID", "المصنع", "الاسم", "الكود", "نشط"];
    const rows = filteredDepartments.map((d) => [
      d.id,
      factoryMap[d.factory_id] || `مصنع #${d.factory_id}`,
      d.name,
      d.code,
      d.is_active ? "نعم" : "لا",
    ]);
    exportTablePdf("تقرير الأقسام", "الهيكل التنظيمي / الأقسام",
      [
        { label: "إجمالي الأقسام", value: stats.total },
        { label: "النشطة", value: stats.active },
      ],
      headers, rows);
  }

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل الأقسام...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />

      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">الهيكل التنظيمي التشغيلي</div>
            <h2>إدارة الأقسام التشغيلية</h2>
            <p>
              تنظيم الأقسام المرتبطة بالمصانع بصورة احترافية مع احترام الـ factory scope الحالي
              داخل النظام الحي.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">إجمالي الأقسام: {stats.total}</div>
              <div className="erp-hero-pill">النشطة: {stats.active}</div>
              <div className="erp-hero-pill">المصانع المغطاة: {stats.factoriesCount}</div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">الأقسام غير النشطة</div>
              <div className="erp-stat-box-value">{stats.inactive}</div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">نطاق المستخدم</div>
              <div className="erp-stat-box-value" style={{ fontSize: "24px" }}>
                {lockedFactoryId ? `Factory #${lockedFactoryId}` : "Group"}
              </div>
            </div>

            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">إجمالي الأقسام</div>
            <div className="erp-card-value">{stats.total}</div>
            <div className="erp-card-note">الوحدات المسجلة</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">الأقسام النشطة</div>
            <div className="erp-card-value">{stats.active}</div>
            <div className="erp-card-note">جاهزة للتشغيل</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">الأقسام غير النشطة</div>
            <div className="erp-card-value">{stats.inactive}</div>
            <div className="erp-card-note">تحتاج مراجعة</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">المصانع المغطاة</div>
            <div className="erp-card-value">{stats.factoriesCount}</div>
            <div className="erp-card-note">Factory coverage</div>
          </div>
        </section>

        <section className="erp-grid-2" style={{ marginBottom: "20px" }}>
          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>ملاحظات تنفيذية</h3>
                <p>مراجعة سريعة لحالة الهيكل التنظيمي الحالي</p>
              </div>
              <div className="erp-mini-note">Org Review</div>
            </div>

            <div className="erp-alert-list">
              {executiveNotes.map((note, index) => (
                <div key={index} className="erp-alert-item">
                  <strong>{note.title}</strong>
                  <p>{note.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>{editingId ? "تعديل القسم" : "إضافة قسم جديد"}</h3>
                <p>إنشاء أو تعديل القسم من نفس الفورم العلوية</p>
              </div>
              <div className="erp-mini-note">{editingId ? `#${editingId}` : "New"}</div>
            </div>

            <form className="erp-form-grid" onSubmit={handleSubmit}>
              <div>
                <label className="erp-label">المصنع</label>
                <select
                  className="erp-input"
                  value={form.factory_id}
                  onChange={(e) => setForm({ ...form, factory_id: e.target.value })}
                  disabled={Boolean(lockedFactoryId)}
                >
                  {visibleFactories.length === 0 ? <option value="">لا توجد مصانع متاحة</option> : null}
                  {visibleFactories.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="erp-label">اسم القسم</label>
                <input
                  className="erp-input"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </div>

              <div>
                <label className="erp-label">كود القسم</label>
                <input
                  className="erp-input"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                />
              </div>

              <div>
                <label className="erp-label">الحالة</label>
                <select
                  className="erp-input"
                  value={form.is_active ? "1" : "0"}
                  onChange={(e) => setForm({ ...form, is_active: e.target.value === "1" })}
                >
                  <option value="1">نشط</option>
                  <option value="0">غير نشط</option>
                </select>
              </div>

              <div className="erp-form-actions">
                <button className="erp-btn-primary" type="submit" disabled={submitting}>
                  {submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة القسم"}
                </button>

                {editingId ? (
                  <button type="button" className="erp-btn-secondary" onClick={handleCancelEdit}>
                    إلغاء
                  </button>
                ) : null}
              </div>
            </form>

            {message ? <div className="erp-form-message">{message}</div> : null}
          </div>
        </section>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <div>
              <h3>قائمة الأقسام</h3>
              <p>بحث سريع داخل الأقسام مع حالة التفعيل والمصنع المرتبط</p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", width: "100%" }}>
              <input
                className="erp-search"
                placeholder="ابحث بالاسم أو الكود أو المصنع..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                style={{ flex: "1 1 260px", minWidth: "220px" }}
              />
              <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button>
              <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button>
            </div>
          </div>

          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>المصنع</th>
                  <th>الاسم</th>
                  <th>الكود</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredDepartments.length === 0 ? (
                  <tr>
                    <td colSpan="6">
                      {departments.length === 0 ? "لا توجد أقسام حالياً." : "لا توجد نتائج مطابقة للبحث."}
                    </td>
                  </tr>
                ) : (
                  filteredDepartments.map((d) => (
                    <tr key={d.id}>
                      <td>{d.id}</td>
                      <td>{factoryMap[d.factory_id] || `Factory #${d.factory_id}`}</td>
                      <td>{d.name}</td>
                      <td>{d.code}</td>
                      <td>
                        {d.is_active ? (
                          <span className="erp-badge success">نشط</span>
                        ) : (
                          <span className="erp-badge warning">غير نشط</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button className="erp-btn-secondary" onClick={() => handleEdit(d)}>
                            تعديل
                          </button>

                          <button className="erp-btn-danger" onClick={() => handleDelete(d.id)}>
                            حذف
                          </button>
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
