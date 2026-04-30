import Link from "next/link";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { ProductCard } from "@/components/product-card";
import { CategoryCard } from "@/components/category-card";
import { HomeHeroSlider } from "@/components/home-hero-slider";
import {
  getBuyNowProducts,
  getFeaturedCategories,
  getFeaturedProducts,
  getQuoteProducts,
  getStoreProducts,
} from "@/lib/store-api";

const trustStats = [
  { value: "تجربة فاخرة", label: "واجهة مصممة بعناية لتخدم العملاء والمشاريع" },
  { value: "عرض احترافي", label: "تنظيم أفضل للمنتجات والأقسام ومسارات التصفح" },
  { value: "رحلة واضحة", label: "من الاستكشاف وحتى الطلب بتجربة أكثر ثقة" },
];

const valueCards = [
  {
    title: "هوية بصرية أكثر فخامة",
    desc: "واجهة بيع تعكس صورة Royal Palace بصورة أكثر رقيًا ووضوحًا، مع تجربة مناسبة لعملاء التجزئة والمشاريع.",
  },
  {
    title: "بنية قابلة للتوسع",
    desc: "أساس منظم لتطوير الأقسام والخامات والمحتوى والعروض والمسارات البيعية في المراحل القادمة.",
  },
  {
    title: "تجربة عربية أولًا",
    desc: "واجهة مصممة لتكون RTL-first بشكل حقيقي، مع لغة عربية واضحة تحافظ على الهيبة والبساطة معًا.",
  },
];

const roomCollections = [
  {
    title: "غرف النوم",
    desc: "منتجات مختارة تمنح العميل بداية واضحة للوصول إلى مساحات أكثر أناقة وهدوءًا.",
    href: "/catalog?search=غرف",
  },
  {
    title: "المجالس والمفروشات",
    desc: "تشكيلات تجمع بين الراحة، التفاصيل الراقية، وإحساس العرض الفخم داخل المتجر.",
    href: "/catalog?search=مجالس",
  },
  {
    title: "المشاريع والتجهيز",
    desc: "مسار واضح للعملاء الباحثين عن التوريد والتجهيز والتنفيذ على نطاق أكبر.",
    href: "/projects",
  },
];

const serviceHighlights = [
  "تصميم عرض أقرب للمتاجر الفاخرة",
  "تجربة حساب وطلبات أكثر تنظيمًا",
  "جاهزية للتوسع في المحتوى والثقة والتحويل",
  "أساس مناسب لربط المتجر بالتشغيل الداخلي",
];

