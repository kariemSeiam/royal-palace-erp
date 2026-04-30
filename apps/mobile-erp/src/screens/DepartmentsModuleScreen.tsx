import { useQueries } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getDepartments, getFactories } from "../features/erp/api";
import { erpColors } from "../theme/tokens";

export default function DepartmentsModuleScreen() {
  const results = useQueries({
    queries: [
      { queryKey: ["mobile-erp-departments"], queryFn: getDepartments, retry: false },
      { queryKey: ["mobile-erp-departments-factories"], queryFn: getFactories, retry: false }
    ]
  });

  const [departmentsQuery, factoriesQuery] = results;

  if (results.some((item) => item.isLoading)) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل الأقسام...</Text>
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
            <Text style={boxTitle}>تعذر تحميل الأقسام</Text>
            <Text style={boxBody}>{firstError instanceof Error ? firstError.message : "حدث خطأ غير متوقع."}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const departments = Array.isArray(departmentsQuery.data) ? departmentsQuery.data : [];
  const factories = Array.isArray(factoriesQuery.data) ? factoriesQuery.data : [];
  const factoryMap = Object.fromEntries(factories.map((item) => [item.id, item.name]));

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>DEPARTMENTS</Text>
          <Text style={heroTitle}>الأقسام</Text>
          <Text style={heroBody}>نفس بيانات وحدة الأقسام الحالية مع الربط بالمصانع داخل نطاق المستخدم.</Text>
        </View>

        <View style={row}>
          <StatCard label="إجمالي الأقسام" value={departments.length} />
          <StatCard label="المصانع المغطاة" value={new Set(departments.map((item) => item.factory_id)).size} />
        </View>

        <View style={box}>
          <Text style={boxTitle}>قائمة الأقسام</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {departments.length ? departments.map((item) => (
              <View key={String(item.id)} style={itemCard}>
                <Text style={itemTitle}>{item.name}</Text>
                <Text style={itemBody}>الكود: {item.code || "-"}</Text>
                <Text style={itemBody}>المصنع: {factoryMap[item.factory_id] || `#${item.factory_id}`}</Text>
                <Text style={[itemBody, { color: item.is_active !== false ? erpColors.success : erpColors.danger, fontWeight: "700" }]}>
                  {item.is_active !== false ? "نشط" : "غير نشط"}
                </Text>
              </View>
            )) : <Text style={boxBody}>لا توجد أقسام متاحة.</Text>}
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
