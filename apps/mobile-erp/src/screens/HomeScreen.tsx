import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser } from "../features/auth/api";
import { getGroupedVisibleModules, getVisibleModules } from "../features/navigation/registry";
import { erpColors } from "../theme/tokens";

type Props = { navigation: any };

function targetForModule(item: any) {
  const map: Record<string, string> = {
    dashboard: "DashboardModule",
    users: "UsersModule",
    roles: "RolesModule",
    factories: "FactoriesModule",
    departments: "DepartmentsModule",
    employees: "EmployeesModule",
    attendance: "AttendanceModule",
    orders: "OrdersModule",
    "work-orders": "WorkOrdersModule",
    warehouses: "WarehousesModule",
    inventory: "InventoryModule",
    categories: "CategoriesModule",
    products: "ProductsModule",
    b2b: "B2BModule",
    it: "ItModule",
    infrastructure: "InfrastructureModule",
    deployments: "DeploymentsModule",
    backups: "BackupsModule",
    "logs-viewer": "LogsViewerModule",
    media: "MediaModule",
    themes: "ThemesModule",
    branding: "BrandingModule",
    "pages-studio": "PagesStudioModule",
    "ui-settings": "UISettingsModule",
    "global-settings": "GlobalSettingsModule"
  };
  return map[item.key] || "ModuleViewer";
}

export default function HomeScreen({ navigation }: Props) {
  const meQuery = useQuery({
    queryKey: ["mobile-erp-me"],
    queryFn: getCurrentUser,
    retry: false
  });

  if (meQuery.isLoading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل الصفحة الرئيسية...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل البيانات</Text>
            <Text style={boxBody}>{meQuery.error instanceof Error ? meQuery.error.message : "حدث خطأ غير متوقع."}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const me = meQuery.data;
  const modules = getVisibleModules(me);
  const grouped = getGroupedVisibleModules(me);

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>EXECUTIVE MOBILE ERP</Text>
          <Text style={heroTitle}>{me.full_name || me.username || "مستخدم النظام"}</Text>
          <Text style={heroBody}>
            تطبيق موبايل للإدارة والتنفيذ مبني على نفس الصلاحيات الحالية ونفس نطاقات المصانع.
          </Text>
        </View>

        <View style={row}>
          <InfoCard title="الدور" value={me.role_name || me.role_code || "-"} hint="نفس دور الإدارة الحالي" />
          <InfoCard
            title="النطاق"
            value={
              me.is_superuser
                ? "Group-Wide"
                : me.factory_name || (me.factory_id ? `Factory #${me.factory_id}` : "No Scope")
            }
            hint="نفس الـ scope الحالي"
          />
        </View>

        <View style={row}>
          <InfoCard title="الوحدات المتاحة" value={String(modules.length)} hint="المعروضة حسب permissions" />
          <InfoCard title="الحالة" value={me.is_active === false ? "غير نشط" : "نشط"} hint="حالة الحساب الحالية" />
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>ملخص الوحدات</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            <SummaryRow label="Core" value={String(grouped.core.length)} />
            <SummaryRow label="Operations" value={String(grouped.operations.length)} />
            <SummaryRow label="Catalog" value={String(grouped.catalog.length)} />
            <SummaryRow label="Commercial" value={String(grouped.commercial.length)} />
            <SummaryRow label="IT" value={String(grouped.it.length)} />
          </View>
        </View>

        <View style={box}>
          <Text style={boxTitle}>أهم الوحدات المتاحة لك</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {modules.slice(0, 12).map((item) => (
              <Pressable
                key={item.key}
                onPress={() => {
                  const target = targetForModule(item);
                  if (target === "ModuleViewer") {
                    navigation.navigate("ModulesTab", {
                      screen: target,
                      params: { moduleKey: item.key, label: item.label, hint: item.hint }
                    });
                  } else {
                    navigation.navigate("ModulesTab", { screen: target });
                  }
                }}
                style={{
                  backgroundColor: item.accent === "gold" ? "#fffaf2" : erpColors.surface2,
                  borderWidth: 1,
                  borderColor: item.accent === "gold" ? "#ead9b3" : erpColors.border,
                  borderRadius: 18,
                  padding: 14
                }}
              >
                <Text style={{ color: erpColors.text, fontWeight: "800", textAlign: "right" }}>{item.label}</Text>
                <Text style={{ marginTop: 6, color: erpColors.textMuted, textAlign: "right" }}>{item.hint}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoCard({ title, value, hint }: { title: string; value: string; hint: string }) {
  return (
    <View style={infoCard}>
      <Text style={infoTitle}>{title}</Text>
      <Text style={infoValue}>{value}</Text>
      <Text style={infoHint}>{hint}</Text>
    </View>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={summaryRow}>
      <Text style={summaryLabel}>{label}</Text>
      <Text style={summaryValue}>{value}</Text>
    </View>
  );
}

const screen = { flex: 1, backgroundColor: erpColors.bg };
const centered = { flex: 1, alignItems: "center" as const, justifyContent: "center" as const };
const loadingText = { color: erpColors.text, fontWeight: "700" as const };
const errorWrap = { flex: 1, justifyContent: "center" as const, padding: 16 };
const hero = {
  backgroundColor: erpColors.navy2,
  borderRadius: 30,
  padding: 22,
  borderWidth: 1,
  borderColor: "rgba(255,255,255,0.08)",
  marginBottom: 12
};
const heroTop = { color: erpColors.gold, fontWeight: "800" as const, textAlign: "right" as const };
const heroTitle = { color: "#fff", marginTop: 8, fontSize: 28, fontWeight: "800" as const, textAlign: "right" as const };
const heroBody = { color: "rgba(255,255,255,0.78)", marginTop: 10, lineHeight: 24, textAlign: "right" as const };
const row = { flexDirection: "row-reverse" as const, gap: 10, marginBottom: 12 };
const box = { backgroundColor: erpColors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: erpColors.border };
const boxTitle = { color: erpColors.text, fontWeight: "800" as const, fontSize: 20, textAlign: "right" as const };
const boxBody = { marginTop: 10, color: erpColors.textMuted, lineHeight: 24, textAlign: "right" as const };
const infoCard = { flex: 1, backgroundColor: "#ffffff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: "#dde5ef" };
const infoTitle = { color: "#64748b", fontWeight: "700" as const, textAlign: "right" as const };
const infoValue = { marginTop: 8, color: "#0f172a", fontWeight: "800" as const, fontSize: 20, textAlign: "right" as const };
const infoHint = { marginTop: 8, color: "#64748b", textAlign: "right" as const, lineHeight: 20 };
const summaryRow = { flexDirection: "row-reverse" as const, justifyContent: "space-between" as const, alignItems: "center" as const, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#eef2f7" };
const summaryLabel = { color: "#475569", fontWeight: "700" as const };
const summaryValue = { color: "#0f172a", fontWeight: "800" as const };
