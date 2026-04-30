from __future__ import annotations

import json
import os
import socket
from datetime import datetime, timezone
from urllib.request import Request, urlopen
from urllib.error import URLError, HTTPError

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import get_current_user_and_role, ensure_not_blocked_admin_role, has_any_permission
from src.core.config.settings import settings
from src.core.db.session import get_db
from src.models.user import User, Role

router = APIRouter(prefix="/admin/it", tags=["admin-it"])

LIVE_PATHS = {
    "project_root": "/opt/royal-palace-erp",
    "api_app": "/opt/royal-palace-erp/apps/api",
    "admin_web_app": "/opt/royal-palace-erp/apps/admin-web",
    "store_web_app": "/opt/royal-palace-erp/apps/store-web",
    "compose_file": "/opt/royal-palace-erp/infra/compose/docker-compose.yml",
    "backups_dir": "/opt/royal-palace-erp/backups",
    "logs_dir": "/opt/royal-palace-erp/logs",
    "uploads_dir": "/opt/royal-palace-erp/uploads",
}

SERVICE_TARGETS = [
    {
        "key": "api",
        "label": "API",
        "type": "http",
        "url": "http://127.0.0.1:8000/health/live",
        "expected_statuses": [200],
        "note": "FastAPI live probe from inside api container",
    },
    {
        "key": "postgres",
        "label": "PostgreSQL",
        "type": "tcp",
        "host": settings.POSTGRES_HOST,
        "port": settings.POSTGRES_PORT,
        "note": "TCP probe to configured PostgreSQL host",
    },
    {
        "key": "redis",
        "label": "Redis",
        "type": "tcp",
        "host": settings.REDIS_HOST,
        "port": settings.REDIS_PORT,
        "note": "TCP probe to configured Redis host",
    },
    {
        "key": "admin_web",
        "label": "Admin Web",
        "type": "http",
        "url": "http://admin_web:3000/login",
        "expected_statuses": [200, 307, 308],
        "note": "HTTP probe to Next.js admin service on compose network",
    },
    {
        "key": "store_web",
        "label": "Store Web",
        "type": "http",
        "url": "http://store_web:3000/",
        "expected_statuses": [200, 307, 308],
        "note": "HTTP probe to Next.js store service on compose network",
    },
]


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _path_info(path: str) -> dict:
    exists = os.path.exists(path)
    payload = {
        "path": path,
        "exists_from_api_container": exists,
        "is_dir": os.path.isdir(path) if exists else False,
        "is_file": os.path.isfile(path) if exists else False,
    }
    if exists:
        try:
            stat = os.stat(path)
            payload["modified_at"] = datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat()
            payload["size_bytes"] = int(stat.st_size)
        except Exception:
            payload["modified_at"] = None
            payload["size_bytes"] = None
    else:
        payload["modified_at"] = None
        payload["size_bytes"] = None
    return payload


def _tcp_probe(host: str, port: int, timeout: float = 1.5) -> dict:
    started_at = _utc_now_iso()
    try:
        with socket.create_connection((host, int(port)), timeout=timeout):
            return {
                "status": "up",
                "started_at": started_at,
                "checked_at": _utc_now_iso(),
                "host": host,
                "port": int(port),
                "detail": "TCP connection successful",
            }
    except Exception as exc:
        return {
            "status": "down",
            "started_at": started_at,
            "checked_at": _utc_now_iso(),
            "host": host,
            "port": int(port),
            "detail": str(exc),
        }


def _http_probe(url: str, expected_statuses: list[int] | None = None, timeout: float = 2.5) -> dict:
    expected = expected_statuses or [200]
    started_at = _utc_now_iso()
    try:
        req = Request(url, headers={"User-Agent": "royal-palace-it-probe/1.0"})
        with urlopen(req, timeout=timeout) as response:
            status_code = int(response.status)
            return {
                "status": "up" if status_code in expected else "degraded",
                "started_at": started_at,
                "checked_at": _utc_now_iso(),
                "url": url,
                "status_code": status_code,
                "detail": "HTTP probe completed",
            }
    except HTTPError as exc:
        status_code = int(getattr(exc, "code", 0) or 0)
        return {
            "status": "up" if status_code in expected else "down",
            "started_at": started_at,
            "checked_at": _utc_now_iso(),
            "url": url,
            "status_code": status_code,
            "detail": f"HTTP error: {exc}",
        }
    except URLError as exc:
        return {
            "status": "down",
            "started_at": started_at,
            "checked_at": _utc_now_iso(),
            "url": url,
            "status_code": None,
            "detail": f"URL error: {exc}",
        }
    except Exception as exc:
        return {
            "status": "down",
            "started_at": started_at,
            "checked_at": _utc_now_iso(),
            "url": url,
            "status_code": None,
            "detail": str(exc),
        }


