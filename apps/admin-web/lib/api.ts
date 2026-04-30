export const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.royalpalace-group.com";

async function parseResponse(res: Response) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return text;
  }
}

export async function apiGet<T>(path: string): Promise<{ data: T | null; error: string | null; status: number }> {
  try {
    const res = await fetch(`${API_BASE_URL}${path}`, {
      method: "GET",
      cache: "no-store",
      headers: {
        "Content-Type": "application/json",
      },
    });

    const body = await parseResponse(res);

    if (!res.ok) {
      return {
        data: null,
        error: typeof body === "object" && body?.detail ? String(body.detail) : `Request failed with status ${res.status}`,
        status: res.status,
      };
    }

    return { data: body as T, error: null, status: res.status };
  } catch (error) {
    return {
      data: null,
      error: error instanceof Error ? error.message : "Unknown API error",
      status: 500,
    };
  }
}
