"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const CARRIERS_URL = "https://api.royalpalace-group.com/api/v1/admin/delivery/carriers";
const RATES_URL = "https://api.royalpalace-group.com/api/v1/admin/delivery/rates";

export default function DeliveryPage() {
  const { user, ready } = useAdminAuth("delivery");
  const [carriers, setCarriers] = useState([]);
  const [rates, setRates] = useState([]);
  const [message, setMessage] = useState("");
  const [carrierForm, setCarrierForm] = useState({ name:"", code:"", tracking_url_prefix:"" });
  const [rateForm, setRateForm] = useState({ carrier_id:"", name:"", price:"" });
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    try {
      const [carrierRes, rateRes] = await Promise.all([
        fetch(CARRIERS_URL, { headers: authHeaders() }),
        fetch(RATES_URL, { headers: authHeaders() }),
      ]);
      setCarriers(carrierRes.ok ? await carrierRes.json() : []);
      setRates(rateRes.ok ? await rateRes.json() : []);
    } catch (err) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  async function handleCreateCarrier(e) {
    e.preventDefault(); setSubmitting(true);
    try {
      const res = await fetch(CARRIERS_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(carrierForm) });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء");
      setCarrierForm({ name:"", code:"", tracking_url_prefix:"" });
      loadAll();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function handleCreateRate(e) {
    e.preventDefault(); setSubmitting(true);
    try {
      const payload = { ...rateForm, carrier_id: Number(rateForm.carrier_id), price: Number(rateForm.price) };
      const res = await fetch(RATES_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء");
      setRateForm({ carrier_id:"", name:"", price:"" });
      loadAll();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function deleteCarrier(id) {
    if (!confirm("حذف الناقل؟")) return;
    await fetch(`${CARRIERS_URL}/${id}`, { method:"DELETE", headers:authHeaders() });
    loadAll();
  }

  async function deleteRate(id) {
    if (!confirm("حذف التعريفة؟")) return;
    await fetch(`${RATES_URL}/${id}`, { method:"DELETE", headers:authHeaders() });
    loadAll();
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  // دالة مساعدة لعرض اسم الناقل
  const getCarrierName = (carrierId) => {
    const carrier = carriers.find(c => c.id === carrierId);
    return carrier ? carrier.name : "-";
  };

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">Delivery</div><h2>الشحن والتوصيل</h2><p>إدارة شركات الشحن والتعريفات.</p></div>
        </section>

        {message && <div className="erp-form-message">{message}</div>}

        <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom: "18px" }}>
          <div className="erp-section-card">
            <h3>شركة شحن جديدة</h3>
            <form className="erp-form-grid" onSubmit={handleCreateCarrier}>
              <input className="erp-input" placeholder="اسم الشركة" value={carrierForm.name} onChange={(e) => setCarrierForm({ ...carrierForm, name: e.target.value })} required />
              <input className="erp-input" placeholder="الكود" value={carrierForm.code} onChange={(e) => setCarrierForm({ ...carrierForm, code: e.target.value })} required />
              <input className="erp-input" placeholder="رابط التتبع" value={carrierForm.tracking_url_prefix} onChange={(e) => setCarrierForm({ ...carrierForm, tracking_url_prefix: e.target.value })} />
              <div className="erp-form-actions">
                <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : "إضافة"}</button>
              </div>
            </form>
          </div>
          <div className="erp-section-card">
            <h3>تعريفة شحن جديدة</h3>
            <form className="erp-form-grid" onSubmit={handleCreateRate}>
              <select className="erp-input" value={rateForm.carrier_id} onChange={(e) => setRateForm({ ...rateForm, carrier_id: e.target.value })} required>
                <option value="">اختر الناقل</option>
                {carriers.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
              <input className="erp-input" placeholder="اسم التعريفة" value={rateForm.name} onChange={(e) => setRateForm({ ...rateForm, name: e.target.value })} required />
              <input className="erp-input" type="number" step="0.01" placeholder="السعر" value={rateForm.price} onChange={(e) => setRateForm({ ...rateForm, price: e.target.value })} />
              <div className="erp-form-actions">
                <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : "إضافة"}</button>
              </div>
            </form>
          </div>
        </div>

        <div className="erp-form-grid erp-form-grid-2">
          <div className="erp-section-card">
            <h3>شركات الشحن</h3>
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead>
                  <tr><th>ID</th><th>الاسم</th><th>الكود</th><th>التتبع</th><th>إجراءات</th></tr>
                </thead>
                <tbody>
                  {carriers.length === 0 && (
                    <tr><td colSpan="5">لا توجد شركات.</td></tr>
                  )}
                  {carriers.map((c) => (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td>{c.name}</td>
                      <td>{c.code}</td>
                      <td>{c.tracking_url_prefix || "-"}</td>
                      <td><button className="erp-btn-danger" onClick={() => deleteCarrier(c.id)}>حذف</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="erp-section-card">
            <h3>تعريفات الشحن</h3>
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead>
                  <tr><th>ID</th><th>الناقل</th><th>الاسم</th><th>السعر</th><th>إجراءات</th></tr>
                </thead>
                <tbody>
                  {rates.length === 0 && (
                    <tr><td colSpan="5">لا توجد تعريفات.</td></tr>
                  )}
                  {rates.map((r) => (
                    <tr key={r.id}>
                      <td>{r.id}</td>
                      <td>{getCarrierName(r.carrier_id)}</td>
                      <td>{r.name}</td>
                      <td>{r.price}</td>
                      <td><button className="erp-btn-danger" onClick={() => deleteRate(r.id)}>حذف</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
