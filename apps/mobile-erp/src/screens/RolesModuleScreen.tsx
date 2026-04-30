import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getPermissionCatalog, getRolePermissions, getRoles } from "../features/it/api";
import { erpColors } from "../theme/tokens";

function normalizeText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function formatCount(value: unknown) {
  return Number(value || 0).toLocaleString("en-US");
}

export default function RolesModuleScreen() {
  const [selectedRoleId, setSelectedRoleId] = useState<number | null>(null);
  const [search, setSearch] = useState("");

  const rolesQuery = useQuery({
    queryKey: ["mobile-erp-roles-module-roles"],
    queryFn: getRoles,
    retry: false
  });

  const catalogQuery = useQuery({
    queryKey: ["mobile-erp-roles-module-catalog"],
    queryFn: getPermissionCatalog,
    retry: false
  });

  const rolePermissionsQuery = useQuery({
    queryKey: ["mobile-erp-role-permissions", selectedRoleId],
    queryFn: () => getRolePermissions(selectedRoleId as number),
    enabled: Boolean(selectedRoleId),
    retry: false
  });

  if (rolesQuery.isLoading || catalogQuery.isLoading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل الأدوار والصلاحيات...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (rolesQuery.isError || !rolesQuery.data || catalogQuery.isError || !catalogQuery.data) {
    const error = rolesQuery.error || catalogQuery.error;
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل وحدة الأدوار</Text>
            <Text style={boxBody}>{error instanceof Error ? error.message : "حدث خطأ غير متوقع."}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const roles = Array.isArray(rolesQuery.data) ? rolesQuery.data : [];
  const catalog = Array.isArray(catalogQuery.data) ? catalogQuery.data : [];
  const assignedPermissions = Array.isArray(rolePermissionsQuery.data?.permissions)
    ? rolePermissionsQuery.data.permissions
    : [];

  const groupedCatalog = useMemo(() => {
    const groups: Record<string, typeof catalog> = {};
    for (const item of catalog) {
      const moduleName = item.module || "general";
      if (!groups[moduleName]) groups[moduleName] = [];
      groups[moduleName].push(item);
    }
    return groups;
  }, [catalog]);

  const filteredGroups = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return groupedCatalog;
    const groups: Record<string, typeof catalog> = {};
    Object.entries(groupedCatalog).forEach(([moduleName, items]) => {
      const filtered = items.filter((item) => {
        const haystack = [moduleName, item.name, item.code].join(" ").toLowerCase();
        return haystack.includes(q);
      });
      if (filtered.length) groups[moduleName] = filtered;
    });
    return groups;
  }, [groupedCatalog, search]);

  const stats = {
    totalRoles: roles.length,
    activeRoles: roles.filter((item) => item.is_active !== false).length,
    totalPermissions: catalog.length,
    activePermissions: catalog.filter((item) => item.is_active !== false).length,
    selectedAssigned: assignedPermissions.length,
    modules: Object.keys(groupedCatalog).length
  };

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>RBAC</Text>
          <Text style={heroTitle}>الأدوار والصلاحيات</Text>
          <Text style={heroBody}>
            عرض حي لهيكل RBAC الحالي: الأدوار، كتالوج الصلاحيات، وصلاحيات الدور المحدد.
          </Text>
        </View>

        <View style={row}>
          <StatCard label="إجمالي الأدوار" value={stats.totalRoles} />
          <StatCard label="الأدوار النشطة" value={stats.activeRoles} />
        </View>
        <View style={row}>
          <StatCard label="إجمالي الصلاحيات" value={stats.totalPermissions} />
          <StatCard label="الصلاحيات النشطة" value={stats.activePermissions} />
        </View>
        <View style={row}>
          <StatCard label="عدد الموديولات" value={stats.modules} />
          <StatCard label="صلاحيات الدور المحدد" value={selectedRoleId ? stats.selectedAssigned : 0} />
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>الأدوار الحالية</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {roles.map((item) => {
              const active = selectedRoleId === item.id;
              return (
                <Pressable
                  key={String(item.id)}
                  onPress={() => setSelectedRoleId(item.id)}
                  style={[itemCard, active ? activeCard : null]}
                >
                  <View style={headRow}>
                    <Text style={itemTitle}>{item.name}</Text>
                    <View style={[pill, active ? goldPill : null]}>
                      <Text style={[pillText, active ? goldPillText : null]}>
                        {formatCount(item.users_count ?? 0)}
                      </Text>
                    </View>
                  </View>
                  <Text style={itemBody}>الكود: {item.code}</Text>
                  <Text style={itemBody}>الحالة: {item.is_active !== false ? "نشط" : "غير نشط"}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>بحث داخل كتالوج الصلاحيات</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث باسم الصلاحية أو الكود أو الموديول..."
            placeholderTextColor="#94a3b8"
            textAlign="right"
            style={searchInput}
          />
          <Text style={searchHint}>
            الدور المحدد: {selectedRoleId ? `#${selectedRoleId}` : "لم يتم اختيار دور"}
          </Text>
        </View>

        {selectedRoleId && rolePermissionsQuery.isLoading ? (
          <View style={[box, { marginBottom: 12 }]}>
            <Text style={boxBody}>جاري تحميل صلاحيات الدور المحدد...</Text>
          </View>
        ) : null}

        <View style={box}>
          <Text style={boxTitle}>كتالوج الصلاحيات</Text>
          <View style={{ marginTop: 12, gap: 12 }}>
            {Object.entries(filteredGroups).map(([moduleName, items]) => {
              const assignedCount = items.filter((item) => assignedPermissions.includes(item.code)).length;
              return (
                <View key={moduleName} style={moduleCard}>
                  <View style={headRow}>
                    <Text style={moduleTitle}>{moduleName}</Text>
                    <View style={pill}>
                      <Text style={pillText}>{assignedCount}/{items.length}</Text>
                    </View>
                  </View>
                  <View style={{ marginTop: 10, gap: 8 }}>
                    {items.map((item) => {
                      const assigned = assignedPermissions.includes(item.code);
                      return (
                        <View key={String(item.id)} style={[permissionRow, assigned ? assignedRow : null]}>
                          <View style={{ flex: 1 }}>
                            <Text style={permissionTitle}>{item.name}</Text>
                            <Text style={permissionBody}>{item.code}</Text>
                          </View>
                          <Text style={[permissionState, { color: assigned ? erpColors.success : erpColors.textMuted }]}>
                            {assigned ? "مربوطة" : "غير مربوطة"}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              );
            })}
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
const headRow = { flexDirection: "row-reverse" as const, justifyContent: "space-between" as const, alignItems: "center" as const, gap: 12 };
const statCard = { flex: 1, backgroundColor: "#ffffff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: erpColors.border };
const statLabel = { color: erpColors.textMuted, fontWeight: "700" as const, textAlign: "right" as const };
const statValue = { marginTop: 8, color: erpColors.text, fontWeight: "800" as const, fontSize: 22, textAlign: "right" as const };
const box = { backgroundColor: "#ffffff", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: erpColors.border };
const boxTitle = { color: erpColors.text, fontWeight: "800" as const, fontSize: 20, textAlign: "right" as const };
const boxBody = { marginTop: 10, color: erpColors.textMuted, lineHeight: 24, textAlign: "right" as const };
const itemCard = { backgroundColor: "#f8fafc", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: erpColors.border };
const activeCard = { borderColor: "#e7c98a", backgroundColor: "#fffaf2" };
const itemTitle = { color: erpColors.text, fontWeight: "800" as const, textAlign: "right" as const, flex: 1 };
const itemBody = { marginTop: 6, color: erpColors.textMuted, textAlign: "right" as const };
const pill = { minWidth: 44, height: 30, borderRadius: 999, backgroundColor: "#f8fafc", borderWidth: 1, borderColor: erpColors.border, alignItems: "center" as const, justifyContent: "center" as const, paddingHorizontal: 10 };
const pillText = { color: erpColors.text, fontWeight: "800" as const };
const goldPill = { backgroundColor: "#fff4df", borderColor: "#f5d7a1" };
const goldPillText = { color: erpColors.warning, fontWeight: "800" as const };
const searchInput = { marginTop: 12, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 14, textAlign: "right" as const, color: "#0f172a" };
const searchHint = { marginTop: 10, color: erpColors.textMuted, textAlign: "right" as const };
const moduleCard = { backgroundColor: "#f8fafc", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: erpColors.border };
const moduleTitle = { color: erpColors.text, fontWeight: "800" as const, textAlign: "right" as const };
const permissionRow = { flexDirection: "row-reverse" as const, justifyContent: "space-between" as const, alignItems: "center" as const, gap: 12, borderRadius: 14, padding: 10, backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#edf2f7" };
const assignedRow = { borderColor: "#b7e2c2", backgroundColor: "#f6fff9" };
const permissionTitle = { color: erpColors.text, fontWeight: "700" as const, textAlign: "right" as const };
const permissionBody = { marginTop: 4, color: erpColors.textMuted, textAlign: "right" as const };
const permissionState = { fontWeight: "800" as const };
