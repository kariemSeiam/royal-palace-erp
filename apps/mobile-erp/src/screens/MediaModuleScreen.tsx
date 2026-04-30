import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getItAccessCenterSummary, getMediaCategories, getMediaProducts } from "../features/it/api";
import { erpColors } from "../theme/tokens";

export default function MediaModuleScreen() {
  const results = useQueries({
    queries: [
      { queryKey: ["mobile-erp-media-products"], queryFn: getMediaProducts, retry: false },
      { queryKey: ["mobile-erp-media-categories"], queryFn: getMediaCategories, retry: false },
      { queryKey: ["mobile-erp-media-access"], queryFn: getItAccessCenterSummary, retry: false }
    ]
  });

  const [productsQuery, categoriesQuery, accessQuery] = results;

  if (results.every((item) => item.isLoading)) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل الوسائط...</Text>
        </View>
      </SafeAreaView>
    );
  }

  const products = Array.isArray(productsQuery.data) ? productsQuery.data : [];
  const categories = Array.isArray(categoriesQuery.data) ? categoriesQuery.data : [];
  const summary = accessQuery.data?.summary;

  const featuredProducts = useMemo(() => products.slice(0, 6), [products]);

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>MEDIA GOVERNANCE</Text>
          <Text style={heroTitle}>إدارة الوسائط</Text>
          <Text style={heroBody}>
            عرض تشغيلي لحجم الكتالوج والمنتجات المنشورة كنقطة تأسيس لإدارة الصور والبنرات والملفات.
          </Text>
        </View>

        <View style={row}>
          <StatCard label="Products" value={products.length} />
          <StatCard label="Categories" value={categories.length} />
        </View>
        <View style={row}>
          <StatCard label="IT Users" value={summary?.total_users_with_it_access ?? 0} />
          <StatCard label="IT Roles" value={summary?.total_roles_with_it_permissions ?? 0} />
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>عينة من المنتجات</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {featuredProducts.length ? (
              featuredProducts.map((item) => (
                <View key={String(item.id)} style={itemCard}>
                  <Text style={itemTitle}>{item.name_ar || item.name_en || `Product #${item.id}`}</Text>
                  <Text style={itemBody}>SKU: {item.sku || "-"}</Text>
                  <Text style={itemBody}>Category: {item.category_name || item.category_id || "-"}</Text>
                  <Text style={itemBody}>Price: {String(item.base_price ?? "-")}</Text>
                </View>
              ))
            ) : (
              <Text style={boxBody}>لا توجد منتجات منشورة حاليًا.</Text>
            )}
          </View>
        </View>

        <View style={box}>
          <Text style={boxTitle}>مؤشرات الحوكمة</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            <QuickRow
              label="Viewer Scope"
              value={summary?.viewer_factory_scope ? `#${summary.viewer_factory_scope}` : "Group"}
            />
            <QuickRow label="Media Readiness" value={products.length > 0 ? "On" : "Low"} />
            <QuickRow label="Catalog Coverage" value={String(categories.length)} />
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
const itemCard = {
  backgroundColor: "#f8fafc",
  borderRadius: 18,
  padding: 14,
  borderWidth: 1,
  borderColor: erpColors.border
};
const itemTitle = { color: erpColors.text, fontWeight: "800" as const, textAlign: "right" as const };
const itemBody = { marginTop: 6, color: erpColors.textMuted, textAlign: "right" as const };
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
