"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const PRODUCTS_API = "https://api.royalpalace-group.com/api/v1/catalog/products";
const CATEGORIES_API = "https://api.royalpalace-group.com/api/v1/catalog/categories";
const ACCESS_CENTER_API = "https://api.royalpalace-group.com/api/v1/admin/it/access-center/summary";

export default function MediaPage() {
  const { user, ready } = useAdminAuth("media");
  const [payload, setPayload] = useState({
    products: [],
    categories: [],
    summary: {
      total_users_with_it_access: 0,
      total_roles_with_it_permissions: 0,
      viewer_factory_scope: null,
    },
  });
  const [pageReady, setPageReady] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!ready || !user) return;

    async function load() {
      try {
        const [productsRes, categoriesRes, accessRes] = await Promise.all([
          fetch(PRODUCTS_API, { cache: "no-store" }),
          fetch(CATEGORIES_API, { cache: "no-store" }),
          fetch(ACCESS_CENTER_API, { headers: authHeaders(), cache: "no-store" }),
        ]);

        const productsData = await productsRes.json().catch(() => []);
        const categoriesData = await categoriesRes.json().catch(() => []);
        const accessData = await accessRes.json().catch(() => ({}));

        setPayload({
          products: Array.isArray(productsData) ? productsData : [],
          categories: Array.isArray(categoriesData) ? categoriesData : [],
          summary: {
            total_users_with_it_access: Number(accessData?.summary?.total_users_with_it_access || 0),
            total_roles_with_it_permissions: Number(accessData?.summary?.total_roles_with_it_permissions || 0),
            viewer_factory_scope: accessData?.summary?.viewer_factory_scope ?? null,
          },
        });
      } catch (error) {
        setMessage(error?.message || "تعذر تحميل مؤشرات الوسائط");
      } finally {
        setPageReady(true);
      }
    }

    load();
  }, [ready, user]);

  const featuredProducts = useMemo(() => {
    return payload.products.slice(0, 6);
  }, [payload.products]);

  if (!ready || !user || !pageReady) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل الوسائط...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">Media Governance</div>
            <h2>إدارة الوسائط</h2>
            <p>
              عرض تشغيلي حي لحجم الكتالوج والمنتجات المنشورة كنقطة تأسيس لإدارة
              الصور والبنرات والملفات ضمن حوكمة IT.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">Products: {payload.products.length}</div>
              <div className="erp-hero-pill">Categories: {payload.categories.length}</div>
              <div className="erp-hero-pill">IT Users: {payload.summary.total_users_with_it_access}</div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">أدوار IT</div>
              <div className="erp-stat-box-value">{payload.summary.total_roles_with_it_permissions}</div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">Viewer Scope</div>
              <div className="erp-stat-box-value" style={{ fontSize: "20px" }}>
                {payload.summary.viewer_factory_scope ? `#${payload.summary.viewer_factory_scope}` : "Group"}
              </div>
            </div>

            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">إجمالي المنتجات</div>
            <div className="erp-card-value">{payload.products.length}</div>
            <div className="erp-card-note">من public catalog endpoint</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">إجمالي الأقسام</div>
            <div className="erp-card-value">{payload.categories.length}</div>
            <div className="erp-card-note">عدد الأقسام المنشورة</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">جاهزية الوسائط</div>
            <div className="erp-card-value">{payload.products.length > 0 ? "On" : "Low"}</div>
            <div className="erp-card-note">مرتبطة بحجم الكتالوج الحالي</div>
          </div>
        </section>

        <section className="erp-grid-2">
          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>عينة من المنتجات</h3>
                <p>قراءة سريعة من الكتالوج الحالي لدعم حوكمة الوسائط</p>
              </div>
              <div className="erp-mini-note">{featuredProducts.length} عناصر</div>
            </div>

            {featuredProducts.length === 0 ? (
              <div className="erp-form-message">لا توجد منتجات منشورة حاليًا.</div>
            ) : (
              <div className="erp-alert-list">
                {featuredProducts.map((item) => (
                  <div key={item.id} className="erp-alert-item">
                    <strong>{item.name_ar || item.slug || `Product #${item.id}`}</strong>
                    <p>
                      SKU: {item.sku || "—"} | Category: {item.category_id || "—"} | Price: {item.base_price || "—"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>روابط متصلة</h3>
                <p>الوحدات الأقرب لإدارة الوسائط والكتالوج</p>
              </div>
            </div>

            <div className="erp-alert-list">
              <div className="erp-alert-item">
                <strong>المنتجات</strong>
                <p><Link href="/products">/products</Link></p>
              </div>

              <div className="erp-alert-item">
                <strong>الأقسام الرئيسية</strong>
                <p><Link href="/categories">/categories</Link></p>
              </div>

              <div className="erp-alert-item">
                <strong>مركز IT</strong>
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
