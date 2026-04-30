"use client";

import { useEffect, useState } from "react";
import {
  createCustomerAddress,
  deleteCustomerAddress,
  getCustomerAddresses,
  updateCustomerAddress,
} from "@/lib/account-api";

type Address = {
  id: string | number;
  label?: string | null;
  full_name?: string | null;
  phone?: string | null;
  city?: string | null;
  area?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  postal_code?: string | null;
  is_default?: boolean;
};

type Props = {
  initialItems: Address[];
};

const emptyForm = {
  label: "",
  full_name: "",
  phone: "",
  city: "",
  area: "",
  address_line_1: "",
  address_line_2: "",
  postal_code: "",
  is_default: false,
};

export default function AddressesManager({ initialItems }: Props) {
  const [items, setItems] = useState<Address[]>(initialItems || []);
  const [editingId, setEditingId] = useState<string | number | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [loading, setLoading] = useState(false);
  const [bootLoading, setBootLoading] = useState(initialItems.length === 0);
  const [message, setMessage] = useState<string | null>(null);

  async function loadAddresses() {
    setBootLoading(true);
    const result = await getCustomerAddresses();
    setItems(result.data || []);
    setBootLoading(false);
  }

  useEffect(() => {
    if (initialItems.length === 0) {
      loadAddresses();
    }
  }, [initialItems.length]);

  function resetForm() {
    setForm(emptyForm);
    setEditingId(null);
  }

  function fillForm(item: Address) {
    setEditingId(item.id);
    setForm({
      label: item.label || "",
      full_name: item.full_name || "",
      phone: item.phone || "",
      city: item.city || "",
      area: item.area || "",
      address_line_1: item.address_line_1 || "",
      address_line_2: item.address_line_2 || "",
      postal_code: item.postal_code || "",
      is_default: !!item.is_default,
    });
  }

  async function saveAddress(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);

    const result = editingId
      ? await updateCustomerAddress(editingId, form)
      : await createCustomerAddress(form);

    if (result.ok) {
      setMessage(editingId ? "تم تحديث العنوان بنجاح" : "تم إضافة العنوان بنجاح");
      resetForm();
      await loadAddresses();
    } else {
      setMessage(result.error || "تعذر حفظ العنوان");
    }

    setLoading(false);
  }

  async function removeAddress(id: string | number) {
    const confirmed = window.confirm("هل تريد حذف هذا العنوان؟");
    if (!confirmed) return;

    const result = await deleteCustomerAddress(id);

    if (result.ok) {
      setMessage("تم حذف العنوان بنجاح");
      await loadAddresses();
    } else {
      setMessage(result.error || "تعذر حذف العنوان");
    }
  }

  return (
    <div className="space-y-8">
      <form onSubmit={saveAddress} className="space-y-4 rounded-[28px] border border-slate-200 p-5">
        <h2 className="text-xl font-bold text-royal-navy">
          {editingId ? "تعديل العنوان" : "إضافة عنوان جديد"}
        </h2>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <input
            placeholder="اسم العنوان (مثال: المنزل)"
            value={form.label}
            onChange={(e) => setForm({ ...form, label: e.target.value })}
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none"
          />
          <input
            placeholder="الاسم الكامل"
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none"
          />
          <input
            placeholder="رقم الهاتف"
            value={form.phone}
            onChange={(e) => setForm({ ...form, phone: e.target.value })}
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none"
          />
          <input
            placeholder="المدينة"
            value={form.city}
            onChange={(e) => setForm({ ...form, city: e.target.value })}
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none"
          />
          <input
            placeholder="المنطقة"
            value={form.area}
            onChange={(e) => setForm({ ...form, area: e.target.value })}
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none"
          />
          <input
            placeholder="الرمز البريدي"
            value={form.postal_code}
            onChange={(e) => setForm({ ...form, postal_code: e.target.value })}
            className="rounded-2xl border border-slate-200 px-4 py-3 outline-none"
          />
        </div>

        <input
          placeholder="العنوان الأساسي"
          value={form.address_line_1}
          onChange={(e) => setForm({ ...form, address_line_1: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
        />

        <input
          placeholder="العنوان التفصيلي"
          value={form.address_line_2}
          onChange={(e) => setForm({ ...form, address_line_2: e.target.value })}
          className="w-full rounded-2xl border border-slate-200 px-4 py-3 outline-none"
        />

        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            checked={form.is_default}
            onChange={(e) => setForm({ ...form, is_default: e.target.checked })}
          />
          اجعله العنوان الافتراضي
        </label>

        {message ? (
          <div className="rounded-2xl bg-slate-100 px-4 py-3 text-sm text-slate-700">
            {message}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            disabled={loading}
            className="rounded-full bg-royal-navy px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {loading ? "جارٍ الحفظ..." : editingId ? "حفظ التعديل" : "إضافة العنوان"}
          </button>

          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-full border border-slate-300 px-5 py-3 text-sm font-semibold text-slate-700"
            >
              إلغاء
            </button>
          ) : null}
        </div>
      </form>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-royal-navy">العناوين المحفوظة</h2>

        {bootLoading ? (
          <div className="text-sm text-slate-500">جارٍ تحميل العناوين...</div>
        ) : items.length === 0 ? (
          <div className="rounded-[28px] border border-dashed border-slate-300 p-6 text-sm text-slate-500">
            لا توجد عناوين محفوظة حتى الآن.
          </div>
        ) : (
          items.map((item) => (
            <div
              key={item.id}
              className="rounded-[28px] border border-slate-200 p-5"
            >
              <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-royal-navy">
                    {item.label || "عنوان"}
                    {item.is_default ? (
                      <span className="mr-2 rounded-full bg-royal-navy px-2 py-1 text-xs text-white">
                        افتراضي
                      </span>
                    ) : null}
                  </h3>
                  <p className="text-sm text-slate-600">
                    {[item.full_name, item.phone].filter(Boolean).join(" - ")}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => fillForm(item)}
                    className="rounded-full border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700"
                  >
                    تعديل
                  </button>
                  <button
                    type="button"
                    onClick={() => removeAddress(item.id)}
                    className="rounded-full border border-red-300 px-4 py-2 text-sm font-medium text-red-600"
                  >
                    حذف
                  </button>
                </div>
              </div>

              <p className="text-sm leading-7 text-slate-700">
                {[
                  item.city,
                  item.area,
                  item.address_line_1,
                  item.address_line_2,
                  item.postal_code,
                ]
                  .filter(Boolean)
                  .join(" • ")}
              </p>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
