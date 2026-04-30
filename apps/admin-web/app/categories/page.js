"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const emptyForm = {
  name_ar: "",
  name_en: "",
  slug: "",
  description_ar: "",
  description_en: "",
  image_url: "",
  banner_image_url: "",
  sort_order: "0",
  is_active: true,
};

const actionButtonBaseStyle = {
  minHeight: "40px",
  padding: "10px 16px",
  borderRadius: "12px",
  border: "1px solid transparent",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: "13px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
};

const editButtonStyle = {
  ...actionButtonBaseStyle,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
  color: "var(--rp-text)",
  borderColor: "var(--rp-border)",
};

const deleteButtonStyle = {
  ...actionButtonBaseStyle,
  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
  color: "#ffffff",
  boxShadow: "0 12px 24px rgba(185, 28, 28, 0.18)",
};

const primaryButtonStyle = {
  ...actionButtonBaseStyle,
  minHeight: "48px",
  padding: "12px 18px",
  background: "linear-gradient(135deg, #c9a66b 0%, #d6b47a 100%)",
  color: "#111827",
  boxShadow: "0 14px 30px rgba(201, 166, 107, 0.22)",
};

const secondaryButtonStyle = {
  ...actionButtonBaseStyle,
  minHeight: "48px",
  padding: "12px 18px",
  background: "#eef2f7",
  color: "var(--rp-text)",
  borderColor: "var(--rp-border)",
};

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export default function CategoriesPage() {
  const { user, ready } = useAdminAuth("categories");

  const [items, setItems] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  const formShellRef = useRef(null);
  const firstFieldRef = useRef(null);

  async function loadItems() {
    const res = await fetch("https://api.royalpalace-group.com/api/v1/admin/catalog/categories", {
      headers: authHeaders(),
      cache: "no-store",
    });

    const data = await res.json().catch(() => []);

    if (!res.ok) {
      throw new Error(data.detail || "فشل تحميل الأقسام");
    }

    setItems(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (!ready) return;

    loadItems().catch((err) => {
      setMessage(err.message || "حدث خطأ أثناء تحميل الأقسام");
    });
  }, [ready]);

  const sortedItems = useMemo(() => {
    return [...items].sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0));
  }, [items]);

  const filteredItems = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return sortedItems;

    return sortedItems.filter((item) => {
      const haystack = [
        item.id,
        item.name_ar,
        item.name_en,
        item.slug,
        item.description_ar,
        item.description_en,
        item.sort_order,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [sortedItems, search]);

  const stats = useMemo(() => {
    const total = items.length;
    const active = items.filter((item) => item.is_active !== false).length;
    const inactive = items.filter((item) => item.is_active === false).length;
    const withImage = items.filter((item) => item.image_url).length;
    const withBanner = items.filter((item) => item.banner_image_url).length;

    return {
      total,
      active,
      inactive,
      withImage,
      withBanner,
    };
  }, [items]);

  const executiveNotes = useMemo(() => {
    const notes = [];

    if (stats.total === 0) {
      notes.push({
        title: "لا توجد أقسام رئيسية بعد",
        body: "الكتالوج يحتاج بنية تصنيف أولية حتى تظهر المنتجات بشكل منظم داخل المتجر ولوحة الإدارة.",
      });
    }

    if (stats.total > 0 && stats.withImage < stats.total) {
      notes.push({
        title: "بعض الأقسام بدون صورة",
        body: "وجود صورة رئيسية لكل قسم يحسن الظهور داخل المتجر ويقوي الهوية البصرية للكتالوج.",
      });
    }

    if (stats.total > 0 && stats.withBanner < stats.total) {
      notes.push({
        title: "البنرات غير مكتملة",
        body: "بعض الأقسام لا تحتوي على banner image، وده يقلل جودة الصفحات التسويقية وأقسام العرض.",
      });
    }

    if (stats.inactive > 0) {
      notes.push({
        title: "يوجد أقسام غير نشطة",
        body: "في أقسام موجودة داخل النظام لكنها غير منشورة فعليًا، وده محتاج مراجعة قبل الاعتماد النهائي.",
      });
    }

    if (notes.length === 0) {
      notes.push({
        title: "هيكل التصنيفات مستقر",
        body: "الوضع الحالي جيد، ويمكن البناء عليه في تحسين ترتيب الأقسام وربطها بخبرة عرض أقوى داخل المتجر.",
      });
    }

    return notes;
  }, [stats]);

  const highlightedItems = useMemo(() => {
    return [...filteredItems]
      .sort((a, b) => {
        const scoreA =
          (a.is_active !== false ? 3 : 0) +
          (a.banner_image_url ? 2 : 0) +
          (a.image_url ? 1 : 0);

        const scoreB =
          (b.is_active !== false ? 3 : 0) +
          (b.banner_image_url ? 2 : 0) +
          (b.image_url ? 1 : 0);

        return scoreB - scoreA;
      })
      .slice(0, 3);
  }, [filteredItems]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
    setMessage("");
  }

  function startEdit(item) {
    setEditingId(item.id);
    setForm({
      name_ar: item.name_ar || "",
      name_en: item.name_en || "",
      slug: item.slug || "",
      description_ar: item.description_ar || "",
      description_en: item.description_en || "",
      image_url: item.image_url || "",
      banner_image_url: item.banner_image_url || "",
      sort_order: String(item.sort_order ?? 0),
      is_active: item.is_active !== false,
    });
    setMessage("");

    setTimeout(() => {
      if (firstFieldRef.current) {
        firstFieldRef.current.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
        firstFieldRef.current.focus({ preventScroll: true });
      } else if (formShellRef.current) {
        formShellRef.current.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      }
    }, 80);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const payload = {
        name_ar: form.name_ar.trim(),
        name_en: form.name_en.trim() || null,
        slug: form.slug.trim(),
        description_ar: form.description_ar.trim() || null,
        description_en: form.description_en.trim() || null,
        image_url: form.image_url.trim() || null,
        banner_image_url: form.banner_image_url.trim() || null,
        sort_order: Number(form.sort_order || 0),
        is_active: Boolean(form.is_active),
      };

      const url = editingId
        ? `https://api.royalpalace-group.com/api/v1/admin/catalog/categories/${editingId}`
        : "https://api.royalpalace-group.com/api/v1/admin/catalog/categories";

      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "فشل حفظ القسم");
      }

      setMessage(editingId ? "تم تعديل القسم بنجاح" : "تم إضافة القسم بنجاح");
      resetForm();
      await loadItems();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء حفظ القسم");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("هل تريد حذف هذا القسم؟")) return;

    setDeletingId(id);
    setMessage("");

    try {
      const res = await fetch(`https://api.royalpalace-group.com/api/v1/admin/catalog/categories/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "فشل حذف القسم");
      }

      setMessage("تم حذف القسم بنجاح");
      if (editingId === id) resetForm();
      await loadItems();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء حذف القسم");
    } finally {
      setDeletingId(null);
    }
  }

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل الأقسام الرئيسية...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />

      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">إدارة أقسام الكتالوج</div>
            <h2>الأقسام الرئيسية وهوية العرض</h2>
            <p>
              إدارة بنية التصنيفات الأساسية للمتجر مع الصور والبنرات والترتيب والمحتوى العربي
              والإنجليزي بصورة تنفيذية متسقة مع هوية Royal Palace.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">إجمالي الأقسام: {stats.total}</div>
              <div className="erp-hero-pill">الأقسام النشطة: {stats.active}</div>
              <div className="erp-hero-pill">بنرات جاهزة: {stats.withBanner}</div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">الأقسام غير النشطة</div>
              <div className="erp-stat-box-value">{stats.inactive}</div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">أقسام بصور رئيسية</div>
              <div className="erp-stat-box-value">{stats.withImage}</div>
            </div>

            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">إجمالي الأقسام</div>
            <div className="erp-card-value">{stats.total}</div>
            <div className="erp-card-note">هيكل الكتالوج الأساسي</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">الأقسام النشطة</div>
            <div className="erp-card-value">{stats.active}</div>
            <div className="erp-card-note">جاهزة للعرض</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">بصور رئيسية</div>
            <div className="erp-card-value">{stats.withImage}</div>
            <div className="erp-card-note">جاهزية بصرية أفضل</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">ببنرات</div>
            <div className="erp-card-value">{stats.withBanner}</div>
            <div className="erp-card-note">جاهزة للتسويق والعرض</div>
          </div>
        </section>

        <section className="erp-grid-2" style={{ marginBottom: "20px" }}>
          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>ملاحظات تنفيذية</h3>
                <p>تحسينات سريعة ترفع جودة الكتالوج قبل ربطه الكامل بالتجربة التجارية</p>
              </div>
              <div className="erp-mini-note">Catalog Review</div>
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
                <h3>أفضل الأقسام ظهورًا</h3>
                <p>عرض سريع للأقسام الأقرب للاكتمال من حيث الصور والبنرات والتفعيل</p>
              </div>
              <div className="erp-mini-note">{highlightedItems.length} عناصر</div>
            </div>

            {highlightedItems.length === 0 ? (
              <div className="erp-form-message">لا توجد أقسام كافية للعرض حاليًا.</div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {highlightedItems.map((item) => (
                  <div
                    key={item.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "92px minmax(0, 1fr)",
                      gap: "14px",
                      padding: "14px",
                      border: "1px solid var(--rp-border)",
                      borderRadius: "18px",
                      background: "var(--rp-surface-2)",
                    }}
                  >
                    <div
                      style={{
                        height: "92px",
                        borderRadius: "16px",
                        overflow: "hidden",
                        background: "#e2e8f0",
                      }}
                    >
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name_ar || "category"}
                          style={{ width: "100%", height: "100%", objectFit: "cover" }}
                        />
                      ) : (
                        <div
                          style={{
                            width: "100%",
                            height: "100%",
                            display: "grid",
                            placeItems: "center",
                            color: "#64748b",
                            fontWeight: 800,
                            fontSize: "12px",
                            textAlign: "center",
                            padding: "8px",
                          }}
                        >
                          بدون صورة
                        </div>
                      )}
                    </div>

                    <div style={{ minWidth: 0 }}>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          gap: "12px",
                          alignItems: "flex-start",
                          flexWrap: "wrap",
                        }}
                      >
                        <div>
                          <div style={{ fontWeight: 900, fontSize: "16px", color: "var(--rp-text)" }}>
                            {item.name_ar || "قسم بدون اسم"}
                          </div>
                          <div style={{ marginTop: "4px", color: "var(--rp-text-muted)", fontSize: "13px" }}>
                            {item.name_en || item.slug || "بدون اسم إنجليزي"}
                          </div>
                        </div>

                        <div className="erp-mini-note">ترتيب: {item.sort_order ?? 0}</div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                        <span className={`erp-badge ${item.is_active === false ? "warning" : "success"}`}>
                          {item.is_active === false ? "غير نشط" : "نشط"}
                        </span>
                        <span className={`erp-badge ${item.image_url ? "success" : "warning"}`}>
                          {item.image_url ? "صورة جاهزة" : "بدون صورة"}
                        </span>
                        <span className={`erp-badge ${item.banner_image_url ? "success" : "warning"}`}>
                          {item.banner_image_url ? "بنر جاهز" : "بدون بنر"}
                        </span>
                      </div>

                      {item.description_ar ? (
                        <p style={{ margin: "10px 0 0", color: "var(--rp-text-soft)", lineHeight: 1.8 }}>
                          {item.description_ar}
                        </p>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div
          ref={formShellRef}
          className="erp-form-shell"
          style={{ scrollMarginTop: "110px" }}
        >
          <div className="erp-section-head" style={{ marginBottom: "18px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>
                {editingId ? "تعديل قسم رئيسي" : "إضافة قسم رئيسي جديد"}
              </h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8 }}>
                إدارة الاسم والوصف والصور والبنر والترتيب مع الحفاظ على نفس API الحالي دون تغيير معماري.
              </p>
            </div>

            <div className="erp-mini-note">
              {editingId ? `تحرير القسم #${editingId}` : "إنشاء جديد"}
            </div>
          </div>

          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}>
            <div>
              <label className="erp-label">الاسم العربي</label>
              <input
                ref={firstFieldRef}
                className="erp-input"
                value={form.name_ar}
                onChange={(e) => updateField("name_ar", e.target.value)}
              />
            </div>

            <div>
              <label className="erp-label">الاسم الإنجليزي</label>
              <input className="erp-input" value={form.name_en} onChange={(e) => updateField("name_en", e.target.value)} />
            </div>

            <div>
              <label className="erp-label">Slug</label>
              <input className="erp-input" value={form.slug} onChange={(e) => updateField("slug", e.target.value)} />
            </div>

            <div>
              <label className="erp-label">الترتيب</label>
              <input className="erp-input" value={form.sort_order} onChange={(e) => updateField("sort_order", e.target.value)} />
            </div>

            <div>
              <label className="erp-label">الوصف العربي</label>
              <textarea className="erp-input" rows="4" value={form.description_ar} onChange={(e) => updateField("description_ar", e.target.value)} />
            </div>

            <div>
              <label className="erp-label">الوصف الإنجليزي</label>
              <textarea className="erp-input" rows="4" value={form.description_en} onChange={(e) => updateField("description_en", e.target.value)} />
            </div>

            <div>
              <label className="erp-label">رابط صورة القسم</label>
              <input className="erp-input" value={form.image_url} onChange={(e) => updateField("image_url", e.target.value)} />
            </div>

            <div>
              <label className="erp-label">رابط صورة البنر</label>
              <input className="erp-input" value={form.banner_image_url} onChange={(e) => updateField("banner_image_url", e.target.value)} />
            </div>

            <div>
              <label className="erp-label">نشط</label>
              <select className="erp-input" value={form.is_active ? "yes" : "no"} onChange={(e) => updateField("is_active", e.target.value === "yes")}>
                <option value="yes">نعم</option>
                <option value="no">لا</option>
              </select>
            </div>

            <div className="erp-form-actions">
              <button style={primaryButtonStyle} type="submit" disabled={submitting}>
                {submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة القسم"}
              </button>

              {editingId ? (
                <button type="button" style={secondaryButtonStyle} onClick={resetForm}>
                  إلغاء التعديل
                </button>
              ) : null}
            </div>
          </form>

          {message ? <div className="erp-form-message">{message}</div> : null}
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <div>
              <h3>قائمة الأقسام الرئيسية</h3>
              <p>بحث سريع داخل التصنيفات مع مراجعة الحالة والترتيب وجاهزية الصور</p>
            </div>

            <div style={{ width: "320px", maxWidth: "100%" }}>
              <input
                className="erp-search"
                placeholder="ابحث بالاسم أو slug أو الوصف..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>

          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>الاسم</th>
                  <th>Slug</th>
                  <th>الترتيب</th>
                  <th>الوسائط</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="7">
                      {items.length === 0 ? "لا توجد أقسام حالياً." : "لا توجد نتائج مطابقة للبحث."}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>
                        <div style={{ display: "grid", gap: "4px" }}>
                          <strong>{item.name_ar || "—"}</strong>
                          <span style={{ color: "var(--rp-text-muted)", fontSize: "12px" }}>
                            {item.name_en || "بدون اسم إنجليزي"}
                          </span>
                        </div>
                      </td>
                      <td>{item.slug || "-"}</td>
                      <td>{item.sort_order ?? 0}</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <span className={`erp-badge ${item.image_url ? "success" : "warning"}`}>
                            {item.image_url ? "صورة" : "بدون صورة"}
                          </span>
                          <span className={`erp-badge ${item.banner_image_url ? "success" : "warning"}`}>
                            {item.banner_image_url ? "بنر" : "بدون بنر"}
                          </span>
                        </div>
                      </td>
                      <td>
                        {item.is_active === false ? (
                          <span className="erp-badge warning">غير نشط</span>
                        ) : (
                          <span className="erp-badge success">نشط</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button
                            type="button"
                            style={editButtonStyle}
                            onClick={() => startEdit(item)}
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            style={deleteButtonStyle}
                            onClick={() => handleDelete(item.id)}
                            disabled={deletingId === item.id}
                          >
                            {deletingId === item.id ? "جارٍ الحذف..." : "حذف"}
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
