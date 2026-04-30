import { getStoredAccessToken } from "@/lib/auth-storage";
import { buildAuthHeaders, getStoreApiBaseUrl } from "@/lib/store-auth";

export type StoreAccount = {
  id: number;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  governorate?: string | null;
  city?: string | null;
  address?: string | null;
  address_line?: string | null;
  address_notes?: string | null;
  created_at?: string;
};

export type CustomerAddress = {
  id: number;
  user_id: number;
  label?: string | null;
  full_name?: string | null;
  phone?: string | null;
  city?: string | null;
  area?: string | null;
  address_line_1?: string | null;
  address_line_2?: string | null;
  postal_code?: string | null;
  is_default?: boolean;
  created_at?: string;
  updated_at?: string;
};

function endpoint(path: string): string {
  return `${getStoreApiBaseUrl()}${path}`;
}

async function parseResponse<T>(response: Response): Promise<T> {
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const detail =
      data?.detail ||
      data?.message ||
      `Request failed with status ${response.status}`;
    throw new Error(String(detail));
  }

  return data as T;
}

function requireToken(accessToken?: string | null): string {
  const token = accessToken || getStoredAccessToken();
  if (!token) {
    throw new Error("AUTH_REQUIRED");
  }
  return token;
}

export async function getAccountMe(accessToken?: string | null): Promise<StoreAccount> {
  const token = requireToken(accessToken);

  const response = await fetch(endpoint("/store/account/me"), {
    method: "GET",
    headers: {
      ...buildAuthHeaders(token),
    },
    cache: "no-store",
  });

  return parseResponse<StoreAccount>(response);
}

export async function updateAccountMe(
  payload: Partial<StoreAccount> & {
    address?: string | null;
    address_line?: string | null;
    address_notes?: string | null;
  },
  accessToken?: string | null
): Promise<StoreAccount> {
  const token = requireToken(accessToken);

  const response = await fetch(endpoint("/store/account/me"), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(token),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  return parseResponse<StoreAccount>(response);
}

export async function listAccountAddresses(accessToken?: string | null): Promise<CustomerAddress[]> {
  const token = requireToken(accessToken);

  const response = await fetch(endpoint("/store/account/addresses"), {
    method: "GET",
    headers: {
      ...buildAuthHeaders(token),
    },
    cache: "no-store",
  });

  return parseResponse<CustomerAddress[]>(response);
}

export async function createAccountAddress(
  payload: Partial<CustomerAddress>,
  accessToken?: string | null
): Promise<CustomerAddress> {
  const token = requireToken(accessToken);

  const response = await fetch(endpoint("/store/account/addresses"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(token),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  return parseResponse<CustomerAddress>(response);
}

export async function updateAccountAddress(
  addressId: number,
  payload: Partial<CustomerAddress>,
  accessToken?: string | null
): Promise<CustomerAddress> {
  const token = requireToken(accessToken);

  const response = await fetch(endpoint(`/store/account/addresses/${addressId}`), {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(token),
    },
    body: JSON.stringify(payload),
    cache: "no-store",
  });

  return parseResponse<CustomerAddress>(response);
}

export async function deleteAccountAddress(
  addressId: number,
  accessToken?: string | null
): Promise<{ success: boolean }> {
  const token = requireToken(accessToken);

  const response = await fetch(endpoint(`/store/account/addresses/${addressId}`), {
    method: "DELETE",
    headers: {
      ...buildAuthHeaders(token),
    },
    cache: "no-store",
  });

  return parseResponse<{ success: boolean }>(response);
}

export const getMyAccount = getAccountMe;
export const updateMyAccount = updateAccountMe;
export const getMyAddresses = listAccountAddresses;
export const createMyAddress = createAccountAddress;
export const updateMyAddress = updateAccountAddress;
export const deleteMyAddress = deleteAccountAddress;
