"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const emptyRoleForm = {
  name: "",
  code: "",
  is_active: true,
};

const emptyPermissionForm = {
  name: "",
  code: "",
  module: "",
  is_active: true,
};

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function formatCount(value) {
  return Number(value || 0).toLocaleString("en-US");
}

function slugifyRoleCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "_")
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
}

function slugifyPermissionCode(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ".")
    .replace(/[^a-z0-9._]+/g, ".")
    .replace(/\.+/g, ".")
    .replace(/^\.|\.$/g, "");
}

function getPermissionCodes(user) {
  if (!Array.isArray(user?.permissions)) return [];
  return user.permissions.map((item) => String(item || "").trim()).filter(Boolean);
}

function hasPermission(user, code) {
  if (!code) return false;
  if (user?.is_superuser === true) return true;
  return getPermissionCodes(user).includes(code);
}

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

const primaryButtonStyle = {
  ...actionButtonBaseStyle,
  minHeight: "48px",
  padding: "12px 18px",
  background: "linear-gradient(135deg, #c9a66b 0%, #d6b47a 100%)",
  color: "#111827",
  boxShadow: "0 14px 30px rgba(201, 166, 107, 0.22)",
};

const secondaryButtonStyle = {
  ...actionButtonBaseStyle,
  background: "linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)",
  color: "var(--rp-text)",
  borderColor: "var(--rp-border)",
};

const dangerButtonStyle = {
  ...actionButtonBaseStyle,
  background: "linear-gradient(135deg, #b91c1c 0%, #991b1b 100%)",
  color: "#ffffff",
};

