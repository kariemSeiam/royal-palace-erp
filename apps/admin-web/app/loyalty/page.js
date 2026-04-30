"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const COUPONS_URL = "https://api.royalpalace-group.com/api/v1/admin/loyalty/coupons";
const CARDS_URL = "https://api.royalpalace-group.com/api/v1/admin/loyalty/cards";

export default function LoyaltyPage() {
  const { user, ready } = useAdminAuth("loyalty");
  const [coupons, setCoupons] = useState([]);
  const [cards, setCards] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ code:"", discount_percent:"", discount_amount:"", valid_from:"", valid_to:"" });
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    try {
      const [couponRes, cardRes] = await Promise.all([
        fetch(COUPONS_URL, { headers: authHeaders() }),
        fetch(CARDS_URL, { headers: authHeaders() }),
      ]);
      setCoupons(couponRes.ok ? await couponRes.json() : []);
      setCards(cardRes.ok ? await cardRes.json() : []);
    } catch (err) { setMessage("تعذر التحميل"); }
  }

  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);

  async function handleCreate(e) {
    e.preventDefault(); setSubmitting(true);
    try {
      const payload = { ...form, discount_percent: form.discount_percent ? Number(form.discount_percent) : null, discount_amount: form.discount_amount ? Number(form.discount_amount) : null };
      const res = await fetch(COUPONS_URL, { method:"POST", headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء");
      setForm({ code:"", discount_percent:"", discount_amount:"", valid_from:"", valid_to:"" });
      loadAll();
    } catch (err) { setMessage(err.message); } finally { setSubmitting(false); }
  }

  async function deleteCoupon(id) { if (!confirm("حذف الكوبون؟")) return; await fetch(`${COUPONS_URL}/${id}`,{method:"DELETE",headers:authHeaders()}); loadAll(); }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Loyalty</div><h2>الولاء والخصومات</h2><p>إدارة كوبونات الخصم وبطاقات الولاء.</p></div></section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card" style={{ marginBottom:"18px" }}>
          <div className="erp-section-head"><h3>كوبون خصم جديد</h3></div>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleCreate}>
            <input className="erp-input" placeholder="كود الكوبون" value={form.code} onChange={(e)=>setForm({...form,code:e.target.value})} required />
            <input className="erp-input" type="number" step="0.01" placeholder="نسبة الخصم %" value={form.discount_percent} onChange={(e)=>setForm({...form,discount_percent:e.target.value})} />
            <input className="erp-input" type="number" step="0.01" placeholder="مبلغ الخصم" value={form.discount_amount} onChange={(e)=>setForm({...form,discount_amount:e.target.value})} />
            <input className="erp-input" type="datetime-local" value={form.valid_from} onChange={(e)=>setForm({...form,valid_from:e.target.value})} />
            <input className="erp-input" type="datetime-local" value={form.valid_to} onChange={(e)=>setForm({...form,valid_to:e.target.value})} />
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":"إنشاء الكوبون"}</button></div>
          </form>
        </div>
        
        <div className="erp-form-grid erp-form-grid-2">
          <div className="erp-section-card">
            <h3>الكوبونات</h3>
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead>
                  <tr><th>ID</th><th>الكود</th><th>الخصم %</th><th>المبلغ</th><th>المستخدم</th><th>إجراءات</th></tr>
                </thead>
                <tbody>
                  {coupons.length===0?<tr><td colSpan="6">لا توجد كوبونات.</td></tr>:coupons.map((c)=>(
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td>{c.code}</td>
                      <td>{c.discount_percent||"-"}</td>
                      <td>{c.discount_amount||"-"}</td>
                      <td>{c.used_count||0}</td>
                      <td><button className="erp-btn-danger" onClick={()=>deleteCoupon(c.id)}>حذف</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <div className="erp-section-card">
            <h3>بطاقات الولاء</h3>
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead>
                  <tr><th>ID</th><th>العميل</th><th>النقاط</th><th>المستوى</th></tr>
                </thead>
                <tbody>
                  {cards.length===0?<tr><td colSpan="4">لا توجد بطاقات.</td></tr>:cards.map((c)=>(
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td>{c.customer_id||"-"}</td>
                      <td>{c.points}</td>
                      <td>{c.tier}</td>
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
