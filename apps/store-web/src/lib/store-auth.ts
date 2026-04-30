"use client";

const ACCESS_TOKEN_KEY = "rp_store_access_token";
const REFRESH_TOKEN_KEY = "rp_store_refresh_token";
const USER_KEY = "rp_store_user";

const ACCESS_COOKIE_KEY = "access_token";
const REFRESH_COOKIE_KEY = "refresh_token";

export type StoreUser = {
  id: number;
  full_name: string;
  username: string;
  email: string;
  phone?: string | null;
  role?: string | null;
};

function setCookie(name: string, value: string, days = 7) {
  if (typeof document === "undefined") return;
  const maxAge = days * 24 * 60 * 60;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=${encodeURIComponent(value)}; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure}`;
}

function deleteCookie(name: string) {
  if (typeof document === "undefined") return;
  const secure = window.location.protocol === "https:" ? "; Secure" : "";
  document.cookie = `${name}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
}

function getCookie(name: string): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1]) : null;
}

export function setAuthSession(params: {
  access_token: string;
  refresh_token: string;
  user?: StoreUser | null;
}) {
  if (typeof window === "undefined") return;

  localStorage.setItem(ACCESS_TOKEN_KEY, params.access_token);
  localStorage.setItem(REFRESH_TOKEN_KEY, params.refresh_token);

  setCookie(ACCESS_COOKIE_KEY, params.access_token);
  setCookie(REFRESH_COOKIE_KEY, params.refresh_token);

  if (params.user) {
    localStorage.setItem(USER_KEY, JSON.stringify(params.user));
  }
}

export function clearAuthSession() {
  if (typeof window === "undefined") return;

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  localStorage.removeItem(USER_KEY);

  deleteCookie(ACCESS_COOKIE_KEY);
  deleteCookie(REFRESH_COOKIE_KEY);
}

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(ACCESS_TOKEN_KEY) ||
    getCookie(ACCESS_COOKIE_KEY)
  );
}

export function getRefreshToken(): string | null {
  if (typeof window === "undefined") return null;
  return (
    localStorage.getItem(REFRESH_TOKEN_KEY) ||
    getCookie(REFRESH_COOKIE_KEY)
  );
}

export function getStoredUser(): StoreUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
