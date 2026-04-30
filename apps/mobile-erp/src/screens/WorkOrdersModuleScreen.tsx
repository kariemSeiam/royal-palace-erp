import { useMemo, useState } from "react";
import { useMutation, useQueries } from "@tanstack/react-query";
import { Alert, Pressable, ScrollView, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { getOrders } from "../features/orders/api";
import {
  buildEligibleOrderOptions,
  createWorkOrder,
  deleteWorkOrder,
  getWorkOrders,
  updateWorkOrder
} from "../features/work-orders/api";
import { erpColors } from "../theme/tokens";

const STATUS_OPTIONS = [
  { value: "pending", label: "قيد الانتظار" },
  { value: "materials_allocated", label: "تم تخصيص الخامات" },
  { value: "manufacturing_started", label: "بدأ التصنيع" },
  { value: "assembly", label: "التجميع" },
  { value: "quality_control", label: "فحص الجودة" },
  { value: "packaging", label: "التعبئة" },
  { value: "completed", label: "مكتمل وجاهز للشحن" },
  { value: "cancelled", label: "ملغي" }
];

const QUICK_STAGE_OPTIONS = [
  "materials_allocated",
  "manufacturing_started",
  "assembly",
  "quality_control",
  "packaging",
  "completed"
];

function statusLabel(value?: string | null) {
  return STATUS_OPTIONS.find((item) => item.value === value)?.label || value || "-";
}

function normalizeText(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

export default function WorkOrdersModuleScreen() {
  const [selectedOrderId, setSelectedOrderId] = useState<string>("");
  const [factoryId, setFactoryId] = useState<string>("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editStatus, setEditStatus] = useState("pending");
  const [editNotes, setEditNotes] = useState("");

  const results = useQueries({
    queries: [
      { queryKey: ["mobile-erp-work-orders"], queryFn: getWorkOrders, retry: false },
      { queryKey: ["mobile-erp-work-orders-orders"], queryFn: getOrders, retry: false }
    ]
  });

  const [workOrdersQuery, ordersQuery] = results;

  const workOrders = Array.isArray(workOrdersQuery.data) ? workOrdersQuery.data : [];
  const orders = Array.isArray(ordersQuery.data) ? ordersQuery.data : [];
  const orderOptions = useMemo(() => buildEligibleOrderOptions(orders), [orders]);

  const orderMap = useMemo(() => {
    const map = new Map<number, any>();
    orders.forEach((item) => map.set(item.id, item));
    return map;
  }, [orders]);

  const enrichedRows = useMemo(() => {
    return workOrders.map((item) => {
      const linkedOrder = orderMap.get(item.order_id);
      return {
        ...item,
        linked_order_status: linkedOrder?.status || "",
        linked_order_customer_name: linkedOrder?.customer_name || "",
        linked_order_warehouse_id: linkedOrder?.warehouse_id || null
      };
    });
  }, [workOrders, orderMap]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    return enrichedRows.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (!q) return true;
      const haystack = [
        item.id,
        item.order_id,
        item.order_number,
        item.factory_id,
        item.factory_name,
        item.status,
        item.notes,
        item.linked_order_status,
        item.linked_order_customer_name
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(q);
    });
  }, [enrichedRows, search, statusFilter]);

  const stats = useMemo(() => {
    return {
      total: enrichedRows.length,
      completed: enrichedRows.filter((item) => item.status === "completed").length,
      packaging: enrichedRows.filter((item) => item.status === "packaging").length,
      cancelled: enrichedRows.filter((item) => item.status === "cancelled").length,
      inProgress: enrichedRows.filter(
        (item) => !["completed", "cancelled", "pending"].includes(String(item.status || ""))
      ).length
    };
  }, [enrichedRows]);

  const createMutation = useMutation({
    mutationFn: createWorkOrder,
    onSuccess: () => {
      setSelectedOrderId("");
      setFactoryId("");
      setNotes("");
      workOrdersQuery.refetch();
      Alert.alert("تم", "تم إنشاء أمر التشغيل بنجاح");
    },
    onError: (error: any) => Alert.alert("خطأ", error?.message || "فشل إنشاء أمر التشغيل")
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, status, notes }: { id: number; status: string; notes?: string | null }) =>
      updateWorkOrder(id, { status, notes }),
    onSuccess: () => {
      setEditingId(null);
      setEditStatus("pending");
      setEditNotes("");
      workOrdersQuery.refetch();
      Alert.alert("تم", "تم تحديث أمر التشغيل بنجاح");
    },
    onError: (error: any) => Alert.alert("خطأ", error?.message || "فشل تحديث أمر التشغيل")
  });

  const deleteMutation = useMutation({
    mutationFn: deleteWorkOrder,
    onSuccess: () => {
      setEditingId(null);
      workOrdersQuery.refetch();
      Alert.alert("تم", "تم حذف أمر التشغيل بنجاح");
    },
    onError: (error: any) => Alert.alert("خطأ", error?.message || "فشل حذف أمر التشغيل")
  });

  function onSelectOrder(orderId: string) {
    setSelectedOrderId(orderId);
    const selected = orderOptions.find((item) => String(item.id) === String(orderId));
    setFactoryId(selected?.factory_id ? String(selected.factory_id) : "");
  }

  function submitCreate() {
    if (!selectedOrderId || !factoryId) {
      Alert.alert("تنبيه", "اختر الطلب والمصنع أولًا");
      return;
    }

    createMutation.mutate({
      order_id: Number(selectedOrderId),
      factory_id: Number(factoryId),
      notes: notes.trim() || null
    });
  }

  function startEdit(item: any) {
    setEditingId(item.id);
    setEditStatus(item.status || "pending");
    setEditNotes(item.notes || "");
  }

  function quickStage(item: any, nextStatus: string) {
    updateMutation.mutate({
      id: item.id,
      status: nextStatus,
      notes: item.notes || null
    });
  }

  function confirmDelete(item: any) {
    Alert.alert(
      "حذف أمر التشغيل",
      `هل تريد حذف أمر التشغيل المرتبط بالطلب ${item.order_number || `#${item.order_id || item.id}`}؟`,
      [
        { text: "إلغاء", style: "cancel" },
        { text: "حذف", style: "destructive", onPress: () => deleteMutation.mutate(item.id) }
      ]
    );
  }

  if (results.some((item) => item.isLoading) && !workOrdersQuery.data) {
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={centered}>
          <Text style={loadingText}>جاري تحميل أوامر التشغيل...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (workOrdersQuery.isError || ordersQuery.isError) {
    const error = workOrdersQuery.error || ordersQuery.error;
    return (
      <SafeAreaView edges={["left", "right"]} style={screen}>
        <View style={errorWrap}>
          <View style={box}>
            <Text style={boxTitle}>تعذر تحميل أوامر التشغيل</Text>
            <Text style={boxBody}>{error instanceof Error ? error.message : "حدث خطأ غير متوقع."}</Text>
          </View>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={["left", "right"]} style={screen}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 140 }}>
        <View style={hero}>
          <Text style={heroTop}>PRODUCTION LAYER</Text>
          <Text style={heroTitle}>أوامر التشغيل</Text>
          <Text style={heroBody}>
            طبقة تشغيل إضافية تربط الطلبات بالمصانع، وتجهز النظام لمرحلة التصنيع والتنفيذ الداخلي.
          </Text>
        </View>

        <View style={row}>
          <StatCard label="Work Orders" value={stats.total} />
          <StatCard label="Completed" value={stats.completed} />
        </View>
        <View style={row}>
          <StatCard label="Packaging" value={stats.packaging} />
          <StatCard label="In Progress" value={stats.inProgress} />
        </View>

        {editingId ? (
          <View style={[box, { marginBottom: 12 }]}>
            <Text style={boxTitle}>تحديث أمر التشغيل</Text>
            <View style={{ marginTop: 12, gap: 10 }}>
              <TextInput value={editStatus} onChangeText={setEditStatus} placeholder="الحالة" placeholderTextColor="#94a3b8" textAlign="right" style={input} />
              <TextInput value={editNotes} onChangeText={setEditNotes} placeholder="ملاحظات" placeholderTextColor="#94a3b8" textAlign="right" multiline style={[input, { minHeight: 100 }]} />
              <View style={actionsRow}>
                <Pressable
                  style={primaryButton}
                  onPress={() =>
                    updateMutation.mutate({
                      id: editingId,
                      status: editStatus,
                      notes: editNotes.trim() || null
                    })
                  }
                >
                  <Text style={primaryButtonText}>حفظ التحديث</Text>
                </Pressable>
                <Pressable style={secondaryButton} onPress={() => setEditingId(null)}>
                  <Text style={secondaryButtonText}>إلغاء</Text>
                </Pressable>
              </View>
            </View>
          </View>
        ) : null}

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>إنشاء أمر تشغيل جديد</Text>
          <View style={{ marginTop: 12, gap: 10 }}>
            <TextInput value={selectedOrderId} onChangeText={onSelectOrder} placeholder="Order ID" placeholderTextColor="#94a3b8" textAlign="right" style={input} />
            <TextInput value={factoryId} onChangeText={setFactoryId} placeholder="Factory ID" placeholderTextColor="#94a3b8" textAlign="right" style={input} />
            <TextInput value={notes} onChangeText={setNotes} placeholder="ملاحظات أمر التشغيل" placeholderTextColor="#94a3b8" textAlign="right" multiline style={[input, { minHeight: 100 }]} />
            <View style={hintCard}>
              <Text style={hintTitle}>الطلبات الجاهزة للربط</Text>
              <View style={{ marginTop: 8, gap: 6 }}>
                {orderOptions.slice(0, 8).map((item) => (
                  <Text key={String(item.id)} style={hintBody}>
                    {item.label}
                  </Text>
                ))}
              </View>
            </View>
            <Pressable style={primaryButton} onPress={submitCreate}>
              <Text style={primaryButtonText}>إنشاء أمر التشغيل</Text>
            </Pressable>
          </View>
        </View>

        <View style={[box, { marginBottom: 12 }]}>
          <Text style={boxTitle}>فلاتر العرض</Text>
          <TextInput value={search} onChangeText={setSearch} placeholder="ابحث برقم الطلب أو المصنع أو الحالة..." placeholderTextColor="#94a3b8" textAlign="right" style={input} />
          <TextInput value={statusFilter} onChangeText={setStatusFilter} placeholder="all أو pending أو completed ..." placeholderTextColor="#94a3b8" textAlign="right" style={[input, { marginTop: 10 }]} />
        </View>

        <View style={box}>
          <Text style={boxTitle}>قائمة أوامر التشغيل</Text>
          <View style={{ marginTop: 12, gap: 12 }}>
            {filteredRows.length ? (
              filteredRows.map((item) => (
                <View key={String(item.id)} style={itemCard}>
                  <View style={headRow}>
                    <Text style={itemTitle}>{item.order_number || `Work Order #${item.id}`}</Text>
                    <StatusBadge status={item.status || "pending"} />
                  </View>
                  <Text style={itemBody}>Order ID: {item.order_id}</Text>
                  <Text style={itemBody}>Factory: {item.factory_name || (item.factory_id ? `#${item.factory_id}` : "-")}</Text>
                  <Text style={itemBody}>Order Status: {item.linked_order_status || "-"}</Text>
                  <Text style={itemBody}>Customer: {item.linked_order_customer_name || "-"}</Text>
                  <Text style={itemBody}>Notes: {item.notes || "لا توجد ملاحظات"}</Text>
                  <Text style={itemBody}>Created: {item.created_at || "-"}</Text>

                  <View style={{ marginTop: 12, gap: 8 }}>
                    <View style={stageWrap}>
                      {QUICK_STAGE_OPTIONS.map((stage) => (
                        <Pressable key={stage} onPress={() => quickStage(item, stage)} style={[stageButton, item.status === stage ? stageButtonActive : null]}>
                          <Text style={[stageButtonText, item.status === stage ? stageButtonTextActive : null]}>
                            {statusLabel(stage)}
                          </Text>
                        </Pressable>
                      ))}
                    </View>

                    <View style={actionsRow}>
                      <Pressable style={secondaryButton} onPress={() => startEdit(item)}>
                        <Text style={secondaryButtonText}>تعديل</Text>
                      </Pressable>
                      <Pressable style={dangerButton} onPress={() => confirmDelete(item)}>
                        <Text style={dangerButtonText}>حذف</Text>
                      </Pressable>
                    </View>
                  </View>
                </View>
              ))
            ) : (
              <Text style={boxBody}>لا توجد أوامر تشغيل مطابقة.</Text>
            )}
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

function StatusBadge({ status }: { status: string }) {
  const tone = status === "completed" ? "success" : status === "cancelled" ? "danger" : "warning";
  return (
    <View style={[badge, tone === "success" ? successBadge : tone === "danger" ? dangerBadge : warningBadge]}>
      <Text style={[badgeText, tone === "success" ? successText : tone === "danger" ? dangerText : warningText]}>
        {statusLabel(status)}
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
const actionsRow = { flexDirection: "row-reverse" as const, gap: 10 };
const stageWrap = { flexDirection: "row-reverse" as const, flexWrap: "wrap" as const, gap: 8 };
const statCard = { flex: 1, backgroundColor: "#ffffff", borderRadius: 20, padding: 16, borderWidth: 1, borderColor: erpColors.border };
const statLabel = { color: erpColors.textMuted, fontWeight: "700" as const, textAlign: "right" as const };
const statValue = { marginTop: 8, color: erpColors.text, fontWeight: "800" as const, fontSize: 22, textAlign: "right" as const };
const box = { backgroundColor: "#ffffff", borderRadius: 24, padding: 20, borderWidth: 1, borderColor: erpColors.border };
const boxTitle = { color: erpColors.text, fontWeight: "800" as const, fontSize: 20, textAlign: "right" as const };
const boxBody = { marginTop: 10, color: erpColors.textMuted, lineHeight: 24, textAlign: "right" as const };
const input = { backgroundColor: "#ffffff", borderWidth: 1, borderColor: "#cbd5e1", borderRadius: 18, paddingHorizontal: 14, paddingVertical: 14, textAlign: "right" as const, color: "#0f172a" };
const itemCard = { backgroundColor: "#f8fafc", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: erpColors.border };
const itemTitle = { color: erpColors.text, fontWeight: "800" as const, textAlign: "right" as const, flex: 1 };
const itemBody = { marginTop: 6, color: erpColors.textMuted, textAlign: "right" as const };
const primaryButton = { flex: 1, backgroundColor: erpColors.navy2, borderRadius: 999, paddingVertical: 14, alignItems: "center" as const };
const primaryButtonText = { color: "#fff", fontWeight: "800" as const };
const secondaryButton = { flex: 1, backgroundColor: "#fff", borderRadius: 999, paddingVertical: 14, alignItems: "center" as const, borderWidth: 1, borderColor: erpColors.border };
const secondaryButtonText = { color: erpColors.text, fontWeight: "800" as const };
const dangerButton = { flex: 1, backgroundColor: "#fff1f2", borderRadius: 999, paddingVertical: 14, alignItems: "center" as const, borderWidth: 1, borderColor: "#fecdd3" };
const dangerButtonText = { color: erpColors.danger, fontWeight: "800" as const };
const badge = { borderRadius: 999, borderWidth: 1, paddingVertical: 6, paddingHorizontal: 12 };
const badgeText = { fontWeight: "800" as const };
const successBadge = { backgroundColor: "#e8f7ee", borderColor: "#b7e2c2" };
const successText = { color: erpColors.success };
const warningBadge = { backgroundColor: "#fff4df", borderColor: "#f5d7a1" };
const warningText = { color: erpColors.warning };
const dangerBadge = { backgroundColor: "#fee2e2", borderColor: "#fecaca" };
const dangerText = { color: erpColors.danger };
const hintCard = { backgroundColor: "#fffaf2", borderRadius: 18, padding: 14, borderWidth: 1, borderColor: "#ead9b3" };
const hintTitle = { color: erpColors.text, fontWeight: "800" as const, textAlign: "right" as const };
const hintBody = { color: erpColors.textMuted, textAlign: "right" as const };
const stageButton = { paddingHorizontal: 12, paddingVertical: 10, borderRadius: 999, backgroundColor: "#ffffff", borderWidth: 1, borderColor: erpColors.border };
const stageButtonActive = { backgroundColor: "#fff4df", borderColor: "#f5d7a1" };
const stageButtonText = { color: erpColors.textMuted, fontWeight: "700" as const };
const stageButtonTextActive = { color: erpColors.warning, fontWeight: "800" as const };

