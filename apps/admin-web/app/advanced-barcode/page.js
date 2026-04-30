"use client";

import { useEffect, useMemo, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const TEMPLATES_API = "https://api.royalpalace-group.com/api/v1/admin/barcode/templates";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50];

const emptyForm = {
  name: "",
  format_type: "code128",
  width: 200,
  height: 80,
  include_text: true,
};

function companyName() { return "Royal Palace Group"; }

function exportBarcodeCsv(rows) {
  const headers = ["ID", "الاسم", "النوع", "العرض", "الارتفاع", "تضمين النص"];
  const escapeCsv = (v) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };
  const lines = rows.map((t) =>
    [t.id, t.name, t.format_type, t.width, t.height, t.include_text ? "نعم" : "لا"].map(escapeCsv).join(",")
  );
  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "barcode_templates.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function exportBarcodePdf(rows) {
  const printWindow = window.open("", "_blank", "width=1280,height=900");
  if (!printWindow) return;
  const rowsHtml = rows.map((t) =>
    `<tr>
      <td>${t.id || ""}</td>
      <td>${t.name || "-"}</td>
      <td>${t.format_type || "-"}</td>
      <td>${t.width || ""}</td>
      <td>${t.height || ""}</td>
      <td>${t.include_text ? "نعم" : "لا"}</td>
    </tr>`
  ).join("");
  const html = `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="UTF-8"><title>تقرير قوالب الباركود</title><style>
    @page { size: A4 landscape; margin: 12mm; }
    body { font-family: Arial, sans-serif; color: #0f172a; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; text-align: right; }
    thead th { background: #e2e8f0; }
  </style></head><body>
    <h2>تقرير قوالب الباركود</h2>
    <table><thead><tr><th>#</th><th>الاسم</th><th>النوع</th><th>العرض</th><th>الارتفاع</th><th>تضمين النص</th></tr></thead><tbody>${rowsHtml}</tbody></table>
    <script>setTimeout(() => window.print(), 400);</script>
  </body></html>`;
  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

