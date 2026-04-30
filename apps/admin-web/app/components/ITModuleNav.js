"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

function normalizePermissions(user) {
  return Array.isArray(user?.permissions)
    ? user.permissions.map((item) => String(item || "").trim().toLowerCase())
    : [];
}

function hasAnyPermission(user, codes = []) {
  if (user?.is_superuser === true) return true;
  const permissions = normalizePermissions(user);
  return codes.some((code) => permissions.includes(String(code).trim().toLowerCase()));
}

const sections = [
  {
    href: "/it",
    label: "مركز IT",
    note: "الرؤية التنفيذية",
    permissions: ["it.view", "it.manage"],
  },
  {
    href: "/infrastructure",
    label: "البنية التحتية",
    note: "خدمات وخوادم",
    permissions: [
      "it.view",
      "it.manage",
      "infrastructure.view",
      "infrastructure.manage",
      "servers.view",
      "servers.manage",
      "logs.view",
      "monitoring.view",
      "deployments.view",
      "deployments.manage",
    ],
  },
  {
    href: "/backups",
    label: "النسخ الاحتياطية",
    note: "Backup governance",
    permissions: ["backups.view", "backups.manage", "it.view", "it.manage"],
  },
  {
    href: "/media",
    label: "الوسائط",
    note: "صور وملفات",
    permissions: ["media.view", "media.manage", "it.view", "it.manage"],
  },
  {
    href: "/themes",
    label: "الثيمات",
    note: "ألوان وهوية",
    permissions: ["themes.view", "themes.manage", "it.view", "it.manage"],
  },
  {
    href: "/branding",
    label: "الهوية البصرية",
    note: "Brand control",
    permissions: ["branding.view", "branding.manage", "it.view", "it.manage"],
  },
  {
    href: "/ui-settings",
    label: "إعدادات الواجهة",
    note: "UI governance",
    permissions: ["ui_settings.manage", "global_settings.manage", "layout.manage", "it.manage"],
  },
];

export default function ITModuleNav({ user }) {
  const pathname = usePathname();

  const visibleSections = sections.filter((section) =>
    hasAnyPermission(user, section.permissions)
  );

  if (!visibleSections.length) return null;

  return (
    <div
      style={{
        marginBottom: "20px",
        background: "var(--rp-surface)",
        border: "1px solid var(--rp-border)",
        borderRadius: "20px",
        boxShadow: "var(--rp-shadow-soft)",
        padding: "14px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: "12px",
          alignItems: "center",
          flexWrap: "wrap",
          marginBottom: "12px",
        }}
      >
        <div>
          <div style={{ fontSize: "18px", fontWeight: 900, color: "var(--rp-text)" }}>
            أقسام تقنية المعلومات
          </div>
          <div style={{ color: "var(--rp-text-muted)", fontSize: "13px", marginTop: "4px" }}>
            تنقل تشغيلي موحد داخل وحدة IT والحوكمة الرقمية
          </div>
        </div>

        <div className="erp-mini-note">{visibleSections.length} أقسام متاحة</div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "10px",
        }}
      >
        {visibleSections.map((section) => {
          const active =
            pathname === section.href || pathname.startsWith(`${section.href}/`);

          return (
            <Link
              key={section.href}
              href={section.href}
              style={{
                borderRadius: "16px",
                padding: "12px 14px",
                border: active
                  ? "1px solid rgba(201, 166, 107, 0.48)"
                  : "1px solid var(--rp-border)",
                background: active
                  ? "linear-gradient(180deg, rgba(201, 166, 107, 0.10) 0%, rgba(214, 180, 122, 0.04) 100%)"
                  : "var(--rp-surface-2)",
                boxShadow: active
                  ? "0 12px 26px rgba(201, 166, 107, 0.10)"
                  : "none",
                display: "grid",
                gap: "5px",
              }}
            >
              <span style={{ fontWeight: 900, color: "var(--rp-text)", fontSize: "14px" }}>
                {section.label}
              </span>
              <span style={{ color: "var(--rp-text-muted)", fontSize: "12px", fontWeight: 700 }}>
                {section.note}
              </span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
