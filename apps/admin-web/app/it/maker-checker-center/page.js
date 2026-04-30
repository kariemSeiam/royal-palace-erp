"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";

const SUMMARY_API_URL = "https://api.royalpalace-group.com/api/v1/admin/maker-checker/summary";
const POLICIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/maker-checker/policies";
const REQUESTS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/maker-checker/requests";

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function formatDateTime(value) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("en-GB");
  } catch {
    return value;
  }
}

function statusTone(value) {
  if (["approved"].includes(String(value || ""))) return "success";
  if (["rejected", "overridden"].includes(String(value || ""))) return "warning";
  return "";
}

export default function MakerCheckerCenterPage() {
  const { user, ready } = useAdminAuth("it");
  const [summary, setSummary] = useState({});
  const [policies, setPolicies] = useState([]);
  const [requests, setRequests] = useState([]);
  const [message, setMessage] = useState("");

  async function loadAll() {
    const [summaryRes, policiesRes, requestsRes] = await Promise.all([
      fetch(SUMMARY_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(POLICIES_API_URL, { headers: authHeaders(), cache: "no-store" }),
      fetch(REQUESTS_API_URL, { headers: authHeaders(), cache: "no-store" }),
    ]);

    const summaryData = await summaryRes.json().catch(() => ({}));
    const policiesData = await policiesRes.json().catch(() => []);
    const requestsData = await requestsRes.json().catch(() => []);

    if (!summaryRes.ok) throw new Error(summaryData.detail || "فشل تحميل ملخص maker-checker");
    if (!policiesRes.ok) throw new Error(policiesData.detail || "فشل تحميل السياسات");
    if (!requestsRes.ok) throw new Error(requestsData.detail || "فشل تحميل الطلبات");

    setSummary(summaryData?.summary || {});
    setPolicies(safeArray(policiesData));
    setRequests(safeArray(requestsData));
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء التحميل"));
  }, [ready, user]);

  const counts = useMemo(() => ({
    policies: safeArray(policies).length,
    requests: safeArray(requests).length,
    pending: safeArray(requests).filter((item) => item.status === "pending").length,
  }), [policies, requests]);

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل مركز maker-checker...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">Maker-Checker / Approval Matrix / Exception Governance</div>
            <h2>مركز maker-checker</h2>
            <p>
              هذه المرحلة تغلق طبقة الموافقات المؤسسية عبر سياسات اعتماد قابلة لإعادة الاستخدام،
              وطلبات موافقة، ومنع maker من تنفيذ checker عند تفعيل القاعدة.
            </p>
            <div className="erp-hero-actions">
              <div className="erp-hero-pill">Policies: {summary.policies_count || 0}</div>
              <div className="erp-hero-pill">Pending: {summary.pending_requests_count || 0}</div>
              <div className="erp-hero-pill">Overridden: {summary.overridden_requests_count || 0}</div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">Active policies</div>
              <div className="erp-stat-box-value">{summary.active_policies_count || 0}</div>
            </div>
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">Requests</div>
              <div className="erp-stat-box-value">{summary.requests_count || 0}</div>
            </div>
            <div className="erp-hero-visual" />
          </div>
        </section>

        {message ? <div className="erp-form-message" style={{ marginBottom: "16px" }}>{message}</div> : null}

        <section className="erp-kpi-grid" style={{ marginBottom: "18px" }}>
          <div className="erp-card"><div className="erp-card-title">Policies</div><div className="erp-card-value">{summary.policies_count || 0}</div><div className="erp-card-note">مصفوفة الاعتماد</div></div>
          <div className="erp-card"><div className="erp-card-title">Pending</div><div className="erp-card-value">{summary.pending_requests_count || 0}</div><div className="erp-card-note">طلبات تنتظر checker</div></div>
          <div className="erp-card"><div className="erp-card-title">Approved</div><div className="erp-card-value">{summary.approved_requests_count || 0}</div><div className="erp-card-note">اعتمادات ناجزة</div></div>
          <div className="erp-card"><div className="erp-card-title">Rejected</div><div className="erp-card-value">{summary.rejected_requests_count || 0}</div><div className="erp-card-note">طلبات مرفوضة</div></div>
          <div className="erp-card"><div className="erp-card-title">Overridden</div><div className="erp-card-value">{summary.overridden_requests_count || 0}</div><div className="erp-card-note">استثناءات مع سبب</div></div>
          <div className="erp-card"><div className="erp-card-title">Phase</div><div className="erp-card-value">1</div><div className="erp-card-note">foundation</div></div>
        </section>

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <div className="erp-section-head">
            <div>
              <h3>سياسات الاعتماد</h3>
              <p>تعريف reusable approval policies حسب module / entity / action</p>
            </div>
          </div>
          <div className="erp-table-shell" style={{ overflowX: "auto" }}>
            <table className="erp-table" style={{ minWidth: "1600px" }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Module</th>
                  <th>Entity</th>
                  <th>Action</th>
                  <th>Title</th>
                  <th>Maker Permission</th>
                  <th>Checker Permission</th>
                  <th>Different Checker</th>
                  <th>Reject Reason</th>
                  <th>Override Reason</th>
                  <th>Active</th>
                </tr>
              </thead>
              <tbody>
                {safeArray(policies).length === 0 ? (
                  <tr><td colSpan="11">لا توجد سياسات حالياً.</td></tr>
                ) : (
                  safeArray(policies).map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.module}</td>
                      <td>{item.entity_type}</td>
                      <td>{item.action_code}</td>
                      <td>{item.title}</td>
                      <td>{item.maker_permission_code || "-"}</td>
                      <td>{item.checker_permission_code || "-"}</td>
                      <td>{item.require_different_checker ? "Yes" : "No"}</td>
                      <td>{item.require_reason_on_reject ? "Yes" : "No"}</td>
                      <td>{item.require_reason_on_override ? "Yes" : "No"}</td>
                      <td>{item.is_active ? "Yes" : "No"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="erp-section-card">
          <div className="erp-section-head">
            <div>
              <h3>طلبات الاعتماد</h3>
              <p>قائمة approval requests مع reason / override / checker traceability</p>
            </div>
          </div>
          <div className="erp-table-shell" style={{ overflowX: "auto" }}>
            <table className="erp-table" style={{ minWidth: "1800px" }}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Factory</th>
                  <th>Policy</th>
                  <th>Entity</th>
                  <th>Action</th>
                  <th>Requested By</th>
                  <th>Assigned Checker</th>
                  <th>Checked By</th>
                  <th>Status</th>
                  <th>Request Reason</th>
                  <th>Rejection Reason</th>
                  <th>Override Reason</th>
                  <th>Requested At</th>
                  <th>Checked At</th>
                </tr>
              </thead>
              <tbody>
                {safeArray(requests).length === 0 ? (
                  <tr><td colSpan="14">لا توجد طلبات اعتماد حالياً.</td></tr>
                ) : (
                  safeArray(requests).map((item) => (
                    <tr key={item.id}>
                      <td>{item.id}</td>
                      <td>{item.factory_name || item.factory_id || "-"}</td>
                      <td>{item.policy_title || `#${item.policy_id}`}</td>
                      <td>{item.entity_type}{item.entity_id ? ` #${item.entity_id}` : ""}</td>
                      <td>{item.action_code}</td>
                      <td>{item.requested_by_name || item.requested_by_user_id || "-"}</td>
                      <td>{item.assigned_checker_name || item.assigned_checker_user_id || "-"}</td>
                      <td>{item.checked_by_name || item.checked_by_user_id || "-"}</td>
                      <td><span className={`erp-badge ${statusTone(item.status)}`}>{item.status}</span></td>
                      <td>{item.request_reason || "-"}</td>
                      <td>{item.rejection_reason || "-"}</td>
                      <td>{item.override_reason || "-"}</td>
                      <td>{formatDateTime(item.requested_at)}</td>
                      <td>{formatDateTime(item.checked_at)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>
    </main>
  );
}
