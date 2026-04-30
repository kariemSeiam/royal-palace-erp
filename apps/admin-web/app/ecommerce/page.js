"use client";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";

export default function EcommercePage() {
  const { user, ready } = useAdminAuth("website");

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">eCommerce</div><h2>إعدادات التجارة الإلكترونية</h2><p>إدارة إعدادات المتجر الإلكتروني.</p></div>
        </section>
        <div className="erp-form-message">قيد التطوير – سيتم ربطها بإعدادات المتجر والمنتجات قريباً.</div>
      </section>
    </main>
  );
}
