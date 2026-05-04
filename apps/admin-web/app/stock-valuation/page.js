"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../components/hrExports";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts';

const VAL_API = "https://api.royalpalace-group.com/api/v1/admin/inventory/stock-valuation";
const PROD_API = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";

const btStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };
const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4'];

export default function StockValuationPage() {
  const { user, ready } = useAdminAuth("inventory");
  const [layers, setLayers] = useState([]);
  const [products, setProducts] = useState([]);
  const [filterProduct, setFilterProduct] = useState("");
  const [filterMethod, setFilterMethod] = useState("FIFO");
  const [msg, setMsg] = useState("");

  async function load() {
    const params = new URLSearchParams();
    if (filterProduct) params.set("product_id", filterProduct);
    params.set("method", filterMethod);
    const [vRes, pRes] = await Promise.all([
      fetch(`${VAL_API}?${params.toString()}`, { headers: authHeaders() }),
      fetch(PROD_API, { headers: authHeaders() }),
    ]);
    const vData = await vRes.json(); const pData = await pRes.json();
    setLayers(Array.isArray(vData) ? vData : []);
    setProducts(Array.isArray(pData) ? pData : []);
  }
  useEffect(() => { if (ready && user) load().catch(e=>setMsg(e.message)); }, [ready, user, filterProduct, filterMethod]);

  // تجميع البيانات للرسوم البيانية
  const totalValue = layers.reduce((sum, l) => sum + (l.unit_cost * l.remaining_quantity), 0);

  // رسم بياني لأعلى 10 منتجات من حيث قيمة المخزون
  const productValueMap = {};
  layers.forEach(l => {
    const key = l.product_name || `#${l.product_id}`;
    productValueMap[key] = (productValueMap[key] || 0) + (l.unit_cost * l.remaining_quantity);
  });
  const barData = Object.entries(productValueMap)
    .map(([name, value]) => ({ name, value }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 8);

  // توزيع حسب طريقة التقييم
  const methodMap = {};
  layers.forEach(l => {
    methodMap[l.method] = (methodMap[l.method] || 0) + (l.unit_cost * l.remaining_quantity);
  });
  const pieData = Object.entries(methodMap).map(([name, value]) => ({ name, value }));

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">Loading...</div></main>;

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <div className="erp-hero"><div><div className="erp-hero-pill">Stock Valuation</div><h2>تقييم المخزون</h2></div>
        <div className="erp-stat-panel">
          <div className="erp-stat-box"><div className="erp-stat-box-label">طبقات التكلفة</div><div className="erp-stat-box-value">{layers.length}</div></div>
          <div className="erp-stat-box"><div className="erp-stat-box-label">القيمة الإجمالية</div><div className="erp-stat-box-value">{totalValue.toLocaleString()} ج.م</div></div>
        </div>
      </div>
      {msg && <div className="erp-form-message">{msg}</div>}
      <div className="erp-section-card" style={{marginBottom:18}}>
        <div style={{display:"flex", gap:8, marginBottom:16, flexWrap:"wrap", alignItems:"center"}}>
          <select className="erp-input" value={filterProduct} onChange={e=>setFilterProduct(e.target.value)} style={{maxWidth:300}}>
            <option value="">كل المنتجات</option>
            {products.map(p=><option key={p.id} value={p.id}>{p.name_ar} ({p.sku})</option>)}
          </select>
          <select className="erp-input" value={filterMethod} onChange={e=>setFilterMethod(e.target.value)} style={{maxWidth:150}}>
            <option value="FIFO">FIFO</option>
            <option value="LIFO">LIFO</option>
            <option value="AVCO">AVCO</option>
          </select>
          <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableCsv("stock_valuation.csv",["ID","Product","Qty","Unit Cost","Remaining","Method","Created"], layers.map(l=>[l.id, l.product_name||l.product_id, l.quantity, l.unit_cost, l.remaining_quantity, l.method, l.created_at]))}>CSV</button>
          <button className="erp-btn-secondary" style={btStyle} onClick={()=>exportTableXlsx("stock_valuation.xlsx",["ID","Product","Qty","Unit Cost","Remaining","Method","Created"], layers.map(l=>[l.id, l.product_name||l.product_id, l.quantity, l.unit_cost, l.remaining_quantity, l.method, l.created_at]))}>Excel</button>
          <button className="erp-btn-primary" style={btStyle} onClick={()=>exportTablePdf("تقييم المخزون","Stock Valuation",[{label:"طبقات",value:layers.length},{label:"القيمة",value:totalValue.toLocaleString()}],["ID","Product","Qty","Unit Cost","Remaining","Method","Created"], layers.map(l=>[l.id, l.product_name||l.product_id, l.quantity, l.unit_cost, l.remaining_quantity, l.method, l.created_at]))}>PDF</button>
        </div>

        {/* Charts */}
        {layers.length > 0 && (
          <div className="erp-form-grid erp-form-grid-2" style={{marginBottom:18}}>
            <div className="erp-section-card">
              <h4>أعلى المنتجات قيمة مخزنية</h4>
              <BarChart width={400} height={250} data={barData}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" tick={{fontSize:9}} />
                <YAxis />
                <Tooltip formatter={(val) => `${val.toLocaleString()} ج.م`} />
                <Bar dataKey="value" fill="#3b82f6" />
              </BarChart>
            </div>
            <div className="erp-section-card">
              <h4>توزيع حسب طريقة التقييم</h4>
              <PieChart width={300} height={250}>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({name, value}) => `${name}: ${value.toLocaleString()} ج.م`}>
                  {pieData.map((entry, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
                </Pie>
                <Tooltip formatter={(val) => `${val.toLocaleString()} ج.م`} />
              </PieChart>
            </div>
          </div>
        )}

        <div className="erp-table-shell">
          <table className="erp-table">
            <thead><tr><th>ID</th><th>المنتج</th><th>الكمية</th><th>تكلفة الوحدة</th><th>المتبقي</th><th>الطريقة</th><th>التاريخ</th></tr></thead>
            <tbody>
              {layers.map(l=>(
                <tr key={l.id}>
                  <td>{l.id}</td>
                  <td>{l.product_name || `#${l.product_id}`}</td>
                  <td>{l.quantity}</td>
                  <td>{l.unit_cost}</td>
                  <td>{l.remaining_quantity}</td>
                  <td>{l.method}</td>
                  <td>{l.created_at ? new Date(l.created_at).toLocaleDateString("ar-EG") : "-"}</td>
                </tr>
              ))}
              {layers.length===0 && <tr><td colSpan={7} style={{textAlign:"center"}}>لا توجد طبقات تقييم للفلاتر المحددة.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </section></main>
  );
}
