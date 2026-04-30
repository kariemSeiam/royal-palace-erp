from fastapi import APIRouter, HTTPException, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.db.session import get_db

router = APIRouter(prefix="/catalog", tags=["catalog"])


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


async def fetch_gallery_map(db: AsyncSession, product_ids: list[int]) -> dict[int, list[str]]:
    if not product_ids:
        return {}

    if not await get_table_exists(db, "product_media"):
        return {}

    result = await db.execute(
        text(
            """
            SELECT
                product_id,
                file_url,
                sort_order,
                is_primary
            FROM product_media
            WHERE product_id = ANY(:product_ids)
              AND media_type = 'image'
              AND file_url IS NOT NULL
              AND TRIM(file_url) <> ''
            ORDER BY product_id ASC, is_primary DESC, sort_order ASC, id ASC
            """
        ),
        {"product_ids": product_ids},
    )

    gallery_map: dict[int, list[str]] = {}
    for row in result.mappings().all():
        product_id = int(row["product_id"])
        file_url = str(row["file_url"]).strip()
        if not file_url:
            continue
        gallery_map.setdefault(product_id, [])
        if file_url not in gallery_map[product_id]:
            gallery_map[product_id].append(file_url)

    return gallery_map


def _resolve_primary_image(row: dict, gallery_images: list[str], columns: set[str]) -> str | None:
    candidates = []
    if "primary_image_url" in columns:
        candidates.append(row.get("primary_image_url"))
    if "preview_image_url" in columns:
        candidates.append(row.get("preview_image_url"))
    candidates.extend(gallery_images)

    for candidate in candidates:
        if isinstance(candidate, str) and candidate.strip():
            return candidate.strip()
    return None


def row_to_product(row: dict, columns: set[str], gallery_images: list[str] | None = None) -> dict:
    safe_gallery = []
    for image in gallery_images or []:
        if isinstance(image, str) and image.strip() and image.strip() not in safe_gallery:
            safe_gallery.append(image.strip())

    primary_image = _resolve_primary_image(row, safe_gallery, columns)

    if primary_image and primary_image not in safe_gallery:
        safe_gallery = [primary_image, *safe_gallery]

    return {
        "id": row.get("id"),
        "name_ar": row.get("name_ar"),
        "name_en": row.get("name_en") if "name_en" in columns else None,
        "name": row.get("name_ar") or row.get("name_en") or row.get("slug"),
        "slug": row.get("slug"),
        "sku": row.get("sku"),
        "factory_id": row.get("factory_id") if "factory_id" in columns else None,
        "category_id": row.get("category_id"),
        "base_price": str(row.get("base_price")) if row.get("base_price") is not None else None,
        "price": str(row.get("base_price")) if row.get("base_price") is not None else None,
        "currency": "EGP",
        "is_featured": bool(row.get("is_featured")) if "is_featured" in columns and row.get("is_featured") is not None else False,
        "ar_enabled": bool(row.get("ar_enabled")) if "ar_enabled" in columns and row.get("ar_enabled") is not None else False,
        "is_active": bool(row.get("is_active")) if "is_active" in columns and row.get("is_active") is not None else True,
        "is_published": bool(row.get("is_published")) if "is_published" in columns and row.get("is_published") is not None else True,
        "primary_image_url": row.get("primary_image_url") if "primary_image_url" in columns else primary_image,
        "preview_image_url": row.get("preview_image_url") if "preview_image_url" in columns else primary_image,
        "image_url": primary_image,
        "gallery_images": safe_gallery,
        "description_ar": row.get("description_ar") if "description_ar" in columns else None,
        "description_en": row.get("description_en") if "description_en" in columns else None,
        "description": row.get("description_ar") or row.get("description_en"),
        "short_description": row.get("description_ar") or row.get("description_en"),
        "technical_specifications": row.get("technical_specifications") if "technical_specifications" in columns else None,
        "specifications": row.get("specifications") if "specifications" in columns else None,
        "materials": row.get("materials") if "materials" in columns else None,
        "dimensions": row.get("dimensions") if "dimensions" in columns else None,
        "color_options": row.get("color_options") if "color_options" in columns else None,
        "glb_url": row.get("glb_url") if "glb_url" in columns else None,
        "glb_model_url": row.get("glb_model_url") if "glb_model_url" in columns else None,
        "usdz_url": row.get("usdz_url") if "usdz_url" in columns else None,
        "usdz_model_url": row.get("usdz_model_url") if "usdz_model_url" in columns else None,
    }


