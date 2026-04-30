"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Sidebar from "../components/Sidebar";
import useAdminAuth from "../components/useAdminAuth";
import { authHeaders } from "../components/api";

const CATEGORIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/catalog/categories";
const FACTORIES_API_URL = "https://api.royalpalace-group.com/api/v1/admin/users/factories";
const PRODUCTS_API_URL = "https://api.royalpalace-group.com/api/v1/admin/catalog/products";

const PAGE_SIZE_OPTIONS = [10, 20, 30, 50, 100];

const emptyForm = {
  name_ar: "",
  name_en: "",
  slug: "",
  sku: "",
  category_id: "",
  factory_id: "",
  base_price: "",
  description_ar: "",
  description_en: "",
  technical_specifications: "",
  specifications: "",
  materials: "",
  dimensions: "",
  color_options: "",
  primary_image_url: "",
  preview_image_url: "",
  glb_url: "",
  usdz_url: "",
  is_featured: true,
  ar_enabled: true,
  is_active: true,
  is_published: true,
  product_family: "",
  product_type: "",
  production_mode: "",
  thickness_cm: "",
  width_cm: "",
  length_cm: "",
  foam_density: "",
  foam_density_unit: "",
  firmness_level: "",
  has_springs: false,
  spring_type: "",
  has_pillow_top: false,
  has_wood_frame: false,
  fabric_spec: "",
  requires_upholstery: false,
  requires_quilting: false,
  notes_internal: "",
  bom_items: [],
  routing_steps: [],
  variants: [],
  gallery_items: [],
};

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function safeArray(value) {
  return Array.isArray(value) ? value : [];
}

function normalizeGalleryItems(value) {
  const raw = safeArray(value)
    .map((item) => {
      if (typeof item === "string") return item.trim();
      if (item && typeof item === "object") {
        return String(
          item.file_url ||
            item.image_url ||
            item.url ||
            item.src ||
            item.path ||
            ""
        ).trim();
      }
      return "";
    })
    .filter(Boolean);

  return Array.from(new Set(raw));
}

function formatPrice(value) {
  const num = Number(value || 0);
  if (!Number.isFinite(num) || num <= 0) return "0";
  return num.toLocaleString("en-US");
}

function resolveLockedFactoryId(user) {
  if (user?.is_superuser === true) return "";
  return user?.factory_id ? String(user.factory_id) : "";
}

function resolveVisibleFactories(user, factories) {
  const lockedFactoryId = resolveLockedFactoryId(user);
  if (!lockedFactoryId) return factories;
  return factories.filter((factory) => String(factory.id) === lockedFactoryId);
}

function resolvePreferredFactoryId(user, factories) {
  const lockedFactoryId = resolveLockedFactoryId(user);
  if (lockedFactoryId) return lockedFactoryId;
  if (!Array.isArray(factories) || factories.length === 0) return "";

  const userFactoryId = user?.factory_id || user?.factory?.id || "";
  if (
    userFactoryId &&
    factories.some((factory) => String(factory.id) === String(userFactoryId))
  ) {
    return String(userFactoryId);
  }

  return String(factories[0]?.id || "");
}

function resolveFactoryLabel(product) {
  if (product?.factory_name) return product.factory_name;
  if (product?.factory_id) return `مصنع #${product.factory_id}`;
  return "غير محدد";
}

function readinessLabel(readiness) {
  const status = readiness?.status || "";
  if (status === "manufacturing_ready") return "جاهز للتصنيع";
  if (status === "partially_ready") return "جاهز جزئيًا";
  return "كتالوج فقط";
}

function readinessTone(readiness) {
  const status = readiness?.status || "";
  if (status === "manufacturing_ready") return "success";
  return "warning";
}

function productionModeLabel(value) {
  const map = {
    make_to_stock: "إنتاج للمخزون",
    make_to_order: "إنتاج حسب الطلب",
    assemble_to_order: "تجميع حسب الطلب",
  };
  return map[value] || value || "-";
}

function familyTypeLabel(product) {
  const family = product?.product_family || "";
  const type = product?.product_type || "";
  if (family && type) return `${family} / ${type}`;
  return type || family || "-";
}

function buildDimensionText(product) {
  return [product?.length_cm, product?.width_cm, product?.thickness_cm]
    .filter(Boolean)
    .join(" × ") || product?.dimensions || "-";
}

function companyName() {
  return "Royal Palace Group";
}

function companyLogoUrl() {
  return "https://royalpalace-group.com/brand/logo.png";
}

