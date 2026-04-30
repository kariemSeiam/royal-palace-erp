import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDashboardStats } from "../features/dashboard/api";
import { erpColors } from "../theme/tokens";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={statCard}>
      <Text style={statLabel}>{label}</Text>
      <Text style={statValue}>{value}</Text>
    </View>
  );
}

export default function DashboardModuleScreen() {
  const statsQuery = useQuery({
    queryKey: ["mobile-erp-dashboard-stats"],
    queryFn: getDashboardStats,
    retry: false
  });

  if (statsQuery.isLoading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل لوحة التحكم...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (statsQuery.isError || !statsQuery.data) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل لوحة التحكم</Text>
            <Text style={boxBody}>
              {statsQuery.error instanceof Error ? statsQuery.error.message : "حدث خطأ غير متوقع."}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const data = statsQuery.data;
  const summary = data.summary;

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>DASHBOARD</Text>
          <Text style={heroTitle}>لوحة التحكم</Text>
          <Text style={heroBody}>
            نفس بيانات لوحة التحكم الحالية من API الإدارة مع احترام نفس نطاق الصلاحيات والمصانع.
          </Text>
        </View>

        <View style={row}>
          <StatCard label="المصانع" value={summary.factories_count} />
          <StatCard label="الأقسام" value={summary.departments_count} />
        </View>
        <View style={row}>
          <StatCard label="الموظفون" value={summary.employees_count} />
          <StatCard label="الحضور" value={summary.attendance_count} />
        </View>
        <View style={row}>
          <StatCard label="الطلبات" value={summary.orders_count} />
          <StatCard label="المستخدمون" value={summary.users_count} />
        </View>
        <View style={row}>
          <StatCard label="الأدوار" value={summary.roles_count} />
          <StatCard label="المنتجات" value={summary.products_count} />
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>حالات الطلبات</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {data.order_status_breakdown?.length ? (
              data.order_status_breakdown.map((item) => (
                <View key={`${item.status}-${item.count}`} style={kvRow}>
                  <Text style={kvLabel}>{item.status || "-"}</Text>
                  <Text style={kvValue}>{item.count}</Text>
                </View>
              ))
            ) : (
              <Text style={boxBody}>لا توجد بيانات حالات طلبات.</Text>
            )}
          </View>
        </View>

        <View style={box}>
          <Text style={boxTitle}>نظرة على المصانع</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {data.factory_overview?.length ? (
              data.factory_overview.map((item) => (
                <View key={String(item.id)} style={itemCard}>
                  <Text style={itemTitle}>{item.name} ({item.code})</Text>
                  <Text style={itemBody}>الأقسام: {item.departments_count}</Text>
                  <Text style={itemBody}>الموظفون: {item.employees_count}</Text>
                  <Text style={[itemBody, { color: item.is_active ? erpColors.success : erpColors.danger, fontWeight: "700" }]}>
                    {item.is_active ? "نشط" : "غير نشط"}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={boxBody}>لا توجد بيانات مصانع متاحة.</Text>
            )}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
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
const kvRow = { flexDirection: "row-reverse" as const, justifyContent: "space-between" as const, alignItems: "center" as const, borderBottomWidth: 1, borderBottomColor: "#eef2f7", paddingBottom: 10 };
const kvLabel = { color: erpColors.textSoft, fontWeight: "700" as const };
const kvValue = { color: erpColors.text, fontWeight: "800" as const };
const itemCard = { backgroundColor: "#f8fafc", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: erpColors.border };
const itemTitle = { color: erpColors.text, fontWeight: "800" as const, textAlign: "right" as const };
const itemBody = { marginTop: 6, color: erpColors.textMuted, textAlign: "right" as const };
