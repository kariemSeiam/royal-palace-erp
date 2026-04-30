"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  Menu,
  Phone,
  Search,
  ShoppingCart,
  User,
  X,
} from "lucide-react";
import { useCart } from "@/components/cart-provider";
import { useEffect, useMemo, useRef, useState } from "react";
import { API_BASE_URL } from "@/lib/config";

type HeaderCategory = {
  id: number;
  name: string;
  slug?: string | null;
};

const featuredCatalogLinks = [
  {
    title: "الكتالوج الكامل",
    href: "/catalog",
    desc: "استعرض جميع المنتجات المعروضة داخل المتجر بتجربة راقية وسريعة.",
  },
  {
    title: "المجموعات المميزة",
    href: "/catalog?featured=1",
    desc: "تشكيلة مختارة بعناية لإبراز أفضل منتجات Royal Palace.",
  },
  {
    title: "الأقسام الرئيسية",
    href: "/categories",
    desc: "انتقل مباشرة إلى أقسام المتجر للوصول الأسرع إلى ما تبحث عنه.",
  },
  {
    title: "المشاريع والطلبات الخاصة",
    href: "/projects",
    desc: "مسار احترافي لعملاء المشاريع والتوريد والطلبات المخصصة.",
  },
];

const quickActions = [
  { label: "طلباتي", href: "/account/orders" },
  { label: "السلة", href: "/cart" },
  { label: "حسابي", href: "/account" },
];

function normalizeCategory(item: any): HeaderCategory | null {
  if (!item || typeof item !== "object") return null;

  return {
    id: Number(item.id),
    name:
      item.name_ar ||
      item.name ||
      item.name_en ||
      item.slug ||
      `Category ${item.id}`,
    slug: item.slug || (item.id ? String(item.id) : null),
  };
}

