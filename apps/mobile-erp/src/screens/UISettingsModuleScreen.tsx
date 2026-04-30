import { useQueries } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getItAccessCenterSummary, getItGovernanceSummary, getItOverview } from "../features/it/api";
import { erpColors } from "../theme/tokens";

export default function UISettingsModuleScreen() {
  const results = useQueries({
    queries: [
      { queryKey: ["mobile-erp-ui-overview"], queryFn: getItOverview, retry: false },
      { queryKey: ["mobile-erp-ui-governance"], queryFn: getItGovernanceSummary, retry: false },
      { queryKey: ["mobile-erp-ui-access"], queryFn: getItAccessCenterSummary, retry: false }
    ]
  });

  const [overviewQuery, governanceQuery, accessQuery] = results;
  const overview = overviewQuery.data;
  const governance = governanceQuery.data;
  const summary = accessQuery.data?.summary;

  if (results.every((item) => item.isLoading)) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل إعدادات الواجهة...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>UI CONTROL CENTER</Text>
          <Text style={heroTitle}>إعدادات الواجهة</Text>
          <Text style={heroBody}>
            مركز تشغيلي لإدارة الوضع البصري العام واتساق تجربة الإدارة العربية RTL-first.
          </Text>
        </View>

        <View style={row}>
          <StatCard label="RTL" value={governance?.theme?.is_rtl ? "On" : "Off"} />
          <StatCard label="Health DB" value={overview?.database_probe?.status || "unknown"} />
        </View>
        <View style={row}>
          <StatCard label="IT Users" value={summary?.total_users_with_it_access ?? 0} />
          <StatCard label="IT Roles" value={summary?.total_roles_with_it_permissions ?? 0} />
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>الوضع الحالي</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            <QuickRow label="Dashboard Layout" value={governance?.ui_settings?.dashboard_layout || "-"} />
            <QuickRow label="Cards Density" value={governance?.ui_settings?.cards_density || "-"} />
            <QuickRow
              label="Animations"
              value={governance?.ui_settings?.enable_animations ? "Enabled" : "Disabled"}
            />
            <QuickRow label="Sidebar Style" value={governance?.ui_settings?.sidebar_style || "-"} />
          </View>
        </View>

        <View style={box}>
          <Text style={boxTitle}>المرحلة القادمة</Text>
          <Text style={boxBody}>
            يمكن إضافة مفاتيح ألوان وخطوط وكثافة بطاقات و hero variants و global toggles من نفس الوحدة لاحقًا.
          </Text>
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

function QuickRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={quickRow}>
      <Text style={quickLabel}>{label}</Text>
      <Text style={quickValue}>{value}</Text>
    </View>
  );
}

const screen = { flex: 1, backgroundColor: erpColors.bg };
const centered = { flex: 1, alignItems: "center" as const, justifyContent: "center" as const };
const loadingText = { color: erpColors.text, fontWeight: "700" as const };
const hero = { backgroundColor: erpColors.navy2, borderRadius: 28, padding: 20, marginBottom: 12 };
const heroTop = { color: erpColors.gold, fontWeight: "800" as const, textAlign: "right" as const };
const heroTitle = {
  marginTop: 8,
  color: "#fff",
  fontSize: 28,
  fontWeight: "800" as const,
  textAlign: "right" as const
};
const heroBody = {
  marginTop: 10,
  color: "rgba(255,255,255,0.78)",
  lineHeight: 24,
  textAlign: "right" as const
};
const row = { flexDirection: "row-reverse" as const, gap: 10, marginBottom: 12 };
const statCard = {
  flex: 1,
  backgroundColor: "#ffffff",
  borderRadius: 20,
  padding: 16,
  borderWidth: 1,
  borderColor: erpColors.border
};
const statLabel = { color: erpColors.textMuted, fontWeight: "700" as const, textAlign: "right" as const };
const statValue = {
  marginTop: 8,
  color: erpColors.text,
  fontWeight: "800" as const,
  fontSize: 22,
  textAlign: "right" as const
};
const box = {
  backgroundColor: "#ffffff",
  borderRadius: 24,
  padding: 20,
  borderWidth: 1,
  borderColor: erpColors.border
};
const boxTitle = { color: erpColors.text, fontWeight: "800" as const, fontSize: 20, textAlign: "right" as const };
const boxBody = { marginTop: 10, color: erpColors.textMuted, lineHeight: 24, textAlign: "right" as const };
const quickRow = {
  flexDirection: "row-reverse" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  borderBottomWidth: 1,
  borderBottomColor: "#eef2f7",
  paddingBottom: 10
};
const quickLabel = { color: erpColors.textSoft, fontWeight: "700" as const };
const quickValue = { color: erpColors.text, fontWeight: "800" as const };
