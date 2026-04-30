import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";

const sections = [
  {
    title: "الشحن",
    points: [
      "تختلف مدة الشحن حسب نوع المنتج وتجهيزه.",
      "قد يتم تأكيد تفاصيل الشحن والتوصيل بعد مراجعة الطلب.",
      "المنتجات الخاصة أو الطلبات الكبيرة قد تحتاج وقت تجهيز إضافي.",
    ],
  },
  {
    title: "الاستبدال والإرجاع",
    points: [
      "يتم التعامل مع طلبات الاستبدال والإرجاع وفق حالة المنتج ونوع الطلب.",
      "الطلبات الخاصة أو المصممة حسب الطلب قد تخضع لشروط مختلفة.",
      "يُنصح بالتواصل مع فريق الدعم مباشرة لشرح الحالة واستلام التوجيه المناسب.",
    ],
  },
  {
    title: "خدمة ما بعد البيع",
    points: [
      "يمكن التواصل معنا لمتابعة الطلبات أو الاستفسار عن أي تفاصيل بعد الشراء.",
      "فريق الدعم يساعد في مراجعة الحالات الخاصة وطلبات الخدمة.",
      "الهدف هو تقديم تجربة أوضح وأكثر احترافية خلال ما بعد البيع.",
    ],
  },
];

export default function ShippingAndReturnsPage() {
  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">
            الشحن والاستبدال والإرجاع
          </h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base md:leading-8">
            معلومات عامة تساعد العميل على فهم تجربة الشحن وخدمة ما بعد البيع بشكل أوضح.
          </p>
        </div>

        <section className="grid gap-6">
          {sections.map((section) => (
            <div key={section.title} className="rounded-[28px] bg-white p-8 shadow-soft">
              <h2 className="text-2xl font-bold text-royal-navy">{section.title}</h2>
              <div className="mt-5 space-y-3">
                {section.points.map((point) => (
                  <div
                    key={point}
                    className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
                  >
                    <span className="mt-2 inline-flex h-2 w-2 rounded-full bg-royal-gold" />
                    <span className="text-sm leading-7 text-slate-700">{point}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </main>

      <StoreFooter />
    </>
  );
}
