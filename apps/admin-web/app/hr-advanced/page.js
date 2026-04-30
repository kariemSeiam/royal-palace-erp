"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const JOBS_URL = "https://api.royalpalace-group.com/api/v1/admin/hr-advanced/jobs";
const APPLICANTS_URL = "https://api.royalpalace-group.com/api/v1/admin/hr-advanced/applicants";
const CONTRACTS_URL = "https://api.royalpalace-group.com/api/v1/admin/hr-advanced/contracts";

export default function HrAdvancedPage() {
  const { user, ready } = useAdminAuth("hr_advanced");
  const [jobs, setJobs] = useState([]);
  const [applicants, setApplicants] = useState([]);
  const [contracts, setContracts] = useState([]);
  const [message, setMessage] = useState("");
  const [newJob, setNewJob] = useState({ name: "", code: "" });
  const [newApplicant, setNewApplicant] = useState({ first_name: "", last_name: "", email: "" });
  const [newContract, setNewContract] = useState({ employee_id: "", start_date: "" });
  const [submitting, setSubmitting] = useState(false);

  async function loadAll() {
    try {
      const [jobRes, appRes, conRes] = await Promise.all([
        fetch(JOBS_URL, { headers: authHeaders() }),
        fetch(APPLICANTS_URL, { headers: authHeaders() }),
        fetch(CONTRACTS_URL, { headers: authHeaders() }),
      ]);
      setJobs(jobRes.ok ? await jobRes.json() : []);
      setApplicants(appRes.ok ? await appRes.json() : []);
      setContracts(conRes.ok ? await conRes.json() : []);
    } catch (err) {
      setMessage("تعذر التحميل");
    }
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll();
  }, [ready, user]);

  async function createJob(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(JOBS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(newJob),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء");
      setNewJob({ name: "", code: "" });
      loadAll();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function createApplicant(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(APPLICANTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(newApplicant),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الإضافة");
      setNewApplicant({ first_name: "", last_name: "", email: "" });
      loadAll();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  async function createContract(e) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const payload = { ...newContract, employee_id: Number(newContract.employee_id) };
      const res = await fetch(CONTRACTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).detail || "فشل الإنشاء");
      setNewContract({ employee_id: "", start_date: "" });
      loadAll();
    } catch (err) {
      setMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  if (!ready || !user)
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ التحميل...</div>
      </main>
    );

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">HR Advanced</div>
            <h2>الموارد البشرية المتقدمة</h2>
            <p>إدارة الوظائف والمتقدمين والعقود.</p>
          </div>
        </section>

        {message && <div className="erp-form-message">{message}</div>}

        <div className="erp-form-grid erp-form-grid-2" style={{ marginBottom: "18px" }}>
          <div className="erp-section-card">
            <h3>وظيفة جديدة</h3>
            <form className="erp-form-grid" onSubmit={createJob}>
              <input
                className="erp-input"
                placeholder="اسم الوظيفة"
                value={newJob.name}
                onChange={(e) => setNewJob({ ...newJob, name: e.target.value })}
                required
              />
              <input
                className="erp-input"
                placeholder="الكود"
                value={newJob.code}
                onChange={(e) => setNewJob({ ...newJob, code: e.target.value })}
                required
              />
              <div className="erp-form-actions">
                <button className="erp-btn-primary" type="submit" disabled={submitting}>
                  {submitting ? "جارٍ الحفظ..." : "إنشاء"}
                </button>
              </div>
            </form>
          </div>

          <div className="erp-section-card">
            <h3>متقدم جديد</h3>
            <form className="erp-form-grid" onSubmit={createApplicant}>
              <input
                className="erp-input"
                placeholder="الاسم الأول"
                value={newApplicant.first_name}
                onChange={(e) => setNewApplicant({ ...newApplicant, first_name: e.target.value })}
                required
              />
              <input
                className="erp-input"
                placeholder="الاسم الأخير"
                value={newApplicant.last_name}
                onChange={(e) => setNewApplicant({ ...newApplicant, last_name: e.target.value })}
                required
              />
              <input
                className="erp-input"
                placeholder="البريد الإلكتروني"
                value={newApplicant.email}
                onChange={(e) => setNewApplicant({ ...newApplicant, email: e.target.value })}
              />
              <div className="erp-form-actions">
                <button className="erp-btn-primary" type="submit" disabled={submitting}>
                  {submitting ? "جارٍ الحفظ..." : "إضافة"}
                </button>
              </div>
            </form>
          </div>
        </div>

        <div className="erp-section-card" style={{ marginBottom: "18px" }}>
          <h3>عقد جديد</h3>
          <form className="erp-form-grid erp-form-grid-2" onSubmit={createContract}>
            <input
              className="erp-input"
              placeholder="معرف الموظف"
              value={newContract.employee_id}
              onChange={(e) => setNewContract({ ...newContract, employee_id: e.target.value })}
              required
            />
            <input
              className="erp-input"
              type="date"
              placeholder="تاريخ البداية"
              value={newContract.start_date}
              onChange={(e) => setNewContract({ ...newContract, start_date: e.target.value })}
              required
            />
            <div className="erp-form-actions">
              <button className="erp-btn-primary" type="submit" disabled={submitting}>
                {submitting ? "جارٍ الحفظ..." : "إنشاء العقد"}
              </button>
            </div>
          </form>
        </div>

        <div className="erp-form-grid erp-form-grid-2">
          <div className="erp-section-card">
            <h3>الوظائف</h3>
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>الاسم</th>
                    <th>الكود</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan="3">لا توجد وظائف.</td>
                    </tr>
                  ) : (
                    jobs.map((j) => (
                      <tr key={j.id}>
                        <td>{j.id}</td>
                        <td>{j.name}</td>
                        <td>{j.code}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="erp-section-card">
            <h3>المتقدمون</h3>
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>الاسم</th>
                    <th>البريد</th>
                    <th>الحالة</th>
                  </tr>
                </thead>
                <tbody>
                  {applicants.length === 0 ? (
                    <tr>
                      <td colSpan="4">لا يوجد متقدمون.</td>
                    </tr>
                  ) : (
                    applicants.map((a) => (
                      <tr key={a.id}>
                        <td>{a.id}</td>
                        <td>
                          {a.first_name} {a.last_name}
                        </td>
                        <td>{a.email || "-"}</td>
                        <td>{a.status}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="erp-section-card" style={{ marginTop: "18px" }}>
          <h3>العقود</h3>
          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>الموظف</th>
                  <th>النوع</th>
                  <th>البداية</th>
                  <th>النهاية</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {contracts.length === 0 ? (
                  <tr>
                    <td colSpan="6">لا توجد عقود.</td>
                  </tr>
                ) : (
                  contracts.map((c) => (
                    <tr key={c.id}>
                      <td>{c.id}</td>
                      <td>{c.employee_id}</td>
                      <td>{c.contract_type}</td>
                      <td>{c.start_date}</td>
                      <td>{c.end_date || "-"}</td>
                      <td>{c.status}</td>
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
