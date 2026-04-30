"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";

const ORDER_STATUS_OPTIONS = [
  { value: "order_received", label: "تم استلام الطلب" },
  { value: "materials_allocated", label: "تم تخصيص الخامات" },
  { value: "manufacturing_started", label: "بدأ التصنيع" },
  { value: "assembly", label: "التجميع" },
  { value: "quality_control", label: "مراجعة الجودة" },
  { value: "packaging", label: "التعبئة" },
  { value: "delivery_dispatched", label: "تم الشحن" },
  { value: "delivered", label: "تم التسليم" },
  { value: "cancelled", label: "ملغي" },
];

const PAYMENT_STATUS_OPTIONS = [
  { value: "pending", label: "معلق" },
  { value: "paid", label: "مدفوع" },
  { value: "failed", label: "فشل" },
  { value: "refunded", label: "مسترجع" },
  { value: "partially_refunded", label: "مسترجع جزئياً" },
  { value: "cod", label: "الدفع عند الاستلام" },
];

const STATUS_TRANSITIONS = {
  order_received: ["materials_allocated", "cancelled"],
  materials_allocated: ["manufacturing_started", "cancelled"],
  manufacturing_started: ["assembly", "cancelled"],
  assembly: ["quality_control", "cancelled"],
  quality_control: ["packaging", "cancelled"],
  packaging: ["delivery_dispatched", "cancelled"],
  delivery_dispatched: ["delivered", "cancelled"],
  delivered: [],
  cancelled: [],
};

const ORDERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/orders";
const ORDER_WAREHOUSES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/orders/warehouses/options";
const WORK_ORDERS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/work-orders";
const SALES_INVOICES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/sales-invoices";
const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

const AUDIT_ENTITY_HISTORY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/audit/entity-history";

function formatHistoryDate(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatAmount(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num)) return "0.00";
  return num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDateTime(value) {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString("en-GB");
}

function resolveFactoryLabel(order) {
  if (order?.factory_name) return order.factory_name;
  if (order?.factory_id) return `مصنع #${order.factory_id}`;
  return "غير محدد";
}

function resolveWarehouseLabel(order) {
  if (order?.warehouse_name && order?.warehouse_code) return `${order.warehouse_name} (${order.warehouse_code})`;
  if (order?.warehouse_name) return order.warehouse_name;
  if (order?.warehouse_id) return `مخزن #${order.warehouse_id}`;
  return "غير محدد";
}

function getStatusLabel(value) {
  return ORDER_STATUS_OPTIONS.find((x) => x.value === value)?.label || value || "-";
}

function getPaymentLabel(value) {
  return PAYMENT_STATUS_OPTIONS.find((x) => x.value === value)?.label || value || "-";
}

function getStatusTone(status) {
  if (status === "delivered" || status === "delivery_dispatched") return "success";
  if (status === "cancelled") return "warning";
  return "warning";
}

function getPaymentTone(status) {
  if (status === "paid") return "success";
  return "warning";
}

function getWorkOrderTone(status) {
  if (status === "completed" || status === "packaging") return "success";
  if (status === "cancelled") return "warning";
  return "warning";
}

function getWorkOrderLabel(status) {
  const map = {
    pending: "قيد الانتظار",
    materials_allocated: "تم تخصيص الخامات",
    manufacturing_started: "بدأ التصنيع",
    assembly: "التجميع",
    quality_control: "مراجعة الجودة",
    packaging: "التعبئة",
    completed: "مكتمل وجاهز للشحن",
    cancelled: "ملغي",
  };
  return map[status] || status || "لا يوجد";
}

function getAllowedStatusOptions(currentStatus) {
  const current = String(currentStatus || "order_received");
  const allowed = Array.from(new Set([current, ...(STATUS_TRANSITIONS[current] || [])]));
  return ORDER_STATUS_OPTIONS.filter((option) => allowed.includes(option.value));
}

function canEditStatus(order) {
  const status = String(order?.status || "");
  return status !== "delivered" && status !== "cancelled";
}

function canDispatch(order) {
  return String(order?.status || "") === "packaging" && String(order?.work_order_status || "") === "completed";
}

function canDeliver(order) {
  return String(order?.status || "") === "delivery_dispatched";
}

function canCancel(order) {
  const status = String(order?.status || "");
  if (status === "delivered" || status === "cancelled") return false;
  return !order?.delivery_note_id;
}

function canMarkPaid(order) {
  return String(order?.payment_status || "") !== "paid";
}

function canCreateInvoice(order) {
  if (!order?.id || order?.is_master_order || !order?.factory_id) return false;
  if (order?.sales_invoice_id) return false;
  return ["delivery_dispatched", "delivered"].includes(String(order?.status || "")) && Boolean(order?.delivery_number);
}

function getDispatchBlockReason(order) {
  if (String(order?.status || "") !== "packaging") return "الشحن متاح فقط بعد الوصول إلى مرحلة التعبئة.";
  if (!order?.work_order_id) return "لا يوجد أمر تشغيل مرتبط بهذا الطلب.";
  if (String(order?.work_order_status || "") !== "completed") return "الشحن يتطلب اكتمال أمر التشغيل أولًا.";
  return "";
}

