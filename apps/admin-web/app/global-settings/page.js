"use client";

import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";

export default function GlobalSettingsPage() {
  const { user, ready } = useAdminAuth("global-settings");

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل الإعدادات العامة...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />
      <section className="erp-main">
        <div className="erp-topbar">
          <div className="erp-topbar-title">
            <h1>الإعدادات العامة</h1>
            <p>إعدادات مركزية على مستوى المجموعة تحت إشراف المالك وSuper Admin.</p>
          </div>
        </div>

        <div className="erp-form-message">
          تم تأسيس هذه الوحدة كمسار رسمي لإدارة الإعدادات العامة للمجموعة داخل النظام الحي.
        </div>
      </section>
    </main>
  );
}
