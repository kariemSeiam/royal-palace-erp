"use client";
import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";

const LOC_URL = "https://api.royalpalace-group.com/api/v1/admin/advanced-inventory/locations";
const PICK_URL = "https://api.royalpalace-group.com/api/v1/admin/advanced-inventory/pickings";
const MOVES_URL = "https://api.royalpalace-group.com/api/v1/admin/advanced-inventory/moves";
const QUANTS_URL = "https://api.royalpalace-group.com/api/v1/admin/advanced-inventory/quants";

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

export default function AdvancedInventoryPage() {
  const { user, ready } = useAdminAuth("inventory");
  const [locations, setLocations] = useState([]);
  const [pickings, setPickings] = useState([]);
  const [moves, setMoves] = useState([]);
  const [quants, setQuants] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  async function loadAll() {
    try {
      const [locRes, pickRes, moveRes, quantRes] = await Promise.all([
        fetch(LOC_URL, { headers: authHeaders() }),
        fetch(PICK_URL, { headers: authHeaders() }),
        fetch(MOVES_URL, { headers: authHeaders() }),
        fetch(QUANTS_URL, { headers: authHeaders() }),
      ]);
      setLocations(locRes.ok ? await locRes.json() : []);
      setPickings(pickRes.ok ? await pickRes.json() : []);
      setMoves(moveRes.ok ? await moveRes.json() : []);
      setQuants(quantRes.ok ? await quantRes.json() : []);
    } catch (err) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  const filteredLocations = useMemo(() => {
    const q = search.toLowerCase();
    if (!q) return locations;
    return locations.filter((l) => [l.name, l.code].join(" ").toLowerCase().includes(q));
  }, [locations, search]);

  function handleExportCsv() {
    exportTableCsv("locations_export.csv", ["الاسم","الكود","النوع","المصنع"], filteredLocations.map((l) => [l.name, l.code, l.location_type, l.factory_id || ""]));
  }
  function handleExportPdf() {
    exportTablePdf("تقرير المواقع", "المخزون المتقدم", [{ label: "عدد المواقع", value: locations.length }], ["الاسم","الكود","النوع","المصنع"], filteredLocations.map((l) => [l.name, l.code, l.location_type, l.factory_id || ""]));
  }


  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">Advanced Inventory</div><h2>المخزون المتقدم</h2><p>إدارة المواقع والتحويلات والكميات والأرصدة.</p></div>
          <div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">مواقع</div><div className="erp-stat-box-value">{locations.length}</div></div><div className="erp-stat-box"><div className="erp-stat-box-label">تحويلات</div><div className="erp-stat-box-value">{pickings.length}</div></div></div>
        </section>
        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">مواقع</div><div className="erp-card-value">{locations.length}</div></div>
          <div className="erp-card"><div className="erp-card-title">تحويلات</div><div className="erp-card-value">{pickings.length}</div></div>
          <div className="erp-card"><div className="erp-card-title">حركات</div><div className="erp-card-value">{moves.length}</div></div>
          <div className="erp-card"><div className="erp-card-title">أرصدة</div><div className="erp-card-value">{quants.length}</div></div>
        </section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head">
            <h3>المواقع</h3>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}><input className="erp-input" placeholder="بحث..." value={search} onChange={(e) => setSearch(e.target.value)} /><button className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button><button className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button></div>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead><tr><th>ID</th><th>الاسم</th><th>الكود</th><th>النوع</th><th>المصنع</th></tr></thead>
              <tbody>{filteredLocations.length === 0 ? <tr><td colSpan="5">لا توجد مواقع.</td></tr> : filteredLocations.map((l) => (<tr key={l.id}><td>{l.id}</td><td>{l.name}</td><td>{l.code}</td><td>{l.location_type}</td><td>{l.factory_id || "-"}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
        <div className="erp-section-card">
          <div className="erp-section-head"><h3>التحويلات الأخيرة</h3></div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead><tr><th>ID</th><th>الحالة</th><th>من موقع</th><th>إلى موقع</th><th>التاريخ</th></tr></thead>
              <tbody>{pickings.length === 0 ? <tr><td colSpan="5">لا توجد تحويلات.</td></tr> : pickings.slice(0,20).map((p) => (<tr key={p.id}><td>{p.id}</td><td>{p.state}</td><td>{p.location_id}</td><td>{p.location_dest_id}</td><td>{p.scheduled_date || "-"}</td></tr>))}</tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
