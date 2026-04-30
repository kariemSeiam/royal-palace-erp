"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ProductCard } from "@/components/product-card";
import { StoreFooter } from "@/components/store-footer";
import { StoreHeader } from "@/components/store-header";
import { getStoreCategories, getStoreProducts } from "@/lib/store-api";

type Category = {
  id: number;
  name: string;
  slug?: string | null;
};

type Product = {
  id: number;
  name: string;
  slug?: string | null;
  price?: number | null;
  sale_price?: number | null;
  currency?: string | null;
  image_url?: string | null;
  category_id?: number | null;
  is_featured?: boolean;
  is_active?: boolean;
};

function readUrlState() {
  if (typeof window === "undefined") {
    return {
      search: "",
      featured: false,
      category: "all",
      sort: "default",
      mode: "all",
    };
  }

  const params = new URLSearchParams(window.location.search);

  return {
    search: params.get("search") || "",
    featured: params.get("featured") === "1",
    category: params.get("category") || "all",
    sort: params.get("sort") || "default",
    mode: params.get("mode") || "all",
  };
}

function updateUrlState({
  search,
  featured,
  category,
  sort,
  mode,
}: {
  search: string;
  featured: boolean;
  category: string;
  sort: string;
  mode: string;
}) {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams();

  if (search.trim()) params.set("search", search.trim());
  if (featured) params.set("featured", "1");
  if (category !== "all") params.set("category", category);
  if (sort !== "default") params.set("sort", sort);
  if (mode !== "all") params.set("mode", mode);

  const query = params.toString();
  const nextUrl = query ? `/catalog?${query}` : "/catalog";
  window.history.replaceState({}, "", nextUrl);
}

function formatResultLabel(count: number) {
  if (count === 0) return "لا توجد نتائج";
  if (count === 1) return "نتيجة واحدة";
  if (count === 2) return "نتيجتان";
  if (count >= 3 && count <= 10) return `${count} نتائج`;
  return `${count} نتيجة`;
}

function hasPrice(item: Product) {
  return Number(item.sale_price ?? item.price ?? 0) > 0;
}

