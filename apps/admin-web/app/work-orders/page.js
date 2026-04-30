"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";
import GanttChart from "../components/GanttChart";

const WORK_ORDERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/work-orders";
const WORK_ORDER_SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/work-orders/summary";
const WORK_ORDER_EMPLOYEES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/work-orders/employees/options";
const ORDERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/orders";
const INVENTORY_WAREHOUSES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/warehouses";

const WORK_ORDER_STATUS_OPTIONS = [
  { value: "pending", label: "قيد الانتظار" },
  { value: "materials_allocated", label: "تم تخصيص الخامات" },
  { value: "manufacturing_started", label: "بدأ التصنيع" },
  { value: "assembly", label: "التجميع" },
  { value: "quality_control", label: "مراجعة الجودة" },
  { value: "packaging", label: "التعبئة" },
  { value: "completed", label: "مكتمل" },
  { value: "cancelled", label: "ملغي" },
];

const WORK_ORDER_PRIORITY_OPTIONS = [
  { value: "low", label: "منخفضة" },
  { value: "normal", label: "عادية" },
  { value: "high", label: "مرتفعة" },
  { value: "urgent", label: "عاجلة" },
];

const QUICK_STAGE_OPTIONS = [
  "materials_allocated",
  "manufacturing_started",
  "assembly",
  "quality_control",
  "packaging",
  "completed",
];

const EMPTY_CREATE_FORM = {
  order_id: "",
  factory_id: "",
  assigned_employee_id: "",
  notes: "",
  priority: "normal",
  due_date: "",
  planned_start_at: "",
  planned_end_at: "",
};

const EMPTY_ASSIGNMENT_FORM = {
  assigned_employee_id: "",
  notes: "",
};

const EMPTY_PLANNING_FORM = {
  priority: "normal",
  due_date: "",
  planned_start_at: "",
  planned_end_at: "",
  notes: "",
};

const EMPTY_EXECUTION_FORM = {
  progress_percent: "",
  actual_minutes: "",
  notes: "",
};

const EMPTY_ALLOCATION_FORM = {
  warehouse_id: "",
  allocations: {},
  notes: "",
};

const EMPTY_EVENT_FORM = {
  event_type: "note",
  assigned_employee_id: "",
  notes: "",
};

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("ar-EG");
  } catch {
    return String(value);
  }
}

function statusLabel(value) {
  return WORK_ORDER_STATUS_OPTIONS.find((item) => item.value === value)?.label || value || "-";
}

function priorityLabel(value) {
  return WORK_ORDER_PRIORITY_OPTIONS.find((item) => item.value === value)?.label || value || "-";
}

function orderStatusLabel(value) {
  const map = {
    order_received: "تم استلام الطلب",
    materials_allocated: "تم تخصيص الخامات",
    manufacturing_started: "بدأ التصنيع",
    assembly: "التجميع",
    quality_control: "مراجعة الجودة",
    packaging: "التعبئة",
    delivery_dispatched: "تم الشحن",
    delivered: "تم التسليم",
    cancelled: "ملغي",
  };
  return map[value] || value || "-";
}

function scheduleLabel(value) {
  const map = {
    at_risk: "معرض للتأخير",
    scheduled: "مجدول",
    open: "مفتوح",
    closed: "مغلق",
  };
  return map[value] || value || "-";
}

function statusTone(value) {
  if (value === "completed" || value === "packaging") return "success";
  if (value === "cancelled") return "warning";
  return "";
}

function priorityTone(value) {
  if (value === "urgent" || value === "high") return "warning";
  return "success";
}

function scheduleTone(value) {
  if (value === "at_risk") return "warning";
  if (value === "closed") return "success";
  return "";
}

function resolveFactoryLabel(item) {
  if (item?.factory_name) return item.factory_name;
  if (item?.factory_id) return `مصنع #${item.factory_id}`;
  return "غير محدد";
}

function employeeDisplayName(employee) {
  const fullName = employee?.full_name || `${employee?.first_name || ""} ${employee?.last_name || ""}`.trim();
  const label = fullName || `موظف #${employee?.id || ""}`;
  return employee?.job_title ? `${label} - ${employee.job_title}` : label;
}

function productName(item) {
  return item?.name_ar || item?.name_en || item?.slug || `منتج #${item?.product_id || ""}`;
}

function buildDimensionsText(item) {
  const parts = [item?.length_cm, item?.width_cm, item?.thickness_cm].filter(Boolean);
  return parts.length ? parts.join(" × ") : "-";
}

function summarizeWorkCenters(item) {
  const list = Array.isArray(item?.work_centers) ? item.work_centers.filter(Boolean) : [];
  const unique = [...new Set(list)];
  return unique.length ? unique.join(" - ") : "-";
}

