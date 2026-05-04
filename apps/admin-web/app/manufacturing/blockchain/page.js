'use client'
import { useEffect, useState } from "react"
import Sidebar from "../../components/Sidebar"
import useAdminAuth from "../../components/useAdminAuth"
import { authHeaders } from "../../components/api"

const API = "https://api.royalpalace-group.com/api/v1/admin/blockchain/trace"

export default function BlockchainPage() {
  const { user, ready } = useAdminAuth("work_orders")
  const [moId, setMoId] = useState("")
  const [events, setEvents] = useState([])

  async function load() {
    const res = await fetch(`${API}?mo_id=${moId}`, { headers: authHeaders() })
    setEvents(res.ok ? await res.json() : [])
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <h2>Blockchain Traceability</h2>
        <div style={{display:"flex",gap:10}}>
          <input className="erp-input" type="number" placeholder="MO ID" value={moId} onChange={e=>setMoId(e.target.value)} />
          <button className="erp-btn-primary" onClick={load}>تتبع</button>
        </div>
        <table className="erp-table" style={{marginTop:10}}>
          <thead><tr><th>ID</th><th>Event</th><th>Hash</th><th>Previous Hash</th></tr></thead>
          <tbody>
            {events.map(e => (
              <tr key={e.id}>
                <td>{e.id}</td>
                <td>{e.event_type}</td>
                <td style={{fontSize:10}}>{e.current_hash}</td>
                <td style={{fontSize:10}}>{e.previous_hash}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </main>
  )
}
