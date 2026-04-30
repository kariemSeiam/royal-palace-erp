import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getInventoryMovements, getStockSummary, getWarehouses } from "../features/inventory/api";
import { erpColors } from "../theme/tokens";

export default function InventoryModuleScreen() {
  const results = useQueries({
    queries: [
      { queryKey: ["mobile-erp-inventory-movements"], queryFn: getInventoryMovements, retry: false },
      { queryKey: ["mobile-erp-stock-summary"], queryFn: getStockSummary, retry: false },
      { queryKey: ["mobile-erp-inventory-warehouses"], queryFn: getWarehouses, retry: false }
    ]
  });

  const [movementsQuery, stockQuery, warehousesQuery] = results;

  if (results.some((item) => item.isLoading)) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}><Text style={loadingText}>جاري تحميل المخزون...</Text></View>
      </SafeAreaView>
    );
  }

  if (results.some((item) => item.isError)) {
    const firstError = results.find((item) => item.error)?.error;
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل المخزون</Text>
            <Text style={boxBody}>{firstError instanceof Error ? firstError.message : "حدث خطأ غير متوقع."}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const movements = Array.isArray(movementsQuery.data) ? movementsQuery.data : [];
  const stockRows = Array.isArray(stockQuery.data) ? stockQuery.data : [];
  const warehouses = Array.isArray(warehousesQuery.data) ? warehousesQuery.data : [];

  const stats = useMemo(() => {
    return {
      movements: movements.length,
      stockLines: stockRows.length,
      warehouses: warehouses.length,
      additions: movements.filter((m) => m.movement_type === "in").length,
      deductions: movements.filter((m) => m.movement_type === "out").length
    };
  }, [movements, stockRows, warehouses]);

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>INVENTORY</Text>
          <Text style={heroTitle}>المخزون</Text>
          <Text style={heroBody}>حركات المخزون وملخص الأرصدة بنفس APIs الإدارة الحالية.</Text>
        </View>

        <View style={row}>
          <StatCard label="الحركات" value={stats.movements} />
          <StatCard label="سطور الرصيد" value={stats.stockLines} />
        </View>
        <View style={row}>
          <StatCard label="المخازن" value={stats.warehouses} />
          <StatCard label="إضافات" value={stats.additions} />
        </View>
        <View style={row}>
          <StatCard label="صرف" value={stats.deductions} />
          <StatCard label="نشاط" value={stats.movements > 0 ? "موجود" : "لا يوجد"} />
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>ملخص الأرصدة</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {stockRows.slice(0, 20).map((item, index) => (
              <View key={`${item.warehouse_id}-${item.product_id}-${index}`} style={itemCard}>
                <Text style={itemTitle}>{item.product_name || "-"}</Text>
                <Text style={itemBody}>SKU: {item.product_sku || "-"}</Text>
                <Text style={itemBody}>المصنع: {item.factory_name || `#${item.factory_id}`}</Text>
                <Text style={itemBody}>المخزن: {item.warehouse_name || `#${item.warehouse_id}`}</Text>
                <Text style={itemBody}>الرصيد الحالي: {String(item.current_stock ?? 0)}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={box}>
          <Text style={boxTitle}>آخر الحركات</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {movements.slice(0, 20).map((item) => (
              <View key={String(item.id)} style={itemCard}>
                <Text style={itemTitle}>{item.product_name || "-"}</Text>
                <Text style={itemBody}>المصنع: {item.factory_name || `#${item.factory_id}`}</Text>
                <Text style={itemBody}>المخزن: {item.warehouse_name || `#${item.warehouse_id}`}</Text>
                <Text style={itemBody}>النوع: {item.movement_type || "-"}</Text>
                <Text style={itemBody}>الكمية: {String(item.quantity ?? 0)}</Text>
                <Text style={itemBody}>المرجع: {item.reference_type || "-"} {item.reference_id ? `#${item.reference_id}` : ""}</Text>
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
