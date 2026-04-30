import { useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getItBackups } from "../features/it/api";
import { erpColors } from "../theme/tokens";

export default function BackupsModuleScreen() {
  const query = useQuery({
    queryKey: ["mobile-erp-backups-overview"],
    queryFn: getItBackups,
    retry: false
  });

  if (query.isLoading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل النسخ الاحتياطية...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (query.isError || !query.data) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل النسخ الاحتياطية</Text>
            <Text style={boxBody}>{query.error instanceof Error ? query.error.message : "حدث خطأ غير متوقع."}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const data = query.data;
  const entries = Array.isArray(data.visible_entries) ? data.visible_entries : [];

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>BACKUPS</Text>
          <Text style={heroTitle}>النسخ الاحتياطية</Text>
          <Text style={heroBody}>ملخص مسار النسخ الاحتياطية والعناصر الظاهرة من داخل API container.</Text>
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>ملخص عام</Text>
          <Text style={boxBody}>المسار: {data.configured_backups_path || "-"}</Text>
          <Text style={boxBody}>Visible: {data.backups_path_visibility?.exists_from_api_container ? "Yes" : "No"}</Text>
          <Text style={boxBody}>DB Probe: {data.database_probe?.status || "-"}</Text>
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>العناصر الظاهرة</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {entries.length ? (
              entries.map((item) => (
                <View key={`${item.name}-${item.path}`} style={itemCard}>
                  <Text style={itemTitle}>{item.name || "-"}</Text>
                  <Text style={itemBody}>Path: {item.path}</Text>
                  <Text style={itemBody}>Type: {item.is_dir ? "Directory" : item.is_file ? "File" : "-"}</Text>
                  <Text style={itemBody}>Size: {String(item.size_bytes ?? 0)}</Text>
                  <Text style={itemBody}>Modified: {item.modified_at || "-"}</Text>
                </View>
              ))
            ) : (
              <Text style={boxBody}>لا توجد عناصر مرئية.</Text>
            )}
          </View>
        </View>

        {Array.isArray(data.notes) && data.notes.length ? (
          <View style={box}>
            <Text style={boxTitle}>ملاحظات النظام</Text>
            <View style={{ marginTop: 12, gap: 10 }}>
              {data.notes.map((note, index) => (
                <Text key={String(index)} style={itemBody}>{note}</Text>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
const box = { backgroundColor: "#ffffff", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: erpColors.border };
const boxTitle = { color: erpColors.text, fontWeight: "800" as const, fontSize: 20, textAlign: "right" as const };
const boxBody = { marginTop: 10, color: erpColors.textMuted, lineHeight: 24, textAlign: "right" as const };
const itemCard = { backgroundColor: "#f8fafc", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: erpColors.border };
const itemTitle = { color: erpColors.text, fontWeight: "800" as const, textAlign: "right" as const };
const itemBody = { marginTop: 6, color: erpColors.textMuted, textAlign: "right" as const };
