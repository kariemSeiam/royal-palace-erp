"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { getMyOrderDetails } from "@/lib/orders-api";
import { getStoredAccessToken } from "@/lib/auth-storage";

function formatPrice(value?: number | null) {
  return `EGP ${Number(value || 0).toFixed(2)}`;
}

function statusLabel(status?: string) {
  switch (String(status || "").toLowerCase()) {
    case "order_received":
      return "تم استلام الطلب";
    case "materials_allocated":
      return "تم تخصيص الخامات";
    case "manufacturing_started":
      return "بدأ التصنيع";
    case "assembly":
      return "التجميع";
    case "quality_control":
      return "مراجعة الجودة";
    case "packaging":
      return "التعبئة";
    case "delivery_dispatched":
      return "تم الشحن";
    case "delivered":
      return "تم التسليم";
    case "cancelled":
      return "ملغي";
    default:
      return status || "جديد";
  }
}

function paymentStatusLabel(status?: string) {
  switch (String(status || "").toLowerCase()) {
    case "pending":
      return "قيد الانتظار";
    case "paid":
      return "مدفوع";
    case "failed":
      return "فشل الدفع";
    case "refunded":
      return "مسترجع";
    case "cod":
      return "الدفع عند الاستلام";
    default:
      return status || "غير محدد";
  }
}