export default async function StoreHomePage() {
  const [featuredProducts, featuredCategories, allProducts] = await Promise.all([
    getFeaturedProducts(8),
    getFeaturedCategories(6),
    getStoreProducts(),
  ]);

  const counts = new Map<number, number>();
  for (const product of allProducts) {
    if (!product.category_id || product.is_active === false) continue;
    counts.set(product.category_id, (counts.get(product.category_id) || 0) + 1);
  }

  const buyNowProducts = getBuyNowProducts(allProducts, 4);
  const quoteProducts = getQuoteProducts(allProducts, 4);

  return (
    <>
      <StoreHeader />

      <main>
        <HomeHeroSlider />

        <section className="container-royal -mt-2 pb-8 md:-mt-4 md:pb-12">
          <div className="grid gap-4 rounded-[28px] border border-[#eadfcb] bg-white p-4 shadow-soft md:grid-cols-3 md:gap-6 md:p-6 xl:p-8">
            {trustStats.map((item) => (
              <div
                key={item.label}
                className="rounded-[22px] border border-slate-100 bg-[#fcfaf6] px-5 py-5 text-center md:px-6"
              >
                <div className="text-lg font-extrabold text-royal-navy md:text-xl">
                  {item.value}
                </div>
                <p className="mt-2 text-sm leading-7 text-slate-600">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="container-royal pb-10 md:pb-12">
          <div className="grid gap-4 lg:grid-cols-2 md:gap-6">
            <div className="rounded-[28px] bg-royal-navy p-6 text-white shadow-soft md:p-8">
              <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                RETAIL FLOW
              </p>
              <h2 className="mt-3 text-2xl font-extrabold md:text-4xl">
                شراء مباشر للمنتجات الجاهزة
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-white/75 md:text-base">
                منتجات مناسبة للإضافة المباشرة إلى السلة مع سعر واضح ومسار شراء سريع.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/catalog?mode=buy_now"
                  className="rounded-full bg-royal-gold px-5 py-3 text-sm font-bold text-royal-navy"
                >
                  تسوق الآن
                </Link>
                <Link
                  href="/catalog?featured=1&mode=buy_now"
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white"
                >
                  المنتجات المميزة
                </Link>
              </div>
            </div>

            <div className="rounded-[28px] border border-[#eadfcb] bg-white p-6 shadow-soft md:p-8">
              <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                PROJECTS FLOW
              </p>
              <h2 className="mt-3 text-2xl font-extrabold text-royal-navy md:text-4xl">
                حلول للمشاريع والطلبات الخاصة
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-slate-600 md:text-base">
                منتجات تحتاج تنسيقًا أكبر أو عرض سعر خاص، مناسبة للمشاريع والتوريد والتجهيزات الراقية.
              </p>
              <div className="mt-6 flex flex-wrap gap-3">
                <Link
                  href="/catalog?mode=quote"
                  className="rounded-full bg-royal-navy px-5 py-3 text-sm font-bold text-white"
                >
                  تصفح حسب الطلب
                </Link>
                <Link
                  href="/projects"
                  className="rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
                >
                  تواصل للمشاريع
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="container-royal pb-10 md:pb-16">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
            <div>
              <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                SHOP BY CATEGORY
              </p>
              <h2 className="mt-2 text-2xl font-bold text-royal-navy md:text-3xl">
                تصفح حسب القسم
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 md:mt-3 md:text-base">
                وصول أسرع إلى الأقسام الرئيسية داخل المتجر، مع تنظيم بصري أوضح
                يساعد على اكتشاف المنتجات بسهولة وأناقة.
              </p>
            </div>

            <Link
              href="/categories"
              className="rounded-full border border-royal-gold px-4 py-2.5 text-xs font-bold text-royal-gold md:px-5 md:py-3 md:text-sm"
            >
              عرض كل الأقسام
            </Link>
          </div>

          {featuredCategories.length === 0 ? (
            <div className="rounded-[28px] bg-white p-8 shadow-soft">
              <p className="text-slate-600">لا توجد أقسام متاحة حاليًا للعرض.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
              {featuredCategories.map((category) => (
                <CategoryCard
                  key={category.id}
                  category={category}
                  productCount={counts.get(category.id) || 0}
                />
              ))}
            </div>
          )}
        </section>

        <section className="bg-[#f8f7f3]">
          <div className="container-royal py-10 md:py-16">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
              <div>
                <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                  FEATURED COLLECTION
                </p>
                <h2 className="mt-2 text-2xl font-bold text-royal-navy md:text-3xl">
                  منتجات مميزة
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 md:mt-3 md:text-base">
                  مجموعة مختارة بعناية لإبراز أفضل المنتجات داخل الواجهة الرئيسية،
                  بأسلوب يليق بتجربة عرض أكثر فخامة.
                </p>
              </div>

              <Link
                href="/catalog?featured=1"
                className="rounded-full bg-royal-navy px-4 py-2.5 text-xs font-bold text-white md:px-5 md:py-3 md:text-sm"
              >
                عرض المنتجات المميزة
              </Link>
            </div>

            {featuredProducts.length === 0 ? (
              <div className="rounded-[28px] bg-white p-8 shadow-soft">
                <p className="text-slate-600">
                  لا توجد منتجات مميزة منشورة حاليًا من لوحة الإدارة.
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
                {featuredProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="container-royal py-10 md:py-16">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
            <div>
              <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                BUY NOW PICKS
              </p>
              <h2 className="mt-2 text-2xl font-bold text-royal-navy md:text-3xl">
                مختارات جاهزة للشراء
              </h2>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 md:mt-3 md:text-base">
                منتجات مناسبة للشراء المباشر بسعر واضح ومسار أسرع من التصفح إلى السلة.
              </p>
            </div>

            <Link
              href="/catalog?mode=buy_now"
              className="rounded-full border border-royal-gold px-4 py-2.5 text-xs font-bold text-royal-gold md:px-5 md:py-3 md:text-sm"
            >
              عرض الجاهز للشراء
            </Link>
          </div>

          {buyNowProducts.length === 0 ? (
            <div className="rounded-[28px] bg-white p-8 shadow-soft">
              <p className="text-slate-600">لا توجد منتجات شراء مباشر متاحة حاليًا.</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
              {buyNowProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          )}
        </section>

        <section className="bg-[#f8fafc]">
          <div className="container-royal py-10 md:py-16">
            <div className="mb-6 flex flex-wrap items-end justify-between gap-4 md:mb-8">
              <div>
                <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                  BESPOKE & PROJECTS
                </p>
                <h2 className="mt-2 text-2xl font-bold text-royal-navy md:text-3xl">
                  مختارات للمشاريع والطلبات الخاصة
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 md:mt-3 md:text-base">
                  منتجات أو مجموعات تحتاج تواصلًا أكبر أو عرض سعر خاص، مناسبة للمساحات الأكبر والتجهيزات المخصصة.
                </p>
              </div>

              <Link
                href="/catalog?mode=quote"
                className="rounded-full bg-royal-navy px-4 py-2.5 text-xs font-bold text-white md:px-5 md:py-3 md:text-sm"
              >
                تصفح حسب الطلب
              </Link>
            </div>

            {quoteProducts.length === 0 ? (
              <div className="rounded-[28px] bg-white p-8 shadow-soft">
                <p className="text-slate-600">لا توجد منتجات حسب الطلب ظاهرة حاليًا.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
                {quoteProducts.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="container-royal py-10 md:py-16">
          <div className="mb-6 text-center md:mb-8">
            <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
              CURATED PATHS
            </p>
            <h2 className="mt-2 text-2xl font-bold text-royal-navy md:text-3xl">
              تسوق حسب احتياجك
            </h2>
            <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
              تقسيمات تساعد على توجيه العميل بشكل أفضل داخل المتجر، وتفتح الطريق
              لتجربة أكثر عمقًا بحسب نوع العميل أو نوع المشروع.
            </p>
          </div>

          <div className="grid gap-4 lg:grid-cols-3 md:gap-6">
            {roomCollections.map((item) => (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[24px] border border-[#eadfcb] bg-white p-6 shadow-soft transition hover:-translate-y-1 hover:shadow-xl md:rounded-[28px] md:p-7"
              >
                <div className="inline-flex rounded-full bg-royal-gold/10 px-3 py-1 text-xs font-bold text-royal-gold">
                  Royal Palace
                </div>
                <h3 className="mt-4 text-xl font-bold text-royal-navy">{item.title}</h3>
                <p className="mt-3 text-sm leading-8 text-slate-600">{item.desc}</p>
                <div className="mt-5 text-sm font-bold text-royal-gold">
                  اكتشف المزيد
                </div>
              </Link>
            ))}
          </div>
        </section>

        <section className="bg-[#f8fafc]">
          <div className="container-royal py-10 md:py-16">
            <div className="mb-6 text-center md:mb-8">
              <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                WHY ROYAL PALACE
              </p>
              <h2 className="mt-2 text-2xl font-bold text-royal-navy md:text-3xl">
                لماذا Royal Palace؟
              </h2>
              <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
                لأن الهدف ليس مجرد عرض منتجات، بل بناء تجربة بيع وتشغيل قابلة للنمو
                وتليق بهوية المجموعة وطموح المشروع.
              </p>
            </div>

            <div className="grid gap-4 lg:grid-cols-3 md:gap-6">
              {valueCards.map((item) => (
                <div
                  key={item.title}
                  className="rounded-[24px] bg-white p-5 shadow-soft md:rounded-[28px] md:p-6"
                >
                  <h3 className="text-lg font-bold text-royal-navy md:text-xl">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm leading-8 text-slate-600">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="container-royal py-10 md:py-16">
          <div className="grid gap-6 lg:grid-cols-[1.08fr_.92fr]">
            <div className="rounded-[28px] bg-royal-navy p-6 text-white shadow-soft md:p-10">
              <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                PROJECTS & BESPOKE
              </p>
              <h2 className="mt-3 text-2xl font-extrabold leading-tight md:text-4xl">
                حلول أقرب للمشاريع والتجهيزات الراقية
              </h2>
              <p className="mt-4 max-w-2xl text-sm leading-8 text-white/75 md:text-base">
                المتجر لا يخدم فقط العميل الفردي، بل يخدم أيضًا العملاء الباحثين عن
                تجهيزات وتوريد ومسارات أكثر احترافية للمشاريع والطلبات الخاصة.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/projects"
                  className="rounded-full bg-royal-gold px-5 py-3 text-sm font-bold text-royal-navy md:px-6"
                >
                  اطلب تواصلًا لمشروعك
                </Link>
                <Link
                  href="/catalog?mode=quote"
                  className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white md:px-6"
                >
                  تصفح حسب الطلب
                </Link>
              </div>
            </div>

            <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-soft md:p-8">
              <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
                PLATFORM READINESS
              </p>
              <h3 className="mt-3 text-2xl font-bold text-royal-navy">
                ما الذي يميز هذه النسخة؟
              </h3>

              <ul className="mt-6 space-y-4">
                {serviceHighlights.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 rounded-2xl bg-[#f8fafc] px-4 py-4"
                  >
                    <span className="mt-1 inline-flex h-2.5 w-2.5 rounded-full bg-royal-gold" />
                    <span className="text-sm leading-7 text-slate-700">{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        <section className="container-royal pb-12 md:pb-20">
          <div className="rounded-[28px] bg-[linear-gradient(135deg,#0f172a_0%,#1e293b_100%)] p-6 text-center shadow-soft md:rounded-[36px] md:p-12">
            <p className="text-xs font-bold tracking-[0.24em] text-royal-gold md:text-sm">
              START YOUR JOURNEY
            </p>
            <h2 className="mt-3 text-2xl font-extrabold text-white md:text-4xl">
              ابدأ تجربة أكثر فخامة وتنظيمًا داخل المتجر
            </h2>

            <p className="mx-auto mt-4 max-w-2xl text-sm leading-8 text-white/70 md:text-base">
              تصفح المنتجات، انتقل بين الأقسام، اختر بين الشراء المباشر أو طلب عرض سعر،
              وأكمل رحلتك من خلال حساب عميل مترابط ومهيأ للتوسع في المراحل القادمة.
            </p>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/catalog?mode=buy_now"
                className="rounded-full bg-royal-gold px-5 py-3 text-sm font-bold text-royal-navy md:px-6"
              >
                ابدأ الشراء المباشر
              </Link>

              <Link
                href="/projects"
                className="rounded-full border border-white/15 px-5 py-3 text-sm font-bold text-white md:px-6"
              >
                طلب عرض سعر / مشروع
              </Link>
            </div>
          </div>
        </section>
      </main>

      <StoreFooter />
    </>
  );
}
