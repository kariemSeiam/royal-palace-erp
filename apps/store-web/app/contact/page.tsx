"use client";

import Link from "next/link";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";

const inquiryTypes = [
  "استفسار عن منتج",
  "طلب خاص أو تخصيص",
  "تجهيزات ومشاريع",
  "خدمة ما بعد البيع",
];

export default function ContactPage() {
  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
  }

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">تواصل معنا</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base md:leading-8">
            يمكنك التواصل معنا للاستفسارات، الطلبات الخاصة، تجهيزات المشاريع،
            وخدمات ما بعد الشراء داخل تجربة أكثر وضوحًا واحترافية.
          </p>
        </div>

        <section className="grid gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[28px] bg-white p-8 shadow-soft">
            <h2 className="mb-5 text-2xl font-bold text-royal-navy">بيانات التواصل</h2>

            <div className="space-y-4 text-sm text-slate-600">
              <p>
                <span className="font-bold text-royal-navy">الهاتف:</span>{" "}
                <a href="tel:+201000000000" className="hover:text-royal-gold">
                  +20 100 000 0000
                </a>
              </p>
              <p>
                <span className="font-bold text-royal-navy">واتساب:</span>{" "}
                <a
                  href="https://wa.me/201000000000"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-royal-gold"
                >
                  +20 100 000 0000
                </a>
              </p>
              <p>
                <span className="font-bold text-royal-navy">البريد:</span>{" "}
                <a
                  href="mailto:info@royalpalace-group.com"
                  className="hover:text-royal-gold"
                >
                  info@royalpalace-group.com
                </a>
              </p>
              <p>
                <span className="font-bold text-royal-navy">العنوان:</span> Royal Palace Group
              </p>
              <p>
                <span className="font-bold text-royal-navy">ساعات العمل:</span> يوميًا من 10 ص إلى 10 م
              </p>
            </div>

            <div className="mt-8 rounded-[24px] border border-[#eadfcb] bg-[#fcfaf6] p-5">
              <p className="text-sm font-bold text-royal-navy">نستقبل الاستفسارات المتعلقة بـ:</p>
              <div className="mt-4 flex flex-wrap gap-2">
                {inquiryTypes.map((item) => (
                  <span
                    key={item}
                    className="rounded-full border border-[#eadfcb] bg-white px-4 py-2 text-xs font-semibold text-slate-700 md:text-sm"
                  >
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="tel:+201000000000"
                className="rounded-full bg-royal-navy px-5 py-3 text-sm font-semibold text-white"
              >
                اتصل الآن
              </a>

              <a
                href="https://wa.me/201000000000"
                target="_blank"
                rel="noreferrer"
                className="rounded-full border border-royal-gold px-5 py-3 text-sm font-semibold text-royal-gold"
              >
                واتساب
              </a>

              <Link
                href="/projects"
                className="rounded-full border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700"
              >
                صفحة المشاريع
              </Link>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="rounded-[28px] bg-white p-8 shadow-soft">
            <h2 className="mb-5 text-2xl font-bold text-royal-navy">أرسل رسالة</h2>

            <div className="grid gap-4">
              <input
                type="text"
                placeholder="الاسم"
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
              />
              <input
                type="email"
                placeholder="البريد الإلكتروني"
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
              />
              <input
                type="tel"
                placeholder="رقم الهاتف"
                className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
              />
              <select className="rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold">
                <option>نوع الطلب أو الاستفسار</option>
                {inquiryTypes.map((item) => (
                  <option key={item}>{item}</option>
                ))}
              </select>
              <textarea
                placeholder="اكتب رسالتك"
                className="min-h-[160px] rounded-xl border border-slate-200 px-4 py-3 outline-none focus:border-royal-gold"
              />
              <button
                type="submit"
                className="rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
              >
                إرسال
              </button>
            </div>
          </form>
        </section>
      </main>

      <StoreFooter />
    </>
  );
}
