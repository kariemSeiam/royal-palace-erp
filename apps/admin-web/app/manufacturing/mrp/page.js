"use client";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";

const MRP_API = "https://api.royalpalace-group.com/api/v1/admin/mrp/mrp";
const FORECAST_API = "https://api.royalpalace-group.com/api/v1/admin/smart-factory/demand-forecast";

export default function MRPPage() {
  const { user, ready } = useAdminAuth("work_orders");
  const [suggestions, setSuggestions] = useState([]);
  const [forecast, setForecast] = useState([]);
  const [productId, setProductId] = useState("184");
  const [days, setDays] = useState("30");
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (ready && user) {
      fetch(MRP_API + "/suggest", { headers: authHeaders() })
        .then(r => r.json())
        .then(d => setSuggestions(d.suggestions || []));
    }
  }, [ready, user]);

  async function loadForecast() {
    const res = await fetch(`${FORECAST_API}?product_id=${productId}&days=${days}`, { headers: authHeaders() });
    setForecast(res.ok ? await res.json() : []);
  }

  const filtered = suggestions.filter(s => String(s.product_id).includes(search) || String(s.supplier_id||"").includes(search));

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">MRP</div><h2>تخطيط احتياجات المواد</h2><p>اقتراحات أوامر الشراء والتصنيع.</p></div></section>
        <div className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">مقترحات اليوم</div><div className="erp-card-value">{suggestions.length}</div></div>
        </div>
        <div className="erp-section-card">
          <h3>المقترحات</h3>
          <input className="erp-input" placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)} style={{marginBottom:12, width:200}} />
          <table className="erp-table"><thead><tr><th>المنتج</th><th>المخزون</th><th>الحد الأدنى</th><th>الكمية المقترحة</th><th>المورد</th></tr></thead><tbody>
            {filtered.map((s,i) => <tr key={i}><td>{s.product_id}</td><td>{s.current_stock}</td><td>{s.min}</td><td>{s.suggested_order}</td><td>{s.supplier_id||"-"}</td></tr>)}
          </tbody></table>
        </div>
        <div className="erp-section-card" style={{ marginTop: 18 }}>
          <h3>توقعات الطلب</h3>
          <div style={{display:"flex", gap:8, marginBottom:12}}>
            <input className="erp-input" type="number" placeholder="معرف المنتج" value={productId} onChange={e=>setProductId(e.target.value)} />
            <input className="erp-input" type="number" placeholder="الأيام" value={days} onChange={e=>setDays(e.target.value)} />
            <button className="erp-btn-primary" onClick={loadForecast}>تحميل</button>
          </div>
          <table className="erp-table"><thead><tr><th>التاريخ</th><th>الكمية المتوقعة</th><th>الثقة</th></tr></thead><tbody>
            {forecast.map((f,i) => <tr key={i}><td>{f.date}</td><td>{f.quantity}</td><td>{f.confidence}%</td></tr>)}
          </tbody></table>
        </div>
      </section>
    </main>
  );
}
