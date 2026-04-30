import { apiFetch } from "@/lib/api/client";
import { setTokens } from "@/lib/storage/auth-storage";

export async function login(identifier: string, password: string) {
  const data = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify({ identifier, password }),
  });

  await setTokens(data.access_token, data.refresh_token);

  return data;
}
