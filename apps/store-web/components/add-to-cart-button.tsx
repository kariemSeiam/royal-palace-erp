"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useCart } from "@/components/cart-provider";

type ButtonProduct = {
  id: number;
  slug?: string | null;
  name: string;
  image_url?: string | null;
  price?: number | null;
  currency?: string | null;
};

function hasDirectPrice(price?: number | null) {
  return price !== null && price !== undefined && Number(price) > 0;
}

function buildQuoteHref(product: ButtonProduct) {
  const q = new URLSearchParams();
  q.set("product", product.name);
  if (product.slug) q.set("slug", product.slug);
  return `/projects?${q.toString()}`;
}

export function AddToCartButton({
  product,
  forceQuote = false,
  className = "",
}: {
  product: ButtonProduct;
  forceQuote?: boolean;
  className?: string;
}) {
  const router = useRouter();
  const { addItem } = useCart();
  const [loading, setLoading] = useState(false);

  const quoteMode = useMemo(
    () => forceQuote || !hasDirectPrice(product.price),
    [forceQuote, product.price]
  );

  if (quoteMode) {
    return (
      <Link
        href={buildQuoteHref(product)}
        className={`inline-flex min-h-[48px] items-center justify-center rounded-full border border-royal-gold px-6 py-3 text-sm font-bold text-royal-gold transition hover:bg-royal-gold hover:text-royal-navy ${className}`.trim()}
      >
        اطلب عرض سعر
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (loading) return;

        setLoading(true);

        addItem({
          id: product.id,
          slug: product.slug || undefined,
          name: product.name,
          image_url: product.image_url || null,
          price: Number(product.price || 0),
          quantity: 1,
        });

        setTimeout(() => {
          router.push("/cart");
        }, 120);
      }}
      className={`inline-flex min-h-[48px] items-center justify-center rounded-full bg-royal-gold px-6 py-3 text-sm font-bold text-royal-navy transition hover:translate-y-[-1px] hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70 ${className}`.trim()}
      disabled={loading}
    >
      {loading ? "جارٍ الإضافة..." : "أضف إلى السلة"}
    </button>
  );
}
