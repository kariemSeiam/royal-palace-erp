"use client";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";

export default function OEEPage() {
  const { user, ready } = useAdminAuth("work_orders");

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">تحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">OEE Management</div><h2>فعالية المعدات الشاملة</h2><p>قياس أداء التصنيع.</p></div></section>
        <section className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">التوافر</div><div className="erp-card-value">100%</div></div>
          <div className="erp-card"><div className="erp-card-title">الأداء</div><div className="erp-card-value">100%</div></div>
          <div className="erp-card"><div className="erp-card-title">الجودة</div><div className="erp-card-value">100%</div></div>
          <div className="erp-card"><div className="erp-card-title">OEE</div><div className="erp-card-value">100%</div></div>
        </section>
      </section>
    </main>
  );
}
