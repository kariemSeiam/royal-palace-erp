import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getFactories } from "../features/erp/api";
import { erpColors } from "../theme/tokens";

export default function FactoriesModuleScreen() {
  const factoriesQuery = useQuery({
    queryKey: ["mobile-erp-factories"],
    queryFn: getFactories,
    retry: false
  });

  const factories = Array.isArray(factoriesQuery.data) ? factoriesQuery.data : [];
  const active = factories.filter((item) => item.is_active !== false).length;

  if (factoriesQuery.isLoading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل المصانع...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (factoriesQuery.isError) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل المصانع</Text>
            <Text style={boxBody}>{factoriesQuery.error instanceof Error ? factoriesQuery.error.message : "حدث خطأ غير متوقع."}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>FACTORIES</Text>
          <Text style={heroTitle}>المصانع</Text>
          <Text style={heroBody}>إدارة نطاقات التشغيل والمصانع بنفس بيانات الإدارة الحالية.</Text>
        </View>

        <View style={row}>
          <StatCard label="إجمالي المصانع" value={factories.length} />
          <StatCard label="النشطة" value={active} />
        </View>

        <View style={box}>
          <Text style={boxTitle}>قائمة المصانع</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {factories.length ? factories.map((item) => (
              <View key={String(item.id)} style={itemCard}>
                <Text style={itemTitle}>{item.name}</Text>
                <Text style={itemBody}>الكود: {item.code || "-"}</Text>
                <Text style={itemBody}>المعرف: #{item.id}</Text>
                <Text style={[itemBody, { color: item.is_active !== false ? erpColors.success : erpColors.danger, fontWeight: "700" }]}>
                  {item.is_active !== false ? "نشط" : "غير نشط"}
                </Text>
              </View>
            )) : <Text style={boxBody}>لا توجد مصانع متاحة.</Text>}
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
