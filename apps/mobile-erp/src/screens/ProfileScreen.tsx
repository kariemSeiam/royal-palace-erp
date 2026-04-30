import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getCurrentUser, getUserPermissions, logout } from "../features/auth/api";
import { erpColors } from "../theme/tokens";

type Props = { navigation: any };

export default function ProfileScreen({ navigation }: Props) {
  const meQuery = useQuery({
    queryKey: ["mobile-erp-me-profile"],
    queryFn: getCurrentUser,
    retry: false
  });

  async function handleLogout() {
    await logout();
    navigation.reset({ index: 0, routes: [{ name: "Login" }] });
  }

  if (meQuery.isLoading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل الملف الشخصي...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (meQuery.isError || !meQuery.data) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل الملف الشخصي</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const me = meQuery.data;
  const permissions = getUserPermissions(me);

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>MY PROFILE</Text>
          <Text style={heroTitle}>{me.full_name || me.username || "مستخدم النظام"}</Text>
          <Text style={heroBody}>نفس بيانات الإدارة الحالية ونفس نموذج الصلاحيات والنطاق.</Text>
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <InfoRow label="اسم المستخدم" value={me.username || "-"} />
          <InfoRow label="الاسم" value={me.full_name || "-"} />
          <InfoRow label="الدور" value={me.role_name || me.role_code || "-"} />
          <InfoRow
            label="المصنع"
            value={
              me.is_superuser
                ? "Group-Wide"
                : me.factory_name || (me.factory_id ? `Factory #${me.factory_id}` : "No Scope")
            }
          />
          <InfoRow label="عدد الصلاحيات" value={String(permissions.length)} />
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>الصلاحيات الحالية</Text>
          <View style={{ marginTop: 12, flexDirection: "row-reverse", flexWrap: "wrap", gap: 8 }}>
            {permissions.length ? (
              permissions.map((item) => (
                <View key={item} style={pill}>
                  <Text style={pillText}>{item}</Text>
                </View>
              ))
            ) : (
              <Text style={boxBody}>لا توجد صلاحيات ظاهرة.</Text>
            )}
          </View>
        </View>

        <Pressable onPress={handleLogout} style={logoutButton}>
          <Text style={logoutButtonText}>تسجيل الخروج</Text>
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

const screen = { flex: 1, backgroundColor: erpColors.bg };
const centered = { flex: 1, alignItems: "center" as const, justifyContent: "center" as const };
const loadingText = { color: erpColors.text, fontWeight: "700" as const };
const errorWrap = { flex: 1, justifyContent: "center" as const, padding: 16 };
const hero = { backgroundColor: erpColors.navy2, borderRadius: 28, padding: 20, marginBottom: 12 };
const heroTop = { color: erpColors.gold, fontWeight: "800" as const, textAlign: "right" as const };
const heroTitle = { marginTop: 8, color: "#fff", fontSize: 28, fontWeight: "800" as const, textAlign: "right" as const };
const heroBody = { marginTop: 10, color: "rgba(255,255,255,0.78)", textAlign: "right" as const, lineHeight: 24 };
const box = { backgroundColor: "#ffffff", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: erpColors.border };
const boxTitle = { color: erpColors.text, fontWeight: "800" as const, fontSize: 20, textAlign: "right" as const };
const boxBody = { marginTop: 10, color: erpColors.textMuted, textAlign: "right" as const, lineHeight: 24 };
const row = { flexDirection: "row-reverse" as const, justifyContent: "space-between" as const, alignItems: "flex-start" as const, gap: 12, marginTop: 10 };
const rowLabel = { color: "#64748b", fontWeight: "700" as const, textAlign: "right" as const };
const rowValue = { flex: 1, color: "#0f172a", fontWeight: "700" as const, textAlign: "right" as const };
const pill = { backgroundColor: "#f8fafc", borderWidth: 1, borderColor: erpColors.border, borderRadius: 999, paddingVertical: 8, paddingHorizontal: 12 };
const pillText = { color: erpColors.text, fontWeight: "700" as const };
const logoutButton = { backgroundColor: erpColors.dangerBg, borderRadius: 999, paddingVertical: 14, alignItems: "center" as const };
const logoutButtonText = { color: erpColors.danger, fontWeight: "800" as const, fontSize: 16 };
