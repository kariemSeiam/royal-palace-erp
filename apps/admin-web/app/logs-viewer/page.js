"use client";

import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";

export default function LogsViewerPage() {
  const { user, ready } = useAdminAuth("logs-viewer");

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل السجلات...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />
      <section className="erp-main">
        <div className="erp-topbar">
          <div className="erp-topbar-title">
            <h1>السجلات</h1>
            <p>واجهة أولية لمراجعة السجلات التشغيلية ضمن الحوكمة التقنية.</p>
          </div>
        </div>

        <div className="erp-form-message">
          الصفحة جاهزة الآن داخل النظام، والربط المباشر مع log streams يمكن إضافته في الدفعة التالية.
        </div>
      </section>
    </main>
  );
}
