import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";

const pillars = [
  {
    title: "هوية فاخرة",
    desc: "واجهة بيع تعكس Royal Palace بشكل أكثر أناقة ووضوحًا.",
  },
  {
    title: "تجربة عربية أولًا",
    desc: "تصميم RTL-first حقيقي يناسب رحلة العميل العربي من البداية.",
  },
  {
    title: "جاهزية للتوسع",
    desc: "أساس مناسب للربط لاحقًا بين التجارة، التشغيل، والتخصيص داخل الـ ERP.",
  },
];

const values = [
  "عرض أوضح للمنتجات والتصنيفات",
  "رحلة شراء مترابطة مع الحساب والطلبات",
  "تجربة قابلة للتوسع للمشاريع والطلبات الخاصة",
  "بنية مناسبة لتطوير المحتوى والثقة والتحويل",
];

export default function AboutPage() {
  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mb-6 md:mb-8">
          <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">من نحن</h1>
          <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base md:leading-8">
            Royal Palace Group تقدم تجربة متجر أكثر فخامة وتنظيمًا، مصممة لربط بين
            عرض المنتجات، رحلة العميل، وإدارة الطلبات داخل بنية جاهزة للنمو.
          </p>
        </div>

        <section className="grid gap-6 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-[28px] bg-white p-6 shadow-soft md:p-8">
            <h2 className="text-2xl font-bold text-royal-navy">رؤية المتجر</h2>
            <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
              الهدف من هذه التجربة ليس مجرد عرض المنتجات، بل بناء واجهة تجارة راقية
              ومقنعة، تدعم رحلة العميل من اكتشاف المنتج إلى الطلب والمتابعة، مع قابلية
              التوسع لاحقًا للمشاريع والتخصيص والربط التشغيلي الأعمق.
            </p>

            <div className="mt-8 space-y-3">
              {values.map((item) => (
                <div
                  key={item}
                  className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50 px-4 py-4"
                >
                  <span className="mt-2 inline-flex h-2 w-2 rounded-full bg-royal-gold" />
                  <span className="text-sm leading-7 text-slate-700">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[28px] border border-[#eadfcb] bg-[#fcfaf6] p-6 shadow-soft md:p-8">
            <h2 className="text-2xl font-bold text-royal-navy">مرتكزات التجربة</h2>

            <div className="mt-6 grid gap-4">
              {pillars.map((item) => (
                <div key={item.title} className="rounded-[24px] bg-white p-5">
                  <h3 className="text-lg font-bold text-royal-navy">{item.title}</h3>
                  <p className="mt-2 text-sm leading-7 text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>

      <StoreFooter />
    </>
  );
}
