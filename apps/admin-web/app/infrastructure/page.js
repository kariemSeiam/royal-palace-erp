"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const HEALTH_API = "https://api.royalpalace-group.com/health/live";
const ACCESS_CENTER_API = "https://api.royalpalace-group.com/api/v1/admin/it/access-center/summary";

export default function InfrastructurePage() {
  const { user, ready } = useAdminAuth("infrastructure");
  const [payload, setPayload] = useState({
    health: { status: "unknown" },
    access: {
      summary: {
        total_users_with_it_access: 0,
        active_users_with_it_access: 0,
        total_roles_with_it_permissions: 0,
        superusers_count: 0,
        factory_scoped_users_count: 0,
        scope_mode: "mixed",
        viewer_factory_scope: null,
      },
    },
  });
  const [pageReady, setPageReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ready || !user) return;

    async function load() {
      try {
        const [healthRes, accessRes] = await Promise.all([
          fetch(HEALTH_API, { cache: "no-store" }),
          fetch(ACCESS_CENTER_API, {
            headers: authHeaders(),
            cache: "no-store",
          }),
        ]);

        const healthData = await healthRes.json().catch(() => ({}));
        const accessData = await accessRes.json().catch(() => ({}));

        setPayload({
          health: {
            status: healthData?.status || "unknown",
          },
          access: {
            summary: {
              total_users_with_it_access: Number(accessData?.summary?.total_users_with_it_access || 0),
              active_users_with_it_access: Number(accessData?.summary?.active_users_with_it_access || 0),
              total_roles_with_it_permissions: Number(accessData?.summary?.total_roles_with_it_permissions || 0),
              superusers_count: Number(accessData?.summary?.superusers_count || 0),
              factory_scoped_users_count: Number(accessData?.summary?.factory_scoped_users_count || 0),
              scope_mode: accessData?.summary?.scope_mode || "mixed",
              viewer_factory_scope: accessData?.summary?.viewer_factory_scope ?? null,
            },
          },
        });
      } catch (error) {
        setMessage(error?.message || "تعذر تحميل مؤشرات البنية التحتية");
      } finally {
        setPageReady(true);
      }
    }

    load();
  }, [ready, user]);

  const serviceRows = useMemo(() => {
    const apiLive = payload.health.status === "live";

    return [
      {
        name: "API",
        state: apiLive ? "Live" : "Unknown",
        tone: apiLive ? "success" : "warning",
        note: "FastAPI / health.live",
      },
      {
        name: "Admin Web",
        state: "Live",
        tone: "success",
        note: "Next.js Admin Portal",
      },
      {
        name: "Store Web",
        state: "Live",
        tone: "success",
        note: "Storefront / Client Web",
      },
      {
        name: "IT Access Center",
        state: payload.access.summary.total_users_with_it_access > 0 ? "Connected" : "Empty",
        tone: payload.access.summary.total_users_with_it_access > 0 ? "success" : "warning",
        note: "مرتبط ببيانات صلاحيات IT الحالية",
      },
      {
        name: "Scope Model",
        state:
          payload.access.summary.scope_mode === "group"
            ? "Group"
            : payload.access.summary.scope_mode === "factory"
            ? "Factory"
            : "Mixed",
        tone: "success",
        note: "Permissions + Factory Scope + Super Admin Override",
      },
    ];
  }, [payload]);

  if (!ready || !user || !pageReady) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل البنية التحتية...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />

      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">Infrastructure Center</div>
            <h2>البنية التحتية والتشغيل</h2>
            <p>
              متابعة تشغيلية للخدمات الأساسية وحالة الاتصال ووضع نطاق المشاهدة الخاص
              بحسابك داخل منظومة Royal Palace ERP.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">API Health: {payload.health.status}</div>
              <div className="erp-hero-pill">
                {payload.access.summary.viewer_factory_scope
                  ? `Factory Scope #${payload.access.summary.viewer_factory_scope}`
                  : "Group Scope"}
              </div>
              <div className="erp-hero-pill">
                IT Users: {payload.access.summary.total_users_with_it_access}
              </div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">الأدوار التقنية</div>
              <div className="erp-stat-box-value">
                {payload.access.summary.total_roles_with_it_permissions}
              </div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">الحسابات النشطة</div>
              <div className="erp-stat-box-value">
                {payload.access.summary.active_users_with_it_access}
              </div>
            </div>

            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">Super Admin</div>
            <div className="erp-card-value">{payload.access.summary.superusers_count}</div>
            <div className="erp-card-note">حسابات Group-Wide</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">Factory Scoped</div>
            <div className="erp-card-value">{payload.access.summary.factory_scoped_users_count}</div>
            <div className="erp-card-note">حسابات تقنية مقيّدة بمصنع</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">API Live</div>
            <div className="erp-card-value">{payload.health.status === "live" ? "Yes" : "No"}</div>
            <div className="erp-card-note">قراءة مباشرة من health endpoint</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">Mode</div>
            <div className="erp-card-value">
              {payload.access.summary.scope_mode === "group"
                ? "Group"
                : payload.access.summary.scope_mode === "factory"
                ? "Factory"
                : "Mixed"}
            </div>
            <div className="erp-card-note">نمط النطاق الحالي</div>
          </div>
        </section>

        <section className="erp-grid-2">
          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>حالة الخدمات</h3>
                <p>مؤشرات تشغيلية مبسطة للخدمات الأساسية الحالية</p>
              </div>
            </div>

            <div className="erp-table-shell">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>الخدمة</th>
                    <th>الحالة</th>
                    <th>الوصف</th>
                  </tr>
                </thead>
                <tbody>
                  {serviceRows.map((service) => (
                    <tr key={service.name}>
                      <td>{service.name}</td>
                      <td>
                        <span className={`erp-badge ${service.tone === "success" ? "success" : "warning"}`}>
                          {service.state}
                        </span>
                      </td>
                      <td>{service.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>روابط تشغيلية</h3>
                <p>اختصارات لوحدات IT المرتبطة بالبنية التحتية والحوكمة</p>
              </div>
            </div>

            <div className="erp-alert-list">
              <div className="erp-alert-item">
                <strong>مركز الصلاحيات</strong>
                <p><Link href="/it/access-center">/it/access-center</Link></p>
              </div>

              <div className="erp-alert-item">
                <strong>النسخ الاحتياطية</strong>
                <p><Link href="/backups">/backups</Link></p>
              </div>

              <div className="erp-alert-item">
                <strong>وحدة IT الرئيسية</strong>
                <p><Link href="/it">/it</Link></p>
              </div>
            </div>
          </div>
        </section>

        {message ? <div className="erp-form-message" style={{ marginTop: "20px" }}>{message}</div> : null}
      </section>
    </main>
  );
}
