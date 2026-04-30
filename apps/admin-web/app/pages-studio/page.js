"use client";

import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";

export default function PagesStudioPage() {
  const { user, ready } = useAdminAuth("pages-studio");

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل استوديو الصفحات...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />
      <section className="erp-main">
        <div className="erp-topbar">
          <div className="erp-topbar-title">
            <h1>استوديو الصفحات</h1>
            <p>بداية آمنة لإدارة page blocks وتهيئة التحكم المركزي في تجربة العرض.</p>
          </div>
        </div>

        <div className="erp-form-message">
          هذه الوحدة تم تأسيسها لتكون المدخل الرسمي لاحقًا لإدارة الصفحات والـ layout blocks
          بدون أي إعادة هيكلة للمشروع الحي.
        </div>
      </section>
    </main>
  );
}