export default function RolesPage() {
  const { user, ready } = useAdminAuth("roles");

  const [roles, setRoles] = useState([]);
  const [catalog, setCatalog] = useState([]);
  const [selectedRoleId, setSelectedRoleId] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState([]);
  const [message, setMessage] = useState("");
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [permissionSearch, setPermissionSearch] = useState("");

  const [roleForm, setRoleForm] = useState(emptyRoleForm);
  const [editingRoleId, setEditingRoleId] = useState(null);
  const [submittingRole, setSubmittingRole] = useState(false);

  const [permissionForm, setPermissionForm] = useState(emptyPermissionForm);
  const [editingPermissionId, setEditingPermissionId] = useState(null);
  const [submittingPermission, setSubmittingPermission] = useState(false);

  const roleFormRef = useRef(null);
  const roleFirstFieldRef = useRef(null);
  const permissionFormRef = useRef(null);
  const permissionFirstFieldRef = useRef(null);

  const canManageRoles = useMemo(() => {
    return hasPermission(user, "roles.manage");
  }, [user]);

  async function loadRolesAndCatalog() {
    const [rolesRes, catalogRes] = await Promise.all([
      fetch("https://api.royalpalace-group.com/api/v1/admin/users/roles", {
        headers: authHeaders(),
        cache: "no-store",
      }),
      fetch("https://api.royalpalace-group.com/api/v1/admin/users/permissions/catalog", {
        headers: authHeaders(),
        cache: "no-store",
      }),
    ]);

    const rolesData = rolesRes.ok ? await rolesRes.json() : [];
    const catalogData = catalogRes.ok ? await catalogRes.json() : [];

    setRoles(Array.isArray(rolesData) ? rolesData : []);
    setCatalog(Array.isArray(catalogData) ? catalogData : []);
  }

  async function loadRolePermissions(roleId) {
    setMessage("");

    if (!roleId) {
      setSelectedPermissions([]);
      return;
    }

    const res = await fetch(
      `https://api.royalpalace-group.com/api/v1/admin/users/roles/${roleId}/permissions`,
      {
        headers: authHeaders(),
        cache: "no-store",
      }
    );

    const data = res.ok ? await res.json() : { permissions: [] };
    setSelectedPermissions(Array.isArray(data.permissions) ? data.permissions : []);
  }

  useEffect(() => {
    if (!ready) return;

    loadRolesAndCatalog().catch(() => {
      setRoles([]);
      setCatalog([]);
      setMessage("تعذر تحميل الأدوار والصلاحيات");
    });
  }, [ready]);

  useEffect(() => {
    if (!selectedRoleId) {
      setSelectedPermissions([]);
      return;
    }

    loadRolePermissions(selectedRoleId).catch(() => {
      setSelectedPermissions([]);
      setMessage("تعذر تحميل صلاحيات الدور المحدد");
    });
  }, [selectedRoleId]);

  const selectedRole = useMemo(() => {
    return roles.find((role) => String(role.id) === String(selectedRoleId)) || null;
  }, [roles, selectedRoleId]);

  const groupedCatalog = useMemo(() => {
    const groups = {};
    for (const item of catalog) {
      const moduleName = item.module || "general";
      if (!groups[moduleName]) groups[moduleName] = [];
      groups[moduleName].push(item);
    }
    return groups;
  }, [catalog]);

  const filteredGroupedCatalog = useMemo(() => {
    const q = normalizeText(permissionSearch);
    if (!q) return groupedCatalog;

    const groups = {};
    Object.entries(groupedCatalog).forEach(([moduleName, items]) => {
      const filtered = items.filter((item) => {
        const haystack = [moduleName, item.name, item.code, item.module].join(" ").toLowerCase();
        return haystack.includes(q);
      });

      if (filtered.length > 0) {
        groups[moduleName] = filtered;
      }
    });

    return groups;
  }, [groupedCatalog, permissionSearch]);

  const stats = useMemo(() => {
    const totalRoles = roles.length;
    const totalPermissions = catalog.length;
    const assigned = selectedPermissions.length;
    const modules = Object.keys(groupedCatalog).length;
    const selectedCoverage = totalPermissions > 0 ? Math.round((assigned / totalPermissions) * 100) : 0;
    const activeRoles = roles.filter((role) => role.is_active !== false).length;
    const activePermissions = catalog.filter((item) => item.is_active !== false).length;

    return {
      totalRoles,
      totalPermissions,
      assigned,
      modules,
      selectedCoverage,
      activeRoles,
      activePermissions,
    };
  }, [roles, catalog, selectedPermissions, groupedCatalog]);

  const executiveNotes = useMemo(() => {
    const notes = [];

    if (stats.totalRoles === 0) {
      notes.push({
        title: "لا توجد أدوار متاحة حاليًا",
        body: "المنظومة تحتاج إنشاء أدوار قبل إدارة RBAC بشكل تشغيلي كامل.",
      });
    }

    if (stats.totalPermissions === 0) {
      notes.push({
        title: "كتالوج الصلاحيات فارغ",
        body: "لا توجد صلاحيات معرفة داخل النظام، وبالتالي لا يمكن إدارة الوصول بصورة دقيقة.",
      });
    }

    if (selectedRoleId && stats.assigned === 0) {
      notes.push({
        title: "الدور المحدد بدون صلاحيات",
        body: "الدور الحالي لا يملك أي صلاحيات مخصصة، وده قد يسبب منع الوصول الكامل أو سلوك غير متوقع.",
      });
    }

    if (catalog.some((item) => item.is_active === false)) {
      notes.push({
        title: "يوجد صلاحيات غير نشطة",
        body: "راجع الصلاحيات غير النشطة قبل اعتمادها ضمن أدوار حية داخل النظام.",
      });
    }

    if (!canManageRoles) {
      notes.push({
        title: "الوضع الحالي: مشاهدة فقط",
        body: "هذا الحساب يستطيع مراجعة هيكل RBAC، لكن لا يملك صلاحية إدارة الأدوار أو الكتالوج.",
      });
    }

    if (notes.length === 0) {
      notes.push({
        title: "هيكل الأدوار والصلاحيات في وضع جيد",
        body: "البيانات الحالية مناسبة لإدارة RBAC بشكل تدريجي وآمن داخل النظام الحي.",
      });
    }

    return notes;
  }, [stats, selectedRoleId, catalog, canManageRoles]);

  const roleCards = useMemo(() => {
    return roles.map((role) => {
      const active = String(role.id) === String(selectedRoleId);
      return { ...role, active };
    });
  }, [roles, selectedRoleId]);

  const highlightedModules = useMemo(() => {
    return Object.entries(groupedCatalog)
      .map(([moduleName, items]) => {
        const assignedCount = items.filter((item) => selectedPermissions.includes(item.code)).length;
        return {
          moduleName,
          total: items.length,
          assignedCount,
        };
      })
      .sort((a, b) => b.total - a.total)
      .slice(0, 3);
  }, [groupedCatalog, selectedPermissions]);

  function resetRoleForm() {
    setRoleForm(emptyRoleForm);
    setEditingRoleId(null);
  }

  function resetPermissionForm() {
    setPermissionForm(emptyPermissionForm);
    setEditingPermissionId(null);
  }

  function scrollToRoleForm() {
    if (!canManageRoles) return;
    if (roleFormRef.current) {
      roleFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => {
      roleFirstFieldRef.current?.focus();
    }, 250);
  }

  function scrollToPermissionForm() {
    if (!canManageRoles) return;
    if (permissionFormRef.current) {
      permissionFormRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
    setTimeout(() => {
      permissionFirstFieldRef.current?.focus();
    }, 250);
  }

  function startEditRole(role) {
    if (!canManageRoles) return;

    setEditingRoleId(role.id);
    setRoleForm({
      name: role.name || "",
      code: role.code || "",
      is_active: role.is_active !== false,
    });
    setMessage("");
    scrollToRoleForm();
  }

  function startEditPermission(item) {
    if (!canManageRoles) return;

    setEditingPermissionId(item.id);
    setPermissionForm({
      name: item.name || "",
      code: item.code || "",
      module: item.module || "",
      is_active: item.is_active !== false,
    });
    setMessage("");
    scrollToPermissionForm();
  }

  function togglePermission(code) {
    if (!canManageRoles) return;

    setSelectedPermissions((prev) =>
      prev.includes(code) ? prev.filter((item) => item !== code) : [...prev, code]
    );
  }

  function toggleModule(moduleItems) {
    if (!canManageRoles) return;

    const codes = moduleItems.map((item) => item.code);
    const allSelected = codes.every((code) => selectedPermissions.includes(code));

    if (allSelected) {
      setSelectedPermissions((prev) => prev.filter((code) => !codes.includes(code)));
      return;
    }

    setSelectedPermissions((prev) => Array.from(new Set([...prev, ...codes])));
  }

  async function handleRoleSubmit(e) {
    e.preventDefault();
    if (!canManageRoles) {
      setMessage("ليس لديك صلاحية إدارة الأدوار");
      return;
    }

    setSubmittingRole(true);
    setMessage("");

    try {
      const payload = {
        name: roleForm.name.trim(),
        code: slugifyRoleCode(roleForm.code),
        is_active: Boolean(roleForm.is_active),
      };

      const url = editingRoleId
        ? `https://api.royalpalace-group.com/api/v1/admin/users/roles/${editingRoleId}`
        : "https://api.royalpalace-group.com/api/v1/admin/users/roles";

      const method = editingRoleId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حفظ الدور");

      setMessage(editingRoleId ? "تم تعديل الدور بنجاح" : "تم إضافة الدور بنجاح");
      const freshRoleId = data?.id ? String(data.id) : "";
      resetRoleForm();
      await loadRolesAndCatalog();

      if (freshRoleId) {
        setSelectedRoleId(freshRoleId);
      }
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء حفظ الدور");
    } finally {
      setSubmittingRole(false);
    }
  }

  async function handlePermissionSubmit(e) {
    e.preventDefault();
    if (!canManageRoles) {
      setMessage("ليس لديك صلاحية إدارة كتالوج الصلاحيات");
      return;
    }

    setSubmittingPermission(true);
    setMessage("");

    try {
      const payload = {
        name: permissionForm.name.trim(),
        code: slugifyPermissionCode(permissionForm.code),
        module: normalizeText(permissionForm.module),
        is_active: Boolean(permissionForm.is_active),
      };

      const url = editingPermissionId
        ? `https://api.royalpalace-group.com/api/v1/admin/users/permissions/catalog/${editingPermissionId}`
        : "https://api.royalpalace-group.com/api/v1/admin/users/permissions/catalog";

      const method = editingPermissionId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...authHeaders(),
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حفظ الصلاحية");

      setMessage(editingPermissionId ? "تم تعديل الصلاحية بنجاح" : "تم إضافة الصلاحية بنجاح");
      resetPermissionForm();
      await loadRolesAndCatalog();

      if (selectedRoleId) {
        await loadRolePermissions(selectedRoleId);
      }
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء حفظ الصلاحية");
    } finally {
      setSubmittingPermission(false);
    }
  }

  async function handleDeleteRole(role) {
    if (!canManageRoles) {
      setMessage("ليس لديك صلاحية حذف الأدوار");
      return;
    }

    if (!confirm(`هل تريد حذف الدور "${role.name}"؟`)) return;

    try {
      const res = await fetch(
        `https://api.royalpalace-group.com/api/v1/admin/users/roles/${role.id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف الدور");

      setMessage("تم حذف الدور بنجاح");

      if (String(selectedRoleId) === String(role.id)) {
        setSelectedRoleId("");
        setSelectedPermissions([]);
      }

      if (editingRoleId === role.id) {
        resetRoleForm();
      }

      await loadRolesAndCatalog();
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء حذف الدور");
    }
  }

  async function handleDeletePermission(item) {
    if (!canManageRoles) {
      setMessage("ليس لديك صلاحية حذف الصلاحيات");
      return;
    }

    if (!confirm(`هل تريد حذف الصلاحية "${item.name}"؟`)) return;

    try {
      const res = await fetch(
        `https://api.royalpalace-group.com/api/v1/admin/users/permissions/catalog/${item.id}`,
        {
          method: "DELETE",
          headers: authHeaders(),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف الصلاحية");

      setMessage("تم حذف الصلاحية بنجاح");

      if (editingPermissionId === item.id) {
        resetPermissionForm();
      }

      await loadRolesAndCatalog();

      if (selectedRoleId) {
        await loadRolePermissions(selectedRoleId);
      }
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء حذف الصلاحية");
    }
  }

  async function handleSavePermissions() {
    if (!canManageRoles) {
      setMessage("ليس لديك صلاحية تعديل مصفوفة الصلاحيات");
      return;
    }

    if (!selectedRoleId) {
      setMessage("اختر دورًا أولًا");
      return;
    }

    setSavingPermissions(true);
    setMessage("");

    try {
      const res = await fetch(
        `https://api.royalpalace-group.com/api/v1/admin/users/roles/${selectedRoleId}/permissions`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...authHeaders(),
          },
          body: JSON.stringify({
            permissions: selectedPermissions,
          }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حفظ الصلاحيات");

      setMessage("تم حفظ صلاحيات الدور بنجاح");
      await loadRolesAndCatalog();
    } catch (err) {
      setMessage(err?.message || "حدث خطأ أثناء حفظ الصلاحيات");
    } finally {
      setSavingPermissions(false);
    }
  }

  if (!ready || !user) {
    return (
      <main className="loading-shell">
        <div className="loading-card">جارٍ تحميل الأدوار والصلاحيات...</div>
      </main>
    );
  }

  return (
    <main className="erp-shell">
      <Sidebar user={user} />

      <section className="erp-main">
        <section className="erp-hero">
          <div>
            <div className="erp-hero-pill">RBAC Executive Studio</div>
            <h2>إدارة الأدوار والصلاحيات</h2>
            <p>
              لوحة تنفيذية احترافية لإنشاء الأدوار، تعديلها، حذفها، وإدارة كتالوج الصلاحيات نفسه
              وربطه بكل دور داخل واجهة واحدة متسقة مع هوية النظام.
            </p>

            <div className="erp-hero-actions">
              <div className="erp-hero-pill">إجمالي الأدوار: {stats.totalRoles}</div>
              <div className="erp-hero-pill">إجمالي الصلاحيات: {stats.totalPermissions}</div>
              <div className="erp-hero-pill">
                {selectedRole ? `الدور المحدد: ${selectedRole.name}` : "لم يتم اختيار دور"}
              </div>
              <div className="erp-hero-pill">
                {canManageRoles ? "وضع الإدارة" : "وضع المشاهدة"}
              </div>
            </div>
          </div>

          <div className="erp-stat-panel">
            <div className="erp-stat-box">
              <div className="erp-stat-box-label">الأدوار النشطة</div>
              <div className="erp-stat-box-value">{stats.activeRoles}</div>
            </div>

            <div className="erp-stat-box">
              <div className="erp-stat-box-label">الصلاحيات النشطة</div>
              <div className="erp-stat-box-value">{stats.activePermissions}</div>
            </div>

            <div className="erp-hero-visual" />
          </div>
        </section>

        <section className="erp-kpi-grid">
          <div className="erp-card">
            <div className="erp-card-title">إجمالي الأدوار</div>
            <div className="erp-card-value">{stats.totalRoles}</div>
            <div className="erp-card-note">Roles داخل النظام</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">إجمالي الصلاحيات</div>
            <div className="erp-card-value">{stats.totalPermissions}</div>
            <div className="erp-card-note">Permission catalog</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">صلاحيات الدور المحدد</div>
            <div className="erp-card-value">{stats.assigned}</div>
            <div className="erp-card-note">Assigned permissions</div>
          </div>

          <div className="erp-card">
            <div className="erp-card-title">الموديولات</div>
            <div className="erp-card-value">{stats.modules}</div>
            <div className="erp-card-note">Modules ممثلة في الكتالوج</div>
          </div>
        </section>

        <section className="erp-grid-2" style={{ marginBottom: "20px" }}>
          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>مراجعة تنفيذية سريعة</h3>
                <p>تنبيهات تساعدك على تقييم بنية الأدوار والصلاحيات قبل الاعتماد</p>
              </div>
              <div className="erp-mini-note">{stats.modules} موديول</div>
            </div>

            <div className="erp-alert-list">
              {executiveNotes.map((note, index) => (
                <div key={index} className="erp-alert-item">
                  <strong>{note.title}</strong>
                  <p>{note.body}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="erp-section-card">
            <div className="erp-section-head">
              <div>
                <h3>الموديولات الأعلى كثافة</h3>
                <p>أكثر مجموعات الصلاحيات احتواءً على عناصر داخل كتالوج RBAC</p>
              </div>
              <div className="erp-mini-note">{highlightedModules.length} عناصر</div>
            </div>

            {highlightedModules.length === 0 ? (
              <div className="erp-form-message">لا توجد موديولات صالحة للعرض حاليًا.</div>
            ) : (
              <div style={{ display: "grid", gap: "12px" }}>
                {highlightedModules.map((module) => (
                  <div
                    key={module.moduleName}
                    style={{
                      border: "1px solid var(--rp-border)",
                      borderRadius: "18px",
                      background: "var(--rp-surface-2)",
                      padding: "14px",
                      display: "grid",
                      gap: "10px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
                      <div style={{ fontSize: "16px", fontWeight: 900, color: "var(--rp-text)" }}>
                        {module.moduleName}
                      </div>
                      <div className="erp-mini-note">
                        {module.assignedCount}/{module.total}
                      </div>
                    </div>

                    <div className="erp-chart-track">
                      <div
                        className="erp-chart-fill"
                        style={{
                          width: `${module.total > 0 ? (module.assignedCount / module.total) * 100 : 0}%`,
                          background: "linear-gradient(90deg, #0f3c88 0%, #2563eb 100%)",
                        }}
                      />
                    </div>

                    <div style={{ color: "var(--rp-text-muted)", fontSize: "13px", fontWeight: 700 }}>
                      صلاحيات مفعلة: {module.assignedCount} من أصل {module.total}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <div ref={roleFormRef} className="erp-form-shell">
          <div className="erp-section-head" style={{ marginBottom: "18px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>
                {editingRoleId ? "تعديل الدور" : "إضافة دور جديد"}
              </h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8 }}>
                أنشئ دورًا جديدًا أو عدّل دورًا قائمًا من نفس الفورم.
              </p>
            </div>

            <div className="erp-mini-note">
              {editingRoleId ? `تحرير الدور #${editingRoleId}` : "إنشاء جديد"}
            </div>
          </div>

          {canManageRoles ? (
            <form className="erp-form-grid erp-form-grid-2" onSubmit={handleRoleSubmit}>
              <div>
                <label className="erp-label">اسم الدور</label>
                <input
                  ref={roleFirstFieldRef}
                  className="erp-input"
                  value={roleForm.name}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="erp-label">كود الدور</label>
                <input
                  className="erp-input"
                  value={roleForm.code}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, code: slugifyRoleCode(e.target.value) }))}
                  placeholder="example_role"
                />
              </div>

              <div>
                <label className="erp-label">الحالة</label>
                <select
                  className="erp-input"
                  value={roleForm.is_active ? "1" : "0"}
                  onChange={(e) => setRoleForm((prev) => ({ ...prev, is_active: e.target.value === "1" }))}
                >
                  <option value="1">نشط</option>
                  <option value="0">غير نشط</option>
                </select>
              </div>

              <div className="erp-form-actions">
                <button style={primaryButtonStyle} type="submit" disabled={submittingRole}>
                  {submittingRole ? "جارٍ الحفظ..." : editingRoleId ? "حفظ التعديل" : "إضافة الدور"}
                </button>

                {editingRoleId ? (
                  <button type="button" style={secondaryButtonStyle} onClick={resetRoleForm}>
                    إلغاء التعديل
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <div className="erp-form-message">
              هذا الحساب لا يملك صلاحية إنشاء أو تعديل الأدوار.
            </div>
          )}

          {message ? <div className="erp-form-message">{message}</div> : null}
        </div>

        <section className="erp-section-card" style={{ marginBottom: "20px" }}>
          <div className="erp-section-head">
            <div>
              <h3>الأدوار الحالية</h3>
              <p>فتح الصلاحيات أو تعديل/حذف الدور من نفس الصفحة</p>
            </div>

            <div style={{ width: "320px", maxWidth: "100%" }}>
              <select
                className="erp-search"
                value={selectedRoleId}
                onChange={(e) => setSelectedRoleId(e.target.value)}
              >
                <option value="">اختر الدور</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name} ({role.code})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {roleCards.length === 0 ? (
            <div className="erp-form-message">لا توجد أدوار متاحة حاليًا.</div>
          ) : (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                gap: "14px",
              }}
            >
              {roleCards.map((role) => (
                <div
                  key={role.id}
                  style={{
                    textAlign: "right",
                    borderRadius: "18px",
                    border: role.active
                      ? "1px solid rgba(201, 166, 107, 0.45)"
                      : "1px solid var(--rp-border)",
                    background: role.active
                      ? "linear-gradient(180deg, rgba(201, 166, 107, 0.10) 0%, rgba(214, 180, 122, 0.05) 100%)"
                      : "var(--rp-surface)",
                    boxShadow: role.active
                      ? "0 14px 32px rgba(201, 166, 107, 0.14)"
                      : "var(--rp-shadow-soft)",
                    padding: "16px",
                    display: "grid",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                    <div style={{ fontSize: "17px", fontWeight: 900, color: "var(--rp-text)" }}>
                      {role.name || "دور بدون اسم"}
                    </div>

                    <span className={`erp-badge ${role.is_active === false ? "warning" : "success"}`}>
                      {role.is_active === false ? "غير نشط" : "نشط"}
                    </span>
                  </div>

                  <div style={{ color: "var(--rp-text-muted)", fontSize: "13px", fontWeight: 700 }}>
                    {role.code || "بدون كود"}
                  </div>

                  <div style={{ color: "var(--rp-text-soft)", fontSize: "13px", fontWeight: 700 }}>
                    مستخدمون مرتبطون: {formatCount(role.users_count)}
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                    <button type="button" style={secondaryButtonStyle} onClick={() => setSelectedRoleId(String(role.id))}>
                      فتح الصلاحيات
                    </button>

                    {canManageRoles ? (
                      <>
                        <button type="button" style={secondaryButtonStyle} onClick={() => startEditRole(role)}>
                          تعديل
                        </button>

                        <button type="button" style={dangerButtonStyle} onClick={() => handleDeleteRole(role)}>
                          حذف
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div ref={permissionFormRef} className="erp-form-shell">
          <div className="erp-section-head" style={{ marginBottom: "18px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>
                {editingPermissionId ? "تعديل الصلاحية" : "إضافة صلاحية جديدة"}
              </h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8 }}>
                إدارة كتالوج الصلاحيات نفسه داخل النظام الحي، ثم استخدامه مباشرة داخل الأدوار.
              </p>
            </div>

            <div className="erp-mini-note">
              {editingPermissionId ? `تحرير الصلاحية #${editingPermissionId}` : "إنشاء جديد"}
            </div>
          </div>

          {canManageRoles ? (
            <form className="erp-form-grid erp-form-grid-2" onSubmit={handlePermissionSubmit}>
              <div>
                <label className="erp-label">اسم الصلاحية</label>
                <input
                  ref={permissionFirstFieldRef}
                  className="erp-input"
                  value={permissionForm.name}
                  onChange={(e) => setPermissionForm((prev) => ({ ...prev, name: e.target.value }))}
                />
              </div>

              <div>
                <label className="erp-label">كود الصلاحية</label>
                <input
                  className="erp-input"
                  value={permissionForm.code}
                  onChange={(e) => setPermissionForm((prev) => ({ ...prev, code: slugifyPermissionCode(e.target.value) }))}
                  placeholder="module.action"
                />
              </div>

              <div>
                <label className="erp-label">الموديول</label>
                <input
                  className="erp-input"
                  value={permissionForm.module}
                  onChange={(e) => setPermissionForm((prev) => ({ ...prev, module: e.target.value }))}
                  placeholder="products"
                />
              </div>

              <div>
                <label className="erp-label">الحالة</label>
                <select
                  className="erp-input"
                  value={permissionForm.is_active ? "1" : "0"}
                  onChange={(e) => setPermissionForm((prev) => ({ ...prev, is_active: e.target.value === "1" }))}
                >
                  <option value="1">نشطة</option>
                  <option value="0">غير نشطة</option>
                </select>
              </div>

              <div className="erp-form-actions">
                <button style={primaryButtonStyle} type="submit" disabled={submittingPermission}>
                  {submittingPermission ? "جارٍ الحفظ..." : editingPermissionId ? "حفظ التعديل" : "إضافة الصلاحية"}
                </button>

                {editingPermissionId ? (
                  <button type="button" style={secondaryButtonStyle} onClick={resetPermissionForm}>
                    إلغاء التعديل
                  </button>
                ) : null}
              </div>
            </form>
          ) : (
            <div className="erp-form-message">
              هذا الحساب لا يملك صلاحية تعديل كتالوج الصلاحيات.
            </div>
          )}
        </div>

        <section className="erp-section-card" style={{ marginBottom: "20px" }}>
          <div className="erp-section-head">
            <div>
              <h3>كتالوج الصلاحيات</h3>
              <p>إدارة كل الصلاحيات المتاحة داخل النظام قبل ربطها بالأدوار</p>
            </div>

            <div style={{ width: "320px", maxWidth: "100%" }}>
              <input
                className="erp-search"
                placeholder="ابحث داخل الصلاحيات أو الموديولات..."
                value={permissionSearch}
                onChange={(e) => setPermissionSearch(e.target.value)}
              />
            </div>
          </div>

          {Object.keys(filteredGroupedCatalog).length === 0 ? (
            <div className="erp-form-message">لا توجد نتائج مطابقة للبحث داخل كتالوج الصلاحيات.</div>
          ) : (
            <div style={{ display: "grid", gap: "16px" }}>
              {Object.entries(filteredGroupedCatalog).map(([moduleName, items]) => (
                <div key={moduleName} className="erp-section-card">
                  <div className="erp-section-head" style={{ marginBottom: "12px" }}>
                    <div>
                      <h3 style={{ fontSize: "18px", marginBottom: "4px" }}>{moduleName}</h3>
                      <p>صلاحيات هذا الجزء من النظام</p>
                    </div>
                    <div className="erp-mini-note">{items.length} صلاحية</div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {items.map((item) => {
                      const active = selectedPermissions.includes(item.code);

                      return (
                        <div
                          key={item.id || item.code}
                          style={{
                            display: "grid",
                            gap: "10px",
                            padding: "14px",
                            borderRadius: "16px",
                            border: active
                              ? "1px solid rgba(201, 166, 107, 0.42)"
                              : "1px solid var(--rp-border)",
                            background: active
                              ? "linear-gradient(180deg, rgba(201, 166, 107, 0.08) 0%, rgba(214, 180, 122, 0.04) 100%)"
                              : "#fff",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", alignItems: "center" }}>
                            <div style={{ fontWeight: 900, fontSize: "14px", color: "var(--rp-text)" }}>
                              {item.name || "صلاحية بدون اسم"}
                            </div>
                            <span className={`erp-badge ${item.is_active === false ? "warning" : "success"}`}>
                              {item.is_active === false ? "غير نشطة" : "نشطة"}
                            </span>
                          </div>

                          <div style={{ color: "var(--rp-text-muted)", fontSize: "12px", wordBreak: "break-word" }}>
                            {item.code}
                          </div>

                          {canManageRoles ? (
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button type="button" style={secondaryButtonStyle} onClick={() => startEditPermission(item)}>
                                تعديل
                              </button>
                              <button type="button" style={dangerButtonStyle} onClick={() => handleDeletePermission(item)}>
                                حذف
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <div className="erp-form-shell">
          <div className="erp-section-head" style={{ marginBottom: "18px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "22px", fontWeight: 900 }}>
                مصفوفة صلاحيات الدور
              </h3>
              <p style={{ margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8 }}>
                اختر دورًا ثم فعّل الصلاحيات المناسبة له حسب كل موديول.
              </p>
            </div>

            <div className="erp-mini-note">
              {selectedRole ? `${selectedRole.name} • ${selectedPermissions.length} صلاحية` : "اختر دورًا أولًا"}
            </div>
          </div>

          {!selectedRoleId ? (
            <div className="erp-form-message">اختر دورًا من قسم الأدوار الحالية لعرض وتعديل صلاحياته.</div>
          ) : (
            <>
              {Object.keys(filteredGroupedCatalog).length === 0 ? (
                <div className="erp-form-message">لا توجد نتائج مطابقة للبحث داخل كتالوج الصلاحيات.</div>
              ) : (
                <div style={{ display: "grid", gap: "16px" }}>
                  {Object.entries(filteredGroupedCatalog).map(([moduleName, items]) => {
                    const assignedCount = items.filter((item) => selectedPermissions.includes(item.code)).length;
                    const allSelected = items.length > 0 && assignedCount === items.length;

                    return (
                      <div key={moduleName} className="erp-section-card">
                        <div className="erp-section-head" style={{ marginBottom: "12px" }}>
                          <div>
                            <h3 style={{ fontSize: "18px", marginBottom: "4px" }}>{moduleName}</h3>
                            <p>الصلاحيات المرتبطة بهذا الجزء من النظام</p>
                          </div>

                          <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
                            <div className="erp-mini-note">{assignedCount}/{items.length}</div>
                            {canManageRoles ? (
                              <button type="button" style={secondaryButtonStyle} onClick={() => toggleModule(items)}>
                                {allSelected ? "إلغاء تحديد الكل" : "تفعيل الكل"}
                              </button>
                            ) : null}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))",
                            gap: "12px",
                          }}
                        >
                          {items.map((item) => {
                            const active = selectedPermissions.includes(item.code);

                            return (
                              <label
                                key={`assign-${item.id || item.code}`}
                                style={{
                                  display: "flex",
                                  alignItems: "flex-start",
                                  gap: "12px",
                                  padding: "14px",
                                  borderRadius: "16px",
                                  border: active
                                    ? "1px solid rgba(201, 166, 107, 0.42)"
                                    : "1px solid var(--rp-border)",
                                  background: active
                                    ? "linear-gradient(180deg, rgba(201, 166, 107, 0.08) 0%, rgba(214, 180, 122, 0.04) 100%)"
                                    : "#fff",
                                  cursor: canManageRoles ? "pointer" : "default",
                                  opacity: item.is_active === false ? 0.75 : 1,
                                }}
                              >
                                <input
                                  type="checkbox"
                                  checked={active}
                                  disabled={item.is_active === false || !canManageRoles}
                                  onChange={() => togglePermission(item.code)}
                                  style={{ marginTop: "3px" }}
                                />

                                <div style={{ minWidth: 0 }}>
                                  <div style={{ fontWeight: 900, fontSize: "14px", color: "var(--rp-text)", lineHeight: 1.6 }}>
                                    {item.name || "صلاحية بدون اسم"}
                                  </div>

                                  <div style={{ marginTop: "6px", color: "var(--rp-text-muted)", fontSize: "12px", wordBreak: "break-word" }}>
                                    {item.code}
                                  </div>

                                  <div style={{ marginTop: "8px" }}>
                                    <span className={`erp-badge ${active ? "success" : "warning"}`}>
                                      {active ? "مفعلة" : "غير مفعلة"}
                                    </span>
                                  </div>
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {canManageRoles ? (
                <div className="erp-form-actions" style={{ marginTop: "18px" }}>
                  <button style={primaryButtonStyle} onClick={handleSavePermissions} disabled={savingPermissions}>
                    {savingPermissions ? "جارٍ الحفظ..." : "حفظ صلاحيات الدور"}
                  </button>
                </div>
              ) : (
                <div className="erp-form-message" style={{ marginTop: "18px" }}>
                  هذا الحساب يستطيع مراجعة صلاحيات الدور فقط بدون تعديل.
                </div>
              )}
            </>
          )}

          {message ? <div className="erp-form-message">{message}</div> : null}
        </div>
      </section>
    </main>
  );
}
