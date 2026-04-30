"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const APPT_URL = "https://api.royalpalace-group.com/api/v1/admin/appointments";

export default function AppointmentsPage() {
  const { user, ready } = useAdminAuth("appointment");
  const [appointments, setAppointments] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ subject:"", scheduled_at:"", duration_minutes:"30" });
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    try {
      const res = await fetch(APPT_URL, { headers: authHeaders() });
      setAppointments(res.ok ? await res.json() : []);
    } catch (err) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  async function handleCreate(e) {
    e.preventDefault(); setSubmitting(true);
    try {
      const payload = { ...form, duration_minutes: Number(form.duration_minutes) };
      const res = await fetch(APPT_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء");
      setForm({ subject:"", scheduled_at:"", duration_minutes:"30" });
      loadAll();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Appointments</div><h2>المواعيد</h2><p>جدولة المواعيد والاجتماعات.</p></div></section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <div className="erp-section-head"><h3>موعد جديد</h3></div>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleCreate}>
            <input className="erp-input" placeholder="الموضوع" value={form.subject} onChange={(e)=>setForm({...form,subject:e.target.value})} required />
            <input className="erp-input" type="datetime-local" value={form.scheduled_at} onChange={(e)=>setForm({...form,scheduled_at:e.target.value})} required />
            <input className="erp-input" type="number" placeholder="المدة (دقائق)" value={form.duration_minutes} onChange={(e)=>setForm({...form,duration_minutes:e.target.value})} />
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":"إنشاء الموعد"}</button></div>
          </form>
        </div>
        <div className="erp-section-card">
          <h3>قائمة المواعيد</h3>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr><th>ID</th><th>الموضوع</th><th>التاريخ</th><th>المدة</th><th>الحالة</th></tr>
              </thead>
              <tbody>
                {appointments.length === 0 ? (
                  <tr><td colSpan="5">لا توجد مواعيد. </td></tr>
                ) : (
                  appointments.map((a) => (
                    <tr key={a.id}>
                      <td>{a.id}</td>
                      <td>{a.subject}</td>
                      <td>{a.scheduled_at || "-"}</td>
                      <td>{a.duration_minutes} دقيقة</td>
                      <td>{a.status}</td>
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
