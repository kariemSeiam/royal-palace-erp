import { getStoredAccessToken } from "@/lib/auth-storage";

function normalizeApiBaseUrl(raw?: string | null): string {
  const fallback = "https://api.royalpalace-group.com";
  const base = (raw || fallback).trim().replace(/\/+$/, "");
  return base.endsWith("/api/v1") ? base : `${base}/api/v1`;
}

export function getStoreApiBaseUrl(): string {
  return normalizeApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL);
}

export function buildAuthHeaders(accessToken?: string | null): HeadersInit {
  const token = accessToken || getStoredAccessToken();
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

export function isAuthenticated(): boolean {
  return !!getStoredAccessToken();
}

export function requireStoredAccessToken(): string {
  const token = getStoredAccessToken();
  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }
  return token;
}

export const getApiBaseUrl = getStoreApiBaseUrl;
export const requireAccessToken = requireStoredAccessToken;
