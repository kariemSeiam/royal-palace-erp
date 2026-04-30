from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    require_categories_manage,
    require_categories_view,
    require_products_manage,
    require_products_view,
    get_user_factory_scope_id,
    is_factory_scoped_user,
    enforce_factory_scope,
)
from src.core.db.session import get_db
from src.models.user import User

router = APIRouter(prefix="/admin/catalog", tags=["admin-catalog"])


async def get_table_columns(db: AsyncSession, table_name: str) -> set[str]:
    result = await db.execute(
        text(
            """
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :table_name
            """
        ),
        {"table_name": table_name},
    )
    return {row[0] for row in result.fetchall()}


async def get_table_exists(db: AsyncSession, table_name: str) -> bool:
    result = await db.execute(
        text(
            """
            SELECT EXISTS (
                SELECT 1
                FROM information_schema.tables
                WHERE table_schema = 'public'
                  AND table_name = :table_name
            )
            """
        ),
        {"table_name": table_name},
    )
    return bool(result.scalar())


async def get_categories_table_name(db: AsyncSession) -> str:
    for table_name in ["product_categories", "categories"]:
        result = await db.execute(
            text(
                """
                SELECT EXISTS (
                    SELECT 1
                    FROM information_schema.tables
                    WHERE table_schema = 'public'
                      AND table_name = :table_name
                )
                """
            ),
            {"table_name": table_name},
        )
        exists = result.scalar()
        if exists:
            return table_name
    raise HTTPException(status_code=500, detail="Categories table not found")


async def ensure_category_exists(db: AsyncSession, category_id: int) -> bool:
    table_name = await get_categories_table_name(db)
    result = await db.execute(
        text(f"SELECT id FROM {table_name} WHERE id = :category_id LIMIT 1"),
        {"category_id": category_id},
    )
    return bool(result.first())


async def ensure_factory_exists(db: AsyncSession, factory_id: int) -> bool:
    result = await db.execute(
        text("SELECT id FROM factories WHERE id = :factory_id LIMIT 1"),
        {"factory_id": factory_id},
    )
    return bool(result.first())