function canMoveToStage(item, stage) {
  const current = String(item?.status || "pending");
  const allocationComplete = Boolean(item?.allocation_complete);
  const industrialReady = Boolean(item?.industrial_ready);
  const readyForProduction = Boolean(item?.ready_for_production);

  if (current === "cancelled" || current === "completed") return false;
  if (current === stage) return true;

  const nextByCurrent = {
    pending: "materials_allocated",
    materials_allocated: "manufacturing_started",
    manufacturing_started: "assembly",
    assembly: "quality_control",
    quality_control: "packaging",
    packaging: "completed",
  };

  if (nextByCurrent[current] !== stage) return false;

  if (["manufacturing_started", "assembly", "quality_control", "packaging", "completed"].includes(stage)) {
    return allocationComplete && industrialReady && readyForProduction;
  }

  return true;
}

function getStageBlockReason(item, stage) {
  if (canMoveToStage(item, stage)) return "";

  const current = String(item?.status || "pending");
  if (current === "cancelled") return "أمر التشغيل الملغي لا يمكن تحديثه";
  if (current === "completed") return "أمر التشغيل المكتمل لا يمكن تحديثه";

  const nextByCurrent = {
    pending: "materials_allocated",
    materials_allocated: "manufacturing_started",
    manufacturing_started: "assembly",
    assembly: "quality_control",
    quality_control: "packaging",
    packaging: "completed",
  };

  if (nextByCurrent[current] !== stage) return "مسموح فقط بالانتقال إلى المرحلة التالية مباشرة";
  if (["manufacturing_started", "assembly", "quality_control", "packaging", "completed"].includes(stage) && !item?.allocation_complete) return "يجب إكمال تخصيص الخامات أولاً";
  if (["manufacturing_started", "assembly", "quality_control", "packaging", "completed"].includes(stage) && !item?.industrial_ready) return "التعريف الصناعي للمنتج غير مكتمل";
  if (["manufacturing_started", "assembly", "quality_control", "packaging", "completed"].includes(stage) && item?.has_shortage) return "يوجد نقص فعلي في المخزون";

  return "غير مسموح";
}

function normalizeMetaJson(metaJson) {
  if (!metaJson) return null;
  if (typeof metaJson === "object") return metaJson;
  try {
    return JSON.parse(metaJson);
  } catch {
    return null;
  }
}

function buildEventSummary(event) {
  const meta = normalizeMetaJson(event?.meta_json);
  if (!meta) return event?.notes || "-";

  const parts = [];
  if (meta.priority) parts.push(`الأولوية: ${priorityLabel(meta.priority)}`);
  if (meta.due_date) parts.push(`الاستحقاق: ${meta.due_date}`);
  if (meta.progress_percent !== undefined && meta.progress_percent !== "") parts.push(`التقدم: ${meta.progress_percent}%`);

  return [event?.notes, ...parts].filter(Boolean).join(" | ");
}

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