export function StoreHeader() {
  const router = useRouter();
  const { itemsCount } = useCart();

  const [mobileOpen, setMobileOpen] = useState(false);
  const [productsOpen, setProductsOpen] = useState(false);
  const [categoriesOpen, setCategoriesOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categories, setCategories] = useState<HeaderCategory[]>([]);

  const productsRef = useRef<HTMLDivElement | null>(null);
  const categoriesRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      const target = event.target as Node;

      if (productsRef.current && !productsRef.current.contains(target)) {
        setProductsOpen(false);
      }

      if (categoriesRef.current && !categoriesRef.current.contains(target)) {
        setCategoriesOpen(false);
      }
    }

    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadCategories() {
      try {
        const res = await fetch(`${API_BASE_URL}/api/v1/catalog/categories`, {
          headers: { Accept: "application/json" },
        });

        if (!res.ok) return;

        const data = await res.json();
        if (!Array.isArray(data)) return;

        const normalized = data
          .map((item) => normalizeCategory(item))
          .filter(Boolean) as HeaderCategory[];

        if (!cancelled) {
          setCategories(normalized);
        }
      } catch {
        // ignore
      }
    }

    loadCategories();

    return () => {
      cancelled = true;
    };
  }, []);

  function closeMenus() {
    setMobileOpen(false);
    setProductsOpen(false);
    setCategoriesOpen(false);
  }

  function handleSearchSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = searchQuery.trim();
    if (!value) return;

    closeMenus();
    router.push(`/catalog?search=${encodeURIComponent(value)}`);
  }

  const menuCategories = useMemo(() => categories.slice(0, 8), [categories]);

  return (
    <header className="sticky top-0 z-50 border-b border-[#d8c6a4]/20 bg-royal-navy/95 backdrop-blur">
      <div className="border-b border-white/5">
        <div className="container-royal flex min-h-[40px] items-center justify-between gap-3 py-2 md:min-h-[42px]">
          <Link
            href="/contact"
            className="text-xs font-semibold text-royal-gold transition hover:text-white"
          >
            تواصل معنا
          </Link>

          <a
            href="tel:+201000000000"
            className="inline-flex items-center gap-2 text-xs font-semibold text-white/80 transition hover:text-royal-gold"
          >
            <Phone size={13} />
            <span dir="ltr">+20 100 000 0000</span>
          </a>
        </div>
      </div>

      <div className="container-royal flex min-h-[78px] items-center justify-between gap-3 py-3 md:min-h-[92px] md:gap-4">
        <div className="flex items-center gap-2 md:gap-3">
          <button
            type="button"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white xl:hidden"
            onClick={() => setMobileOpen((prev) => !prev)}
            aria-label="فتح القائمة"
          >
            {mobileOpen ? <X size={18} /> : <Menu size={18} />}
          </button>

          <Link href="/" className="flex items-center gap-2 md:gap-3" onClick={closeMenus}>
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-white/5 shadow-lg md:h-14 md:w-14">
              <img
                src="/brand/logo.png"
                alt="Royal Palace Group"
                className="h-10 w-10 object-contain md:h-12 md:w-12"
              />
            </div>

            <div className="hidden min-w-0 sm:block">
              <div className="text-sm font-bold tracking-[0.24em] text-white/95">
                ROYAL PALACE
              </div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.28em] text-royal-gold">
                GROUP
              </div>
            </div>
          </Link>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="hidden flex-1 items-center justify-center xl:flex"
        >
          <div className="flex w-full max-w-[560px] items-center overflow-hidden rounded-full border border-white/10 bg-white shadow-sm">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن منتج أو قسم أو خامة..."
              className="h-12 flex-1 bg-transparent px-5 text-sm text-slate-900 outline-none"
            />
            <button
              type="submit"
              className="inline-flex h-12 w-12 items-center justify-center text-royal-navy"
              aria-label="بحث"
            >
              <Search size={18} />
            </button>
          </div>
        </form>

        <nav className="hidden items-center gap-1 xl:flex">
          <Link
            href="/"
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
          >
            الرئيسية
          </Link>

          <div className="relative" ref={productsRef}>
            <button
              type="button"
              onClick={() => {
                setProductsOpen((prev) => !prev);
                setCategoriesOpen(false);
              }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
            >
              <span>المتجر</span>
              <ChevronDown
                size={14}
                className={`transition ${productsOpen ? "rotate-180" : ""}`}
              />
            </button>

            {productsOpen ? (
              <div className="absolute right-0 top-full z-50 w-[860px] pt-3">
                <div className="overflow-hidden rounded-[30px] border border-white/10 bg-[#0d1629] shadow-2xl">
                  <div className="grid grid-cols-[1.05fr_.95fr]">
                    <div className="p-6">
                      <h3 className="mb-2 text-lg font-bold text-white">اكتشف المتجر</h3>
                      <p className="mb-6 text-sm leading-7 text-white/65">
                        وصول أسرع إلى أقسام المتجر الرئيسية مع روابط مباشرة للمنتجات
                        والمجموعات المميزة وصفحات المشاريع.
                      </p>

                      <div className="grid gap-4">
                        {featuredCatalogLinks.map((link) => (
                          <Link
                            key={link.href}
                            href={link.href}
                            onClick={closeMenus}
                            className="rounded-2xl border border-white/5 bg-white/[0.03] p-4 transition hover:border-royal-gold/30 hover:bg-white/[0.06]"
                          >
                            <div className="text-base font-bold text-white">{link.title}</div>
                            <div className="mt-2 text-sm leading-7 text-white/60">{link.desc}</div>
                          </Link>
                        ))}
                      </div>
                    </div>

                    <div className="border-r border-white/5 bg-white/[0.02] p-6">
                      <h4 className="mb-4 text-sm font-bold uppercase tracking-[0.25em] text-royal-gold">
                        روابط سريعة
                      </h4>

                      <div className="grid gap-3">
                        {quickActions.map((item) => (
                          <Link
                            key={item.href}
                            href={item.href}
                            onClick={closeMenus}
                            className="rounded-2xl px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
                          >
                            {item.label}
                          </Link>
                        ))}
                      </div>

                      <div className="mt-6 rounded-[22px] border border-white/5 bg-white/[0.03] p-4">
                        <div className="text-sm font-bold text-white">جاهز للتصفح؟</div>
                        <p className="mt-2 text-sm leading-7 text-white/60">
                          ابدأ من الكتالوج الكامل أو انتقل مباشرة إلى الأقسام الرئيسية.
                        </p>
                        <div className="mt-4 flex flex-wrap gap-2">
                          <Link
                            href="/catalog"
                            onClick={closeMenus}
                            className="rounded-full bg-royal-gold px-4 py-2 text-xs font-bold text-royal-navy"
                          >
                            الكتالوج
                          </Link>
                          <Link
                            href="/categories"
                            onClick={closeMenus}
                            className="rounded-full border border-white/10 px-4 py-2 text-xs font-bold text-white"
                          >
                            الأقسام
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="relative" ref={categoriesRef}>
            <button
              type="button"
              onClick={() => {
                setCategoriesOpen((prev) => !prev);
                setProductsOpen(false);
              }}
              className="inline-flex items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
            >
              <span>الأقسام</span>
              <ChevronDown
                size={14}
                className={`transition ${categoriesOpen ? "rotate-180" : ""}`}
              />
            </button>

            {categoriesOpen ? (
              <div className="absolute right-0 top-full z-50 w-[340px] pt-3">
                <div className="rounded-[24px] border border-white/10 bg-[#0d1629] p-3 shadow-2xl">
                  <Link
                    href="/categories"
                    onClick={closeMenus}
                    className="block rounded-2xl px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
                  >
                    كل الأقسام
                  </Link>

                  {menuCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/categories/${cat.slug || cat.id}`}
                      onClick={closeMenus}
                      className="block rounded-2xl px-4 py-3 text-sm font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <Link
            href="/catalog"
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
          >
            الكتالوج
          </Link>

          <Link
            href="/projects"
            className="rounded-full px-4 py-2.5 text-sm font-semibold text-white/85 transition hover:bg-white/5 hover:text-white"
          >
            المشاريع
          </Link>
        </nav>

        <div className="flex items-center gap-2 md:gap-3">
          <Link
            href="/cart"
            className="relative inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white/80 transition hover:border-royal-gold/40 hover:text-royal-gold"
            title="السلة"
          >
            <ShoppingCart size={18} />
            {itemsCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-[20px] items-center justify-center rounded-full bg-royal-gold px-1 text-[11px] font-bold text-royal-navy">
                {itemsCount}
              </span>
            ) : null}
          </Link>

          <Link
            href="/account"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/10 text-white/80 transition hover:border-royal-gold/40 hover:text-royal-gold"
            title="حسابي"
          >
            <User size={18} />
          </Link>
        </div>
      </div>

      {mobileOpen ? (
        <div className="border-t border-white/5 xl:hidden">
          <div className="container-royal py-4">
            <form onSubmit={handleSearchSubmit} className="mb-4">
              <div className="flex items-center overflow-hidden rounded-full border border-white/10 bg-white">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ابحث عن منتج..."
                  className="h-11 flex-1 bg-transparent px-4 text-sm text-slate-900 outline-none"
                />
                <button
                  type="submit"
                  className="inline-flex h-11 w-12 items-center justify-center text-royal-navy"
                  aria-label="بحث"
                >
                  <Search size={18} />
                </button>
              </div>
            </form>

            <div className="space-y-2 rounded-[24px] border border-white/10 bg-white/[0.03] p-3">
              <Link
                href="/"
                onClick={closeMenus}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
              >
                الرئيسية
              </Link>
              <Link
                href="/catalog"
                onClick={closeMenus}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
              >
                الكتالوج
              </Link>
              <Link
                href="/categories"
                onClick={closeMenus}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
              >
                الأقسام
              </Link>
              <Link
                href="/projects"
                onClick={closeMenus}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
              >
                المشاريع والطلبات الخاصة
              </Link>
              <Link
                href="/account"
                onClick={closeMenus}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
              >
                حسابي
              </Link>
              <Link
                href="/account/orders"
                onClick={closeMenus}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
              >
                طلباتي
              </Link>
              <Link
                href="/cart"
                onClick={closeMenus}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
              >
                السلة
              </Link>
              <Link
                href="/contact"
                onClick={closeMenus}
                className="block rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
              >
                تواصل معنا
              </Link>
            </div>

            {menuCategories.length > 0 ? (
              <div className="mt-4 rounded-[24px] border border-white/10 bg-white/[0.03] p-3">
                <div className="px-4 py-2 text-xs font-bold tracking-[0.24em] text-royal-gold">
                  الأقسام
                </div>

                <div className="mt-1 grid gap-1">
                  {menuCategories.map((cat) => (
                    <Link
                      key={cat.id}
                      href={`/categories/${cat.slug || cat.id}`}
                      onClick={closeMenus}
                      className="block rounded-2xl px-4 py-3 text-sm font-semibold text-white/90 transition hover:bg-white/5"
                    >
                      {cat.name}
                    </Link>
                  ))}
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </header>
  );
}