async def ensure_industrial_tables(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS product_bom_items (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                line_no INTEGER NOT NULL DEFAULT 1,
                material_name VARCHAR(255) NOT NULL,
                material_code VARCHAR(100) NULL,
                material_type VARCHAR(100) NULL,
                quantity NUMERIC(14, 3) NOT NULL DEFAULT 0,
                unit VARCHAR(50) NULL,
                waste_percent NUMERIC(8, 2) NULL,
                notes TEXT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_product_bom_items_product_id
            ON product_bom_items(product_id)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_product_bom_items_material_code
            ON product_bom_items(material_code)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS product_routing_steps (
                id SERIAL PRIMARY KEY,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                step_no INTEGER NOT NULL DEFAULT 1,
                step_code VARCHAR(100) NULL,
                step_name VARCHAR(255) NOT NULL,
                work_center VARCHAR(255) NULL,
                standard_minutes NUMERIC(10, 2) NULL,
                notes TEXT NULL,
                is_outsourced BOOLEAN NOT NULL DEFAULT FALSE,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_product_routing_steps_product_id
            ON product_routing_steps(product_id)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_product_routing_steps_step_code
            ON product_routing_steps(step_code)
            """
        )
    )
    await db.commit()


def normalize_bool(value, default=False) -> bool:
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in ["1", "true", "yes", "y", "on"]
    return default


def normalize_decimal(value, field_name: str):
    if value in [None, ""]:
        return None
    try:
        return float(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid numeric value for {field_name}")


def normalize_int(value, field_name: str):
    if value in [None, ""]:
        return None
    try:
        return int(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid integer value for {field_name}")


def clean_text(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def serialize_category_row(row, columns: set[str]):
    data = dict(row)
    return {
        "id": data.get("id"),
        "name_ar": data.get("name_ar"),
        "name_en": data.get("name_en") if "name_en" in columns else None,
        "slug": data.get("slug"),
        "description_ar": data.get("description_ar") if "description_ar" in columns else None,
        "description_en": data.get("description_en") if "description_en" in columns else None,
        "image_url": data.get("image_url") if "image_url" in columns else None,
        "banner_image_url": data.get("banner_image_url") if "banner_image_url" in columns else None,
        "sort_order": data.get("sort_order") if "sort_order" in columns else 0,
        "is_active": bool(data.get("is_active")) if "is_active" in columns and data.get("is_active") is not None else True,
    }


def _normalize_bom_item(item: dict, index: int) -> dict:
    material_name = clean_text(item.get("material_name"))
    if not material_name:
        raise HTTPException(status_code=400, detail=f"material_name is required for bom item #{index + 1}")

    quantity = normalize_decimal(item.get("quantity"), f"bom_items[{index}].quantity")
    if quantity is None or quantity <= 0:
        raise HTTPException(status_code=400, detail=f"quantity is required for bom item #{index + 1}")

    waste_percent = normalize_decimal(item.get("waste_percent"), f"bom_items[{index}].waste_percent")
    line_no = normalize_int(item.get("line_no"), f"bom_items[{index}].line_no") or (index + 1)

    return {
        "line_no": line_no,
        "material_name": material_name,
        "material_code": clean_text(item.get("material_code")),
        "material_type": clean_text(item.get("material_type")),
        "quantity": quantity,
        "unit": clean_text(item.get("unit")),
        "waste_percent": waste_percent,
        "notes": clean_text(item.get("notes")),
        "is_active": normalize_bool(item.get("is_active"), True),
    }


def _normalize_routing_step(item: dict, index: int) -> dict:
    step_name = clean_text(item.get("step_name"))
    if not step_name:
        raise HTTPException(status_code=400, detail=f"step_name is required for routing step #{index + 1}")

    step_no = normalize_int(item.get("step_no"), f"routing_steps[{index}].step_no") or (index + 1)
    standard_minutes = normalize_decimal(item.get("standard_minutes"), f"routing_steps[{index}].standard_minutes")

    return {
        "step_no": step_no,
        "step_code": clean_text(item.get("step_code")),
        "step_name": step_name,
        "work_center": clean_text(item.get("work_center")),
        "standard_minutes": standard_minutes,
        "notes": clean_text(item.get("notes")),
        "is_outsourced": normalize_bool(item.get("is_outsourced"), False),
        "is_active": normalize_bool(item.get("is_active"), True),
    }


def _normalize_variant(item: dict, index: int) -> dict:
    variant_name_ar = clean_text(item.get("variant_name_ar"))
    variant_name_en = clean_text(item.get("variant_name_en"))
    variant_sku = clean_text(item.get("variant_sku"))

    if not variant_name_ar:
        raise HTTPException(status_code=400, detail=f"variant_name_ar is required for variant #{index + 1}")
    if not variant_name_en:
        raise HTTPException(status_code=400, detail=f"variant_name_en is required for variant #{index + 1}")
    if not variant_sku:
        raise HTTPException(status_code=400, detail=f"variant_sku is required for variant #{index + 1}")

    return {
        "variant_name_ar": variant_name_ar,
        "variant_name_en": variant_name_en,
        "variant_sku": variant_sku,
        "color": clean_text(item.get("color")),
        "size_label": clean_text(item.get("size_label")),
        "price_override": normalize_decimal(item.get("price_override"), f"variants[{index}].price_override"),
        "is_active": normalize_bool(item.get("is_active"), True),
    }


def _normalize_gallery_item(item, index: int) -> dict:
    if isinstance(item, str):
        file_url = clean_text(item)
        if not file_url:
            raise HTTPException(status_code=400, detail=f"file_url is required for gallery item #{index + 1}")
        return {
            "media_type": "image",
            "file_url": file_url,
            "alt_text_ar": None,
            "alt_text_en": None,
            "sort_order": index + 1,
            "is_primary": index == 0,
        }

    if not isinstance(item, dict):
        raise HTTPException(status_code=400, detail=f"gallery item #{index + 1} must be a string or object")

    file_url = clean_text(item.get("file_url") or item.get("image_url") or item.get("url"))
    if not file_url:
        raise HTTPException(status_code=400, detail=f"file_url is required for gallery item #{index + 1}")

    media_type = clean_text(item.get("media_type")) or "image"
    if media_type != "image":
        raise HTTPException(status_code=400, detail=f"Only image media_type is supported for gallery item #{index + 1}")

    sort_order = normalize_int(item.get("sort_order"), f"gallery_items[{index}].sort_order") or (index + 1)

    return {
        "media_type": media_type,
        "file_url": file_url,
        "alt_text_ar": clean_text(item.get("alt_text_ar")),
        "alt_text_en": clean_text(item.get("alt_text_en")),
        "sort_order": sort_order,
        "is_primary": normalize_bool(item.get("is_primary"), index == 0),
    }


async def fetch_product_bom_items(db: AsyncSession, product_id: int) -> list[dict]:
    await ensure_industrial_tables(db)
    result = await db.execute(
        text(
            """
            SELECT
                id,
                product_id,
                line_no,
                material_name,
                material_code,
                material_type,
                quantity,
                unit,
                waste_percent,
                notes,
                is_active,
                created_at,
                updated_at
            FROM product_bom_items
            WHERE product_id = :product_id
            ORDER BY line_no ASC, id ASC
            """
        ),
        {"product_id": product_id},
    )
    rows = result.mappings().all()
    return [
        {
            "id": row.get("id"),
            "product_id": row.get("product_id"),
            "line_no": row.get("line_no"),
            "material_name": row.get("material_name"),
            "material_code": row.get("material_code"),
            "material_type": row.get("material_type"),
            "quantity": str(row.get("quantity")) if row.get("quantity") is not None else None,
            "unit": row.get("unit"),
            "waste_percent": str(row.get("waste_percent")) if row.get("waste_percent") is not None else None,
            "notes": row.get("notes"),
            "is_active": bool(row.get("is_active")) if row.get("is_active") is not None else True,
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }
        for row in rows
    ]


async def fetch_product_routing_steps(db: AsyncSession, product_id: int) -> list[dict]:
    await ensure_industrial_tables(db)
    result = await db.execute(
        text(
            """
            SELECT
                id,
                product_id,
                step_no,
                step_code,
                step_name,
                work_center,
                standard_minutes,
                notes,
                is_outsourced,
                is_active,
                created_at,
                updated_at
            FROM product_routing_steps
            WHERE product_id = :product_id
            ORDER BY step_no ASC, id ASC
            """
        ),
        {"product_id": product_id},
    )
    rows = result.mappings().all()
    return [
        {
            "id": row.get("id"),
            "product_id": row.get("product_id"),
            "step_no": row.get("step_no"),
            "step_code": row.get("step_code"),
            "step_name": row.get("step_name"),
            "work_center": row.get("work_center"),
            "standard_minutes": str(row.get("standard_minutes")) if row.get("standard_minutes") is not None else None,
            "notes": row.get("notes"),
            "is_outsourced": bool(row.get("is_outsourced")) if row.get("is_outsourced") is not None else False,
            "is_active": bool(row.get("is_active")) if row.get("is_active") is not None else True,
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }
        for row in rows
    ]


async def fetch_product_variants(db: AsyncSession, product_id: int) -> list[dict]:
    result = await db.execute(
        text(
            """
            SELECT
                id,
                product_id,
                variant_name_ar,
                variant_name_en,
                variant_sku,
                color,
                size_label,
                price_override,
                is_active,
                created_at,
                updated_at
            FROM product_variants
            WHERE product_id = :product_id
            ORDER BY id ASC
            """
        ),
        {"product_id": product_id},
    )
    rows = result.mappings().all()
    return [
        {
            "id": row.get("id"),
            "product_id": row.get("product_id"),
            "variant_name_ar": row.get("variant_name_ar"),
            "variant_name_en": row.get("variant_name_en"),
            "variant_sku": row.get("variant_sku"),
            "color": row.get("color"),
            "size_label": row.get("size_label"),
            "price_override": str(row.get("price_override")) if row.get("price_override") is not None else None,
            "is_active": bool(row.get("is_active")) if row.get("is_active") is not None else True,
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }
        for row in rows
    ]


async def fetch_product_gallery_items(db: AsyncSession, product_id: int) -> list[dict]:
    if not await get_table_exists(db, "product_media"):
        return []

    result = await db.execute(
        text(
            """
            SELECT
                id,
                product_id,
                media_type,
                file_url,
                alt_text_ar,
                alt_text_en,
                sort_order,
                is_primary,
                created_at,
                updated_at
            FROM product_media
            WHERE product_id = :product_id
            ORDER BY is_primary DESC, sort_order ASC, id ASC
            """
        ),
        {"product_id": product_id},
    )
    rows = result.mappings().all()

    return [
        {
            "id": row.get("id"),
            "product_id": row.get("product_id"),
            "media_type": row.get("media_type"),
            "file_url": row.get("file_url"),
            "alt_text_ar": row.get("alt_text_ar"),
            "alt_text_en": row.get("alt_text_en"),
            "sort_order": row.get("sort_order"),
            "is_primary": bool(row.get("is_primary")) if row.get("is_primary") is not None else False,
            "created_at": row.get("created_at"),
            "updated_at": row.get("updated_at"),
        }
        for row in rows
    ]


async def replace_product_bom_items(db: AsyncSession, product_id: int, items: list[dict]):
    await ensure_industrial_tables(db)
    await db.execute(text("DELETE FROM product_bom_items WHERE product_id = :product_id"), {"product_id": product_id})

    for index, item in enumerate(items):
        normalized = _normalize_bom_item(item, index)
        await db.execute(
            text(
                """
                INSERT INTO product_bom_items (
                    product_id,
                    line_no,
                    material_name,
                    material_code,
                    material_type,
                    quantity,
                    unit,
                    waste_percent,
                    notes,
                    is_active
                )
                VALUES (
                    :product_id,
                    :line_no,
                    :material_name,
                    :material_code,
                    :material_type,
                    :quantity,
                    :unit,
                    :waste_percent,
                    :notes,
                    :is_active
                )
                """
            ),
            {"product_id": product_id, **normalized},
        )


async def replace_product_routing_steps(db: AsyncSession, product_id: int, steps: list[dict]):
    await ensure_industrial_tables(db)
    await db.execute(text("DELETE FROM product_routing_steps WHERE product_id = :product_id"), {"product_id": product_id})

    for index, item in enumerate(steps):
        normalized = _normalize_routing_step(item, index)
        await db.execute(
            text(
                """
                INSERT INTO product_routing_steps (
                    product_id,
                    step_no,
                    step_code,
                    step_name,
                    work_center,
                    standard_minutes,
                    notes,
                    is_outsourced,
                    is_active
                )
                VALUES (
                    :product_id,
                    :step_no,
                    :step_code,
                    :step_name,
                    :work_center,
                    :standard_minutes,
                    :notes,
                    :is_outsourced,
                    :is_active
                )
                """
            ),
            {"product_id": product_id, **normalized},
        )


async def replace_product_variants(db: AsyncSession, product_id: int, items: list[dict]):
    await db.execute(text("DELETE FROM product_variants WHERE product_id = :product_id"), {"product_id": product_id})

    for index, item in enumerate(items):
        normalized = _normalize_variant(item, index)

        duplicate_variant_sku = await db.execute(
            text(
                """
                SELECT id
                FROM product_variants
                WHERE variant_sku = :variant_sku
                LIMIT 1
                """
            ),
            {"variant_sku": normalized["variant_sku"]},
        )
        if duplicate_variant_sku.first():
            raise HTTPException(status_code=409, detail=f"Variant SKU already exists: {normalized['variant_sku']}")

        await db.execute(
            text(
                """
                INSERT INTO product_variants (
                    product_id,
                    variant_name_ar,
                    variant_name_en,
                    variant_sku,
                    color,
                    size_label,
                    price_override,
                    is_active
                )
                VALUES (
                    :product_id,
                    :variant_name_ar,
                    :variant_name_en,
                    :variant_sku,
                    :color,
                    :size_label,
                    :price_override,
                    :is_active
                )
                """
            ),
            {"product_id": product_id, **normalized},
        )


async def replace_product_gallery_items(db: AsyncSession, product_id: int, items: list):
    if not await get_table_exists(db, "product_media"):
        raise HTTPException(status_code=500, detail="product_media table not found")

    await db.execute(text("DELETE FROM product_media WHERE product_id = :product_id"), {"product_id": product_id})

    normalized_items = [_normalize_gallery_item(item, index) for index, item in enumerate(items)]

    primary_found = False
    for item in normalized_items:
        if item["is_primary"] and not primary_found:
            primary_found = True
        elif item["is_primary"] and primary_found:
            item["is_primary"] = False

    if normalized_items and not primary_found:
        normalized_items[0]["is_primary"] = True

    for item in normalized_items:
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
                    :media_type,
                    :file_url,
                    :alt_text_ar,
                    :alt_text_en,
                    :sort_order,
                    :is_primary
                )
                """
            ),
            {"product_id": product_id, **item},
        )


def _compute_manufacturing_readiness(data: dict, bom_items: list[dict], routing_steps: list[dict], variants: list[dict]) -> dict:
    has_family = bool(clean_text(data.get("product_family")))
    has_type = bool(clean_text(data.get("product_type")))
    has_mode = bool(clean_text(data.get("production_mode")))
    has_any_dimensions = any(
        data.get(key) not in [None, ""]
        for key in ["thickness_cm", "width_cm", "length_cm", "dimensions"]
    )
    has_bom = len(bom_items) > 0
    has_routing = len(routing_steps) > 0
    has_variants = len(variants) > 0

    score = sum([
        1 if has_family else 0,
        1 if has_type else 0,
        1 if has_mode else 0,
        1 if has_any_dimensions else 0,
        1 if has_bom else 0,
        1 if has_routing else 0,
    ])

    if score >= 6:
        status = "manufacturing_ready"
    elif score >= 4:
        status = "partially_ready"
    else:
        status = "basic_catalog_only"

    return {
        "status": status,
        "score": score,
        "has_family": has_family,
        "has_type": has_type,
        "has_production_mode": has_mode,
        "has_dimensions": has_any_dimensions,
        "has_bom": has_bom,
        "has_routing": has_routing,
        "has_variants": has_variants,
    }


def serialize_product_row(
    row,
    columns: set[str],
    bom_items: list[dict] | None = None,
    routing_steps: list[dict] | None = None,
    variants: list[dict] | None = None,
    gallery_items: list[dict] | None = None,
):
    data = dict(row)
    safe_bom = bom_items or []
    safe_steps = routing_steps or []
    safe_variants = variants or []
    safe_gallery_items = gallery_items or []
    readiness = _compute_manufacturing_readiness(data, safe_bom, safe_steps, safe_variants)

    gallery_images = []
    for item in safe_gallery_items:
        file_url = clean_text(item.get("file_url"))
        if file_url and file_url not in gallery_images:
            gallery_images.append(file_url)

    primary_image = data.get("primary_image_url") if "primary_image_url" in columns else None
    preview_image = data.get("preview_image_url") if "preview_image_url" in columns else None

    if not primary_image and gallery_images:
        primary_image = gallery_images[0]
    if not preview_image and gallery_images:
        preview_image = gallery_images[0]

    return {
        "id": data.get("id"),
        "factory_id": data.get("factory_id") if "factory_id" in data else None,
        "factory_name": data.get("factory_name"),
        "name_ar": data.get("name_ar"),
        "name_en": data.get("name_en") if "name_en" in columns else None,
        "slug": data.get("slug"),
        "sku": data.get("sku"),
        "category_id": data.get("category_id"),
        "base_price": str(data.get("base_price")) if data.get("base_price") is not None else None,
        "is_featured": bool(data.get("is_featured")) if data.get("is_featured") is not None else False,
        "ar_enabled": bool(data.get("ar_enabled")) if data.get("ar_enabled") is not None else False,
        "is_active": bool(data.get("is_active")) if data.get("is_active") is not None else True,
        "primary_image_url": primary_image,
        "preview_image_url": preview_image,
        "gallery_items": safe_gallery_items,
        "gallery_images": gallery_images,
        "glb_url": data.get("glb_url") if "glb_url" in columns else None,
        "glb_model_url": data.get("glb_model_url") if "glb_model_url" in columns else None,
        "usdz_url": data.get("usdz_url") if "usdz_url" in columns else None,
        "usdz_model_url": data.get("usdz_model_url") if "usdz_model_url" in columns else None,
        "is_published": bool(data.get("is_published")) if "is_published" in columns and data.get("is_published") is not None else None,
        "description_ar": data.get("description_ar") if "description_ar" in columns else None,
        "description_en": data.get("description_en") if "description_en" in columns else None,
        "technical_specifications": data.get("technical_specifications") if "technical_specifications" in columns else None,
        "specifications": data.get("specifications") if "specifications" in columns else None,
        "materials": data.get("materials") if "materials" in columns else None,
        "dimensions": data.get("dimensions") if "dimensions" in columns else None,
        "color_options": data.get("color_options") if "color_options" in columns else None,
        "product_family": data.get("product_family") if "product_family" in columns else None,
        "product_type": data.get("product_type") if "product_type" in columns else None,
        "production_mode": data.get("production_mode") if "production_mode" in columns else None,
        "thickness_cm": str(data.get("thickness_cm")) if "thickness_cm" in columns and data.get("thickness_cm") is not None else None,
        "width_cm": str(data.get("width_cm")) if "width_cm" in columns and data.get("width_cm") is not None else None,
        "length_cm": str(data.get("length_cm")) if "length_cm" in columns and data.get("length_cm") is not None else None,
        "foam_density": str(data.get("foam_density")) if "foam_density" in columns and data.get("foam_density") is not None else None,
        "foam_density_unit": data.get("foam_density_unit") if "foam_density_unit" in columns else None,
        "firmness_level": data.get("firmness_level") if "firmness_level" in columns else None,
        "has_springs": bool(data.get("has_springs")) if "has_springs" in columns and data.get("has_springs") is not None else False,
        "spring_type": data.get("spring_type") if "spring_type" in columns else None,
        "has_pillow_top": bool(data.get("has_pillow_top")) if "has_pillow_top" in columns and data.get("has_pillow_top") is not None else False,
        "has_wood_frame": bool(data.get("has_wood_frame")) if "has_wood_frame" in columns and data.get("has_wood_frame") is not None else False,
        "fabric_spec": data.get("fabric_spec") if "fabric_spec" in columns else None,
        "requires_upholstery": bool(data.get("requires_upholstery")) if "requires_upholstery" in columns and data.get("requires_upholstery") is not None else False,
        "requires_quilting": bool(data.get("requires_quilting")) if "requires_quilting" in columns and data.get("requires_quilting") is not None else False,
        "notes_internal": data.get("notes_internal") if "notes_internal" in columns else None,
        "bom_items": safe_bom,
        "bom_items_count": len(safe_bom),
        "routing_steps": safe_steps,
        "routing_steps_count": len(safe_steps),
        "variants": safe_variants,
        "variants_count": len(safe_variants),
        "manufacturing_readiness": readiness,
    }


def resolve_requested_factory_id(payload: dict):
    value = payload.get("factory_id")
    if value in [None, ""]:
        return None
    try:
        return int(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid factory_id")


async def resolve_target_factory_id_for_create(db: AsyncSession, current_user: User, payload: dict) -> int:
    requested_factory_id = resolve_requested_factory_id(payload)
    scoped_factory_id = get_user_factory_scope_id(current_user)

    if is_factory_scoped_user(current_user):
        if scoped_factory_id is None:
            raise HTTPException(status_code=403, detail="Factory scope is required for this user")
        if requested_factory_id not in [None, scoped_factory_id]:
            raise HTTPException(status_code=403, detail="Cannot create records for another factory")
        target_factory_id = scoped_factory_id
    else:
        if requested_factory_id is None:
            raise HTTPException(status_code=400, detail="factory_id is required")
        target_factory_id = requested_factory_id

    if not await ensure_factory_exists(db, target_factory_id):
        raise HTTPException(status_code=404, detail="Factory not found")

    return target_factory_id


async def fetch_product_or_404(db: AsyncSession, product_id: int):
    result = await db.execute(
        text(
            """
            SELECT p.*, f.name AS factory_name
            FROM products p
            LEFT JOIN factories f ON f.id = p.factory_id
            WHERE p.id = :product_id
            LIMIT 1
            """
        ),
        {"product_id": product_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    return row


def build_product_payload(payload: dict, columns: set[str], target_factory_id: int):
    category_id = normalize_int(payload.get("category_id"), "category_id")
    if not category_id:
        raise HTTPException(status_code=400, detail="category_id is required")

    name_ar = clean_text(payload.get("name_ar"))
    name_en = clean_text(payload.get("name_en"))
    slug = clean_text(payload.get("slug"))
    sku = clean_text(payload.get("sku"))

    if not name_ar:
        raise HTTPException(status_code=400, detail="name_ar is required")
    if not name_en and "name_en" in columns:
        raise HTTPException(status_code=400, detail="name_en is required")
    if not slug:
        raise HTTPException(status_code=400, detail="slug is required")
    if not sku:
        raise HTTPException(status_code=400, detail="sku is required")

    data = {
        "factory_id": target_factory_id,
        "category_id": category_id,
        "name_ar": name_ar,
        "name_en": name_en,
        "slug": slug,
        "sku": sku,
        "base_price": normalize_decimal(payload.get("base_price"), "base_price"),
        "description_ar": clean_text(payload.get("description_ar")),
        "description_en": clean_text(payload.get("description_en")),
        "technical_specifications": clean_text(payload.get("technical_specifications")),
        "specifications": clean_text(payload.get("specifications")),
        "materials": clean_text(payload.get("materials")),
        "dimensions": clean_text(payload.get("dimensions")),
        "color_options": clean_text(payload.get("color_options")),
        "primary_image_url": clean_text(payload.get("primary_image_url")),
        "preview_image_url": clean_text(payload.get("preview_image_url")),
        "glb_url": clean_text(payload.get("glb_url")),
        "usdz_url": clean_text(payload.get("usdz_url")),
        "is_featured": normalize_bool(payload.get("is_featured"), False),
        "ar_enabled": normalize_bool(payload.get("ar_enabled"), False),
        "is_active": normalize_bool(payload.get("is_active"), True),
        "product_family": clean_text(payload.get("product_family")),
        "product_type": clean_text(payload.get("product_type")),
        "production_mode": clean_text(payload.get("production_mode")),
        "thickness_cm": normalize_decimal(payload.get("thickness_cm"), "thickness_cm"),
        "width_cm": normalize_decimal(payload.get("width_cm"), "width_cm"),
        "length_cm": normalize_decimal(payload.get("length_cm"), "length_cm"),
        "foam_density": normalize_decimal(payload.get("foam_density"), "foam_density"),
        "foam_density_unit": clean_text(payload.get("foam_density_unit")),
        "firmness_level": clean_text(payload.get("firmness_level")),
        "has_springs": normalize_bool(payload.get("has_springs"), False),
        "spring_type": clean_text(payload.get("spring_type")),
        "has_pillow_top": normalize_bool(payload.get("has_pillow_top"), False),
        "has_wood_frame": normalize_bool(payload.get("has_wood_frame"), False),
        "fabric_spec": clean_text(payload.get("fabric_spec")),
        "requires_upholstery": normalize_bool(payload.get("requires_upholstery"), False),
        "requires_quilting": normalize_bool(payload.get("requires_quilting"), False),
        "notes_internal": clean_text(payload.get("notes_internal")),
    }

    filtered = {}
    for key, value in data.items():
        if key in columns:
            filtered[key] = value

    return filtered


@router.get("/categories")
async def list_categories(
    _: User = Depends(require_categories_view),
    db: AsyncSession = Depends(get_db),
):
    table_name = await get_categories_table_name(db)
    columns = await get_table_columns(db, table_name)

    select_fields = ["id", "name_ar", "slug"]
    for field in ["name_en", "description_ar", "description_en", "image_url", "banner_image_url", "sort_order", "is_active"]:
        if field in columns:
            select_fields.append(field)

    order_by = "sort_order ASC, id ASC" if "sort_order" in columns else "id ASC"

    result = await db.execute(
        text(
            f"""
            SELECT {', '.join(select_fields)}
            FROM {table_name}
            ORDER BY {order_by}
            """
        )
    )
    rows = result.mappings().all()
    return [serialize_category_row(row, columns) for row in rows]


@router.post("/categories", status_code=status.HTTP_201_CREATED)
async def create_category(
    payload: dict,
    _: User = Depends(require_categories_manage),
    db: AsyncSession = Depends(get_db),
):
    table_name = await get_categories_table_name(db)
    columns = await get_table_columns(db, table_name)

    name_ar = clean_text(payload.get("name_ar"))
    slug = clean_text(payload.get("slug"))

    if not name_ar or not slug:
        raise HTTPException(status_code=400, detail="name_ar and slug are required")

    duplicate_slug = await db.execute(
        text(f"SELECT id FROM {table_name} WHERE slug = :slug LIMIT 1"),
        {"slug": slug},
    )
    if duplicate_slug.first():
        raise HTTPException(status_code=409, detail="Slug already exists")

    insert_data = {"name_ar": name_ar, "slug": slug}
    optional_values = {
        "name_en": clean_text(payload.get("name_en")),
        "description_ar": clean_text(payload.get("description_ar")),
        "description_en": clean_text(payload.get("description_en")),
        "image_url": clean_text(payload.get("image_url")),
        "banner_image_url": clean_text(payload.get("banner_image_url")),
        "sort_order": normalize_int(payload.get("sort_order"), "sort_order") or 0,
        "is_active": normalize_bool(payload.get("is_active"), True),
    }

    for key, value in optional_values.items():
        if key in columns:
            insert_data[key] = value

    keys = list(insert_data.keys())
    result = await db.execute(
        text(
            f"""
            INSERT INTO {table_name} ({', '.join(keys)})
            VALUES ({', '.join(f':{key}' for key in keys)})
            RETURNING *
            """
        ),
        insert_data,
    )
    await db.commit()

    row = result.mappings().first()
    return serialize_category_row(row, columns)


@router.put("/categories/{category_id}")
async def update_category(
    category_id: int,
    payload: dict,
    _: User = Depends(require_categories_manage),
    db: AsyncSession = Depends(get_db),
):
    table_name = await get_categories_table_name(db)
    columns = await get_table_columns(db, table_name)

    current = await db.execute(text(f"SELECT * FROM {table_name} WHERE id = :id LIMIT 1"), {"id": category_id})
    current_row = current.mappings().first()
    if not current_row:
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = {
        "name_ar": clean_text(payload.get("name_ar")),
        "name_en": clean_text(payload.get("name_en")),
        "slug": clean_text(payload.get("slug")),
        "description_ar": clean_text(payload.get("description_ar")),
        "description_en": clean_text(payload.get("description_en")),
        "image_url": clean_text(payload.get("image_url")),
        "banner_image_url": clean_text(payload.get("banner_image_url")),
        "sort_order": normalize_int(payload.get("sort_order"), "sort_order"),
        "is_active": normalize_bool(payload.get("is_active"), True),
    }

    final_data = {}
    for key, value in update_data.items():
        if key in columns:
            final_data[key] = value

    if not final_data.get("name_ar"):
        raise HTTPException(status_code=400, detail="name_ar is required")
    if not final_data.get("slug"):
        raise HTTPException(status_code=400, detail="slug is required")

    duplicate_slug = await db.execute(
        text(f"SELECT id FROM {table_name} WHERE slug = :slug AND id != :id LIMIT 1"),
        {"slug": final_data["slug"], "id": category_id},
    )
    if duplicate_slug.first():
        raise HTTPException(status_code=409, detail="Slug already exists")

    assignments = ", ".join(f"{key} = :{key}" for key in final_data.keys())
    result = await db.execute(
        text(
            f"""
            UPDATE {table_name}
            SET {assignments}
            WHERE id = :id
            RETURNING *
            """
        ),
        {**final_data, "id": category_id},
    )
    await db.commit()

    row = result.mappings().first()
    return serialize_category_row(row, columns)


@router.delete("/categories/{category_id}")
async def delete_category(
    category_id: int,
    _: User = Depends(require_categories_manage),
    db: AsyncSession = Depends(get_db),
):
    table_name = await get_categories_table_name(db)

    current = await db.execute(text(f"SELECT id FROM {table_name} WHERE id = :id LIMIT 1"), {"id": category_id})
    if not current.first():
        raise HTTPException(status_code=404, detail="Category not found")

    linked = await db.execute(
        text("SELECT id FROM products WHERE category_id = :category_id LIMIT 1"),
        {"category_id": category_id},
    )
    if linked.first():
        raise HTTPException(status_code=409, detail="Cannot delete category with linked products")

    await db.execute(text(f"DELETE FROM {table_name} WHERE id = :id"), {"id": category_id})
    await db.commit()
    return {"ok": True}


@router.get("/products")
async def list_products(
    current_user: User = Depends(require_products_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_industrial_tables(db)

    columns = await get_table_columns(db, "products")
    if not columns:
        raise HTTPException(status_code=500, detail="Products table not found")

    where_parts = []
    scoped_factory_id = get_user_factory_scope_id(current_user)

    if is_factory_scoped_user(current_user):
        if scoped_factory_id is None:
            raise HTTPException(status_code=403, detail="Factory scope is required")
        where_parts.append("p.factory_id = :factory_id")

    sql = f"""
        SELECT p.*, f.name AS factory_name
        FROM products p
        LEFT JOIN factories f ON f.id = p.factory_id
        {"WHERE " + " AND ".join(where_parts) if where_parts else ""}
        ORDER BY p.id DESC
    """

    result = await db.execute(text(sql), {"factory_id": scoped_factory_id} if where_parts else {})
    rows = result.mappings().all()

    output = []
    for row in rows:
        product_id = int(row["id"])
        bom_items = await fetch_product_bom_items(db, product_id)
        routing_steps = await fetch_product_routing_steps(db, product_id)
        variants = await fetch_product_variants(db, product_id)
        gallery_items = await fetch_product_gallery_items(db, product_id)
        output.append(
            serialize_product_row(
                row,
                columns,
                bom_items=bom_items,
                routing_steps=routing_steps,
                variants=variants,
                gallery_items=gallery_items,
            )
        )

    return output


@router.get("/products/{product_id}")
async def get_product(
    product_id: int,
    current_user: User = Depends(require_products_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_industrial_tables(db)
    row = await fetch_product_or_404(db, product_id)
    enforce_factory_scope(current_user, row.get("factory_id"))

    columns = await get_table_columns(db, "products")
    bom_items = await fetch_product_bom_items(db, product_id)
    routing_steps = await fetch_product_routing_steps(db, product_id)
    variants = await fetch_product_variants(db, product_id)
    gallery_items = await fetch_product_gallery_items(db, product_id)
    return serialize_product_row(
        row,
        columns,
        bom_items=bom_items,
        routing_steps=routing_steps,
        variants=variants,
        gallery_items=gallery_items,
    )


@router.post("/products", status_code=status.HTTP_201_CREATED)
async def create_product(
    payload: dict,
    current_user: User = Depends(require_products_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_industrial_tables(db)
    columns = await get_table_columns(db, "products")
    if not columns:
        raise HTTPException(status_code=500, detail="Products table not found")

    target_factory_id = await resolve_target_factory_id_for_create(db, current_user, payload)
    category_id = normalize_int(payload.get("category_id"), "category_id")
    if not category_id or not await ensure_category_exists(db, category_id):
        raise HTTPException(status_code=404, detail="Category not found")

    insert_data = build_product_payload(payload, columns, target_factory_id)

    duplicate_slug = await db.execute(
        text("SELECT id FROM products WHERE slug = :slug LIMIT 1"),
        {"slug": insert_data.get("slug")},
    )
    if duplicate_slug.first():
        raise HTTPException(status_code=409, detail="Slug already exists")

    duplicate_sku = await db.execute(
        text("SELECT id FROM products WHERE sku = :sku LIMIT 1"),
        {"sku": insert_data.get("sku")},
    )
    if duplicate_sku.first():
        raise HTTPException(status_code=409, detail="SKU already exists")

    gallery_items = payload.get("gallery_items") or []
    if not isinstance(gallery_items, list):
        raise HTTPException(status_code=400, detail="gallery_items must be an array")

    normalized_gallery_preview = [_normalize_gallery_item(item, index) for index, item in enumerate(gallery_items)]
    if normalized_gallery_preview:
        primary_gallery_url = None
        for item in normalized_gallery_preview:
            if item["is_primary"]:
                primary_gallery_url = item["file_url"]
                break
        if primary_gallery_url:
            if "primary_image_url" in columns and not insert_data.get("primary_image_url"):
                insert_data["primary_image_url"] = primary_gallery_url
            if "preview_image_url" in columns and not insert_data.get("preview_image_url"):
                insert_data["preview_image_url"] = primary_gallery_url

    keys = list(insert_data.keys())
    result = await db.execute(
        text(
            f"""
            INSERT INTO products ({', '.join(keys)})
            VALUES ({', '.join(f':{key}' for key in keys)})
            RETURNING *
            """
        ),
        insert_data,
    )
    row = result.mappings().first()
    product_id = int(row["id"])

    bom_items = payload.get("bom_items") or []
    routing_steps = payload.get("routing_steps") or []
    variants = payload.get("variants") or []

    if not isinstance(bom_items, list):
        raise HTTPException(status_code=400, detail="bom_items must be an array")
    if not isinstance(routing_steps, list):
        raise HTTPException(status_code=400, detail="routing_steps must be an array")
    if not isinstance(variants, list):
        raise HTTPException(status_code=400, detail="variants must be an array")

    await replace_product_bom_items(db, product_id, bom_items)
    await replace_product_routing_steps(db, product_id, routing_steps)
    await replace_product_variants(db, product_id, variants)
    await replace_product_gallery_items(db, product_id, gallery_items)
    await db.commit()

    fresh = await fetch_product_or_404(db, product_id)
    bom_items = await fetch_product_bom_items(db, product_id)
    routing_steps = await fetch_product_routing_steps(db, product_id)
    variants = await fetch_product_variants(db, product_id)
    gallery_items = await fetch_product_gallery_items(db, product_id)
    return serialize_product_row(
        fresh,
        columns,
        bom_items=bom_items,
        routing_steps=routing_steps,
        variants=variants,
        gallery_items=gallery_items,
    )


@router.put("/products/{product_id}")
async def update_product(
    product_id: int,
    payload: dict,
    current_user: User = Depends(require_products_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_industrial_tables(db)
    current = await fetch_product_or_404(db, product_id)
    enforce_factory_scope(current_user, current.get("factory_id"))

    columns = await get_table_columns(db, "products")
    target_factory_id = current.get("factory_id")

    if not is_factory_scoped_user(current_user):
        requested_factory_id = resolve_requested_factory_id(payload)
        if requested_factory_id is not None:
            if not await ensure_factory_exists(db, requested_factory_id):
                raise HTTPException(status_code=404, detail="Factory not found")
            target_factory_id = requested_factory_id

    category_id = normalize_int(payload.get("category_id"), "category_id")
    if not category_id or not await ensure_category_exists(db, category_id):
        raise HTTPException(status_code=404, detail="Category not found")

    update_data = build_product_payload(payload, columns, int(target_factory_id))

    duplicate_slug = await db.execute(
        text("SELECT id FROM products WHERE slug = :slug AND id != :id LIMIT 1"),
        {"slug": update_data.get("slug"), "id": product_id},
    )
    if duplicate_slug.first():
        raise HTTPException(status_code=409, detail="Slug already exists")

    duplicate_sku = await db.execute(
        text("SELECT id FROM products WHERE sku = :sku AND id != :id LIMIT 1"),
        {"sku": update_data.get("sku"), "id": product_id},
    )
    if duplicate_sku.first():
        raise HTTPException(status_code=409, detail="SKU already exists")

    gallery_items = payload.get("gallery_items") if "gallery_items" in payload else None
    if gallery_items is not None and not isinstance(gallery_items, list):
        raise HTTPException(status_code=400, detail="gallery_items must be an array")

    normalized_gallery_preview = None
    if gallery_items is not None:
        normalized_gallery_preview = [_normalize_gallery_item(item, index) for index, item in enumerate(gallery_items)]
        if normalized_gallery_preview:
            primary_gallery_url = None
            for item in normalized_gallery_preview:
                if item["is_primary"]:
                    primary_gallery_url = item["file_url"]
                    break
            if primary_gallery_url:
                if "primary_image_url" in columns:
                    update_data["primary_image_url"] = primary_gallery_url
                if "preview_image_url" in columns:
                    update_data["preview_image_url"] = primary_gallery_url

    assignments = ", ".join(f"{key} = :{key}" for key in update_data.keys())
    await db.execute(
        text(
            f"""
            UPDATE products
            SET {assignments}
            WHERE id = :id
            """
        ),
        {**update_data, "id": product_id},
    )

    bom_items = payload.get("bom_items") if "bom_items" in payload else None
    routing_steps = payload.get("routing_steps") if "routing_steps" in payload else None
    variants = payload.get("variants") if "variants" in payload else None

    if bom_items is not None:
        if not isinstance(bom_items, list):
            raise HTTPException(status_code=400, detail="bom_items must be an array")
        await replace_product_bom_items(db, product_id, bom_items)

    if routing_steps is not None:
        if not isinstance(routing_steps, list):
            raise HTTPException(status_code=400, detail="routing_steps must be an array")
        await replace_product_routing_steps(db, product_id, routing_steps)

    if variants is not None:
        if not isinstance(variants, list):
            raise HTTPException(status_code=400, detail="variants must be an array")
        await replace_product_variants(db, product_id, variants)

    if gallery_items is not None:
        await replace_product_gallery_items(db, product_id, gallery_items)

    await db.commit()

    fresh = await fetch_product_or_404(db, product_id)
    bom_items = await fetch_product_bom_items(db, product_id)
    routing_steps = await fetch_product_routing_steps(db, product_id)
    variants = await fetch_product_variants(db, product_id)
    gallery_items = await fetch_product_gallery_items(db, product_id)
    return serialize_product_row(
        fresh,
        columns,
        bom_items=bom_items,
        routing_steps=routing_steps,
        variants=variants,
        gallery_items=gallery_items,
    )


@router.delete("/products/{product_id}")
async def delete_product(
    product_id: int,
    current_user: User = Depends(require_products_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_industrial_tables(db)
    current = await fetch_product_or_404(db, product_id)
    enforce_factory_scope(current_user, current.get("factory_id"))

    linked_orders = await db.execute(
        text("SELECT id FROM customer_order_items WHERE product_id = :product_id LIMIT 1"),
        {"product_id": product_id},
    )
    if linked_orders.first():
        raise HTTPException(status_code=409, detail="Cannot delete product linked to orders")

    linked_movements = await db.execute(
        text("SELECT id FROM inventory_movements WHERE product_id = :product_id LIMIT 1"),
        {"product_id": product_id},
    )
    if linked_movements.first():
        raise HTTPException(status_code=409, detail="Cannot delete product linked to inventory movements")

    await db.execute(text("DELETE FROM product_media WHERE product_id = :product_id"), {"product_id": product_id})
    await db.execute(text("DELETE FROM product_variants WHERE product_id = :product_id"), {"product_id": product_id})
    await db.execute(text("DELETE FROM product_bom_items WHERE product_id = :product_id"), {"product_id": product_id})
    await db.execute(text("DELETE FROM product_routing_steps WHERE product_id = :product_id"), {"product_id": product_id})
    await db.execute(text("DELETE FROM products WHERE id = :product_id"), {"product_id": product_id})
    await db.commit()
    return {"ok": True}
