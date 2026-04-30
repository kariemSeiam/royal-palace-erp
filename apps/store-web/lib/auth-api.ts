import {
  clearStoredAuthTokens,
  getStoredAccessToken,
  persistAuthTokens,
} from "@/lib/auth-storage";
import { buildAuthHeaders, getStoreApiBaseUrl } from "@/lib/store-auth";

export type LoginPayload = {
  identifier: string;
  password: string;
};

export type RegisterPayload = {
  full_name: string;
  username: string;
  email: string;
  phone: string;
  password: string;
  governorate?: string | null;
  city?: string | null;
  address_line?: string | null;
  address_notes?: string | null;
  confirm_password?: string | null;
};

export type AuthTokens = {
  access_token: string;
  refresh_token: string;
};

export type CurrentUser = {
  id: number;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  is_active?: boolean;
  is_superuser?: boolean;
  factory_id?: number | null;
  factory_name?: string | null;
  employee_id?: number | null;
  role_id?: number | null;
  role_name?: string | null;
  role_code?: string | null;
  permissions?: string[];
  governorate?: string | null;
  city?: string | null;
  address_line?: string | null;
  address_notes?: string | null;
};

type RequestResult<T> = {
  ok: boolean;
  data?: T;
  error?: string;
};

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail =
      data?.detail ||
      data?.message ||
      `Request failed with status ${response.status}`;
    throw new Error(String(detail));
  }

  return data as T;
}

function endpoint(path: string): string {
  return `${getStoreApiBaseUrl()}${path}`;
}

async function loginCore(payload: LoginPayload): Promise<AuthTokens> {
  const response = await fetch(endpoint("/auth/login"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  const data = await parseResponse<AuthTokens>(response);
  persistAuthTokens(data);
  return data;
}

async function registerCore(
  payload: RegisterPayload
): Promise<{ message: string; id: number }> {
  const response = await fetch(endpoint("/auth/register"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      full_name: payload.full_name,
      username: payload.username,
      email: payload.email,
      phone: payload.phone,
      password: payload.password,
      governorate: payload.governorate ?? null,
      city: payload.city ?? null,
      address_line: payload.address_line ?? null,
      address_notes: payload.address_notes ?? null,
      confirm_password: payload.confirm_password ?? payload.password,
    }),
    cache: "no-store",
  });

  return parseResponse<{ message: string; id: number }>(response);
}

async function getCurrentUserCore(
  accessToken?: string | null
): Promise<CurrentUser> {
  const token = accessToken || getStoredAccessToken();
  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }

  const response = await fetch(endpoint("/auth/me"), {
    method: "GET",
    headers: {
      ...buildAuthHeaders(token),
    },
    cache: "no-store",
  });

  if (response.status === 401) {
    clearStoredAuthTokens();
    throw new Error("AUTH_REQUIRED");
  }

  return parseResponse<CurrentUser>(response);
}

async function updateProfileCore(
  payload: Partial<CurrentUser> & {
    address?: string | null;
    address_line?: string | null;
    address_notes?: string | null;
  },
  accessToken?: string | null
): Promise<CurrentUser> {
  const token = accessToken || getStoredAccessToken();
  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }

  const response = await fetch(endpoint("/auth/profile"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(token),
    },
    body: JSON.stringify({
      full_name: payload.full_name ?? null,
      email: payload.email ?? null,
      phone: payload.phone ?? null,
      governorate: payload.governorate ?? null,
      city: payload.city ?? null,
      address_line: payload.address_line ?? payload.address ?? null,
      address: payload.address ?? payload.address_line ?? null,
      address_notes: payload.address_notes ?? null,
      confirm_password: payload.confirm_password ?? payload.password,
    }),
    cache: "no-store",
  });

  if (response.status === 401) {
    clearStoredAuthTokens();
    throw new Error("AUTH_REQUIRED");
  }

  return parseResponse<CurrentUser>(response);
}

export async function loginRequest(payload: {
  username?: string;
  identifier?: string;
  password: string;
}): Promise<RequestResult<AuthTokens>> {
  try {
    const data = await loginCore({
      identifier: payload.identifier || payload.username || "",
      password: payload.password,
    });
    return { ok: true, data };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "تعذر تسجيل الدخول.",
    };
  }
}

export async function registerRequest(
  payload: RegisterPayload
): Promise<RequestResult<{ message: string; id: number }>> {
  try {
    const data = await registerCore(payload);
    return { ok: true, data };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "تعذر إنشاء الحساب.",
    };
  }
}

export async function currentUserRequest(
  accessToken?: string | null
): Promise<RequestResult<CurrentUser>> {
  try {
    const data = await getCurrentUserCore(accessToken);
    return { ok: true, data };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "تعذر تحميل بيانات الحساب.",
    };
  }
}

export async function updateProfileRequest(
  payload: Partial<CurrentUser> & {
    address?: string | null;
    address_line?: string | null;
    address_notes?: string | null;
  },
  accessToken?: string | null
): Promise<RequestResult<CurrentUser>> {
  try {
    const data = await updateProfileCore(payload, accessToken);
    return { ok: true, data };
  } catch (error: any) {
    return {
      ok: false,
      error: error?.message || "تعذر تحديث بيانات الحساب.",
    };
  }
}

export async function logoutRequest(): Promise<{ ok: true }> {
  clearStoredAuthTokens();
  return { ok: true };
}

export async function getMeRequest(
  accessToken?: string | null
): Promise<RequestResult<CurrentUser>> {
  return currentUserRequest(accessToken);
}

export async function updateCurrentUserProfile(
  payload: Partial<CurrentUser> & {
    address?: string | null;
    address_line?: string | null;
    address_notes?: string | null;
  },
  accessToken?: string | null
): Promise<CurrentUser> {
  const result = await updateProfileRequest(payload, accessToken);
  if (!result.ok || !result.data) {
    throw new Error(result.error || "تعذر تحديث بيانات الحساب.");
  }
  return result.data;
}

export const login = loginRequest;
export const register = registerRequest;
export const getCurrentUser = currentUserRequest;
export const updateProfile = updateProfileRequest;
export const logout = logoutRequest;
