import { useQueries, useQuery } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  getAdminEmployeesForUsers,
  getAdminFactoriesForUsers,
  getAdminRoles,
  getAdminUsers
} from "../features/users/api";
import { erpColors } from "../theme/tokens";

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <View style={statCard}>
      <Text style={statLabel}>{label}</Text>
      <Text style={statValue}>{value}</Text>
    </View>
  );
}

export default function UsersModuleScreen() {
  const usersQuery = useQuery({
    queryKey: ["mobile-erp-users"],
    queryFn: getAdminUsers,
    retry: false
  });

  const optionalResults = useQueries({
    queries: [
      { queryKey: ["mobile-erp-roles"], queryFn: getAdminRoles, retry: false },
      { queryKey: ["mobile-erp-user-factories"], queryFn: getAdminFactoriesForUsers, retry: false },
      { queryKey: ["mobile-erp-user-employees"], queryFn: getAdminEmployeesForUsers, retry: false }
    ]
  });

  const [rolesQuery, factoriesQuery, employeesQuery] = optionalResults;

  if (usersQuery.isLoading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل وحدة المستخدمين...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (usersQuery.isError || !usersQuery.data) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل وحدة المستخدمين</Text>
            <Text style={boxBody}>
              {usersQuery.error instanceof Error ? usersQuery.error.message : "حدث خطأ غير متوقع."}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const users = Array.isArray(usersQuery.data) ? usersQuery.data : [];
  const roles = Array.isArray(rolesQuery.data) ? rolesQuery.data : [];
  const factories = Array.isArray(factoriesQuery.data) ? factoriesQuery.data : [];
  const employees = Array.isArray(employeesQuery.data) ? employeesQuery.data : [];

  const activeUsers = users.filter((item) => item.is_active !== false).length;
  const superUsers = users.filter((item) => item.is_superuser === true).length;
  const linkedEmployees = users.filter((item) => item.employee_id != null).length;
  const linkedFactories = users.filter((u) => u.factory_id != null).length;

  const rolesUnavailable = rolesQuery.isError;
  const factoriesUnavailable = factoriesQuery.isError;
  const employeesUnavailable = employeesQuery.isError;

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>USERS</Text>
          <Text style={heroTitle}>المستخدمون</Text>
          <Text style={heroBody}>
            نفس بيانات وحدة المستخدمين الحالية من API الإدارة مع احترام الدور ونطاق المصنع.
          </Text>
        </View>

        <View style={row}>
          <StatCard label="إجمالي المستخدمين" value={users.length} />
          <StatCard label="النشطون" value={activeUsers} />
        </View>

        <View style={row}>
          <StatCard label="Super Admins" value={superUsers} />
          <StatCard label="مرتبطون بموظفين" value={linkedEmployees} />
        </View>

        <View style={row}>
          <StatCard label="مرتبطون بمصانع" value={linkedFactories} />
          <StatCard label="غير مرتبطين بموظفين" value={users.length - linkedEmployees} />
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>حالة البيانات المساعدة</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            <QuickRow
              label="الأدوار"
              value={rolesUnavailable ? "غير متاحة حسب الصلاحيات الحالية" : String(roles.length)}
            />
            <QuickRow
              label="المصانع"
              value={factoriesUnavailable ? "غير متاحة حسب الصلاحيات الحالية" : String(factories.length)}
            />
            <QuickRow
              label="الموظفون القابلون للربط"
              value={employeesUnavailable ? "غير متاحة حسب الصلاحيات الحالية" : String(employees.length)}
            />
          </View>
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>آخر المستخدمين</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            {users.slice(0, 12).map((item) => (
              <View key={String(item.id)} style={itemCard}>
                <Text style={itemTitle}>{item.full_name || item.username || item.email}</Text>
                <Text style={itemBody}>Username: {item.username || "-"}</Text>
                <Text style={itemBody}>Role: {item.role_name || item.role_code || "-"}</Text>
                <Text style={itemBody}>
                  Factory: {item.factory_name || (item.factory_id ? `#${item.factory_id}` : "-")}
                </Text>
                <Text style={itemBody}>
                  Employee: {item.employee_name || (item.employee_id ? `#${item.employee_id}` : "-")}
                </Text>
                <Text
                  style={[
                    itemBody,
                    {
                      color: item.is_active === false ? erpColors.danger : erpColors.success,
                      fontWeight: "700"
                    }
                  ]}
                >
                  {item.is_active === false ? "غير نشط" : "نشط"}
                </Text>
              </View>
            ))}
          </View>
        </View>

        {!rolesUnavailable ? (
          <View style={box}>
            <Text style={boxTitle}>الأدوار الحالية</Text>
            <View style={{ marginTop: 12, gap: 10 }}>
              {roles.slice(0, 12).map((item) => (
                <View key={String(item.id)} style={roleRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={itemTitle}>{item.name}</Text>
                    <Text style={itemBody}>{item.code}</Text>
                  </View>
                  <Text style={roleCount}>{item.users_count ?? 0}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
const errorWrap = { flex: 1, justifyContent: "center" as const, padding: 16 };
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
  textAlign: "right" as const,
  lineHeight: 24
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
const boxBody = {
  marginTop: 10,
  color: erpColors.textMuted,
  textAlign: "right" as const,
  lineHeight: 24
};
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
const roleRow = {
  flexDirection: "row-reverse" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  backgroundColor: "#f8fafc",
  borderRadius: 18,
  padding: 14,
  borderWidth: 1,
  borderColor: erpColors.border
};
const roleCount = { color: erpColors.text, fontWeight: "800" as const };
