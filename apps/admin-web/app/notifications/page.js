"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const NOTIF_URL = "https://api.royalpalace-group.com/api/v1/admin/notifications";
const MSG_URL = "https://api.royalpalace-group.com/api/v1/admin/messages";

export default function NotificationsPage() {
  const { user, ready } = useAdminAuth("notifications");
  const [notifications, setNotifications] = useState([]);
  const [messages, setMessages] = useState([]);
  const [messageText, setMessageText] = useState("");
  const [recipientId, setRecipientId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [notifMsg, setNotifMsg] = useState("");

  async function loadAll() {
    try {
      const [notifRes, msgRes] = await Promise.all([
        fetch(NOTIF_URL + "?include_read=true", { headers: authHeaders() }),
        fetch(MSG_URL, { headers: authHeaders() }),
      ]);
      setNotifications(notifRes.ok ? await notifRes.json() : []);
      setMessages(msgRes.ok ? await msgRes.json() : []);
    } catch (e) { setNotifMsg("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  async function markAllRead() {
    await fetch(NOTIF_URL + "/read-all", { method: "PUT", headers: authHeaders() });
    loadAll();
  }

  async function sendMessage(e) {
    e.preventDefault(); setSubmitting(true);
    try {
      const res = await fetch(MSG_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ message_text: messageText, recipient_user_id: recipientId || null }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الإرسال");
      setMessageText(""); setRecipientId("");
      loadAll();
    } catch (err) { setNotifMsg(err.message); } finally { setSubmitting(false); }
  }


  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
      <section className="erp-kpi-grid"><div className="erp-card"><div className="erp-card-title">إجمالي السجلات</div><div className="erp-card-value">{items?.length || 0}</div></div><div className="erp-card"><div className="erp-card-title">نشط</div><div className="erp-card-value">{items?.filter(i=>i.is_active!==false).length || 0}</div></div></section>
          <div><div className="erp-hero-pill">Notifications Center</div><h2>الإشعارات والمراسلات</h2><p>متابعة الإشعارات وتبادل الرسائل الداخلية.</p></div>
        </section>

        {notifMsg ? <div className="erp-form-message">{notifMsg}</div> : null}

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head">
            <h3>آخر الإشعارات</h3>
            <button className="erp-btn-secondary" onClick={markAllRead}>تحديد الكل كمقروء</button>
          </div>
          {notifications.length === 0 ? <div className="erp-mini-note">لا توجد إشعارات حالياً.</div> : notifications.map((n) => (
            <div key={n.id} style={{ border: "1px solid var(--rp-border)", borderRadius: "14px", padding: "12px", marginBottom: "10px", background: n.is_read ? "#fff" : "#f0fdf4" }}>
              <div style={{ fontWeight: 800 }}>{n.title}</div>
              <div style={{ color: "var(--rp-text-muted)", fontSize: "13px" }}>{n.body || "-"}</div>
              <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "8px" }}>{new Date(n.created_at).toLocaleString("ar-EG")}</div>
            </div>
          ))}
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head"><h3>المراسلات الداخلية</h3></div>
          <form className="erp-form-grid" onSubmit={sendMessage}>
            <input className="erp-input" placeholder="معرف المستلم (اختياري للعام)" value={recipientId} onChange={(e) => setRecipientId(e.target.value)} />
            <textarea className="erp-input" rows="3" placeholder="نص الرسالة" value={messageText} onChange={(e) => setMessageText(e.target.value)} required />
            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الإرسال..." : "إرسال"}</button>
            </div>
          </form>
          <div style={{ marginTop: "16px", display: "grid", gap: "10px" }}>
            {messages.length === 0 ? <div className="erp-mini-note">لا توجد رسائل.</div> : messages.map((m) => (
              <div key={m.id} style={{ border: "1px solid var(--rp-border)", borderRadius: "14px", padding: "10px", background: m.sender_user_id === user?.id ? "#eff6ff" : "#fff" }}>
                <div style={{ fontWeight: 800 }}>{m.sender_user_id === user?.id ? "أنت" : `مستخدم #${m.sender_user_id}`}</div>
                <div style={{ marginTop: "6px" }}>{m.message_text}</div>
                <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "6px" }}>{new Date(m.created_at).toLocaleString("ar-EG")}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
