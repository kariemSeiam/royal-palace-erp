"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

export default function FactoriesPage() {
  const { user, ready } = useAdminAuth("factories");
  const [factories, setFactories] = useState([]);
  const [form, setForm] = useState({
    code: "",
    name: "",
    is_active: true,
  });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  async function loadFactories() {
    const res = await fetch("https://api.royalpalace-group.com/api/v1/admin/erp/factories", {
      headers: authHeaders(),
      cache: "no-store",
    });
    const data = res.ok ? await res.json() : [];
    setFactories(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (!ready) return;
    loadFactories().catch(() => {
      setFactories([]);
      setMessage("تعذر تحميل بيانات المصانع");
    });
  }, [ready]);

  const stats = useMemo(() => {
    const total = factories.length;
    const active = factories.filter((f) => f.is_active).length;
    const inactive = total - active;

    return {
      total,
      active,
      inactive,
    };
  }, [factories]);

  const filteredFactories = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return factories;

    return factories.filter((factory) => {
      const haystack = [factory.id, factory.code, factory.name].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [factories, search]);

  const executiveNotes = useMemo(() => {
    const notes = [];

    if (stats.total === 0) {
      notes.push({
        title: "لا توجد مصانع مسجلة",
        body: "ابدأ بإضافة كيانات المجموعة التشغيلية حتى يتم تفعيل الربط الصحيح مع الأقسام والموظفين والصلاحيات.",
      });
    }

    if (stats.inactive > 0) {
      notes.push({
        title: "يوجد مصانع غير نشطة",
        body: "راجع حالة المصانع غير النشطة قبل ربط المستخدمين والبيانات التشغيلية بها داخل النظام.",
      });
    }

    if (notes.length === 0) {
      notes.push({
        title: "هيكل المصانع مستقر",
        body: "المصانع الحالية مهيأة ويمكن البناء عليها في بقية الموديولات التشغيلية للمجموعة.",
      });
    }

    return notes;
  }, [stats]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const url = editingId
        ? `https://api.royalpalace-group.com/api/v1/admin/erp/factories/${editingId}`
        : "https://api.royalpalace-group.com/api/v1/admin/erp/factories";

      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(form),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || (editingId ? "فشل تعديل المصنع" : "فشل إنشاء المصنع"));
      }

      setForm({
        code: "",
        name: "",
        is_active: true,
      });
      setEditingId(null);
      setMessage(editingId ? "تم تعديل المصنع بنجاح" : "تم إنشاء المصنع بنجاح");
      await loadFactories();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء حفظ المصنع");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(factory) {
    setEditingId(factory.id);
    setForm({
      code: factory.code || "",
      name: factory.name || "",
      is_active: !!factory.is_active,
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm({
      code: "",
      name: "",
      is_active: true,
    });
    setMessage("");
  }

  async function toggleFactoryStatus(factory) {
    try {
      const res = await fetch(
        `https://api.royalpalace-group.com/api/v1/admin/erp/factories/${factory.id}/status`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({
            is_active: !factory.is_active,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحديث حالة المصنع");

      setMessage("تم تحديث حالة المصنع بنجاح");
      await loadFactories();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء تحديث الحالة");
    }
  }

  async function handleDelete(factoryId) {
    if (!confirm("هل تريد حذف هذا المصنع؟")) return;

    try {
      const res = await fetch(
        `https://api.royalpalace-group.com/api/v1/admin/erp/factories/${factoryId}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف المصنع");

      setMessage("تم حذف المصنع بنجاح");
      if (editingId === factoryId) {
        handleCancelEdit();
      }
      await loadFactories();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء حذف المصنع");
    }
  }

  function handleExportCsv() {
    const headers = ["ID", "الكود", "الاسم", "نشط"];
    const rows = filteredFactories.map((f) => [f.id, f.code, f.name, f.is_active ? "نعم" : "لا"]);
    exportTableCsv("factories_export.csv", headers, rows);
  }

  function handleExportPdf() {
    const headers = ["ID", "الكود", "الاسم", "نشط"];
    const rows = filteredFactories.map((f) => [f.id, f.code, f.name, f.is_active ? "نعم" : "لا"]);
    exportTablePdf("تقرير المصانع", "المصانع / الكيانات التشغيلية",
      [
        { label: "إجمالي المصانع", value: stats.total },
        { label: "النشطة", value: stats.active },
      ],
      headers, rows);
  }

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل المصانع...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />

      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">إدارة مصانع المجموعة</div>
            <h2>المصانع والكيانات التشغيلية</h2>
            <p>
              إدارة المصانع داخل المجموعة مع الحفاظ على ربطها بالنطاقات التشغيلية
              والصلاحيات والموديولات التنفيذية الأخرى داخل النظام.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">إجمالي المصانع: {stats.total}</div>
              <div className="erp-hero-pill">المصانع النشطة: {stats.active}</div>
              <div className="erp-hero-pill">غير النشطة: {stats.inactive}</div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">المصانع النشطة</div>
              <div className="erp-stat-box-value">{stats.active}</div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">المصانع غير النشطة</div>
              <div className="erp-stat-box-value">{stats.inactive}</div>
            </div>

            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">إجمالي المصانع</div>
            <div className="erp-card-value">{stats.total}</div>
            <div className="erp-card-note">كل الكيانات المسجلة</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">المصانع النشطة</div>
            <div className="erp-card-value">{stats.active}</div>
            <div className="erp-card-note">جاهزة للتشغيل</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">المصانع غير النشطة</div>
            <div className="erp-card-value">{stats.inactive}</div>
            <div className="erp-card-note">تحتاج متابعة</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">حالة الموديول</div>
            <div className="erp-card-value">Live</div>
            <div className="erp-card-note">Factories module active</div>
          </div>
        </section>

        <section className="erp-grid-2" style={{ marginBottom: "20px" }}>
          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>ملاحظات تنفيذية</h3>
                <p>مراجعة سريعة لحالة كيانات المصانع داخل المنظومة</p>
              </div>
              <div className="erp-mini-note">Factories Review</div>
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
                <h3>المصانع الحالية</h3>
                <p>عرض سريع لحالة كل مصنع داخل النظام</p>
              </div>
              <div className="erp-mini-note">{filteredFactories.length} عناصر</div>
            </div>

            {filteredFactories.length === 0 ? (
              <div className="erp-form-message">
                {factories.length === 0 ? "لا توجد مصانع حالياً." : "لا توجد نتائج مطابقة للبحث."}
              </div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {filteredFactories.slice(0, 4).map((factory) => (
                  <div
                    key={factory.id}
                    style={{
                      padding: "14px",
                      border: "1px solid var(--rp-border)",
                      borderRadius: "18px",
                      background: "var(--rp-surface-2)",
                      display: "grid",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                      <div>
                        <div style={{ fontWeight: 900, fontSize: "16px", color: "var(--rp-text)" }}>
                          {factory.name}
                        </div>
                        <div style={{ marginTop: "4px", color: "var(--rp-text-muted)", fontSize: "13px" }}>
                          {factory.code || "بدون كود"}
                        </div>
                      </div>

                      <span className={`erp-badge ${factory.is_active ? "success" : "warning"}`}>
                        {factory.is_active ? "نشط" : "غير نشط"}
                      </span>
                    </div>

                    <div className="erp-mini-note">Factory ID: {factory.id}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div className="erp-form-shell">
          <h3 className="erp-form-title">
            {editingId ? "تعديل المصنع" : "إضافة مصنع جديد"}
          </h3>

          <form className="erp-form-grid" onSubmit={handleSubmit}>
            <div>
              <label className="erp-label">كود المصنع</label>
              <input
                className="erp-input"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
              />
            </div>

            <div>
              <label className="erp-label">اسم المصنع</label>
              <input
                className="erp-input"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
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
                {submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة المصنع"}
              </button>

              {editingId ? (
                <button
                  type="button"
                  className="erp-btn-secondary"
                  onClick={handleCancelEdit}
                >
                  إلغاء
                </button>
              ) : null}
            </div>
          </form>

          {message ? <div className="erp-form-message">{message}</div> : null}
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <div>
              <h3>قائمة المصانع</h3>
              <p>إدارة الكيانات التشغيلية مع بحث سريع داخل البيانات الحالية</p>
            </div>

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center", width: "100%" }}>
              <input
                className="erp-search"
                placeholder="ابحث بالاسم أو الكود..."
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
                  <th>الكود</th>
                  <th>اسم المصنع</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredFactories.length === 0 ? (
                  <tr>
                    <td colSpan="5">
                      {factories.length === 0 ? "لا توجد مصانع حالياً." : "لا توجد نتائج مطابقة للبحث."}
                    </td>
                  </tr>
                ) : (
                  filteredFactories.map((factory) => (
                    <tr key={factory.id}>
                      <td>{factory.id}</td>
                      <td>{factory.code}</td>
                      <td>{factory.name}</td>
                      <td>
                        {factory.is_active ? (
                          <span className="erp-badge success">نشط</span>
                        ) : (
                          <span className="erp-badge warning">غير نشط</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button type="button" className="erp-btn-secondary" onClick={() => handleEdit(factory)}>
                            تعديل
                          </button>

                          <button
                            type="button"
                            className={factory.is_active ? "erp-btn-danger" : "erp-btn-primary"}
                            onClick={() => toggleFactoryStatus(factory)}
                          >
                            {factory.is_active ? "تعطيل" : "تفعيل"}
                          </button>

                          <button type="button" className="erp-btn-danger" onClick={() => handleDelete(factory.id)}>
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
