import { API_BASE_URL } from "./config";
import { getAccessToken } from "../storage/auth-storage";

export async function apiFetch(path: string, options?: RequestInit) {
  const token = await getAccessToken();

  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options?.headers || {}),
    },
  });

  const data = await res.json().catch(() => null);

  if (!res.ok) {
    throw new Error(data?.detail || data?.message || "API Error");
  }

  return data;
}