export default function WorkOrdersPage() {
  const { user, ready } = useAdminAuth("orders");

  const [rows, setRows] = useState([]);
  const [summary, setSummary] = useState(null);
  const [employees, setEmployees] = useState([]);
  const [orders, setOrders] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [createForm, setCreateForm] = useState(EMPTY_CREATE_FORM);
  const [assignmentForms, setAssignmentForms] = useState({});
  const [planningForms, setPlanningForms] = useState({});
  const [executionForms, setExecutionForms] = useState({});
  const [allocationForms, setAllocationForms] = useState({});
  const [eventForms, setEventForms] = useState({});
  const [message, setMessage] = useState("");
  const [submittingKey, setSubmittingKey] = useState("");
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [expandedId, setExpandedId] = useState(null);

  async function loadAll() {
    const [rowsRes, summaryRes, employeesRes, ordersRes, warehousesRes] = await Promise.all([
      fetch(WORK_ORDERS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(WORK_ORDER_SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(WORK_ORDER_EMPLOYEES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(ORDERS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(INVENTORY_WAREHOUSES_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);

    const rowsData = await rowsRes.json().catch(() => []);
    const summaryData = await summaryRes.json().catch(() => ({}));
    const employeesData = await employeesRes.json().catch(() => []);
    const ordersData = await ordersRes.json().catch(() => []);
    const warehousesData = await warehousesRes.json().catch(() => []);

    if (!rowsRes.ok) throw new Error(rowsData.detail || "فشل تحميل أوامر التشغيل");
    if (!summaryRes.ok) throw new Error(summaryData.detail || "فشل تحميل الملخص");
    if (!employeesRes.ok) throw new Error(employeesData.detail || "فشل تحميل الموظفين");
    if (!ordersRes.ok) throw new Error(ordersData.detail || "فشل تحميل الطلبات");
    if (!warehousesRes.ok) throw new Error(warehousesData.detail || "فشل تحميل المخازن");

    setRows(Array.isArray(rowsData) ? rowsData : []);
    setSummary(summaryData || null);
    setEmployees(Array.isArray(employeesData) ? employeesData : []);
    setOrders(Array.isArray(ordersData) ? ordersData : []);
    setWarehouses(Array.isArray(warehousesData) ? warehousesData : []);
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء التحميل"));
  }, [ready, user]);

  const orderOptions = useMemo(() => {
    return orders
      .filter((item) => item.factory_id)
      .map((item) => ({
        id: item.id,
        label: `${item.order_number || `طلب #${item.id}`} - ${item.customer_name || "-"} - ${resolveFactoryLabel(item)}`,
        factory_id: item.factory_id,
      }));
  }, [orders]);

  const filteredRows = useMemo(() => {
    const q = normalizeText(search);
    return rows.filter((item) => {
      if (statusFilter !== "all" && item.status !== statusFilter) return false;
      if (factoryFilter !== "all" && String(item.factory_id) !== String(factoryFilter)) return false;
      if (!q) return true;

      const haystack = [
        item.id,
        item.order_number,
        item.customer_name,
        item.status,
        item.priority,
        item.notes,
        item.assigned_employee_name,
        item.factory_name,
      ].join(" ").toLowerCase();

      return haystack.includes(q);
    });
  }, [rows, search, statusFilter, factoryFilter]);

  function getEmployeeOptions(factoryId) {
    return employees.filter((item) => String(item.factory_id) === String(factoryId || ""));
  }

  function getWarehouseOptions(factoryId) {
    return warehouses.filter((item) => String(item.factory_id) === String(factoryId || ""));
  }

  function updateCreateForm(field, value) {
    if (field === "order_id") {
      const selected = orderOptions.find((item) => String(item.id) === String(value));
      setCreateForm((prev) => ({
        ...prev,
        order_id: value,
        factory_id: selected ? String(selected.factory_id) : "",
      }));
      return;
    }

    setCreateForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleCreate(e) {
    e.preventDefault();
    setSubmittingKey("create");
    setMessage("");

    try {
      const payload = {
        order_id: Number(createForm.order_id),
        factory_id: Number(createForm.factory_id),
        assigned_employee_id: createForm.assigned_employee_id ? Number(createForm.assigned_employee_id) : null,
        notes: createForm.notes.trim() || null,
        priority: createForm.priority,
        due_date: createForm.due_date || null,
        planned_start_at: createForm.planned_start_at || null,
        planned_end_at: createForm.planned_end_at || null,
      };

      const res = await fetch(WORK_ORDERS_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل إنشاء أمر التشغيل");

      setMessage("تم إنشاء أمر التشغيل بنجاح");
      setCreateForm(EMPTY_CREATE_FORM);
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء الإنشاء");
    } finally {
      setSubmittingKey("");
    }
  }

  async function updateAssignment(row) {
    const form = assignmentForms[row.id] || EMPTY_ASSIGNMENT_FORM;
    setSubmittingKey(`assign:${row.id}`);
    setMessage("");

    try {
      const res = await fetch(`${WORK_ORDERS_API_URL}/${row.id}/assignment`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          assigned_employee_id: form.assigned_employee_id ? Number(form.assigned_employee_id) : null,
          notes: form.notes || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحديث المسؤول");

      setMessage("تم تحديث مسؤول أمر التشغيل");
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء تحديث المسؤول");
    } finally {
      setSubmittingKey("");
    }
  }

  async function updatePlanning(row) {
    const form = planningForms[row.id] || {
      ...EMPTY_PLANNING_FORM,
      priority: row.priority || "normal",
      due_date: row.due_date || "",
      planned_start_at: row.planned_start_at || "",
      planned_end_at: row.planned_end_at || "",
    };

    setSubmittingKey(`plan:${row.id}`);
    setMessage("");

    try {
      const res = await fetch(`${WORK_ORDERS_API_URL}/${row.id}/planning`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          priority: form.priority,
          due_date: form.due_date || null,
          planned_start_at: form.planned_start_at || null,
          planned_end_at: form.planned_end_at || null,
          notes: form.notes || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحديث التخطيط");

      setMessage("تم تحديث التخطيط");
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء تحديث التخطيط");
    } finally {
      setSubmittingKey("");
    }
  }

  async function updateExecution(row) {
    const form = executionForms[row.id] || EMPTY_EXECUTION_FORM;
    setSubmittingKey(`exec:${row.id}`);
    setMessage("");

    try {
      const res = await fetch(`${WORK_ORDERS_API_URL}/${row.id}/execution`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          progress_percent: form.progress_percent === "" ? null : Number(form.progress_percent),
          actual_minutes: form.actual_minutes === "" ? null : Number(form.actual_minutes),
          notes: form.notes || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحديث التنفيذ");

      setMessage("تم تحديث التقدم التنفيذي");
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء تحديث التنفيذ");
    } finally {
      setSubmittingKey("");
    }
  }

  async function saveAllocation(row) {
    const form = allocationForms[row.id] || EMPTY_ALLOCATION_FORM;
    setSubmittingKey(`alloc:${row.id}`);
    setMessage("");

    try {
      const allocations = (row.items || []).map((item) => ({
        order_item_id: item.id,
        allocated_quantity: Number(form.allocations?.[item.id] || 0),
        notes: form.notes || null,
      }));

      const res = await fetch(`${WORK_ORDERS_API_URL}/${row.id}/materials-allocation`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          warehouse_id: Number(form.warehouse_id),
          allocations,
          notes: form.notes || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حفظ تخصيص الخامات");

      setMessage("تم حفظ تخصيص الخامات");
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء حفظ التخصيص");
    } finally {
      setSubmittingKey("");
    }
  }

  async function addEvent(row) {
    const form = eventForms[row.id] || EMPTY_EVENT_FORM;
    setSubmittingKey(`event:${row.id}`);
    setMessage("");

    try {
      const res = await fetch(`${WORK_ORDERS_API_URL}/${row.id}/events`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          event_type: form.event_type,
          assigned_employee_id: form.assigned_employee_id ? Number(form.assigned_employee_id) : null,
          notes: form.notes,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل إضافة الملاحظة");

      setMessage("تمت إضافة الملاحظة");
      setEventForms((prev) => ({
        ...prev,
        [row.id]: EMPTY_EVENT_FORM,
      }));
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء إضافة الملاحظة");
    } finally {
      setSubmittingKey("");
    }
  }

  async function moveStage(row, stage) {
    setSubmittingKey(`stage:${row.id}:${stage}`);
    setMessage("");

    try {
      const res = await fetch(`${WORK_ORDERS_API_URL}/${row.id}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify({
          status: stage,
          notes: row.notes || null,
          priority: row.priority || "normal",
          due_date: row.due_date || null,
          planned_start_at: row.planned_start_at || null,
          planned_end_at: row.planned_end_at || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحديث المرحلة");

      setMessage("تم تحديث مرحلة أمر التشغيل");
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء تحديث المرحلة");
    } finally {
      setSubmittingKey("");
    }
  }

  async function deleteRow(row) {
    if (!window.confirm("هل تريد حذف أمر التشغيل؟")) return;

    setSubmittingKey(`delete:${row.id}`);
    setMessage("");

    try {
      const res = await fetch(`${WORK_ORDERS_API_URL}/${row.id}`, {
        method: "DELETE",
        headers: authHeaders(),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف أمر التشغيل");

      setMessage("تم حذف أمر التشغيل");
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء الحذف");
    } finally {
      setSubmittingKey("");
    }
  }

  function handleExportCsv() {
    const headers = ["ID", "الطلب", "المصنع", "المسؤول", "الحالة", "الأولوية", "التقدم (%)", "الدقائق الفعلية", "الجدولة"];
    const rows = filteredRows.map((row) => [
      row.id,
      row.order_number || "",
      resolveFactoryLabel(row),
      row.assigned_employee_name || "-",
      statusLabel(row.status),
      priorityLabel(row.priority),
      row.progress_percent ?? "",
      row.actual_minutes ?? "",
      scheduleLabel(row.schedule_health),
    ]);
    exportTableCsv("work_orders_export.csv", headers, rows);
  }

  function handleExportPdf() {
    const headers = ["ID", "الطلب", "المصنع", "المسؤول", "الحالة", "الأولوية", "التقدم (%)", "الدقائق الفعلية", "الجدولة"];
    const rows = filteredRows.map((row) => [
      row.id,
      row.order_number || "",
      resolveFactoryLabel(row),
      row.assigned_employee_name || "-",
      statusLabel(row.status),
      priorityLabel(row.priority),
      row.progress_percent ?? "",
      row.actual_minutes ?? "",
      scheduleLabel(row.schedule_health),
    ]);
    exportTablePdf("تقرير أوامر التشغيل", "الإنتاج / أوامر التشغيل",
      [
        { label: "إجمالي الأوامر", value: summary?.total || rows.length },
        { label: "مكتمل", value: summary?.completed || 0 },
        { label: "جاهز للإنتاج", value: summary?.ready_for_production || 0 },
      ],
      headers, rows);
  }

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل أوامر التشغيل...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <header className="erp-workspace-topbar">
          <div className="erp-workspace-title-wrap">
            <div className="erp-page-eyebrow">Production Workspace</div>
            <h1 className="erp-page-title">أوامر التشغيل</h1>
            <p className="erp-page-subtitle">
              متابعة دورة التشغيل من التخصيص حتى الإكمال، مع ربط المسؤول والتخطيط والتنفيذ والخامات والأحداث التشغيلية من صفحة واحدة.
            </p>
          </div>
          <div className="erp-topbar-actions">
            <div className="erp-topbar-chip">الإجمالي: {summary?.total || rows.length}</div>
            <div className="erp-topbar-chip">جاهز للإنتاج: {summary?.ready_for_production || 0}</div>
            <div className="erp-topbar-chip">معرض للتأخير: {summary?.overdue_or_at_risk || 0}</div>
          </div>
        </header>

        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">الإنتاج / أوامر التشغيل</div>
            <h2>إدارة أوامر التشغيل</h2>
            <p>متابعة دورة التشغيل من التخصيص حتى الإكمال مع ربط المسؤول والتخطيط والخامات والتنفيذ والملاحظات التشغيلية.</p>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">إجمالي الأوامر</div>
              <div className="erp-stat-box-value">{summary?.total || rows.length}</div>
            </div>
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">جاهز للإنتاج</div>
              <div className="erp-stat-box-value">{summary?.ready_for_production || 0}</div>
            </div>
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">معرض للتأخير</div>
              <div className="erp-stat-box-value">{summary?.overdue_or_at_risk || 0}</div>
            </div>
          </div>
        </section>

        {message ? <div className="erp-form-message">{message}</div> : null}

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">الإجمالي</div><div className="erp-card-value">{summary?.total || rows.length}</div></div>
          <div className="erp-card"><div className="erp-card-title">مكتمل</div><div className="erp-card-value">{summary?.completed || 0}</div></div>
          <div className="erp-card"><div className="erp-card-title">مخصص لموظف</div><div className="erp-card-value">{summary?.assigned || 0}</div></div>
          <div className="erp-card"><div className="erp-card-title">به نقص</div><div className="erp-card-value">{summary?.has_shortage || 0}</div></div>
          <div className="erp-card"><div className="erp-card-title">متوسط التقدم</div><div className="erp-card-value">{formatAmount(summary?.avg_progress_percent || 0)}%</div></div>
        </section>

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head">
            <div style={{ textAlign: "right" }}>
              <h3 style={{ margin: 0 }}>إنشاء أمر تشغيل</h3>
            </div>
          </div>

          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleCreate}>
            <div>
              <label className="erp-label">الطلب</label>
              <select className="erp-input" value={createForm.order_id} onChange={(e) => updateCreateForm("order_id", e.target.value)}>
                <option value="">اختر الطلب</option>
                {orderOptions.map((item) => (
                  <option key={item.id} value={item.id}>{item.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="erp-label">المصنع</label>
              <input className="erp-input" readOnly value={createForm.factory_id || "-"} />
            </div>

            <div>
              <label className="erp-label">المسؤول</label>
              <select className="erp-input" value={createForm.assigned_employee_id} onChange={(e) => updateCreateForm("assigned_employee_id", e.target.value)}>
                <option value="">بدون تعيين</option>
                {getEmployeeOptions(createForm.factory_id).map((item) => (
                  <option key={item.id} value={item.id}>{employeeDisplayName(item)}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="erp-label">الأولوية</label>
              <select className="erp-input" value={createForm.priority} onChange={(e) => updateCreateForm("priority", e.target.value)}>
                {WORK_ORDER_PRIORITY_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="erp-label">الاستحقاق</label>
              <input className="erp-input" type="datetime-local" value={createForm.due_date} onChange={(e) => updateCreateForm("due_date", e.target.value)} />
            </div>

            <div>
              <label className="erp-label">بداية الخطة</label>
              <input className="erp-input" type="datetime-local" value={createForm.planned_start_at} onChange={(e) => updateCreateForm("planned_start_at", e.target.value)} />
            </div>

            <div>
              <label className="erp-label">نهاية الخطة</label>
              <input className="erp-input" type="datetime-local" value={createForm.planned_end_at} onChange={(e) => updateCreateForm("planned_end_at", e.target.value)} />
            </div>

            <div style={{ gridColumn: "1 / -1" }}>
              <label className="erp-label">ملاحظات</label>
              <textarea className="erp-input" rows="3" value={createForm.notes} onChange={(e) => updateCreateForm("notes", e.target.value)} />
            </div>

            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={submittingKey === "create"}>
                {submittingKey === "create" ? "جارٍ الإنشاء..." : "إنشاء أمر التشغيل"}
              </button>
            </div>
          </form>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <div style={{ textAlign: "right" }}>
              <h3 style={{ marginBottom: "4px" }}>سجل أوامر التشغيل</h3>
              <p style={{ margin: 0 }}>فلترة وبحث وعمليات تشغيلية مباشرة من نفس الصفحة.</p>
            </div>

            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              <input className="erp-input" placeholder="ابحث..." value={search} onChange={(e) => setSearch(e.target.value)} />
              <select className="erp-input" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                <option value="all">كل الحالات</option>
                {WORK_ORDER_STATUS_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>{item.label}</option>
                ))}
              </select>
              <select className="erp-input" value={factoryFilter} onChange={(e) => setFactoryFilter(e.target.value)}>
                <option value="all">كل المصانع</option>
                {[...new Set(rows.map((item) => item.factory_id))].map((factoryId) => (
                  <option key={factoryId} value={factoryId}>
                    {resolveFactoryLabel(rows.find((x) => x.factory_id === factoryId))}
                  </option>
                ))}
              </select>
              <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button>
              <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button>
            </div>
          </div>

          <div style={{ display: "grid", gap: "14px" }}>
            {filteredRows.length === 0 ? (
              <div className="erp-form-message">لا توجد أوامر تشغيل حالياً.</div>
            ) : (
              filteredRows.map((row) => {
                const assignmentForm = assignmentForms[row.id] || {
                  assigned_employee_id: row.assigned_employee_id ? String(row.assigned_employee_id) : "",
                  notes: "",
                };

                const planningForm = planningForms[row.id] || {
                  priority: row.priority || "normal",
                  due_date: row.due_date || "",
                  planned_start_at: row.planned_start_at || "",
                  planned_end_at: row.planned_end_at || "",
                  notes: "",
                };

                const executionForm = executionForms[row.id] || {
                  progress_percent: row.progress_percent ?? "",
                  actual_minutes: row.actual_minutes ?? "",
                  notes: "",
                };

                const allocationForm = allocationForms[row.id] || {
                  warehouse_id: row.warehouse_id ? String(row.warehouse_id) : "",
                  allocations: Object.fromEntries((row.items || []).map((item) => [item.id, item.allocated_quantity || 0])),
                  notes: "",
                };

                const eventForm = eventForms[row.id] || {
                  event_type: "note",
                  assigned_employee_id: row.assigned_employee_id ? String(row.assigned_employee_id) : "",
                  notes: "",
                };

                return (
                  <div key={row.id} style={{ border: "1px solid var(--rp-border)", borderRadius: "18px", overflow: "hidden", background: "var(--rp-surface)" }}>
                    <div style={{ padding: "14px 16px", background: "rgba(15,23,42,0.04)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontWeight: 900, fontSize: "16px" }}>{row.order_number || `أمر #${row.id}`}</div>
                          <div style={{ color: "var(--rp-text-muted)", fontSize: "13px" }}>
                            {resolveFactoryLabel(row)} · {row.customer_name || "-"} · {row.assigned_employee_name || "بدون تعيين"}
                          </div>
                        </div>

                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <span className={`erp-badge ${statusTone(row.status)}`}>{statusLabel(row.status)}</span>
                          <span className={`erp-badge ${priorityTone(row.priority)}`}>{priorityLabel(row.priority)}</span>
                          <span className={`erp-badge ${scheduleTone(row.schedule_health)}`}>{scheduleLabel(row.schedule_health)}</span>
                        </div>
                      </div>

                      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
                        <button className="erp-btn-secondary" type="button" onClick={() => setExpandedId(expandedId === row.id ? null : row.id)}>
                          {expandedId === row.id ? "إخفاء التفاصيل" : "عرض التفاصيل"}
                        </button>
                        <button className="erp-btn-danger" type="button" onClick={() => deleteRow(row)} disabled={submittingKey === `delete:${row.id}`}>
                          حذف
                        </button>
                      </div>
                    </div>

                    {expandedId === row.id ? (
                      <div style={{ padding: "16px" }}>
                        <div className="erp-kpi-grid" style={{ marginBottom: "14px" }}>
                          <div className="erp-card">
                            <div className="erp-card-title">حالة الطلب</div>
                            <div className="erp-card-value" style={{ fontSize: "18px" }}>{orderStatusLabel(row.order_status)}</div>
                          </div>
                          <div className="erp-card">
                            <div className="erp-card-title">التقدم</div>
                            <div className="erp-card-value" style={{ fontSize: "18px" }}>{formatAmount(row.progress_percent || 0)}%</div>
                          </div>
                          <div className="erp-card">
                            <div className="erp-card-title">الدقائق الفعلية</div>
                            <div className="erp-card-value" style={{ fontSize: "18px" }}>{formatAmount(row.actual_minutes || 0)}</div>
                          </div>
                          <div className="erp-card">
                            <div className="erp-card-title">جاهز للإنتاج</div>
                            <div className="erp-card-value" style={{ fontSize: "18px" }}>{row.ready_for_production ? "نعم" : "لا"}</div>
                          </div>
                        </div>

                        <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom: "16px" }}>
                          <div className="erp-section-card">
                            <div className="erp-section-head"><h4 style={{ margin: 0 }}>المسؤول</h4></div>
                            <div className="erp-form-grid">
                              <select className="erp-input" value={assignmentForm.assigned_employee_id} onChange={(e) => setAssignmentForms((prev) => ({ ...prev, [row.id]: { ...assignmentForm, assigned_employee_id: e.target.value } }))}>
                                <option value="">بدون تعيين</option>
                                {getEmployeeOptions(row.factory_id).map((item) => (
                                  <option key={item.id} value={item.id}>{employeeDisplayName(item)}</option>
                                ))}
                              </select>
                              <input className="erp-input" placeholder="ملاحظات" value={assignmentForm.notes} onChange={(e) => setAssignmentForms((prev) => ({ ...prev, [row.id]: { ...assignmentForm, notes: e.target.value } }))} />
                              <div className="erp-form-actions">
                                <button className="erp-btn-primary" type="button" onClick={() => updateAssignment(row)} disabled={submittingKey === `assign:${row.id}`}>حفظ المسؤول</button>
                              </div>
                            </div>
                          </div>

                          <div className="erp-section-card">
                            <div className="erp-section-head"><h4 style={{ margin: 0 }}>التخطيط</h4></div>
                            <div className="erp-form-grid">
                              <select className="erp-input" value={planningForm.priority} onChange={(e) => setPlanningForms((prev) => ({ ...prev, [row.id]: { ...planningForm, priority: e.target.value } }))}>
                                {WORK_ORDER_PRIORITY_OPTIONS.map((item) => (
                                  <option key={item.value} value={item.value}>{item.label}</option>
                                ))}
                              </select>
                              <input className="erp-input" type="datetime-local" value={planningForm.due_date} onChange={(e) => setPlanningForms((prev) => ({ ...prev, [row.id]: { ...planningForm, due_date: e.target.value } }))} />
                              <input className="erp-input" type="datetime-local" value={planningForm.planned_start_at} onChange={(e) => setPlanningForms((prev) => ({ ...prev, [row.id]: { ...planningForm, planned_start_at: e.target.value } }))} />
                              <input className="erp-input" type="datetime-local" value={planningForm.planned_end_at} onChange={(e) => setPlanningForms((prev) => ({ ...prev, [row.id]: { ...planningForm, planned_end_at: e.target.value } }))} />
                              <input className="erp-input" placeholder="ملاحظات" value={planningForm.notes} onChange={(e) => setPlanningForms((prev) => ({ ...prev, [row.id]: { ...planningForm, notes: e.target.value } }))} />
                              <div className="erp-form-actions">
                                <button className="erp-btn-primary" type="button" onClick={() => updatePlanning(row)} disabled={submittingKey === `plan:${row.id}`}>حفظ التخطيط</button>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom: "16px" }}>
                          <div className="erp-section-card">
                            <div className="erp-section-head"><h4 style={{ margin: 0 }}>التنفيذ</h4></div>
                            <div className="erp-form-grid">
                              <input className="erp-input" type="number" min="0" max="100" placeholder="نسبة التقدم" value={executionForm.progress_percent} onChange={(e) => setExecutionForms((prev) => ({ ...prev, [row.id]: { ...executionForm, progress_percent: e.target.value } }))} />
                              <input className="erp-input" type="number" min="0" placeholder="الدقائق الفعلية" value={executionForm.actual_minutes} onChange={(e) => setExecutionForms((prev) => ({ ...prev, [row.id]: { ...executionForm, actual_minutes: e.target.value } }))} />
                              <input className="erp-input" placeholder="ملاحظات" value={executionForm.notes} onChange={(e) => setExecutionForms((prev) => ({ ...prev, [row.id]: { ...executionForm, notes: e.target.value } }))} />
                              <div className="erp-form-actions">
                                <button className="erp-btn-primary" type="button" onClick={() => updateExecution(row)} disabled={submittingKey === `exec:${row.id}`}>حفظ التنفيذ</button>
                              </div>
                            </div>
                          </div>

                          <div className="erp-section-card">
                            <div className="erp-section-head"><h4 style={{ margin: 0 }}>مراحل التشغيل</h4></div>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              {QUICK_STAGE_OPTIONS.map((stage) => (
                                <button key={stage} className="erp-btn-secondary" type="button" title={getStageBlockReason(row, stage)} disabled={!canMoveToStage(row, stage) || submittingKey === `stage:${row.id}:${stage}`} onClick={() => moveStage(row, stage)}>
                                  {statusLabel(stage)}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>

                        <div className="erp-section-card" style={{ marginBottom: "16px" }}>
                          <div className="erp-section-head"><h4 style={{ margin: 0 }}>تخصيص الخامات</h4></div>
                          <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom: "12px" }}>
                            <select className="erp-input" value={allocationForm.warehouse_id} onChange={(e) => setAllocationForms((prev) => ({ ...prev, [row.id]: { ...allocationForm, warehouse_id: e.target.value } }))}>
                              <option value="">اختر المخزن</option>
                              {getWarehouseOptions(row.factory_id).map((item) => (
                                <option key={item.id} value={item.id}>{item.name} ({item.code})</option>
                              ))}
                            </select>
                            <input className="erp-input" placeholder="ملاحظات" value={allocationForm.notes} onChange={(e) => setAllocationForms((prev) => ({ ...prev, [row.id]: { ...allocationForm, notes: e.target.value } }))} />
                          </div>

                          <div className="erp-table-shell" style={{ overflowX: "auto" }}>
                            <table className="erp-table" style={{ minWidth: "1200px" }}>
                              <thead>
                                <tr>
                                  <th>المنتج</th>
                                  <th>SKU</th>
                                  <th>الكمية</th>
                                  <th>المخصص</th>
                                  <th>المتبقي</th>
                                  <th>المخزون</th>
                                  <th>BOM</th>
                                  <th>Routing</th>
                                  <th>الأبعاد</th>
                                  <th>مراكز العمل</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(row.items || []).map((item) => (
                                  <tr key={item.id}>
                                    <td>{productName(item)}</td>
                                    <td>{item.sku || "-"}</td>
                                    <td>{formatAmount(item.quantity)}</td>
                                    <td>
                                      <input
                                        className="erp-input"
                                        type="number"
                                        min="0"
                                        step="0.01"
                                        value={allocationForm.allocations?.[item.id] ?? 0}
                                        onChange={(e) =>
                                          setAllocationForms((prev) => ({
                                            ...prev,
                                            [row.id]: {
                                              ...allocationForm,
                                              allocations: {
                                                ...(allocationForm.allocations || {}),
                                                [item.id]: e.target.value,
                                              },
                                            },
                                          }))
                                        }
                                      />
                                    </td>
                                    <td>{formatAmount(item.remaining_quantity)}</td>
                                    <td>{formatAmount(item.stock_available)}</td>
                                    <td>{item.bom_items_count || 0}</td>
                                    <td>{item.routing_steps_count || 0}</td>
                                    <td>{buildDimensionsText(item)}</td>
                                    <td>{summarizeWorkCenters(item)}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>

                          <div className="erp-form-actions" style={{ marginTop: "12px" }}>
                            <button className="erp-btn-primary" type="button" onClick={() => saveAllocation(row)} disabled={submittingKey === `alloc:${row.id}`}>حفظ التخصيص</button>
                          </div>
                        </div>

                        <div className="erp-form-grid erp-form-grid-2">
                          <div className="erp-section-card">
                            <div className="erp-section-head"><h4 style={{ margin: 0 }}>إضافة ملاحظة</h4></div>
                            <div className="erp-form-grid">
                              <select className="erp-input" value={eventForm.event_type} onChange={(e) => setEventForms((prev) => ({ ...prev, [row.id]: { ...eventForm, event_type: e.target.value } }))}>
                                <option value="note">ملاحظة عامة</option>
                                <option value="execution_note">ملاحظة تنفيذ</option>
                                <option value="quality_note">ملاحظة جودة</option>
                                <option value="production_note">ملاحظة إنتاج</option>
                              </select>

                              <select className="erp-input" value={eventForm.assigned_employee_id} onChange={(e) => setEventForms((prev) => ({ ...prev, [row.id]: { ...eventForm, assigned_employee_id: e.target.value } }))}>
                                <option value="">بدون تعيين</option>
                                {getEmployeeOptions(row.factory_id).map((item) => (
                                  <option key={item.id} value={item.id}>{employeeDisplayName(item)}</option>
                                ))}
                              </select>

                              <textarea className="erp-input" rows="4" value={eventForm.notes} onChange={(e) => setEventForms((prev) => ({ ...prev, [row.id]: { ...eventForm, notes: e.target.value } }))} />

                              <div className="erp-form-actions">
                                <button className="erp-btn-primary" type="button" onClick={() => addEvent(row)} disabled={submittingKey === `event:${row.id}`}>إضافة الملاحظة</button>
                              </div>
                            </div>
                          </div>

                          <div className="erp-section-card">
                            <div className="erp-section-head"><h4 style={{ margin: 0 }}>الأحداث</h4></div>
                            <div style={{ display: "grid", gap: "10px", maxHeight: "420px", overflowY: "auto" }}>
                              {(row.events || []).length ? (
                                row.events.map((event) => (
                                  <div key={event.id} style={{ border: "1px solid var(--rp-border)", borderRadius: "14px", padding: "12px", background: "var(--rp-surface-soft)" }}>
                                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap", marginBottom: "6px" }}>
                                      <span className="erp-badge">{event.event_type}</span>
                                      <span className="erp-mini-note">{formatDateTime(event.created_at)}</span>
                                    </div>
                                    <div style={{ fontWeight: 700, marginBottom: "6px" }}>{event.assigned_employee_name || event.actor_name || "-"}</div>
                                    <div className="erp-mini-note">{buildEventSummary(event)}</div>
                                  </div>
                                ))
                              ) : (
                                <div className="erp-mini-note">لا توجد أحداث حتى الآن.</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </section>
    </main>
  );
}
