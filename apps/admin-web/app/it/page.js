"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const ACCESS_CENTER_API = "https://api.royalpalace-group.com/api/v1/admin/it/access-center/summary";

function hasAnyPermission(user, codes = []) {
  if (user?.is_superuser === true) return true;
  const perms = Array.isArray(user?.permissions) ? user.permissions : [];
  const normalized = perms.map((item) => String(item || "").trim().toLowerCase());
  return codes.some((code) => normalized.includes(String(code).trim().toLowerCase()));
}

const quickLinkStyle = {
  textDecoration: "none",
  background: "linear-gradient(180deg, #ffffff 0%, #f8fafc 100%)",
  border: "1px solid var(--rp-border)",
  borderRadius: "18px",
  padding: "18px",
  boxShadow: "var(--rp-shadow-soft)",
  display: "grid",
  gap: "8px",
};

export default function ITPage() {
  const { user, ready } = useAdminAuth("it");
  const [message, setMessage] = useState("");
  const [payload, setPayload] = useState({
    summary: {
      active_users_with_it_access: 0,
      superusers_count: 0,
      factory_scoped_users_count: 0,
      total_roles_with_it_permissions: 0,
      total_users_with_it_access: 0,
      viewer_factory_scope: null,
      scope_mode: "mixed",
    },
    roles: [],
    users: [],
  });
  const [statsReady, setStatsReady] = useState(false);

  useEffect(() => {
    if (!ready || !user) return;

    async function loadSummary() {
      try {
        const res = await fetch(ACCESS_CENTER_API, {
          headers: authHeaders(),
          cache: "no-store",
        });

        const data = await res.json().catch(() => ({}));

        if (!res.ok) {
          throw new Error(data.detail || "تعذر تحميل ملخص صلاحيات IT");
        }

        setPayload({
          summary: {
            active_users_with_it_access: Number(data?.summary?.active_users_with_it_access || 0),
            superusers_count: Number(data?.summary?.superusers_count || 0),
            factory_scoped_users_count: Number(data?.summary?.factory_scoped_users_count || 0),
            total_roles_with_it_permissions: Number(data?.summary?.total_roles_with_it_permissions || 0),
            total_users_with_it_access: Number(data?.summary?.total_users_with_it_access || 0),
            viewer_factory_scope: data?.summary?.viewer_factory_scope ?? null,
            scope_mode: data?.summary?.scope_mode || "mixed",
          },
          roles: Array.isArray(data?.roles) ? data.roles : [],
          users: Array.isArray(data?.users) ? data.users : [],
        });
      } catch (error) {
        setMessage(error?.message || "حدث خطأ أثناء تحميل مؤشرات IT");
      } finally {
        setStatsReady(true);
      }
    }

    loadSummary();
  }, [ready, user]);

  const capabilityCards = useMemo(() => {
    return [
      {
        title: "البنية التحتية",
        note: "خوادم، خدمات، مراقبة، سجلات، نسخ احتياطي",
        enabled: hasAnyPermission(user, [
          "it.view",
          "it.manage",
          "infrastructure.view",
          "infrastructure.manage",
          "servers.view",
          "servers.manage",
          "backups.view",
          "backups.manage",
          "logs.view",
          "monitoring.view",
          "deployments.view",
          "deployments.manage",
        ]),
      },
      {
        title: "حوكمة الكتالوج والمنتجات",
        note: "إدارة المنتجات والكتالوج والوسائط التقنية",
        enabled: hasAnyPermission(user, [
          "it.view",
          "it.manage",
          "products.view",
          "products.manage",
          "catalog.view",
          "catalog.manage",
          "media.view",
          "media.manage",
        ]),
      },
      {
        title: "الهوية البصرية",
        note: "Themes / Branding / UI Settings / Layout",
        enabled: hasAnyPermission(user, [
          "themes.view",
          "themes.manage",
          "branding.view",
          "branding.manage",
          "layout.manage",
          "ui_settings.manage",
          "global_settings.manage",
        ]),
      },
      {
        title: "الصفحات والمحتوى",
        note: "إدارة الصفحات والبلوكات والمكونات",
        enabled: hasAnyPermission(user, [
          "pages.view",
          "pages.manage",
        ]),
      },
    ];
  }, [user]);

  const visiblePermissions = useMemo(() => {
    if (user?.is_superuser === true) {
      return ["group.super_admin_override"];
    }

    return (Array.isArray(user?.permissions) ? user.permissions : [])
      .filter((item) => {
        const code = String(item || "").trim().toLowerCase();
        return (
          code.startsWith("it.") ||
          code.startsWith("infrastructure.") ||
          code.startsWith("servers.") ||
          code.startsWith("backups.") ||
          code.startsWith("logs.") ||
          code.startsWith("monitoring.") ||
          code.startsWith("deployments.") ||
          code.startsWith("catalog.") ||
          code.startsWith("media.") ||
          code.startsWith("themes.") ||
          code.startsWith("branding.") ||
          code.startsWith("pages.") ||
          code.startsWith("layout.") ||
          code.startsWith("ui_settings.") ||
          code.startsWith("global_settings.") ||
          code.startsWith("products.")
        );
      })
      .sort();
  }, [user]);

  const quickLinks = useMemo(() => {
    return [
      {
        href: "/it/operations-center",
        title: "مركز العمليات التقنية",
        note: "لوحة تشغيل موحدة تجمع health + access + catalog",
      },
      {
        href: "/it/access-center",
        title: "مركز صلاحيات IT",
        note: "مراجعة الأدوار والمستخدمين أصحاب صلاحيات التقنية",
      },
      {
        href: "/infrastructure",
        title: "البنية التحتية",
        note: "الخدمات الأساسية وحالة التشغيل",
      },
      {
        href: "/media",
        title: "الوسائط",
        note: "حوكمة الصور والبنرات والملفات",
      },
      {
        href: "/themes",
        title: "الثيمات",
        note: "إدارة الهوية اللونية والثيم الرئيسي",
      },
      {
        href: "/branding",
        title: "الهوية البصرية",
        note: "الشعارات والضوابط المرئية للمجموعة",
      },
      {
        href: "/ui-settings",
        title: "إعدادات الواجهة",
        note: "Arabic RTL-first وتجربة العرض العامة",
      },
      {
        href: "/backups",
        title: "النسخ الاحتياطية",
        note: "متابعة حوكمة النسخ والاستعادة",
      },
    ];
  }, []);

  if (!ready || !user || !statsReady) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل وحدة تقنية المعلومات...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />

      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">IT Governance</div>
            <h2>تقنية المعلومات والحوكمة الرقمية</h2>
            <p>
              وحدة تشغيل مركزية لإدارة البنية التحتية والخدمات التقنية والهوية البصرية
              والكتالوج والوسائط والإعدادات العامة، تحت إشراف الإدارة العليا للمجموعة.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">
                {user?.is_superuser ? "صلاحية Group-Wide" : "صلاحية حسب الدور والصلاحيات"}
              </div>
              <div className="erp-hero-pill">
                {user?.factory_name || (user?.factory_id ? `Factory #${user.factory_id}` : "نطاق المجموعة")}
              </div>
              <div className="erp-hero-pill">
                إجمالي صلاحيات IT الظاهرة: {visiblePermissions.length}
              </div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">وضع الوحدة</div>
              <div className="erp-stat-box-value">Live</div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">نمط النطاق</div>
              <div className="erp-stat-box-value" style={{ fontSize: "24px" }}>
                {payload.summary.scope_mode === "group"
                  ? "Group"
                  : payload.summary.scope_mode === "factory"
                  ? "Factory"
                  : "Mixed"}
              </div>
            </div>

            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">المستخدمون ذوو وصول IT</div>
            <div className="erp-card-value">{payload.summary.total_users_with_it_access}</div>
            <div className="erp-card-note">إجمالي الحسابات ذات الوصول التقني</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">الحسابات النشطة</div>
            <div className="erp-card-value">{payload.summary.active_users_with_it_access}</div>
            <div className="erp-card-note">نشطة فعليًا داخل النطاق الحالي</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">الأدوار ذات صلاحيات IT</div>
            <div className="erp-card-value">{payload.summary.total_roles_with_it_permissions}</div>
            <div className="erp-card-note">أدوار مرتبطة بحوكمة التقنية</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">Factory Scoped</div>
            <div className="erp-card-value">{payload.summary.factory_scoped_users_count}</div>
            <div className="erp-card-note">ضمن مصنع محدد</div>
          </div>
        </section>

        <section className="erp-kpi-grid" style={{ marginBottom: "22px" }}>
          {capabilityCards.map((card) => (
            <div key={card.title} className="erp-card">
              <div className="erp-card-title">{card.title}</div>
              <div className="erp-card-value" style={{ fontSize: "22px" }}>
                {card.enabled ? "مفعل" : "غير متاح"}
              </div>
              <div className="erp-card-note">{card.note}</div>
            </div>
          ))}
        </section>

        <section className="erp-section-card" style={{ marginBottom: "22px" }}>
          <div className="erp-section-head">
            <div>
              <h3>مركز تشغيل IT</h3>
              <p>اختصارات مباشرة للوحدات التابعة لقسم تقنية المعلومات</p>
            </div>
            <div className="erp-mini-note">{quickLinks.length} روابط</div>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "14px",
            }}
          >
            {quickLinks.map((item) => (
              <Link key={item.href} href={item.href} style={quickLinkStyle}>
                <strong style={{ color: "var(--rp-text)", fontSize: "16px" }}>{item.title}</strong>
                <span style={{ color: "var(--rp-text-muted)", lineHeight: 1.8 }}>{item.note}</span>
              </Link>
            ))}
          </div>
        </section>

        <section className="erp-grid-2">
          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>صلاحيات IT الحالية</h3>
                <p>المعروض هنا يعكس permissions الحالية للمستخدم</p>
              </div>
              <div className="erp-mini-note">{visiblePermissions.length} صلاحية</div>
            </div>

            {visiblePermissions.length === 0 ? (
              <div className="erp-form-message">
                لا توجد صلاحيات IT مخصصة لهذا الحساب حاليًا.
              </div>
            ) : (
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                {visiblePermissions.map((permission) => (
                  <span key={permission} className="erp-badge success">
                    {permission}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>ملخص الوصول الحالي</h3>
                <p>قراءة سريعة من API مركز صلاحيات IT</p>
              </div>
              <div className="erp-mini-note">Live Summary</div>
            </div>

            <div className="erp-alert-list">
              <div className="erp-alert-item">
                <strong>Super Admin</strong>
                <p>{payload.summary.superusers_count} حسابات بقدرة Group-Wide كاملة.</p>
              </div>

              <div className="erp-alert-item">
                <strong>Factory Scoped Users</strong>
                <p>{payload.summary.factory_scoped_users_count} حسابات تقنية ضمن نطاق مصنع محدد.</p>
              </div>

              <div className="erp-alert-item">
                <strong>Viewer Scope</strong>
                <p>
                  {payload.summary.viewer_factory_scope
                    ? `أنت تعمل داخل المصنع #${payload.summary.viewer_factory_scope}`
                    : "أنت تعمل على نطاق المجموعة أو نطاق غير مقيّد بمصنع واحد."}
                </p>
              </div>
            </div>
          </div>
        </section>

        {message ? <div className="erp-form-message" style={{ marginTop: "20px" }}>{message}</div> : null}
      </section>
    </main>
  );
}