def _authorize_it_access(user: User, role: Role | None, permissions: set[str], required_codes: tuple[str, ...]) -> User:
    ensure_not_blocked_admin_role(role)

    if user.is_superuser:
        return user

    if not has_any_permission(permissions, *required_codes):
        raise HTTPException(status_code=403, detail="IT access denied")

    return user


async def _db_probe(db: AsyncSession) -> dict:
    started_at = _utc_now_iso()
    try:
        result = await db.execute(text("SELECT 1 AS ok"))
        ok = result.scalar()
        return {
            "status": "up" if int(ok or 0) == 1 else "degraded",
            "started_at": started_at,
            "checked_at": _utc_now_iso(),
            "detail": "Database query completed",
        }
    except Exception as exc:
        return {
            "status": "down",
            "started_at": started_at,
            "checked_at": _utc_now_iso(),
            "detail": str(exc),
        }


async def _erp_counts(db: AsyncSession) -> dict:
    queries = {
        "users_count": "SELECT COUNT(*) FROM users",
        "roles_count": "SELECT COUNT(*) FROM roles",
        "factories_count": "SELECT COUNT(*) FROM factories",
        "departments_count": "SELECT COUNT(*) FROM departments",
        "employees_count": "SELECT COUNT(*) FROM employees",
        "attendance_count": "SELECT COUNT(*) FROM attendance_logs",
        "products_count": "SELECT COUNT(*) FROM products",
        "categories_count": "SELECT COUNT(*) FROM product_categories",
        "orders_count": "SELECT COUNT(*) FROM customer_orders",
        "b2b_accounts_count": "SELECT COUNT(*) FROM business_accounts",
    }

    counts = {}
    for key, sql in queries.items():
        try:
            result = await db.execute(text(sql))
            counts[key] = int(result.scalar() or 0)
        except Exception:
            counts[key] = 0
    return counts


async def _permission_catalog_counts(db: AsyncSession) -> dict:
    queries = {
        "it_permissions": """
            SELECT COUNT(*)
            FROM admin_permissions_catalog
            WHERE code LIKE 'it.%'
        """,
        "infra_permissions": """
            SELECT COUNT(*)
            FROM admin_permissions_catalog
            WHERE
                code LIKE 'infrastructure.%'
                OR code LIKE 'servers.%'
                OR code LIKE 'backups.%'
                OR code LIKE 'logs.%'
                OR code LIKE 'monitoring.%'
                OR code LIKE 'deployments.%'
        """,
        "digital_governance_permissions": """
            SELECT COUNT(*)
            FROM admin_permissions_catalog
            WHERE
                code LIKE 'media.%'
                OR code LIKE 'themes.%'
                OR code LIKE 'branding.%'
                OR code LIKE 'pages.%'
                OR code LIKE 'layout.%'
                OR code LIKE 'ui_settings.%'
                OR code LIKE 'global_settings.%'
                OR code LIKE 'catalog.%'
        """,
    }

    result_payload = {}
    for key, sql in queries.items():
        try:
            result = await db.execute(text(sql))
            result_payload[key] = int(result.scalar() or 0)
        except Exception:
            result_payload[key] = 0
    return result_payload


