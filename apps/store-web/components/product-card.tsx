import Link from "next/link";
import { AddToCartButton } from "@/components/add-to-cart-button";

type ProductCardProps = {
  product: {
    id: number;
    slug?: string | null;
    name?: string | null;
    title?: string | null;
    name_ar?: string | null;
    name_en?: string | null;
    image_url?: string | null;
    primary_image_url?: string | null;
    preview_image_url?: string | null;
    price?: string | number | null;
    base_price?: string | number | null;
    sale_price?: string | number | null;
    ar_enabled?: boolean;
    is_featured?: boolean;
  };
};

function getDisplayPrice(product: ProductCardProps["product"]) {
  const sale =
    product.sale_price !== undefined && product.sale_price !== null && product.sale_price !== ""
      ? Number(product.sale_price)
      : null;

  const regular =
    product.price !== undefined && product.price !== null && product.price !== ""
      ? Number(product.price)
      : product.base_price !== undefined &&
        product.base_price !== null &&
        product.base_price !== ""
      ? Number(product.base_price)
      : null;

  if (sale !== null && !Number.isNaN(sale) && sale > 0) {
    return {
      current: sale,
      original: regular !== null && !Number.isNaN(regular) && regular > sale ? regular : null,
      hasPrice: true,
    };
  }

  if (regular !== null && !Number.isNaN(regular) && regular > 0) {
    return {
      current: regular,
      original: null,
      hasPrice: true,
    };
  }

  return {
    current: null,
    original: null,
    hasPrice: false,
  };
}

export function ProductCard({ product }: ProductCardProps) {
  const productName =
    product.name || product.title || product.name_ar || product.name_en || "منتج";

  const productSlug = product.slug || String(product.id);

  const imageUrl =
    product.image_url || product.primary_image_url || product.preview_image_url || null;

  const priceState = getDisplayPrice(product);
  const quoteHref = `/projects?product=${encodeURIComponent(productName)}&slug=${encodeURIComponent(productSlug)}`;

  return (
    <div className="group overflow-hidden rounded-[22px] border border-[#eadfcb] bg-white shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-xl md:rounded-[30px]">
      <Link href={`/products/${productSlug}`} className="block">
        <div className="relative h-[150px] overflow-hidden bg-slate-100 sm:h-[190px] md:h-[240px] xl:h-[280px]">
          {imageUrl ? (
            <img
              src={imageUrl}
              alt={productName}
              className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.04]"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center px-4 text-center text-xs text-slate-400 md:text-sm">
              لا توجد صورة متاحة
            </div>
          )}

          <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(15,23,42,0.02)_0%,rgba(15,23,42,0.08)_40%,rgba(15,23,42,0.38)_100%)]" />

          <div className="absolute inset-x-0 top-0 flex items-center justify-between p-3 md:p-4">
            <div className="flex flex-wrap gap-2">
              {product.ar_enabled ? (
                <span className="rounded-full bg-white/90 px-3 py-1 text-[10px] font-bold text-slate-700 shadow md:text-xs">
                  AR
                </span>
              ) : null}

              {product.is_featured ? (
                <span className="rounded-full bg-royal-gold px-3 py-1 text-[10px] font-bold text-royal-navy shadow md:text-xs">
                  مميز
                </span>
              ) : null}

              {!priceState.hasPrice ? (
                <span className="rounded-full border border-white/25 bg-[rgba(15,23,42,0.62)] px-3 py-1 text-[10px] font-bold text-white shadow md:text-xs">
                  حسب الطلب
                </span>
              ) : null}
            </div>
          </div>
        </div>
      </Link>

      <div className="p-4 md:p-5">
        <Link href={`/products/${productSlug}`} className="block">
          <h3 className="line-clamp-2 min-h-[48px] text-sm font-extrabold leading-7 text-royal-navy md:min-h-[60px] md:text-lg">
            {productName}
          </h3>
        </Link>

        <div className="mt-3 rounded-[20px] bg-[#fcfaf6] px-4 py-3">
          {priceState.hasPrice ? (
            <div className="flex flex-wrap items-end gap-2">
              <span className="text-base font-extrabold text-royal-gold md:text-lg">
                EGP {priceState.current}
              </span>
              {priceState.original ? (
                <span className="pb-0.5 text-sm font-bold text-slate-400 line-through">
                  EGP {priceState.original}
                </span>
              ) : null}
            </div>
          ) : (
            <div>
              <div className="text-sm font-bold text-slate-500">
                السعر يُحدد حسب الطلب
              </div>
              <div className="mt-1 text-xs text-slate-400">
                مناسب للمشاريع والتجهيزات أو المنتجات المخصصة
              </div>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 md:mt-5 md:flex-row md:items-center md:justify-between md:gap-3">
          <div className="w-full md:w-auto">
            <AddToCartButton
              product={{
                id: product.id,
                slug: productSlug,
                name: productName,
                image_url: imageUrl || undefined,
                price: priceState.current || 0,
                currency: "EGP",
              }}
            />
          </div>

          {priceState.hasPrice ? (
            <Link
              href={`/products/${productSlug}`}
              className="inline-flex w-full items-center justify-center rounded-full border border-royal-navy px-4 py-2.5 text-xs font-bold text-royal-navy transition hover:bg-royal-navy hover:text-white md:w-auto md:px-5 md:text-sm"
            >
              عرض التفاصيل
            </Link>
          ) : (
            <Link
              href={quoteHref}
              className="inline-flex w-full items-center justify-center rounded-full border border-slate-200 px-4 py-2.5 text-xs font-bold text-slate-700 transition hover:border-royal-gold hover:text-royal-gold md:w-auto md:px-5 md:text-sm"
            >
              تواصل للمشاريع
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
