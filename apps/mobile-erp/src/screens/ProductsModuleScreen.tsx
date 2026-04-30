import { useMemo } from "react";
import { useQueries } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCategories, getProducts } from "../features/catalog/api";
import { erpColors } from "../theme/tokens";

function formatPrice(value?: string | number | null) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "0";
  return num.toLocaleString("en-US");
}

export default function ProductsModuleScreen() {
  const results = useQueries({
    queries: [
      { queryKey: ["mobile-erp-products"], queryFn: getProducts, retry: false },
      { queryKey: ["mobile-erp-products-categories"], queryFn: getCategories, retry: false }
    ]
  });

  const [productsQuery, categoriesQuery] = results;

  if (results.some((item) => item.isLoading)) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}><Text style={loadingText}>جاري تحميل المنتجات...</Text></View>
      </SafeAreaView>
    );
  }

  if (results.some((item) => item.isError)) {
    const firstError = results.find((item) => item.error)?.error;
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل المنتجات</Text>
            <Text style={boxBody}>{firstError instanceof Error ? firstError.message : "حدث خطأ غير متوقع."}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const products = Array.isArray(productsQuery.data) ? productsQuery.data : [];
  const categories = Array.isArray(categoriesQuery.data) ? categoriesQuery.data : [];
  const categoryMap = Object.fromEntries(categories.map((item) => [item.id, item.name_ar || item.name_en || `#${item.id}`]));

  const stats = useMemo(() => {
    return {
      total: products.length,
      active: products.filter((p) => p.is_active !== false).length,
      featured: products.filter((p) => p.is_featured).length,
      arReady: products.filter((p) => p.ar_enabled).length,
      withImages: products.filter((p) => p.primary_image_url || p.preview_image_url).length
    };
  }, [products]);

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>PRODUCTS</Text>
          <Text style={heroTitle}>المنتجات</Text>
          <Text style={heroBody}>الكتالوج والمنتجات والوسائط بنفس نموذج الإدارة الحالية وربط المصنع.</Text>
        </View>

        <View style={row}>
          <StatCard label="إجمالي المنتجات" value={stats.total} />
          <StatCard label="النشطة" value={stats.active} />
        </View>
        <View style={row}>
          <StatCard label="المميزة" value={stats.featured} />
          <StatCard label="AR جاهز" value={stats.arReady} />
        </View>
        <View style={row}>
          <StatCard label="بصور" value={stats.withImages} />
          <StatCard label="بدون صور" value={stats.total - stats.withImages} />
        </View>

        <View style={box}>
          <Text style={boxTitle}>أهم المنتجات</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {products.slice(0, 20).map((item) => (
              <View key={String(item.id)} style={itemCard}>
                <Text style={itemTitle}>{item.name_ar || item.name_en || `Product #${item.id}`}</Text>
                <Text style={itemBody}>SKU: {item.sku || "-"}</Text>
                <Text style={itemBody}>الفئة: {categoryMap[item.category_id || 0] || item.category_name || "-"}</Text>
                <Text style={itemBody}>المصنع: {item.factory_name || (item.factory_id ? `#${item.factory_id}` : "-")}</Text>
                <Text style={itemBody}>السعر الأساسي: {formatPrice(item.base_price)}</Text>
                <Text style={itemBody}>AR: {item.ar_enabled ? "مفعل" : "غير مفعل"}</Text>
                <Text style={[itemBody, { color: item.is_active !== false ? erpColors.success : erpColors.danger, fontWeight: "700" }]}>
                  {item.is_active !== false ? "نشط" : "غير نشط"}
                </Text>
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
