"use client";

import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";

export default function DeploymentsPage() {
  const { user, ready } = useAdminAuth("deployments");

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل النشرات...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />
      <section className="erp-main">
        <div className="erp-topbar">
          <div className="erp-topbar-title">
            <h1>النشرات</h1>
            <p>وحدة أولية لمتابعة إدارة النشرات والتحديثات داخل المنظومة الحية.</p>
          </div>
        </div>

        <div className="erp-form-message">
          تم تأسيس وحدة deployments داخل الـ admin-web لتتوافق مع permission model الجديد.
        </div>
      </section>
    </main>
  );
}
