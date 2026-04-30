import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser } from "../features/auth/api";
import { getGroupedVisibleModules } from "../features/navigation/registry";
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

export default function ModulesScreen({ navigation }: Props) {
  const meQuery = useQuery({
    queryKey: ["mobile-erp-me-modules"],
    queryFn: getCurrentUser,
    retry: false
  });

  if (meQuery.isLoading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل الوحدات...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل الوحدات</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const grouped = getGroupedVisibleModules(meQuery.data);

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <Section title="Core" label="الأساسيات" items={grouped.core} navigation={navigation} />
        <Section title="Operations" label="التشغيل" items={grouped.operations} navigation={navigation} />
        <Section title="Catalog" label="الكتالوج" items={grouped.catalog} navigation={navigation} />
        <Section title="Commercial" label="التجاري" items={grouped.commercial} navigation={navigation} />
        <Section title="IT" label="تقنية المعلومات" items={grouped.it} navigation={navigation} />
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ title, label, items, navigation }: { title: string; label: string; items: any[]; navigation: any }) {
  if (!items.length) return null;

  return (
    <View style={section}>
      <Text style={sectionTop}>{title}</Text>
      <Text style={sectionTitle}>{label}</Text>

      <View style={{ marginTop: 12, gap: 10 }}>
        {items.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => {
              const target = targetForModule(item);
              if (target === "ModuleViewer") {
                navigation.navigate(target, { moduleKey: item.key, label: item.label, hint: item.hint });
              } else {
                navigation.navigate(target);
              }
            }}
            style={{
              backgroundColor: item.accent === "gold" ? "#fffaf2" : "#f8fafc",
              borderRadius: 18,
              padding: 14,
              borderWidth: 1,
              borderColor: item.accent === "gold" ? "#ead9b3" : "#dde5ef"
            }}
          >
            <Text style={{ color: "#0f172a", fontWeight: "800", fontSize: 18, textAlign: "right" }}>{item.label}</Text>
            <Text style={{ marginTop: 6, color: "#64748b", textAlign: "right" }}>{item.hint}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const screen = { flex: 1, backgroundColor: erpColors.bg };
const centered = { flex: 1, alignItems: "center" as const, justifyContent: "center" as const };
const loadingText = { color: erpColors.text, fontWeight: "700" as const };
const errorWrap = { flex: 1, justifyContent: "center" as const, padding: 16 };
const box = { backgroundColor: erpColors.surface, borderRadius: 24, padding: 20, borderWidth: 1, borderColor: erpColors.border };
const boxTitle = { color: erpColors.text, fontWeight: "800" as const, fontSize: 22, textAlign: "right" as const };
const section = { backgroundColor: "#ffffff", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: "#dde5ef", marginBottom: 12 };
const sectionTop = { color: "#c9a66b", fontWeight: "800" as const, textAlign: "right" as const };
const sectionTitle = { marginTop: 6, color: "#0f172a", fontWeight: "800" as const, fontSize: 22, textAlign: "right" as const };
