"use client";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";
import { exportTableCsv, exportTablePdf } from "../../components/hrExports";

const API = "https://api.royalpalace-group.com/api/v1/admin/mrp/unbuild";

export default function UnbuildPage() {
  const { user, ready } = useAdminAuth("work_orders");
  const [orders, setOrders] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ product_id: "", quantity: "1", bom_id: "", factory_id: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);

  async function load() {
    try {
      const res = await fetch(API, { headers: authHeaders() });
      setOrders(res.ok ? await res.json() : []);
    } catch { setMessage("فشل التحميل"); }
  }

  useEffect(() => { if (ready && user) load(); }, [ready, user]);

  async function handleCreate(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        product_id: Number(form.product_id),
        quantity: parseFloat(form.quantity),
        bom_id: form.bom_id ? Number(form.bom_id) : null,
        factory_id: form.factory_id ? Number(form.factory_id) : null,
        notes: form.notes
      };
      const res = await fetch(API, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload)
      });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل");
      setForm({ product_id: "", quantity: "1", bom_id: "", factory_id: "", notes: "" });
      load();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function deleteOrder(id) {
    if (!confirm("حذف أمر التفكيك؟")) return;
    await fetch(`${API}/${id}`, { method: "DELETE", headers: authHeaders() });
    load();
  }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">تحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">Unbuild Orders</div>
            <h2>أوامر التفكيك</h2>
            <p>تفكيك منتجات نهائية إلى مكوناتها.</p>
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">إجمالي الأوامر</div>
            <div className="erp-card-value">{orders.length}</div>
          </div>
          <div className="erp-card">
            <div className="erp-card-title">مكتملة</div>
            <div className="erp-card-value">{orders.filter(o => o.state === "done").length}</div>
          </div>
        </section>

        {message && <div className="erp-form-message">{message}</div>}

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <h3>أمر تفكيك جديد</h3>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleCreate}>
            <input className="erp-input" type="number" placeholder="معرف المنتج" value={form.product_id} onChange={e => setForm({ ...form, product_id: e.target.value })} required />
            <input className="erp-input" type="number" step="0.001" placeholder="الكمية" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} />
            <input className="erp-input" type="number" placeholder="معرف BOM (اختياري)" value={form.bom_id} onChange={e => setForm({ ...form, bom_id: e.target.value })} />
            <input className="erp-input" type="number" placeholder="معرف المصنع" value={form.factory_id} onChange={e => setForm({ ...form, factory_id: e.target.value })} />
            <textarea className="erp-input" placeholder="ملاحظات" value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })} />
            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "حفظ..." : "إنشاء"}</button>
            </div>
          </form>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <h3>قائمة أوامر التفكيك</h3>
            <div className="flex gap-2">
              <button className="erp-btn-secondary" onClick={() => exportTableCsv("unbuild_orders.csv", ["المنتج", "الكمية", "الحالة"], orders.map(o => [o.product_id, o.quantity, o.state]))}>CSV</button>
              <button className="erp-btn-primary" onClick={() => exportTablePdf("تقرير أوامر التفكيك", "Unbuild", [{ label: "عدد", value: orders.length }], ["المنتج", "الكمية", "الحالة"], orders.map(o => [o.product_id, o.quantity, o.state]))}>PDF</button>
            </div>
          </div>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr><th>ID</th><th>المنتج</th><th>الكمية</th><th>الحالة</th><th>ملاحظات</th><th>إجراءات</th></tr>
              </thead>
              <tbody>
                {orders.length === 0 ? (
                  <tr><td colSpan="6">لا توجد أوامر تفكيك</td></tr>
                ) : (
                  orders.map(o => (
                    <tr key={o.id}>
                      <td>{o.id}</td>
                      <td>{o.product_id}</td>
                      <td>{o.quantity}</td>
                      <td>{o.state}</td>
                      <td>{o.notes || "-"}</td>
                      <td><button className="erp-btn-danger" onClick={() => deleteOrder(o.id)}>حذف</button></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
