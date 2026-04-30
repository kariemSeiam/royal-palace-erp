"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const ACCESS_CENTER_API = "https://api.royalpalace-group.com/api/v1/admin/it/access-center/summary";
const PRODUCTS_API = "https://api.royalpalace-group.com/api/v1/catalog/products";

export default function BrandingPage() {
  const { user, ready } = useAdminAuth("branding");
  const [payload, setPayload] = useState({
    products: [],
    summary: {
      total_roles_with_it_permissions: 0,
      total_users_with_it_access: 0,
      viewer_factory_scope: null,
    },
  });
  const [pageReady, setPageReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ready || !user) return;

    async function load() {
      try {
        const [productsRes, accessRes] = await Promise.all([
          fetch(PRODUCTS_API, { cache: "no-store" }),
          fetch(ACCESS_CENTER_API, { headers: authHeaders(), cache: "no-store" }),
        ]);

        const productsData = await productsRes.json().catch(() => []);
        const accessData = await accessRes.json().catch(() => ({}));

        setPayload({
          products: Array.isArray(productsData) ? productsData : [],
          summary: {
            total_roles_with_it_permissions: Number(accessData?.summary?.total_roles_with_it_permissions || 0),
            total_users_with_it_access: Number(accessData?.summary?.total_users_with_it_access || 0),
            viewer_factory_scope: accessData?.summary?.viewer_factory_scope ?? null,
          },
        });
      } catch (error) {
        setMessage(error?.message || "تعذر تحميل مؤشرات الهوية البصرية");
      } finally {
        setPageReady(true);
      }
    }

    load();
  }, [ready, user]);

  if (!ready || !user || !pageReady) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل الهوية البصرية...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">Brand Governance</div>
            <h2>الهوية البصرية</h2>
            <p>
              طبقة الحوكمة المسؤولة عن اتساق العلامة البصرية عبر صفحات الإدارة والكتالوج.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">Products: {payload.products.length}</div>
              <div className="erp-hero-pill">IT Users: {payload.summary.total_users_with_it_access}</div>
              <div className="erp-hero-pill">
                {payload.summary.viewer_factory_scope ? `Factory #${payload.summary.viewer_factory_scope}` : "Group Scope"}
              </div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">Brand Mode</div>
              <div className="erp-stat-box-value">Unified</div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">IT Roles</div>
              <div className="erp-stat-box-value">{payload.summary.total_roles_with_it_permissions}</div>
            </div>

            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">الشعار</div>
            <div className="erp-card-value">RP</div>
            <div className="erp-card-note">هوية أولية موحدة</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">الأسلوب العام</div>
            <div className="erp-card-value">Executive</div>
            <div className="erp-card-note">واجهة إدارية مؤسسية</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">ارتباط الكتالوج</div>
            <div className="erp-card-value">{payload.products.length}</div>
            <div className="erp-card-note">منتجات متأثرة بالعرض البصري</div>
          </div>
        </section>

        <section className="erp-grid-2">
          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>قواعد العلامة الحالية</h3>
                <p>قراءة تأسيسية للوضع الحالي</p>
              </div>
            </div>

            <div className="erp-alert-list">
              <div className="erp-alert-item">
                <strong>Brand Governance Enabled</strong>
                <p>تم تفعيل الصفحة كجزء من IT governance مع ربطها بمؤشرات حية.</p>
              </div>

              <div className="erp-alert-item">
                <strong>Connected Surface</strong>
                <p>عدد المنتجات الحالية في السطح العام: {payload.products.length}</p>
              </div>

              <div className="erp-alert-item">
                <strong>Related Pages</strong>
                <p><Link href="/themes">/themes</Link> — <Link href="/ui-settings">/ui-settings</Link></p>
              </div>
            </div>
          </div>

          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>المرحلة القادمة</h3>
                <p>إضافات ممكنة لاحقًا بنفس المسار</p>
              </div>
            </div>

            <div className="erp-form-message">
              يمكن لاحقًا إضافة إدارة شعار، favicon، أصول العلامة، ونصوص العلامة التجارية من نفس الصفحة.
            </div>
          </div>
        </section>

        {message ? <div className="erp-form-message" style={{ marginTop: "20px" }}>{message}</div> : null}
      </section>
    </main>
  );
}
