"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const B2B_ROOT_URL = "https://api.royalpalace-group.com/api/v1/admin/b2b";
const B2B_ACCOUNTS_URL = "https://api.royalpalace-group.com/api/v1/admin/b2b/accounts";

const emptyForm = {
  company_name: "",
  business_type: "",
  tax_number: "",
  commercial_registration: "",
  contact_email: "",
  contact_phone: "",
  address_text: "",
  partner_category: "",
  payment_terms: "",
  credit_limit: "",
  factory_id: "",
  is_active: true,
};

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function resolveLockedFactoryId(user) {
  if (user?.is_superuser === true) return "";
  return user?.factory_id ? String(user.factory_id) : "";
}

function resolveVisibleFactories(user, factories) {
  const lockedFactoryId = resolveLockedFactoryId(user);
  if (!lockedFactoryId) return factories;
  return factories.filter((factory) => String(factory.id) === lockedFactoryId);
}

function resolvePreferredFactoryId(user, factories) {
  const lockedFactoryId = resolveLockedFactoryId(user);
  if (lockedFactoryId) return lockedFactoryId;

  if (!Array.isArray(factories) || factories.length === 0) return "";

  const userFactoryId = user?.factory_id || user?.factory?.id || "";
  if (userFactoryId && factories.some((factory) => String(factory.id) === String(userFactoryId))) {
    return String(userFactoryId);
  }

  return String(factories[0]?.id || "");
}

function buildPayload(form, lockedFactoryId) {
  return {
    company_name: form.company_name.trim(),
    business_type: form.business_type.trim() || null,
    tax_number: form.tax_number.trim() || null,
    commercial_registration: form.commercial_registration.trim() || null,
    contact_email: form.contact_email.trim() || null,
    contact_phone: form.contact_phone.trim() || null,
    address_text: form.address_text.trim() || null,
    partner_category: form.partner_category.trim() || null,
    payment_terms: form.payment_terms.trim() || null,
    credit_limit: form.credit_limit ? Number(form.credit_limit) : null,
    factory_id: (lockedFactoryId || form.factory_id) ? Number(lockedFactoryId || form.factory_id) : null,
    is_active: Boolean(form.is_active),
  };
}

