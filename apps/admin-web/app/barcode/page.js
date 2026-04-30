"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const PRODUCTS_URL = "https://api.royalpalace-group.com/api/v1/admin/barcode/products";

export default function BarcodePage() {
  const { user, ready } = useAdminAuth("barcode");
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [barcode, setBarcode] = useState("");
  const [useSerial, setUseSerial] = useState(false);

  async function loadAll() {
    try {
      const res = await fetch(PRODUCTS_URL, { headers: authHeaders() });
      setProducts(res.ok ? await res.json() : []);
    } catch (err) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  function startEdit(p) {
    setEditingId(p.id);
    setBarcode(p.barcode || "");
    setUseSerial(p.use_serial_number || false);
  }

  async function handleSave() {
    if (!editingId) return;
    try {
      const res = await fetch(`${PRODUCTS_URL}/${editingId}/barcode`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ barcode, use_serial_number: useSerial }),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الحفظ");
      setEditingId(null);
      loadAll();
    } catch (err) { setMessage(err.message); }
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Barcode</div><h2>الباركود</h2><p>إدارة الباركود والأرقام التسلسلية للمنتجات.</p></div></section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card">
          <div className="erp-section-head"><h3>المنتجات ذات الباركود</h3></div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr><th>ID</th><th>المنتج</th><th>SKU</th><th>Barcode</th><th>متسلسل</th><th>إجراءات</th></tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr><td colSpan="6">لا توجد منتجات بباركود.</td></tr>
                ) : (
                  products.map((p) => (
                    <tr key={p.id}>
                      <td>{p.id}</td>
                      <td>{p.name_ar}</td>
                      <td>{p.sku || "-"}</td>
                      <td>{p.barcode || "-"}</td>
                      <td>{p.use_serial_number ? "نعم" : "لا"}</td>
                      <td><button className="erp-btn-secondary" onClick={() => startEdit(p)}>تعديل</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {editingId ? (
            <div className="erp-section-card" style={{ marginTop:"16px" }}>
              <h3>تعديل الباركود للمنتج #{editingId}</h3>
              <div className="erp-form-grid erp-form-grid-2">
                <div><label className="erp-label">Barcode</label><input className="erp-input" value={barcode} onChange={(e) => setBarcode(e.target.value)} /></div>
                <div><label className="erp-label">متسلسل</label><input type="checkbox" checked={useSerial} onChange={(e) => setUseSerial(e.target.checked)} /></div>
              </div>
              <div className="erp-form-actions"><button className="erp-btn-primary" onClick={handleSave}>حفظ التعديل</button></div>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
