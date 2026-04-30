"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const ACCESS_CENTER_API = "https://api.royalpalace-group.com/api/v1/admin/it/access-center/summary";
const HEALTH_API = "https://api.royalpalace-group.com/health/live";

export default function UISettingsPage() {
  const { user, ready } = useAdminAuth("ui-settings");
  const [payload, setPayload] = useState({
    health: { status: "unknown" },
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
        const [healthRes, accessRes] = await Promise.all([
          fetch(HEALTH_API, { cache: "no-store" }),
          fetch(ACCESS_CENTER_API, { headers: authHeaders(), cache: "no-store" }),
        ]);

        const healthData = await healthRes.json().catch(() => ({}));
        const accessData = await accessRes.json().catch(() => ({}));

        setPayload({
          health: {
            status: healthData?.status || "unknown",
          },
          summary: {
            total_roles_with_it_permissions: Number(accessData?.summary?.total_roles_with_it_permissions || 0),
            total_users_with_it_access: Number(accessData?.summary?.total_users_with_it_access || 0),
            viewer_factory_scope: accessData?.summary?.viewer_factory_scope ?? null,
            scope_mode: accessData?.summary?.scope_mode || "mixed",
          },
        });
      } catch (error) {
        setMessage(error?.message || "تعذر تحميل إعدادات الواجهة");
      } finally {
        setPageReady(true);
      }
    }

    load();
  }, [ready, user]);

  if (!ready || !user || !pageReady) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل إعدادات الواجهة...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">UI Control Center</div>
            <h2>إعدادات الواجهة</h2>
            <p>
              مركز تشغيل لإدارة الوضع البصري العام واتساق تجربة الإدارة العربية RTL-first.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">API: {payload.health.status}</div>
              <div className="erp-hero-pill">IT Roles: {payload.summary.total_roles_with_it_permissions}</div>
              <div className="erp-hero-pill">IT Users: {payload.summary.total_users_with_it_access}</div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">RTL</div>
              <div className="erp-stat-box-value">On</div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">Scope</div>
              <div className="erp-stat-box-value" style={{ fontSize: "20px" }}>
                {payload.summary.viewer_factory_scope ? `#${payload.summary.viewer_factory_scope}` : "Group"}
              </div>
            </div>

            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">RTL First</div>
            <div className="erp-card-value">Yes</div>
            <div className="erp-card-note">Arabic-first operational UX</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">Design System</div>
            <div className="erp-card-value">Active</div>
            <div className="erp-card-note">ERP shell / cards / tables / badges</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">Health</div>
            <div className="erp-card-value">{payload.health.status}</div>
            <div className="erp-card-note">مرتبط بـ API health live</div>
          </div>
        </section>

        <section className="erp-grid-2">
          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>الإعدادات الحالية</h3>
                <p>صورة تشغيلية للوضع الحالي للواجهة</p>
              </div>
            </div>

            <div className="erp-alert-list">
              <div className="erp-alert-item">
                <strong>Direction</strong>
                <p>RTL مفعل كخيار أساسي للمنصة.</p>
              </div>

              <div className="erp-alert-item">
                <strong>Governance Layer</strong>
                <p>التحكم يقع تحت مظلة IT governance والصلاحيات المركزية.</p>
              </div>

              <div className="erp-alert-item">
                <strong>Related Pages</strong>
                <p><Link href="/themes">/themes</Link> — <Link href="/branding">/branding</Link></p>
              </div>
            </div>
          </div>

          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>المرحلة القادمة</h3>
                <p>إضافات UI control مستقبلية</p>
              </div>
            </div>

            <div className="erp-form-message">
              يمكن لاحقًا إضافة مفاتيح فعلية للألوان والخطوط وdensity والhero variants وglobal toggles بدون إعادة هيكلة.
            </div>
          </div>
        </section>

        {message ? <div className="erp-form-message" style={{ marginTop: "20px" }}>{message}</div> : null}
      </section>
    </main>
  );
}
