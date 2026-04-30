export function getToken() {
  if (typeof window === "undefined") return "";
  return localStorage.getItem("access_token") || "";
}

export function authHeaders(extraHeaders = {}) {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}`, ...extraHeaders } : { ...extraHeaders };
}
