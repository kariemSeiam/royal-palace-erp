"use client";

import Link from "next/link";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";

export default function ForgotPasswordPage() {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
  }

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mx-auto max-w-4xl">
          <section className="grid gap-6 lg:grid-cols-[.95fr_1.05fr]">
            <div className="rounded-[32px] bg-white p-6 shadow-soft md:p-10">
              <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">
                استعادة كلمة المرور
              </h1>
              <p className="mt-3 text-sm leading-8 text-slate-600 md:text-base">
                أدخل بريدك الإلكتروني أو اسم المستخدم، وسيتم إرسال تعليمات إعادة تعيين
                كلمة المرور عند ربط الخدمة الخلفية الخاصة بهذه الصفحة.
              </p>

              <form onSubmit={handleSubmit} className="mt-8 space-y-4">
                <input
                  type="text"
                  placeholder="البريد الإلكتروني أو اسم المستخدم"
                  className="w-full rounded-2xl border border-slate-200 px-5 py-4 outline-none focus:border-royal-gold"
                />

                <button
                  type="submit"
                  className="flex w-full items-center justify-center rounded-full bg-royal-navy px-6 py-4 text-sm font-bold text-white"
                >
                  إرسال تعليمات الاستعادة
                </button>
              </form>

              <div className="mt-6 rounded-[24px] border border-slate-100 bg-slate-50 p-5 text-center">
                <p className="text-sm text-slate-600">
                  هل تذكرت كلمة المرور؟
                </p>
                <Link
                  href="/login"
                  className="mt-4 inline-flex rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
                >
                  العودة إلى تسجيل الدخول
                </Link>
              </div>
            </div>

            <div className="rounded-[32px] bg-royal-navy p-6 text-white shadow-soft md:p-10">
              <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                PASSWORD RECOVERY
              </p>
              <h2 className="mt-3 text-3xl font-extrabold md:text-5xl">
                صفحة جاهزة للإغلاق الكامل
              </h2>
              <p className="mt-4 text-sm leading-8 text-white/75 md:text-base">
                تم إنشاء الصفحة الآن لتكون جزءًا متسقًا من طبقة الدخول والحساب،
                ويمكن ربطها لاحقًا بسهولة بمنطق إعادة تعيين كلمة المرور.
              </p>
            </div>
          </section>
        </div>
      </main>

      <StoreFooter />
    </>
  );
}