async function fetchWithJson(url, options = {}) {
  const res = await fetch(url, options);
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function resolveFactoryLabel(account) {
  if (account?.factory_name) return account.factory_name;
  if (account?.factory_id) return `Factory #${account.factory_id}`;
  return "غير محدد";
}

export default function B2BPage() {
  const { user, ready } = useAdminAuth("b2b");

  const [accounts, setAccounts] = useState([]);
  const [factories, setFactories] = useState([]);
  const [search, setSearch] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [message, setMessage] = useState("");

  const lockedFactoryId = resolveLockedFactoryId(user);
  const visibleFactories = useMemo(() => resolveVisibleFactories(user, factories), [user, factories]);

  async function loadFactories() {
    const res = await fetch("https://api.royalpalace-group.com/api/v1/admin/users/factories", {
      headers: authHeaders(),
      cache: "no-store",
    });

    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.detail || "تعذر تحميل المصانع");
    setFactories(Array.isArray(data) ? data : []);
  }

  async function loadAccounts() {
    const commonOptions = {
      headers: authHeaders(),
      cache: "no-store",
    };

    const primary = await fetchWithJson(B2B_ROOT_URL, commonOptions);

    if (primary.res.ok) {
      setAccounts(Array.isArray(primary.data) ? primary.data : []);
      return;
    }

    if (primary.res.status !== 404) {
      throw new Error(primary.data?.detail || "تعذر تحميل حسابات B2B");
    }

    const fallback = await fetchWithJson(B2B_ACCOUNTS_URL, commonOptions);

    if (!fallback.res.ok) {
      throw new Error(fallback.data?.detail || "تعذر تحميل حسابات B2B");
    }

    setAccounts(Array.isArray(fallback.data) ? fallback.data : []);
  }

  useEffect(() => {
    if (!ready) return;

    Promise.all([loadFactories(), loadAccounts()]).catch((err) => {
      setAccounts([]);
      setMessage(err.message || "تعذر تحميل حسابات B2B");
    });
  }, [ready]);

  useEffect(() => {
    if (!ready || !user || editingId) return;

    setForm((prev) => {
      if (prev.factory_id) {
        if (lockedFactoryId && prev.factory_id !== lockedFactoryId) {
          return { ...prev, factory_id: lockedFactoryId };
        }
        return prev;
      }

      return {
        ...prev,
        factory_id: resolvePreferredFactoryId(user, factories),
      };
    });
  }, [ready, user, factories, editingId, lockedFactoryId]);

  const filteredAccounts = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return accounts;

    return accounts.filter((account) => {
      const haystack = [
        account.id,
        account.company_name,
        account.business_type,
        account.tax_number,
        account.commercial_registration,
        account.contact_email,
        account.contact_phone,
        account.address_text,
        account.partner_category,
        account.payment_terms,
        account.credit_limit,
        account.factory_name,
        account.factory_id,
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [accounts, search]);

  const stats = useMemo(() => {
    const total = accounts.length;
    const active = accounts.filter((a) => a.is_active !== false).length;
    const inactive = total - active;
    const withCredit = accounts.filter(
      (a) => a.credit_limit !== null && a.credit_limit !== undefined && a.credit_limit !== ""
    ).length;
    const scoped = accounts.filter((a) => a.factory_id).length;

    return { total, active, inactive, withCredit, scoped };
  }, [accounts]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const payload = buildPayload(form, lockedFactoryId);
      const method = editingId ? "PUT" : "POST";

      if (editingId) {
        const { res, data } = await fetchWithJson(`${B2B_ACCOUNTS_URL}/${editingId}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify(payload),
        });

        if (!res.ok) {
          throw new Error(data?.detail || "فشل تعديل حساب B2B");
        }
      } else {
        const primary = await fetchWithJson(B2B_ROOT_URL, {
          method,
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify(payload),
        });

        if (!primary.res.ok && primary.res.status !== 404) {
          throw new Error(primary.data?.detail || "فشل إنشاء حساب B2B");
        }

        if (primary.res.status === 404) {
          const fallback = await fetchWithJson(B2B_ACCOUNTS_URL, {
            method,
            headers: {
              "Content-Type": "application/json",
              ...authHeaders(),
            },
            body: JSON.stringify(payload),
          });

          if (!fallback.res.ok) {
            throw new Error(fallback.data?.detail || "فشل إنشاء حساب B2B");
          }
        }
      }

      setForm({
        ...emptyForm,
        factory_id: resolvePreferredFactoryId(user, factories),
      });
      setEditingId(null);
      setMessage(editingId ? "تم تعديل حساب B2B بنجاح" : "تم إنشاء حساب B2B بنجاح");
      await loadAccounts();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء حفظ الحساب");
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(account) {
    const nextFactoryId = lockedFactoryId || (account.factory_id ? String(account.factory_id) : "");

    setEditingId(account.id);
    setForm({
      company_name: account.company_name || "",
      business_type: account.business_type || "",
      tax_number: account.tax_number || "",
      commercial_registration: account.commercial_registration || "",
      contact_email: account.contact_email || "",
      contact_phone: account.contact_phone || "",
      address_text: account.address_text || "",
      partner_category: account.partner_category || "",
      payment_terms: account.payment_terms || "",
      credit_limit: account.credit_limit || "",
      factory_id: nextFactoryId,
      is_active: !!account.is_active,
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm({
      ...emptyForm,
      factory_id: resolvePreferredFactoryId(user, factories),
    });
    setMessage("");
  }

  async function handleDelete(id) {
    if (!confirm("هل تريد حذف هذا الحساب؟")) return;

    setDeletingId(id);
    setMessage("");

    try {
      const { res, data } = await fetchWithJson(`${B2B_ACCOUNTS_URL}/${id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      if (!res.ok) {
        throw new Error(data?.detail || "فشل حذف الحساب");
      }

      setMessage("تم حذف الحساب بنجاح");
      if (editingId === id) handleCancelEdit();
      await loadAccounts();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء حذف الحساب");
    } finally {
      setDeletingId(null);
    }
  }

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل حسابات B2B...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />

      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">الشركاء التجاريون</div>
            <h2>إدارة حسابات B2B</h2>
            <p>
              إدارة الشركات والفنادق والعملاء المؤسسيين مع ربط كل حساب بالمصنع الخاص به،
              بما يتوافق مع نموذج multi-factory داخل المنظومة.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">إجمالي الحسابات: {stats.total}</div>
              <div className="erp-hero-pill">الحسابات النشطة: {stats.active}</div>
              <div className="erp-hero-pill">Factory-bound: {stats.scoped}</div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">الحسابات غير النشطة</div>
              <div className="erp-stat-box-value">{stats.inactive}</div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">الائتمان المهيأ</div>
              <div className="erp-stat-box-value">{stats.withCredit}</div>
            </div>

            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">إجمالي الحسابات</div>
            <div className="erp-card-value">{stats.total}</div>
            <div className="erp-card-note">كل الشركاء المسجلين</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">الحسابات النشطة</div>
            <div className="erp-card-value">{stats.active}</div>
            <div className="erp-card-note">جاهزة للتشغيل التجاري</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">مرتبطة بمصنع</div>
            <div className="erp-card-value">{stats.scoped}</div>
            <div className="erp-card-note">جاهزة للعزل التشغيلي</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">بحـد ائتماني</div>
            <div className="erp-card-value">{stats.withCredit}</div>
            <div className="erp-card-note">مهيأة ماليًا</div>
          </div>
        </section>

        <div className="erp-form-shell">
          <div className="erp-section-head" style={{ marginBottom: "18px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>
                {editingId ? "تعديل حساب B2B" : "إضافة حساب B2B جديد"}
              </h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8 }}>
                إدارة بيانات الشريك التجاري وربطه بالمصنع المناسب دون تغيير المعمارية الحالية.
              </p>
            </div>

            <div className="erp-mini-note">
              {editingId ? `تحرير الحساب #${editingId}` : "إنشاء جديد"}
            </div>
          </div>

          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}>
            <div>
              <label className="erp-label">اسم الشركة</label>
              <input className="erp-input" value={form.company_name} onChange={(e) => setForm({ ...form, company_name: e.target.value })} />
            </div>

            <div>
              <label className="erp-label">نوع النشاط</label>
              <input className="erp-input" value={form.business_type} onChange={(e) => setForm({ ...form, business_type: e.target.value })} />
            </div>

            <div>
              <label className="erp-label">البريد الإلكتروني</label>
              <input className="erp-input" value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} />
            </div>

            <div>
              <label className="erp-label">الهاتف</label>
              <input className="erp-input" value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} />
            </div>

            <div>
              <label className="erp-label">الرقم الضريبي</label>
              <input className="erp-input" value={form.tax_number} onChange={(e) => setForm({ ...form, tax_number: e.target.value })} />
            </div>

            <div>
              <label className="erp-label">السجل التجاري</label>
              <input className="erp-input" value={form.commercial_registration} onChange={(e) => setForm({ ...form, commercial_registration: e.target.value })} />
            </div>

            <div>
              <label className="erp-label">فئة الشريك</label>
              <input className="erp-input" value={form.partner_category} onChange={(e) => setForm({ ...form, partner_category: e.target.value })} />
            </div>

            <div>
              <label className="erp-label">شروط الدفع</label>
              <input className="erp-input" value={form.payment_terms} onChange={(e) => setForm({ ...form, payment_terms: e.target.value })} />
            </div>

            <div>
              <label className="erp-label">الحد الائتماني</label>
              <input className="erp-input" value={form.credit_limit} onChange={(e) => setForm({ ...form, credit_limit: e.target.value })} />
            </div>

            <div>
              <label className="erp-label">المصنع</label>
              <select
                className="erp-input"
                value={lockedFactoryId || form.factory_id}
                onChange={(e) => setForm({ ...form, factory_id: e.target.value })}
                disabled={Boolean(lockedFactoryId)}
              >
                {!lockedFactoryId ? <option value="">اختر المصنع</option> : null}
                {visibleFactories.map((factory) => (
                  <option key={factory.id} value={factory.id}>
                    {factory.name}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label className="erp-label">العنوان</label>
              <textarea className="erp-input" rows="4" value={form.address_text} onChange={(e) => setForm({ ...form, address_text: e.target.value })} />
            </div>

            <div>
              <label className="erp-label">نشط</label>
              <select className="erp-input" value={form.is_active ? "yes" : "no"} onChange={(e) => setForm({ ...form, is_active: e.target.value === "yes" })}>
                <option value="yes">نعم</option>
                <option value="no">لا</option>
              </select>
            </div>

            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={submitting}>
                {submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة الحساب"}
              </button>

              {editingId ? (
                <button type="button" className="erp-btn-secondary" onClick={handleCancelEdit}>
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
              <h3>قائمة حسابات B2B</h3>
              <p>بحث سريع داخل الحسابات مع إظهار المصنع والحالة والائتمان</p>
            </div>

            <div style={{ width: "320px", maxWidth: "100%" }}>
              <input
                className="erp-search"
                placeholder="ابحث بالشركة أو البريد أو المصنع..."
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
                  <th>الشركة</th>
                  <th>التواصل</th>
                  <th>المصنع</th>
                  <th>الائتمان</th>
                  <th>الحالة</th>
                  <th>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {filteredAccounts.length === 0 ? (
                  <tr>
                    <td colSpan="7">{accounts.length === 0 ? "لا توجد حسابات B2B حالياً." : "لا توجد نتائج مطابقة للبحث."}</td>
                  </tr>
                ) : (
                  filteredAccounts.map((account) => (
                    <tr key={account.id}>
                      <td>{account.id}</td>
                      <td>
                        <div style={{ display: "grid", gap: "4px" }}>
                          <strong>{account.company_name || "—"}</strong>
                          <span style={{ color: "var(--rp-text-muted)", fontSize: "12px" }}>
                            {account.business_type || account.partner_category || "بدون تصنيف"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <div style={{ display: "grid", gap: "4px" }}>
                          <span>{account.contact_email || "—"}</span>
                          <span style={{ color: "var(--rp-text-muted)", fontSize: "12px" }}>
                            {account.contact_phone || "—"}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`erp-badge ${account.factory_id ? "success" : "warning"}`}>
                          {resolveFactoryLabel(account)}
                        </span>
                      </td>
                      <td>{account.credit_limit || "—"}</td>
                      <td>
                        {account.is_active === false ? (
                          <span className="erp-badge warning">غير نشط</span>
                        ) : (
                          <span className="erp-badge success">نشط</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button type="button" className="erp-btn-secondary" onClick={() => handleEdit(account)}>
                            تعديل
                          </button>
                          <button type="button" className="erp-btn-danger" onClick={() => handleDelete(account.id)} disabled={deletingId === account.id}>
                            {deletingId === account.id ? "جارٍ الحذف..." : "حذف"}
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
