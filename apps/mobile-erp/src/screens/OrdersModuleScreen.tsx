import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getOrders, getOrderWarehouseOptions } from "../features/orders/api";
import { erpColors } from "../theme/tokens";

function normalizeText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function formatAmount(value?: string | number | null) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function resolveStatusTone(status?: string | null) {
  const s = normalizeText(status);
  if (s === "delivered" || s === "delivery_dispatched") return erpColors.success;
  if (s === "cancelled") return erpColors.danger;
  return erpColors.warning;
}

export default function OrdersModuleScreen() {
  const results = useQueries({
    queries: [
      { queryKey: ["mobile-erp-orders"], queryFn: getOrders, retry: false },
      { queryKey: ["mobile-erp-order-warehouses"], queryFn: getOrderWarehouseOptions, retry: false }
    ]
  });

  const [ordersQuery, warehousesQuery] = results;

  if (results.some((item) => item.isLoading)) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل الطلبات...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (results.some((item) => item.isError)) {
    const firstError = results.find((item) => item.error)?.error;
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل الطلبات</Text>
            <Text style={boxBody}>{firstError instanceof Error ? firstError.message : "حدث خطأ غير متوقع."}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const orders = Array.isArray(ordersQuery.data) ? ordersQuery.data : [];
  const warehouses = Array.isArray(warehousesQuery.data) ? warehousesQuery.data : [];

  const stats = useMemo(() => {
    const masters = orders.filter((o) => Boolean(o.is_master_order) || !o.parent_order_id);
    return {
      total: masters.length,
      children: orders.filter((o) => o.parent_order_id).length,
      delivered: orders.filter((o) => normalizeText(o.status) === "delivered").length,
      dispatched: orders.filter((o) => normalizeText(o.status) === "delivery_dispatched").length,
      cancelled: orders.filter((o) => normalizeText(o.status) === "cancelled").length,
      paid: orders.filter((o) => normalizeText(o.payment_status) === "paid").length
    };
  }, [orders]);

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>ORDERS</Text>
          <Text style={heroTitle}>الطلبات</Text>
          <Text style={heroBody}>نفس بيانات وحدة الطلبات الحالية مع احترام المصنع والمخزن والمرحلة التنفيذية.</Text>
        </View>

        <View style={row}>
          <StatCard label="الرئيسية" value={stats.total} />
          <StatCard label="الفرعية" value={stats.children} />
        </View>
        <View style={row}>
          <StatCard label="تم الشحن" value={stats.dispatched} />
          <StatCard label="تم التسليم" value={stats.delivered} />
        </View>
        <View style={row}>
          <StatCard label="الملغاة" value={stats.cancelled} />
          <StatCard label="المدفوعة" value={stats.paid} />
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>المخازن المتاحة للطلبات</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {warehouses.slice(0, 12).map((item) => (
              <View key={String(item.id)} style={itemCard}>
                <Text style={itemTitle}>{item.name || "-"}</Text>
                <Text style={itemBody}>المصنع: {item.factory_name || `#${item.factory_id}`}</Text>
                <Text style={itemBody}>الكود: {item.code || "-"}</Text>
                <Text style={[itemBody, { color: item.is_active !== false ? erpColors.success : erpColors.danger, fontWeight: "700" }]}>
                  {item.is_active !== false ? "نشط" : "غير نشط"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        <View style={box}>
          <Text style={boxTitle}>أحدث الطلبات</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {orders.slice(0, 20).map((item) => (
              <View key={String(item.id)} style={itemCard}>
                <Text style={itemTitle}>{item.order_number || `Order #${item.id}`}</Text>
                <Text style={itemBody}>العميل: {item.customer_name || "-"}</Text>
                <Text style={itemBody}>المصنع: {item.factory_name || (item.factory_id ? `#${item.factory_id}` : "-")}</Text>
                <Text style={itemBody}>المخزن: {item.warehouse_name || (item.warehouse_id ? `#${item.warehouse_id}` : "-")}</Text>
                <Text style={itemBody}>الدفع: {item.payment_status || "-"}</Text>
                <Text style={[itemBody, { color: resolveStatusTone(item.status), fontWeight: "700" }]}>
                  الحالة: {item.status || "-"}
                </Text>
                <Text style={itemBody}>الإجمالي: {formatAmount(item.total_amount)}</Text>
              </View>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={statCard}>
      <Text style={statLabel}>{label}</Text>
      <Text style={statValue}>{value}</Text>
    </View>
  );
}

const screen = { flex: 1, backgroundColor: erpColors.bg };
const centered = { flex: 1, alignItems: "center" as const, justifyContent: "center" as const };
const loadingText = { color: erpColors.text, fontWeight: "700" as const };
const errorWrap = { flex: 1, justifyContent: "center" as const, padding: 16 };
const hero = { backgroundColor: erpColors.navy2, borderRadius: 28, padding: 20, marginBottom: 12 };
const heroTop = { color: erpColors.gold, fontWeight: "800" as const, textAlign: "right" as const };
const heroTitle = { marginTop: 8, color: "#fff", fontSize: 28, fontWeight: "800" as const, textAlign: "right" as const };
const heroBody = { marginTop: 10, color: "rgba(255,255,255,0.78)", lineHeight: 24, textAlign: "right" as const };
const row = { flexDirection: "row-reverse" as const, gap: 10, marginBottom: 12 };
const statCard = { flex: 1, backgroundColor: "#ffffff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: erpColors.border };
const statLabel = { color: erpColors.textMuted, fontWeight: "700" as const, textAlign: "right" as const };
const statValue = { marginTop: 8, color: erpColors.text, fontWeight: "800" as const, fontSize: 22, textAlign: "right" as const };
const box = { backgroundColor: "#ffffff", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: erpColors.border };
const boxTitle = { color: erpColors.text, fontWeight: "800" as const, fontSize: 20, textAlign: "right" as const };
const boxBody = { marginTop: 10, color: erpColors.textMuted, lineHeight: 24, textAlign: "right" as const };
const itemCard = { backgroundColor: "#f8fafc", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: erpColors.border };
const itemTitle = { color: erpColors.text, fontWeight: "800" as const, textAlign: "right" as const };
const itemBody = { marginTop: 6, color: erpColors.textMuted, textAlign: "right" as const };