async def _ensure_governance_tables(db: AsyncSession):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS admin_media_assets (
            id SERIAL PRIMARY KEY,
            title VARCHAR(255) NOT NULL,
            asset_type VARCHAR(100) NOT NULL DEFAULT 'image',
            file_url TEXT,
            purpose VARCHAR(150),
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            sort_order INTEGER NOT NULL DEFAULT 0,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        )
    """))

    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS admin_theme_settings (
            id SERIAL PRIMARY KEY,
            theme_name VARCHAR(120) NOT NULL DEFAULT 'royal_palace',
            primary_color VARCHAR(30) NOT NULL DEFAULT '#0b1f4d',
            secondary_color VARCHAR(30) NOT NULL DEFAULT '#c9a66b',
            accent_color VARCHAR(30) NOT NULL DEFAULT '#2563eb',
            surface_color VARCHAR(30) NOT NULL DEFAULT '#ffffff',
            text_color VARCHAR(30) NOT NULL DEFAULT '#111827',
            is_rtl BOOLEAN NOT NULL DEFAULT TRUE,
            font_family VARCHAR(150) NOT NULL DEFAULT 'system-ui',
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        )
    """))

    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS admin_branding_settings (
            id SERIAL PRIMARY KEY,
            brand_name_ar VARCHAR(255) NOT NULL DEFAULT 'رويال بالاس',
            brand_name_en VARCHAR(255) NOT NULL DEFAULT 'Royal Palace',
            logo_url TEXT,
            icon_url TEXT,
            support_email VARCHAR(255),
            support_phone VARCHAR(100),
            company_address TEXT,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        )
    """))

    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS admin_ui_settings (
            id SERIAL PRIMARY KEY,
            admin_title_ar VARCHAR(255) NOT NULL DEFAULT 'بوابة الإدارة التنفيذية',
            admin_title_en VARCHAR(255) NOT NULL DEFAULT 'Executive Admin Portal',
            dashboard_layout VARCHAR(100) NOT NULL DEFAULT 'executive',
            cards_density VARCHAR(50) NOT NULL DEFAULT 'comfortable',
            enable_animations BOOLEAN NOT NULL DEFAULT TRUE,
            sidebar_style VARCHAR(50) NOT NULL DEFAULT 'default',
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        )
    """))

    await db.execute(text("""
        INSERT INTO admin_theme_settings
            (theme_name, primary_color, secondary_color, accent_color, surface_color, text_color, is_rtl, font_family)
        SELECT
            'royal_palace', '#0b1f4d', '#c9a66b', '#2563eb', '#ffffff', '#111827', TRUE, 'system-ui'
        WHERE NOT EXISTS (SELECT 1 FROM admin_theme_settings)
    """))

    await db.execute(text("""
        INSERT INTO admin_branding_settings
            (brand_name_ar, brand_name_en, logo_url, icon_url, support_email, support_phone, company_address)
        SELECT
            'رويال بالاس',
            'Royal Palace',
            NULL,
            NULL,
            'support@royalpalace-group.com',
            NULL,
            NULL
        WHERE NOT EXISTS (SELECT 1 FROM admin_branding_settings)
    """))

    await db.execute(text("""
        INSERT INTO admin_ui_settings
            (admin_title_ar, admin_title_en, dashboard_layout, cards_density, enable_animations, sidebar_style)
        SELECT
            'بوابة الإدارة التنفيذية',
            'Executive Admin Portal',
            'executive',
            'comfortable',
            TRUE,
            'default'
        WHERE NOT EXISTS (SELECT 1 FROM admin_ui_settings)
    """))

    await db.commit()


def _normalize_bool(value, default=False):
    if value is None:
        return default
    if isinstance(value, bool):
        return value
    if isinstance(value, (int, float)):
        return bool(value)
    if isinstance(value, str):
        return value.strip().lower() in ["1", "true", "yes", "y", "on", "نعم"]
    return default


