"use client";

import { AddToCartButton } from "@/components/add-to-cart-button";

function formatPrice(price?: number | null, currency?: string | null) {
  if (price === null || price === undefined || Number(price) <= 0) {
    return "السعر عند الطلب";
  }
  return `${price} ${currency || "EGP"}`;
}

function isDirectBuy(price?: number | null) {
  return price !== null && price !== undefined && Number(price) > 0;
}

export function MobileAddToCart({
  product,
}: {
  product: {
    id: number;
    slug?: string | null;
    name: string;
    image_url?: string | null;
    price?: number | null;
    currency?: string | null;
  };
}) {
  const directBuy = isDirectBuy(product.price);

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 p-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
      <div className="container-royal">
        <div className="flex items-center justify-between gap-3 rounded-[22px] border border-[#eadfcb] bg-[#fcfaf6] p-3">
          <div className="min-w-0">
            <p className="line-clamp-1 text-sm font-bold text-royal-navy">
              {product.name}
            </p>
            <p className="mt-1 text-xs font-semibold text-royal-gold">
              {formatPrice(product.price, product.currency)}
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {directBuy ? "شراء مباشر" : "منتج مخصص / حسب الطلب"}
            </p>
          </div>

          <div className="shrink-0">
            <AddToCartButton product={product} />
          </div>
        </div>
      </div>
    </div>
  );
}