export default function AdvancedBarcodePage() {
  const { user, ready } = useAdminAuth("barcode");
  const [templates, setTemplates] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);

  const [tableSearch, setTableSearch] = useState("");
  const [formatFilter, setFormatFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);

  async function loadTemplates() {
    const res = await fetch(TEMPLATES_API, { headers: authHeaders(), cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.detail || "فشل تحميل القوالب");
    setTemplates(Array.isArray(data) ? data : []);
  }

  useEffect(() => { if (!ready) return; loadTemplates().catch((err) => setMessage(err.message)); }, [ready]);
  useEffect(() => { setPage(1); }, [tableSearch, formatFilter, sortBy, pageSize]);

  const filtered = useMemo(() => {
    const q = (tableSearch || "").trim().toLowerCase();
    let list = [...templates];
    if (formatFilter !== "all") list = list.filter((t) => t.format_type === formatFilter);
    if (q) list = list.filter((t) => (t.name || "").toLowerCase().includes(q) || String(t.id).includes(q));
    list.sort((a, b) => {
      if (sortBy === "name") return String(a.name || "").localeCompare(String(b.name || ""), "ar");
      return Number(b.id || 0) - Number(a.id || 0);
    });
    return list;
  }, [templates, tableSearch, formatFilter, sortBy]);

  const stats = useMemo(() => ({
    total: templates.length,
    formats: new Set(templates.map((t) => t.format_type)).size,
  }), [templates]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);
  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));

  const resetForm = () => { setForm(emptyForm); setEditingId(null); setShowForm(false); setMessage(""); };
  const startEdit = (template) => {
    setEditingId(template.id);
    setShowForm(true);
    setForm({
      name: template.name || "",
      format_type: template.format_type || "code128",
      width: template.width || 200,
      height: template.height || 80,
      include_text: template.include_text !== false,
    });
    setMessage("");
  };
  const handleDelete = async (id) => {
    if (!confirm("هل تريد حذف هذا القالب؟")) return;
    setDeletingId(id);
    setMessage("");
    try {
      const res = await fetch(`${TEMPLATES_API}/${id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف القالب");
      setMessage("تم حذف القالب بنجاح");
      if (editingId === id) resetForm();
      await loadTemplates();
    } catch (err) { setMessage(err.message); }
    finally { setDeletingId(null); }
  };
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const payload = {
        name: form.name.trim(),
        format_type: form.format_type,
        width: Number(form.width) || 200,
        height: Number(form.height) || 80,
        include_text: !!form.include_text,
      };
      const url = editingId ? `${TEMPLATES_API}/${editingId}` : TEMPLATES_API;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json", ...authHeaders() }, body: JSON.stringify(payload) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || (editingId ? "فشل تعديل القالب" : "فشل إنشاء القالب"));
      setMessage(editingId ? "تم تعديل القالب بنجاح" : "تم إنشاء القالب بنجاح");
      resetForm();
      await loadTemplates();
    } catch (err) { setMessage(err.message); }
    finally { setSubmitting(false); }
  };

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جاري التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero">
          <div><div className="erp-hero-pill">Advanced Barcode</div><h2>الباركود المتقدم</h2><p>إدارة قوالب الباركود وسجل الطباعة</p></div>
          <div><button className="erp-btn-secondary" onClick={() => setShowForm(!showForm)}>{showForm ? "إخفاء" : "فتح"} النموذج</button><button className="erp-btn-primary" onClick={() => { setForm(emptyForm); setEditingId(null); setShowForm(true); }}>إضافة قالب</button></div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">إجمالي القوالب</div><div className="erp-card-value">{stats.total}</div></div>
          <div className="erp-card"><div className="erp-card-title">أنواع التنسيق</div><div className="erp-card-value">{stats.formats}</div></div>
        </section>

        {message && <div className="erp-form-message" style={{ marginBottom: "16px" }}>{message}</div>}

        {showForm && (
          <div className="erp-section-card" style={{ marginBottom: "18px" }}>
            <form className="erp-form-grid" onSubmit={handleSubmit}>
              <input className="erp-input" placeholder="اسم القالب" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
              <select className="erp-input" value={form.format_type} onChange={(e) => setForm({ ...form, format_type: e.target.value })}>
                <option value="code128">Code 128</option>
                <option value="qr">QR Code</option>
                <option value="datamatrix">DataMatrix</option>
              </select>
              <div>العرض: <input className="erp-input" type="number" value={form.width} onChange={(e) => setForm({ ...form, width: e.target.value })} /></div>
              <div>الارتفاع: <input className="erp-input" type="number" value={form.height} onChange={(e) => setForm({ ...form, height: e.target.value })} /></div>
              <label className="erp-check"><input type="checkbox" checked={form.include_text} onChange={(e) => setForm({ ...form, include_text: e.target.checked })} /><span>تضمين النص</span></label>
              <div className="erp-form-actions">
                <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingId ? "تحديث" : "إنشاء"}</button>
                <button className="erp-btn-secondary" type="button" onClick={resetForm}>إلغاء</button>
              </div>
            </form>
          </div>
        )}

        <div className="erp-section-card">
          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", marginBottom: "12px", alignItems: "center" }}>
            <input className="erp-input" style={{ flex: "1 1 260px" }} placeholder="بحث بالاسم" value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} />
            <select className="erp-input" style={{ flex: "1 1 150px" }} value={formatFilter} onChange={(e) => setFormatFilter(e.target.value)}>
              <option value="all">كل الأنواع</option>
              <option value="code128">Code 128</option>
              <option value="qr">QR Code</option>
              <option value="datamatrix">DataMatrix</option>
            </select>
            <select className="erp-input" style={{ flex: "1 1 150px" }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="newest">الأحدث</option>
              <option value="name">الاسم</option>
            </select>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "12px" }}>
            <button className="erp-btn-secondary" onClick={() => exportBarcodeCsv(filtered)}>Export CSV</button>
            <button className="erp-btn-primary" onClick={() => exportBarcodePdf(filtered)}>Export PDF</button>
            <div style={{ marginInlineStart: "auto" }}>
              <span className="erp-mini-note">إجمالي: {filtered.length}</span>
              <select className="erp-input" style={{ marginInlineStart: 8, width: 80 }} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                {PAGE_SIZE_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="erp-table-shell" style={{ maxHeight: "60vh", overflow: "auto" }}>
            <table className="erp-table">
              <thead><tr><th>#</th><th>الاسم</th><th>النوع</th><th>العرض</th><th>الارتفاع</th><th>تضمين النص</th><th>إجراءات</th></tr></thead>
              <tbody>
                {paged.map((t) => (
                  <tr key={t.id}>
                    <td>{t.id}</td><td>{t.name}</td><td>{t.format_type}</td><td>{t.width}</td><td>{t.height}</td><td>{t.include_text ? "نعم" : "لا"}</td>
                    <td>
                      <button className="erp-btn-secondary" style={{ marginInlineEnd: 6 }} onClick={() => startEdit(t)}>تعديل</button>
                      <button className="erp-btn-danger" onClick={() => handleDelete(t.id)} disabled={deletingId === t.id}>{deletingId === t.id ? "جاري الحذف" : "حذف"}</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ marginTop: 12, display: "flex", justifyContent: "space-between" }}>
            <span>صفحة {page} من {totalPages}</span>
            <div>
              <button className="erp-btn-secondary" disabled={page === 1} onClick={() => setPage(1)}>الأولى</button>
              <button className="erp-btn-secondary" disabled={page === 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>السابقة</button>
              <button className="erp-btn-secondary" disabled={page === totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))}>التالية</button>
              <button className="erp-btn-secondary" disabled={page === totalPages} onClick={() => setPage(totalPages)}>الأخيرة</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
