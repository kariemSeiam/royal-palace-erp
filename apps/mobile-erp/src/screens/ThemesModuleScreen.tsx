import { useQueries } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getItAccessCenterSummary, getItGovernanceSummary, getMediaCategories } from "../features/it/api";
import { erpColors } from "../theme/tokens";

export default function ThemesModuleScreen() {
  const results = useQueries({
    queries: [
      { queryKey: ["mobile-erp-themes-governance"], queryFn: getItGovernanceSummary, retry: false },
      { queryKey: ["mobile-erp-themes-access"], queryFn: getItAccessCenterSummary, retry: false },
      { queryKey: ["mobile-erp-themes-categories"], queryFn: getMediaCategories, retry: false }
    ]
  });

  const [governanceQuery, accessQuery, categoriesQuery] = results;
  const governance = governanceQuery.data;
  const summary = accessQuery.data?.summary;
  const categories = Array.isArray(categoriesQuery.data) ? categoriesQuery.data : [];

  if (results.every((item) => item.isLoading)) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل الثيمات...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>THEME GOVERNANCE</Text>
          <Text style={heroTitle}>الثيمات والهوية اللونية</Text>
          <Text style={heroBody}>
            صفحة تشغيلية لمتابعة وضع الثيم الرئيسي وعلاقته بحوكمة IT والكتالوج الحالي.
          </Text>
        </View>

        <View style={row}>
          <StatCard label="Theme" value={governance?.theme?.theme_name || "RP"} />
          <StatCard label="Sections" value={categories.length} />
        </View>
        <View style={row}>
          <StatCard label="IT Users" value={summary?.total_users_with_it_access ?? 0} />
          <StatCard label="IT Roles" value={summary?.total_roles_with_it_permissions ?? 0} />
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>الحالة الحالية</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            <QuickRow label="Primary Color" value={governance?.theme?.primary_color || "-"} />
            <QuickRow label="Secondary Color" value={governance?.theme?.secondary_color || "-"} />
            <QuickRow label="Accent Color" value={governance?.theme?.accent_color || "-"} />
            <QuickRow label="Scope Mode" value={summary?.scope_mode || "mixed"} />
          </View>
        </View>

        <View style={box}>
          <Text style={boxTitle}>ملاحظات تشغيلية</Text>
          <Text style={boxBody}>
            المرحلة الحالية تعرض قراءة تشغيلية للوضع اللوني العام تمهيدًا لإضافة theme presets
            وإعدادات ألوان فعلية من الموبايل لاحقًا بدون كسر البنية الحالية.
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
