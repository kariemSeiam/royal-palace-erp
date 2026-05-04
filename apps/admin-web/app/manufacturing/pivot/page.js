'use client'
import { useEffect, useState } from "react"
import Sidebar from "../../components/Sidebar"
import useAdminAuth from "../../components/useAdminAuth"
import { authHeaders } from "../../components/api"

const PIVOT_API = "https://api.royalpalace-group.com/api/v1/admin/mrp/pivot"

export default function PivotPage() {
  const { user, ready } = useAdminAuth("work_orders")
  const [byStatus, setByStatus] = useState([])
  const [byFactory, setByFactory] = useState([])
  const [scrapByWC, setScrapByWC] = useState([])

  useEffect(() => {
    if (!ready || !user) return
    fetch(PIVOT_API + "/orders-by-status", { headers: authHeaders() }).then(r => r.json()).then(setByStatus)
    fetch(PIVOT_API + "/production-by-factory", { headers: authHeaders() }).then(r => r.json()).then(setByFactory)
    fetch(PIVOT_API + "/scrap-by-workcenter", { headers: authHeaders() }).then(r => r.json()).then(setScrapByWC)
  }, [ready, user])

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <h2>Pivot / Graph</h2>
        <div className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">أوامر حسب الحالة</div><table className="erp-table"><tbody>{byStatus.map(r=><tr key={r.status}><td>{r.status}</td><td>{r.count}</td></tr>)}</tbody></table></div>
          <div className="erp-card"><div className="erp-card-title">إنتاج حسب المصنع</div><table className="erp-table"><tbody>{byFactory.map(r=><tr key={r.factory}><td>{r.factory}</td><td>{r.total_orders}</td></tr>)}</tbody></table></div>
          <div className="erp-card"><div className="erp-card-title">هالك حسب المحطة</div><table className="erp-table"><tbody>{scrapByWC.map(r=><tr key={r.workcenter}><td>{r.workcenter}</td><td>{r.total_scrap}</td></tr>)}</tbody></table></div>
        </div>
      </section>
    </main>
  )
}
