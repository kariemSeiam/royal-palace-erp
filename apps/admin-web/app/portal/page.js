"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

export default function PortalPage() {
  const { user, ready } = useAdminAuth("portal");
  const [message, setMessage] = useState("");

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Portal</div><h2>بوابة العملاء</h2><p>إدارة وصول العملاء إلى حساباتهم وطلباتهم.</p></div></section>
        <div className="erp-form-message">قيد التطوير – سيتم ربطها بحسابات العملاء والطلبات قريباً.</div>
      </section>
    </main>
  );
}
