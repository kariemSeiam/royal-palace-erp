import Link from "next/link";
import { notFound } from "next/navigation";
import { StoreHeader } from "@/components/store-header";
import { StoreFooter } from "@/components/store-footer";
import {
  getStoreCategories,
  getStoreProductBySlugOrId,
  getStoreProducts,
} from "@/lib/store-api";
import { AddToCartButton } from "@/components/add-to-cart-button";
import { ProductCard } from "@/components/product-card";
import { ProductGallery } from "@/components/product-gallery";
import { ProductTabs } from "@/components/product-tabs";
import { MobileAddToCart } from "@/components/mobile-add-to-cart";

function formatPrice(price?: number | null, currency?: string | null) {
  if (price === null || price === undefined || Number(price) <= 0) {
    return "السعر عند الطلب";
  }
  return `${price} ${currency || "EGP"}`;
}

function hasDirectPrice(price?: number | null) {
  return price !== null && price !== undefined && Number(price) > 0;
}

function MetaBadge({
  children,
  tone = "default",
}: {
  children: React.ReactNode;
  tone?: "default" | "gold";
}) {
  const classes =
    tone === "gold"
      ? "border border-royal-gold/20 bg-royal-gold/10 text-royal-gold"
      : "border border-slate-200 bg-slate-50 text-slate-700";

  return (
    <span className={`inline-flex items-center rounded-full px-4 py-2 text-sm font-semibold ${classes}`}>
      {children}
    </span>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-[#f8fafc] p-4">
      <p className="mb-1 text-xs font-semibold text-slate-500">{label}</p>
      <p className="text-sm font-bold leading-7 text-royal-navy">{value}</p>
    </div>
  );
}

function TrustItem({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
      <p className="text-sm font-bold text-royal-navy">{title}</p>
      <p className="mt-2 text-xs leading-6 text-slate-600 md:text-sm">{desc}</p>
    </div>
  );
}

export default async function ProductDetailsPage({
  params,
}: {
  params: { slug: string };
}) {
  const product = await getStoreProductBySlugOrId(params.slug);

  if (!product) {
    notFound();
  }

  const categories = await getStoreCategories();
  const allProducts = await getStoreProducts();

  const currentCategory =
    categories.find((item) => item.id === product.category_id) || null;

  const relatedProducts = allProducts
    .filter(
      (item) =>
        item.id !== product.id &&
        item.is_active !== false &&
        product.category_id &&
        item.category_id === product.category_id
    )
    .slice(0, 4);

  const displayPrice = product.sale_price ?? product.price;
  const directBuy = hasDirectPrice(displayPrice);
  const hasDiscount =
    directBuy &&
    product.sale_price !== null &&
    product.sale_price !== undefined &&
    product.price !== null &&
    product.price !== undefined &&
    Number(product.sale_price) < Number(product.price);

  const galleryImages =
    product.gallery_images && product.gallery_images.length > 0
      ? product.gallery_images
      : [product.image_url || ""].filter(Boolean);

  const cartProduct = {
    id: product.id,
    slug: product.slug,
    name: product.name,
    image_url: product.image_url,
    price: displayPrice,
    currency: product.currency,
  };

  const quoteHref = `/projects?product=${encodeURIComponent(product.name)}&slug=${encodeURIComponent(product.slug || String(product.id))}`;

  return (
    <>
      <StoreHeader />

      <main className="container-royal pb-28 pt-8 md:pb-16 md:pt-10">
        <div className="mb-6 flex flex-wrap items-center gap-3 text-sm md:mb-8">
          <Link href="/" className="font-semibold text-royal-gold">
            الرئيسية
          </Link>
          <span className="text-slate-300">/</span>
          <Link href="/catalog" className="font-semibold text-royal-gold">
            المنتجات
          </Link>
          {currentCategory ? (
            <>
              <span className="text-slate-300">/</span>
              <Link
                href={`/categories/${currentCategory.slug || currentCategory.id}`}
                className="font-semibold text-royal-gold"
              >
                {currentCategory.name}
              </Link>
            </>
          ) : null}
          <span className="text-slate-300">/</span>
          <span className="text-slate-500">{product.name}</span>
        </div>

        <section className="grid gap-8 lg:grid-cols-[1.08fr_.92fr]">
          <div className="space-y-6">
            <div className="rounded-[28px] bg-white p-4 shadow-soft md:p-5">
              <ProductGallery name={product.name} images={galleryImages} />
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <InfoCard
                label="الحالة"
                value={product.is_active === false ? "غير منشور" : "متاح للعرض"}
              />
              <InfoCard
                label="نمط البيع"
                value={directBuy ? "شراء مباشر" : "حسب الطلب / للمشاريع"}
              />
              <InfoCard
                label="عدد الوسائط"
                value={`${galleryImages.length} صورة`}
              />
            </div>

            <div className="rounded-[28px] border border-[#eadfcb] bg-[#fcfaf6] p-5 shadow-soft md:p-6">
              <h2 className="text-xl font-bold text-royal-navy md:text-2xl">
                لماذا هذا المنتج؟
              </h2>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                <TrustItem
                  title="وضوح في العرض"
                  desc="عرض الصور والمعلومات والمواصفات في صفحة منظمة تساعد على اتخاذ قرار الشراء بثقة."
                />
                <TrustItem
                  title={directBuy ? "جاهز للشراء" : "جاهز للتخصيص"}
                  desc={
                    directBuy
                      ? "يمكنك إضافته مباشرة إلى السلة ومتابعة الطلب فورًا."
                      : "هذا المنتج مناسب للمشاريع أو الطلبات الخاصة التي تحتاج تواصلًا وعرض سعر."
                  }
                />
                <TrustItem
                  title="جاهزية للتوسع"
                  desc="أساس مناسب لتطوير المقاسات والخامات والتخصيص في مراحل لاحقة."
                />
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="rounded-[28px] bg-white p-6 shadow-soft lg:sticky lg:top-28">
              <div className="mb-4 flex flex-wrap gap-2">
                {product.is_featured ? <MetaBadge tone="gold">منتج مميز</MetaBadge> : null}
                {product.ar_enabled ? <MetaBadge>يدعم AR</MetaBadge> : null}
                {product.sku ? <MetaBadge>SKU: {product.sku}</MetaBadge> : null}
                {currentCategory ? <MetaBadge>{currentCategory.name}</MetaBadge> : null}
                {!directBuy ? <MetaBadge tone="gold">حسب الطلب</MetaBadge> : null}
              </div>

              <h1 className="text-3xl font-extrabold leading-tight text-royal-navy md:text-4xl">
                {product.name}
              </h1>

              {product.short_description ? (
                <p className="mt-4 text-sm leading-8 text-slate-600 md:text-base">
                  {product.short_description}
                </p>
              ) : null}

              <div className="mb-5 mt-5 flex flex-wrap items-center gap-3">
                <div className="inline-flex rounded-full bg-royal-gold/10 px-5 py-3 text-lg font-extrabold text-royal-gold">
                  {formatPrice(displayPrice, product.currency)}
                </div>

                {hasDiscount ? (
                  <div className="pb-1 text-sm font-bold text-slate-400 line-through">
                    {formatPrice(product.price, product.currency)}
                  </div>
                ) : null}
              </div>

              <div className="mb-5 rounded-[24px] border border-slate-100 bg-[#f8fafc] p-4">
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs text-slate-500">نمط الشراء</p>
                    <p className="mt-1 text-sm font-bold text-royal-navy">
                      {directBuy ? "إضافة مباشرة للسلة" : "تواصل وعرض سعر"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs text-slate-500">التنفيذ</p>
                    <p className="mt-1 text-sm font-bold text-royal-navy">
                      {directBuy ? "متاح للطلب الآن" : "يحتاج تنسيقًا مع الفريق"}
                    </p>
                  </div>
                  <div className="rounded-2xl bg-white p-3">
                    <p className="text-xs text-slate-500">المسار الأنسب</p>
                    <p className="mt-1 text-sm font-bold text-royal-navy">
                      {directBuy ? "شراء مباشر" : "مشروع / طلب خاص"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="mb-6 grid gap-3 sm:grid-cols-2">
                <InfoCard label="التصنيف" value={currentCategory?.name || "غير محدد"} />
                <InfoCard label="العملة" value={product.currency || "EGP"} />
                <InfoCard label="الخامات" value={product.materials || "غير محدد"} />
                <InfoCard label="الأبعاد" value={product.dimensions || "غير محدد"} />
              </div>

              <div className="hidden flex-wrap gap-3 lg:flex">
                <AddToCartButton product={cartProduct} />

                {directBuy ? (
                  <Link
                    href="/cart"
                    className="rounded-full bg-royal-navy px-5 py-3 text-sm font-semibold text-white"
                  >
                    اذهب إلى السلة
                  </Link>
                ) : (
                  <Link
                    href={quoteHref}
                    className="rounded-full bg-royal-navy px-5 py-3 text-sm font-semibold text-white"
                  >
                    تواصل للمشاريع
                  </Link>
                )}
              </div>
            </div>

            {product.glb_url || product.usdz_url ? (
              <div className="rounded-[28px] bg-white p-6 shadow-soft">
                <h2 className="mb-4 text-lg font-bold text-royal-navy md:text-xl">
                  ملفات العرض ثلاثي الأبعاد
                </h2>

                <div className="flex flex-wrap gap-3">
                  {product.glb_url ? (
                    <a
                      href={product.glb_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full bg-royal-navy px-5 py-3 text-sm font-semibold text-white"
                    >
                      فتح ملف GLB
                    </a>
                  ) : null}

                  {product.usdz_url ? (
                    <a
                      href={product.usdz_url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-full border border-royal-gold px-5 py-3 text-sm font-semibold text-royal-gold"
                    >
                      فتح ملف USDZ
                    </a>
                  ) : null}
                </div>
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-10">
          <ProductTabs
            tabs={[
              { id: "description", label: "الوصف", content: product.description },
              { id: "specs", label: "المواصفات", content: product.specifications },
              { id: "materials", label: "الخامات", content: product.materials },
              { id: "dimensions", label: "الأبعاد", content: product.dimensions },
              { id: "colors", label: "الألوان", content: product.color_options },
            ]}
          />
        </section>

        {relatedProducts.length > 0 ? (
          <section className="mt-14">
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
              <div>
                <h2 className="text-3xl font-bold text-royal-navy">منتجات مشابهة</h2>
                <p className="mt-2 text-slate-600">
                  منتجات من نفس القسم لإكمال تجربة التصفح بشكل أفضل.
                </p>
              </div>

              {currentCategory ? (
                <Link
                  href={`/categories/${currentCategory.slug || currentCategory.id}`}
                  className="rounded-full border border-royal-gold px-5 py-3 text-sm font-bold text-royal-gold"
                >
                  عرض كل منتجات القسم
                </Link>
              ) : null}
            </div>

            <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
              {relatedProducts.map((item) => (
                <ProductCard key={item.id} product={item} />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      <MobileAddToCart product={cartProduct} />

      <StoreFooter />
    </>
  );
}
