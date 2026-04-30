"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { logoutRequest } from "@/lib/auth-api";
import { getAccountMe, updateAccountMe, type StoreAccount } from "@/lib/account-api";
import { getStoredAccessToken } from "@/lib/auth-storage";

const accountTiles = [
  {
    title: "طلباتي",
    desc: "مراجعة الطلبات الحالية والسابقة وتتبع الحالات المرتبطة بالحساب.",
    href: "/account/orders",
  },
  {
    title: "الملف الشخصي",
    desc: "عرض نسخة مخصصة من بياناتك الشخصية والعنوان الافتراضي.",
    href: "/account/profile",
  },
  {
    title: "الكتالوج",
    desc: "العودة إلى المنتجات ومواصلة التصفح داخل المتجر.",
    href: "/catalog",
  },
  {
    title: "إتمام الطلب",
    desc: "الانتقال إلى صفحة الدفع باستخدام بيانات الحساب الحالية.",
    href: "/checkout",
  },
];

type AccountFormState = {
  full_name: string;
  phone: string;
  email: string;
  governorate: string;
  city: string;
  address_line: string;
  address_notes: string;
};

function toFormState(account: Partial<StoreAccount> | null | undefined): AccountFormState {
  return {
    full_name: account?.full_name || "",
    phone: account?.phone || "",
    email: account?.email || "",
    governorate: account?.governorate || "",
    city: account?.city || "",
    address_line: account?.address_line || account?.address || "",
    address_notes: account?.address_notes || "",
  };
}

