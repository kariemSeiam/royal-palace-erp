"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";
import { hasPermission } from "../components/access";

const emptyForm = {
  email: "",
  username: "",
  full_name: "",
  password: "",
  role_id: "",
  employee_id: "",
  factory_id: "",
  scope: "factory",
  is_active: true,
  is_superuser: false,
  supervisor_override: false,
  data_ownership: "factory",
};

const actionButtonBaseStyle = {
  minHeight: "40px",
  padding: "10px 16px",
  borderRadius: "12px",
  border: "1px solid transparent",
  cursor: "pointer",
  fontWeight: 800,
  fontSize: "13px",
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  transition: "all 0.2s ease",
  boxShadow: "0 10px 24px rgba(15, 23, 42, 0.08)",
};

const editButtonStyle = {
  ...actionButtonBaseStyle,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
  color: "var(--rp-text)",
  borderColor: "var(--rp-border)",
};

const deleteButtonStyle = {
  ...actionButtonBaseStyle,
  background: "linear-gradient(135deg, #dc2626 0%, #b91c1c 100%)",
  color: "#ffffff",
  boxShadow: "0 12px 24px rgba(185, 28, 28, 0.18)",
};

const primaryButtonStyle = {
  ...actionButtonBaseStyle,
  minHeight: "46px",
  padding: "12px 18px",
  background: "linear-gradient(135deg, #c9a66b 0%, #d6b47a 100%)",
  color: "#111827",
  boxShadow: "0 14px 30px rgba(201, 166, 107, 0.22)",
};

const secondaryButtonStyle = {
  ...actionButtonBaseStyle,
  minHeight: "46px",
  padding: "12px 18px",
  background: "#eef2f7",
  color: "var(--rp-text)",
  borderColor: "var(--rp-border)",
};

const IT_PERMISSION_PREFIXES = [
  "it.", "infrastructure.", "servers.", "backups.", "logs.", "monitoring.",
  "deployments.", "catalog.", "media.", "themes.", "branding.", "pages.",
  "layout.", "ui_settings.", "global_settings.",
];

function resolveLockedFactoryId(user) {
  if (user?.is_superuser === true) return "";
  return user?.factory_id ? String(user.factory_id) : "";
}

function resolveVisibleFactories(user, factories) {
  const lockedFactoryId = resolveLockedFactoryId(user);
  if (!lockedFactoryId) return factories;
  return factories.filter((factory) => String(factory.id) === lockedFactoryId);
}

