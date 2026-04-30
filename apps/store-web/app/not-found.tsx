import Link from "next/link";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";

const helpfulLinks = [
  { label: "العودة للرئيسية", href: "/" },
  { label: "تصفح الكتالوج", href: "/catalog" },
  { label: "عرض التصنيفات", href: "/categories" },
  { label: "المشاريع والطلبات الخاصة", href: "/projects" },
];

export default function NotFoundPage() {
  return (
    <>
      <StoreHeader />

      <main className="container-royal py-14 md:py-20">
        <div className="mx-auto max-w-5xl">
          <section className="rounded-[28px] bg-white p-8 text-center shadow-soft md:p-12">
            <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-[#fcfaf6] text-royal-gold shadow-sm">
              <span className="text-4xl font-extrabold">404</span>
            </div>

            <h1 className="text-3xl font-extrabold text-royal-navy md:text-5xl">
              الصفحة غير موجودة
            </h1>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-slate-600 md:text-base">
              تعذر العثور على الصفحة أو المنتج المطلوب. ربما تم تغيير الرابط أو أنك
              وصلت إلى مسار غير متاح داخل المتجر.
            </p>
          </section>

          <section className="mt-6 rounded-[28px] bg-white p-8 shadow-soft md:p-10">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {helpfulLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="rounded-[24px] border border-slate-100 bg-slate-50 p-5 text-center transition hover:-translate-y-1 hover:shadow-md"
                >
                  <div className="text-lg font-bold text-royal-navy">{item.label}</div>
                </Link>
              ))}
            </div>

            <div className="mt-8 rounded-[24px] border border-[#eadfcb] bg-[#fcfaf6] p-5 text-center">
              <p className="text-sm leading-8 text-slate-600">
                جرّب الرجوع إلى الكتالوج أو التصنيفات أو صفحة المشاريع، ثم أكمل رحلتك
                من هناك.
              </p>
            </div>
          </section>
        </div>
      </main>

      <StoreFooter />
    </>
  );
}