export default function CatalogPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState("");
  const [activeCategory, setActiveCategory] = useState<string>("all");
  const [sortBy, setSortBy] = useState("default");
  const [featuredOnly, setFeaturedOnly] = useState(false);
  const [mode, setMode] = useState("all");

  useEffect(() => {
    const initial = readUrlState();
    setSearch(initial.search);
    setFeaturedOnly(initial.featured);
    setActiveCategory(initial.category);
    setSortBy(initial.sort);
    setMode(initial.mode);

    async function load() {
      try {
        const [productsData, categoriesData] = await Promise.all([
          getStoreProducts(),
          getStoreCategories(),
        ]);

        setProducts(productsData as Product[]);
        setCategories(categoriesData as Category[]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  useEffect(() => {
    updateUrlState({
      search,
      featured: featuredOnly,
      category: activeCategory,
      sort: sortBy,
      mode,
    });
  }, [search, featuredOnly, activeCategory, sortBy, mode]);

  const activeCategoryName = useMemo(() => {
    if (activeCategory === "all") return null;
    return categories.find((item) => String(item.id) === activeCategory)?.name || null;
  }, [activeCategory, categories]);

  const buyNowCount = useMemo(
    () => products.filter((item) => item.is_active !== false && hasPrice(item)).length,
    [products]
  );

  const quoteCount = useMemo(
    () => products.filter((item) => item.is_active !== false && !hasPrice(item)).length,
    [products]
  );

  const filteredProducts = useMemo(() => {
    let data = [...products].filter((item) => item.is_active !== false);

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      data = data.filter((item) => item.name.toLowerCase().includes(q));
    }

    if (activeCategory !== "all") {
      data = data.filter((item) => String(item.category_id || "") === activeCategory);
    }

    if (featuredOnly) {
      data = data.filter((item) => item.is_featured === true);
    }

    if (mode === "buy_now") {
      data = data.filter((item) => hasPrice(item));
    } else if (mode === "quote") {
      data = data.filter((item) => !hasPrice(item));
    }

    if (sortBy === "price_asc") {
      data.sort(
        (a, b) =>
          Number(a.sale_price ?? a.price ?? Number.MAX_SAFE_INTEGER) -
          Number(b.sale_price ?? b.price ?? Number.MAX_SAFE_INTEGER)
      );
    } else if (sortBy === "price_desc") {
      data.sort(
        (a, b) => Number(b.sale_price ?? b.price ?? 0) - Number(a.sale_price ?? a.price ?? 0)
      );
    } else if (sortBy === "name_asc") {
      data.sort((a, b) => a.name.localeCompare(b.name, "ar"));
    } else if (sortBy === "featured") {
      data.sort((a, b) => Number(b.is_featured === true) - Number(a.is_featured === true));
    }

    return data;
  }, [products, search, activeCategory, featuredOnly, sortBy, mode]);

  const hasFilters =
    Boolean(search.trim()) ||
    featuredOnly ||
    activeCategory !== "all" ||
    sortBy !== "default" ||
    mode !== "all";

  function resetFilters() {
    setSearch("");
    setFeaturedOnly(false);
    setActiveCategory("all");
    setSortBy("default");
    setMode("all");
  }

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <section className="mb-6 rounded-[26px] border border-[#eadfcb] bg-white p-4 shadow-soft md:mb-8 md:rounded-[34px] md:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-royal-navy md:text-3xl">
                الكتالوج
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                تصفح المنتجات بأسلوب أكثر تنظيمًا من خلال البحث والتصفية والفرز
                للوصول الأسرع إلى ما يناسبك، مع فصل واضح بين الشراء المباشر والمنتجات
                التي تحتاج عرض سعر.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/categories"
                className="rounded-full border border-slate-200 px-4 py-2 text-sm font-bold text-slate-700"
              >
                الأقسام
              </Link>
              <button
                type="button"
                onClick={() => setFeaturedOnly(true)}
                className="rounded-full bg-royal-navy px-4 py-2 text-sm font-bold text-white"
              >
                المنتجات المميزة
              </button>
            </div>
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-3">
            <button
              type="button"
              onClick={() => setMode("all")}
              className={`rounded-[22px] border px-4 py-4 text-right transition ${
                mode === "all"
                  ? "border-royal-navy bg-royal-navy text-white"
                  : "border-slate-200 bg-[#fcfaf6] text-slate-700"
              }`}
            >
              <div className="text-sm font-extrabold">كل المنتجات</div>
              <div className={`mt-1 text-xs ${mode === "all" ? "text-white/80" : "text-slate-500"}`}>
                تصفح جميع المنتجات المنشورة
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("buy_now")}
              className={`rounded-[22px] border px-4 py-4 text-right transition ${
                mode === "buy_now"
                  ? "border-royal-navy bg-royal-navy text-white"
                  : "border-slate-200 bg-[#fcfaf6] text-slate-700"
              }`}
            >
              <div className="text-sm font-extrabold">جاهز للشراء المباشر</div>
              <div className={`mt-1 text-xs ${mode === "buy_now" ? "text-white/80" : "text-slate-500"}`}>
                {buyNowCount} منتج بسعر واضح وإضافة مباشرة للسلة
              </div>
            </button>

            <button
              type="button"
              onClick={() => setMode("quote")}
              className={`rounded-[22px] border px-4 py-4 text-right transition ${
                mode === "quote"
                  ? "border-royal-navy bg-royal-navy text-white"
                  : "border-slate-200 bg-[#fcfaf6] text-slate-700"
              }`}
            >
              <div className="text-sm font-extrabold">حسب الطلب / للمشاريع</div>
              <div className={`mt-1 text-xs ${mode === "quote" ? "text-white/80" : "text-slate-500"}`}>
                {quoteCount} منتج يحتاج عرض سعر أو تواصل للمشاريع
              </div>
            </button>
          </div>

          <div className="grid gap-3 md:gap-4 lg:grid-cols-[1.2fr_.9fr_.9fr_auto]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="ابحث باسم المنتج..."
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-royal-gold md:text-base"
            />

            <select
              value={activeCategory}
              onChange={(e) => setActiveCategory(e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-royal-gold md:text-base"
            >
              <option value="all">كل الأقسام</option>
              {categories.map((category) => (
                <option key={category.id} value={String(category.id)}>
                  {category.name}
                </option>
              ))}
            </select>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none transition focus:border-royal-gold md:text-base"
            >
              <option value="default">الترتيب الافتراضي</option>
              <option value="featured">المميزة أولًا</option>
              <option value="price_asc">السعر: الأقل أولًا</option>
              <option value="price_desc">السعر: الأعلى أولًا</option>
              <option value="name_asc">الاسم</option>
            </select>

            <button
              type="button"
              onClick={() => setFeaturedOnly((prev) => !prev)}
              className={`rounded-full px-4 py-3 text-xs font-bold transition md:px-5 md:text-sm ${
                featuredOnly
                  ? "bg-royal-navy text-white"
                  : "border border-slate-200 text-slate-700"
              }`}
            >
              {featuredOnly ? "إظهار الكل" : "المميزة فقط"}
            </button>
          </div>

          {hasFilters ? (
            <div className="mt-4 flex flex-wrap items-center gap-2">
              {search.trim() ? (
                <span className="rounded-full bg-[#f8fafc] px-4 py-2 text-xs font-semibold text-slate-700 md:text-sm">
                  البحث: {search.trim()}
                </span>
              ) : null}

              {activeCategoryName ? (
                <span className="rounded-full bg-[#f8fafc] px-4 py-2 text-xs font-semibold text-slate-700 md:text-sm">
                  القسم: {activeCategoryName}
                </span>
              ) : null}

              {featuredOnly ? (
                <span className="rounded-full bg-[#f8fafc] px-4 py-2 text-xs font-semibold text-slate-700 md:text-sm">
                  المنتجات المميزة فقط
                </span>
              ) : null}

              {mode === "buy_now" ? (
                <span className="rounded-full bg-[#f8fafc] px-4 py-2 text-xs font-semibold text-slate-700 md:text-sm">
                  شراء مباشر
                </span>
              ) : null}

              {mode === "quote" ? (
                <span className="rounded-full bg-[#f8fafc] px-4 py-2 text-xs font-semibold text-slate-700 md:text-sm">
                  حسب الطلب
                </span>
              ) : null}

              {sortBy !== "default" ? (
                <span className="rounded-full bg-[#f8fafc] px-4 py-2 text-xs font-semibold text-slate-700 md:text-sm">
                  ترتيب مخصص
                </span>
              ) : null}

              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 md:text-sm"
              >
                إعادة ضبط
              </button>
            </div>
          ) : null}
        </section>

        <section className="mb-5 flex flex-wrap items-center justify-between gap-3 md:mb-6">
          <div>
            <p className="text-sm font-semibold text-royal-navy">
              {formatResultLabel(filteredProducts.length)}
            </p>
            <p className="mt-1 text-sm text-slate-500">
              تصفح منتجات Royal Palace داخل تجربة أكثر وضوحًا وهدوءًا.
            </p>
          </div>

          <Link
            href="/projects"
            className="rounded-full border border-royal-gold px-4 py-2 text-sm font-bold text-royal-gold"
          >
            لديك مشروع أو طلب خاص؟
          </Link>
        </section>

        {loading ? (
          <div className="rounded-[28px] border border-[#eadfcb] bg-white p-10 text-center shadow-soft">
            <div className="mx-auto mb-4 h-10 w-10 animate-pulse rounded-full bg-royal-gold/20" />
            <h2 className="mb-2 text-2xl font-bold text-royal-navy">جارٍ تحميل المنتجات</h2>
            <p className="text-sm leading-8 text-slate-600">
              يتم الآن تجهيز قائمة المنتجات.
            </p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="rounded-[28px] border border-[#eadfcb] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">لا توجد نتائج مطابقة</h2>
            <p className="mx-auto max-w-2xl text-sm leading-8 text-slate-600">
              جرّب تغيير كلمات البحث أو القسم المحدد أو نوع التصفح بين الشراء المباشر
              والمنتجات حسب الطلب.
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full bg-royal-navy px-5 py-3 text-sm font-bold text-white"
              >
                إعادة ضبط الفلاتر
              </button>

              <Link
                href="/projects"
                className="rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
              >
                تواصل للمشاريع
              </Link>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
            {filteredProducts.map((product) => (
              <ProductCard key={product.id} product={product as any} />
            ))}
          </div>
        )}
      </main>

      <StoreFooter />
    </>
  );
}