function getInvoiceBlockReason(order) {
  if (order?.is_master_order) return "لا يمكن إصدار فاتورة على الطلب الرئيسي المجمع.";
  if (!order?.factory_id) return "الطلب يحتاج مصنعًا محددًا قبل الفوترة.";
  if (order?.sales_invoice_id) return `الفاتورة موجودة بالفعل: ${order.sales_invoice_number}`;
  if (!["delivery_dispatched", "delivered"].includes(String(order?.status || ""))) return "إصدار الفاتورة يتطلب شحن الطلب أو تسليمه.";
  if (!order?.delivery_number) return "لا يمكن إصدار الفاتورة قبل توليد إذن التسليم.";
  return "";
}

function getDeliveryTone(status) {
  if (status === "delivered") return "success";
  if (status === "dispatched") return "warning";
  return "warning";
}

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };

export default function OrdersPage() {
  const { user, ready } = useAdminAuth("orders");

  const [orders, setOrders] = useState([]);
  const [workOrders, setWorkOrders] = useState([]);
  const [salesInvoices, setSalesInvoices] = useState([]);
  const [warehouseOptions, setWarehouseOptions] = useState([]);
  const [editingId, setEditingId] = useState(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    shipping_address: "",
    status: "order_received",
    payment_status: "pending",
    warehouse_id: "",
  });

  const [deliveryModal, setDeliveryModal] = useState({ open: false, orderId: null, receiver_name: "", receiver_phone: "", proof_notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [actionKey, setActionKey] = useState("");
  const [message, setMessage] = useState("");
  const [historyEntityId, setHistoryEntityId] = useState("");
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  async function loadOrders() {
    const [ordersRes, warehousesRes, workOrdersRes, salesInvoicesRes] = await Promise.all([
      fetch(ORDERS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(ORDER_WAREHOUSES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(WORK_ORDERS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(SALES_INVOICES_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);

    const ordersData = await ordersRes.json().catch(() => []);
    const warehousesData = await warehousesRes.json().catch(() => []);
    const workOrdersData = await workOrdersRes.json().catch(() => []);
    const salesInvoicesData = await salesInvoicesRes.json().catch(() => []);

    if (!ordersRes.ok) throw new Error(ordersData.detail || "تعذر تحميل الطلبات");
    if (!warehousesRes.ok) throw new Error(warehousesData.detail || "تعذر تحميل المخازن");
    if (!workOrdersRes.ok) throw new Error(workOrdersData.detail || "تعذر تحميل أوامر التشغيل");
    if (!salesInvoicesRes.ok) throw new Error(salesInvoicesData.detail || "تعذر تحميل فواتير المبيعات");

    setOrders(Array.isArray(ordersData) ? ordersData : []);
    setWarehouseOptions(Array.isArray(warehousesData) ? warehousesData : []);
    setWorkOrders(Array.isArray(workOrdersData) ? workOrdersData : []);
    setSalesInvoices(Array.isArray(salesInvoicesData) ? salesInvoicesData : []);
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadOrders().catch((err) => {
      setOrders([]);
      setWorkOrders([]);
      setSalesInvoices([]);
      setWarehouseOptions([]);
      setMessage(err?.message || "تعذر تحميل الطلبات");
    });
  }, [ready, user]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter, paymentFilter, factoryFilter, sortBy, pageSize]);

  const workOrdersByOrderId = useMemo(() => {
    const map = new Map();
    workOrders.forEach((item) => map.set(Number(item.order_id), item));
    return map;
  }, [workOrders]);

  const salesInvoicesByOrderId = useMemo(() => {
    const map = new Map();
    salesInvoices.forEach((item) => map.set(Number(item.order_id), item));
    return map;
  }, [salesInvoices]);

  const enrichedOrders = useMemo(() => {
    return orders.map((order) => {
      const linkedWorkOrder = workOrdersByOrderId.get(Number(order.id));
      const linkedSalesInvoice = salesInvoicesByOrderId.get(Number(order.id));
      return {
        ...order,
        work_order_id: linkedWorkOrder?.id || null,
        work_order_status: linkedWorkOrder?.status || "",
        sales_invoice_id: linkedSalesInvoice?.id || null,
        sales_invoice_number: linkedSalesInvoice?.invoice_number || "",
        sales_invoice_status: linkedSalesInvoice?.status || "",
        sales_invoice_payment_status: linkedSalesInvoice?.payment_status || "",
      };
    });
  }, [orders, workOrdersByOrderId, salesInvoicesByOrderId]);

  const groupedOrders = useMemo(() => {
    const byId = new Map();
    enrichedOrders.forEach((order) => byId.set(order.id, { ...order, child_orders: [] }));

    const roots = [];
    enrichedOrders.forEach((order) => {
      const normalized = byId.get(order.id);
      if (order.parent_order_id && byId.has(order.parent_order_id)) {
        byId.get(order.parent_order_id).child_orders.push(normalized);
      } else {
        roots.push(normalized);
      }
    });

    roots.forEach((root) => root.child_orders.sort((a, b) => Number(a.id || 0) - Number(b.id || 0)));
    return roots.sort((a, b) => Number(b.id || 0) - Number(a.id || 0));
  }, [enrichedOrders]);

  const factoryOptions = useMemo(() => {
    const map = new Map();
    enrichedOrders.forEach((order) => {
      if (order.factory_id) map.set(String(order.factory_id), resolveFactoryLabel(order));
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [enrichedOrders]);

  const filteredMasterOrders = useMemo(() => {
    const q = normalizeText(search);
    const list = groupedOrders.filter((master) => {
      const allOrders = [master, ...(Array.isArray(master.child_orders) ? master.child_orders : [])];
      const statusMatched = statusFilter === "all" || allOrders.some((item) => String(item.status || "") === statusFilter);
      const paymentMatched = paymentFilter === "all" || allOrders.some((item) => String(item.payment_status || "") === paymentFilter);
      const factoryMatched = factoryFilter === "all" || allOrders.some((item) => String(item.factory_id || "") === String(factoryFilter));
      if (!statusMatched || !paymentMatched || !factoryMatched) return false;
      if (!q) return true;

      const haystack = allOrders.flatMap((order) => [
        order.id,
        order.order_number,
        order.order_type,
        order.status,
        order.payment_status,
        order.customer_name,
        order.customer_phone,
        order.shipping_address,
        order.total_amount,
        order.factory_name,
        order.warehouse_name,
        order.warehouse_code,
        order.delivery_number,
        order.delivery_status,
        order.receiver_name,
        order.receiver_phone,
        order.sales_invoice_number,
      ]).join(" ").toLowerCase();

      return haystack.includes(q);
    });

    list.sort((a, b) => {
      if (sortBy === "oldest") return Number(a.id || 0) - Number(b.id || 0);
      if (sortBy === "amount_desc") return Number(b.total_amount || 0) - Number(a.total_amount || 0);
      if (sortBy === "amount_asc") return Number(a.total_amount || 0) - Number(b.total_amount || 0);
      if (sortBy === "customer") return String(a.customer_name || "").localeCompare(String(b.customer_name || ""), "ar");
      return Number(b.id || 0) - Number(a.id || 0);
    });

    return list;
  }, [groupedOrders, search, statusFilter, paymentFilter, factoryFilter, sortBy]);

  const stats = useMemo(() => {
    const allVisible = groupedOrders.flatMap((master) => [master, ...(Array.isArray(master.child_orders) ? master.child_orders : [])]);
    return {
      total: groupedOrders.length,
      childOrders: allVisible.filter((o) => o.parent_order_id).length,
      dispatched: allVisible.filter((o) => o.status === "delivery_dispatched").length,
      delivered: allVisible.filter((o) => o.status === "delivered").length,
      paid: allVisible.filter((o) => o.payment_status === "paid").length,
      withDelivery: allVisible.filter((o) => o.delivery_number).length,
      invoiced: allVisible.filter((o) => o.sales_invoice_id).length,
      totalAmount: groupedOrders.reduce((sum, order) => sum + Number(order.total_amount || 0), 0),
    };
  }, [groupedOrders]);

  const pagedMasterOrders = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredMasterOrders.slice(start, start + pageSize);
  }, [filteredMasterOrders, page, pageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredMasterOrders.length / pageSize)), [filteredMasterOrders.length, pageSize]);

  const editingOrder = useMemo(() => {
    return enrichedOrders.find((order) => Number(order.id) === Number(editingId)) || null;
  }, [enrichedOrders, editingId]);

  const allowedEditingStatusOptions = useMemo(() => {
    if (!editingOrder) return ORDER_STATUS_OPTIONS;
    return getAllowedStatusOptions(editingOrder.status);
  }, [editingOrder]);

  function handleEdit(order) {
    const safeCurrentStatus = getAllowedStatusOptions(order.status).some((x) => x.value === order.status) ? order.status : "order_received";
    setEditingId(order.id);
    setForm({
      customer_name: order.customer_name || "",
      customer_phone: order.customer_phone || "",
      shipping_address: order.shipping_address || "",
      status: safeCurrentStatus,
      payment_status: order.payment_status || "pending",
      warehouse_id: order.warehouse_id ? String(order.warehouse_id) : "",
    });
    setMessage("");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm({ customer_name: "", customer_phone: "", shipping_address: "", status: "order_received", payment_status: "pending", warehouse_id: "" });
    setMessage("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!editingId) return;
    setSubmitting(true);
    setMessage("");
    try {
      const payload = {
        customer_name: form.customer_name,
        customer_phone: form.customer_phone,
        shipping_address: form.shipping_address,
        status: form.status,
        payment_status: form.payment_status,
        warehouse_id: form.warehouse_id || null,
      };
      const res = await fetch(`${ORDERS_API_URL}/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تعديل الطلب");
      setMessage("تم تعديل الطلب بنجاح");
      handleCancelEdit();
      await loadOrders();
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء تعديل الطلب");
    } finally {
      setSubmitting(false);
    }
  }

  async function quickAction(orderId, action, successMessage, body = null) {
    const key = `${orderId}:${action}`;
    setActionKey(key);
    setMessage("");
    try {
      const res = await fetch(`${ORDERS_API_URL}/${orderId}/${action}`, {
        method: "POST",
        headers: body ? { "Content-Type": "application/json", ...authHeaders() } : authHeaders(),
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تنفيذ الإجراء");
      setMessage(successMessage);
      await loadOrders();
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء تنفيذ الإجراء");
    } finally {
      setActionKey("");
    }
  }

  async function handleCreateInvoice(order) {
    if (!canCreateInvoice(order)) {
      setMessage(getInvoiceBlockReason(order) || "الطلب غير مؤهل للفوترة حالياً");
      return;
    }
    const key = `${order.id}:invoice`;
    setActionKey(key);
    setMessage("");
    try {
      const res = await fetch(`${SALES_INVOICES_API_URL}/from-order/${order.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل إنشاء فاتورة المبيعات");
      setMessage("تم إنشاء فاتورة المبيعات بنجاح");
      await loadOrders();
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء إنشاء فاتورة المبيعات");
    } finally {
      setActionKey("");
    }
  }

  function openDeliverModal(order) {
    setDeliveryModal({
      open: true,
      orderId: order.id,
      receiver_name: order.receiver_name || order.customer_name || "",
      receiver_phone: order.receiver_phone || order.customer_phone || "",
      proof_notes: order.delivery_notes || "",
    });
  }

  async function submitDeliver() {
    if (!deliveryModal.orderId) return;
    await quickAction(
      deliveryModal.orderId,
      "deliver",
      "تم تسليم الطلب وتحديث بيانات إثبات التسليم",
      {
        receiver_name: deliveryModal.receiver_name || null,
        receiver_phone: deliveryModal.receiver_phone || null,
        proof_notes: deliveryModal.proof_notes || null,
      }
    );
    setDeliveryModal({ open: false, orderId: null, receiver_name: "", receiver_phone: "", proof_notes: "" });
  }

  function renderDeliveryBlock(order) {
    return (
      <div style={{ marginTop: "12px", display: "grid", gap: "10px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "var(--rp-text-muted)", fontWeight: 800 }}>إذن التسليم:</span>
          {order?.delivery_number ? (
            <>
              <span className={`erp-badge ${getDeliveryTone(order.delivery_status)}`}>
                {order.delivery_status === "delivered" ? "تم التسليم" : "تم إنشاء إذن التسليم"}
              </span>
              <span className="erp-badge success">{order.delivery_number}</span>
            </>
          ) : (
            <span className="erp-badge warning">لم يتم إنشاء إذن تسليم بعد</span>
          )}

          {order?.sales_invoice_id ? (
            <span className="erp-badge success">فاتورة: {order.sales_invoice_number}</span>
          ) : (
            <span className="erp-badge warning">{getInvoiceBlockReason(order) || "بدون فاتورة"}</span>
          )}
        </div>

        {order?.delivery_number ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
            <div className="erp-mini-note">تاريخ الشحن: {formatDateTime(order.dispatched_at)}</div>
            <div className="erp-mini-note">تاريخ التسليم: {formatDateTime(order.delivered_at)}</div>
            <div className="erp-mini-note">اسم المستلم: {order.receiver_name || "-"}</div>
            <div className="erp-mini-note">هاتف المستلم: {order.receiver_phone || "-"}</div>
          </div>
        ) : null}

        {order?.delivery_notes ? (
          <div style={{ fontSize: "12px", color: "var(--rp-text)", background: "#f8fafc", border: "1px solid var(--rp-border)", borderRadius: "14px", padding: "10px 12px" }}>
            <strong>ملاحظات إثبات التسليم:</strong> {order.delivery_notes}
          </div>
        ) : null}
      </div>
    );
  }

  function renderWorkOrderBlock(order) {
    const dispatchReason = getDispatchBlockReason(order);
    return (
      <div style={{ marginTop: "10px", display: "grid", gap: "8px" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <span style={{ fontSize: "12px", color: "var(--rp-text-muted)", fontWeight: 800 }}>أمر التشغيل:</span>
          {order?.work_order_id ? (
            <span className={`erp-badge ${getWorkOrderTone(order.work_order_status)}`}>{getWorkOrderLabel(order.work_order_status)}</span>
          ) : (
            <span className="erp-badge warning">لا يوجد</span>
          )}
          <span className="erp-badge warning">الفوترة: {canCreateInvoice(order) ? "جاهز" : "غير جاهز"}</span>
        </div>
        {dispatchReason ? (
          <div style={{ fontSize: "12px", color: "#92400e", background: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "12px", padding: "8px 10px" }}>
            {dispatchReason}
          </div>
        ) : null}
        {!canCreateInvoice(order) && getInvoiceBlockReason(order) ? (
          <div style={{ fontSize: "12px", color: "#334155", background: "#f8fafc", border: "1px solid var(--rp-border)", borderRadius: "12px", padding: "8px 10px" }}>
            {getInvoiceBlockReason(order)}
          </div>
        ) : null}
      </div>
    );
  }

  function renderOrderActions(order, compact = false) {
    const btnStyle = compact ? { minHeight: "32px", padding: "0 8px", fontSize: "11px" } : { minHeight: "34px", padding: "0 10px", fontSize: "12px" };
    return (
      <div style={{ display: "flex", gap: compact ? "6px" : "8px", flexWrap: "wrap", justifyContent: "flex-end" }}>
        <button type="button" className="erp-btn-secondary" style={btnStyle} onClick={() => handleEdit(order)}>
          تعديل
        </button>

        <button
          type="button"
          className="erp-btn-primary"
          style={btnStyle}
          disabled={!canCreateInvoice(order) || actionKey === `${order.id}:invoice`}
          onClick={() => handleCreateInvoice(order)}
          title={getInvoiceBlockReason(order)}
        >
          {actionKey === `${order.id}:invoice` ? "..." : order?.sales_invoice_id ? "مفوترة" : "إصدار فاتورة"}
        </button>

        <button
          type="button"
          className="erp-btn-primary"
          style={btnStyle}
          disabled={!canMarkPaid(order) || actionKey === `${order.id}:mark-paid`}
          onClick={() => quickAction(order.id, "mark-paid", "تم تحديث الدفع إلى مدفوع")}
        >
          {actionKey === `${order.id}:mark-paid` ? "..." : "مدفوع"}
        </button>

        <button
          type="button"
          className="erp-btn-primary"
          style={btnStyle}
          disabled={!canDispatch(order) || actionKey === `${order.id}:dispatch`}
          onClick={() => quickAction(order.id, "dispatch", "تم شحن الطلب وإنشاء إذن التسليم")}
          title={!canDispatch(order) ? getDispatchBlockReason(order) : ""}
        >
          {actionKey === `${order.id}:dispatch` ? "..." : "شحن"}
        </button>

        <button
          type="button"
          className="erp-btn-primary"
          style={btnStyle}
          disabled={!canDeliver(order) || actionKey === `${order.id}:deliver`}
          onClick={() => openDeliverModal(order)}
        >
          تسليم
        </button>

        <button
          type="button"
          className="erp-btn-danger"
          style={btnStyle}
          disabled={!canCancel(order) || actionKey === `${order.id}:cancel`}
          onClick={() => quickAction(order.id, "cancel", "تم إلغاء الطلب")}
        >
          {actionKey === `${order.id}:cancel` ? "..." : "إلغاء"}
        </button>
      </div>
    );
  }


  async function loadEntityHistory() {
    if (!historyEntityId) {
      setMessage("أدخل رقم السجل أولاً");
      setHistoryRows([]);
      return;
    }
    setHistoryLoading(true);
    setMessage("");
    try {
      const res = await fetch(`${AUDIT_ENTITY_HISTORY_API_URL}?entity_type=customer_order&entity_id=${encodeURIComponent(historyEntityId)}`, {
        headers: authHeaders(),
        cache: "no-store",
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تحميل السجل التنفيذي");
      setHistoryRows(Array.isArray(data.history) ? data.history : []);
      if (!Array.isArray(data.history) || !data.history.length) setMessage("لا يوجد سجل ظاهر لهذا المعرف حالياً");
    } catch (err) {
      setHistoryRows([]);
      setMessage(err?.message || "حدث خطأ أثناء تحميل السجل التنفيذي");
    } finally {
      setHistoryLoading(false);
    }
  }

  function handleExportCsv() {
    const allOrders = filteredMasterOrders.flatMap((master) => [master, ...(Array.isArray(master.child_orders) ? master.child_orders : [])]);
    const headers = ["رقم الطلب", "العميل", "المصنع", "الحالة", "الدفع", "إذن التسليم", "الفاتورة", "الإجمالي"];
    const rows = allOrders.map((order) => [
      order.order_number || "",
      order.customer_name || "",
      resolveFactoryLabel(order),
      getStatusLabel(order.status),
      getPaymentLabel(order.payment_status),
      order.delivery_number || "-",
      order.sales_invoice_number || "-",
      formatAmount(order.total_amount),
    ]);
    exportTableCsv("orders_export.csv", headers, rows);
  }

  function handleExportPdf() {
    const allOrders = filteredMasterOrders.flatMap((master) => [master, ...(Array.isArray(master.child_orders) ? master.child_orders : [])]);
    const headers = ["رقم الطلب", "العميل", "المصنع", "الحالة", "الدفع", "إذن التسليم", "الفاتورة", "الإجمالي"];
    const rows = allOrders.map((order) => [
      order.order_number || "",
      order.customer_name || "",
      resolveFactoryLabel(order),
      getStatusLabel(order.status),
      getPaymentLabel(order.payment_status),
      order.delivery_number || "-",
      order.sales_invoice_number || "-",
      formatAmount(order.total_amount),
    ]);
    exportTablePdf("تقرير الطلبات", "المبيعات / الطلبات",
      [
        { label: "إجمالي الطلبات", value: stats.total },
        { label: "تم الشحن", value: stats.dispatched },
        { label: "تم التسليم", value: stats.delivered },
        { label: "مدفوعة", value: stats.paid },
      ],
      headers, rows);
  }

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل الطلبات...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">Sales / Fulfillment / Delivery Traceability</div>
            <h2>إدارة الطلبات وإذون التسليم</h2>
            <p>
              واجهة تشغيلية موحدة تربط بين الطلب، أمر التشغيل، إذن التسليم، الفاتورة، وحالة الدفع داخل مسار تجاري واحد واضح.
            </p>
            <div className="erp-hero-actions">
              <div className="erp-hero-pill">Orders: {stats.total}</div>
              <div className="erp-hero-pill">Delivery Notes: {stats.withDelivery}</div>
              <div className="erp-hero-pill">Invoiced: {stats.invoiced}</div>
              <div className="erp-hero-pill">Amount: {formatAmount(stats.totalAmount)}</div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">تم الشحن</div>
              <div className="erp-stat-box-value">{stats.dispatched}</div>
            </div>
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">تم التسليم</div>
              <div className="erp-stat-box-value">{stats.delivered}</div>
            </div>
            <div className="erp-hero-visual" />
          </div>
        </section>

        {editingId ? (
          <div className="erp-section-card" style={{ marginBottom: "18px" }}>
            <div className="erp-section-head" style={{ marginBottom: "18px" }}>
              <div style={{ textAlign: "right" }}>
                <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>تعديل الطلب</h3>
                <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8 }}>
                  تعديل بيانات العميل وحالة الطلب والدفع والمخزن مع الحفاظ على قيود التسليم والفوترة.
                </p>
                {editingOrder ? renderWorkOrderBlock(editingOrder) : null}
                {editingOrder ? renderDeliveryBlock(editingOrder) : null}
              </div>
              <div className="erp-mini-note">Order #{editingId}</div>
            </div>

            <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}>
              <div>
                <label className="erp-label">اسم العميل</label>
                <input className="erp-input" value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
              </div>
              <div>
                <label className="erp-label">هاتف العميل</label>
                <input className="erp-input" value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
              </div>
              <div>
                <label className="erp-label">عنوان الشحن</label>
                <input className="erp-input" value={form.shipping_address} onChange={(e) => setForm({ ...form, shipping_address: e.target.value })} />
              </div>
              <div>
                <label className="erp-label">المخزن</label>
                <select className="erp-input" value={form.warehouse_id} onChange={(e) => setForm({ ...form, warehouse_id: e.target.value })}>
                  <option value="">بدون تعيين</option>
                  {warehouseOptions.map((item) => (
                    <option key={item.id} value={item.id}>{item.factory_name} - {item.name} ({item.code})</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="erp-label">حالة الطلب</label>
                <select className="erp-input" value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} disabled={!canEditStatus(editingOrder)}>
                  {allowedEditingStatusOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div>
                <label className="erp-label">حالة الدفع</label>
                <select className="erp-input" value={form.payment_status} onChange={(e) => setForm({ ...form, payment_status: e.target.value })}>
                  {PAYMENT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="erp-form-actions" style={{ gap: "10px", flexWrap: "wrap" }}>
                <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : "حفظ التعديل"}</button>
                <button type="button" className="erp-btn-secondary" onClick={handleCancelEdit}>إلغاء</button>
              </div>
            </form>
          </div>
        ) : null}

        {message ? <div className="erp-form-message" style={{ marginBottom: "16px" }}>{message}</div> : null}

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head" style={{ marginBottom: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ marginBottom: "4px" }}>السجل التنفيذي المضمن</h3>
              <p style={{ margin: 0 }}>استدعاء مباشر لتاريخ الكيان من audit logs داخل الصفحة الحالية.</p>
            </div>
          </div>
          <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom: "12px" }}>
            <div>
              <label className="erp-label">customer_order ID</label>
              <input className="erp-input" type="number" value={historyEntityId} onChange={(e) => setHistoryEntityId(e.target.value)} placeholder="أدخل المعرف" />
            </div>
            <div className="erp-form-actions">
              <button type="button" className="erp-btn-secondary" onClick={loadEntityHistory} disabled={historyLoading}>
                {historyLoading ? "جارٍ التحميل..." : "عرض السجل"}
              </button>
            </div>
          </div>
          <div className="erp-table-shell" style={{ overflowX: "auto" }}>
            <table className="erp-table" style={{ minWidth: "1200px" }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Actor</th>
                  <th>Action</th>
                  <th>Title</th>
                  <th>Description</th>
                  <th>Reference</th>
                  <th>Created At</th>
                </tr>
              </thead>
              <tbody>
                {historyRows.length === 0 ? (
                  <tr><td colSpan="7">لا يوجد سجل ظاهر بعد.</td></tr>
                ) : historyRows.map((row) => (
                  <tr key={row.id}>
                    <td>{row.id}</td>
                    <td>{row.actor_name || row.actor_user_id || "-"}</td>
                    <td>{row.action || "-"}</td>
                    <td>{row.title || "-"}</td>
                    <td>{row.description || "-"}</td>
                    <td>{row.reference_type ? `${row.reference_type} #${row.reference_id || ""}` : "-"}</td>
                    <td>{formatHistoryDate(row.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <section className="erp-kpi-grid" style={{ marginBottom: "16px" }}>
          <div className="erp-card"><div className="erp-card-title">الطلبات الرئيسية</div><div className="erp-card-value">{stats.total}</div><div className="erp-card-note">مجموعات الطلبات</div></div>
          <div className="erp-card"><div className="erp-card-title">إذون التسليم</div><div className="erp-card-value">{stats.withDelivery}</div><div className="erp-card-note">طلبات لها traceability</div></div>
          <div className="erp-card"><div className="erp-card-title">تم الشحن</div><div className="erp-card-value">{stats.dispatched}</div><div className="erp-card-note">جاهزة للتحصيل</div></div>
          <div className="erp-card"><div className="erp-card-title">تم التسليم</div><div className="erp-card-value">{stats.delivered}</div><div className="erp-card-note">مكتملة التنفيذ</div></div>
          <div className="erp-card"><div className="erp-card-title">مفوترة</div><div className="erp-card-value">{stats.invoiced}</div><div className="erp-card-note">طلبات عليها فواتير</div></div>
          <div className="erp-card"><div className="erp-card-title">إجمالي المبالغ</div><div className="erp-card-value">{formatAmount(stats.totalAmount)}</div><div className="erp-card-note">إجمالي المجموعات الرئيسية</div></div>
        </section>

       <div className="erp-section-card">
          <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ marginBottom: "4px" }}>سجل الطلبات</h3>
              <p style={{ margin: 0 }}>عرض موحد يوضح traceability من الطلب إلى إذن التسليم ثم الفاتورة.</p>
            </div>

            <div style={{ display: "grid", gap: "10px", width: "100%" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input className="erp-input" style={{ minHeight: "42px", borderRadius: "14px", fontWeight: 700, paddingInline: "12px", flex: "1 1 260px", minWidth: "220px" }} placeholder="ابحث برقم الطلب أو العميل أو إذن التسليم أو الفاتورة..." value={search} onChange={(e) => setSearch(e.target.value)} />
                <select className="erp-input" style={{ minHeight: "42px", borderRadius: "14px", fontWeight: 700, paddingInline: "12px", flex: "1 1 160px", minWidth: "150px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">كل حالات الطلب</option>
                  {ORDER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select className="erp-input" style={{ minHeight: "42px", borderRadius: "14px", fontWeight: 700, paddingInline: "12px", flex: "1 1 160px", minWidth: "150px" }} value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)}>
                  <option value="all">كل حالات الدفع</option>
                  {PAYMENT_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select className="erp-input" style={{ minHeight: "42px", borderRadius: "14px", fontWeight: 700, paddingInline: "12px", flex: "1 1 150px", minWidth: "140px" }} value={factoryFilter} onChange={(e) => setFactoryFilter(e.target.value)}>
                  <option value="all">كل المصانع</option>
                  {factoryOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
                <select className="erp-input" style={{ minHeight: "42px", borderRadius: "14px", fontWeight: 700, paddingInline: "12px", flex: "1 1 150px", minWidth: "140px" }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="newest">الأحدث</option>
                  <option value="oldest">الأقدم</option>
                  <option value="amount_desc">الإجمالي: الأعلى</option>
                  <option value="amount_asc">الإجمالي: الأقل</option>
                  <option value="customer">العميل</option>
                </select>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>Export CSV</button>
                  <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>Export PDF</button>
                </div>
                <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                  <span className="erp-mini-note">المعروض: {filteredMasterOrders.length}</span>
                  <span className="erp-mini-note">عدد الصفوف</span>
                  <select className="erp-input" style={{ minHeight: "42px", borderRadius: "14px", fontWeight: 700, paddingInline: "12px", width: "96px" }} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                    {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gap: "14px", maxHeight: "72vh", overflowY: "auto", paddingInlineEnd: "4px" }}>
            {pagedMasterOrders.length === 0 ? (
              <div className="erp-form-message">{groupedOrders.length === 0 ? "لا توجد طلبات حاليًا." : "لا توجد نتائج مطابقة للبحث."}</div>
            ) : (
              pagedMasterOrders.map((master) => {
                const childOrders = Array.isArray(master.child_orders) ? master.child_orders : [];
                return (
                  <div key={`bundle-${master.id}`} style={{ border: "1px solid var(--rp-border)", borderRadius: "20px", background: "var(--rp-surface)", overflow: "hidden", boxShadow: "var(--rp-shadow-soft)" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.9fr) minmax(0, 1.3fr)", gap: "12px", alignItems: "center", padding: "16px", background: "rgba(15, 23, 42, 0.04)" }}>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", color: "var(--rp-text-muted)", marginBottom: "4px", fontWeight: 800 }}>رقم الطلب</div>
                        <div style={{ fontWeight: 900, fontSize: "15px" }}>{master.order_number}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", color: "var(--rp-text-muted)", marginBottom: "4px", fontWeight: 800 }}>العميل</div>
                        <div style={{ fontWeight: 800, fontSize: "13px" }}>{master.customer_name || "-"}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", color: "var(--rp-text-muted)", marginBottom: "4px", fontWeight: 800 }}>التجميع</div>
                        <div style={{ fontWeight: 800, fontSize: "13px" }}>{childOrders.length ? `${childOrders.length} فرعي` : "بدون فروع"}</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "12px", color: "var(--rp-text-muted)", marginBottom: "4px", fontWeight: 800 }}>الحالة</div>
                        <span className={`erp-badge ${getStatusTone(master.status)}`}>{getStatusLabel(master.status)}</span>
                      </div>
                      <div>{renderOrderActions(master, true)}</div>
                    </div>

                    <div style={{ padding: "14px 16px", display: "grid", gap: "12px" }}>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, minmax(0, 1fr))", gap: "12px" }}>
                        <div className="erp-mini-note">المصنع: {master.factory_id ? resolveFactoryLabel(master) : "طلب رئيسي متعدد المصانع"}</div>
                        <div className="erp-mini-note">المخزن: {master.warehouse_id ? resolveWarehouseLabel(master) : "غير محدد"}</div>
                        <div className="erp-mini-note">حالة الدفع: {getPaymentLabel(master.payment_status)}</div>
                        <div className="erp-mini-note">إذن التسليم: {master.delivery_number || "-"}</div>
                        <div className="erp-mini-note">الفاتورة: {master.sales_invoice_number || "-"}</div>
                      </div>
                      {renderWorkOrderBlock(master)}
                      {renderDeliveryBlock(master)}
                    </div>

                    {childOrders.length > 0 ? (
                      <div style={{ padding: "12px 14px", background: "#f8fafc" }}>
                        <div style={{ marginBottom: "10px", fontSize: "12px", fontWeight: 900, color: "var(--rp-text-muted)", textAlign: "right" }}>الطلبات الفرعية</div>
                        <div style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "14px", background: "#fff" }}>
                          <table className="erp-table" style={{ minWidth: "1500px", fontSize: "12px", margin: 0 }}>
                            <thead>
                              <tr>
                                <th>رقم الطلب</th>
                                <th>المصنع</th>
                                <th>المخزن</th>
                                <th>الحالة</th>
                                <th>الدفع</th>
                                <th>إذن التسليم</th>
                                <th>المستلم</th>
                                <th>الفاتورة</th>
                                <th>الإجمالي</th>
                                <th>الإجراءات</th>
                              </tr>
                            </thead>
                            <tbody>
                              {childOrders.map((child) => (
                                <tr key={`child-${child.id}`}>
                                  <td>{child.order_number}</td>
                                  <td>{resolveFactoryLabel(child)}</td>
                                  <td>{resolveWarehouseLabel(child)}</td>
                                  <td><span className={`erp-badge ${getStatusTone(child.status)}`}>{getStatusLabel(child.status)}</span></td>
                                  <td><span className={`erp-badge ${getPaymentTone(child.payment_status)}`}>{getPaymentLabel(child.payment_status)}</span></td>
                                  <td>{child.delivery_number || "-"}</td>
                                  <td>{child.receiver_name || "-"}</td>
                                  <td>{child.sales_invoice_number || "-"}</td>
                                  <td>{formatAmount(child.total_amount)}</td>
                                  <td>{renderOrderActions(child, true)}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "14px" }}>
            <div className="erp-mini-note">صفحة {page} من {totalPages}</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="erp-btn-secondary" style={{ minWidth: "88px", minHeight: "38px", borderRadius: "12px", fontWeight: 800 }} type="button" onClick={() => setPage(1)} disabled={page === 1}>الأولى</button>
              <button className="erp-btn-secondary" style={{ minWidth: "88px", minHeight: "38px", borderRadius: "12px", fontWeight: 800 }} type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>السابقة</button>
              <button className="erp-btn-secondary" style={{ minWidth: "88px", minHeight: "38px", borderRadius: "12px", fontWeight: 800 }} type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages}>التالية</button>
              <button className="erp-btn-secondary" style={{ minWidth: "88px", minHeight: "38px", borderRadius: "12px", fontWeight: 800 }} type="button" onClick={() => setPage(totalPages)} disabled={page === totalPages}>الأخيرة</button>
            </div>
          </div>
        </div>

        {deliveryModal.open ? (
          <div style={{ position: "fixed", inset: 0, background: "rgba(15,23,42,0.45)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000, padding: "20px" }}>
            <div style={{ width: "min(720px, 100%)", background: "#fff", borderRadius: "22px", boxShadow: "0 25px 60px rgba(15,23,42,0.25)", padding: "22px", display: "grid", gap: "14px" }}>
              <div style={{ textAlign: "right" }}>
                <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>تأكيد التسليم وإثباته</h3>
                <p style={{ margin: "8px 0 0", color: "var(--rp-text-muted)" }}>أدخل اسم المستلم والهاتف وملاحظات الإثبات قبل إغلاق عملية التسليم.</p>
              </div>

              <div className="erp-form-grid erp-form-grid-2">
                <div>
                  <label className="erp-label">اسم المستلم</label>
                  <input className="erp-input" value={deliveryModal.receiver_name} onChange={(e) => setDeliveryModal((prev) => ({ ...prev, receiver_name: e.target.value }))} />
                </div>
                <div>
                  <label className="erp-label">هاتف المستلم</label>
                  <input className="erp-input" value={deliveryModal.receiver_phone} onChange={(e) => setDeliveryModal((prev) => ({ ...prev, receiver_phone: e.target.value }))} />
                </div>
              </div>

              <div>
                <label className="erp-label">ملاحظات إثبات التسليم</label>
                <textarea className="erp-input" rows={4} value={deliveryModal.proof_notes} onChange={(e) => setDeliveryModal((prev) => ({ ...prev, proof_notes: e.target.value }))} />
              </div>

              <div className="erp-form-actions" style={{ gap: "10px", flexWrap: "wrap" }}>
                <button className="erp-btn-primary" type="button" disabled={actionKey === `${deliveryModal.orderId}:deliver`} onClick={submitDeliver}>
                  {actionKey === `${deliveryModal.orderId}:deliver` ? "جارٍ الحفظ..." : "تأكيد التسليم"}
                </button>
                <button className="erp-btn-secondary" type="button" onClick={() => setDeliveryModal({ open: false, orderId: null, receiver_name: "", receiver_phone: "", proof_notes: "" })}>
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        ) : null}
      </section>
    </main>
  );
}
