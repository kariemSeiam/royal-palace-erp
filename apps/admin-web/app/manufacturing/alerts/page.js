'use client'
import { useEffect, useState } from "react"
import Sidebar from "../../components/Sidebar"
import useAdminAuth from "../../components/useAdminAuth"
import { authHeaders } from "../../components/api"

const API = "https://api.royalpalace-group.com/api/v1/admin/mrp/alerts"

export default function AlertsPage() {
  const { user, ready } = useAdminAuth("quality")
  const [alerts, setAlerts] = useState([])

  useEffect(() => {
    if (ready && user) fetch(API, { headers: authHeaders() }).then(r => r.json()).then(setAlerts)
  }, [ready, user])

  async function markRead(id) {
    await fetch(`${API}/${id}/read`, { method: "POST", headers: authHeaders() })
    setAlerts(prev => prev.map(a => a.id === id ? {...a, is_read: true} : a))
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <h2>تنبيهات الجودة</h2>
        <table className="erp-table">
          <thead><tr><th>ID</th><th>فحص</th><th>الرسالة</th><th>التاريخ</th><th>مقروء</th></tr></thead>
          <tbody>
            {alerts.map(a => <tr key={a.id}><td>{a.id}</td><td>{a.quality_check_id}</td><td>{a.message}</td><td>{a.created_at?.slice(0,10)}</td><td>{a.is_read ? "✅" : <button onClick={()=>markRead(a.id)}>تحديد كمقروء</button>}</td></tr>)}
          </tbody>
        </table>
      </section>
    </main>
  )
}
