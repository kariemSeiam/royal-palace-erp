import { StoreFooter } from "@/components/store-footer";
import { StoreHeader } from "@/components/store-header";
import { CategoryCard } from "@/components/category-card";
import { getStoreCategories, getStoreProducts } from "@/lib/store-api";

export default async function CategoriesPage() {
  const categories = await getStoreCategories();
  const products = await getStoreProducts();

  const counts = new Map<number, number>();
  for (const product of products) {
    if (!product.category_id || product.is_active === false) continue;
    counts.set(product.category_id, (counts.get(product.category_id) || 0) + 1);
  }

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-10 md:py-16">
        <div className="mb-6 rounded-[24px] bg-white p-6 shadow-soft md:mb-8 md:rounded-[32px] md:p-8">
          <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">الأقسام</h1>
          <p className="mt-3 max-w-3xl text-sm leading-8 text-slate-600 md:text-base">
            استعرض الأقسام الرئيسية داخل المتجر وانتقل إلى المنتجات المرتبطة بكل
            قسم عبر تجربة أكثر وضوحًا وأناقة.
          </p>
        </div>

        {categories.length === 0 ? (
          <div className="rounded-[28px] bg-white p-8 shadow-soft">
            <p className="text-slate-600">لا توجد أقسام متاحة حاليًا.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
            {categories.map((category) => (
              <CategoryCard
                key={category.id}
                category={category}
                productCount={counts.get(category.id) || 0}
              />
            ))}
          </div>
        )}
      </main>

      <StoreFooter />
    </>
  );
}
