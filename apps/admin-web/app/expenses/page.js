"use client";
import { useEffect, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { exportTableCsv, exportTablePdf } from "../components/hrExports";
import KanbanBoard from "../components/KanbanBoard";

const EXPENSES_URL = "https://api.royalpalace-group.com/api/v1/admin/expenses";
const CATEGORIES_URL = "https://api.royalpalace-group.com/api/v1/admin/expenses/categories";

const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };
const STATUSES = ["draft","submitted","approved","rejected","paid"];
const STATUS_LABELS = { draft:"مسودة", submitted:"مقدم", approved:"معتمد", rejected:"مرفوض", paid:"مدفوع" };
const STATUS_COLORS = { draft:"#6b7280", submitted:"#3b82f6", approved:"#10b981", rejected:"#ef4444", paid:"#8b5cf6" };

function renderExpenseCard(e) {
  return (
    <div>
      <div style={{ fontWeight:900, fontSize:"14px" }}>{e.description}</div>
      <div style={{ fontSize:"12px", color:"var(--rp-text-muted)" }}>{e.amount}</div>
      <div style={{ fontSize:"11px", color:"var(--rp-text-soft)" }}>{e.expense_date||"-"}</div>
    </div>
  );
}

export default function ExpensesPage() {
  const { user, ready } = useAdminAuth("expenses");
  const [expenses, setExpenses] = useState([]);
  const [categories, setCategories] = useState([]);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState({ description:"", amount:"", category_id:"", expense_date:"", status:"draft" });
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState("kanban");

  async function loadAll() { try { const [expRes, catRes] = await Promise.all([fetch(EXPENSES_URL, { headers: authHeaders() }), fetch(CATEGORIES_URL, { headers: authHeaders() })]); setExpenses(expRes.ok ? await expRes.json() : []); setCategories(catRes.ok ? await catRes.json() : []); } catch (err) { setMessage("تعذر التحميل"); } }
  useEffect(() => { if (!ready || !user) return; loadAll(); }, [ready, user]);
  function resetForm() { setForm({ description:"", amount:"", category_id:"", expense_date:"", status:"draft" }); setEditingId(null); }
  function startEdit(e) { setEditingId(e.id); setForm({ description:e.description||"", amount:String(e.amount||""), category_id:e.category_id?String(e.category_id):"", expense_date:e.expense_date||"", status:e.status||"draft" }); }
  async function handleSubmit(e) { e.preventDefault(); setSubmitting(true); setMessage(""); try { const payload = { ...form, amount: Number(form.amount), category_id: form.category_id ? Number(form.category_id) : null }; const url = editingId ? `${EXPENSES_URL}/${editingId}` : EXPENSES_URL; const method = editingId ? "PUT" : "POST"; const res = await fetch(url, { method, headers:{"Content-Type":"application/json",...authHeaders()}, body:JSON.stringify(payload) }); if (!res.ok) throw new Error((await res.json()).detail || "فشل الحفظ"); setMessage(editingId ? "تم تعديل المصروف" : "تم إنشاء المصروف"); resetForm(); loadAll(); } catch (err) { setMessage(err.message); } finally { setSubmitting(false); } }
  async function deleteExpense(id) { if (!confirm("حذف المصروف؟")) return; await fetch(`${EXPENSES_URL}/${id}`,{method:"DELETE",headers:authHeaders()}); loadAll(); }
  function handleExportCsv() { exportTableCsv("expenses.csv",["الوصف","المبلغ","الفئة","التاريخ","الحالة","الموظف"],expenses.map((e)=>[e.description,e.amount,categories.find((c)=>c.id===e.category_id)?.name||"",e.expense_date||"",e.status,e.employee_id||""])); }
  function handleExportPdf() { exportTablePdf("تقرير المصاريف","المصاريف",[{ label:"عدد المصاريف",value:expenses.length }],["الوصف","المبلغ","الفئة","التاريخ","الحالة","الموظف"],expenses.map((e)=>[e.description,e.amount,categories.find((c)=>c.id===e.category_id)?.name||"",e.expense_date||"",e.status,e.employee_id||""])); }

  if (!ready || !user) return <main className="loading-shell"><div className="loading-card">جارٍ التحميل...</div></main>;

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero"><div><div className="erp-hero-pill">Expenses</div><h2>إدارة المصاريف</h2><p>تسجيل ومتابعة مصاريف الموظفين حسب الفئة والحالة.</p></div><div className="erp-stat-panel"><div className="erp-stat-box"><div className="erp-stat-box-label">مصاريف</div><div className="erp-stat-box-value">{expenses.length}</div></div></div></section>
        {message ? <div className="erp-form-message">{message}</div> : null}
        <div className="erp-section-card" style={{ marginBottom:"18px" }}><div className="erp-section-head"><h3>{editingId ? "تعديل مصروف" : "تسجيل مصروف جديد"}</h3></div><form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}><input className="erp-input" placeholder="الوصف" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} required /><input className="erp-input" type="number" step="0.01" placeholder="المبلغ" value={form.amount} onChange={(e)=>setForm({...form,amount:e.target.value})} required /><select className="erp-input" value={form.category_id} onChange={(e)=>setForm({...form,category_id:e.target.value})}><option value="">اختر الفئة</option>{categories.map((c)=><option key={c.id} value={c.id}>{c.name}</option>)}</select><input className="erp-input" type="date" value={form.expense_date} onChange={(e)=>setForm({...form,expense_date:e.target.value})} /><select className="erp-input" value={form.status} onChange={(e)=>setForm({...form,status:e.target.value})}>{STATUSES.map((s)=><option key={s} value={s}>{s}</option>)}</select><div className="erp-form-actions"><button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting?"جارٍ الحفظ...":editingId?"حفظ التعديل":"تسجيل المصروف"}</button>{editingId&&<button type="button" className="erp-btn-secondary" onClick={resetForm}>إلغاء</button>}</div></form></div>

        <div className="erp-section-card">
          <div className="erp-section-head"><h3>سجل المصاريف</h3>
            <div style={{ display:"flex", gap:"8px", flexWrap:"wrap" }}>
              <button className={viewMode==="kanban"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("kanban")} style={topButtonStyle}>Kanban</button>
              <button className={viewMode==="table"?"erp-btn-primary":"erp-btn-secondary"} onClick={()=>setViewMode("table")} style={topButtonStyle}>جدول</button>
              <button className="erp-btn-secondary" style={topButtonStyle} onClick={handleExportCsv}>CSV</button>
              <button className="erp-btn-primary" style={topButtonStyle} onClick={handleExportPdf}>PDF</button>
            </div>
          </div>
          {viewMode==="table" && (
            <div className="erp-table-shell">
              <table className="erp-table">
                <thead>
                  <tr><th>ID</th><th>الوصف</th><th>المبلغ</th><th>الفئة</th><th>التاريخ</th><th>الحالة</th><th>إجراءات</th></tr>
                </thead>
                <tbody>
                  {expenses.length === 0 ? (
                    <tr><td colSpan="7">لا توجد مصاريف.</td></tr>
                  ) : (
                    expenses.map((e) => (
                      <tr key={e.id}>
                        <td>{e.id}</td>
                        <td>{e.description}</td>
                        <td>{e.amount}</td>
                        <td>{categories.find((c)=>c.id===e.category_id)?.name||"-"}</td>
                        <td>{e.expense_date||"-"}</td>
                        <td>{e.status}</td>
                        <td><div style={{ display:"flex", gap:"6px" }}>
                          <button className="erp-btn-secondary" onClick={()=>startEdit(e)}>تعديل</button>
                          <button className="erp-btn-danger" onClick={()=>deleteExpense(e.id)}>حذف</button>
                        </div></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          {viewMode==="kanban" && (
            <KanbanBoard items={expenses} statusField="status" statusOptions={STATUSES} statusLabels={STATUS_LABELS} statusColors={STATUS_COLORS}
              renderCard={renderExpenseCard}
              onAction={(e)=>(<><button className="erp-btn-secondary" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>startEdit(e)}>تعديل</button><button className="erp-btn-danger" style={{fontSize:"11px",padding:"4px 8px"}} onClick={()=>deleteExpense(e.id)}>حذف</button></>)}
              emptyMessage="لا توجد مصاريف" />
          )}
        </div>
      </section>
    </main>
  );
}
