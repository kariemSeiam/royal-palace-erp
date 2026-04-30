"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { useCart } from "@/components/cart-provider";
import { createOrder } from "@/lib/orders-api";
import { getAccountMe } from "@/lib/account-api";
import { getStoredAccessToken } from "@/lib/auth-storage";

const REDIRECT_KEY = "royal_palace_post_login_redirect";

function formatPrice(value?: number | null) {
  return `EGP ${Number(value || 0)}`;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { items, subtotal, clearCart } = useCart();

  const [authReady, setAuthReady] = useState(false);
  const [profileLoading, setProfileLoading] = useState(true);

  const [form, setForm] = useState({
    full_name: "",
    phone: "",
    email: "",
    city: "",
    governorate: "",
    address: "",
    notes: "",
    shipping_method: "standard",
    payment_method: "cash_on_delivery",
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [profileNotice, setProfileNotice] = useState("");

  const total = Number(subtotal || 0);

  const canSubmit = useMemo(() => {
    return Boolean(
      items.length > 0 &&
        form.full_name.trim() &&
        form.phone.trim() &&
        form.address.trim() &&
        form.city.trim() &&
        form.governorate.trim()
    );
  }, [items.length, form]);

  useEffect(() => {
    async function loadProfile() {
      try {
        const token = getStoredAccessToken();

        if (!token) {
          if (typeof window !== "undefined") {
            window.sessionStorage.setItem(REDIRECT_KEY, "/checkout");
          }
          router.replace("/login?next=/checkout");
          return;
        }

        const profile = await getAccountMe(token);

        setForm({
          full_name: profile?.full_name || "",
          phone: profile?.phone || "",
          email: profile?.email || "",
          city: profile?.city || "",
          governorate: profile?.governorate || "",
          address: profile?.address_line || profile?.address || "",
          notes: profile?.address_notes || "",
          shipping_method: "standard",
          payment_method: "cash_on_delivery",
        });

        setAuthReady(true);

        if (profile?.address_line || profile?.address) {
          setProfileNotice("تم تحميل بيانات العميل والعنوان الافتراضي من الحساب.");
        } else {
          setProfileNotice("يرجى استكمال بيانات العنوان قبل إنشاء الطلب.");
        }
      } catch (err: any) {
        const message = String(err?.message || "");
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(REDIRECT_KEY, "/checkout");
        }

        if (message === "AUTH_REQUIRED") {
          router.replace("/login?next=/checkout");
          return;
        }

        setError(err?.message || "تعذر تحميل بيانات الحساب لصفحة الدفع.");
      } finally {
        setProfileLoading(false);
      }
    }

    loadProfile();
  }, [router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!canSubmit) {
      setError("يرجى استكمال بيانات العميل والعنوان قبل إنشاء الطلب.");
      return;
    }

    try {
      setLoading(true);

      const result = await createOrder({
        customer_name: form.full_name,
        customer_phone: form.phone,
        shipping_address: [form.governorate, form.city, form.address]
          .filter(Boolean)
          .join(" - "),
        notes: form.notes,
        items: items.map((item) => ({
          product_id: item.id,
          quantity: item.quantity,
        })),
      });

      clearCart();

      const target = result?.order_number
        ? `/checkout/success?order_number=${encodeURIComponent(result.order_number)}`
        : "/checkout/success";

      router.push(target);
    } catch (err: any) {
      setError(err?.message || "تعذر الوصول إلى خدمة الطلبات الحالية.");
    } finally {
      setLoading(false);
    }
  }

  if (profileLoading || !authReady) {
    return (
      <>
        <StoreHeader />
        <main className="container-royal py-16">
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <p className="text-slate-600">جارٍ تجهيز صفحة الدفع...</p>
          </div>
        </main>
        <StoreFooter />
      </>
    );
  }

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 md:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">إتمام الطلب</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
              إتمام الطلب متاح للعملاء المسجلين، وتم تعبئة بياناتك تلقائيًا من الحساب
              لتجربة أسرع وأكثر تنظيمًا.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/account"
              className="rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
            >
              تعديل بياناتي
            </Link>
            <Link
              href="/cart"
              className="rounded-full bg-royal-navy px-5 py-3 text-sm font-bold text-white"
            >
              الرجوع إلى السلة
            </Link>
          </div>
        </div>

        {profileNotice ? (
          <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
            {profileNotice}
          </div>
        ) : null}

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
            {error}
          </div>
        ) : null}

        {items.length === 0 ? (
          <div className="rounded-[28px] border border-[#eadfcb] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">لا توجد منتجات في السلة</h2>
            <p className="mb-6 text-sm leading-8 text-slate-600">
              أضف منتجات أولًا قبل الانتقال إلى صفحة إتمام الطلب.
            </p>
            <Link
              href="/catalog"
              className="inline-flex rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
            >
              العودة إلى المنتجات
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 grid gap-4 md:grid-cols-3">
              <div className="rounded-[24px] bg-white p-5 shadow-soft">
                <p className="text-sm text-slate-500">عدد البنود</p>
                <p className="mt-2 text-3xl font-extrabold text-royal-navy">{items.length}</p>
              </div>

              <div className="rounded-[24px] bg-white p-5 shadow-soft">
                <p className="text-sm text-slate-500">الإجمالي</p>
                <p className="mt-2 text-3xl font-extrabold text-royal-navy">{formatPrice(subtotal)}</p>
              </div>

              <div className="rounded-[24px] bg-white p-5 shadow-soft">
                <p className="text-sm text-slate-500">الإجمالي النهائي</p>
                <p className="mt-2 text-3xl font-extrabold text-royal-gold">{formatPrice(total)}</p>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
              <div className="space-y-6">
                <section className="rounded-[28px] bg-white p-6 shadow-soft">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-royal-gold/10 text-sm font-bold text-royal-gold">
                      1
                    </span>
                    <h2 className="text-xl font-bold text-royal-navy">بيانات العميل</h2>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      value={form.full_name}
                      onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                      placeholder="الاسم الكامل"
                      className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
                    />
                    <input
                      value={form.phone}
                      onChange={(e) => setForm({ ...form, phone: e.target.value })}
                      placeholder="رقم الهاتف"
                      className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
                    />
                    <input
                      value={form.email}
                      onChange={(e) => setForm({ ...form, email: e.target.value })}
                      placeholder="البريد الإلكتروني"
                      className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold md:col-span-2"
                    />
                  </div>
                </section>

                <section className="rounded-[28px] bg-white p-6 shadow-soft">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-royal-gold/10 text-sm font-bold text-royal-gold">
                      2
                    </span>
                    <h2 className="text-xl font-bold text-royal-navy">بيانات الشحن</h2>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <input
                      value={form.city}
                      onChange={(e) => setForm({ ...form, city: e.target.value })}
                      placeholder="المدينة"
                      className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
                    />
                    <input
                      value={form.governorate}
                      onChange={(e) => setForm({ ...form, governorate: e.target.value })}
                      placeholder="المحافظة"
                      className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
                    />
                    <textarea
                      value={form.address}
                      onChange={(e) => setForm({ ...form, address: e.target.value })}
                      placeholder="العنوان التفصيلي"
                      rows={4}
                      className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold md:col-span-2"
                    />
                  </div>
                </section>

                <section className="rounded-[28px] bg-white p-6 shadow-soft">
                  <div className="mb-5 flex items-center gap-3">
                    <span className="flex h-8 w-8 items-center justify-center rounded-full bg-royal-gold/10 text-sm font-bold text-royal-gold">
                      3
                    </span>
                    <h2 className="text-xl font-bold text-royal-navy">الشحن والدفع</h2>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <select
                      value={form.shipping_method}
                      onChange={(e) => setForm({ ...form, shipping_method: e.target.value })}
                      className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
                    >
                      <option value="standard">شحن قياسي</option>
                      <option value="express">شحن سريع</option>
                    </select>

                    <select
                      value={form.payment_method}
                      onChange={(e) => setForm({ ...form, payment_method: e.target.value })}
                      className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
                    >
                      <option value="cash_on_delivery">الدفع عند الاستلام</option>
                      <option value="bank_transfer">تحويل بنكي</option>
                    </select>

                    <textarea
                      value={form.notes}
                      onChange={(e) => setForm({ ...form, notes: e.target.value })}
                      placeholder="ملاحظات إضافية"
                      rows={4}
                      className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold md:col-span-2"
                    />
                  </div>
                </section>
              </div>

              <aside className="h-fit rounded-[28px] bg-white p-6 shadow-soft lg:sticky lg:top-28">
                <h2 className="mb-5 text-2xl font-bold text-royal-navy">ملخص الطلب</h2>

                <div className="mb-5 rounded-2xl border border-[#eadfcb] bg-[#fcfaf6] p-4">
                  <p className="mb-2 text-xs font-semibold text-slate-500">عنوان الشحن الحالي</p>
                  <p className="text-sm leading-7 text-slate-700">
                    {[form.governorate, form.city, form.address].filter(Boolean).join(" - ") || "-"}
                  </p>
                </div>

                <div className="space-y-4 border-b border-slate-100 pb-6">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="font-bold text-royal-navy">{item.name}</p>
                        <p className="mt-1 text-xs text-slate-500">الكمية: {item.quantity}</p>
                      </div>
                      <span className="shrink-0 text-sm font-bold text-slate-700">
                        {formatPrice((item.price || 0) * item.quantity)}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="space-y-4 py-6">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500">الإجمالي</span>
                    <span className="font-bold text-royal-navy">{formatPrice(subtotal)}</span>
                  </div>
                </div>

                <div className="flex items-center justify-between border-t border-slate-100 pt-6">
                  <span className="text-base font-bold text-slate-600">الإجمالي النهائي</span>
                  <span className="text-2xl font-extrabold text-royal-gold">{formatPrice(total)}</span>
                </div>

                <button
                  type="submit"
                  disabled={loading || !canSubmit}
                  className="mt-6 flex w-full items-center justify-center rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
                >
                  {loading ? "جارٍ إنشاء الطلب..." : "تأكيد وإنشاء الطلب"}
                </button>

                <Link
                  href="/cart"
                  className="mt-3 flex w-full items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700"
                >
                  الرجوع إلى السلة
                </Link>
              </aside>
            </form>
          </>
        )}
      </main>

      <StoreFooter />
    </>
  );
}
