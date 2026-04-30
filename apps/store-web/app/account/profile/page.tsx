"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { getAccountMe, type StoreAccount } from "@/lib/account-api";
import { getStoredAccessToken } from "@/lib/auth-storage";

export default function AccountProfilePage() {
  const [account, setAccount] = useState<StoreAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const token = getStoredAccessToken();

        if (!token) {
          setNotLoggedIn(true);
          setLoading(false);
          return;
        }

        const data = await getAccountMe(token);
        setAccount(data);
      } catch (err: any) {
        const message = String(err?.message || "");
        if (message === "AUTH_REQUIRED") {
          setNotLoggedIn(true);
        } else {
          setError(err?.message || "تعذر تحميل بيانات الملف الشخصي.");
        }
        setAccount(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 md:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">الملف الشخصي</h1>
            <p className="mt-2 text-sm leading-7 text-slate-600 md:text-base">
              عرض مركز لبيانات العميل الحالية مع وصول سريع إلى التعديل وإدارة الطلبات.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/account"
              className="rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
            >
              العودة إلى الحساب
            </Link>
            <Link
              href="/account/orders"
              className="rounded-full bg-royal-navy px-5 py-3 text-sm font-bold text-white"
            >
              طلباتي
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <p className="text-slate-600">جارٍ تحميل الملف الشخصي...</p>
          </div>
        ) : notLoggedIn ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">تسجيل الدخول مطلوب</h2>
            <p className="mb-6 text-sm leading-8 text-slate-600">
              سجّل الدخول أولًا للوصول إلى بيانات الملف الشخصي.
            </p>
            <Link
              href="/login?next=/account/profile"
              className="inline-flex rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
            >
              تسجيل الدخول
            </Link>
          </div>
        ) : error ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">تعذر تحميل الملف الشخصي</h2>
            <p className="mb-6 text-sm leading-8 text-slate-600">{error}</p>
            <Link
              href="/account"
              className="inline-flex rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
            >
              العودة إلى الحساب
            </Link>
          </div>
        ) : !account ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">لا توجد بيانات متاحة</h2>
            <Link
              href="/account"
              className="inline-flex rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
            >
              العودة إلى الحساب
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[.95fr_1.05fr]">
            <div className="rounded-[28px] bg-royal-navy p-6 text-white shadow-soft md:p-10">
              <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                CLIENT PROFILE
              </p>
              <h2 className="mt-3 text-3xl font-extrabold md:text-5xl">
                {account.full_name || "عميل Royal Palace"}
              </h2>
              <p className="mt-4 text-sm leading-8 text-white/75 md:text-base">
                ملف شخصي مهيأ لربط الحساب بالشراء المباشر، الطلبات، والعنوان الافتراضي.
              </p>
            </div>

            <div className="rounded-[28px] bg-white p-6 shadow-soft md:p-10">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">الاسم الكامل</p>
                  <p className="mt-1 font-bold text-royal-navy">{account.full_name || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">اسم المستخدم</p>
                  <p className="mt-1 font-bold text-royal-navy">{account.username || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">البريد الإلكتروني</p>
                  <p className="mt-1 font-bold text-royal-navy">{account.email || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">الهاتف</p>
                  <p className="mt-1 font-bold text-royal-navy">{account.phone || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">المحافظة</p>
                  <p className="mt-1 font-bold text-royal-navy">{account.governorate || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                  <p className="text-xs text-slate-500">المدينة</p>
                  <p className="mt-1 font-bold text-royal-navy">{account.city || "-"}</p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 md:col-span-2">
                  <p className="text-xs text-slate-500">العنوان الافتراضي</p>
                  <p className="mt-1 font-bold text-royal-navy">
                    {account.address_line || account.address || "-"}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 md:col-span-2">
                  <p className="text-xs text-slate-500">ملاحظات العنوان</p>
                  <p className="mt-1 font-bold text-royal-navy">{account.address_notes || "-"}</p>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/account"
                  className="rounded-full bg-royal-navy px-5 py-3 text-sm font-bold text-white"
                >
                  تعديل البيانات
                </Link>
                <Link
                  href="/checkout"
                  className="rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
                >
                  إتمام الطلب
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      <StoreFooter />
    </>
  );
}
