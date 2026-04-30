"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const ADJ_URL = "https://api.royalpalace-group.com/api/v1/admin/advanced-inventory/inventory-adjustments";
const LOC_URL = "https://api.royalpalace-group.com/api/v1/admin/advanced-inventory/locations";

export default function InventoryAdjustmentsPage() {
  const { user, ready } = useAdminAuth("inventory");
  const [adjustments, setAdjustments] = useState([]);
  const [locations, setLocations] = useState([]);
  const [message, setMessage] = useState("");

  async function loadAll() {
    try {
      const [adjRes, locRes] = await Promise.all([
        fetch(ADJ_URL, { headers: authHeaders() }),
        fetch(LOC_URL, { headers: authHeaders() }),
      ]);
      setAdjustments(adjRes.ok ? await adjRes.json() : []);
      setLocations(locRes.ok ? await locRes.json() : []);
    } catch (err) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  async function createAdjustment() {
    const name = prompt("اسم الجرد:");
    if (!name) return;
    try {
      const res = await fetch(ADJ_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ name, location_id: null }),
      });
      if (!res.ok) throw new Error("فشل الإنشاء");
      loadAll();
    } catch (err) { setMessage(err.message); }
  }

  async function applyAdjustment(id) {
    if (!confirm("تطبيق الجرد؟")) return;
    try {
      await fetch(`${ADJ_URL}/${id}/apply`, { method: "PUT", headers: authHeaders() });
      loadAll();
    } catch (err) { setMessage(err.message); }
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">Inventory Adjustments</div><h2>الجرد الدوري</h2><p>إدارة عمليات الجرد والتسويات.</p></div>
        </section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head">
            <h3>قائمة الجرد</h3>
            <button className="erp-btn-primary" onClick={createAdjustment}>جرد جديد</button>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr><th>ID</th><th>الاسم</th><th>الحالة</th><th>التاريخ</th><th>إجراءات</th></tr>
              </thead>
              <tbody>
                {adjustments.length === 0 ? (
                  <tr><td colSpan="5">لا توجد جردات.</td></tr>
                ) : (
                  adjustments.map((a) => (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td>{a.name}</td>
                      <td>{a.state}</td>
                      <td>{a.scheduled_date || "-"}</td>
                      <td><button className="erp-btn-secondary" onClick={() => applyAdjustment(a.id)} disabled={a.state !== "draft"}>تطبيق</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
