"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const SIGN_URL = "https://api.royalpalace-group.com/api/v1/admin/sign/requests";

export default function SignPage() {
  const { user, ready } = useAdminAuth("sign");
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ title:"", signer_name:"", signer_email:"", document_url:"" });
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    try {
      const res = await fetch(SIGN_URL, { headers: authHeaders() });
      setRequests(res.ok ? await res.json() : []);
    } catch (err) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  async function handleCreate(e) {
    e.preventDefault(); setSubmitting(true);
    try {
      const res = await fetch(SIGN_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(form) });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء");
      setForm({ title:"", signer_name:"", signer_email:"", document_url:"" });
      loadAll();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Sign</div><h2>التوقيع الإلكتروني</h2><p>إرسال طلبات التوقيع ومتابعتها.</p></div></section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <div className="erp-section-head"><h3>طلب توقيع جديد</h3></div>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleCreate}>
            <input className="erp-input" placeholder="العنوان" value={form.title} onChange={(e)=>setForm({...form,title:e.target.value})} required />
            <input className="erp-input" placeholder="اسم الموقّع" value={form.signer_name} onChange={(e)=>setForm({...form,signer_name:e.target.value})} />
            <input className="erp-input" placeholder="بريد الموقّع" value={form.signer_email} onChange={(e)=>setForm({...form,signer_email:e.target.value})} />
            <input className="erp-input" placeholder="رابط المستند" value={form.document_url} onChange={(e)=>setForm({...form,document_url:e.target.value})} />
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":"إرسال الطلب"}</button></div>
          </form>
        </div>
        <div className="erp-section-card">
          <h3>طلبات التوقيع</h3>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr><th>ID</th><th>العنوان</th><th>الموقّع</th><th>الحالة</th></tr>
              </thead>
              <tbody>
                {requests.length === 0 ? (
                  <tr><td colSpan="4">لا توجد طلبات. </td></tr>
                ) : (
                  requests.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{r.title}</td>
                      <td>{r.signer_name || "-"}</td>
                      <td>{r.status}</td>
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
