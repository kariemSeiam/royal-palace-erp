"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import type { StoreCategory, StoreProduct } from "@/lib/store-api";
import { ProductCard } from "@/components/product-card";

export function CatalogFilters({
  products,
  categories,
}: {
  products: StoreProduct[];
  categories: StoreCategory[];
}) {
  const [query, setQuery] = useState("");
  const [activeCategory, setActiveCategory] = useState<number | null>(null);

  const filteredProducts = useMemo(() => {
    const q = query.trim().toLowerCase();

    return products.filter((product) => {
      const matchesCategory = activeCategory ? product.category_id === activeCategory : true;

      const haystack = [
        product.name,
        product.description,
        product.short_description,
        product.sku,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery = q ? haystack.includes(q) : true;

      return matchesCategory && matchesQuery;
    });
  }, [products, query, activeCategory]);

  return (
    <div>
      <div className="mb-6 rounded-[24px] bg-white p-4 shadow-soft md:mb-8 md:p-5">
        <div className="grid gap-3 md:gap-4 lg:grid-cols-[1fr_auto]">
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="ابحث بالاسم أو الوصف أو SKU"
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm outline-none md:text-base"
          />

          <Link
            href="/categories"
            className="inline-flex items-center justify-center rounded-full border border-royal-gold px-4 py-3 text-xs font-semibold text-royal-gold md:px-5 md:text-sm"
          >
            عرض كل الأقسام
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap gap-2 md:gap-3">
          <button
            type="button"
            onClick={() => setActiveCategory(null)}
            className={`rounded-full px-3 py-2 text-xs font-semibold md:px-4 md:text-sm ${
              activeCategory === null
                ? "bg-royal-navy text-white"
                : "border border-slate-200 text-slate-600"
            }`}
          >
            كل المنتجات
          </button>

          {categories.map((category) => (
            <button
              key={category.id}
              type="button"
              onClick={() => setActiveCategory(category.id)}
              className={`rounded-full px-3 py-2 text-xs font-semibold md:px-4 md:text-sm ${
                activeCategory === category.id
                  ? "bg-royal-navy text-white"
                  : "border border-slate-200 text-slate-600"
              }`}
            >
              {category.name}
            </button>
          ))}
        </div>
      </div>

      {filteredProducts.length === 0 ? (
        <div className="rounded-[24px] bg-white p-8 shadow-soft">
          <p className="text-slate-600">لا توجد نتائج مطابقة للبحث أو الفلترة الحالية.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-4">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
        </div>
      )}
    </div>
  );
}