function exportProductsCsv(rows, categoryMap) {
  const headers = [
    "ID",
    "الاسم العربي",
    "الاسم الإنجليزي",
    "SKU",
    "Slug",
    "الفئة",
    "المصنع",
    "العائلة",
    "النوع",
    "نمط الإنتاج",
    "الأبعاد",
    "الجاهزية",
    "السعر",
    "BOM",
    "Routing",
    "Variants",
    "الصور",
    "الحالة",
  ];

  const escapeCsv = (value) => {
    const s = String(value ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };

  const lines = rows.map((product) =>
    [
      product.id,
      product.name_ar || "",
      product.name_en || "",
      product.sku || "",
      product.slug || "",
      categoryMap[product.category_id] || "",
      resolveFactoryLabel(product),
      product.product_family || "",
      product.product_type || "",
      productionModeLabel(product.production_mode),
      buildDimensionText(product),
      readinessLabel(product.manufacturing_readiness),
      product.base_price || "",
      product.bom_items_count || 0,
      product.routing_steps_count || 0,
      product.variants_count || 0,
      normalizeGalleryItems(product.gallery_items).length || 0,
      product.is_active !== false ? "نشط" : "غير نشط",
    ]
      .map(escapeCsv)
      .join(",")
  );

  const csv = [headers.join(","), ...lines].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "products_export.csv";
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

function exportProductsPdf(rows, categoryMap) {
  const printWindow = window.open("", "_blank", "width=1280,height=900");
  if (!printWindow) return;

  const rowsHtml = rows
    .map(
      (product) => `
        <tr>
          <td>${product.id || ""}</td>
          <td>${product.name_ar || "-"}</td>
          <td>${product.sku || "-"}</td>
          <td>${categoryMap[product.category_id] || "-"}</td>
          <td>${resolveFactoryLabel(product)}</td>
          <td>${familyTypeLabel(product)}</td>
          <td>${buildDimensionText(product)}</td>
          <td>${readinessLabel(product.manufacturing_readiness)}</td>
          <td>${product.bom_items_count || 0}</td>
          <td>${product.routing_steps_count || 0}</td>
          <td>${product.variants_count || 0}</td>
          <td>${normalizeGalleryItems(product.gallery_items).length || 0}</td>
          <td>${formatPrice(product.base_price)}</td>
          <td>${product.is_active !== false ? "نشط" : "غير نشط"}</td>
        </tr>
      `
    )
    .join("");

  const html = `
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8" />
        <title>تقرير المنتجات</title>
        <style>
          * { box-sizing: border-box; }
          @page { size: A4 landscape; margin: 12mm; }
          body { font-family: Arial, sans-serif; margin: 0; color: #0f172a; background: #ffffff; }
          .page-header { display: flex; align-items: center; justify-content: space-between; gap: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; margin-bottom: 18px; }
          .brand { display: flex; align-items: center; gap: 12px; }
          .brand img { width: 56px; height: 56px; object-fit: contain; }
          .brand h1 { margin: 0; font-size: 22px; }
          .brand p { margin: 6px 0 0; color: #475569; font-size: 12px; }
          .summary { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 10px; margin-bottom: 18px; }
          .summary-card { border: 1px solid #cbd5e1; border-radius: 12px; padding: 12px; background: #f8fafc; }
          .summary-card .label { font-size: 11px; color: #64748b; margin-bottom: 6px; }
          .summary-card .value { font-size: 17px; font-weight: 800; color: #0f172a; }
          table { width: 100%; border-collapse: collapse; }
          th, td { border: 1px solid #cbd5e1; padding: 8px 10px; font-size: 11px; text-align: right; vertical-align: top; }
          thead th { background: #e2e8f0; font-weight: 800; }
          tbody tr:nth-child(even) { background: #f8fafc; }
        </style>
      </head>
      <body>
        <div class="page-header">
          <div class="brand">
            <img src="${companyLogoUrl()}" alt="logo" />
            <div>
              <h1>${companyName()}</h1>
              <p>تقرير المنتجات</p>
            </div>
          </div>
          <div>عدد المنتجات: ${rows.length}</div>
        </div>
        <div class="summary">
          <div class="summary-card"><div class="label">إجمالي المنتجات</div><div class="value">${rows.length}</div></div>
          <div class="summary-card"><div class="label">جاهز للتصنيع</div><div class="value">${rows.filter((p) => p.manufacturing_readiness?.status === "manufacturing_ready").length}</div></div>
          <div class="summary-card"><div class="label">نشط</div><div class="value">${rows.filter((p) => p.is_active !== false).length}</div></div>
          <div class="summary-card"><div class="label">مميز</div><div class="value">${rows.filter((p) => p.is_featured).length}</div></div>
        </div>
        <table>
          <thead>
            <tr>
              <th>#</th><th>المنتج</th><th>SKU</th><th>الفئة</th><th>المصنع</th><th>العائلة/النوع</th><th>الأبعاد</th><th>الجاهزية</th><th>BOM</th><th>Routing</th><th>Variants</th><th>الصور</th><th>السعر</th><th>الحالة</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
        <script>window.onload = function() { setTimeout(() => window.print(), 400); };</script>
      </body>
    </html>
  `;

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}

const compactControlStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 700, paddingInline: "12px" };
const topButtonStyle = { minHeight: "42px", borderRadius: "14px", fontWeight: 800, padding: "0 14px", whiteSpace: "nowrap" };
const compactTableHeaderStyle = { position: "sticky", top: 0, zIndex: 2, background: "#fff", boxShadow: "0 1px 0 rgba(15, 23, 42, 0.06)", fontSize: "12px", padding: "10px 12px", whiteSpace: "nowrap" };
const compactCellStyle = { padding: "10px 12px", fontSize: "12px", verticalAlign: "middle" };
const rowActionButtonStyle = { minHeight: "34px", borderRadius: "12px", fontWeight: 800, padding: "0 12px", fontSize: "12px" };
const paginationButtonStyle = { minWidth: "88px", minHeight: "38px", borderRadius: "12px", fontWeight: 800 };
const sectionCardStyle = { border: "1px solid var(--rp-border)", borderRadius: "18px", background: "var(--rp-surface)", padding: "16px", boxShadow: "var(--rp-shadow-soft)" };
const sectionTitleStyle = { margin: 0, fontSize: "18px", fontWeight: 900, color: "var(--rp-text)" };
const sectionNoteStyle = { margin: "6px 0 0", color: "var(--rp-text-muted)", lineHeight: 1.8, fontSize: "13px" };
const galleryCardStyle = { border: "1px dashed var(--rp-border)", borderRadius: "14px", padding: "12px", background: "rgba(15, 23, 42, 0.02)" };

export default function ProductsPage() {
  const { user, ready } = useAdminAuth("products");
  const [categories, setCategories] = useState([]);
  const [factories, setFactories] = useState([]);
  const [products, setProducts] = useState([]);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [tableSearch, setTableSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [factoryFilter, setFactoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [readinessFilter, setReadinessFilter] = useState("all");
  const [sortBy, setSortBy] = useState("newest");
  const [pageSize, setPageSize] = useState(20);
  const [page, setPage] = useState(1);
  const formShellRef = useRef(null);
  const firstFieldRef = useRef(null);

  const lockedFactoryId = resolveLockedFactoryId(user);
  const visibleFactories = useMemo(() => resolveVisibleFactories(user, factories), [user, factories]);

  async function loadCategories() {
    const res = await fetch(CATEGORIES_API_URL, { headers: authHeaders(), cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.detail || "فشل تحميل التصنيفات");
    setCategories(Array.isArray(data) ? data : []);
  }

  async function loadFactories() {
    const res = await fetch(FACTORIES_API_URL, { headers: authHeaders(), cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.detail || "فشل تحميل المصانع");
    setFactories(Array.isArray(data) ? data : []);
  }

  async function loadProducts() {
    const res = await fetch(PRODUCTS_API_URL, { headers: authHeaders(), cache: "no-store" });
    const data = await res.json().catch(() => []);
    if (!res.ok) throw new Error(data.detail || "فشل تحميل المنتجات");
    setProducts(Array.isArray(data) ? data : []);
  }

  async function loadAll() {
    await Promise.all([loadCategories(), loadFactories(), loadProducts()]);
  }

  useEffect(() => {
    if (!ready) return;
    loadAll().catch((err) => setMessage(err.message || "حدث خطأ أثناء تحميل البيانات"));
  }, [ready]);

  useEffect(() => {
    if (!ready || !user || editingId) return;
    setForm((prev) => {
      if (prev.factory_id) {
        if (lockedFactoryId && prev.factory_id !== lockedFactoryId) {
          return { ...prev, factory_id: lockedFactoryId };
        }
        return prev;
      }
      return { ...prev, factory_id: resolvePreferredFactoryId(user, factories) };
    });
  }, [ready, user, factories, editingId, lockedFactoryId]);

  useEffect(() => {
    setPage(1);
  }, [tableSearch, categoryFilter, factoryFilter, statusFilter, readinessFilter, sortBy, pageSize]);

  const categoryMap = useMemo(() => {
    const map = {};
    categories.forEach((cat) => { map[cat.id] = cat.name_ar || cat.name_en || `#${cat.id}`; });
    return map;
  }, [categories]);

  const filteredProducts = useMemo(() => {
    const q = normalizeText(tableSearch);
    let list = [...products];
    list = list.filter((product) => {
      if (categoryFilter !== "all" && String(product.category_id || "") !== String(categoryFilter)) return false;
      if (factoryFilter !== "all" && String(product.factory_id || "") !== String(factoryFilter)) return false;
      if (statusFilter === "active" && product.is_active === false) return false;
      if (statusFilter === "inactive" && product.is_active !== false) return false;

      const readinessStatus = product?.manufacturing_readiness?.status || "";
      if (readinessFilter === "ready" && readinessStatus !== "manufacturing_ready") return false;
      if (readinessFilter === "partial" && readinessStatus !== "partially_ready") return false;
      if (readinessFilter === "catalog_only" && !["", null, undefined].includes(readinessStatus)) return false;
      if (!q) return true;

      const haystack = [
        product.id, product.name_ar, product.name_en, product.slug, product.sku, product.base_price,
        product.product_family, product.product_type, product.production_mode, product.firmness_level,
        product.spring_type, categoryMap[product.category_id], resolveFactoryLabel(product), product.factory_id,
      ].join(" ").toLowerCase();

      return haystack.includes(q);
    });

    list.sort((a, b) => {
      if (sortBy === "name_ar") return String(a.name_ar || "").localeCompare(String(b.name_ar || ""), "ar");
      if (sortBy === "sku") return String(a.sku || "").localeCompare(String(b.sku || ""));
      if (sortBy === "price_desc") return Number(b.base_price || 0) - Number(a.base_price || 0);
      if (sortBy === "price_asc") return Number(a.base_price || 0) - Number(b.base_price || 0);
      return Number(b.id || 0) - Number(a.id || 0);
    });

    return list;
  }, [products, tableSearch, categoryFilter, factoryFilter, statusFilter, readinessFilter, sortBy, categoryMap]);

  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.is_active !== false).length;
    const featured = products.filter((p) => p.is_featured).length;
    const withBom = products.filter((p) => Array.isArray(p.bom_items) && p.bom_items.length > 0).length;
    const withRouting = products.filter((p) => Array.isArray(p.routing_steps) && p.routing_steps.length > 0).length;
    const withVariants = products.filter((p) => Array.isArray(p.variants) && p.variants.length > 0).length;
    const withGallery = products.filter((p) => normalizeGalleryItems(p.gallery_items).length > 0).length;
    const readyCount = products.filter((p) => p.manufacturing_readiness?.status === "manufacturing_ready").length;
    return { total, active, featured, withBom, withRouting, withVariants, withGallery, readyCount };
  }, [products]);

  const pagedProducts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredProducts.slice(start, start + pageSize);
  }, [filteredProducts, page, pageSize]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredProducts.length / pageSize)), [filteredProducts.length, pageSize]);

  const tableSummary = useMemo(() => {
    const start = filteredProducts.length === 0 ? 0 : (page - 1) * pageSize + 1;
    const end = Math.min(page * pageSize, filteredProducts.length);
    return { start, end, total: filteredProducts.length };
  }, [filteredProducts.length, page, pageSize]);

  function updateField(field, value) { setForm((prev) => ({ ...prev, [field]: value })); }
  function updateGalleryItem(index, value) {
    setForm((prev) => {
      const current = normalizeGalleryItems(prev.gallery_items);
      const next = [...current, ...Array(Math.max(0, index + 1 - current.length)).fill("")];
      next[index] = value;
      return { ...prev, gallery_items: next };
    });
  }
  function addGalleryItem() { setForm((prev) => ({ ...prev, gallery_items: [...normalizeGalleryItems(prev.gallery_items), ""] })); }
  function removeGalleryItem(index) { setForm((prev) => ({ ...prev, gallery_items: normalizeGalleryItems(prev.gallery_items).filter((_, i) => i !== index) })); }
  function setAsPrimaryFromGallery(index) {
    const items = normalizeGalleryItems(form.gallery_items);
    const value = items[index] || "";
    if (!value) return;
    setForm((prev) => ({ ...prev, primary_image_url: value }));
  }
  function setAsPreviewFromGallery(index) {
    const items = normalizeGalleryItems(form.gallery_items);
    const value = items[index] || "";
    if (!value) return;
    setForm((prev) => ({ ...prev, preview_image_url: value }));
  }

  function seedGalleryFromPrimaryAndPreview() {
    const seeded = Array.from(new Set([form.primary_image_url, form.preview_image_url].map((x) => String(x || "").trim()).filter(Boolean)));
    if (!seeded.length) {
      setMessage("لا توجد صورة رئيسية أو معاينة لإضافتها إلى الجاليري.");
      return;
    }
    setForm((prev) => ({ ...prev, gallery_items: Array.from(new Set([...normalizeGalleryItems(prev.gallery_items), ...seeded])) }));
    setMessage("تمت إضافة الصورة الرئيسية أو المعاينة إلى الجاليري.");
  }

  function normalizeFormBeforeSubmit(currentForm) {
    const cleanedGallery = normalizeGalleryItems(currentForm.gallery_items);
    return {
      ...currentForm,
      primary_image_url: String(currentForm.primary_image_url || "").trim(),
      preview_image_url: String(currentForm.preview_image_url || "").trim(),
      gallery_items: cleanedGallery,
    };
  }

  function resetForm() {
    setForm({ ...emptyForm, factory_id: lockedFactoryId || resolvePreferredFactoryId(user, factories) });
    setEditingId(null);
    setShowForm(false);
    setMessage("");
  }

  function startCreate() {
    resetForm();
    setShowForm(true);
    setTimeout(() => {
      if (firstFieldRef.current) {
        firstFieldRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        firstFieldRef.current.focus({ preventScroll: true });
      }
    }, 80);
  }

  function startEdit(product) {
    const nextFactoryId = lockedFactoryId || (product.factory_id ? String(product.factory_id) : "");
    setEditingId(product.id);
    setShowForm(true);
    setForm({
      ...emptyForm,
      name_ar: product.name_ar || "",
      name_en: product.name_en || "",
      slug: product.slug || "",
      sku: product.sku || "",
      category_id: product.category_id ? String(product.category_id) : "",
      factory_id: nextFactoryId,
      base_price: product.base_price || "",
      description_ar: product.description_ar || "",
      description_en: product.description_en || "",
      technical_specifications: product.technical_specifications || "",
      specifications: product.specifications || "",
      materials: product.materials || "",
      dimensions: product.dimensions || "",
      color_options: product.color_options || "",
      primary_image_url: product.primary_image_url || "",
      preview_image_url: product.preview_image_url || "",
      glb_url: product.glb_url || product.glb_model_url || "",
      usdz_url: product.usdz_url || product.usdz_model_url || "",
      is_featured: product.is_featured !== false,
      ar_enabled: !!product.ar_enabled,
      is_active: product.is_active !== false,
      is_published: product.is_published !== false,
      product_family: product.product_family || "",
      product_type: product.product_type || "",
      production_mode: product.production_mode || "",
      thickness_cm: product.thickness_cm || "",
      width_cm: product.width_cm || "",
      length_cm: product.length_cm || "",
      foam_density: product.foam_density || "",
      foam_density_unit: product.foam_density_unit || "",
      firmness_level: product.firmness_level || "",
      has_springs: !!product.has_springs,
      spring_type: product.spring_type || "",
      has_pillow_top: !!product.has_pillow_top,
      has_wood_frame: !!product.has_wood_frame,
      fabric_spec: product.fabric_spec || "",
      requires_upholstery: !!product.requires_upholstery,
      requires_quilting: !!product.requires_quilting,
      notes_internal: product.notes_internal || "",
      bom_items: safeArray(product.bom_items),
      routing_steps: safeArray(product.routing_steps),
      variants: safeArray(product.variants),
      gallery_items: normalizeGalleryItems(product.gallery_items),
    });
    setMessage("");

    setTimeout(() => {
      if (firstFieldRef.current) {
        firstFieldRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
        firstFieldRef.current.focus({ preventScroll: true });
      } else if (formShellRef.current) {
        formShellRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 80);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setSubmitting(true);
    setMessage("");

    try {
      const cleanedForm = normalizeFormBeforeSubmit(form);
      const payload = {
        name_ar: cleanedForm.name_ar.trim(),
        name_en: cleanedForm.name_en.trim() || null,
        slug: cleanedForm.slug.trim(),
        sku: cleanedForm.sku.trim(),
        category_id: cleanedForm.category_id ? Number(cleanedForm.category_id) : null,
        factory_id: (lockedFactoryId || cleanedForm.factory_id) ? Number(lockedFactoryId || cleanedForm.factory_id) : null,
        base_price: cleanedForm.base_price || null,
        description_ar: cleanedForm.description_ar.trim() || null,
        description_en: cleanedForm.description_en.trim() || null,
        technical_specifications: cleanedForm.technical_specifications.trim() || null,
        specifications: cleanedForm.specifications.trim() || null,
        materials: cleanedForm.materials.trim() || null,
        dimensions: cleanedForm.dimensions.trim() || null,
        color_options: cleanedForm.color_options.trim() || null,
        primary_image_url: cleanedForm.primary_image_url || null,
        preview_image_url: cleanedForm.preview_image_url || null,
        glb_url: cleanedForm.glb_url.trim() || null,
        usdz_url: cleanedForm.usdz_url.trim() || null,
        is_featured: !!cleanedForm.is_featured,
        ar_enabled: !!cleanedForm.ar_enabled,
        is_active: !!cleanedForm.is_active,
        is_published: !!cleanedForm.is_published,
        product_family: cleanedForm.product_family.trim() || null,
        product_type: cleanedForm.product_type.trim() || null,
        production_mode: cleanedForm.production_mode.trim() || null,
        thickness_cm: cleanedForm.thickness_cm || null,
        width_cm: cleanedForm.width_cm || null,
        length_cm: cleanedForm.length_cm || null,
        foam_density: cleanedForm.foam_density || null,
        foam_density_unit: cleanedForm.foam_density_unit.trim() || null,
        firmness_level: cleanedForm.firmness_level.trim() || null,
        has_springs: !!cleanedForm.has_springs,
        spring_type: cleanedForm.spring_type.trim() || null,
        has_pillow_top: !!cleanedForm.has_pillow_top,
        has_wood_frame: !!cleanedForm.has_wood_frame,
        fabric_spec: cleanedForm.fabric_spec.trim() || null,
        requires_upholstery: !!cleanedForm.requires_upholstery,
        requires_quilting: !!cleanedForm.requires_quilting,
        notes_internal: cleanedForm.notes_internal.trim() || null,
        bom_items: safeArray(cleanedForm.bom_items),
        routing_steps: safeArray(cleanedForm.routing_steps),
        variants: safeArray(cleanedForm.variants),
        gallery_items: normalizeGalleryItems(cleanedForm.gallery_items),
      };

      const url = editingId ? `${PRODUCTS_API_URL}/${editingId}` : PRODUCTS_API_URL;
      const method = editingId ? "PUT" : "POST";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || (editingId ? "فشل تعديل المنتج" : "فشل إنشاء المنتج"));

      setMessage(editingId ? "تم تعديل المنتج بنجاح" : "تم إنشاء المنتج بنجاح");
      resetForm();
      await loadProducts();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء حفظ المنتج");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(id) {
    if (!confirm("هل تريد حذف هذا المنتج؟")) return;
    setDeletingId(id);
    setMessage("");

    try {
      const res = await fetch(`${PRODUCTS_API_URL}/${id}`, { method: "DELETE", headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "فشل حذف المنتج");

      setMessage("تم حذف المنتج بنجاح");
      if (editingId === id) resetForm();
      await loadProducts();
    } catch (err) {
      setMessage(err.message || "حدث خطأ أثناء حذف المنتج");
    } finally {
      setDeletingId(null);
    }
  }

  if (!ready || !user) {
    return <main className="loading-shell"><div className="loading-card">جارٍ تحميل المنتجات...</div></main>;
  }

  return (
    <main className="erp-shell" dir="rtl">
      <Sidebar user={user} />
      <section className="erp-main" dir="rtl">
        <section className="erp-hero">
          <div style={{ textAlign: "right" }}>
            <div className="erp-hero-pill">إدارة المنتجات الصناعية</div>
            <h2>إضافة وتعديل المنتجات</h2>
            <p>تم تنظيم النموذج ليكون أوضح بصريًا وأسهل في الاستخدام مع الحفاظ على نفس منطق البيانات والصلاحيات وربط المصنع، مع دعم كامل لإدارة الجاليري.</p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={() => setShowForm((prev) => !prev)}>
              {showForm ? "إخفاء النموذج" : "فتح النموذج"}
            </button>
            <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={startCreate}>إضافة منتج</button>
          </div>
        </section>

        {message ? <div className="erp-form-message" style={{ marginBottom: "18px" }}>{message}</div> : null}

        {showForm ? (
          <div className="erp-section-card" ref={formShellRef} style={{ marginBottom: "18px", display: "grid", gap: "16px" }}>
            <div className="erp-section-head" style={{ marginBottom: 0 }}>
              <div style={{ textAlign: "right" }}>
                <h3 style={{ margin: 0 }}>{editingId ? `تعديل المنتج #${editingId}` : "إضافة منتج جديد"}</h3>
                <p style={{ margin: "6px 0 0" }}>نموذج منظم إلى مجموعات واضحة: البيانات الأساسية، التصنيف والتصنيع، المقاسات، الوصف، الصور والجاليري، والخيارات التشغيلية.</p>
              </div>
              <div className="erp-mini-note">{editingId ? "وضع التعديل" : "وضع الإضافة"}</div>
            </div>

            <form className="erp-form-grid" onSubmit={handleSubmit} style={{ gap: "16px" }}>
              <div style={sectionCardStyle}>
                <h4 style={sectionTitleStyle}>البيانات الأساسية</h4>
                <p style={sectionNoteStyle}>أهم الحقول التعريفية للمنتج داخل النظام والكتالوج.</p>
                <div className="erp-form-grid erp-form-grid-2" style={{ marginTop: "14px" }}>
                  <div><label className="erp-label">الاسم العربي</label><input ref={firstFieldRef} className="erp-input" value={form.name_ar} onChange={(e) => updateField("name_ar", e.target.value)} /></div>
                  <div><label className="erp-label">الاسم الإنجليزي</label><input className="erp-input" value={form.name_en} onChange={(e) => updateField("name_en", e.target.value)} /></div>
                  <div><label className="erp-label">Slug</label><input className="erp-input" value={form.slug} onChange={(e) => updateField("slug", e.target.value)} /></div>
                  <div><label className="erp-label">SKU</label><input className="erp-input" value={form.sku} onChange={(e) => updateField("sku", e.target.value)} /></div>
                  <div><label className="erp-label">السعر الأساسي</label><input className="erp-input" value={form.base_price} onChange={(e) => updateField("base_price", e.target.value)} /></div>
                  <div><label className="erp-label">نوع المنتج</label><input className="erp-input" value={form.product_type} onChange={(e) => updateField("product_type", e.target.value)} /></div>
                </div>
              </div>

              <div style={sectionCardStyle}>
                <h4 style={sectionTitleStyle}>التصنيف والربط التشغيلي</h4>
                <p style={sectionNoteStyle}>ربط المنتج بالفئة والمصنع والعائلة الصناعية ونمط الإنتاج.</p>
                <div className="erp-form-grid erp-form-grid-2" style={{ marginTop: "14px" }}>
                  <div>
                    <label className="erp-label">الفئة</label>
                    <select className="erp-input" value={form.category_id} onChange={(e) => updateField("category_id", e.target.value)}>
                      <option value="">اختر الفئة</option>
                      {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name_ar || cat.name_en}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="erp-label">المصنع</label>
                    <select className="erp-input" value={lockedFactoryId || form.factory_id} onChange={(e) => updateField("factory_id", e.target.value)} disabled={!!lockedFactoryId}>
                      <option value="">اختر المصنع</option>
                      {visibleFactories.map((factory) => <option key={factory.id} value={factory.id}>{factory.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="erp-label">العائلة الصناعية</label>
                    <select className="erp-input" value={form.product_family} onChange={(e) => updateField("product_family", e.target.value)}>
                      <option value="">اختر</option>
                      <option value="mattress">مراتب</option>
                      <option value="foam">فوم</option>
                      <option value="furniture">أثاث</option>
                      <option value="accessories">إكسسوارات</option>
                    </select>
                  </div>
                  <div>
                    <label className="erp-label">نمط الإنتاج</label>
                    <select className="erp-input" value={form.production_mode} onChange={(e) => updateField("production_mode", e.target.value)}>
                      <option value="">اختر</option>
                      <option value="make_to_stock">إنتاج للمخزون</option>
                      <option value="make_to_order">إنتاج حسب الطلب</option>
                      <option value="assemble_to_order">تجميع حسب الطلب</option>
                    </select>
                  </div>
                </div>
              </div>

              <div style={sectionCardStyle}>
                <h4 style={sectionTitleStyle}>المقاسات والخصائص الصناعية</h4>
                <p style={sectionNoteStyle}>حقول المقاس والخواص المرتبطة بجاهزية التصنيع.</p>
                <div className="erp-form-grid erp-form-grid-3" style={{ marginTop: "14px" }}>
                  <div><label className="erp-label">السمك (سم)</label><input className="erp-input" value={form.thickness_cm} onChange={(e) => updateField("thickness_cm", e.target.value)} /></div>
                  <div><label className="erp-label">العرض (سم)</label><input className="erp-input" value={form.width_cm} onChange={(e) => updateField("width_cm", e.target.value)} /></div>
                  <div><label className="erp-label">الطول (سم)</label><input className="erp-input" value={form.length_cm} onChange={(e) => updateField("length_cm", e.target.value)} /></div>
                  <div><label className="erp-label">كثافة الفوم</label><input className="erp-input" value={form.foam_density} onChange={(e) => updateField("foam_density", e.target.value)} /></div>
                  <div><label className="erp-label">وحدة كثافة الفوم</label><input className="erp-input" value={form.foam_density_unit} onChange={(e) => updateField("foam_density_unit", e.target.value)} /></div>
                  <div><label className="erp-label">درجة الصلابة</label><input className="erp-input" value={form.firmness_level} onChange={(e) => updateField("firmness_level", e.target.value)} /></div>
                  <div><label className="erp-label">نوع السوست</label><input className="erp-input" value={form.spring_type} onChange={(e) => updateField("spring_type", e.target.value)} /></div>
                  <div><label className="erp-label">الخامات</label><input className="erp-input" value={form.materials} onChange={(e) => updateField("materials", e.target.value)} /></div>
                  <div><label className="erp-label">الأبعاد النصية</label><input className="erp-input" value={form.dimensions} onChange={(e) => updateField("dimensions", e.target.value)} /></div>
                </div>
                <div className="erp-checkbox-grid" style={{ marginTop: "14px" }}>
                  <label className="erp-check"><input type="checkbox" checked={form.has_springs} onChange={(e) => updateField("has_springs", e.target.checked)} /><span>يحتوي على سوست</span></label>
                  <label className="erp-check"><input type="checkbox" checked={form.has_pillow_top} onChange={(e) => updateField("has_pillow_top", e.target.checked)} /><span>يحتوي على Pillow Top</span></label>
                  <label className="erp-check"><input type="checkbox" checked={form.has_wood_frame} onChange={(e) => updateField("has_wood_frame", e.target.checked)} /><span>يحتوي على إطار خشبي</span></label>
                  <label className="erp-check"><input type="checkbox" checked={form.requires_upholstery} onChange={(e) => updateField("requires_upholstery", e.target.checked)} /><span>يتطلب تنجيد</span></label>
                  <label className="erp-check"><input type="checkbox" checked={form.requires_quilting} onChange={(e) => updateField("requires_quilting", e.target.checked)} /><span>يتطلب Quilting</span></label>
                </div>
              </div>

              <div style={sectionCardStyle}>
                <h4 style={sectionTitleStyle}>الوصف والمحتوى</h4>
                <p style={sectionNoteStyle}>حقول الوصف الفني والتسويقي التي تظهر داخليًا أو في الكتالوج.</p>
                <div className="erp-form-grid erp-form-grid-2" style={{ marginTop: "14px" }}>
                  <div style={{ gridColumn: "1 / -1" }}><label className="erp-label">الوصف العربي</label><textarea className="erp-input" rows="3" value={form.description_ar} onChange={(e) => updateField("description_ar", e.target.value)} /></div>
                  <div style={{ gridColumn: "1 / -1" }}><label className="erp-label">الوصف الإنجليزي</label><textarea className="erp-input" rows="3" value={form.description_en} onChange={(e) => updateField("description_en", e.target.value)} /></div>
                  <div style={{ gridColumn: "1 / -1" }}><label className="erp-label">المواصفات الفنية</label><textarea className="erp-input" rows="3" value={form.technical_specifications} onChange={(e) => updateField("technical_specifications", e.target.value)} /></div>
                  <div style={{ gridColumn: "1 / -1" }}><label className="erp-label">المواصفات العامة</label><textarea className="erp-input" rows="3" value={form.specifications} onChange={(e) => updateField("specifications", e.target.value)} /></div>
                  <div><label className="erp-label">خيارات الألوان</label><input className="erp-input" value={form.color_options} onChange={(e) => updateField("color_options", e.target.value)} /></div>
                  <div><label className="erp-label">مواصفة القماش</label><input className="erp-input" value={form.fabric_spec} onChange={(e) => updateField("fabric_spec", e.target.value)} /></div>
                  <div style={{ gridColumn: "1 / -1" }}><label className="erp-label">ملاحظات داخلية</label><textarea className="erp-input" rows="3" value={form.notes_internal} onChange={(e) => updateField("notes_internal", e.target.value)} /></div>
                </div>
              </div>

              <div style={sectionCardStyle}>
                <h4 style={sectionTitleStyle}>الصور وملفات العرض</h4>
                <p style={sectionNoteStyle}>روابط الصورة الرئيسية والمعاينة وملفات النماذج ثلاثية الأبعاد مع إدارة كاملة للجاليري.</p>
                <div className="erp-form-grid erp-form-grid-2" style={{ marginTop: "14px" }}>
                  <div><label className="erp-label">الصورة الرئيسية</label><input className="erp-input" value={form.primary_image_url} onChange={(e) => updateField("primary_image_url", e.target.value)} /></div>
                  <div><label className="erp-label">صورة المعاينة</label><input className="erp-input" value={form.preview_image_url} onChange={(e) => updateField("preview_image_url", e.target.value)} /></div>
                  <div><label className="erp-label">ملف GLB</label><input className="erp-input" value={form.glb_url} onChange={(e) => updateField("glb_url", e.target.value)} /></div>
                  <div><label className="erp-label">ملف USDZ</label><input className="erp-input" value={form.usdz_url} onChange={(e) => updateField("usdz_url", e.target.value)} /></div>
                </div>

                <div style={{ ...galleryCardStyle, marginTop: "16px", display: "grid", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontWeight: 900, color: "var(--rp-text)" }}>صور الجاليري</div>
                      <div style={{ color: "var(--rp-text-muted)", fontSize: "13px", marginTop: "4px" }}>يمكنك إضافة أكثر من صورة للمنتج، مع تعيين أي صورة كصورة رئيسية أو صورة معاينة.</div>
                    </div>
                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button type="button" className="erp-btn-secondary" style={{ minHeight: "38px", borderRadius: "12px", padding: "0 12px" }} onClick={seedGalleryFromPrimaryAndPreview}>سحب الرئيسية أو المعاينة إلى الجاليري</button>
                      <button type="button" className="erp-btn-primary" style={{ minHeight: "38px", borderRadius: "12px", padding: "0 12px" }} onClick={addGalleryItem}>إضافة صورة</button>
                    </div>
                  </div>

                  {normalizeGalleryItems(form.gallery_items).length === 0 ? (
                    <div className="erp-mini-note">لا توجد صور داخل الجاليري حاليًا.</div>
                  ) : (
                    <div style={{ display: "grid", gap: "10px" }}>
                      {normalizeGalleryItems(form.gallery_items).map((item, index) => (
                        <div key={`gallery-item-${index}`} style={{ border: "1px solid var(--rp-border)", borderRadius: "14px", padding: "12px", background: "#fff", display: "grid", gap: "10px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                            <div className="erp-mini-note">صورة رقم {index + 1}</div>
                            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                              <button type="button" className="erp-btn-secondary" style={{ minHeight: "34px", borderRadius: "12px", padding: "0 10px", fontSize: "12px" }} onClick={() => setAsPrimaryFromGallery(index)}>تعيين كرئيسية</button>
                              <button type="button" className="erp-btn-secondary" style={{ minHeight: "34px", borderRadius: "12px", padding: "0 10px", fontSize: "12px" }} onClick={() => setAsPreviewFromGallery(index)}>تعيين كمعاينة</button>
                              <button type="button" className="erp-btn-danger" style={{ minHeight: "34px", borderRadius: "12px", padding: "0 10px", fontSize: "12px" }} onClick={() => removeGalleryItem(index)}>حذف الصورة</button>
                            </div>
                          </div>
                          <input className="erp-input" value={item} onChange={(e) => updateGalleryItem(index, e.target.value)} placeholder="رابط صورة الجاليري" />
                          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                            {form.primary_image_url === item ? <span className="erp-badge success">صورة رئيسية</span> : null}
                            {form.preview_image_url === item ? <span className="erp-badge success">صورة معاينة</span> : null}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              <div style={sectionCardStyle}>
                <h4 style={sectionTitleStyle}>الحالة والخيارات النهائية</h4>
                <p style={sectionNoteStyle}>التحكم في تفعيل المنتج وتمييزه وإتاحة العرض بتقنية AR.</p>
                <div className="erp-checkbox-grid" style={{ marginTop: "14px" }}>
                  <label className="erp-check"><input type="checkbox" checked={form.is_featured} onChange={(e) => updateField("is_featured", e.target.checked)} /><span>مميز</span></label>
                  <label className="erp-check"><input type="checkbox" checked={form.ar_enabled} onChange={(e) => updateField("ar_enabled", e.target.checked)} /><span>AR مفعّل</span></label>
                  <label className="erp-check"><input type="checkbox" checked={form.is_active} onChange={(e) => updateField("is_active", e.target.checked)} /><span>نشط</span></label>
                  <label className="erp-check"><input type="checkbox" checked={form.is_published} onChange={(e) => updateField("is_published", e.target.checked)} /><span>منشور</span></label>
                </div>
              </div>

              <div className="erp-form-actions" style={{ gridColumn: "1 / -1", gap: "10px", flexWrap: "wrap" }}>
                <button className="erp-btn-primary" type="submit" disabled={submitting}>{submitting ? "جارٍ الحفظ..." : editingId ? "حفظ التعديلات" : "إنشاء المنتج"}</button>
                <button className="erp-btn-secondary" type="button" onClick={resetForm}>{editingId ? "إلغاء التعديل" : "إغلاق النموذج"}</button>
              </div>
            </form>
          </div>
        ) : null}

        <section className="erp-kpi-grid" style={{ marginBottom: "16px" }}>
          <div className="erp-card"><div className="erp-card-title">BOM جاهز</div><div className="erp-card-value">{stats.withBom}</div><div className="erp-card-note">منتجات بها بنود خامات</div></div>
          <div className="erp-card"><div className="erp-card-title">Routing جاهز</div><div className="erp-card-value">{stats.withRouting}</div><div className="erp-card-note">منتجات بها خطوات تصنيع</div></div>
          <div className="erp-card"><div className="erp-card-title">Variants جاهزة</div><div className="erp-card-value">{stats.withVariants}</div><div className="erp-card-note">منتجات بها متغيرات بيع ومقاسات</div></div>
          <div className="erp-card"><div className="erp-card-title">Gallery</div><div className="erp-card-value">{stats.withGallery}</div><div className="erp-card-note">منتجات بها صور متعددة</div></div>
        </section>

        <div className="erp-section-card">
          <div className="erp-section-head" style={{ alignItems: "flex-start", gap: "14px" }}>
            <div style={{ textAlign: "right" }}>
              <h3 style={{ marginBottom: "4px" }}>سجل المنتجات</h3>
              <p style={{ margin: 0 }}>جدول احترافي مناسب لإدارة عدد كبير من المنتجات</p>
            </div>

            <div style={{ display: "grid", gap: "10px", width: "100%" }}>
              <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
                <input className="erp-input" style={{ ...compactControlStyle, flex: "1 1 260px", minWidth: "220px" }} placeholder="ابحث بالاسم أو SKU أو الفئة أو المصنع..." value={tableSearch} onChange={(e) => setTableSearch(e.target.value)} />
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 150px", minWidth: "140px" }} value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                  <option value="all">كل الفئات</option>
                  {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name_ar || cat.name_en}</option>)}
                </select>
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 150px", minWidth: "140px" }} value={factoryFilter} onChange={(e) => setFactoryFilter(e.target.value)}>
                  <option value="all">كل المصانع</option>
                  {visibleFactories.map((factory) => <option key={factory.id} value={factory.id}>{factory.name}</option>)}
                </select>
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 150px", minWidth: "140px" }} value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  <option value="all">كل الحالات</option>
                  <option value="active">نشط</option>
                  <option value="inactive">غير نشط</option>
                </select>
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 150px", minWidth: "140px" }} value={readinessFilter} onChange={(e) => setReadinessFilter(e.target.value)}>
                  <option value="all">كل الجاهزية</option>
                  <option value="ready">جاهز للتصنيع</option>
                  <option value="partial">جاهز جزئيًا</option>
                  <option value="catalog_only">كتالوج فقط</option>
                </select>
                <select className="erp-input" style={{ ...compactControlStyle, flex: "1 1 140px", minWidth: "130px" }} value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="newest">الأحدث</option>
                  <option value="name_ar">الاسم العربي</option>
                  <option value="sku">SKU</option>
                  <option value="price_desc">السعر: الأعلى</option>
                  <option value="price_asc">السعر: الأقل</option>
                </select>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                  <button type="button" className="erp-btn-secondary" style={topButtonStyle} onClick={() => exportProductsCsv(filteredProducts, categoryMap)}>Export CSV</button>
                  <button type="button" className="erp-btn-primary" style={topButtonStyle} onClick={() => exportProductsPdf(filteredProducts, categoryMap)}>Export PDF</button>
                </div>

                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <span className="erp-mini-note">المعروض: {tableSummary.start}-{tableSummary.end} من {tableSummary.total}</span>
                  <span className="erp-mini-note">إجمالي الكل: {products.length}</span>
                  <span className="erp-mini-note">جاهز للتصنيع: {stats.readyCount}</span>
                  <span className="erp-mini-note">عدد الصفوف</span>
                  <select className="erp-input" style={{ ...compactControlStyle, width: "96px" }} value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
                    {PAGE_SIZE_OPTIONS.map((size) => <option key={size} value={size}>{size}</option>)}
                  </select>
                </div>
              </div>
            </div>
          </div>

          <div className="erp-table-shell" style={{ overflowX: "auto", border: "1px solid var(--rp-border)", borderRadius: "16px", maxHeight: "70vh", background: "var(--rp-surface)" }}>
            <table className="erp-table" style={{ minWidth: "1340px" }}>
              <thead>
                <tr>
                  <th style={compactTableHeaderStyle}>#</th><th style={compactTableHeaderStyle}>المنتج</th><th style={compactTableHeaderStyle}>SKU</th><th style={compactTableHeaderStyle}>الفئة</th><th style={compactTableHeaderStyle}>المصنع</th><th style={compactTableHeaderStyle}>العائلة أو النوع</th><th style={compactTableHeaderStyle}>الأبعاد</th><th style={compactTableHeaderStyle}>الجاهزية</th><th style={compactTableHeaderStyle}>BOM</th><th style={compactTableHeaderStyle}>Routing</th><th style={compactTableHeaderStyle}>Variants</th><th style={compactTableHeaderStyle}>الصور</th><th style={compactTableHeaderStyle}>السعر</th><th style={compactTableHeaderStyle}>الحالة</th><th style={compactTableHeaderStyle}>إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {pagedProducts.length === 0 ? (
                  <tr><td colSpan="15" style={compactCellStyle}>لا توجد منتجات مطابقة.</td></tr>
                ) : (
                  pagedProducts.map((product) => (
                    <tr key={product.id}>
                      <td style={compactCellStyle}>{product.id}</td>
                      <td style={compactCellStyle}><div style={{ display: "grid", gap: "3px", minWidth: "210px" }}><strong style={{ fontSize: "13px" }}>{product.name_ar || "-"}</strong><span className="erp-mini-note">{product.name_en || "-"}</span><span className="erp-mini-note">{product.slug || "-"}</span></div></td>
                      <td style={{ ...compactCellStyle, whiteSpace: "nowrap" }}>{product.sku || "-"}</td>
                      <td style={compactCellStyle}>{categoryMap[product.category_id] || "-"}</td>
                      <td style={compactCellStyle}>{resolveFactoryLabel(product)}</td>
                      <td style={compactCellStyle}><div style={{ display: "grid", gap: "3px", minWidth: "150px" }}><span>{familyTypeLabel(product)}</span><span className="erp-mini-note">{productionModeLabel(product.production_mode)}</span></div></td>
                      <td style={{ ...compactCellStyle, whiteSpace: "nowrap" }}>{buildDimensionText(product)}</td>
                      <td style={compactCellStyle}><span className={`erp-badge ${readinessTone(product.manufacturing_readiness)}`}>{readinessLabel(product.manufacturing_readiness)}</span></td>
                      <td style={compactCellStyle}>{product.bom_items_count || 0}</td>
                      <td style={compactCellStyle}>{product.routing_steps_count || 0}</td>
                      <td style={compactCellStyle}>{product.variants_count || 0}</td>
                      <td style={compactCellStyle}><div style={{ display: "grid", gap: "3px" }}><span>{normalizeGalleryItems(product.gallery_items).length || 0}</span><span className="erp-mini-note">{product.primary_image_url ? "صورة رئيسية موجودة" : "بدون صورة رئيسية"}</span></div></td>
                      <td style={{ ...compactCellStyle, whiteSpace: "nowrap" }}>{formatPrice(product.base_price)}</td>
                      <td style={compactCellStyle}><div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}><span className={`erp-badge ${product.is_active !== false ? "success" : "warning"}`}>{product.is_active !== false ? "نشط" : "غير نشط"}</span><span className={`erp-badge ${product.is_featured ? "success" : "warning"}`}>مميز</span></div></td>
                      <td style={compactCellStyle}><div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}><button type="button" className="erp-btn-secondary" style={rowActionButtonStyle} onClick={() => startEdit(product)}>تعديل</button><button type="button" className="erp-btn-danger" style={rowActionButtonStyle} onClick={() => handleDelete(product.id)} disabled={deletingId === product.id}>{deletingId === product.id ? "جارٍ الحذف..." : "حذف"}</button></div></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "12px", flexWrap: "wrap", marginTop: "14px" }}>
            <div className="erp-mini-note">صفحة {page} من {totalPages}</div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setPage(1)} disabled={page === 1}>الأولى</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setPage((prev) => Math.max(1, prev - 1))} disabled={page === 1}>السابقة</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))} disabled={page === totalPages}>التالية</button>
              <button className="erp-btn-secondary" style={paginationButtonStyle} type="button" onClick={() => setPage(totalPages)} disabled={page === totalPages}>الأخيرة</button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
