"use client";

import Link from "next/link";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";

const serviceTracks = [
  {
    title: "تجهيزات سكنية",
    desc: "حلول للفلل والشقق والمساحات السكنية التي تحتاج توريدًا أو تجهيزًا أكثر تنظيمًا.",
  },
  {
    title: "مشاريع ضيافة",
    desc: "مسار مهيأ للفنادق والشقق الفندقية والمشاريع التي تحتاج كميات أو مواصفات خاصة.",
  },
  {
    title: "طلبات خاصة وتخصيص",
    desc: "للاستفسارات المتعلقة بالتفصيل والمقاسات الخاصة أو الطلبات التي تحتاج متابعة مباشرة.",
  },
];

const rfqSteps = [
  "أرسل بيانات المشروع أو الطلب الخاص",
  "حدد نوع المنتجات أو الفئة المطلوبة",
  "أضف المدينة ووسيلة التواصل الأنسب",
  "سيتم التواصل لمراجعة المتطلبات بشكل أوضح",
];

const projectTypes = [
  "فندق / ضيافة",
  "فيلا / سكن خاص",
  "شركة / مكتب",
  "توريد كميات",
  "طلب خاص / تخصيص",
];

export default function ProjectsPage() {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
  }

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 md:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">المشاريع والطلبات الخاصة</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base md:leading-8">
              صفحة مخصصة للعملاء الباحثين عن تجهيزات وتوريد وطلبات خاصة، مع مسار أوضح
              من المتجر التقليدي الموجه للشراء المباشر.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              href="https://wa.me/201000000000"
              target="_blank"
              rel="noreferrer"
              className="rounded-full bg-royal-gold px-5 py-3 text-sm font-bold text-royal-navy"
            >
              تواصل عبر واتساب
            </a>

            <Link
              href="/contact"
              className="rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
            >
              تواصل عام
            </Link>
          </div>
        </div>

        <section className="mb-8 grid gap-4 md:grid-cols-3">
          {serviceTracks.map((item) => (
            <div
              key={item.title}
              className="rounded-[24px] bg-white p-5 shadow-soft"
            >
              <div className="text-lg font-extrabold text-royal-navy md:text-xl">
                {item.title}
              </div>
              <p className="mt-2 text-sm leading-7 text-slate-600">{item.desc}</p>
            </div>
          ))}
        </section>

        <section className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[28px] bg-white p-8 shadow-soft">
            <h2 className="text-2xl font-bold text-royal-navy">طلب عرض سعر / RFQ</h2>
            <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
              هذه الصفحة تمثل نواة مسار المشاريع داخل المتجر، وتهيئ التجربة لاحقًا لربط
              الطلبات الخاصة بمسارات B2B أعمق داخل النظام.
            </p>

            <div className="mt-6 space-y-3">
              {rfqSteps.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
                >
                  <span className="mt-2 inline-flex h-2 w-2 rounded-full bg-royal-gold" />
                  <span className="text-sm leading-7 text-slate-700">{item}</span>
                </div>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-2">
              {projectTypes.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-[#eadfcb] bg-[#fcfaf6] px-4 py-2 text-xs font-semibold text-slate-700 md:text-sm"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-[28px] bg-white p-8 shadow-soft">
            <h2 className="mb-5 text-2xl font-bold text-royal-navy">أرسل طلب مشروع</h2>

            <div className="grid gap-4">
              <input
                type="text"
                placeholder="اسم العميل / الشركة"
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
              />
              <input
                type="text"
                placeholder="اسم المشروع"
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
              />
              <input
                type="tel"
                placeholder="رقم الهاتف"
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
              />
              <input
                type="email"
                placeholder="البريد الإلكتروني"
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
              />
              <input
                type="text"
                placeholder="المدينة"
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
              />
              <select className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold">
                <option>نوع المشروع أو الطلب</option>
                {projectTypes.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <textarea
                placeholder="وصف مختصر للاحتياج أو نوع المنتجات المطلوبة"
                className="min-h-[180px] rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
              />
              <button
                type="submit"
                className="rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
              >
                إرسال طلب المشروع
              </button>
            </div>
          </form>
        </section>

        <section className="mt-8 rounded-[28px] border border-[#eadfcb] bg-[#fcfaf6] p-8 shadow-soft">
          <div className="grid gap-6 lg:grid-cols-[1.1fr_.9fr]">
            <div>
              <h2 className="text-2xl font-bold text-royal-navy">لماذا هذه الصفحة مهمة؟</h2>
              <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
                لأنها تفصل بين رحلة الشراء المباشر داخل المتجر، وبين رحلة المشاريع التي
                تحتاج تواصلًا أوضح ومواصفات أوسع، مع استعداد للتطوير لاحقًا لمسار RFQ
                أعمق داخل Royal Palace ERP.
              </p>
            </div>

            <div className="rounded-[24px] bg-white p-5">
              <p className="text-sm font-bold text-royal-navy">المسار الحالي يدعم:</p>
              <div className="mt-4 space-y-3">
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  صفحة مشاريع مستقلة داخل المتجر
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  نقطة بداية لطلبات RFQ وطلبات التخصيص
                </div>
                <div className="rounded-2xl bg-slate-50 px-4 py-4 text-sm text-slate-700">
                  فصل أوضح بين B2C و B2B داخل التجربة
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      <StoreFooter />
    </>
  );
}
