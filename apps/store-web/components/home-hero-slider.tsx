"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Slide = {
  eyebrow: string;
  title: string;
  subtitle: string;
  description: string;
  image: string;
  primaryHref: string;
  primaryLabel: string;
  secondaryHref: string;
  secondaryLabel: string;
};

const slides: Slide[] = [
  {
    eyebrow: "LUXURY LIVING",
    title: "ROYAL PALACE GROUP",
    subtitle: "تجربة تسوق فاخرة بهوية راقية وواضحة",
    description:
      "واجهة عربية أولًا تعكس هوية Royal Palace بأسلوب أنيق، وتمنح العميل رحلة أكثر احترافية من اكتشاف المنتجات حتى إتمام الطلب.",
    image: "/brand/hero-1.jpg",
    primaryHref: "/catalog",
    primaryLabel: "استعرض الكتالوج",
    secondaryHref: "/categories",
    secondaryLabel: "تصفح الأقسام",
  },
  {
    eyebrow: "CURATED COLLECTIONS",
    title: "ROYAL PALACE GROUP",
    subtitle: "مجموعات مختارة بعناية ومعايير عرض أكثر فخامة",
    description:
      "تنظيم أفضل للمنتجات والأقسام والمحتوى، مع تجربة تصفح أكثر هدوءًا وأناقة لإبراز أفضل ما يميز علامتكم التجارية.",
    image: "/brand/hero-2.jpg",
    primaryHref: "/catalog?featured=1",
    primaryLabel: "المنتجات المميزة",
    secondaryHref: "/account",
    secondaryLabel: "حسابي",
  },
  {
    eyebrow: "PROJECTS & COMMERCE",
    title: "ROYAL PALACE GROUP",
    subtitle: "جاهزية حقيقية لخدمة الأفراد والمشاريع والطلبات الخاصة",
    description:
      "بنية متجر قوية قابلة للتوسع، تخدم البيع المباشر كما تخدم العملاء الباحثين عن التوريد والمشاريع والتنفيذ المخصص.",
    image: "/brand/hero-3.jpg",
    primaryHref: "/projects",
    primaryLabel: "تواصل للمشاريع",
    secondaryHref: "/cart",
    secondaryLabel: "اذهب إلى السلة",
  },
];

export function HomeHeroSlider() {
  const [active, setActive] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActive((prev) => (prev + 1) % slides.length);
    }, 5200);

    return () => window.clearInterval(timer);
  }, []);

  const current = useMemo(() => slides[active], [active]);

  return (
    <section className="container-royal py-4 md:py-10 lg:py-12">
      <div className="relative overflow-hidden rounded-[28px] bg-royal-navy shadow-soft md:rounded-[36px]">
        <div className="relative min-h-[420px] md:h-[620px] lg:h-[660px]">
          {slides.map((slide, index) => (
            <div
              key={slide.image}
              className={`absolute inset-0 transition-opacity duration-700 ${
                index === active ? "opacity-100" : "opacity-0"
              }`}
            >
              <img
                src={slide.image}
                alt={slide.subtitle}
                className="h-full w-full object-cover"
              />
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.42)_0%,rgba(15,23,42,0.26)_28%,rgba(15,23,42,0.16)_55%,rgba(15,23,42,0.48)_100%)] md:bg-[linear-gradient(90deg,rgba(15,23,42,0.60)_0%,rgba(15,23,42,0.36)_34%,rgba(15,23,42,0.12)_64%,rgba(15,23,42,0.50)_100%)]" />
            </div>
          ))}

          <div className="absolute inset-0 z-10 flex items-end md:items-center">
            <div className="w-full px-4 py-5 md:px-10 md:py-8 lg:px-14">
              <div className="max-w-3xl">
                <div className="inline-flex rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold tracking-[0.2em] text-white md:px-4 md:py-2 md:text-xs md:tracking-[0.28em]">
                  {current.eyebrow}
                </div>

                <div className="mt-4 text-[10px] font-bold tracking-[0.22em] text-white/80 md:mt-6 md:text-sm md:tracking-[0.34em]">
                  {current.title}
                </div>

                <h1 className="mt-3 text-2xl font-extrabold leading-tight text-white md:mt-4 md:text-5xl lg:text-6xl">
                  {current.subtitle}
                </h1>

                <p className="mt-4 max-w-2xl text-sm leading-7 text-white/90 md:mt-5 md:text-base md:leading-8">
                  {current.description}
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row md:mt-8">
                  <Link
                    href={current.primaryHref}
                    className="inline-flex items-center justify-center rounded-full bg-royal-gold px-5 py-3 text-sm font-bold text-royal-navy transition hover:translate-y-[-1px] md:px-6"
                  >
                    {current.primaryLabel}
                  </Link>

                  <Link
                    href={current.secondaryHref}
                    className="inline-flex items-center justify-center rounded-full border border-white/25 bg-white/5 px-5 py-3 text-sm font-bold text-white transition hover:bg-white/10 md:px-6"
                  >
                    {current.secondaryLabel}
                  </Link>
                </div>

                <div className="mt-5 flex items-center gap-2 md:mt-8 md:gap-3">
                  {slides.map((slide, index) => (
                    <button
                      key={slide.image}
                      type="button"
                      aria-label={`Go to slide ${index + 1}`}
                      onClick={() => setActive(index)}
                      className={`h-2.5 rounded-full transition-all md:h-3 ${
                        index === active
                          ? "w-8 bg-royal-gold md:w-10"
                          : "w-2.5 bg-white/55 md:w-3"
                      }`}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
