"use client";

import Link from "next/link";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { useCurrentUser } from "@/components/auth-session";
import AddressesManager from "@/components/account/addresses-manager";

export default function AccountAddressesPage() {
  const { user, loading } = useCurrentUser();

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 md:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">العناوين</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
              إدارة عناوين الشحن المرتبطة بحسابك، وتحديد العنوان الافتراضي لتجربة شراء
              أسرع وأكثر احترافية.
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
              href="/checkout"
              className="rounded-full bg-royal-navy px-5 py-3 text-sm font-bold text-white"
            >
              إتمام الطلب
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <p className="text-slate-600">جارٍ تحميل العناوين...</p>
          </div>
        ) : !user ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">تسجيل الدخول مطلوب</h2>
            <p className="mb-6 text-sm leading-8 text-slate-600">
              سجّل الدخول أولًا للوصول إلى عناوين الشحن الخاصة بحسابك.
            </p>
            <Link
              href="/login?next=/account/addresses"
              className="inline-flex rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
            >
              تسجيل الدخول
            </Link>
          </div>
        ) : (
          <AddressesManager initialItems={[]} />
        )}
      </main>

      <StoreFooter />
    </>
  );
}
