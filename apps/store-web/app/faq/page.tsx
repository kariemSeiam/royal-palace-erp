import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";

const faqs = [
  {
    q: "هل يجب تسجيل الدخول قبل الشراء؟",
    a: "نعم، إتمام الطلب يتم من خلال حساب العميل حتى تكون بيانات الطلب مرتبطة بحسابك ويمكنك متابعتها لاحقًا.",
  },
  {
    q: "هل يمكن تعديل بيانات العنوان؟",
    a: "نعم، يمكنك تعديل بيانات الحساب والعنوان الافتراضي من داخل صفحة حسابي قبل إنشاء الطلب.",
  },
  {
    q: "هل يمكن متابعة الطلب بعد إنشائه؟",
    a: "نعم، الطلبات المرتبطة بحسابك تظهر داخل صفحة طلباتي مع تفاصيل أوضح وحالة الطلب الحالية.",
  },
  {
    q: "هل توجد منتجات خاصة أو طلبات مشاريع؟",
    a: "نعم، يمكنك استخدام صفحة المشاريع أو صفحة تواصل معنا للاستفسارات الخاصة والطلبات المخصصة وتجهيزات المشاريع.",
  },
  {
    q: "هل المتجر قابل للتطوير لاحقًا؟",
    a: "نعم، المتجر مبني بشكل يسمح بتطوير أعمق لخيارات العرض والمحتوى والتخصيص في المراحل القادمة.",
  },
];

export default function FaqPage() {
  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">الأسئلة الشائعة</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base md:leading-8">
            إجابات سريعة على الأسئلة الأكثر ارتباطًا بالتصفح، الحساب، الطلبات، وخدمة المتجر.
          </p>
        </div>

        <section className="space-y-4">
          {faqs.map((item) => (
            <div key={item.q} className="rounded-[28px] bg-white p-6 shadow-soft">
              <h2 className="text-xl font-bold text-royal-navy">{item.q}</h2>
              <p className="mt-3 text-sm leading-8 text-slate-600 md:text-base">{item.a}</p>
            </div>
          ))}
        </section>
      </main>

      <StoreFooter />
    </>
  );
}