function statusClass(status?: string) {
  switch (String(status || "").toLowerCase()) {
    case "delivered":
      return "bg-emerald-50 text-emerald-700";
    case "delivery_dispatched":
      return "bg-sky-50 text-sky-700";
    case "cancelled":
      return "bg-rose-50 text-rose-700";
    case "packaging":
    case "quality_control":
    case "assembly":
    case "manufacturing_started":
    case "materials_allocated":
      return "bg-amber-50 text-amber-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
}

function productName(item: any) {
  return (
    item?.product_name ||
    item?.name_ar ||
    item?.name_en ||
    item?.slug ||
    `منتج #${item?.product_id ?? ""}`
  );
}

function formatShippingAddress(address: any) {
  if (!address) return "-";

  if (typeof address === "string") {
    const trimmed = address.trim();
    return trimmed || "-";
  }

  if (typeof address === "object") {
    const parts = [
      address.full_name,
      address.phone,
      address.city,
      address.area,
      address.address_line_1,
      address.address_line_2,
      address.postal_code,
    ]
      .map((value) => (typeof value === "string" ? value.trim() : value))
      .filter(Boolean);

    return parts.length ? parts.join(" - ") : "-";
  }

  return String(address);
}

export default function AccountOrderDetailsPage() {
  const params = useParams();
  const orderId = Array.isArray(params?.id) ? params.id[0] : params?.id;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [notLoggedIn, setNotLoggedIn] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    async function load() {
      try {
        const token = getStoredAccessToken();

        if (!token) {
          setNotLoggedIn(true);
          setLoading(false);
          return;
        }

        if (!orderId) {
          setError("رقم الطلب غير صالح.");
          setLoading(false);
          return;
        }

        const data = await getMyOrderDetails(String(orderId));
        setOrder(data);
      } catch (err: any) {
        setError(err?.message || "تعذر تحميل تفاصيل الطلب.");
        setOrder(null);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, [orderId]);

  const orderSubtotal = useMemo(() => {
    if (!order?.items || !Array.isArray(order.items)) return 0;
    return order.items.reduce(
      (sum: number, item: any) => sum + Number(item.line_total || 0),
      0
    );
  }, [order]);

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 md:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">تفاصيل الطلب</h1>
            <p className="mt-2 text-sm leading-7 text-slate-600 md:text-base">
              عرض كامل لبيانات الطلب والمنتجات والقيم المالية داخل تجربة أوضح وأكثر احترافية.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/account/orders"
              className="rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
            >
              العودة إلى طلباتي
            </Link>

            <Link
              href="/catalog"
              className="rounded-full bg-royal-navy px-5 py-3 text-sm font-bold text-white"
            >
              متابعة التسوق
            </Link>
          </div>
        </div>

        {loading ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <p className="text-slate-600">جارٍ تحميل تفاصيل الطلب...</p>
          </div>
        ) : notLoggedIn ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">تسجيل الدخول مطلوب</h2>
            <p className="mb-6 text-sm leading-8 text-slate-600">
              يجب تسجيل الدخول أولًا لعرض تفاصيل الطلب.
            </p>
            <Link
              href={`/login?next=/account/orders/${orderId || ""}`}
              className="inline-flex rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
            >
              تسجيل الدخول
            </Link>
          </div>
        ) : error ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">تعذر تحميل الطلب</h2>
            <p className="mb-6 text-sm leading-8 text-slate-600">{error}</p>
            <Link
              href="/account/orders"
              className="inline-flex rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
            >
              العودة إلى طلباتي
            </Link>
          </div>
        ) : !order ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">الطلب غير موجود</h2>
            <Link
              href="/account/orders"
              className="inline-flex rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
            >
              العودة إلى طلباتي
            </Link>
          </div>
        ) : (
          <div className="grid gap-8 lg:grid-cols-[.92fr_1.08fr]">
            <div className="space-y-6">
              <section className="rounded-[28px] bg-white p-6 shadow-soft">
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-2xl font-bold text-royal-navy">
                        {order.order_number || `ORD-${order.id}`}
                      </h2>

                      <span
                        className={`rounded-full px-3 py-1 text-xs font-bold ${statusClass(order.status)}`}
                      >
                        {statusLabel(order.status)}
                      </span>
                    </div>

                    <p className="mt-2 text-sm text-slate-500">
                      {order.created_at
                        ? `تاريخ الإنشاء: ${new Date(order.created_at).toLocaleString()}`
                        : "تاريخ الطلب غير متاح"}
                    </p>
                  </div>

                  <div className="rounded-full bg-royal-gold/10 px-4 py-2 text-sm font-bold text-royal-gold">
                    {formatPrice(order.total_amount)}
                  </div>
                </div>

                <div className="mb-4 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">نوع الطلب</p>
                    <p className="mt-1 font-bold text-royal-navy">{order.order_type || "b2c"}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">حالة الدفع</p>
                    <p className="mt-1 font-bold text-royal-navy">
                      {paymentStatusLabel(order.payment_status)}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">العميل</p>
                    <p className="mt-1 font-bold text-royal-navy">{order.customer_name || "-"}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">الهاتف</p>
                    <p className="mt-1 font-bold text-royal-navy">{order.customer_phone || "-"}</p>
                  </div>
                </div>

                {order.shipping_address ? (
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">عنوان الشحن</p>
                    <p className="mt-1 text-sm leading-7 text-slate-700">
                      {formatShippingAddress(order.shipping_address)}
                    </p>
                  </div>
                ) : null}

                {order.notes ? (
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">ملاحظات الطلب</p>
                    <p className="mt-1 text-sm leading-7 text-slate-700">{order.notes}</p>
                  </div>
                ) : null}
              </section>

              <section className="rounded-[28px] bg-white p-6 shadow-soft">
                <h2 className="mb-5 text-2xl font-bold text-royal-navy">ملخص القيم</h2>

                <div className="space-y-4">
                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
                    <span className="text-sm text-slate-500">إجمالي المنتجات</span>
                    <span className="font-bold text-royal-navy">{formatPrice(orderSubtotal)}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-slate-50 px-4 py-4">
                    <span className="text-sm text-slate-500">VAT</span>
                    <span className="font-bold text-royal-navy">{formatPrice(order.vat_amount)}</span>
                  </div>

                  <div className="flex items-center justify-between rounded-2xl bg-royal-gold/10 px-4 py-4">
                    <span className="text-sm font-bold text-slate-700">الإجمالي النهائي</span>
                    <span className="text-xl font-extrabold text-royal-gold">
                      {formatPrice(order.total_amount)}
                    </span>
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-[28px] bg-white p-6 shadow-soft">
              <h2 className="mb-5 text-2xl font-bold text-royal-navy">المنتجات</h2>

              {Array.isArray(order.items) && order.items.length ? (
                <div className="space-y-4">
                  {order.items.map((item: any, index: number) => {
                    const lineTotal =
                      item?.line_total != null
                        ? Number(item.line_total || 0)
                        : Number(item?.unit_price || 0) * Number(item?.quantity || 0);

                    return (
                      <div
                        key={String(item?.id ?? `${item?.product_id ?? "item"}-${index}`)}
                        className="rounded-3xl border border-[#eadfcb] bg-slate-50 p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="min-w-0 flex-1">
                            <h3 className="text-lg font-bold text-royal-navy">{productName(item)}</h3>
                            <p className="mt-1 text-sm text-slate-500">{item?.sku || "-"}</p>
                          </div>

                          <div className="rounded-full bg-royal-gold/10 px-4 py-2 text-sm font-bold text-royal-gold">
                            {formatPrice(lineTotal)}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-3">
                          <div className="rounded-2xl border border-white bg-white p-3">
                            <p className="text-xs text-slate-500">الكمية</p>
                            <p className="mt-1 font-bold text-royal-navy">{Number(item?.quantity || 0)}</p>
                          </div>

                          <div className="rounded-2xl border border-white bg-white p-3">
                            <p className="text-xs text-slate-500">سعر الوحدة</p>
                            <p className="mt-1 font-bold text-royal-navy">
                              {formatPrice(item?.unit_price)}
                            </p>
                          </div>

                          <div className="rounded-2xl border border-white bg-white p-3">
                            <p className="text-xs text-slate-500">إجمالي البند</p>
                            <p className="mt-1 font-bold text-royal-gold">{formatPrice(lineTotal)}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-slate-500">
                  لا توجد بنود داخل هذا الطلب.
                </div>
              )}
            </section>
          </div>
        )}
      </main>

      <StoreFooter />
    </>
  );
}
