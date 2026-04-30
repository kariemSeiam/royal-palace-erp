from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from src.models.catalog import ProductCategory, Product, ProductMedia, ProductARAsset

DATABASE_URL = "postgresql+psycopg://royal_palace:change_this_now@postgres:5432/royal_palace_erp"
engine = create_engine(DATABASE_URL, future=True)

categories = [
    {"name_ar": "مراتب", "name_en": "Mattresses", "slug": "mattresses", "sort_order": 1},
    {"name_ar": "كنب", "name_en": "Sofas", "slug": "sofas", "sort_order": 2},
    {"name_ar": "أسِرّة", "name_en": "Beds", "slug": "beds", "sort_order": 3},
    {"name_ar": "ديكور", "name_en": "Decor", "slug": "decor", "sort_order": 4},
    {"name_ar": "منتجات الفوم", "name_en": "Foam Products", "slug": "foam-products", "sort_order": 5},
]

products = [
    {
        "category_slug": "sofas",
        "name_ar": "كنبة مودرن",
        "name_en": "Modern Sofa",
        "slug": "modern-sofa",
        "sku": "SOFA-001",
        "description_ar": "كنبة عصرية بتصميم فاخر مناسبة لغرف المعيشة الحديثة.",
        "description_en": "Premium modern sofa for contemporary living rooms.",
        "material_specifications": "خشب زان - قماش عالي الجودة - إسفنج كثافة ممتازة",
        "base_price": 12450.00,
        "is_featured": True,
        "ar_enabled": True,
        "image_url": "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1200&q=80",
        "glb_url": "/uploads/ar/modern-sofa.glb",
        "usdz_url": "/uploads/ar/modern-sofa.usdz",
        "preview_image_url": "https://images.unsplash.com/photo-1493663284031-b7e3aefcae8e?auto=format&fit=crop&w=1200&q=80",
    },
    {
        "category_slug": "beds",
        "name_ar": "سرير فاخر",
        "name_en": "Luxury Bed",
        "slug": "luxury-bed",
        "sku": "BED-001",
        "description_ar": "سرير فاخر بخامات ممتازة وتصميم أنيق.",
        "description_en": "Luxury bed with elegant design and premium materials.",
        "material_specifications": "خشب طبيعي - قماش مبطن - تشطيب فاخر",
        "base_price": 18900.00,
        "is_featured": True,
        "ar_enabled": True,
        "image_url": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
        "glb_url": "/uploads/ar/luxury-bed.glb",
        "usdz_url": "/uploads/ar/luxury-bed.usdz",
        "preview_image_url": "https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?auto=format&fit=crop&w=1200&q=80",
    },
    {
        "category_slug": "mattresses",
        "name_ar": "مرتبة بريميوم",
        "name_en": "Premium Mattress",
        "slug": "premium-mattress",
        "sku": "MATT-001",
        "description_ar": "مرتبة مريحة بجودة عالية ودعم ممتاز للجسم.",
        "description_en": "Premium mattress with superior comfort and support.",
        "material_specifications": "فوم عالي الكثافة - طبقات داعمة - قماش فاخر",
        "base_price": 8950.00,
        "is_featured": True,
        "ar_enabled": False,
        "image_url": "https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1200&q=80",
        "glb_url": None,
        "usdz_url": None,
        "preview_image_url": None,
    },
]

with Session(engine) as session:
    category_map = {}

    for c in categories:
        existing = session.execute(select(ProductCategory).where(ProductCategory.slug == c["slug"])).scalar_one_or_none()
        if not existing:
            existing = ProductCategory(
                name_ar=c["name_ar"],
                name_en=c["name_en"],
                slug=c["slug"],
                is_active=True,
                sort_order=c["sort_order"],
            )
            session.add(existing)
            session.flush()
        category_map[c["slug"]] = existing

    session.commit()

    for p in products:
        existing_product = session.execute(select(Product).where(Product.slug == p["slug"])).scalar_one_or_none()
        if existing_product:
            continue

        category = category_map[p["category_slug"]]

        product = Product(
            category_id=category.id,
            name_ar=p["name_ar"],
            name_en=p["name_en"],
            slug=p["slug"],
            sku=p["sku"],
            description_ar=p["description_ar"],
            description_en=p["description_en"],
            material_specifications=p["material_specifications"],
            base_price=p["base_price"],
            is_active=True,
            is_featured=p["is_featured"],
            ar_enabled=p["ar_enabled"],
        )
        session.add(product)
        session.flush()

        session.add(ProductMedia(
            product_id=product.id,
            media_type="image",
            file_url=p["image_url"],
            alt_text_ar=p["name_ar"],
            alt_text_en=p["name_en"],
            sort_order=1,
            is_primary=True,
        ))

        if p["ar_enabled"]:
            session.add(ProductARAsset(
                product_id=product.id,
                glb_url=p["glb_url"],
                usdz_url=p["usdz_url"],
                preview_image_url=p["preview_image_url"],
                model_scale_factor="1.0",
                model_dimensions_mm="2000x900x850",
                ar_anchor_type="floor",
                is_active=True,
            ))

    session.commit()

print("Catalog seed completed successfully.")
