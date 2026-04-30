"use client";
import { useEffect, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";

function resolvePreferredFactoryId(user, factories) {
  if (!Array.isArray(factories) || factories.length === 0) return "";
  const userFactoryId = user?.factory_id || user?.factory?.id || "";
  if (userFactoryId && factories.some((f) => String(f.id) === String(userFactoryId))) return String(userFactoryId);
  return String(factories[0]?.id || "");
}

export default function HrPoliciesPage() {
  const { user, ready } = useAdminAuth("employees");
  const [factories, setFactories] = useState([]);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    factory_id: "",
    standard_work_hours_per_day: 8,
    late_grace_minutes: 15,
    overtime_multiplier: 1.25,
    half_day_deduction_ratio: 0.5,
    absence_deduction_multiplier: 1,
    unpaid_leave_deduction_multiplier: 1,
    late_deduction_enabled: true,
    overtime_enabled: true,
  });

  const lockedFactoryId = !user?.is_superuser && user?.factory_id ? String(user.factory_id) : "";

  async function loadFactories() {
    const factoriesRes = await fetch("https://api.royalpalace-group.com/api/v1/admin/erp/factories", {
      headers: authHeaders(),
      cache: "no-store",
    });
    const safeFactories = factoriesRes.ok ? await factoriesRes.json() : [];
    setFactories(safeFactories);

    const resolvedFactoryId = lockedFactoryId || resolvePreferredFactoryId(user, safeFactories);
    setForm((prev) => ({ ...prev, factory_id: prev.factory_id || resolvedFactoryId }));

    if (resolvedFactoryId) await loadPolicy(resolvedFactoryId);
  }

  async function loadPolicy(factoryId) {
    try {
      const res = await fetch(`https://api.royalpalace-group.com/api/v1/admin/hr/policy?factory_id=${factoryId}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      if (!res.ok) {
        setMessage("تعذر تحميل السياسة الحالية.");
        return;
      }
      const data = await res.json();
      if (!data) return;
      setForm({
        factory_id: String(factoryId),
        standard_work_hours_per_day: Number(data.standard_work_hours_per_day ?? 8),
        late_grace_minutes: Number(data.late_grace_minutes ?? 15),
        overtime_multiplier: Number(data.overtime_multiplier ?? 1.25),
        half_day_deduction_ratio: Number(data.half_day_deduction_ratio ?? 0.5),
        absence_deduction_multiplier: Number(data.absence_deduction_multiplier ?? 1),
        unpaid_leave_deduction_multiplier: Number(data.unpaid_leave_deduction_multiplier ?? 1),
        late_deduction_enabled: Boolean(data.late_deduction_enabled ?? true),
        overtime_enabled: Boolean(data.overtime_enabled ?? true),
      });
    } catch {
      setMessage("تعذر تحميل السياسة الحالية.");
    }
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadFactories().catch(() => setMessage("تعذر تحميل بيانات المصانع."));
  }, [ready, user]);

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const res = await fetch("https://api.royalpalace-group.com/api/v1/admin/hr/policy", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          factory_id: Number(lockedFactoryId || form.factory_id),
          standard_work_hours_per_day: Number(form.standard_work_hours_per_day),
          late_grace_minutes: Number(form.late_grace_minutes),
          overtime_multiplier: Number(form.overtime_multiplier),
          half_day_deduction_ratio: Number(form.half_day_deduction_ratio),
          absence_deduction_multiplier: Number(form.absence_deduction_multiplier),
          unpaid_leave_deduction_multiplier: Number(form.unpaid_leave_deduction_multiplier),
          late_deduction_enabled: Boolean(form.late_deduction_enabled),
          overtime_enabled: Boolean(form.overtime_enabled),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حفظ السياسة");
      setMessage("تم حفظ سياسة الحضور والرواتب بنجاح.");
      await loadPolicy(String(lockedFactoryId || form.factory_id));
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء الحفظ.");
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل سياسة الموارد البشرية...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">الموارد البشرية / السياسات</div>
            <h2>سياسة الحضور والرواتب للمصنع</h2>
            <p>إدارة ساعات العمل القياسية، سماح التأخير، معادلات الخصم، وتفعيل الوقت الإضافي على مستوى المصنع.</p>
          </div>
        </section>

        <div className="erp-form-shell">
          <h3 className="erp-form-title">سياسة الحضور والرواتب</h3>
          <form className="erp-form-grid erp-form-grid-4" onSubmit={handleSubmit}>
            <div>
              <label className="erp-label">المصنع</label>
              <select className="erp-input" value={form.factory_id} disabled={Boolean(lockedFactoryId)} onChange={async (e) => {
                const nextFactoryId = e.target.value;
                setForm((prev) => ({ ...prev, factory_id: nextFactoryId }));
                if (nextFactoryId) await loadPolicy(nextFactoryId);
              }}>
                {factories.map((f) => <option key={f.id} value={f.id}>{f.name}</option>)}
              </select>
            </div>
            <div><label className="erp-label">ساعات العمل اليومية</label><input className="erp-input" type="number" step="0.25" value={form.standard_work_hours_per_day} onChange={(e) => setForm({ ...form, standard_work_hours_per_day: e.target.value })} /></div>
            <div><label className="erp-label">سماح التأخير (دقائق)</label><input className="erp-input" type="number" value={form.late_grace_minutes} onChange={(e) => setForm({ ...form, late_grace_minutes: e.target.value })} /></div>
            <div><label className="erp-label">معامل الوقت الإضافي</label><input className="erp-input" type="number" step="0.05" value={form.overtime_multiplier} onChange={(e) => setForm({ ...form, overtime_multiplier: e.target.value })} /></div>
            <div><label className="erp-label">نسبة خصم نصف يوم</label><input className="erp-input" type="number" step="0.05" value={form.half_day_deduction_ratio} onChange={(e) => setForm({ ...form, half_day_deduction_ratio: e.target.value })} /></div>
            <div><label className="erp-label">معامل خصم الغياب</label><input className="erp-input" type="number" step="0.05" value={form.absence_deduction_multiplier} onChange={(e) => setForm({ ...form, absence_deduction_multiplier: e.target.value })} /></div>
            <div><label className="erp-label">معامل خصم الإجازة غير المدفوعة</label><input className="erp-input" type="number" step="0.05" value={form.unpaid_leave_deduction_multiplier} onChange={(e) => setForm({ ...form, unpaid_leave_deduction_multiplier: e.target.value })} /></div>
            <div><label className="erp-label">خصم التأخير</label><select className="erp-input" value={String(form.late_deduction_enabled)} onChange={(e) => setForm({ ...form, late_deduction_enabled: e.target.value === "true" })}><option value="true">مفعل</option><option value="false">معطل</option></select></div>
            <div><label className="erp-label">الوقت الإضافي</label><select className="erp-input" value={String(form.overtime_enabled)} onChange={(e) => setForm({ ...form, overtime_enabled: e.target.value === "true" })}><option value="true">مفعل</option><option value="false">معطل</option></select></div>
            <div className="erp-form-actions" style={{ gridColumn: "1 / -1" }}>
              <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : "حفظ السياسة"}</button>
            </div>
          </form>
          {message ? <div className="erp-form-message">{message}</div> : null}
        </div>
      </section>
    </main>
  );
}
