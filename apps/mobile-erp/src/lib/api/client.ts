import { API_BASE_URL } from "./config";
import { clearTokens, getAccessToken } from "../storage/auth-storage";

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

export async function apiFetch(path: string, options?: RequestInit) {
  const token = await getAccessToken();

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {})
    }
  });

  const data = await parseJsonSafe(response);

  if (response.status === 401) {
    await clearTokens();
    throw new Error("انتهت صلاحية جلسة Mobile ERP. يرجى تسجيل الدخول مرة أخرى.");
  }

  if (!response.ok) {
    throw new Error(
      extractErrorMessage(data, "تعذر تنفيذ الطلب على الخادم.")
    );
  }

  return data;
}
