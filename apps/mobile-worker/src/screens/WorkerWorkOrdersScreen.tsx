import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { getWorkerWorkOrders } from "../features/work_orders/api";

const statusIcon = (s?: string) => {
  const st = (s || "").toLowerCase();
  if (st === "completed" || st === "مكتمل") return "✅ مكتمل";
  if (st === "cancelled" || st === "ملغي") return "❌ ملغي";
  if (st === "manufacturing_started" || st === "بدأ التصنيع") return "🏭 جارٍ";
  if (st === "pending" || st === "قيد الانتظار") return "⏳ انتظار";
  return `📋 ${s || "-"}`;
};

export default function WorkerWorkOrdersScreen() {
  const q = useQuery({
    queryKey: ["worker-work-orders"],
    queryFn: getWorkerWorkOrders,
    retry: false,
    refetchInterval: 10000,
  });

  const rows = Array.isArray(q.data?.items) ? q.data.items : [];

  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: "#0B1F3A" }}>
      <ScrollView
        contentContainerStyle={{ padding: 16, paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={q.isFetching} onRefresh={() => q.refetch()} colors={["#D4AF37"]} tintColor="#D4AF37" />}
      >
        <Text style={{ color: "#FFFFFF", fontSize: 26, fontWeight: "800", marginBottom: 20, textAlign:"center", writingDirection: "rtl" }}>
          📋 أوامر التشغيل
        </Text>
        {q.isLoading ? (
          <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
            <ActivityIndicator size="large" color="#D4AF37" />
            <Text style={{ marginTop: 12, color: "#FFFFFF", fontWeight: "700", writingDirection: "rtl" }}>
              جارٍ التحميل...
            </Text>
          </View>
        ) : rows.length === 0 ? (
          <View
            style={{
              backgroundColor: "rgba(255,255,255,0.06)",
              borderRadius: 24,
              padding: 24,
              borderWidth: 1,
              borderColor: "rgba(212,175,55,0.15)",
            }}
          >
            <Text
              style={{
                textAlign: "center",
                color: "#CBD5E1",
                fontWeight: "600",
                writingDirection: "rtl",
              }}
            >
              لا توجد أوامر تشغيل حالياً.
            </Text>
          </View>
        ) : (
          rows.map((row: any) => (
            <View
              key={String(row.id)}
              style={{
                backgroundColor: "rgba(255,255,255,0.06)",
                borderRadius: 24,
                padding: 20,
                borderWidth: 1,
                borderColor: "rgba(212,175,55,0.15)",
                marginBottom: 14,
              }}
            >
              <View
                style={{
                  flexDirection: "row-reverse",
                  justifyContent: "space-between",
                  marginBottom: 12,
                }}
              >
                <Text
                  style={{
                    color: "#FFFFFF",
                    fontWeight: "800",
                    fontSize: 20,
                    textAlign:"center",
                    writingDirection: "rtl",
                  }}
                >
                  {row.order_number || `#${row.order_id}`}
                </Text>
                <Text style={{ color: "#D4AF37", fontWeight: "700", writingDirection: "rtl" }}>
                  {statusIcon(row.status)}
                </Text>
              </View>
              <Text
                style={{
                  color: "#CBD5E1",
                  textAlign:"center",
                  marginBottom: 6,
                  fontSize: 15,
                  writingDirection: "rtl",
                }}
              >
                🏭 {row.factory_name || `مصنع #${row.factory_id}`}
              </Text>
              <Text
                style={{
                  color: "#CBD5E1",
                  textAlign:"center",
                  marginBottom: 6,
                  fontSize: 15,
                  writingDirection: "rtl",
                }}
              >
                📦 عدد المنتجات: {row.items_count}
              </Text>
              <Text
                style={{
                  color: "#CBD5E1",
                  textAlign:"center",
                  fontSize: 15,
                  writingDirection: "rtl",
                }}
              >
                👤 المسؤول: {row.assigned_employee_name || "-"}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
