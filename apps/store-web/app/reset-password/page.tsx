"use client";

import Link from "next/link";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";

export default function ResetPasswordPage() {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
  }

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mx-auto max-w-4xl">
          <section className="grid gap-6 lg:grid-cols-[1.02fr_.98fr]">
            <div className="rounded-[32px] bg-white p-6 shadow-soft md:p-10">
              <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">
                تعيين كلمة مرور جديدة
              </h1>
              <p className="mt-3 text-sm leading-8 text-slate-600 md:text-base">
                استخدم هذه الصفحة لإدخال كلمة مرور جديدة بعد استلام رابط الاستعادة.
                وهي جاهزة الآن بصريًا ومساريًا ضمن تجربة الحساب.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <input
                  type="password"
                  placeholder="كلمة المرور الجديدة"
                  className="w-full rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-royal-gold"
                />
                <input
                  type="password"
                  placeholder="تأكيد كلمة المرور الجديدة"
                  className="w-full rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-royal-gold"
                />

                <button
                  type="submit"
                  className="flex w-full items-center justify-center rounded-full bg-royal-navy px-6 py-4 text-sm font-bold text-white"
                >
                  حفظ كلمة المرور
                </button>
              </form>

              <div className="mt-6 text-center">
                <Link
                  href="/login"
                  className="text-sm font-bold text-royal-gold"
                >
                  العودة إلى تسجيل الدخول
                </Link>
              </div>
            </div>

            <div className="rounded-[32px] border border-[#eadfcb] bg-[#fcfaf6] p-6 shadow-soft md:p-10">
              <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                ACCOUNT SECURITY
              </p>
              <h2 className="mt-3 text-3xl font-extrabold text-royal-navy md:text-5xl">
                أمان أوضح وتجربة مكتملة
              </h2>
              <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
                إضافة هذه الصفحة تغلق طبقة الحساب بالكامل وتمنع وجود فجوات في رحلة
                الدخول والاستعادة.
              </p>
            </div>
          </section>
        </div>
      </main>

      <StoreFooter />
    </>
  );
}