export default function AccountPage() {
  const [account, setAccount] = useState<StoreAccount | null>(null);
  const [form, setForm] = useState<AccountFormState>(toFormState(null));
  const [loading, setLoading] = useState(true);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedMessage, setSavedMessage] = useState("");
  const [error, setError] = useState("");

  async function loadAccount() {
    setLoading(true);
    setError("");
    setSavedMessage("");

    try {
      const token = getStoredAccessToken();

      if (!token) {
        setNotLoggedIn(true);
        setAccount(null);
        setForm(toFormState(null));
        return;
      }

      const data = await getAccountMe(token);
      setNotLoggedIn(false);
      setAccount(data);
      setForm(toFormState(data));
    } catch (err: any) {
      const message = String(err?.message || "");
      if (message === "AUTH_REQUIRED") {
        setNotLoggedIn(true);
        setAccount(null);
        setForm(toFormState(null));
        return;
      }

      setError(err?.message || "تعذر تحميل بيانات الحساب.");
      setAccount(null);
      setForm(toFormState(null));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccount();
  }, []);

  const profileComplete = useMemo(() => {
    return Boolean(
      form.full_name.trim() &&
        form.phone.trim() &&
        form.email.trim() &&
        form.governorate.trim() &&
        form.city.trim() &&
        form.address_line.trim()
    );
  }, [form]);

  async function handleSaveProfile() {
    setSavedMessage("");
    setError("");

    if (
      !form.full_name.trim() ||
      !form.phone.trim() ||
      !form.email.trim() ||
      !form.governorate.trim() ||
      !form.city.trim() ||
      !form.address_line.trim()
    ) {
      setError("يرجى استكمال الاسم والهاتف والبريد والمحافظة والمدينة والعنوان التفصيلي.");
      return;
    }

    try {
      setSaving(true);

      const updated = await updateAccountMe({
        full_name: form.full_name.trim(),
        phone: form.phone.trim(),
        governorate: form.governorate.trim(),
        city: form.city.trim(),
        address_line: form.address_line.trim(),
        address_notes: form.address_notes.trim(),
      });

      setAccount(updated);
      setForm(toFormState(updated));
      setSavedMessage("تم تحديث بيانات الحساب والعنوان الافتراضي بنجاح.");
    } catch (err: any) {
      setError(err?.message || "تعذر تحديث بيانات الحساب.");
    } finally {
      setSaving(false);
    }
  }

  function resetToLoadedData() {
    setSavedMessage("");
    setError("");
    setForm(toFormState(account));
  }

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 md:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">حسابي</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
              إدارة بيانات الحساب والعنوان الافتراضي والانتقال السريع إلى الطلبات
              والملف الشخصي والشراء داخل تجربة أكثر فخامة وتنظيمًا.
            </p>
          </div>

          {account ? (
            <div className="flex flex-wrap gap-3">
              <Link
                href="/account/orders"
                className="rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
              >
                طلباتي
              </Link>
              <Link
                href="/checkout"
                className="rounded-full bg-royal-navy px-5 py-3 text-sm font-bold text-white"
              >
                إتمام الطلب
              </Link>
            </div>
          ) : null}
        </div>

        {loading ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <p className="text-slate-600">جارٍ تحميل بيانات الحساب...</p>
          </div>
        ) : notLoggedIn ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">أهلًا بك</h2>
            <p className="mb-6 text-sm leading-8 text-slate-600">
              قم بتسجيل الدخول أو إنشاء حساب جديد للوصول إلى الطلبات والملف الشخصي.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/login"
                className="rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
              >
                تسجيل الدخول
              </Link>

              <Link
                href="/register"
                className="rounded-full border border-royal-gold px-6 py-3 text-sm font-bold text-royal-gold"
              >
                إنشاء حساب
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.02fr_.98fr]">
            <div className="space-y-6">
              <section className="rounded-[28px] bg-white p-6 shadow-soft">
                <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-royal-navy">البيانات الأساسية</h2>
                    <p className="mt-2 text-sm text-slate-600">
                      هذه البيانات تُستخدم تلقائيًا داخل صفحة إتمام الطلب.
                    </p>
                  </div>

                  <div
                    className={`rounded-full px-4 py-2 text-xs font-bold ${
                      profileComplete
                        ? "bg-emerald-50 text-emerald-700"
                        : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {profileComplete ? "البيانات مكتملة" : "البيانات تحتاج استكمال"}
                  </div>
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
                    disabled
                  />

                  <input
                    value={form.governorate}
                    onChange={(e) => setForm({ ...form, governorate: e.target.value })}
                    placeholder="المحافظة"
                    className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
                  />

                  <input
                    value={form.city}
                    onChange={(e) => setForm({ ...form, city: e.target.value })}
                    placeholder="المدينة"
                    className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
                  />

                  <textarea
                    value={form.address_line}
                    onChange={(e) => setForm({ ...form, address_line: e.target.value })}
                    placeholder="العنوان التفصيلي"
                    rows={4}
                    className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold md:col-span-2"
                  />

                  <textarea
                    value={form.address_notes}
                    onChange={(e) => setForm({ ...form, address_notes: e.target.value })}
                    placeholder="ملاحظات إضافية للعنوان"
                    rows={3}
                    className="rounded-2xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold md:col-span-2"
                  />
                </div>

                {error ? (
                  <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-600">
                    {error}
                  </div>
                ) : null}

                {savedMessage ? (
                  <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
                    {savedMessage}
                  </div>
                ) : null}

                <div className="mt-5 flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={handleSaveProfile}
                    disabled={saving}
                    className="rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white disabled:opacity-60"
                  >
                    {saving ? "جارٍ حفظ البيانات..." : "حفظ البيانات"}
                  </button>

                  <button
                    type="button"
                    onClick={resetToLoadedData}
                    className="rounded-full border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700"
                  >
                    استرجاع آخر بيانات محفوظة
                  </button>
                </div>
              </section>

              <section className="rounded-[28px] bg-white p-6 shadow-soft">
                <h2 className="mb-5 text-2xl font-bold text-royal-navy">حالة الحساب</h2>

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">الاسم</p>
                    <p className="mt-1 font-bold text-royal-navy">{account?.full_name || "-"}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">اسم المستخدم</p>
                    <p className="mt-1 font-bold text-royal-navy">{account?.username || "-"}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">البريد</p>
                    <p className="mt-1 font-bold text-royal-navy">{account?.email || "-"}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">الهاتف</p>
                    <p className="mt-1 font-bold text-royal-navy">{account?.phone || "-"}</p>
                  </div>
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={async () => {
                      await logoutRequest();
                      window.location.href = "/login";
                    }}
                    className="w-full rounded-full border border-red-200 px-6 py-3 text-sm font-bold text-red-600 transition hover:bg-red-50"
                  >
                    تسجيل الخروج
                  </button>
                </div>
              </section>
            </div>

            <div className="space-y-6">
              <section className="grid gap-4 md:grid-cols-2">
                {accountTiles.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="rounded-[28px] bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-xl"
                  >
                    <h3 className="text-xl font-bold text-royal-navy">{item.title}</h3>
                    <p className="mt-3 text-sm leading-7 text-slate-600">{item.desc}</p>
                  </Link>
                ))}
              </section>

              <section className="rounded-[28px] border border-[#eadfcb] bg-[#fcfaf6] p-6 shadow-soft">
                <h2 className="text-2xl font-bold text-royal-navy">جاهزية الحساب قبل الشراء</h2>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs text-slate-500">الملف الشخصي</p>
                    <p className="mt-1 font-bold text-royal-navy">
                      {form.full_name.trim() ? "متوفر" : "غير مكتمل"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs text-slate-500">الهاتف</p>
                    <p className="mt-1 font-bold text-royal-navy">
                      {form.phone.trim() ? "متوفر" : "غير مكتمل"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs text-slate-500">المدينة والمحافظة</p>
                    <p className="mt-1 font-bold text-royal-navy">
                      {form.city.trim() && form.governorate.trim() ? "متوفر" : "غير مكتمل"}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-white p-4">
                    <p className="text-xs text-slate-500">العنوان الافتراضي</p>
                    <p className="mt-1 font-bold text-royal-navy">
                      {form.address_line.trim() ? "جاهز للاستخدام" : "غير مكتمل"}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        )}
      </main>

      <StoreFooter />
    </>
  );
}
