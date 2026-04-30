import { API_BASE_URL } from "../../lib/api/config";
import { clearTokens, getAccessToken, setTokens } from "../../lib/storage/auth-storage";

export type MobileErpLoginPayload = {
  identifier: string;
  password: string;
};

export type MobileErpUser = {
  id: number;
  username?: string | null;
  full_name?: string | null;
  email?: string | null;
  phone?: string | null;
  role_name?: string | null;
  role_code?: string | null;
  factory_id?: number | null;
  factory_name?: string | null;
  employee_id?: number | null;
  is_superuser?: boolean;
  is_active?: boolean;
  permissions?: string[];
};

async function parseJsonSafe(response: Response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

function extractErrorMessage(data: any, fallback: string) {
  if (data && typeof data === "object") {
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
    if (typeof data.message === "string" && data.message.trim()) return data.message;
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  }
  return fallback;
}

export function normalizeRole(user?: MobileErpUser | null) {
  const raw = user?.role_code || user?.role_name || "";
  return String(raw || "").trim().toLowerCase();
}

export function getUserPermissions(user?: MobileErpUser | null) {
  if (!Array.isArray(user?.permissions)) return [];
  return user!.permissions!
    .map((item) => String(item || "").trim().toLowerCase())
    .filter(Boolean);
}

export function hasPermission(user: MobileErpUser | null | undefined, code: string) {
  if (!code) return false;
  if (user?.is_superuser === true) return true;
  return getUserPermissions(user).includes(String(code).trim().toLowerCase());
}

export function hasAnyPermission(user: MobileErpUser | null | undefined, codes: string[] = []) {
  if (user?.is_superuser === true) return true;
  if (!Array.isArray(codes) || codes.length === 0) return false;
  return codes.some((code) => hasPermission(user, code));
}

export function isBlockedAdminRole(user?: MobileErpUser | null) {
  const role = normalizeRole(user);
  return ["customer", "store_customer", "customer_user"].includes(role);
}

export function isAdminPanelUser(user?: MobileErpUser | null) {
  if (!user) return false;
  if (user?.is_active === false) return false;
  if (isBlockedAdminRole(user)) return false;
  if (user?.is_superuser === true) return true;
  return getUserPermissions(user).length > 0;
}

export async function mobileErpLogin(payload: MobileErpLoginPayload) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      identifier: payload.identifier,
      password: payload.password
    })
  });

  const data = await parseJsonSafe(response);

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "فشل تسجيل الدخول."));
  }

  if (!data?.access_token) {
    throw new Error("استجابة تسجيل الدخول غير مكتملة.");
  }

  await setTokens(data.access_token, data.refresh_token || "");
  return data;
}

export async function getCurrentUser(): Promise<MobileErpUser> {
  const token = await getAccessToken();

  if (!token) {
    throw new Error("NO_ACCESS_TOKEN");
  }

  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${token}`
    },
    cache: "no-store"
  });

  const data = await parseJsonSafe(response);

  if (response.status === 401) {
    await clearTokens();
    throw new Error("UNAUTHORIZED");
  }

  if (!response.ok) {
    throw new Error(extractErrorMessage(data, "تعذر تحميل بيانات المستخدم."));
  }

  if (!isAdminPanelUser(data)) {
    await clearTokens();
    throw new Error("هذا الحساب غير مسموح له بدخول Mobile ERP.");
  }

  return data as MobileErpUser;
}

export async function logout() {
  await clearTokens();
}
