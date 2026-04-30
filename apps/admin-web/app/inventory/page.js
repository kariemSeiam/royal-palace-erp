"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const MOVEMENTS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/movements";
const TRANSFER_API_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/movements/transfer";
const STOCK_SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/stock-summary";
const WAREHOUSE_SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/warehouse-summary";
const REORDER_RULES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/reorder-rules";
const STOCK_ALERTS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/stock-alerts";
const WAREHOUSES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/inventory/warehouses";
const PRODUCTS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";

const emptyMovementForm = {
  warehouse_id: "",
  product_id: "",
  movement_type: "in",
  quantity: "",
  reference_type: "",
  reference_id: "",
  notes: "",
};

const emptyTransferForm = {
  from_warehouse_id: "",
  to_warehouse_id: "",
  product_id: "",
  quantity: "",
  notes: "",
};

const emptyRuleForm = {
  warehouse_id: "",
  product_id: "",
  min_stock_level: "",
  reorder_level: "",
  reorder_quantity: "",
  notes: "",
};

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
  return num.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function movementTypeLabel(value) {
  const map = { in: "إضافة", out: "صرف", adjustment: "تسوية" };
  return map[value] || value || "-";
}

function alertLabel(value) {
  const map = {
    healthy: "سليم",
    reorder_needed: "يتطلب إعادة طلب",
    below_min_stock: "أقل من الحد الأدنى",
    out_of_stock: "نفاد مخزون",
    negative_stock: "رصيد سالب",
  };
  return map[value] || value || "-";
}

