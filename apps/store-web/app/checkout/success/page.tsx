"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";

function getOrderNumberFromBrowser() {
  if (typeof window === "undefined") return null;
  const params = new URLSearchParams(window.location.search);
  return params.get("order_number");
}

const nextSteps = [
  {
    title: "متابعة الطلب",
    desc: "راجع حالة الطلب وتفاصيله من داخل صفحة طلباتي.",
  },
  {
    title: "العودة إلى الحساب",
    desc: "بياناتك وطلباتك مرتبطة الآن بالحساب الحالي.",
  },
  {
    title: "استكمال التصفح",
    desc: "يمكنك العودة للكتالوج وإضافة طلبات أخرى لاحقًا.",
  },
];

export default function CheckoutSuccessPage() {
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  useEffect(() => {
    setOrderNumber(getOrderNumberFromBrowser());
  }, []);

  const title = useMemo(() => {
    return orderNumber ? "تم إنشاء الطلب بنجاح" : "تمت العملية بنجاح";
  }, [orderNumber]);

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-[28px] bg-white p-8 shadow-soft md:p-10">
            <div className="mx-auto flex max-w-4xl flex-col items-center text-center">
              <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-50">
                <svg
                  viewBox="0 0 24 24"
                  className="h-10 w-10 text-emerald-600"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.4"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6 9 17l-5-5" />
                </svg>
              </div>

              <h1 className="text-3xl font-extrabold text-royal-navy md:text-5xl">
                {title}
              </h1>

              <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-600 md:text-base">
                تم استلام طلبك وربطه بحسابك الحالي داخل المتجر، ويمكنك الآن متابعة حالته
                وتفاصيله من صفحة طلباتي.
              </p>
            </div>

            {orderNumber ? (
              <div className="mx-auto mb-8 mt-8 max-w-xl rounded-[24px] border border-royal-gold/20 bg-royal-gold/5 p-6 text-center">
                <p className="text-xs font-semibold tracking-[0.2em] text-slate-500">
                  ORDER NUMBER
                </p>
                <p className="mt-3 text-2xl font-extrabold text-royal-navy">
                  {orderNumber}
                </p>
              </div>
            ) : null}

            <div className="grid gap-4 md:grid-cols-3">
              {nextSteps.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[24px] border border-slate-100 bg-slate-50 p-5"
                >
                  <h2 className="mb-2 text-lg font-bold text-royal-navy">{item.title}</h2>
                  <p className="text-sm leading-7 text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/account/orders"
                className="rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
              >
                الذهاب إلى طلباتي
              </Link>

              <Link
                href="/account"
                className="rounded-full border border-royal-gold px-6 py-3 text-sm font-bold text-royal-gold"
              >
                العودة إلى حسابي
              </Link>

              <Link
                href="/catalog"
                className="rounded-full border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700"
              >
                متابعة التسوق
              </Link>

              <Link
                href="/projects"
                className="rounded-full border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700"
              >
                المشاريع والطلبات الخاصة
              </Link>
            </div>
          </section>
        </div>
      </main>

      <StoreFooter />
    </>
  );
}
