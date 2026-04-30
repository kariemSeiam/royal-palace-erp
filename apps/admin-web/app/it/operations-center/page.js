"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";

const HEALTH_API = "https://api.royalpalace-group.com/health/live";
const ACCESS_CENTER_API = "https://api.royalpalace-group.com/api/v1/admin/it/access-center/summary";
const PRODUCTS_API = "https://api.royalpalace-group.com/api/v1/catalog/products";
const CATEGORIES_API = "https://api.royalpalace-group.com/api/v1/catalog/categories";

export default function ITOperationsCenterPage() {
  const { user, ready } = useAdminAuth("it");
  const [payload, setPayload] = useState({
    health: { status: "unknown" },
    summary: {
      active_users_with_it_access: 0,
      total_users_with_it_access: 0,
      total_roles_with_it_permissions: 0,
      superusers_count: 0,
      factory_scoped_users_count: 0,
      viewer_factory_scope: null,
      scope_mode: "mixed",
    },
    products: [],
    categories: [],
  });
  const [pageReady, setPageReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ready || !user) return;

    async function load() {
      try {
        const [healthRes, accessRes, productsRes, categoriesRes] = await Promise.all([
          fetch(HEALTH_API, { cache: "no-store" }),
          fetch(ACCESS_CENTER_API, { headers: authHeaders(), cache: "no-store" }),
          fetch(PRODUCTS_API, { cache: "no-store" }),
          fetch(CATEGORIES_API, { cache: "no-store" }),
        ]);

        const healthData = await healthRes.json().catch(() => ({}));
        const accessData = await accessRes.json().catch(() => ({}));
        const productsData = await productsRes.json().catch(() => []);
        const categoriesData = await categoriesRes.json().catch(() => []);

        setPayload({
          health: {
            status: healthData?.status || "unknown",
          },
          summary: {
            active_users_with_it_access: Number(accessData?.summary?.active_users_with_it_access || 0),
            total_users_with_it_access: Number(accessData?.summary?.total_users_with_it_access || 0),
            total_roles_with_it_permissions: Number(accessData?.summary?.total_roles_with_it_permissions || 0),
            superusers_count: Number(accessData?.summary?.superusers_count || 0),
            factory_scoped_users_count: Number(accessData?.summary?.factory_scoped_users_count || 0),
            viewer_factory_scope: accessData?.summary?.viewer_factory_scope ?? null,
            scope_mode: accessData?.summary?.scope_mode || "mixed",
          },
          products: Array.isArray(productsData) ? productsData : [],
          categories: Array.isArray(categoriesData) ? categoriesData : [],
        });
      } catch (error) {
        setMessage(error?.message || "تعذر تحميل مركز العمليات التقنية");
      } finally {
        setPageReady(true);
      }
    }

    load();
  }, [ready, user]);

  if (!ready || !user || !pageReady) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل مركز العمليات التقنية...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />

      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">IT Operations Center</div>
            <h2>مركز العمليات التقنية</h2>
            <p>
              لوحة تشغيل موحدة تجمع الحالة الصحية للخدمات، مؤشرات الوصول التقني،
              وحجم الكتالوج الحالي داخل تجربة واحدة.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">API: {payload.health.status}</div>
              <div className="erp-hero-pill">IT Users: {payload.summary.total_users_with_it_access}</div>
              <div className="erp-hero-pill">
                {payload.summary.viewer_factory_scope ? `Factory #${payload.summary.viewer_factory_scope}` : "Group Scope"}
              </div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">Products</div>
              <div className="erp-stat-box-value">{payload.products.length}</div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">Categories</div>
              <div className="erp-stat-box-value">{payload.categories.length}</div>
            </div>

            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">Health</div>
            <div className="erp-card-value">{payload.health.status}</div>
            <div className="erp-card-note">قراءة مباشرة من health endpoint</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">IT Roles</div>
            <div className="erp-card-value">{payload.summary.total_roles_with_it_permissions}</div>
            <div className="erp-card-note">الأدوار المالكة لصلاحيات IT</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">Active IT Users</div>
            <div className="erp-card-value">{payload.summary.active_users_with_it_access}</div>
            <div className="erp-card-note">حسابات تقنية نشطة</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">Factory Scoped</div>
            <div className="erp-card-value">{payload.summary.factory_scoped_users_count}</div>
            <div className="erp-card-note">مستخدمون تقنيون بنطاق مصنع</div>
          </div>
        </section>

        <section className="erp-grid-2">
          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>مؤشرات موحدة</h3>
                <p>أهم القراءات التشغيلية في شاشة واحدة</p>
              </div>
            </div>

            <div className="erp-alert-list">
              <div className="erp-alert-item">
                <strong>Scope Mode</strong>
                <p>{payload.summary.scope_mode}</p>
              </div>

              <div className="erp-alert-item">
                <strong>Super Admin</strong>
                <p>{payload.summary.superusers_count} حسابات Group-Wide.</p>
              </div>

              <div className="erp-alert-item">
                <strong>Catalog Surface</strong>
                <p>{payload.products.length} منتجات و {payload.categories.length} أقسام منشورة.</p>
              </div>
            </div>
          </div>

          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>روابط التشغيل</h3>
                <p>الانتقال السريع بين وحدات IT</p>
              </div>
            </div>

            <div className="erp-alert-list">
              <div className="erp-alert-item"><strong>IT Hub</strong><p><Link href="/it">/it</Link></p></div>
              <div className="erp-alert-item"><strong>Access Center</strong><p><Link href="/it/access-center">/it/access-center</Link></p></div>
              <div className="erp-alert-item"><strong>Audit Center</strong><p><Link href="/it/audit-center">/it/audit-center</Link></p></div>
              <div className="erp-alert-item"><strong>Maker-Checker Center</strong><p><Link href="/it/maker-checker-center">/it/maker-checker-center</Link></p></div>
              <div className="erp-alert-item"><strong>Infrastructure</strong><p><Link href="/infrastructure">/infrastructure</Link></p></div>
              <div className="erp-alert-item"><strong>Media</strong><p><Link href="/media">/media</Link></p></div>
              <div className="erp-alert-item"><strong>Themes</strong><p><Link href="/themes">/themes</Link></p></div>
              <div className="erp-alert-item"><strong>Branding</strong><p><Link href="/branding">/branding</Link></p></div>
              <div className="erp-alert-item"><strong>UI Settings</strong><p><Link href="/ui-settings">/ui-settings</Link></p></div>
              <div className="erp-alert-item"><strong>Backups</strong><p><Link href="/backups">/backups</Link></p></div>
            </div>
          </div>
        </section>

        {message ? <div className="erp-form-message" style={{ marginTop: "20px" }}>{message}</div> : null}
      </section>
    </main>
  );
}
