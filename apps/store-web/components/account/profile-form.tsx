"use client";

import { useState } from "react";

type Props = {
  initialData: {
    email?: string;
    full_name?: string | null;
    phone?: string | null;
    governorate?: string | null;
    city?: string | null;
    address?: string | null;
    address_line?: string | null;
    address_notes?: string | null;
  };
};

export default function ProfileForm({ initialData }: Props) {
  const [form, setForm] = useState({
    full_name: initialData.full_name || "",
    phone: initialData.phone || "",
    governorate: initialData.governorate || "",
    city: initialData.city || "",
    address: initialData.address || initialData.address_line || "",
    address_notes: initialData.address_notes || "",
  });
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    try {
      const rawApiBase =
        process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
        "https://api.royalpalace-group.com";

      const apiBase = rawApiBase.endsWith("/api/v1")
        ? rawApiBase
        : `${rawApiBase}/api/v1`;

      const token =
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("access_token="))
          ?.split("=")[1] ||
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("token="))
          ?.split("=")[1] ||
        document.cookie
          .split("; ")
          .find((row) => row.startsWith("auth_token="))
          ?.split("=")[1];

      const response = await fetch(`${apiBase}/store/account/me`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${decodeURIComponent(token)}` } : {}),
        },
        body: JSON.stringify(form),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => null);
        throw new Error(payload?.detail || "تعذر تحديث البيانات");
      }

      setMessage("تم تحديث بيانات الملف الشخصي بنجاح");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "حدث خطأ غير متوقع");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            البريد الإلكتروني
          </label>
          <input
            value={initialData.email || ""}
            disabled
            className="w-full rounded-2xl border border-slate-200 bg-slate-100 px-4 py-3 text-slate-500 outline-none"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            الاسم الكامل
          </label>
          <input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            رقم الهاتف
          </label>
          <input
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            المحافظة
          </label>
          <input
            value={form.governorate}
            onChange={(e) => setForm({ ...form, governorate: e.target.value })}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
          />
        </div>

        <div>
          <label className="mb-2 block text-sm font-medium text-slate-700">
            المدينة
          </label>
          <input
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
          />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          العنوان
        </label>
        <textarea
          value={form.address}
          onChange={(e) => setForm({ ...form, address: e.target.value })}
          rows={4}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
        />
      </div>

      <div>
        <label className="mb-2 block text-sm font-medium text-slate-700">
          ملاحظات العنوان
        </label>
        <textarea
          value={form.address_notes}
          onChange={(e) => setForm({ ...form, address_notes: e.target.value })}
          rows={3}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
        />
      </div>

      {message ? (
        <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
          {message}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={loading}
        className="rounded-full bg-royal-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
      >
        {loading ? "جارٍ الحفظ..." : "حفظ التعديلات"}
      </button>
    </form>
  );
}
