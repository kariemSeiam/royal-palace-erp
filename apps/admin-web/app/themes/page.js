"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const ACCESS_CENTER_API = "https://api.royalpalace-group.com/api/v1/admin/it/access-center/summary";
const CATEGORIES_API = "https://api.royalpalace-group.com/api/v1/catalog/categories";

export default function ThemesPage() {
  const { user, ready } = useAdminAuth("themes");
  const [payload, setPayload] = useState({
    categories: [],
    summary: {
      total_roles_with_it_permissions: 0,
      total_users_with_it_access: 0,
      viewer_factory_scope: null,
      scope_mode: "mixed",
    },
  });
  const [pageReady, setPageReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ready || !user) return;

    async function load() {
      try {
        const [categoriesRes, accessRes] = await Promise.all([
          fetch(CATEGORIES_API, { cache: "no-store" }),
          fetch(ACCESS_CENTER_API, { headers: authHeaders(), cache: "no-store" }),
        ]);

        const categoriesData = await categoriesRes.json().catch(() => []);
        const accessData = await accessRes.json().catch(() => ({}));

        setPayload({
          categories: Array.isArray(categoriesData) ? categoriesData : [],
          summary: {
            total_roles_with_it_permissions: Number(accessData?.summary?.total_roles_with_it_permissions || 0),
            total_users_with_it_access: Number(accessData?.summary?.total_users_with_it_access || 0),
            viewer_factory_scope: accessData?.summary?.viewer_factory_scope ?? null,
            scope_mode: accessData?.summary?.scope_mode || "mixed",
          },
        });
      } catch (error) {
        setMessage(error?.message || "تعذر تحميل مؤشرات الثيمات");
      } finally {
        setPageReady(true);
      }
    }

    load();
  }, [ready, user]);

  if (!ready || !user || !pageReady) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل الثيمات...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">Theme Governance</div>
            <h2>الثيمات والهوية اللونية</h2>
            <p>
              صفحة تشغيلية لمتابعة وضع الثيم الرئيسي وعلاقته بحوكمة IT والكتالوج الحالي.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">IT Users: {payload.summary.total_users_with_it_access}</div>
              <div className="erp-hero-pill">IT Roles: {payload.summary.total_roles_with_it_permissions}</div>
              <div className="erp-hero-pill">
                {payload.summary.viewer_factory_scope ? `Factory #${payload.summary.viewer_factory_scope}` : "Group Scope"}
              </div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">Primary Theme</div>
              <div className="erp-stat-box-value">RP</div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">Catalog Sections</div>
              <div className="erp-stat-box-value">{payload.categories.length}</div>
            </div>

            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">Primary Palette</div>
            <div className="erp-card-value">Gold</div>
            <div className="erp-card-note">اللون الرئيسي المؤسسي</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">Secondary Palette</div>
            <div className="erp-card-value">Navy</div>
            <div className="erp-card-note">لون ثانوي موحد</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">Catalog Coverage</div>
            <div className="erp-card-value">{payload.categories.length}</div>
            <div className="erp-card-note">أقسام منشورة متأثرة بصريًا</div>
          </div>
        </section>

        <section className="erp-grid-2">
          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>حالة الثيم الحالي</h3>
                <p>قراءة تشغيلية مرتبطة بالسياق الحالي للمنصة</p>
              </div>
            </div>

            <div className="erp-alert-list">
              <div className="erp-alert-item">
                <strong>Theme Pack</strong>
                <p>Royal Palace Default Theme فعال كأساس موحد للإدارة.</p>
              </div>

              <div className="erp-alert-item">
                <strong>Scope Mode</strong>
                <p>{payload.summary.scope_mode}</p>
              </div>

              <div className="erp-alert-item">
                <strong>Related Modules</strong>
                <p><Link href="/branding">/branding</Link> — <Link href="/ui-settings">/ui-settings</Link></p>
              </div>
            </div>
          </div>

          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>ملاحظات تشغيلية</h3>
                <p>أساس مناسب للتطوير القادم بدون كسر البنية الحالية</p>
              </div>
            </div>

            <div className="erp-form-message">
              الصفحة جاهزة للمرحلة القادمة التي تضيف theme presets وإعدادات ألوان فعلية مع حفظ مركزي لاحقًا.
            </div>
          </div>
        </section>

        {message ? <div className="erp-form-message" style={{ marginTop: "20px" }}>{message}</div> : null}
      </section>
    </main>
  );
}
