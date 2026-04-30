const ACCESS_TOKEN_KEY = "royal_palace_access_token";
const REFRESH_TOKEN_KEY = "royal_palace_refresh_token";

function canUseBrowserStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function setStoredAccessToken(token: string | null): void {
  if (!canUseBrowserStorage()) return;
  if (token && token.trim()) {
    window.localStorage.setItem(ACCESS_TOKEN_KEY, token.trim());
  } else {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
}

export function setStoredRefreshToken(token: string | null): void {
  if (!canUseBrowserStorage()) return;
  if (token && token.trim()) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, token.trim());
  } else {
    window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  }
}

export function getStoredAccessToken(): string | null {
  if (!canUseBrowserStorage()) return null;
  const token = window.localStorage.getItem(ACCESS_TOKEN_KEY);
  return token && token.trim() ? token.trim() : null;
}

export function getStoredRefreshToken(): string | null {
  if (!canUseBrowserStorage()) return null;
  const token = window.localStorage.getItem(REFRESH_TOKEN_KEY);
  return token && token.trim() ? token.trim() : null;
}

export function persistAuthTokens(tokens: {
  access_token?: string | null;
  refresh_token?: string | null;
}): void {
  setStoredAccessToken(tokens.access_token ?? null);
  setStoredRefreshToken(tokens.refresh_token ?? null);
}

export function clearStoredAuthTokens(): void {
  setStoredAccessToken(null);
  setStoredRefreshToken(null);
}

export const storeAccessToken = setStoredAccessToken;
export const storeRefreshToken = setStoredRefreshToken;
export const saveAuthTokens = persistAuthTokens;
export const clearAuthTokens = clearStoredAuthTokens;
export const clearStoredAuth = clearStoredAuthTokens;

export { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY };
