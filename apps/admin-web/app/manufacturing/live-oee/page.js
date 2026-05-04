'use client'
import { useEffect, useState } from "react"
import Sidebar from "../../components/Sidebar"
import useAdminAuth from "../../components/useAdminAuth"
import { authHeaders } from "../../components/api"

const API = "https://api.royalpalace-group.com/api/v1/admin/smart-factory/live-oee"

export default function LiveOEEPage() {
  const { user, ready } = useAdminAuth("work_orders")
  const [oeeData, setOeeData] = useState([])

  useEffect(() => {
    if (!ready || !user) return
    const interval = setInterval(() => {
      fetch(API, { headers: authHeaders() }).then(r => r.json()).then(setOeeData)
    }, 2000)
    return () => clearInterval(interval)
  }, [ready, user])

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <h2>Live OEE</h2>
        <div className="erp-kpi-grid">
          {oeeData.map(wc => (
            <div className="erp-card" key={wc.id}>
              <div className="erp-card-title">{wc.name}</div>
              <div className="erp-card-value">{Number(wc.oee).toFixed(1)}%</div>
              <div style={{fontSize:12}}>A: {Number(wc.availability).toFixed(1)}% | P: {Number(wc.performance).toFixed(1)}% | Q: {Number(wc.quality).toFixed(1)}%</div>
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
