'use client'
import { useEffect, useState } from "react"
import Sidebar from "../../components/Sidebar"
import useAdminAuth from "../../components/useAdminAuth"
import { authHeaders } from "../../components/api"

const API = "https://api.royalpalace-group.com/api/v1/admin/smart-factory/digital-twin"

export default function DigitalTwinPage() {
  const { user, ready } = useAdminAuth("work_orders")
  const [elements, setElements] = useState([])
  const [factoryId, setFactoryId] = useState(1)

  useEffect(() => {
    if (!ready || !user) return
    fetch(`${API}?factory_id=${factoryId}`, { headers: authHeaders() }).then(r => r.json()).then(setElements)
  }, [ready, user, factoryId])

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <h2>Digital Twin</h2>
        <input className="erp-input" type="number" value={factoryId} onChange={e => setFactoryId(e.target.value)} placeholder="Factory ID" style={{marginBottom:10}} />
        <div style={{position:"relative",width:"100%",height:500,background:"#f0f0f0",border:"1px solid #ccc",overflow:"auto"}}>
          {elements.map(el => (
            <div key={el.id} title={el.name} style={{position:"absolute",left:el.pos_x,top:el.pos_y,width:el.width,height:el.height,background:el.state==="running"?"#10b981":"#ef4444",border:"1px solid #000",color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:10}}>
              {el.name}
            </div>
          ))}
        </div>
      </section>
    </main>
  )
}