export default function InventoryPage() {
  const { user, ready } = useAdminAuth("inventory");
  const [movements, setMovements] = useState([]);
  const [stockSummary, setStockSummary] = useState([]);
  const [warehouseSummary, setWarehouseSummary] = useState([]);
  const [rules, setRules] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [warehouses, setWarehouses] = useState([]);
  const [products, setProducts] = useState([]);
  const [message, setMessage] = useState("");
  const [historyEntityId, setHistoryEntityId] = useState("");
  const [historyRows, setHistoryRows] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [movementForm, setMovementForm] = useState(emptyMovementForm);
  const [transferForm, setTransferForm] = useState(emptyTransferForm);
  const [ruleForm, setRuleForm] = useState(emptyRuleForm);
  const [search, setSearch] = useState("");

  async function loadAll() {
    const [movRes, stockRes, whRes, rulesRes, alertsRes, warehousesRes, productsRes] = await Promise.all([
      fetch(MOVEMENTS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(STOCK_SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(WAREHOUSE_SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(REORDER_RULES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(STOCK_ALERTS_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(WAREHOUSES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(PRODUCTS_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);

    const movData = await movRes.json().catch(() => []);
    const stockData = await stockRes.json().catch(() => []);
    const whData = await whRes.json().catch(() => []);
    const rulesData = await rulesRes.json().catch(() => []);
    const alertsData = await alertsRes.json().catch(() => []);
    const warehousesData = await warehousesRes.json().catch(() => []);
    const productsData = await productsRes.json().catch(() => []);

    if (!movRes.ok) throw new Error(movData.detail || "فشل تحميل الحركات");
    if (!stockRes.ok) throw new Error(stockData.detail || "فشل تحميل ملخص المخزون");
    if (!whRes.ok) throw new Error(whData.detail || "فشل تحميل ملخص المخازن");
    if (!rulesRes.ok) throw new Error(rulesData.detail || "فشل تحميل قواعد إعادة الطلب");
    if (!alertsRes.ok) throw new Error(alertsData.detail || "فشل تحميل تنبيهات المخزون");
    if (!warehousesRes.ok) throw new Error(warehousesData.detail || "فشل تحميل المخازن");
    if (!productsRes.ok) throw new Error(productsData.detail || "فشل تحميل المنتجات");

    setMovements(Array.isArray(movData) ? movData : []);
    setStockSummary(Array.isArray(stockData) ? stockData : []);
    setWarehouseSummary(Array.isArray(whData) ? whData : []);
    setRules(Array.isArray(rulesData) ? rulesData : []);
    setAlerts(Array.isArray(alertsData) ? alertsData : []);
    setWarehouses(Array.isArray(warehousesData) ? warehousesData : []);
    setProducts(Array.isArray(productsData) ? productsData : []);
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء التحميل"));
  }, [ready, user]);

  const filteredStock = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return stockSummary;
    return stockSummary.filter((item) => [item.factory_name, item.warehouse_name, item.product_name, item.product_sku].join(" ").toLowerCase().includes(q));
  }, [stockSummary, search]);

  const stats = useMemo(() => ({
    movements: movements.length,
    products: stockSummary.length,
    warehouses: warehouseSummary.length,
    alerts: alerts.filter((x) => x.alert_status !== "healthy").length,
  }), [movements, stockSummary, warehouseSummary, alerts]);

  async function handleMovement(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const res = await fetch(MOVEMENTS_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          warehouse_id: Number(movementForm.warehouse_id),
          product_id: Number(movementForm.product_id),
          movement_type: movementForm.movement_type,
          quantity: Number(movementForm.quantity || 0),
          reference_type: movementForm.reference_type || null,
          reference_id: movementForm.reference_id ? Number(movementForm.reference_id) : null,
          notes: movementForm.notes || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل إنشاء حركة مخزون");

      setMovementForm(emptyMovementForm);
      setMessage("تم إنشاء حركة المخزون بنجاح");
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء إنشاء الحركة");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTransfer(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const res = await fetch(TRANSFER_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          from_warehouse_id: Number(transferForm.from_warehouse_id),
          to_warehouse_id: Number(transferForm.to_warehouse_id),
          product_id: Number(transferForm.product_id),
          quantity: Number(transferForm.quantity || 0),
          notes: transferForm.notes || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل تنفيذ تحويل المخزون");

      setTransferForm(emptyTransferForm);
      setMessage("تم تنفيذ تحويل المخزون بنجاح");
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء التحويل");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleRule(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const res = await fetch(REORDER_RULES_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({
          warehouse_id: Number(ruleForm.warehouse_id),
          product_id: Number(ruleForm.product_id),
          min_stock_level: Number(ruleForm.min_stock_level || 0),
          reorder_level: Number(ruleForm.reorder_level || 0),
          reorder_quantity: Number(ruleForm.reorder_quantity || 0),
          notes: ruleForm.notes || null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل إنشاء قاعدة إعادة الطلب");

      setRuleForm(emptyRuleForm);
      setMessage("تم إنشاء قاعدة إعادة الطلب بنجاح");
      await loadAll();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء إنشاء القاعدة");
    } finally {
      setSubmitting(false);
    }
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
      const res = await fetch(`${AUDIT_ENTITY_HISTORY_API_URL}?entity_type=inventory_movement&entity_id=${encodeURIComponent(historyEntityId)}`, {
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

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل المخزون...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">Inventory Operations</div>
            <h2>المخزون</h2>
            <p>حركات مخزون، تحويلات، قواعد إعادة الطلب، وتنبيهات الجرد في صفحة تشغيلية موحدة.</p>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box"><div className="erp-stat-box-label">الحركات</div><div className="erp-stat-box-value">{stats.movements}</div></div>
            <div className="erp-stat-box"><div className="erp-stat-box-label">التنبيهات</div><div className="erp-stat-box-value">{stats.alerts}</div></div>
          </div>
        </section>

        {message ? <div className="erp-form-message">{message}</div> : null}

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">الحركات</div><div className="erp-card-value">{stats.movements}</div></div>
          <div className="erp-card"><div className="erp-card-title">ملخصات المنتجات</div><div className="erp-card-value">{stats.products}</div></div>
          <div className="erp-card"><div className="erp-card-title">المخازن</div><div className="erp-card-value">{stats.warehouses}</div></div>
          <div className="erp-card"><div className="erp-card-title">تنبيهات فعالة</div><div className="erp-card-value">{stats.alerts}</div></div>
        </section>

        <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom: "18px" }}>
          <div className="erp-section-card">
            <div className="erp-section-head"><h3 style={{ margin: 0 }}>حركة مخزون جديدة</h3></div>
            <form className="erp-form-grid" onSubmit={handleMovement}>
              <select className="erp-input" value={movementForm.warehouse_id} onChange={(e) => setMovementForm((p) => ({ ...p, warehouse_id: e.target.value }))}>
                <option value="">اختر المخزن</option>
                {warehouses.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
              </select>
              <select className="erp-input" value={movementForm.product_id} onChange={(e) => setMovementForm((p) => ({ ...p, product_id: e.target.value }))}>
                <option value="">اختر المنتج</option>
                {products.map((item) => <option key={item.id} value={item.id}>{item.name_ar} ({item.sku})</option>)}
              </select>
              <select className="erp-input" value={movementForm.movement_type} onChange={(e) => setMovementForm((p) => ({ ...p, movement_type: e.target.value }))}>
                <option value="in">إضافة</option>
                <option value="out">صرف</option>
                <option value="adjustment">تسوية</option>
              </select>
              <input type="number" min="0" step="0.01" className="erp-input" placeholder="الكمية" value={movementForm.quantity} onChange={(e) => setMovementForm((p) => ({ ...p, quantity: e.target.value }))} />
              <input className="erp-input" placeholder="نوع المرجع" value={movementForm.reference_type} onChange={(e) => setMovementForm((p) => ({ ...p, reference_type: e.target.value }))} />
              <input type="number" min="0" step="1" className="erp-input" placeholder="رقم المرجع" value={movementForm.reference_id} onChange={(e) => setMovementForm((p) => ({ ...p, reference_id: e.target.value }))} />
              <textarea className="erp-input" rows="3" placeholder="ملاحظات" value={movementForm.notes} onChange={(e) => setMovementForm((p) => ({ ...p, notes: e.target.value }))} />
              <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : "حفظ الحركة"}</button></div>
            </form>
          </div>

          <div className="erp-section-card">
            <div className="erp-section-head"><h3 style={{ margin: 0 }}>تحويل بين المخازن</h3></div>
            <form className="erp-form-grid" onSubmit={handleTransfer}>
              <select className="erp-input" value={transferForm.from_warehouse_id} onChange={(e) => setTransferForm((p) => ({ ...p, from_warehouse_id: e.target.value }))}>
                <option value="">من مخزن</option>
                {warehouses.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
              </select>
              <select className="erp-input" value={transferForm.to_warehouse_id} onChange={(e) => setTransferForm((p) => ({ ...p, to_warehouse_id: e.target.value }))}>
                <option value="">إلى مخزن</option>
                {warehouses.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
              </select>
              <select className="erp-input" value={transferForm.product_id} onChange={(e) => setTransferForm((p) => ({ ...p, product_id: e.target.value }))}>
                <option value="">اختر المنتج</option>
                {products.map((item) => <option key={item.id} value={item.id}>{item.name_ar} ({item.sku})</option>)}
              </select>
              <input type="number" min="0" step="0.01" className="erp-input" placeholder="الكمية" value={transferForm.quantity} onChange={(e) => setTransferForm((p) => ({ ...p, quantity: e.target.value }))} />
              <textarea className="erp-input" rows="3" placeholder="ملاحظات" value={transferForm.notes} onChange={(e) => setTransferForm((p) => ({ ...p, notes: e.target.value }))} />
              <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ التحويل..." : "تنفيذ التحويل"}</button></div>
            </form>
          </div>
        </div>

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head"><h3 style={{ margin: 0 }}>قاعدة إعادة طلب</h3></div>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleRule}>
            <select className="erp-input" value={ruleForm.warehouse_id} onChange={(e) => setRuleForm((p) => ({ ...p, warehouse_id: e.target.value }))}>
              <option value="">اختر المخزن</option>
              {warehouses.map((item) => <option key={item.id} value={item.id}>{item.name} ({item.code})</option>)}
            </select>
            <select className="erp-input" value={ruleForm.product_id} onChange={(e) => setRuleForm((p) => ({ ...p, product_id: e.target.value }))}>
              <option value="">اختر المنتج</option>
              {products.map((item) => <option key={item.id} value={item.id}>{item.name_ar} ({item.sku})</option>)}
            </select>
            <input type="number" min="0" step="0.01" className="erp-input" placeholder="الحد الأدنى" value={ruleForm.min_stock_level} onChange={(e) => setRuleForm((p) => ({ ...p, min_stock_level: e.target.value }))} />
            <input type="number" min="0" step="0.01" className="erp-input" placeholder="حد إعادة الطلب" value={ruleForm.reorder_level} onChange={(e) => setRuleForm((p) => ({ ...p, reorder_level: e.target.value }))} />
            <input type="number" min="0" step="0.01" className="erp-input" placeholder="كمية إعادة الطلب" value={ruleForm.reorder_quantity} onChange={(e) => setRuleForm((p) => ({ ...p, reorder_quantity: e.target.value }))} />
            <input className="erp-input" placeholder="ملاحظات" value={ruleForm.notes} onChange={(e) => setRuleForm((p) => ({ ...p, notes: e.target.value }))} />
            <div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : "حفظ القاعدة"}</button></div>
          </form>
        </div>

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head"><h3 style={{ margin: 0 }}>تنبيهات المخزون</h3></div>
          <div className="erp-table-shell" style={{ overflowX: "auto" }}>
            <table className="erp-table" style={{ minWidth: "1200px" }}>
              <thead>
                <tr>
                  <th>المصنع</th>
                  <th>المخزن</th>
                  <th>المنتج</th>
                  <th>SKU</th>
                  <th>المخزون الحالي</th>
                  <th>الحد الأدنى</th>
                  <th>إعادة الطلب</th>
                  <th>الكمية المقترحة</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {alerts.length === 0 ? (
                  <tr><td colSpan="9">لا توجد تنبيهات حالياً.</td></tr>
                ) : alerts.map((item) => (
                  <tr key={item.reorder_rule_id}>
                    <td>{item.factory_name}</td>
                    <td>{item.warehouse_name}</td>
                    <td>{item.product_name}</td>
                    <td>{item.product_sku}</td>
                    <td>{formatAmount(item.current_stock)}</td>
                    <td>{formatAmount(item.min_stock_level)}</td>
                    <td>{formatAmount(item.reorder_level)}</td>
                    <td>{formatAmount(item.reorder_quantity)}</td>
                    <td><span className="erp-badge warning">{alertLabel(item.alert_status)}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head">
            <div style={{ textAlign: "right" }}>
              <h3 style={{ marginBottom: "4px" }}>ملخص المخزون</h3>
            </div>
            <input className="erp-input" style={{ maxWidth: "420px" }} placeholder="ابحث بالمنتج أو المخزن..." value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
          <div className="erp-table-shell" style={{ overflowX: "auto" }}>
            <table className="erp-table" style={{ minWidth: "1200px" }}>
              <thead>
                <tr>
                  <th>المصنع</th>
                  <th>المخزن</th>
                  <th>المنتج</th>
                  <th>SKU</th>
                  <th>المخزون الحالي</th>
                </tr>
              </thead>
              <tbody>
                {filteredStock.length === 0 ? (
                  <tr><td colSpan="5">لا توجد بيانات حالياً.</td></tr>
                ) : filteredStock.map((item, idx) => (
                  <tr key={`${item.warehouse_id}-${item.product_id}-${idx}`}>
                    <td>{item.factory_name}</td>
                    <td>{item.warehouse_name} ({item.warehouse_code})</td>
                    <td>{item.product_name}</td>
                    <td>{item.product_sku}</td>
                    <td>{formatAmount(item.current_stock)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head"><h3 style={{ margin: 0 }}>الحركات الأخيرة وقواعد إعادة الطلب</h3></div>
          <div className="erp-form-grid erp-form-grid-2">
            <div className="erp-table-shell" style={{ overflowX: "auto" }}>
              <table className="erp-table" style={{ minWidth: "900px" }}>
                <thead>
                  <tr>
                    <th>المخزن</th>
                    <th>المنتج</th>
                    <th>نوع الحركة</th>
                    <th>الكمية</th>
                    <th>المرجع</th>
                  </tr>
                </thead>
                <tbody>
                  {movements.slice(0, 12).map((item) => (
                    <tr key={item.id}>
                      <td>{item.warehouse_name}</td>
                      <td>{item.product_name}</td>
                      <td>{movementTypeLabel(item.movement_type)}</td>
                      <td>{formatAmount(item.quantity)}</td>
                      <td>{item.reference_type || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="erp-table-shell" style={{ overflowX: "auto" }}>
              <table className="erp-table" style={{ minWidth: "900px" }}>
                <thead>
                  <tr>
                    <th>المخزن</th>
                    <th>المنتج</th>
                    <th>الحد الأدنى</th>
                    <th>إعادة الطلب</th>
                    <th>الكمية</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.slice(0, 12).map((item) => (
                    <tr key={item.id}>
                      <td>{item.warehouse_name}</td>
                      <td>{item.product_name}</td>
                      <td>{formatAmount(item.min_stock_level)}</td>
                      <td>{formatAmount(item.reorder_level)}</td>
                      <td>{formatAmount(item.reorder_quantity)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