function resolvePreferredFactoryId(user, factories) {
  const lockedFactoryId = resolveLockedFactoryId(user);
  if (lockedFactoryId) return lockedFactoryId;
  if (!Array.isArray(factories) || factories.length === 0) return "";
  const userFactoryId = user?.factory_id || user?.factory?.id || "";
  if (userFactoryId && factories.some((factory) => String(factory.id) === String(userFactoryId))) {
    return String(userFactoryId);
  }
  return String(factories[0]?.id || "");
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function getRolePermissionCodes(roleName, roles, rolePermissionMap) {
  const normalizedRoleName = String(roleName || "").trim().toLowerCase();
  const role = Array.isArray(roles)
    ? roles.find((item) => String(item.name || "").trim().toLowerCase() === normalizedRoleName)
    : null;
  if (!role) return [];
  return rolePermissionMap[String(role.id)] || [];
}

function hasITPermissions(permissionCodes = []) {
  return permissionCodes.some((code) =>
    IT_PERMISSION_PREFIXES.some((prefix) => String(code || "").trim().toLowerCase().startsWith(prefix))
  );
}

function getScopeLabel(userRow) {
  if (userRow?.is_superuser) return "Group-Wide";
  if (userRow?.scope === "group") return "Group-Wide";
  if (userRow?.factory_id) return "Factory Scoped";
  return "No Scope";
}

function getScopeTone(userRow) {
  if (userRow?.is_superuser) return "success";
  if (userRow?.scope === "group") return "success";
  if (userRow?.factory_id) return "warning";
  return "warning";
}

function getFactoryName(userRow) {
  return userRow?.factory_name || "—";
}

function getEmployeeName(userRow) {
  return userRow?.employee_name || "—";
}

function getRoleLabel(userRow) {
  if (!userRow) return "—";
  return userRow?.role_name || userRow?.role_code || "—";
}

export default function UsersPage() {
  const { user, ready } = useAdminAuth("users");

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [factories, setFactories] = useState([]);
  const [rolePermissionMap, setRolePermissionMap] = useState({});

  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");
  const [savingScopeId, setSavingScopeId] = useState(null);
  const [editingUserId, setEditingUserId] = useState(null);
  const [search, setSearch] = useState("");

  const formRef = useRef(null);
  const firstFieldRef = useRef(null);

  const lockedFactoryId = resolveLockedFactoryId(user);
  const canManageSuperuserFlag = user?.is_superuser === true;
  const canManageSupervisorOverride = user?.is_superuser === true || hasPermission(user, "supervisor.override");

  const visibleFactories = useMemo(() => {
    return resolveVisibleFactories(user, factories);
  }, [user, factories]);

  const linkedEmployeeIds = useMemo(() => {
    return new Set(
      users
        .map((u) => u.employee_id)
        .filter((value) => value !== null && value !== undefined)
        .map((value) => Number(value))
    );
  }, [users]);

  function employeeOptionsForFactory(factoryId, currentEmployeeId = "") {
    const currentId = currentEmployeeId ? Number(currentEmployeeId) : null;
    const effectiveFactoryId = lockedFactoryId || factoryId || "";
    return employees.filter((emp) => {
      const matchesFactory = !effectiveFactoryId || String(emp.factory_id) === String(effectiveFactoryId);
      if (!matchesFactory) return false;
      const isLinkedToAnotherUser = linkedEmployeeIds.has(Number(emp.id)) && Number(emp.id) !== currentId;
      return !isLinkedToAnotherUser;
    });
  }

  async function loadBaseData() {
    const [usersRes, rolesRes, employeesRes, factoriesRes] = await Promise.all([
      fetch("https://api.royalpalace-group.com/api/v1/admin/users", { headers: authHeaders(), cache: "no-store" }),
      fetch("https://api.royalpalace-group.com/api/v1/admin/users/roles", { headers: authHeaders(), cache: "no-store" }),
      fetch("https://api.royalpalace-group.com/api/v1/admin/users/employees", { headers: authHeaders(), cache: "no-store" }),
      fetch("https://api.royalpalace-group.com/api/v1/admin/users/factories", { headers: authHeaders(), cache: "no-store" }),
    ]);
    const usersData = usersRes.ok ? await usersRes.json() : [];
    const rolesData = rolesRes.ok ? await rolesRes.json() : [];
    const employeesData = employeesRes.ok ? await employeesRes.json() : [];
    const factoriesData = factoriesRes.ok ? await factoriesRes.json() : [];
    setUsers(Array.isArray(usersData) ? usersData : []);
    setRoles(Array.isArray(rolesData) ? rolesData : []);
    setEmployees(Array.isArray(employeesData) ? employeesData : []);
    setFactories(Array.isArray(factoriesData) ? factoriesData : []);
    return { rolesData: Array.isArray(rolesData) ? rolesData : [] };
  }

  async function loadRolePermissionsForRoles(rolesList) {
    const entries = await Promise.all(
      (Array.isArray(rolesList) ? rolesList : []).map(async (role) => {
        try {
          const res = await fetch(`https://api.royalpalace-group.com/api/v1/admin/users/roles/${role.id}/permissions`, { headers: authHeaders(), cache: "no-store" });
          const data = res.ok ? await res.json() : { permissions: [] };
          return [String(role.id), Array.isArray(data.permissions) ? data.permissions : []];
        } catch {
          return [String(role.id), []];
        }
      })
    );
    setRolePermissionMap(Object.fromEntries(entries));
  }

  async function loadAll() {
    const base = await loadBaseData();
    await loadRolePermissionsForRoles(base.rolesData);
  }

  useEffect(() => {
    if (!ready) return;
    loadAll().catch(() => {
      setUsers([]); setRoles([]); setEmployees([]); setFactories([]); setRolePermissionMap({});
      setMessage("تعذر تحميل بيانات المستخدمين");
    });
  }, [ready]);

  useEffect(() => {
    if (!ready || !user || editingUserId) return;
    setForm((prev) => {
      if (prev.factory_id) {
        if (lockedFactoryId && prev.factory_id !== lockedFactoryId) {
          return { ...prev, factory_id: lockedFactoryId, employee_id: "", is_superuser: false };
        }
        if (!canManageSuperuserFlag && prev.is_superuser) {
          return { ...prev, is_superuser: false };
        }
        return prev;
      }
      return {
        ...prev,
        factory_id: resolvePreferredFactoryId(user, factories),
        is_superuser: canManageSuperuserFlag ? prev.is_superuser : false,
      };
    });
  }, [ready, user, factories, editingUserId, lockedFactoryId, canManageSuperuserFlag]);

  function resetForm() {
    setForm({
      ...emptyForm,
      factory_id: resolvePreferredFactoryId(user, factories),
      scope: "factory",
      is_superuser: false,
      supervisor_override: false,
    });
    setEditingUserId(null);
  }

  function scrollToForm() {
    setTimeout(() => {
      if (formRef.current) formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      setTimeout(() => {
        if (firstFieldRef.current) {
          try { firstFieldRef.current.focus({ preventScroll: true }); } catch { firstFieldRef.current.focus(); }
        }
      }, 180);
    }, 80);
  }

  function startEdit(u) {
    const nextFactoryId = lockedFactoryId || (u.factory_id ? String(u.factory_id) : "");
    setEditingUserId(u.id);
    setForm({
      email: u.email || "",
      username: u.username || "",
      full_name: u.full_name || "",
      password: "",
      role_id: String(u.role_id || ""),
      employee_id: u.employee_id ? String(u.employee_id) : "",
      factory_id: nextFactoryId,
      scope: u.scope || "factory",
      is_active: Boolean(u.is_active),
      is_superuser: canManageSuperuserFlag ? Boolean(u.is_superuser) : false,
      supervisor_override: Boolean(u.supervisor_override),
      data_ownership: u.data_ownership || "factory",
    });
    setMessage("");
    scrollToForm();
  }

  function cancelEdit() {
    resetForm();
    setMessage("");
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");
    try {
      const effectiveScope = form.is_superuser ? "group" : (form.scope || "factory");
      const selectedFactoryId = effectiveScope === "group" ? null : (lockedFactoryId || form.factory_id || null);

      const payload = {
        email: form.email.trim(),
        username: form.username.trim(),
        full_name: form.full_name.trim(),
        password: form.password || undefined,
        role_id: Number(form.role_id),
        employee_id: effectiveScope === "group" ? null : (form.employee_id ? Number(form.employee_id) : null),
        factory_id: selectedFactoryId ? Number(selectedFactoryId) : null,
        scope: effectiveScope,
        is_active: Boolean(form.is_active),
        is_superuser: canManageSuperuserFlag ? Boolean(form.is_superuser) : false,
        supervisor_override: canManageSupervisorOverride ? Boolean(form.supervisor_override) : false,
        data_ownership: form.data_ownership || "factory",
      };

      const url = editingUserId
        ? `https://api.royalpalace-group.com/api/v1/admin/users/${editingUserId}`
        : "https://api.royalpalace-group.com/api/v1/admin/users";
      const method = editingUserId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || (editingUserId ? "فشل تعديل المستخدم" : "فشل إنشاء المستخدم"));

      setMessage(editingUserId ? "تم تعديل المستخدم بنجاح" : "تم إنشاء المستخدم بنجاح");
      resetForm();
      await loadAll();
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء حفظ المستخدم");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("هل تريد حذف هذا المستخدم؟")) return;
    try {
      const res = await fetch(`https://api.royalpalace-group.com/api/v1/admin/users/${id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف المستخدم");
      setMessage("تم حذف المستخدم بنجاح");
      if (editingUserId === id) resetForm();
      await loadAll();
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء حذف المستخدم");
    }
  }

  async function handleFactoryScopeChange(userId, factoryId) {
    const scopedFactoryId = lockedFactoryId || factoryId || "";
    setSavingScopeId(userId);
    setMessage("");
    try {
      const res = await fetch(`https://api.royalpalace-group.com/api/v1/admin/users/${userId}/factory-scope`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ factory_id: scopedFactoryId ? Number(scopedFactoryId) : null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حفظ نطاق المصنع");
      setMessage("تم تحديث نطاق المصنع للمستخدم");
      await loadAll();
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء تحديث نطاق المصنع");
    } finally {
      setSavingScopeId(null);
    }
  }

  const availableEmployees = employeeOptionsForFactory(form.factory_id, form.employee_id);
  const effectiveScope = form.is_superuser ? "group" : (form.scope || "factory");
  const isGroupScope = effectiveScope === "group";

  const enrichedUsers = useMemo(() => {
    return users.map((u) => {
      const permissionCodes = getRolePermissionCodes(u.role_name, roles, rolePermissionMap);
      const itAccess = hasITPermissions(permissionCodes);
      return {
        ...u,
        resolved_permission_codes: permissionCodes,
        has_it_access: itAccess || Boolean(u.is_superuser),
        scope_label: getScopeLabel(u),
        scope_tone: getScopeTone(u),
      };
    });
  }, [users, roles, rolePermissionMap]);

  const filteredUsers = useMemo(() => {
    const q = normalizeText(search);
    if (!q) return enrichedUsers;
    return enrichedUsers.filter((u) => {
      const haystack = [u.id, u.full_name, u.email, u.username, u.role_name, u.role_code, u.employee_name, u.factory_name, u.scope_label, u.scope, u.has_it_access ? "it access" : "no it", u.supervisor_override ? "override" : ""].join(" ").toLowerCase();
      return haystack.includes(q);
    });
  }, [enrichedUsers, search]);

  const stats = useMemo(() => {
    const total = enrichedUsers.length;
    const active = enrichedUsers.filter((u) => u.is_active).length;
    const groupWide = enrichedUsers.filter((u) => u.is_superuser || u.scope === "group").length;
    const factoryScoped = enrichedUsers.filter((u) => !u.is_superuser && u.scope !== "group" && u.factory_id).length;
    const itUsers = enrichedUsers.filter((u) => u.has_it_access).length;
    const linkedEmployees = enrichedUsers.filter((u) => u.employee_id).length;
    const overrideUsers = enrichedUsers.filter((u) => u.supervisor_override).length;
    return { total, active, groupWide, factoryScoped, itUsers, linkedEmployees, overrideUsers };
  }, [enrichedUsers]);

  const executiveNotes = useMemo(() => {
    const notes = [];
    if (stats.total === 0) notes.push({ title: "لا توجد حسابات إدارية كافية", body: "النظام يحتاج حسابات تشغيلية مرتبطة بالأدوار لتفعيل نموذج الوصول والصلاحيات بصورة كاملة." });
    if (stats.linkedEmployees < stats.total) notes.push({ title: "بعض الحسابات غير مرتبطة بموظفين", body: "ربط المستخدمين بسجلات الموظفين يرفع جودة الحوكمة ويجعل نطاق التشغيل أوضح داخل النظام." });
    if (stats.itUsers === 0) notes.push({ title: "لا يوجد مستخدمون ظاهرون بوصول IT", body: "يفضل تعيين صلاحيات IT لأدوار مناسبة لضمان تشغيل وحدة التقنية والحوكمة الرقمية بصورة صحيحة." });
    if (stats.groupWide > 0) notes.push({ title: "يوجد حسابات Group-Wide", body: "الحسابات ذات النطاق المجموعي ترى كل المصانع في قسمها. استخدمها بحوكمة دقيقة." });
    if (stats.overrideUsers > 0) notes.push({ title: "بعض الحسابات لديها صلاحية تجاوز", body: "يمكن لهؤلاء المستخدمين تجاوز فحوصات الصلاحيات. استخدم هذه الخاصية بحذر." });
    if (notes.length === 0) notes.push({ title: "وضع المستخدمين جيد", body: "المؤشرات الحالية متوازنة ويمكن البناء عليها لاستكمال نموذج الوصول والصلاحيات على مستوى المجموعة." });
    return notes;
  }, [stats]);

  if (!ready || !user) {
    return (<main className="loading-shell"><div className="loading-card">جارٍ تحميل المستخدمين...</div></main>);
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />
      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">Identity & Access Control</div>
            <h2>إدارة المستخدمين والنطاقات</h2>
            <p>إنشاء الحسابات وتعديلها وربطها بالأدوار والمصانع والموظفين، مع تحديد نطاق الوصول (مصنع واحد أو مجموعة).</p>
            <div className="erp-hero-actions">
              <div className="erp-hero-pill">إجمالي: {stats.total}</div>
              <div className="erp-hero-pill">نشطة: {stats.active}</div>
              <div className="erp-hero-pill">IT: {stats.itUsers}</div>
              <div className="erp-hero-pill">تجاوز: {stats.overrideUsers}</div>
            </div>
          </div>
          <div className="erp-stat-panel">
            <div className="erp-stat-box"><div className="erp-stat-box-label">Group-Wide</div><div className="erp-stat-box-value">{stats.groupWide}</div></div>
            <div className="erp-stat-box"><div className="erp-stat-box-label">Factory Scoped</div><div className="erp-stat-box-value">{stats.factoryScoped}</div></div>
            <div className="erp-stat-box"><div className="erp-stat-box-label">تجاوز</div><div className="erp-stat-box-value">{stats.overrideUsers}</div></div>
            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card"><div className="erp-card-title">إجمالي المستخدمين</div><div className="erp-card-value">{stats.total}</div><div className="erp-card-note">كل الحسابات المسجلة</div></div>
          <div className="erp-card"><div className="erp-card-title">الحسابات النشطة</div><div className="erp-card-value">{stats.active}</div><div className="erp-card-note">جاهزة للدخول والتشغيل</div></div>
          <div className="erp-card"><div className="erp-card-title">ربط بموظفين</div><div className="erp-card-value">{stats.linkedEmployees}</div><div className="erp-card-note">Employee-linked accounts</div></div>
          <div className="erp-card"><div className="erp-card-title">IT Access</div><div className="erp-card-value">{stats.itUsers}</div><div className="erp-card-note">صلاحيات تقنية المعلومات</div></div>
          <div className="erp-card"><div className="erp-card-title">صلاحية تجاوز</div><div className="erp-card-value">{stats.overrideUsers}</div><div className="erp-card-note">Supervisor Override</div></div>
        </section>

        <section className="erp-grid-2" style={{ marginBottom: "20px" }}>
          <div className="erp-section-card">
            <div className="erp-section-head"><div><h3>ملاحظات تنفيذية</h3><p>تنبيهات على وضع الهوية والوصول</p></div><div className="erp-mini-note">IAM Review</div></div>
            <div className="erp-alert-list">{executiveNotes.map((note, index) => (<div key={index} className="erp-alert-item"><strong>{note.title}</strong><p>{note.body}</p></div>))}</div>
          </div>
          <div className="erp-section-card">
            <div className="erp-section-head"><div><h3>بحث سريع</h3><p>ابحث بالاسم أو البريد أو الدور أو النطاق</p></div><div style={{ width: "320px", maxWidth: "100%" }}><input className="erp-search" placeholder="ابحث عن مستخدم..." value={search} onChange={(e) => setSearch(e.target.value)} /></div></div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "12px" }}>
              <div className="erp-mini-note">Group-Wide: {stats.groupWide}</div>
              <div className="erp-mini-note">Scoped: {stats.factoryScoped}</div>
              <div className="erp-mini-note">IT: {stats.itUsers}</div>
              <div className="erp-mini-note">تجاوز: {stats.overrideUsers}</div>
            </div>
          </div>
        </section>

        <div ref={formRef} className="erp-form-shell" style={{ marginBottom: "20px", scrollMarginTop: "110px", border: editingUserId ? "1px solid rgba(201, 166, 107, 0.35)" : undefined, boxShadow: editingUserId ? "0 16px 36px rgba(201, 166, 107, 0.12)" : undefined }}>
          <div className="erp-section-head" style={{ marginBottom: "18px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>{editingUserId ? "تعديل المستخدم" : "إضافة مستخدم جديد"}</h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8 }}>{editingUserId ? "تعديل بيانات المستخدم ونطاقه." : "إنشاء حساب جديد وتحديد نطاقه."}</p>
            </div>
            <div className="erp-mini-note">{editingUserId ? `تحرير #${editingUserId}` : "إنشاء جديد"}</div>
          </div>

          <form className="erp-form-grid erp-form-grid-2" onSubmit={handleSubmit}>
            <div><label className="erp-label">البريد الإلكتروني</label><input ref={firstFieldRef} className="erp-input" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></div>
            <div><label className="erp-label">اسم المستخدم</label><input className="erp-input" value={form.username} onChange={(e) => setForm({ ...form, username: e.target.value })} /></div>
            <div><label className="erp-label">الاسم الكامل</label><input className="erp-input" value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} /></div>
            <div><label className="erp-label">{editingUserId ? "كلمة المرور الجديدة" : "كلمة المرور"}</label><input className="erp-input" type="password" value={form.password} placeholder={editingUserId ? "اتركها فارغة" : ""} onChange={(e) => setForm({ ...form, password: e.target.value })} /></div>
            <div><label className="erp-label">الدور</label><select className="erp-input" value={form.role_id} onChange={(e) => setForm({ ...form, role_id: e.target.value })}><option value="">اختر الدور</option>{roles.map((role) => (<option key={role.id} value={role.id}>{role.name}</option>))}</select></div>
            <div>
              <label className="erp-label">نوع النطاق</label>
              <select className="erp-input" value={effectiveScope} disabled={form.is_superuser} onChange={(e) => setForm({ ...form, scope: e.target.value, factory_id: e.target.value === "group" ? "" : form.factory_id, employee_id: e.target.value === "group" ? "" : form.employee_id })}>
                <option value="factory">مصنع واحد (Factory)</option>
                <option value="group">نطاق المجموعة (Group-Wide)</option>
              </select>
            </div>
            <div>
              <label className="erp-label">نطاق المصنع</label>
              <select className="erp-input" value={lockedFactoryId || form.factory_id} disabled={Boolean(lockedFactoryId) || isGroupScope} onChange={(e) => setForm({ ...form, factory_id: e.target.value, employee_id: "" })}>
                {!lockedFactoryId && !isGroupScope ? <option value="">اختر المصنع</option> : null}
                {visibleFactories.map((factory) => (<option key={factory.id} value={factory.id}>{factory.name}</option>))}
              </select>
              {isGroupScope && <div style={{ fontSize: 11, color: "var(--rp-text-muted)", marginTop: 4 }}>المستخدم سيرى بيانات جميع المصانع في قسمه</div>}
            </div>
            <div>
              <label className="erp-label">ربط بموظف</label>
              <select className="erp-input" value={form.employee_id} onChange={(e) => setForm({ ...form, employee_id: e.target.value })} disabled={isGroupScope}>
                <option value="">بدون ربط</option>
                {availableEmployees.map((employee) => (<option key={employee.id} value={employee.id}>{employee.full_name} ({employee.employee_code})</option>))}
              </select>
            </div>
            <div><label className="erp-label">الحالة</label><select className="erp-input" value={form.is_active ? "1" : "0"} onChange={(e) => setForm({ ...form, is_active: e.target.value === "1" })}><option value="1">نشط</option><option value="0">غير نشط</option></select></div>
            {canManageSuperuserFlag ? (
              <div><label className="erp-label">صلاحية Super Admin</label><select className="erp-input" value={form.is_superuser ? "1" : "0"} onChange={(e) => setForm({ ...form, is_superuser: e.target.value === "1", scope: e.target.value === "1" ? "group" : form.scope })}><option value="0">لا</option><option value="1">نعم (Group-Wide تلقائياً)</option></select></div>
            ) : null}
            {canManageSupervisorOverride ? (
              <div><label className="erp-label">تجاوز الصلاحيات (Supervisor Override)</label><select className="erp-input" value={form.supervisor_override ? "1" : "0"} onChange={(e) => setForm({ ...form, supervisor_override: e.target.value === "1" })}><option value="0">لا</option><option value="1">نعم (يمكنه تجاوز فحوصات الصلاحيات)</option></select></div>
            ) : null}
            <div className="erp-form-actions">
              <button style={primaryButtonStyle} type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingUserId ? "حفظ التعديل" : "إضافة المستخدم"}</button>
              {editingUserId ? (<button type="button" style={secondaryButtonStyle} onClick={cancelEdit}>إلغاء التعديل</button>) : null}
            </div>
          </form>
        </div>

        {message ? (<div className="erp-form-message" style={{ marginBottom: "20px" }}>{message}</div>) : null}

        <section className="erp-section-card" style={{ padding: 0, overflow: "hidden" }}>
          <div style={{ padding: "20px 22px 14px", display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap", borderBottom: "1px solid var(--rp-border)" }}>
            <div><h3 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>جدول المستخدمين</h3><p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)" }}>اسحب أفقيًا لرؤية كل الأعمدة.</p></div>
            <div className="erp-mini-note">النتائج: {filteredUsers.length}</div>
          </div>
          <div className="erp-table-shell erp-table-shell-scrollable" style={{ overflowX: "auto", overflowY: "hidden", WebkitOverflowScrolling: "touch", position: "relative" }}>
            <table className="erp-table erp-users-table" style={{ minWidth: "1900px" }}>
              <thead>
                <tr>
                  <th style={{ position: "sticky", right: 0, zIndex: 5, background: "#f8fafc", boxShadow: "-1px 0 0 #edf2f7", minWidth: "190px" }}>إجراء</th>
                  <th style={{ minWidth: "250px" }}>المستخدم</th>
                  <th style={{ minWidth: "200px" }}>الدور</th>
                  <th style={{ minWidth: "250px" }}>البريد</th>
                  <th style={{ minWidth: "190px" }}>اسم المستخدم</th>
                  <th style={{ minWidth: "240px" }}>الموظف المرتبط</th>
                  <th style={{ minWidth: "200px" }}>المصنع</th>
                  <th style={{ minWidth: "280px" }}>الوصول والحالة</th>
                  <th style={{ minWidth: "280px" }}>نطاق المصنع</th>
                  <th style={{ minWidth: "220px" }}>نوع النطاق</th>
                  <th style={{ minWidth: "170px" }}>IT Access</th>
                  <th style={{ minWidth: "150px" }}>تجاوز</th>
                </tr>
              </thead>
              <tbody>
                {filteredUsers.length === 0 ? (
                  <tr><td colSpan="12">{users.length === 0 ? "لا يوجد مستخدمون حالياً." : "لا توجد نتائج مطابقة."}</td></tr>
                ) : (
                  filteredUsers.map((u) => (
                    <tr key={u.id}>
                      <td style={{ position: "sticky", right: 0, zIndex: 4, background: "#ffffff", boxShadow: "-1px 0 0 #edf2f7", minWidth: "190px" }}>
                        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                          <button type="button" style={editButtonStyle} onClick={() => startEdit(u)}>تعديل</button>
                          <button type="button" style={deleteButtonStyle} onClick={() => handleDelete(u.id)}>حذف</button>
                        </div>
                      </td>
                      <td><div style={{ display: "grid", gap: "6px" }}><strong>{u.full_name || "—"}</strong><div style={{ color: "var(--rp-text-muted)", fontSize: "12px" }}>ID: {u.id}</div></div></td>
                      <td><div style={{ display: "grid", gap: "6px" }}><strong>{getRoleLabel(u)}</strong><span style={{ color: "var(--rp-text-muted)", fontSize: "12px" }}>{u.role_code || "—"}</span></div></td>
                      <td>{u.email || "—"}</td>
                      <td>{u.username || "—"}</td>
                      <td>{getEmployeeName(u)}</td>
                      <td>{getFactoryName(u)}</td>
                      <td>
                        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                          <span className={`erp-badge ${u.scope_tone}`}>{u.scope_label}</span>
                          {u.is_active ? (<span className="erp-badge success">نشط</span>) : (<span className="erp-badge warning">غير نشط</span>)}
                          {u.is_superuser ? (<span className="erp-badge success">Super Admin</span>) : null}
                        </div>
                       </td>
                      <td>
                        {u.scope === "group" || u.is_superuser ? (
                          <div style={{ padding: "8px 12px", background: "#f0fdf4", borderRadius: 8, fontSize: 13, color: "#166534", fontWeight: 700 }}>نطاق المجموعة – كل المصانع</div>
                        ) : (
                          <select className="erp-input" value={lockedFactoryId || u.factory_id || ""} disabled={savingScopeId === u.id || editingUserId === u.id || (Boolean(lockedFactoryId) && String(u.factory_id || "") !== String(lockedFactoryId))} onChange={(e) => handleFactoryScopeChange(u.id, e.target.value)}>
                            {!lockedFactoryId ? <option value="">بدون نطاق</option> : null}
                            {visibleFactories.map((factory) => (<option key={factory.id} value={factory.id}>{factory.name}</option>))}
                          </select>
                        )}
                       </td>
                      <td>
                        {u.is_superuser ? "Group-Wide" : u.scope === "group" ? "Group-Wide" : u.factory_id ? "Factory Scoped" : "No Scope"}
                       </td>
                      <td>{u.has_it_access ? (<span className="erp-badge success">IT Access</span>) : (<span className="erp-badge warning">No IT</span>)}</td>
                      <td>{u.supervisor_override ? (<span className="erp-badge success">⚡Override</span>) : (<span className="erp-badge warning">—</span>)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </section>
    </main>
  );
}
