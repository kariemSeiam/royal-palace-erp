"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/it/access-center/summary";

const initialPayload = {
  summary: {
    active_users_with_it_access: 0,
    superusers_count: 0,
    factory_scoped_users_count: 0,
    total_roles_with_it_permissions: 0,
    total_users_with_it_access: 0,
    viewer_factory_scope: null,
    scope_mode: "unknown",
  },
  roles: [],
  users: [],
};

function formatFactoryScope(value) {
  if (!value) return "Group";
  return `Factory #${value}`;
}

function scopeModeLabel(value) {
  if (value === "group") return "group";
  if (value === "factory") return "factory";
  if (value === "mixed") return "mixed";
  return "unknown";
}

export default function ITAccessCenterPage() {
  const { user, ready } = useAdminAuth("it");
  const [payload, setPayload] = useState(initialPayload);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  async function loadData() {
    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(API_URL, {
        headers: authHeaders(),
        cache: "no-store",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "تعذر تحميل مركز حوكمة صلاحيات IT");
      }

      setPayload({
        summary: {
          active_users_with_it_access: Number(data?.summary?.active_users_with_it_access || 0),
          superusers_count: Number(data?.summary?.superusers_count || 0),
          factory_scoped_users_count: Number(data?.summary?.factory_scoped_users_count || 0),
          total_roles_with_it_permissions: Number(data?.summary?.total_roles_with_it_permissions || 0),
          total_users_with_it_access: Number(data?.summary?.total_users_with_it_access || 0),
          viewer_factory_scope: data?.summary?.viewer_factory_scope ?? null,
          scope_mode: data?.summary?.scope_mode || "unknown",
        },
        roles: Array.isArray(data?.roles) ? data.roles : [],
        users: Array.isArray(data?.users) ? data.users : [],
      });
    } catch (err) {
      setPayload(initialPayload);
      setMessage(err?.message || "حدث خطأ أثناء تحميل بيانات IT access center");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadData();
  }, [ready, user]);

  const heroStats = useMemo(() => {
    return {
      roles: Number(payload.summary?.total_roles_with_it_permissions || 0),
      users: Number(payload.summary?.total_users_with_it_access || 0),
      factory: formatFactoryScope(payload.summary?.viewer_factory_scope),
      scopeMode: scopeModeLabel(payload.summary?.scope_mode),
    };
  }, [payload]);

  if (!ready || !user || loading) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل مركز حوكمة صلاحيات تقنية المعلومات...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />

      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">IT Access Governance</div>
            <h2>مركز حوكمة صلاحيات تقنية المعلومات</h2>
            <p>
              شاشة تشغيلية توضح من يملك صلاحيات IT، وما هي الأدوار المرتبطة بها،
              وكيف يتوزع الوصول بين النطاق العام ونطاق المصنع داخل النظام.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">Roles: {heroStats.roles}</div>
              <div className="erp-hero-pill">Users: {heroStats.users}</div>
              <div className="erp-hero-pill">Factory: {heroStats.factory}</div>
              <div className="erp-hero-pill">Scope Mode: {heroStats.scopeMode}</div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">Roles</div>
              <div className="erp-stat-box-value">{heroStats.roles}</div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">Users</div>
              <div className="erp-stat-box-value">{heroStats.users}</div>
            </div>

            <div
              className="erp-hero-visual"
              style={{
                backgroundImage:
                  "url('https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80')",
                backgroundSize: "cover",
                backgroundPosition: "center",
                borderRadius: "22px",
                minHeight: "180px",
              }}
            />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">الأدوار المرتبطة بـ IT</div>
            <div className="erp-card-value">{payload.summary?.total_roles_with_it_permissions || 0}</div>
            <div className="erp-card-note">Roles carrying IT permissions</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">المستخدمون الفعّالون</div>
            <div className="erp-card-value">{payload.summary?.active_users_with_it_access || 0}</div>
            <div className="erp-card-note">Users currently visible to this viewer</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">Super Admin / Superuser</div>
            <div className="erp-card-value">{payload.summary?.superusers_count || 0}</div>
            <div className="erp-card-note">Users with full override</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">Factory Scoped</div>
            <div className="erp-card-value">{payload.summary?.factory_scoped_users_count || 0}</div>
            <div className="erp-card-note">Users limited by factory association</div>
          </div>
        </section>

        {message ? (
          <div className="erp-form-message" style={{ marginBottom: "18px" }}>
            {message}
          </div>
        ) : null}

        <section className="erp-grid-2" style={{ marginBottom: "20px" }}>
          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>الأدوار الحاملة لصلاحيات IT</h3>
                <p>ملخص الأدوار التي تمتلك صلاحيات تقنية المعلومات فعليًا داخل قاعدة البيانات</p>
              </div>
              <div className="erp-mini-note">{payload.roles.length} role</div>
            </div>

            <div className="erp-alert-list">
              {payload.roles.length === 0 ? (
                <div className="erp-alert-item">
                  <strong>لا توجد أدوار حالياً</strong>
                  <p>لم يتم العثور على أدوار مرتبطة بصلاحيات IT ضمن النطاق الحالي.</p>
                </div>
              ) : (
                payload.roles.map((item) => (
                  <div key={item.role_id} className="erp-alert-item">
                    <strong>{item.role_name}</strong>
                    <p>{item.role_code} — users: {item.users_count}</p>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "10px" }}>
                      {(Array.isArray(item.it_permissions) ? item.it_permissions : []).map((permission) => (
                        <span key={permission} className="erp-badge success">
                          {permission}
                        </span>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>وصولات المستخدمين</h3>
                <p>المستخدمون الذين لديهم IT access فعليًا ضمن النطاق المرئي الحالي</p>
              </div>
              <div className="erp-mini-note">{payload.users.length} user</div>
            </div>

            <div className="erp-table-shell" style={{ overflowX: "auto" }}>
              <table className="erp-table" style={{ minWidth: "920px" }}>
                <thead>
                  <tr>
                    <th>المستخدم</th>
                    <th>الدور</th>
                    <th>المصنع</th>
                    <th>النطاق</th>
                    <th>الحالة</th>
                    <th>صلاحيات IT</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.users.length === 0 ? (
                    <tr>
                      <td colSpan="6">لا يوجد مستخدمون ظاهرون بصلاحيات IT حالياً.</td>
                    </tr>
                  ) : (
                    payload.users.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div style={{ display: "grid", gap: "4px" }}>
                            <strong>{item.full_name || "—"}</strong>
                            <span style={{ color: "var(--rp-text-muted)", fontSize: "12px" }}>
                              {item.email || item.username || "—"}
                            </span>
                          </div>
                        </td>
                        <td>
                          <div style={{ display: "grid", gap: "4px" }}>
                            <strong>{item.role_name || "—"}</strong>
                            <span style={{ color: "var(--rp-text-muted)", fontSize: "12px" }}>
                              {item.role_code || "—"}
                            </span>
                          </div>
                        </td>
                        <td>{item.factory_name || "نطاق المجموعة"}</td>
                        <td>
                          <span className={`erp-badge ${item.is_superuser ? "success" : "warning"}`}>
                            {item.scope_label || "—"}
                          </span>
                        </td>
                        <td>
                          {item.is_active ? (
                            <span className="erp-badge success">نشط</span>
                          ) : (
                            <span className="erp-badge warning">غير نشط</span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {(Array.isArray(item.it_permissions) ? item.it_permissions : []).map((permission) => (
                              <span key={permission} className="erp-badge success">
                                {permission}
                              </span>
                            ))}
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

        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <Link
            href="/roles"
            className="erp-btn-primary"
            style={{ textDecoration: "none", display: "inline-flex" }}
          >
            إدارة الأدوار والصلاحيات
          </Link>

          <Link
            href="/users"
            className="erp-btn-secondary"
            style={{ textDecoration: "none", display: "inline-flex" }}
          >
            إدارة المستخدمين
          </Link>
        </div>
      </section>
    </main>
  );
}
