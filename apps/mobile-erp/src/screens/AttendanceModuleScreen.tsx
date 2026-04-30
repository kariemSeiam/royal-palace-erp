import { useMemo, useState } from "react";
import { useQueries, useQuery } from "@tanstack/react-query";
import { Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getAttendance, getEmployees, getFactories } from "../features/erp/api";
import { erpColors } from "../theme/tokens";

function normalizeText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function formatDateLabel(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ar-EG");
}

function formatDateTimeLabel(value?: string | null) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ar-EG", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

export default function AttendanceModuleScreen() {
  const [search, setSearch] = useState("");

  const attendanceQuery = useQuery({
    queryKey: ["mobile-erp-attendance"],
    queryFn: getAttendance,
    retry: false
  });

  const optionalResults = useQueries({
    queries: [
      { queryKey: ["mobile-erp-attendance-employees"], queryFn: getEmployees, retry: false },
      { queryKey: ["mobile-erp-attendance-factories"], queryFn: getFactories, retry: false }
    ]
  });

  const [employeesQuery, factoriesQuery] = optionalResults;

  if (attendanceQuery.isLoading) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل سجلات الحضور...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (attendanceQuery.isError || !attendanceQuery.data) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل الحضور</Text>
            <Text style={boxBody}>
              {attendanceQuery.error instanceof Error ? attendanceQuery.error.message : "حدث خطأ غير متوقع."}
            </Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const attendance = Array.isArray(attendanceQuery.data) ? attendanceQuery.data : [];
  const employees = Array.isArray(employeesQuery.data) ? employeesQuery.data : [];
  const factories = Array.isArray(factoriesQuery.data) ? factoriesQuery.data : [];

  const employeeMap = Object.fromEntries(
    employees.map((item) => [
      item.id,
      `${item.first_name || ""} ${item.last_name || ""}`.trim() || `Employee #${item.id}`
    ])
  );
  const factoryMap = Object.fromEntries(factories.map((item) => [item.id, item.name]));

  const employeesUnavailable = employeesQuery.isError;
  const factoriesUnavailable = factoriesQuery.isError;

  const stats = useMemo(() => {
    const total = attendance.length;
    const present = attendance.filter((item) => normalizeText(item.status) === "present").length;
    const late = attendance.filter((item) => normalizeText(item.status) === "late").length;
    const absent = attendance.filter((item) => normalizeText(item.status) === "absent").length;
    return { total, present, late, absent };
  }, [attendance]);

  const filteredAttendance = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return attendance;
    return attendance.filter((item) => {
      const employeeLabel = employeeMap[item.employee_id] || `employee #${item.employee_id}`;
      const factoryLabel = factoryMap[item.factory_id] || `factory #${item.factory_id}`;
      const haystack = [
        item.id,
        item.attendance_date,
        item.status,
        item.source,
        item.notes,
        employeeLabel,
        factoryLabel
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [attendance, search, employeeMap, factoryMap]);

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>ATTENDANCE</Text>
          <Text style={heroTitle}>الحضور والانصراف</Text>
          <Text style={heroBody}>
            عرض سجلات الحضور الحالية بنفس البيانات المستخدمة في وحدة الإدارة.
          </Text>
        </View>

        <View style={row}>
          <StatCard label="إجمالي السجلات" value={stats.total} />
          <StatCard label="حاضر" value={stats.present} />
        </View>
        <View style={row}>
          <StatCard label="متأخر" value={stats.late} />
          <StatCard label="غائب" value={stats.absent} />
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>حالة البيانات المساعدة</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            <QuickRow
              label="أسماء الموظفين"
              value={employeesUnavailable ? "غير متاحة حسب الصلاحيات الحالية" : String(employees.length)}
            />
            <QuickRow
              label="أسماء المصانع"
              value={factoriesUnavailable ? "غير متاحة حسب الصلاحيات الحالية" : String(factories.length)}
            />
          </View>
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>بحث سريع</Text>
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="ابحث بالموظف أو المصنع أو التاريخ أو الحالة..."
            placeholderTextColor="#94a3b8"
            textAlign="right"
            style={searchInput}
          />
          <Text style={searchHint}>
            لو كانت بيانات الموظفين أو المصانع غير متاحة، سيعمل البحث على القيم الأساسية فقط.
          </Text>
        </View>

        <View style={box}>
          <View style={headRow}>
            <Text style={boxTitle}>سجلات الحضور</Text>
            <View style={counterPill}>
              <Text style={counterPillText}>{filteredAttendance.length}</Text>
            </View>
          </View>

          <View style={{ marginTop: 12, gap: 10 }}>
            {filteredAttendance.length ? (
              filteredAttendance.slice(0, 60).map((item) => (
                <View key={String(item.id)} style={itemCard}>
                  <View style={headRow}>
                    <Text style={itemTitle}>
                      {employeeMap[item.employee_id] || `Employee #${item.employee_id}`}
                    </Text>
                    <StatusBadge status={String(item.status || "-")} />
                  </View>
                  <Text style={itemBody}>
                    المصنع: {factoryMap[item.factory_id] || `#${item.factory_id}`}
                  </Text>
                  <Text style={itemBody}>التاريخ: {formatDateLabel(item.attendance_date)}</Text>
                  <Text style={itemBody}>وقت الحضور: {formatDateTimeLabel(item.check_in_at)}</Text>
                  <Text style={itemBody}>وقت الانصراف: {formatDateTimeLabel(item.check_out_at)}</Text>
                  <Text style={itemBody}>المصدر: {item.source || "-"}</Text>
                  <Text style={itemBody}>ملاحظات: {item.notes || "-"}</Text>
                </View>
              ))
            ) : (
              <Text style={boxBody}>لا توجد سجلات مطابقة للبحث.</Text>
            )}
          </View>

          {filteredAttendance.length > 60 ? (
            <Pressable style={moreBox}>
              <Text style={moreText}>يتم عرض أول 60 سجلًا فقط في هذه المرحلة</Text>
            </Pressable>
          ) : null}
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

function StatusBadge({ status }: { status: string }) {
  const normalized = normalizeText(status);
  const isSuccess = normalized === "present";
  const isWarning = normalized === "late" || normalized === "incomplete";
  const isDanger = normalized === "absent";

  return (
    <View
      style={[
        badge,
        {
          backgroundColor: isSuccess ? "#e8f7ee" : isDanger ? "#fee2e2" : "#fff4df",
          borderColor: isSuccess ? "#b7e2c2" : isDanger ? "#fecaca" : "#f5d7a1"
        }
      ]}
    >
      <Text
        style={{
          color: isSuccess ? erpColors.success : isDanger ? erpColors.danger : erpColors.warning,
          fontWeight: "800"
        }}
      >
        {status || "-"}
      </Text>
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
  lineHeight: 24,
  textAlign: "right" as const
};
const row = { flexDirection: "row-reverse" as const, gap: 10, marginBottom: 12 };
const headRow = {
  flexDirection: "row-reverse" as const,
  justifyContent: "space-between" as const,
  alignItems: "center" as const,
  gap: 12
};
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
  lineHeight: 24,
  textAlign: "right" as const
};
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
const searchInput = {
  marginTop: 12,
  backgroundColor: "#ffffff",
  borderWidth: 1,
  borderColor: "#cbd5e1",
  borderRadius: 18,
  paddingHorizontal: 14,
  paddingVertical: 14,
  textAlign: "right" as const,
  color: "#0f172a"
};
const searchHint = { marginTop: 10, color: erpColors.textMuted, textAlign: "right" as const };
const counterPill = {
  minWidth: 42,
  height: 32,
  borderRadius: 999,
  backgroundColor: "#f8fafc",
  borderWidth: 1,
  borderColor: erpColors.border,
  alignItems: "center" as const,
  justifyContent: "center" as const,
  paddingHorizontal: 12
};
const counterPillText = { color: erpColors.text, fontWeight: "800" as const };
const itemCard = {
  backgroundColor: "#f8fafc",
  borderRadius: 18,
  padding: 14,
  borderWidth: 1,
  borderColor: erpColors.border
};
const itemTitle = { color: erpColors.text, fontWeight: "800" as const, textAlign: "right" as const, flex: 1 };
const itemBody = { marginTop: 6, color: erpColors.textMuted, textAlign: "right" as const };
const badge = { borderRadius: 999, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12 };
const moreBox = {
  marginTop: 12,
  backgroundColor: "#fffaf2",
  borderRadius: 16,
  padding: 12,
  borderWidth: 1,
  borderColor: "#ead9b3"
};
const moreText = { color: erpColors.warning, fontWeight: "700" as const, textAlign: "right" as const };
