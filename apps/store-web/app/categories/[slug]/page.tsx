import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductCard } from "@/components/product-card";
import { StoreFooter } from "@/components/store-footer";
import { StoreHeader } from "@/components/store-header";
import {
  getCategoryBySlugOrId,
  getProductsByCategorySlugOrId,
  getStoreCategories,
} from "@/lib/store-api";

export default async function CategoryDetailsPage({
  params,
}: {
  params: { slug: string };
}) {
  const category = await getCategoryBySlugOrId(params.slug);

  if (!category) {
    notFound();
  }

  const products = await getProductsByCategorySlugOrId(params.slug);
  const categories = await getStoreCategories();

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-12 md:py-16">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <Link href="/categories" className="text-sm font-semibold text-royal-gold">
            الأقسام
          </Link>
          <span className="text-slate-300">/</span>
          <Link href="/catalog" className="text-sm font-semibold text-royal-gold">
            كل المنتجات
          </Link>
        </div>

        <div className="mb-10 overflow-hidden rounded-[32px] bg-white shadow-soft">
          <div className="grid gap-0 lg:grid-cols-[1.1fr_.9fr]">
            <div className="p-8 md:p-10">
              <div className="mb-4 inline-flex rounded-full bg-royal-gold/10 px-4 py-2 text-sm font-bold text-royal-gold">
                {products.length} منتج داخل هذا القسم
              </div>

              <h1 className="text-4xl font-bold text-royal-navy">{category.name}</h1>

              <p className="mt-5 max-w-2xl text-sm leading-8 text-slate-600 md:text-base">
                {category.description ||
                  "استعرض المنتجات التابعة لهذا القسم ضمن تجربة أكثر تنظيمًا ووضوحًا."}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href="/catalog"
                  className="rounded-full bg-royal-navy px-5 py-3 text-sm font-bold text-white"
                >
                  عرض كل المنتجات
                </Link>

                <Link
                  href="/categories"
                  className="rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
                >
                  العودة إلى الأقسام
                </Link>
              </div>
            </div>

            <div className="min-h-[280px] bg-slate-100">
              {category.image_url ? (
                <img
                  src={category.image_url}
                  alt={category.name}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full min-h-[280px] items-center justify-center text-sm text-slate-400">
                  لا توجد صورة لهذا القسم
                </div>
              )}
            </div>
          </div>
        </div>

        {categories.length > 1 ? (
          <div className="mb-8 flex flex-wrap gap-3">
            {categories.map((item) => (
              <Link
                key={item.id}
                href={`/categories/${item.slug || item.id}`}
                className={`rounded-full px-4 py-2 text-sm font-semibold ${
                  item.id === category.id
                    ? "bg-royal-navy text-white"
                    : "border border-slate-200 text-slate-600"
                }`}
              >
                {item.name}
              </Link>
            ))}
          </div>
        ) : null}

        {products.length === 0 ? (
          <div className="rounded-[28px] bg-white p-8 shadow-soft">
            <p className="text-slate-600">لا توجد منتجات مرتبطة بهذا القسم حاليًا.</p>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </main>

      <StoreFooter />
    </>
  );
}
