"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const ACCESS_CENTER_API = "https://api.royalpalace-group.com/api/v1/admin/it/access-center/summary";
const HEALTH_API = "https://api.royalpalace-group.com/health/live";

export default function BackupsPage() {
  const { user, ready } = useAdminAuth("backups");
  const [payload, setPayload] = useState({
    health: { status: "unknown" },
    summary: {
      active_users_with_it_access: 0,
      total_users_with_it_access: 0,
      total_roles_with_it_permissions: 0,
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
            active_users_with_it_access: Number(accessData?.summary?.active_users_with_it_access || 0),
            total_users_with_it_access: Number(accessData?.summary?.total_users_with_it_access || 0),
            total_roles_with_it_permissions: Number(accessData?.summary?.total_roles_with_it_permissions || 0),
            viewer_factory_scope: accessData?.summary?.viewer_factory_scope ?? null,
            scope_mode: accessData?.summary?.scope_mode || "mixed",
          },
        });
      } catch (error) {
        setMessage(error?.message || "تعذر تحميل مؤشرات النسخ الاحتياطية");
      } finally {
        setPageReady(true);
      }
    }

    load();
  }, [ready, user]);

  if (!ready || !user || !pageReady) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل النسخ الاحتياطية...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">Backup Governance</div>
            <h2>النسخ الاحتياطية والاستعادة</h2>
            <p>
              صفحة تشغيلية لتقييم جاهزية النسخ الاحتياطية ضمن حوكمة تقنية المعلومات
              وبحسب نطاق الوصول الحالي.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">API: {payload.health.status}</div>
              <div className="erp-hero-pill">
                {payload.summary.viewer_factory_scope
                  ? `Factory #${payload.summary.viewer_factory_scope}`
                  : "Group Scope"}
              </div>
              <div className="erp-hero-pill">IT Roles: {payload.summary.total_roles_with_it_permissions}</div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">IT Users</div>
              <div className="erp-stat-box-value">{payload.summary.total_users_with_it_access}</div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">Active</div>
              <div className="erp-stat-box-value">{payload.summary.active_users_with_it_access}</div>
            </div>

            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">وضع الخدمة</div>
            <div className="erp-card-value">{payload.health.status === "live" ? "Live" : "Check"}</div>
            <div className="erp-card-note">قراءة من health endpoint</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">نمط النطاق</div>
            <div className="erp-card-value">
              {payload.summary.scope_mode === "group"
                ? "Group"
                : payload.summary.scope_mode === "factory"
                ? "Factory"
                : "Mixed"}
            </div>
            <div className="erp-card-note">يعكس وضع المشاهدة الحالي</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">جاهزية الحوكمة</div>
            <div className="erp-card-value">
              {payload.summary.total_roles_with_it_permissions > 0 ? "Ready" : "Low"}
            </div>
            <div className="erp-card-note">مرتبطة بوجود أدوار وصلاحيات IT</div>
          </div>
        </section>

        <section className="erp-grid-2">
          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>الحالة الحالية</h3>
                <p>قراءة تشغيلية سريعة قبل ربط backup jobs الفعلية لاحقًا</p>
              </div>
            </div>

            <div className="erp-alert-list">
              <div className="erp-alert-item">
                <strong>Service Reachability</strong>
                <p>حالة الـ API الحالية: {payload.health.status}</p>
              </div>

              <div className="erp-alert-item">
                <strong>Access Governance</strong>
                <p>عدد الأدوار التقنية المرتبطة حاليًا: {payload.summary.total_roles_with_it_permissions}</p>
              </div>

              <div className="erp-alert-item">
                <strong>Operational Scope</strong>
                <p>
                  {payload.summary.viewer_factory_scope
                    ? `العرض الحالي مقيّد بالمصنع #${payload.summary.viewer_factory_scope}`
                    : "العرض الحالي على نطاق المجموعة أو غير مقيّد بمصنع واحد."}
                </p>
              </div>
            </div>
          </div>

          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>الخطوة التالية</h3>
                <p>مكان ربط backup jobs بدون كسر البنية الحالية</p>
              </div>
            </div>

            <div className="erp-alert-list">
              <div className="erp-alert-item">
                <strong>ربط لاحق آمن</strong>
                <p>يمكن لاحقًا إضافة jobs حقيقية وسجل snapshots داخل نفس الصفحة بدون إعادة هيكلة.</p>
              </div>

              <div className="erp-alert-item">
                <strong>العودة لمركز IT</strong>
                <p><Link href="/it">/it</Link></p>
              </div>

              <div className="erp-alert-item">
                <strong>مركز الصلاحيات</strong>
                <p><Link href="/it/access-center">/it/access-center</Link></p>
              </div>
            </div>
          </div>
        </section>

        {message ? <div className="erp-form-message" style={{ marginTop: "20px" }}>{message}</div> : null}
      </section>
    </main>
  );
}
