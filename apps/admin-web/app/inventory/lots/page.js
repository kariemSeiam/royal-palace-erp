"use client";
import { useEffect, useState, useMemo } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf, exportTableXlsx } from "../../components/hrExports";
import KanbanBoard from "../../components/KanbanBoard";

const API_URL = "https://api.royalpalace-group.com/api/v1/admin/stock-lots";
const FACTORIES_URL = "https://api.royalpalace-group.com/api/v1/admin/factories";
const PRODUCTS_URL = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";
const btStyle = { minHeight:42, borderRadius:14, fontWeight:800, padding:"0 14px", whiteSpace:"nowrap" };

export default function LotsPage() {
  const { user, ready } = useAdminAuth("lot");
  const [lots, setLots] = useState([]);
  const [products, setProducts] = useState([]);
  const [viewMode, setViewMode] = useState("table");
  const [search, setSearch] = useState("");
  const [msg, setMsg] = useState("");

  async function load() {
    try {
      const [lotsRes, prodRes] = await Promise.all([
        fetch(API_URL, { headers: authHeaders() }),
        fetch(PRODUCTS_URL, { headers: authHeaders() }),
      ]);
      const lotsData = await lotsRes.json();
      const prodData = await prodRes.json();
      setLots(Array.isArray(lotsData) ? lotsData : []);
      setProducts(Array.isArray(prodData) ? prodData : []);
    } catch(e) { setMsg(e.message); }
  }
  useEffect(() => { if (ready && user) load(); }, [ready, user]);

  const filtered = useMemo(() => {
    const q = (search||"").toLowerCase();
    if (!q) return lots;
    return lots.filter(l => [l.lot_number, l.product_name, l.factory_name].join(" ").toLowerCase().includes(q));
  }, [lots, search]);

  async function handleDelete(id) {
    if (!confirm("حذف التشغيلة؟")) return;
    await fetch(`${API_URL}/${id}`, { method:"DELETE", headers: authHeaders() });
    load();
  }

  function handleCsv() {
    exportTableCsv("lots.csv", ["ID","رقم التشغيلة","المنتج","الكمية","نوع التتبع","تاريخ الإنتاج","تنبيه","إزالة"], filtered.map(l=>[l.id,l.lot_number,l.product_name||l.product_id,l.quantity,l.tracking,l.production_date,l.alert_date,l.removal_date]));
  }
  function handleXlsx() {
    exportTableXlsx("lots.xlsx", ["ID","رقم التشغيلة","المنتج","الكمية","نوع التتبع","تاريخ الإنتاج","تنبيه","إزالة"], filtered.map(l=>[l.id,l.lot_number,l.product_name||l.product_id,l.quantity,l.tracking,l.production_date,l.alert_date,l.removal_date]));
  }
  function handlePdf() {
    exportTablePdf("التشغيلات والأرقام التسلسلية","Inventory",[{label:"عدد",value:filtered.length}],["ID","رقم التشغيلة","المنتج","الكمية","نوع التتبع","تاريخ الإنتاج","تنبيه","إزالة"], filtered.map(l=>[l.id,l.lot_number,l.product_name||l.product_id,l.quantity,l.tracking,l.production_date,l.alert_date,l.removal_date]));
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">Loading...</div></main>;

  return (
    <main className="erp-shell" dir="rtl"><Sidebar user={user} /><section className="erp-main">
      <div className="erp-hero"><div><div className="erp-hero-pill">Lots / Serial</div><h2>التشغيلات والأرقام التسلسلية</h2></div>
        <div className="erp-stat-panel">
          <div className="erp-stat-box"><div className="erp-stat-box-label">إجمالي التشغيلات</div><div className="erp-stat-box-value">{lots.length}</div></div>
        </div>
      </div>
      {msg && <div className="erp-form-message">{msg}</div>}
      <div className="erp-section-card">
        <div style={{display:"flex", gap:8, marginBottom:12, flexWrap:"wrap"}}>
          <input className="erp-input" style={{maxWidth:300}} placeholder="بحث..." value={search} onChange={e=>setSearch(e.target.value)} />
          <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={{minHeight:38,borderRadius:12,padding:"0 14px",fontWeight:800}}>Kanban</button>
          <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={{minHeight:38,borderRadius:12,padding:"0 14px",fontWeight:800}}>جدول</button>
          <button className="erp-btn-secondary" onClick={handleCsv} style={btStyle}>CSV</button>
          <button className="erp-btn-secondary" onClick={handleXlsx} style={btStyle}>Excel</button>
          <button className="erp-btn-primary" onClick={handlePdf} style={btStyle}>PDF</button>
        </div>
        {viewMode==="table" && (
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead><tr><th>#</th><th>المصنع</th><th>المنتج</th><th>رقم التشغيلة</th><th>النوع</th><th>الكمية</th><th>تاريخ الإنتاج</th><th>تاريخ الصلاحية</th><th>تنبيه</th><th>إزالة</th><th>إجراءات</th></tr></thead>
              <tbody>
                {filtered.map(item => (
                  <tr key={item.id}><td>{item.id}</td><td>{item.factory_name||"-"}</td><td>{item.product_name||"-"}</td><td>{item.lot_number}</td><td>{item.tracking}</td><td>{item.quantity}</td><td>{item.production_date||"-"}</td><td>{item.expiration_date||"-"}</td><td>{item.alert_date||"-"}</td><td>{item.removal_date||"-"}</td><td><button className="erp-btn-danger" onClick={()=>handleDelete(item.id)}>حذف</button></td></tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {viewMode==="kanban" && (
          <KanbanBoard items={filtered} statusField="is_active" statusOptions={[true,false]} statusLabels={{true:"نشط",false:"غير نشط"}} statusColors={{true:"#10b981",false:"#6b7280"}} renderCard={item => <div><div style={{fontWeight:900}}>{item.lot_number}</div><div>{item.product_name}</div><div>الكمية: {item.quantity}</div><div>تنبيه: {item.alert_date||"-"}</div><div>إزالة: {item.removal_date||"-"}</div></div>} onAction={item => <button className="erp-btn-danger" onClick={()=>handleDelete(item.id)}>حذف</button>} emptyMessage="لا توجد تشغيلات" />
        )}
      </div>
    </section></main>
  );
}
