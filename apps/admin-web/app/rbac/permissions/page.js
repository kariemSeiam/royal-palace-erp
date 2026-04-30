"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../../components/Sidebar";
import useAdminAuth from "../../components/useAdminAuth";
import { authHeaders } from "../../components/api";

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

export default function PermissionsPage() {
  const { user, ready } = useAdminAuth("permissions");

  const [items, setItems] = useState([]);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");

  async function loadAll() {
    const res = await fetch("https://api.royalpalace-group.com/api/v1/admin/users/permissions/catalog", {
      headers: authHeaders(),
      cache: "no-store",
    });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.detail || "فشل تحميل الصلاحيات");
    setItems(Array.isArray(data) ? data : []);
  }

  useEffect(() => {
    if (!ready || !user) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء التحميل"));
  }, [ready, user]);

  const filteredItems = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return items;
    return items.filter((item) =>
      [item.code, item.name, item.module].join(" ").toLowerCase().includes(q)
    );
  }, [items, search]);

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل الصلاحيات...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <div className="erp-section-card">
          <div className="erp-section-head">
            <div style={{ textAlign: "right" }}>
              <h3 style={{ margin: 0 }}>إدارة الصلاحيات</h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)" }}>
                عرض الصلاحيات المتاحة في النظام حسب الموديول والكود.
              </p>
            </div>
            <input
              className="erp-search"
              placeholder="ابحث بالكود أو الاسم أو الموديول..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {message ? <div className="erp-form-message">{message}</div> : null}

          <div className="erp-table-shell">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>الكود</th>
                  <th>الاسم</th>
                  <th>الموديول</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.length === 0 ? (
                  <tr>
                    <td colSpan="4">
                      {items.length === 0 ? "لا توجد صلاحيات حالياً." : "لا توجد نتائج مطابقة."}
                    </td>
                  </tr>
                ) : (
                  filteredItems.map((item) => (
                    <tr key={item.id || item.code}>
                      <td style={{ fontFamily: "monospace", fontSize: "13px", direction: "ltr", textAlign: "right" }}>
                        {item.code}
                      </td>
                      <td>{item.name || "-"}</td>
                      <td>{item.module || "-"}</td>
                      <td>
                        <span className={`erp-badge ${item.is_active !== false ? "success" : "warning"}`}>
                          {item.is_active !== false ? "نشط" : "غير نشط"}
                        </span>
                      </td>
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
