import asyncio
import json
from pathlib import Path
from typing import Any

from sqlalchemy import text

from src.core.db.session import SessionLocal
from src.api.routers.admin_catalog import ensure_industrial_tables

IMPORT_JSON_PATH = Path("/app/uploads/products.json")
PRODUCT_IMAGES_ROOT = Path("/app/uploads/catalog-products")
PUBLIC_UPLOADS_PREFIX = "https://api.royalpalace-group.com/uploads/catalog-products"
DEFAULT_FACTORY_ID = 2


def clean_text(value: Any):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def as_bool(value: Any, default: bool = False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in {"1", "true", "yes", "on"}
    return default


def as_float(value: Any):
    if value in [None, ""]:
        return None
    return float(value)


async def get_category_map(db):
    result = await db.execute(
        text(
            """
            SELECT id, slug
            FROM product_categories
            """
        )
    )
    rows = result.mappings().all()
    return {str(row["slug"]).strip(): int(row["id"]) for row in rows}


async def product_exists_by_sku(db, sku: str):
    result = await db.execute(
        text(
            """
            SELECT id
            FROM products
            WHERE sku = :sku
            LIMIT 1
            """
        ),
        {"sku": sku},
    )
    row = result.first()
    return int(row[0]) if row else None


def build_public_image_urls(sku: str) -> list[str]:
    sku_dir = PRODUCT_IMAGES_ROOT / sku
    if not sku_dir.exists() or not sku_dir.is_dir():
        return []

    files = sorted(
        [
            p for p in sku_dir.iterdir()
            if p.is_file() and p.suffix.lower() in {".jpg", ".jpeg", ".png", ".webp"}
        ],
        key=lambda p: p.name.lower(),
    )

    return [f"{PUBLIC_UPLOADS_PREFIX}/{sku}/{p.name}" for p in files]


async def delete_product_gallery(db, product_id: int):
    await db.execute(
        text("DELETE FROM product_media WHERE product_id = :product_id"),
        {"product_id": product_id},
    )


async def insert_product_gallery(db, product_id: int, images: list[str], name_ar: str, name_en: str | None):
    for index, image_url in enumerate(images):
        await db.execute(
            text(
                """
                INSERT INTO product_media (
                    product_id,
                    media_type,
                    file_url,
                    alt_text_ar,
                    alt_text_en,
                    sort_order,
                    is_primary
                )
                VALUES (
                    :product_id,
                    'image',
                    :file_url,
                    :alt_text_ar,
                    :alt_text_en,
                    :sort_order,
                    :is_primary
                )
                """
            ),
            {
                "product_id": product_id,
                "file_url": image_url,
                "alt_text_ar": name_ar,
                "alt_text_en": name_en,
                "sort_order": index + 1,
                "is_primary": index == 0,
            },
        )


async def create_or_update_product(db, item: dict, category_map: dict[str, int], factory_id: int):
    sku = clean_text(item.get("sku"))
    slug = clean_text(item.get("slug"))
    name_ar = clean_text(item.get("name_ar"))
    name_en = clean_text(item.get("name_en"))
    category_slug = clean_text(item.get("category_slug"))

    if not sku:
        raise ValueError("sku is required")
    if not slug:
        raise ValueError(f"slug is required for sku {sku}")
    if not name_ar:
        raise ValueError(f"name_ar is required for sku {sku}")
    if not category_slug:
        raise ValueError(f"category_slug is required for sku {sku}")
    if category_slug not in category_map:
        raise ValueError(f"Unknown category_slug '{category_slug}' for sku {sku}")

    category_id = category_map[category_slug]

    gallery_images = item.get("gallery_images") or []
    if not isinstance(gallery_images, list):
        gallery_images = []

    filesystem_images = build_public_image_urls(sku)
    final_gallery = []
    for image in filesystem_images + gallery_images:
        image = clean_text(image)
        if image and image not in final_gallery:
            final_gallery.append(image)

    primary_image = final_gallery[0] if final_gallery else clean_text(item.get("primary_image_url"))
    preview_image = final_gallery[0] if final_gallery else clean_text(item.get("preview_image_url"))

    payload = {
        "factory_id": factory_id,
        "category_id": category_id,
        "name_ar": name_ar,
        "name_en": name_en,
        "slug": slug,
        "sku": sku,
        "base_price": as_float(item.get("base_price")),
        "description_ar": clean_text(item.get("description_ar")),
        "description_en": clean_text(item.get("description_en")),
        "technical_specifications": clean_text(item.get("technical_specifications")),
        "specifications": clean_text(item.get("specifications")),
        "materials": clean_text(item.get("materials")),
        "dimensions": clean_text(item.get("dimensions")),
        "color_options": clean_text(item.get("color_options")),
        "primary_image_url": primary_image,
        "preview_image_url": preview_image,
        "glb_url": clean_text(item.get("glb_url")),
        "usdz_url": clean_text(item.get("usdz_url")),
        "is_featured": as_bool(item.get("is_featured"), False),
        "ar_enabled": as_bool(item.get("ar_enabled"), False),
        "is_active": as_bool(item.get("is_active"), True),
        "product_family": clean_text(item.get("product_family")),
        "product_type": clean_text(item.get("product_type")),
        "production_mode": clean_text(item.get("production_mode")),
    }

    existing_id = await product_exists_by_sku(db, sku)

    if existing_id:
        await db.execute(
            text(
                """
                UPDATE products
                SET
                    factory_id = :factory_id,
                    category_id = :category_id,
                    name_ar = :name_ar,
                    name_en = :name_en,
                    slug = :slug,
                    sku = :sku,
                    base_price = :base_price,
                    description_ar = :description_ar,
                    description_en = :description_en,
                    technical_specifications = :technical_specifications,
                    specifications = :specifications,
                    materials = :materials,
                    dimensions = :dimensions,
                    color_options = :color_options,
                    primary_image_url = :primary_image_url,
                    preview_image_url = :preview_image_url,
                    glb_url = :glb_url,
                    usdz_url = :usdz_url,
                    is_featured = :is_featured,
                    ar_enabled = :ar_enabled,
                    is_active = :is_active,
                    product_family = :product_family,
                    product_type = :product_type,
                    production_mode = :production_mode
                WHERE id = :id
                """
            ),
            {**payload, "id": existing_id},
        )
        product_id = existing_id
        action = "updated"
    else:
        result = await db.execute(
            text(
                """
                INSERT INTO products (
                    factory_id,
                    category_id,
                    name_ar,
                    name_en,
                    slug,
                    sku,
                    base_price,
                    description_ar,
                    description_en,
                    technical_specifications,
                    specifications,
                    materials,
                    dimensions,
                    color_options,
                    primary_image_url,
                    preview_image_url,
                    glb_url,
                    usdz_url,
                    is_featured,
                    ar_enabled,
                    is_active,
                    product_family,
                    product_type,
                    production_mode
                )
                VALUES (
                    :factory_id,
                    :category_id,
                    :name_ar,
                    :name_en,
                    :slug,
                    :sku,
                    :base_price,
                    :description_ar,
                    :description_en,
                    :technical_specifications,
                    :specifications,
                    :materials,
                    :dimensions,
                    :color_options,
                    :primary_image_url,
                    :preview_image_url,
                    :glb_url,
                    :usdz_url,
                    :is_featured,
                    :ar_enabled,
                    :is_active,
                    :product_family,
                    :product_type,
                    :production_mode
                )
                RETURNING id
                """
            ),
            payload,
        )
        product_id = int(result.scalar_one())
        action = "created"

    await delete_product_gallery(db, product_id)
    await insert_product_gallery(db, product_id, final_gallery, name_ar, name_en)

    return {
        "sku": sku,
        "slug": slug,
        "product_id": product_id,
        "action": action,
        "gallery_count": len(final_gallery),
    }


async def main():
    if not IMPORT_JSON_PATH.exists():
        raise FileNotFoundError(f"Missing import file: {IMPORT_JSON_PATH}")

    raw = json.loads(IMPORT_JSON_PATH.read_text(encoding="utf-8"))
    if not isinstance(raw, list):
        raise ValueError("products.json must contain a JSON array")

    async with SessionLocal() as db:
        await ensure_industrial_tables(db)
        category_map = await get_category_map(db)

        results = []
        for item in raw:
            if not isinstance(item, dict):
                continue
            result = await create_or_update_product(db, item, category_map, DEFAULT_FACTORY_ID)
            results.append(result)

        await db.commit()

    print(json.dumps({
        "ok": True,
        "count": len(results),
        "results": results[:30],
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
