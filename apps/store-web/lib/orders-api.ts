import { getStoredAccessToken } from "@/lib/auth-storage";
import { buildAuthHeaders, getStoreApiBaseUrl } from "@/lib/store-auth";

export type OrderItemInput = {
  product_id: number;
  quantity: number;
};

export type CheckoutCustomer = {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
};

export type CreateOrderPayload = {
  items: OrderItemInput[];
  order_type?: "b2c" | "b2b";
  business_account_id?: number | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  shipping_address?: string | null;
  notes?: string | null;
  customer?: CheckoutCustomer;
};

export type OrderSummary = {
  id: number;
  order_number: string;
  order_type: string;
  status: string;
  payment_status: string;
  currency: string;
  subtotal_amount: number;
  vat_amount: number;
  total_amount: number;
  customer_name: string;
  customer_phone: string;
  shipping_address: unknown;
  factory_id?: number | null;
  factory_name?: string | null;
  warehouse_id?: number | null;
  warehouse_name?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type OrderDetails = OrderSummary & {
  notes?: string | null;
  items: Array<{
    id: number;
    product_id: number;
    product_name: string;
    sku?: string | null;
    quantity: number;
    unit_price: number;
    line_total: number;
    image_url?: string | null;
  }>;
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

function normalizeCreateOrderPayload(payload: CreateOrderPayload): CreateOrderPayload {
  const normalizedCustomerName = payload.customer_name ?? payload.customer?.name ?? null;
  const normalizedCustomerPhone = payload.customer_phone ?? payload.customer?.phone ?? null;
  const normalizedShippingAddress = payload.shipping_address ?? payload.customer?.address ?? null;

  return {
    order_type: payload.order_type || "b2c",
    business_account_id: payload.business_account_id ?? null,
    customer_name: normalizedCustomerName,
    customer_phone: normalizedCustomerPhone,
    shipping_address: normalizedShippingAddress,
    notes: payload.notes ?? null,
    items: payload.items.map((item) => ({
      product_id: Number(item.product_id),
      quantity: Number(item.quantity),
    })),
  };
}

export async function createOrderRequest(
  payload: CreateOrderPayload,
  accessToken?: string | null
): Promise<OrderSummary> {
  const token = requireToken(accessToken);

  const response = await fetch(endpoint("/orders"), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...buildAuthHeaders(token),
    },
    body: JSON.stringify(normalizeCreateOrderPayload(payload)),
    cache: "no-store",
  });

  return parseResponse<OrderSummary>(response);
}

export async function getMyOrders(accessToken?: string | null): Promise<OrderSummary[]> {
  const token = requireToken(accessToken);

  const response = await fetch(endpoint("/store/orders/my-orders"), {
    method: "GET",
    headers: {
      ...buildAuthHeaders(token),
    },
    cache: "no-store",
  });

  return parseResponse<OrderSummary[]>(response);
}

export async function getMyOrderDetails(
  orderId: number | string,
  accessToken?: string | null
): Promise<OrderDetails> {
  const token = requireToken(accessToken);

  const response = await fetch(endpoint(`/store/orders/my-orders/${orderId}`), {
    method: "GET",
    headers: {
      ...buildAuthHeaders(token),
    },
    cache: "no-store",
  });

  return parseResponse<OrderDetails>(response);
}

export const createOrder = createOrderRequest;
export const placeOrder = createOrderRequest;