def row_to_category(row: dict, columns: set[str]) -> dict:
    return {
        "id": row.get("id"),
        "name_ar": row.get("name_ar"),
        "name_en": row.get("name_en") if "name_en" in columns else None,
        "name": row.get("name_ar") or row.get("name_en") or row.get("slug"),
        "slug": row.get("slug"),
        "description_ar": row.get("description_ar") if "description_ar" in columns else None,
        "description_en": row.get("description_en") if "description_en" in columns else None,
        "description": row.get("description_ar") or row.get("description_en"),
        "image_url": row.get("image_url") if "image_url" in columns else None,
        "banner_image_url": row.get("banner_image_url") if "banner_image_url" in columns else None,
        "sort_order": row.get("sort_order") if "sort_order" in columns else 0,
        "is_active": bool(row.get("is_active")) if "is_active" in columns and row.get("is_active") is not None else True,
    }


@router.get("/categories")
async def list_categories(db: AsyncSession = Depends(get_db)):
    table_name = await get_categories_table_name(db)
    columns = await get_table_columns(db, table_name)

    select_fields = ["id", "name_ar", "slug"]
    optional_fields = ["name_en", "description_ar", "description_en", "image_url", "banner_image_url", "sort_order", "is_active"]

    for field in optional_fields:
        if field in columns:
            select_fields.append(field)

    where_parts = []
    if "is_active" in columns:
        where_parts.append("is_active = true")

    where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""
    order_by = "sort_order ASC, id ASC" if "sort_order" in columns else "id ASC"

    result = await db.execute(
        text(
            f"""
            SELECT {', '.join(select_fields)}
            FROM {table_name}
            {where_clause}
            ORDER BY {order_by}
            """
        )
    )
    rows = result.mappings().all()
    return [row_to_category(dict(row), columns) for row in rows]


@router.get("/products")
async def list_products(db: AsyncSession = Depends(get_db)):
    columns = await get_table_columns(db, "products")
    if not columns:
        raise HTTPException(status_code=500, detail="Products table not found")

    select_fields = [
        "id",
        "name_ar",
        "slug",
        "sku",
        "factory_id",
        "category_id",
        "base_price",
    ]

    optional_fields = [
        "name_en",
        "is_featured",
        "ar_enabled",
        "is_active",
        "is_published",
        "primary_image_url",
        "preview_image_url",
        "description_ar",
        "description_en",
        "technical_specifications",
        "specifications",
        "materials",
        "dimensions",
        "color_options",
        "glb_url",
        "glb_model_url",
        "usdz_url",
        "usdz_model_url",
    ]

    for field in optional_fields:
        if field in columns:
            select_fields.append(field)

    where_parts = []
    if "is_active" in columns:
        where_parts.append("is_active = true")
    if "is_published" in columns:
        where_parts.append("is_published = true")

    where_clause = f"WHERE {' AND '.join(where_parts)}" if where_parts else ""

    sql = f"""
        SELECT {', '.join(select_fields)}
        FROM products
        {where_clause}
        ORDER BY id DESC
    """

    result = await db.execute(text(sql))
    rows = result.mappings().all()

    product_ids = [int(row["id"]) for row in rows]
    gallery_map = await fetch_gallery_map(db, product_ids)

    return [
        row_to_product(dict(row), columns, gallery_map.get(int(row["id"]), []))
        for row in rows
    ]


@router.get("/products/{slug}")
async def product_details(slug: str, db: AsyncSession = Depends(get_db)):
    columns = await get_table_columns(db, "products")
    if not columns:
        raise HTTPException(status_code=500, detail="Products table not found")

    select_fields = ["id"]
    for field in [
        "name_ar",
        "name_en",
        "slug",
        "sku",
        "factory_id",
        "category_id",
        "base_price",
        "is_featured",
        "ar_enabled",
        "is_active",
        "is_published",
        "primary_image_url",
        "preview_image_url",
        "description_ar",
        "description_en",
        "technical_specifications",
        "specifications",
        "materials",
        "dimensions",
        "color_options",
        "glb_url",
        "glb_model_url",
        "usdz_url",
        "usdz_model_url",
    ]:
        if field in columns:
            select_fields.append(field)

    sql = f"""
        SELECT {', '.join(select_fields)}
        FROM products
        WHERE slug = :slug OR CAST(id AS TEXT) = :slug
        LIMIT 1
    """

    try:
        result = await db.execute(text(sql), {"slug": slug})
        row = result.mappings().first()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Product details query failed: {exc}")

    if not row:
        raise HTTPException(status_code=404, detail="Product not found")

    gallery_map = await fetch_gallery_map(db, [int(row["id"])])
    product = row_to_product(dict(row), columns, gallery_map.get(int(row["id"]), []))

    if ("is_active" in columns and not product["is_active"]) or ("is_published" in columns and not product["is_published"]):
        raise HTTPException(status_code=404, detail="Product not found")

    return product
