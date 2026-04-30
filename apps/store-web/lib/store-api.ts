import { API_BASE_URL } from "@/lib/config";

export type StoreCategory = {
  id: number;
  name: string;
  slug?: string | null;
  description?: string | null;
  image_url?: string | null;
};

export type StoreProduct = {
  id: number;
  name: string;
  slug?: string | null;
  sku?: string | null;
  description?: string | null;
  short_description?: string | null;
  price?: number | null;
  sale_price?: number | null;
  currency?: string | null;
  image_url?: string | null;
  category_id?: number | null;
  is_active?: boolean;
  is_featured?: boolean;
  ar_enabled?: boolean;
  specifications?: string | null;
  materials?: string | null;
  dimensions?: string | null;
  color_options?: string | null;
  glb_url?: string | null;
  usdz_url?: string | null;
  gallery_images?: string[];
};

function pickArabicFirst(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isNaN(n) ? null : n;
}

function toStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && !!item.trim());
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeProduct(item: Record<string, unknown>): StoreProduct {
  const galleryImages = [
    ...toStringArray(item.gallery_images),
    ...toStringArray(item.gallery),
    ...toStringArray(item.images),
  ];

  const primaryImage = pickArabicFirst(
    item.primary_image_url,
    item.preview_image_url,
    item.image_url,
    item.image
  );

  const uniqueGallery = Array.from(
    new Set([...(primaryImage ? [primaryImage] : []), ...galleryImages])
  );

  return {
    id: Number(item.id),
    name:
      pickArabicFirst(
        item.name_ar,
        item.name,
        item.name_en,
        item.slug,
        item.id ? String(item.id) : null
      ) || "منتج",
    slug: pickArabicFirst(item.slug, item.id ? String(item.id) : null),
    sku: pickArabicFirst(item.sku),
    description: pickArabicFirst(
      item.description_ar,
      item.description,
      item.description_en
    ),
    short_description: pickArabicFirst(
      item.short_description_ar,
      item.short_description,
      item.short_description_en,
      item.description_ar,
      item.description,
      item.description_en
    ),
    price: toNumber(item.base_price),
    sale_price: toNumber(item.sale_price),
    currency: pickArabicFirst(item.currency, "EGP"),
    image_url: primaryImage,
    category_id: toNumber(item.category_id),
    is_active: Boolean(item.is_active ?? true),
    is_featured: item.is_featured === true || item.is_featured === 1 || item.is_featured === "1",
    ar_enabled: Boolean(item.ar_enabled ?? false),
    specifications: pickArabicFirst(item.specifications, item.technical_specifications),
    materials: pickArabicFirst(item.materials),
    dimensions: pickArabicFirst(item.dimensions),
    color_options: pickArabicFirst(item.color_options),
    glb_url: pickArabicFirst(item.glb_url, item.glb_model_url),
    usdz_url: pickArabicFirst(item.usdz_url, item.usdz_model_url),
    gallery_images: uniqueGallery,
  };
}

function normalizeCategory(item: Record<string, unknown>): StoreCategory {
  return {
    id: Number(item.id),
    name:
      pickArabicFirst(
        item.name_ar,
        item.name,
        item.name_en,
        item.slug,
        item.id ? String(item.id) : null
      ) || "تصنيف",
    slug: pickArabicFirst(item.slug, item.id ? String(item.id) : null),
    description: pickArabicFirst(
      item.description_ar,
      item.description,
      item.description_en
    ),
    image_url: pickArabicFirst(item.image_url, item.banner_image_url),
  };
}

async function fetchJson(url: string): Promise<unknown | null> {
  try {
    const res = await fetch(url, {
      next: { revalidate: 60 },
      headers: {
        Accept: "application/json",
      },
    });

    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

function getComparablePrice(product: StoreProduct): number {
  return Number(product.sale_price ?? product.price ?? 0);
}

export function hasDirectBuyPrice(product: Pick<StoreProduct, "price" | "sale_price">): boolean {
  return getComparablePrice(product as StoreProduct) > 0;
}

export function sortProductsForMerchandising(products: StoreProduct[]): StoreProduct[] {
  return [...products].sort((a, b) => {
    const featuredDelta = Number(b.is_featured === true) - Number(a.is_featured === true);
    if (featuredDelta !== 0) return featuredDelta;

    const pricedDelta = Number(hasDirectBuyPrice(b)) - Number(hasDirectBuyPrice(a));
    if (pricedDelta !== 0) return pricedDelta;

    const imageDelta = Number(Boolean(b.image_url)) - Number(Boolean(a.image_url));
    if (imageDelta !== 0) return imageDelta;

    const galleryDelta =
      Number((b.gallery_images || []).length > 1) - Number((a.gallery_images || []).length > 1);
    if (galleryDelta !== 0) return galleryDelta;

    return getComparablePrice(b) - getComparablePrice(a);
  });
}

export function getBuyNowProducts(products: StoreProduct[], limit = 4): StoreProduct[] {
  return sortProductsForMerchandising(
    products.filter((item) => item.is_active !== false && hasDirectBuyPrice(item))
  ).slice(0, limit);
}

export function getQuoteProducts(products: StoreProduct[], limit = 4): StoreProduct[] {
  return sortProductsForMerchandising(
    products.filter((item) => item.is_active !== false && !hasDirectBuyPrice(item))
  ).slice(0, limit);
}

export async function getStoreProducts(): Promise<StoreProduct[]> {
  const data = await fetchJson(`${API_BASE_URL}/api/v1/catalog/products`);
  if (!Array.isArray(data)) return [];
  return data.map((item) => normalizeProduct(item as Record<string, unknown>));
}

export async function getStoreCategories(): Promise<StoreCategory[]> {
  const data = await fetchJson(`${API_BASE_URL}/api/v1/catalog/categories`);
  if (!Array.isArray(data)) return [];
  return data.map((item) => normalizeCategory(item as Record<string, unknown>));
}

export async function getStoreProductBySlugOrId(
  slugOrId: string
): Promise<StoreProduct | null> {
  const direct = await fetchJson(`${API_BASE_URL}/api/v1/catalog/products/${slugOrId}`);

  if (direct && !Array.isArray(direct) && typeof direct === "object") {
    return normalizeProduct(direct as Record<string, unknown>);
  }

  const products = await getStoreProducts();
  return (
    products.find((item) => item.slug === slugOrId || String(item.id) === slugOrId) || null
  );
}

export async function getFeaturedProducts(limit = 4): Promise<StoreProduct[]> {
  const products = await getStoreProducts();

  const featured = products.filter(
    (item) => item.is_active !== false && item.is_featured === true
  );

  return sortProductsForMerchandising(featured).slice(0, limit);
}

export async function getFeaturedCategories(limit = 6): Promise<StoreCategory[]> {
  const categories = await getStoreCategories();
  return categories.slice(0, limit);
}

export async function getCategoryBySlugOrId(slugOrId: string): Promise<StoreCategory | null> {
  const categories = await getStoreCategories();
  return (
    categories.find((item) => item.slug === slugOrId || String(item.id) === slugOrId) || null
  );
}

export async function getProductsByCategorySlugOrId(slugOrId: string): Promise<StoreProduct[]> {
  const category = await getCategoryBySlugOrId(slugOrId);
  if (!category) return [];

  const products = await getStoreProducts();
  return sortProductsForMerchandising(
    products.filter((item) => item.category_id === category.id)
  );
}

export function getCategoryNameById(
  categories: StoreCategory[],
  categoryId?: number | null
): string | null {
  if (!categoryId) return null;
  const found = categories.find((item) => item.id === categoryId);
  return found?.name || null;
}
