import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser } from "../features/auth/api";
import { getVisibleModules } from "../features/navigation/registry";
import { erpColors } from "../theme/tokens";

type Props = {
  navigation: any;
  route: { params?: { moduleKey?: string; label?: string; hint?: string } };
};

export default function ModuleViewerScreen({ navigation, route }: Props) {
  const moduleKey = route?.params?.moduleKey || "";
  const passedLabel = route?.params?.label || "وحدة";
  const passedHint = route?.params?.hint || "";

  const meQuery = useQuery({
    queryKey: ["mobile-erp-me-module-viewer"],
    queryFn: getCurrentUser,
    retry: false
  });

  const me = meQuery.data || null;
  const modules = getVisibleModules(me);
  const currentModule = modules.find((item) => item.key === moduleKey);

  return (
    <SafeAreaView edges={["left", "right"]} style={{ flex: 1, backgroundColor: erpColors.bg }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>ERP MODULE</Text>
          <Text style={heroTitle}>{currentModule?.label || passedLabel}</Text>
          <Text style={heroBody}>{currentModule?.hint || passedHint}</Text>
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <InfoRow label="المسار الحالي في admin-web" value={currentModule?.routePath || "-"} />
          <InfoRow label="المجموعة" value={currentModule?.group || "-"} />
          <InfoRow
            label="الصلاحيات المطلوبة"
            value={currentModule?.permissions?.length ? currentModule.permissions.join(" , ") : "-"}
          />
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>حالة هذه الوحدة</Text>
          <Text style={boxBody}>
            هذه الوحدة مرتبطة بالمسار الفعلي الموجود في admin-web وبنفس permission gates الحالية،
            لكن شاشة الموبايل التفصيلية الخاصة بها لم تُبنَ بعد.
          </Text>
        </View>

        <Pressable onPress={() => navigation.goBack()} style={backButton}>
          <Text style={backButtonText}>رجوع</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={row}>
      <Text style={rowLabel}>{label}</Text>
      <Text style={rowValue}>{value}</Text>
    </View>
  );
}

const hero = { backgroundColor: erpColors.navy2, borderRadius: 28, padding: 20, marginBottom: 12 };
const heroTop = { color: erpColors.gold, fontWeight: "800" as const, textAlign: "right" as const };
const heroTitle = { marginTop: 8, color: "#fff", fontSize: 28, fontWeight: "800" as const, textAlign: "right" as const };
const heroBody = { marginTop: 10, color: "rgba(255,255,255,0.78)", textAlign: "right" as const, lineHeight: 24 };
const box = { backgroundColor: "#ffffff", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: erpColors.border };
const boxTitle = { color: erpColors.text, fontWeight: "800" as const, fontSize: 20, textAlign: "right" as const };
const boxBody = { marginTop: 12, color: erpColors.textSoft, lineHeight: 24, textAlign: "right" as const };
const row = { flexDirection: "row-reverse" as const, justifyContent: "space-between" as const, alignItems: "flex-start" as const, gap: 12, marginTop: 10 };
const rowLabel = { color: "#64748b", fontWeight: "700" as const, textAlign: "right" as const };
const rowValue = { flex: 1, color: "#0f172a", fontWeight: "700" as const, textAlign: "right" as const };
const backButton = { backgroundColor: erpColors.navy2, borderRadius: 999, paddingVertical: 14, alignItems: "center" as const };
const backButtonText = { color: "#fff", fontWeight: "800" as const, fontSize: 16 };
