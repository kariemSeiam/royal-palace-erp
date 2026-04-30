import { clearTokens, getAccessToken, setTokens } from "../../lib/storage/auth-storage";
import { API_BASE_URL } from "../../lib/api/config";

export type WorkerLoginPayload = { identifier: string; password: string; };

async function parseJsonSafe(response: Response) {
  try { return await response.json(); } catch { return null; }
}

function extractErrorMessage(data: any, fallback: string) {
  if (data && typeof data === "object") {
    if (typeof data.detail === "string" && data.detail.trim()) return data.detail;
    if (typeof data.message === "string" && data.message.trim()) return data.message;
    if (typeof data.error === "string" && data.error.trim()) return data.error;
  }
  return fallback;
}

export async function workerLogin(payload: WorkerLoginPayload) {
  const response = await fetch(`${API_BASE_URL}/auth/login`, {
    method: "POST",
    headers: { Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await parseJsonSafe(response);
  if (!response.ok) throw new Error(extractErrorMessage(data, "فشل تسجيل الدخول."));
  if (!data?.access_token || !data?.refresh_token) throw new Error("استجابة تسجيل الدخول غير مكتملة.");
  await setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function getCurrentWorker() {
  const token = await getAccessToken();
  if (!token) throw new Error("NO_ACCESS_TOKEN");
  const response = await fetch(`${API_BASE_URL}/auth/me`, {
    method: "GET",
    headers: { Accept: "application/json", Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  });
  const data = await parseJsonSafe(response);
  if (response.status === 401) { await clearTokens(); throw new Error("UNAUTHORIZED"); }
  if (!response.ok) throw new Error(extractErrorMessage(data, "تعذر تحميل بيانات العامل."));
  if (!data?.employee_id) throw new Error("هذا الحساب غير مرتبط بموظف داخل النظام.");
  return data;
}

export async function workerLogout() { await clearTokens(); return { ok: true }; }
