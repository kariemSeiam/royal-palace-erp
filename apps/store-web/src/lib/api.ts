const rawApiBase =
  process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/+$/, "") ||
  "https://api.royalpalace-group.com";

export const API_BASE_URL = rawApiBase.endsWith("/api/v1")
  ? rawApiBase
  : `${rawApiBase}/api/v1`;

export const apiBaseUrl = API_BASE_URL;

export function getApiBaseUrl() {
  return API_BASE_URL;
}

export function buildApiUrl(path: string) {
  if (!path) return API_BASE_URL;
  return path.startsWith("/") ? `${API_BASE_URL}${path}` : `${API_BASE_URL}/${path}`;
}

export type ApiRequestOptions = RequestInit & {
  token?: string | null;
};

function buildHeaders(init?: ApiRequestOptions): HeadersInit {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init?.headers || {}),
  };

  if (init?.token) {
    return {
      ...headers,
      Authorization: `Bearer ${init.token}`,
    };
  }

  return headers;
}

export async function apiFetch(path: string, init?: ApiRequestOptions) {
  const { token: _token, ...requestInit } = init || {};

  return fetch(buildApiUrl(path), {
    ...requestInit,
    headers: buildHeaders(init),
    cache: requestInit.cache || "no-store",
  });
}

export async function apiFetchJson<T = any>(path: string, init?: ApiRequestOptions): Promise<T> {
  const response = await apiFetch(path, init);

  const contentType = response.headers.get("content-type") || "";
  const isJson = contentType.includes("application/json");
  const payload = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      payload?.detail ||
      payload?.message ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload as T;
}

export async function apiRequest<T = any>(path: string, init?: ApiRequestOptions): Promise<T> {
  return apiFetchJson<T>(path, init);
}

const api = {
  API_BASE_URL,
  apiBaseUrl,
  getApiBaseUrl,
  buildApiUrl,
  apiFetch,
  apiFetchJson,
  apiRequest,
};

export default api;
