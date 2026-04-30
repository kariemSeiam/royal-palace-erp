"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import { getMyOrders } from "@/lib/orders-api";
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

export default function AccountOrdersPage() {
  const [orders, setOrders] = useState<any[]>([]);
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

        const data = await getMyOrders();
        setOrders(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err?.message || "تعذر تحميل الطلبات.");
        setOrders([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  const totalOrders = useMemo(() => orders.length, [orders]);
  const totalValue = useMemo(
    () => orders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
    [orders]
  );

  return (
    <>
      <StoreHeader />

      <main className="container-royal py-8 md:py-12">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-4 md:mb-8">
          <div>
            <h1 className="text-2xl font-bold text-royal-navy md:text-4xl">طلباتي</h1>
            <p className="mt-2 text-sm leading-7 text-slate-600 md:text-base">
              متابعة الطلبات المرتبطة بالحساب الحالي مع عرض أوضح للحالة والقيمة والتفاصيل.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Link
              href="/account"
              className="rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
            >
              العودة إلى الحساب
            </Link>

            <Link
              href="/catalog"
              className="rounded-full bg-royal-navy px-5 py-3 text-sm font-bold text-white"
            >
              تصفح المنتجات
            </Link>
          </div>
        </div>

        {!loading && !notLoggedIn && !error && orders.length > 0 ? (
          <div className="mb-8 grid gap-4 md:grid-cols-4">
            <div className="rounded-[24px] bg-white p-5 shadow-soft">
              <p className="text-sm text-slate-500">إجمالي الطلبات</p>
              <p className="mt-2 text-3xl font-extrabold text-royal-navy">{totalOrders}</p>
            </div>

            <div className="rounded-[24px] bg-white p-5 shadow-soft">
              <p className="text-sm text-slate-500">إجمالي القيمة</p>
              <p className="mt-2 text-3xl font-extrabold text-royal-gold">{formatPrice(totalValue)}</p>
            </div>

            <div className="rounded-[24px] bg-white p-5 shadow-soft">
              <p className="text-sm text-slate-500">ضريبة القيمة المضافة</p>
              <p className="mt-2 text-3xl font-extrabold text-royal-navy">0%</p>
            </div>

            <div className="rounded-[24px] bg-white p-5 shadow-soft">
              <p className="text-sm text-slate-500">آخر حالة مسجلة</p>
              <p className="mt-2 text-lg font-bold text-royal-navy">
                {orders[0] ? statusLabel(orders[0].status) : "-"}
              </p>
            </div>
          </div>
        ) : null}

        {loading ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <p className="text-slate-600">جارٍ تحميل الطلبات...</p>
          </div>
        ) : notLoggedIn ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">تسجيل الدخول مطلوب</h2>
            <p className="mb-6 text-sm leading-8 text-slate-600">
              يجب تسجيل الدخول أولًا لعرض الطلبات المرتبطة بحسابك.
            </p>
            <Link
              href="/login?next=/account/orders"
              className="inline-flex rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
            >
              تسجيل الدخول
            </Link>
          </div>
        ) : error ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">تعذر تحميل الطلبات</h2>
            <p className="mb-6 text-sm leading-8 text-slate-600">{error}</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
            >
              إعادة المحاولة
            </button>
          </div>
        ) : orders.length === 0 ? (
          <div className="rounded-[28px] bg-white p-10 text-center shadow-soft">
            <h2 className="mb-3 text-2xl font-bold text-royal-navy">لا توجد طلبات بعد</h2>
            <p className="mb-6 text-sm leading-8 text-slate-600">
              لم يتم العثور على طلبات مرتبطة بهذا الحساب حتى الآن.
            </p>
            <Link
              href="/catalog"
              className="inline-flex rounded-full bg-royal-navy px-6 py-3 text-sm font-bold text-white"
            >
              ابدأ التسوق
            </Link>
          </div>
        ) : (
          <div className="space-y-5">
            {orders.map((order) => (
              <div
                key={order.id}
                className="rounded-[28px] border border-[#eadfcb] bg-white p-6 shadow-soft transition hover:shadow-xl"
              >
                <div className="mb-5 flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h2 className="text-xl font-bold text-royal-navy">
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

                <div className="grid gap-4 md:grid-cols-4">
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
                    <p className="mt-1 text-sm leading-7 text-slate-700">{order.shipping_address}</p>
                  </div>
                ) : null}

                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">الإجمالي قبل الضريبة</p>
                    <p className="mt-1 font-bold text-royal-navy">{formatPrice(order.subtotal_amount)}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">VAT</p>
                    <p className="mt-1 font-bold text-royal-navy">{formatPrice(order.vat_amount)}</p>
                  </div>

                  <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
                    <p className="text-xs text-slate-500">الإجمالي النهائي</p>
                    <p className="mt-1 font-bold text-royal-gold">{formatPrice(order.total_amount)}</p>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <Link
                    href={`/account/orders/${order.id}`}
                    className="rounded-full bg-royal-navy px-5 py-3 text-sm font-bold text-white"
                  >
                    عرض التفاصيل
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      <StoreFooter />
    </>
  );
}
