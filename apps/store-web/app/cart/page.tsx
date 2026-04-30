"use client";

import Link from "next/link";
import { Minus, Plus, Trash2 } from "lucide-react";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { useCart } from "@/components/cart-provider";

function formatPrice(value?: number | null) {
  return `EGP ${Number(value || 0)}`;
}

export default function CartPage() {
  const { items, subtotal, updateQuantity, removeItem } = useCart();

  const total = Number(subtotal || 0);

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 md:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">السلة</h1>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600 md:text-base">
              راجع المنتجات المختارة، عدّل الكميات بسهولة، ثم انتقل إلى إتمام الطلب.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/catalog"
              className="rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
            >
              متابعة التسوق
            </Link>
            <Link
              href="/checkout"
              className="rounded-full bg-royal-navy px-5 py-3 text-sm font-bold text-white"
            >
              الانتقال إلى الدفع
            </Link>
          </div>
        </div>

        {items.length === 0 ? (
          <div className="rounded-[28px] border border-[#eadfcb] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">السلة فارغة</h2>
            <p className="mb-6 text-sm leading-8 text-slate-600">
              لم تقم بإضافة أي منتجات بعد. ابدأ التصفح واختر ما يناسبك من الكتالوج.
            </p>
            <Link
              href="/catalog"
              className="inline-flex rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
            >
              ابدأ التصفح
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[1.15fr_.85fr]">
            <div className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="rounded-[28px] border border-[#eadfcb] bg-white p-5 shadow-soft md:p-6"
                >
                  <div className="flex flex-col gap-5 md:flex-row md:items-center">
                    <div className="h-28 w-full overflow-hidden rounded-[24px] bg-slate-100 md:w-32">
                      {item.image_url ? (
                        <img
                          src={item.image_url}
                          alt={item.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-slate-400">
                          لا توجد صورة
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-xl font-bold text-royal-navy">{item.name}</h2>
                          <p className="mt-2 text-sm text-slate-500">
                            السعر للوحدة: {formatPrice(item.price)}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => removeItem(item.id)}
                          className="inline-flex items-center gap-2 rounded-full border border-red-200 px-4 py-2 text-sm font-bold text-red-600 transition hover:bg-red-50"
                        >
                          <Trash2 size={16} />
                          حذف
                        </button>
                      </div>

                      <div className="mt-5 flex flex-wrap items-center justify-between gap-4">
                        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-2 py-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateQuantity(item.id, Math.max(1, item.quantity - 1))
                            }
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700"
                          >
                            <Minus size={16} />
                          </button>

                          <span className="min-w-[36px] text-center text-sm font-bold text-royal-navy">
                            {item.quantity}
                          </span>

                          <button
                            type="button"
                            onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-700"
                          >
                            <Plus size={16} />
                          </button>
                        </div>

                        <div className="rounded-full bg-royal-gold/10 px-4 py-2 text-sm font-bold text-royal-gold">
                          {formatPrice((item.price || 0) * item.quantity)}
                        </div>
                      </div>

                      {item.slug ? (
                        <div className="mt-4">
                          <Link
                            href={`/products/${item.slug}`}
                            className="text-sm font-bold text-royal-navy underline underline-offset-4"
                          >
                            عرض صفحة المنتج
                          </Link>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <aside className="h-fit rounded-[28px] bg-white p-6 shadow-soft lg:sticky lg:top-28">
              <div className="mb-5">
                <p className="text-xs font-bold tracking-[0.22em] text-royal-gold">
                  ORDER SUMMARY
                </p>
                <h2 className="mt-2 text-2xl font-bold text-royal-navy">ملخص السلة</h2>
              </div>

              <div className="mb-5 rounded-2xl border border-[#eadfcb] bg-[#fcfaf6] p-4">
                <p className="mb-2 text-xs font-semibold text-slate-500">ملاحظات سريعة</p>
                <p className="text-sm leading-7 text-slate-700">
                  يمكنك تعديل الكميات الآن، ثم متابعة إتمام الطلب داخل صفحة الدفع.
                </p>
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">عدد البنود</span>
                  <span className="font-bold text-royal-navy">{items.length}</span>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-500">الإجمالي</span>
                  <span className="font-bold text-royal-navy">{formatPrice(total)}</span>
                </div>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-slate-100 pt-6">
                <span className="text-base font-bold text-slate-600">الإجمالي النهائي</span>
                <span className="text-2xl font-extrabold text-royal-gold">
                  {formatPrice(total)}
                </span>
              </div>

              <Link
                href="/checkout"
                className="mt-6 flex w-full items-center justify-center rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
              >
                المتابعة إلى الدفع
              </Link>

              <Link
                href="/catalog"
                className="mt-3 flex w-full items-center justify-center rounded-full border border-slate-200 px-6 py-3 text-sm font-bold text-slate-700"
              >
                متابعة التسوق
              </Link>
            </aside>
          </div>
        )}
      </main>

      <StoreFooter />
    </>
  );
}
