import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getItOverview } from "../features/it/api";
import { erpColors } from "../theme/tokens";

export default function InfrastructureModuleScreen() {
  const query = useQuery({
    queryKey: ["mobile-erp-infrastructure-overview"],
    queryFn: getItOverview,
    retry: false
  });

  if (query.isLoading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل البنية التحتية...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (query.isError || !query.data) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل البنية التحتية</Text>
            <Text style={boxBody}>{query.error instanceof Error ? query.error.message : "حدث خطأ غير متوقع."}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const data = query.data;
  const probes = Array.isArray(data.service_probes) ? data.service_probes : [];

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>INFRASTRUCTURE</Text>
          <Text style={heroTitle}>البنية التحتية</Text>
          <Text style={heroBody}>
            ملخص حي لحالة الخدمات والمسارات والعدادات الأساسية من IT overview.
          </Text>
        </View>

        <View style={row}>
          <StatCard label="Users" value={data.summary_counts?.users_count ?? 0} />
          <StatCard label="Roles" value={data.summary_counts?.roles_count ?? 0} />
        </View>
        <View style={row}>
          <StatCard label="Factories" value={data.summary_counts?.factories_count ?? 0} />
          <StatCard label="Orders" value={data.summary_counts?.orders_count ?? 0} />
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>فحص الخدمات</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {probes.map((item) => (
              <View key={item.key} style={itemCard}>
                <Text style={itemTitle}>{item.label}</Text>
                <Text style={itemBody}>Status: {item.status}</Text>
                <Text style={itemBody}>Detail: {item.detail || "-"}</Text>
                <Text style={itemBody}>Note: {item.note || "-"}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={box}>
          <Text style={boxTitle}>المسارات المرئية من API</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {Object.entries(data.path_visibility || {}).map(([key, item]) => (
              <View key={key} style={itemCard}>
                <Text style={itemTitle}>{key}</Text>
                <Text style={itemBody}>Path: {item.path}</Text>
                <Text style={itemBody}>Visible: {item.exists_from_api_container ? "Yes" : "No"}</Text>
                <Text style={itemBody}>Type: {item.is_dir ? "Directory" : item.is_file ? "File" : "-"}</Text>
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