def _clean_text(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


@router.get("/overview")
async def get_it_overview(
    actor=Depends(get_current_user_and_role),
    db: AsyncSession = Depends(get_db),
):
    user, role, permissions = actor
    _authorize_it_access(
        user,
        role,
        permissions,
        (
            "it.view",
            "it.manage",
            "infrastructure.view",
            "infrastructure.manage",
            "servers.view",
            "servers.manage",
            "logs.view",
            "monitoring.view",
            "deployments.view",
            "deployments.manage",
            "backups.view",
            "backups.manage",
        ),
    )

    services = []
    for item in SERVICE_TARGETS:
        if item["type"] == "tcp":
            probe = _tcp_probe(item["host"], item["port"])
        else:
            probe = _http_probe(item["url"], item.get("expected_statuses"))

        services.append(
            {
                "key": item["key"],
                "label": item["label"],
                "type": item["type"],
                "note": item["note"],
                **probe,
            }
        )

    db_status = await _db_probe(db)
    counts = await _erp_counts(db)
    permission_counts = await _permission_catalog_counts(db)

    visible_paths = {
        "project_root": _path_info(LIVE_PATHS["project_root"]),
        "compose_file": _path_info(LIVE_PATHS["compose_file"]),
        "logs_dir": _path_info(LIVE_PATHS["logs_dir"]),
        "uploads_dir": _path_info(LIVE_PATHS["uploads_dir"]),
        "backups_dir": _path_info(LIVE_PATHS["backups_dir"]),
    }

    return {
        "generated_at": _utc_now_iso(),
        "scope": {
            "is_superuser": bool(user.is_superuser),
            "factory_id": getattr(user, "factory_id", None),
            "role_id": getattr(role, "id", None) if role else None,
            "role_code": getattr(role, "code", None) if role else None,
        },
        "live_paths": LIVE_PATHS,
        "path_visibility": visible_paths,
        "database_probe": db_status,
        "service_probes": services,
        "summary_counts": counts,
        "permission_catalog_counts": permission_counts,
    }


@router.get("/backups")
async def get_backups_overview(
    actor=Depends(get_current_user_and_role),
    db: AsyncSession = Depends(get_db),
):
    user, role, permissions = actor
    _authorize_it_access(
        user,
        role,
        permissions,
        (
            "it.view",
            "it.manage",
            "backups.view",
            "backups.manage",
            "infrastructure.view",
            "infrastructure.manage",
        ),
    )

    backups_path = LIVE_PATHS["backups_dir"]
    path_info = _path_info(backups_path)

    entries = []
    if path_info["exists_from_api_container"] and path_info["is_dir"]:
        try:
            for name in sorted(os.listdir(backups_path), reverse=True)[:20]:
                full_path = os.path.join(backups_path, name)
                item = _path_info(full_path)
                item["name"] = name
                entries.append(item)
        except Exception as exc:
            entries.append(
                {
                    "name": "__error__",
                    "path": backups_path,
                    "exists_from_api_container": True,
                    "is_dir": True,
                    "is_file": False,
                    "modified_at": None,
                    "size_bytes": None,
                    "detail": str(exc),
                }
            )

    db_status = await _db_probe(db)

    return {
        "generated_at": _utc_now_iso(),
        "configured_backups_path": backups_path,
        "backups_path_visibility": path_info,
        "visible_entries": entries,
        "database_probe": db_status,
        "notes": [
            "هذه القراءة تعكس ما هو ظاهر من داخل حاوية API الحالية.",
            "إذا كان مجلد النسخ الاحتياطية غير mounted داخل الحاوية فسيظهر كغير مرئي رغم وجوده على السيرفر.",
            "يمكن لاحقًا توسيع الربط إلى backup jobs فعلية بدون تغيير مسارات المشروع.",
        ],
    }


@router.get("/governance/summary")
async def get_governance_summary(
    actor=Depends(get_current_user_and_role),
    db: AsyncSession = Depends(get_db),
):
    user, role, permissions = actor
    _authorize_it_access(
        user,
        role,
        permissions,
        (
            "it.view",
            "it.manage",
            "media.view",
            "media.manage",
            "themes.view",
            "themes.manage",
            "branding.view",
            "branding.manage",
            "ui_settings.manage",
            "global_settings.manage",
            "layout.manage",
        ),
    )

    await _ensure_governance_tables(db)

    media_count = await db.execute(text("SELECT COUNT(*) FROM admin_media_assets"))
    active_media_count = await db.execute(text("SELECT COUNT(*) FROM admin_media_assets WHERE is_active = TRUE"))
    theme_row = await db.execute(text("""
        SELECT theme_name, primary_color, secondary_color, accent_color, surface_color, text_color, is_rtl, font_family
        FROM admin_theme_settings
        ORDER BY id ASC
        LIMIT 1
    """))
    branding_row = await db.execute(text("""
        SELECT brand_name_ar, brand_name_en, logo_url, icon_url, support_email, support_phone, company_address
        FROM admin_branding_settings
        ORDER BY id ASC
        LIMIT 1
    """))
    ui_row = await db.execute(text("""
        SELECT admin_title_ar, admin_title_en, dashboard_layout, cards_density, enable_animations, sidebar_style
        FROM admin_ui_settings
        ORDER BY id ASC
        LIMIT 1
    """))

    return {
        "generated_at": _utc_now_iso(),
        "media_total": int(media_count.scalar() or 0),
        "media_active": int(active_media_count.scalar() or 0),
        "theme": dict(theme_row.mappings().first() or {}),
        "branding": dict(branding_row.mappings().first() or {}),
        "ui_settings": dict(ui_row.mappings().first() or {}),
    }


@router.get("/media")
async def list_media_assets(
    actor=Depends(get_current_user_and_role),
    db: AsyncSession = Depends(get_db),
):
    user, role, permissions = actor
    _authorize_it_access(
        user,
        role,
        permissions,
        ("it.view", "it.manage", "media.view", "media.manage"),
    )

    await _ensure_governance_tables(db)
    result = await db.execute(text("""
        SELECT id, title, asset_type, file_url, purpose, is_active, sort_order, created_at, updated_at
        FROM admin_media_assets
        ORDER BY sort_order ASC, id DESC
    """))
    return [dict(row) for row in result.mappings().all()]


@router.post("/media")
async def create_media_asset(
    payload: dict,
    actor=Depends(get_current_user_and_role),
    db: AsyncSession = Depends(get_db),
):
    user, role, permissions = actor
    _authorize_it_access(
        user,
        role,
        permissions,
        ("it.manage", "media.manage"),
    )

    await _ensure_governance_tables(db)

    title = _clean_text(payload.get("title"))
    asset_type = _clean_text(payload.get("asset_type")) or "image"
    file_url = _clean_text(payload.get("file_url"))
    purpose = _clean_text(payload.get("purpose"))
    is_active = _normalize_bool(payload.get("is_active"), True)
    sort_order = int(payload.get("sort_order") or 0)

    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    result = await db.execute(
        text("""
            INSERT INTO admin_media_assets (title, asset_type, file_url, purpose, is_active, sort_order)
            VALUES (:title, :asset_type, :file_url, :purpose, :is_active, :sort_order)
            RETURNING id
        """),
        {
            "title": title,
            "asset_type": asset_type,
            "file_url": file_url,
            "purpose": purpose,
            "is_active": is_active,
            "sort_order": sort_order,
        },
    )
    created_id = result.scalar_one()
    await db.commit()

    row = await db.execute(
        text("""
            SELECT id, title, asset_type, file_url, purpose, is_active, sort_order, created_at, updated_at
            FROM admin_media_assets
            WHERE id = :id
        """),
        {"id": created_id},
    )
    return dict(row.mappings().first())


@router.put("/media/{asset_id}")
async def update_media_asset(
    asset_id: int,
    payload: dict,
    actor=Depends(get_current_user_and_role),
    db: AsyncSession = Depends(get_db),
):
    user, role, permissions = actor
    _authorize_it_access(
        user,
        role,
        permissions,
        ("it.manage", "media.manage"),
    )

    await _ensure_governance_tables(db)

    existing = await db.execute(
        text("SELECT id FROM admin_media_assets WHERE id = :id"),
        {"id": asset_id},
    )
    if not existing.first():
        raise HTTPException(status_code=404, detail="Media asset not found")

    title = _clean_text(payload.get("title"))
    asset_type = _clean_text(payload.get("asset_type")) or "image"
    file_url = _clean_text(payload.get("file_url"))
    purpose = _clean_text(payload.get("purpose"))
    is_active = _normalize_bool(payload.get("is_active"), True)
    sort_order = int(payload.get("sort_order") or 0)

    if not title:
        raise HTTPException(status_code=400, detail="title is required")

    await db.execute(
        text("""
            UPDATE admin_media_assets
            SET title = :title,
                asset_type = :asset_type,
                file_url = :file_url,
                purpose = :purpose,
                is_active = :is_active,
                sort_order = :sort_order,
                updated_at = NOW()
            WHERE id = :id
        """),
        {
            "id": asset_id,
            "title": title,
            "asset_type": asset_type,
            "file_url": file_url,
            "purpose": purpose,
            "is_active": is_active,
            "sort_order": sort_order,
        },
    )
    await db.commit()

    row = await db.execute(
        text("""
            SELECT id, title, asset_type, file_url, purpose, is_active, sort_order, created_at, updated_at
            FROM admin_media_assets
            WHERE id = :id
        """),
        {"id": asset_id},
    )
    return dict(row.mappings().first())


@router.delete("/media/{asset_id}")
async def delete_media_asset(
    asset_id: int,
    actor=Depends(get_current_user_and_role),
    db: AsyncSession = Depends(get_db),
):
    user, role, permissions = actor
    _authorize_it_access(
        user,
        role,
        permissions,
        ("it.manage", "media.manage"),
    )

    await _ensure_governance_tables(db)

    existing = await db.execute(
        text("SELECT id FROM admin_media_assets WHERE id = :id"),
        {"id": asset_id},
    )
    if not existing.first():
        raise HTTPException(status_code=404, detail="Media asset not found")

    await db.execute(text("DELETE FROM admin_media_assets WHERE id = :id"), {"id": asset_id})
    await db.commit()
    return {"message": "Media asset deleted successfully"}


@router.get("/themes")
async def get_theme_settings(
    actor=Depends(get_current_user_and_role),
    db: AsyncSession = Depends(get_db),
):
    user, role, permissions = actor
    _authorize_it_access(
        user,
        role,
        permissions,
        ("it.view", "it.manage", "themes.view", "themes.manage"),
    )

    await _ensure_governance_tables(db)
    row = await db.execute(text("""
        SELECT id, theme_name, primary_color, secondary_color, accent_color, surface_color, text_color, is_rtl, font_family, created_at, updated_at
        FROM admin_theme_settings
        ORDER BY id ASC
        LIMIT 1
    """))
    return dict(row.mappings().first() or {})


@router.put("/themes")
async def update_theme_settings(
    payload: dict,
    actor=Depends(get_current_user_and_role),
    db: AsyncSession = Depends(get_db),
):
    user, role, permissions = actor
    _authorize_it_access(
        user,
        role,
        permissions,
        ("it.manage", "themes.manage"),
    )

    await _ensure_governance_tables(db)

    current = await db.execute(text("SELECT id FROM admin_theme_settings ORDER BY id ASC LIMIT 1"))
    row = current.mappings().first()
    if not row:
        raise HTTPException(status_code=500, detail="Theme settings row not found")

    await db.execute(
        text("""
            UPDATE admin_theme_settings
            SET theme_name = :theme_name,
                primary_color = :primary_color,
                secondary_color = :secondary_color,
                accent_color = :accent_color,
                surface_color = :surface_color,
                text_color = :text_color,
                is_rtl = :is_rtl,
                font_family = :font_family,
                updated_at = NOW()
            WHERE id = :id
        """),
        {
            "id": row["id"],
            "theme_name": _clean_text(payload.get("theme_name")) or "royal_palace",
            "primary_color": _clean_text(payload.get("primary_color")) or "#0b1f4d",
            "secondary_color": _clean_text(payload.get("secondary_color")) or "#c9a66b",
            "accent_color": _clean_text(payload.get("accent_color")) or "#2563eb",
            "surface_color": _clean_text(payload.get("surface_color")) or "#ffffff",
            "text_color": _clean_text(payload.get("text_color")) or "#111827",
            "is_rtl": _normalize_bool(payload.get("is_rtl"), True),
            "font_family": _clean_text(payload.get("font_family")) or "system-ui",
        },
    )
    await db.commit()
    return await get_theme_settings(actor=actor, db=db)


@router.get("/branding")
async def get_branding_settings(
    actor=Depends(get_current_user_and_role),
    db: AsyncSession = Depends(get_db),
):
    user, role, permissions = actor
    _authorize_it_access(
        user,
        role,
        permissions,
        ("it.view", "it.manage", "branding.view", "branding.manage"),
    )

    await _ensure_governance_tables(db)
    row = await db.execute(text("""
        SELECT id, brand_name_ar, brand_name_en, logo_url, icon_url, support_email, support_phone, company_address, created_at, updated_at
        FROM admin_branding_settings
        ORDER BY id ASC
        LIMIT 1
    """))
    return dict(row.mappings().first() or {})


@router.put("/branding")
async def update_branding_settings(
    payload: dict,
    actor=Depends(get_current_user_and_role),
    db: AsyncSession = Depends(get_db),
):
    user, role, permissions = actor
    _authorize_it_access(
        user,
        role,
        permissions,
        ("it.manage", "branding.manage"),
    )

    await _ensure_governance_tables(db)

    current = await db.execute(text("SELECT id FROM admin_branding_settings ORDER BY id ASC LIMIT 1"))
    row = current.mappings().first()
    if not row:
        raise HTTPException(status_code=500, detail="Branding settings row not found")

    await db.execute(
        text("""
            UPDATE admin_branding_settings
            SET brand_name_ar = :brand_name_ar,
                brand_name_en = :brand_name_en,
                logo_url = :logo_url,
                icon_url = :icon_url,
                support_email = :support_email,
                support_phone = :support_phone,
                company_address = :company_address,
                updated_at = NOW()
            WHERE id = :id
        """),
        {
            "id": row["id"],
            "brand_name_ar": _clean_text(payload.get("brand_name_ar")) or "رويال بالاس",
            "brand_name_en": _clean_text(payload.get("brand_name_en")) or "Royal Palace",
            "logo_url": _clean_text(payload.get("logo_url")),
            "icon_url": _clean_text(payload.get("icon_url")),
            "support_email": _clean_text(payload.get("support_email")),
            "support_phone": _clean_text(payload.get("support_phone")),
            "company_address": _clean_text(payload.get("company_address")),
        },
    )
    await db.commit()
    return await get_branding_settings(actor=actor, db=db)


@router.get("/ui-settings")
async def get_ui_settings(
    actor=Depends(get_current_user_and_role),
    db: AsyncSession = Depends(get_db),
):
    user, role, permissions = actor
    _authorize_it_access(
        user,
        role,
        permissions,
        ("it.view", "it.manage", "ui_settings.manage", "global_settings.manage", "layout.manage"),
    )

    await _ensure_governance_tables(db)
    row = await db.execute(text("""
        SELECT id, admin_title_ar, admin_title_en, dashboard_layout, cards_density, enable_animations, sidebar_style, created_at, updated_at
        FROM admin_ui_settings
        ORDER BY id ASC
        LIMIT 1
    """))
    return dict(row.mappings().first() or {})


@router.put("/ui-settings")
async def update_ui_settings(
    payload: dict,
    actor=Depends(get_current_user_and_role),
    db: AsyncSession = Depends(get_db),
):
    user, role, permissions = actor
    _authorize_it_access(
        user,
        role,
        permissions,
        ("it.manage", "ui_settings.manage", "global_settings.manage", "layout.manage"),
    )

    await _ensure_governance_tables(db)

    current = await db.execute(text("SELECT id FROM admin_ui_settings ORDER BY id ASC LIMIT 1"))
    row = current.mappings().first()
    if not row:
        raise HTTPException(status_code=500, detail="UI settings row not found")

    await db.execute(
        text("""
            UPDATE admin_ui_settings
            SET admin_title_ar = :admin_title_ar,
                admin_title_en = :admin_title_en,
                dashboard_layout = :dashboard_layout,
                cards_density = :cards_density,
                enable_animations = :enable_animations,
                sidebar_style = :sidebar_style,
                updated_at = NOW()
            WHERE id = :id
        """),
        {
            "id": row["id"],
            "admin_title_ar": _clean_text(payload.get("admin_title_ar")) or "بوابة الإدارة التنفيذية",
            "admin_title_en": _clean_text(payload.get("admin_title_en")) or "Executive Admin Portal",
            "dashboard_layout": _clean_text(payload.get("dashboard_layout")) or "executive",
            "cards_density": _clean_text(payload.get("cards_density")) or "comfortable",
            "enable_animations": _normalize_bool(payload.get("enable_animations"), True),
            "sidebar_style": _clean_text(payload.get("sidebar_style")) or "default",
        },
    )
    await db.commit()
    return await get_ui_settings(actor=actor, db=db)
