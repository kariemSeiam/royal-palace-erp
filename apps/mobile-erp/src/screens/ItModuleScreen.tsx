import { useQueries } from "@tanstack/react-query";
import { ScrollView, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getItAccessCenterSummary, getItBackups, getItGovernanceSummary, getItOverview } from "../features/it/api";
import { erpColors } from "../theme/tokens";

export default function ItModuleScreen() {
  const results = useQueries({
    queries: [
      { queryKey: ["mobile-erp-it-access-center"], queryFn: getItAccessCenterSummary, retry: false },
      { queryKey: ["mobile-erp-it-overview"], queryFn: getItOverview, retry: false },
      { queryKey: ["mobile-erp-it-governance"], queryFn: getItGovernanceSummary, retry: false },
      { queryKey: ["mobile-erp-it-backups"], queryFn: getItBackups, retry: false }
    ]
  });

  const [accessQuery, overviewQuery, governanceQuery, backupsQuery] = results;

  if (results.every((item) => item.isLoading)) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل وحدة تقنية المعلومات...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (results.every((item) => item.isError)) {
    const error = results.find((item) => item.error)?.error;
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل وحدة تقنية المعلومات</Text>
            <Text style={boxBody}>{error instanceof Error ? error.message : "حدث خطأ غير متوقع."}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  const access = accessQuery.data;
  const overview = overviewQuery.data;
  const governance = governanceQuery.data;
  const backups = backupsQuery.data;

  const serviceProbes = Array.isArray(overview?.service_probes) ? overview.service_probes : [];
  const visibleEntries = Array.isArray(backups?.visible_entries) ? backups.visible_entries : [];
  const accessUsers = access?.summary?.total_users_with_it_access ?? 0;
  const activeItUsers = access?.summary?.active_users_with_it_access ?? 0;
  const itRoles = access?.summary?.total_roles_with_it_permissions ?? 0;
  const infraPermissions = overview?.permission_catalog_counts?.infra_permissions ?? 0;

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>IT GOVERNANCE</Text>
          <Text style={heroTitle}>تقنية المعلومات</Text>
          <Text style={heroBody}>
            بوابة تشغيلية موحدة لملخص الوصول، صحة الخدمات، الحوكمة الرقمية، والنسخ الاحتياطية.
          </Text>
        </View>

        <View style={row}>
          <StatCard label="مستخدمو IT" value={accessUsers} />
          <StatCard label="النشطون" value={activeItUsers} />
        </View>
        <View style={row}>
          <StatCard label="أدوار IT" value={itRoles} />
          <StatCard label="صلاحيات البنية" value={infraPermissions} />
        </View>

        {access ? (
          <View style={[box, { marginBottom: 12 }]}>
            <Text style={boxTitle}>ملخص الوصول التقني</Text>
            <View style={{ marginTop: 12, gap: 10 }}>
              <QuickRow label="Super Admins" value={String(access.summary.superusers_count ?? 0)} />
              <QuickRow label="Factory Scoped" value={String(access.summary.factory_scoped_users_count ?? 0)} />
              <QuickRow label="Mode" value={String(access.summary.scope_mode || "-")} />
              <QuickRow
                label="Viewer Scope"
                value={access.summary.viewer_factory_scope ? `Factory #${access.summary.viewer_factory_scope}` : "Group Scope"}
              />
            </View>
          </View>
        ) : null}

        {overview ? (
          <View style={[box, { marginBottom: 12 }]}>
            <Text style={boxTitle}>حالة الخدمات</Text>
            <View style={{ marginTop: 12, gap: 10 }}>
              {serviceProbes.map((item) => (
                <View key={item.key} style={itemCard}>
                  <View style={headRow}>
                    <Text style={itemTitle}>{item.label}</Text>
                    <StatusBadge status={item.status} />
                  </View>
                  <Text style={itemBody}>النوع: {item.type}</Text>
                  <Text style={itemBody}>التفصيل: {item.detail || "-"}</Text>
                  <Text style={itemBody}>الملاحظة: {item.note || "-"}</Text>
                </View>
              ))}
            </View>
          </View>
        ) : null}

        {governance ? (
          <View style={[box, { marginBottom: 12 }]}>
            <Text style={boxTitle}>الحوكمة الرقمية</Text>
            <View style={{ marginTop: 12, gap: 10 }}>
              <QuickRow label="إجمالي الوسائط" value={String(governance.media_total ?? 0)} />
              <QuickRow label="الوسائط النشطة" value={String(governance.media_active ?? 0)} />
              <QuickRow label="الثيم" value={governance.theme?.theme_name || "-"} />
              <QuickRow label="العلامة AR" value={governance.branding?.brand_name_ar || "-"} />
              <QuickRow label="العلامة EN" value={governance.branding?.brand_name_en || "-"} />
              <QuickRow label="Dashboard Layout" value={governance.ui_settings?.dashboard_layout || "-"} />
              <QuickRow label="Cards Density" value={governance.ui_settings?.cards_density || "-"} />
            </View>
          </View>
        ) : null}

        {backups ? (
          <View style={box}>
            <Text style={boxTitle}>النسخ الاحتياطية الظاهرة</Text>
            <Text style={boxBody}>المسار: {backups.configured_backups_path || "-"}</Text>
            <Text style={boxBody}>
              الحالة: {backups.backups_path_visibility?.exists_from_api_container ? "Visible" : "Not visible"}
            </Text>
            <View style={{ marginTop: 12, gap: 10 }}>
              {visibleEntries.length ? (
                visibleEntries.slice(0, 12).map((item) => (
                  <View key={`${item.name}-${item.path}`} style={itemCard}>
                    <Text style={itemTitle}>{item.name || "-"}</Text>
                    <Text style={itemBody}>النوع: {item.is_dir ? "Directory" : item.is_file ? "File" : "-"}</Text>
                    <Text style={itemBody}>الحجم: {String(item.size_bytes ?? 0)}</Text>
                    <Text style={itemBody}>آخر تعديل: {item.modified_at || "-"}</Text>
                  </View>
                ))
              ) : (
                <Text style={boxBody}>لا توجد عناصر مرئية داخل مجلد النسخ الاحتياطية.</Text>
              )}
            </View>
          </View>
        ) : null}
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
  const normalized = String(status || "").trim().toLowerCase();
  const isUp = normalized === "up";
  const isWarn = normalized === "degraded";

  return (
    <View
      style={[
        badge,
        {
          backgroundColor: isUp ? "#e8f7ee" : isWarn ? "#fff4df" : "#fee2e2",
          borderColor: isUp ? "#b7e2c2" : isWarn ? "#f5d7a1" : "#fecaca"
        }
      ]}
    >
      <Text
        style={{
          color: isUp ? erpColors.success : isWarn ? erpColors.warning : erpColors.danger,
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
const quickRow = { flexDirection: "row-reverse" as const, justifyContent: "space-between" as const, alignItems: "center" as const, borderBottomWidth: 1, borderBottomColor: "#eef2f7", paddingBottom: 10 };
const quickLabel = { color: erpColors.textSoft, fontWeight: "700" as const };
const quickValue = { color: erpColors.text, fontWeight: "800" as const };
const itemCard = { backgroundColor: "#f8fafc", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: erpColors.border };
const itemTitle = { color: erpColors.text, fontWeight: "800" as const, textAlign: "right" as const, flex: 1 };
const itemBody = { marginTop: 6, color: erpColors.textMuted, textAlign: "right" as const };
const badge = { borderRadius: 999, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12 };
