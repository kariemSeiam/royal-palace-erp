import Link from "next/link";
import {
  COMPANY_NAME,
  COMPANY_TAGLINE,
  CONTACT_PAGE,
  HOME_PAGE,
  CATALOG_PAGE,
  PROJECTS_PAGE,
  SUPPORT_EMAIL,
  SUPPORT_HOURS,
  SUPPORT_PHONE_DISPLAY,
} from "@/lib/config";

const quickLinks = [
  { label: "الرئيسية", href: HOME_PAGE },
  { label: "الكتالوج", href: CATALOG_PAGE },
  { label: "الأقسام", href: "/categories" },
  { label: "المشاريع", href: PROJECTS_PAGE },
  { label: "السلة", href: "/cart" },
  { label: "حسابي", href: "/account" },
  { label: "طلباتي", href: "/account/orders" },
];

const supportLinks = [
  { label: "من نحن", href: "/about" },
  { label: "تواصل معنا", href: CONTACT_PAGE },
  { label: "الشحن والاستبدال", href: "/shipping-and-returns" },
  { label: "الأسئلة الشائعة", href: "/faq" },
  { label: "المشاريع والطلبات الخاصة", href: PROJECTS_PAGE },
];

const valuePoints = [
  "واجهة عربية راقية ومصممة بعناية",
  "أساس قوي للربط مع منظومة ERP",
  "تجربة شراء واضحة من التصفح حتى الطلب",
];

export function StoreFooter() {
  return (
    <footer className="mt-16 border-t border-white/10 bg-royal-navy text-white">
      <div className="container-royal py-12">
        <div className="grid gap-10 lg:grid-cols-[1.15fr_.9fr_.9fr_.95fr]">
          <div>
            <div className="flex items-center gap-3">
              <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg">
                <img
                  src="/brand/logo.png"
                  alt={COMPANY_NAME}
                  className="h-12 w-12 object-contain"
                />
              </div>

              <div>
                <h3 className="text-lg font-bold text-white">{COMPANY_NAME}</h3>
                <p className="mt-1 text-xs uppercase tracking-[0.28em] text-royal-gold">
                  {COMPANY_TAGLINE}
                </p>
              </div>
            </div>

            <p className="mt-5 max-w-xl text-sm leading-8 text-white/70">
              تجربة متجر فاخرة تمزج بين أناقة العرض وسهولة التصفح ومسار شراء واضح،
              مع قابلية توسع قوية لتخدم احتياجات البيع والمشاريع داخل Royal Palace.
            </p>

            <ul className="mt-6 space-y-3">
              {valuePoints.map((item) => (
                <li key={item} className="flex items-start gap-3 text-sm text-white/75">
                  <span className="mt-2 inline-flex h-2 w-2 rounded-full bg-royal-gold" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.24em] text-royal-gold">
              المتجر
            </h4>
            <div className="mt-5 flex flex-col gap-3 text-sm text-white/75">
              {quickLinks.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="transition hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.24em] text-royal-gold">
              الدعم والخدمة
            </h4>
            <div className="mt-5 flex flex-col gap-3 text-sm text-white/75">
              {supportLinks.map((item) => (
                <Link
                  key={item.href + item.label}
                  href={item.href}
                  className="transition hover:text-white"
                >
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-sm font-bold uppercase tracking-[0.24em] text-royal-gold">
              التواصل والدفع
            </h4>

            <div className="mt-5 space-y-3 text-sm text-white/75">
              <p>
                الهاتف: <span dir="ltr">{SUPPORT_PHONE_DISPLAY}</span>
              </p>
              <p>البريد: {SUPPORT_EMAIL}</p>
              <p>ساعات العمل: {SUPPORT_HOURS}</p>
            </div>

            <div className="mt-6">
              <h5 className="text-xs font-bold uppercase tracking-[0.22em] text-white/65">
                وسائل الدفع
              </h5>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <div className="flex h-11 w-20 items-center justify-center rounded-xl border border-white/10 bg-white p-2">
                  <img src="/payments/visa.svg" alt="Visa" className="max-h-6 w-auto" />
                </div>

                <div className="flex h-11 w-20 items-center justify-center rounded-xl border border-white/10 bg-white p-2">
                  <img
                    src="/payments/mastercard.svg"
                    alt="Mastercard"
                    className="max-h-6 w-auto"
                  />
                </div>

                <div className="flex h-11 w-20 items-center justify-center rounded-xl border border-white/10 bg-white p-2">
                  <img src="/payments/meeza.svg" alt="Meeza" className="max-h-6 w-auto" />
                </div>

                <div className="flex h-11 w-20 items-center justify-center rounded-xl border border-white/10 bg-white p-2">
                  <img
                    src="/payments/vodafone.svg"
                    alt="Vodafone Cash"
                    className="max-h-6 w-auto"
                  />
                </div>

                <div className="flex h-11 w-20 items-center justify-center rounded-xl border border-white/10 bg-white p-2">
                  <img
                    src="/payments/orange.svg"
                    alt="Orange Money"
                    className="max-h-6 w-auto"
                  />
                </div>

                <div className="flex h-11 w-20 items-center justify-center rounded-xl border border-white/10 bg-white p-2">
                  <img
                    src="/payments/etisalat.svg"
                    alt="Etisalat Cash"
                    className="max-h-6 w-auto"
                  />
                </div>

                <div className="flex h-11 w-20 items-center justify-center rounded-xl border border-white/10 bg-white p-2">
                  <img src="/payments/we.svg" alt="WE Pay" className="max-h-6 w-auto" />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 flex flex-col gap-3 border-t border-white/10 pt-5 text-xs text-white/45 md:flex-row md:items-center md:justify-between">
          <div>© {COMPANY_NAME}. جميع الحقوق محفوظة.</div>
          <div>Arabic-first luxury commerce experience built for refined growth.</div>
        </div>
      </div>
    </footer>
  );
}
