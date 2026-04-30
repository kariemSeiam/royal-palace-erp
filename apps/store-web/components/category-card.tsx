import Link from "next/link";

type CategoryCardProps = {
  category: {
    id: number;
    name?: string | null;
    slug?: string | null;
    name_ar?: string | null;
    name_en?: string | null;
    image_url?: string | null;
    banner_image_url?: string | null;
  };
  productCount?: number;
};

function formatCount(productCount: number) {
  if (productCount === 0) return "لا توجد منتجات";
  if (productCount === 1) return "منتج واحد";
  if (productCount === 2) return "منتجان";
  if (productCount >= 3 && productCount <= 10) return `${productCount} منتجات`;
  return `${productCount} منتج`;
}

export function CategoryCard({ category, productCount = 0 }: CategoryCardProps) {
  const categoryName = category.name || category.name_ar || category.name_en || "تصنيف";
  const categorySlug = category.slug || String(category.id);
  const imageUrl = category.banner_image_url || category.image_url || null;

  return (
    <div className="group overflow-hidden rounded-[22px] border border-[#eadfcb] bg-white shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-xl md:rounded-[30px]">
      <Link href={`/categories/${categorySlug}`} className="block">
        <div className="relative h-[150px] overflow-hidden bg-slate-100 sm:h-[190px] md:h-[240px] xl:h-[280px]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={categoryName}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.05]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-slate-400 md:text-sm">
              لا توجد صورة متاحة
            </div>
          )}

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.08)_0%,rgba(15,23,42,0.18)_42%,rgba(15,23,42,0.76)_100%)]" />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 md:p-4">
            <span className="inline-flex items-center rounded-full border border-[#d4b06a]/45 bg-[rgba(15,23,42,0.62)] px-3 py-1.5 text-[10px] font-bold text-white shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-md md:text-xs">
              {formatCount(productCount)}
            </span>

            <span className="rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold text-white backdrop-blur md:text-xs">
              Royal Palace
            </span>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-4 md:p-5">
            <div className="inline-flex max-w-full items-center rounded-full border border-[#d4b06a]/45 bg-[rgba(15,23,42,0.62)] px-4 py-2.5 shadow-[0_8px_30px_rgba(0,0,0,0.18)] backdrop-blur-md">
              <h3 className="line-clamp-1 text-sm font-extrabold text-white md:text-lg">
                {categoryName}
              </h3>
            </div>
          </div>
        </div>
      </Link>

      <div className="p-4 md:p-5">
        <div className="text-sm font-bold text-royal-navy md:text-base">تصفح القسم</div>
        <p className="mt-2 line-clamp-2 text-xs leading-6 text-slate-500 md:text-sm">
          انتقال مباشر إلى منتجات هذا التصنيف بتجربة أكثر وضوحًا وتنظيمًا.
        </p>

        <Link
          href={`/categories/${categorySlug}`}
          className="mt-4 inline-flex w-full items-center justify-center rounded-full bg-royal-navy px-4 py-3 text-xs font-bold text-white transition hover:opacity-90 md:text-sm"
        >
          عرض المنتجات
        </Link>
      </div>
    </div>
  );
}
