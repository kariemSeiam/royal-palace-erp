from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User

router = APIRouter(prefix="/admin/website", tags=["admin-website"])


async def require_website_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser:
        return user
    if not has_any_permission(permissions, "website.view", "website.manage"):
        raise HTTPException(status_code=403, detail="Website access denied")
    return user


@router.get("/pages")
async def list_pages(current_user: User = Depends(require_website_view), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT id, title, slug, meta_description, is_published, is_active, created_at, updated_at FROM website_pages ORDER BY id DESC LIMIT 100")
    )
    rows = result.mappings().all()
    return [dict(row) for row in rows]


@router.post("/pages", status_code=status.HTTP_201_CREATED)
async def create_page(payload: dict, current_user: User = Depends(require_website_view), db: AsyncSession = Depends(get_db)):
    title = payload.get("title", "").strip()
    slug = payload.get("slug", "").strip()
    content = payload.get("content", "")
    meta_description = payload.get("meta_description", "")
    is_published = payload.get("is_published", False)

    if not title or not slug:
        raise HTTPException(status_code=400, detail="Title and slug are required")

    existing = await db.execute(text("SELECT id FROM website_pages WHERE slug = :slug"), {"slug": slug})
    if existing.first():
        raise HTTPException(status_code=409, detail="Slug already exists")

    result = await db.execute(
        text("""INSERT INTO website_pages (title, slug, content, meta_description, is_published)
                VALUES (:title, :slug, :content, :meta_description, :is_published) RETURNING id"""),
        {"title": title, "slug": slug, "content": content, "meta_description": meta_description, "is_published": is_published},
    )
    page_id = int(result.scalar_one())
    await db.commit()
    return {"id": page_id, "title": title, "slug": slug}


@router.put("/pages/{page_id}")
async def update_page(page_id: int, payload: dict, current_user: User = Depends(require_website_view), db: AsyncSession = Depends(get_db)):
    existing = await db.execute(text("SELECT id FROM website_pages WHERE id = :id"), {"id": page_id})
    if not existing.first():
        raise HTTPException(status_code=404, detail="Page not found")

    title = payload.get("title")
    slug = payload.get("slug")
    content = payload.get("content")
    meta_description = payload.get("meta_description")
    is_published = payload.get("is_published")

    if slug:
        duplicate = await db.execute(text("SELECT id FROM website_pages WHERE slug = :slug AND id != :id"), {"slug": slug, "id": page_id})
        if duplicate.first():
            raise HTTPException(status_code=409, detail="Slug already exists")

    await db.execute(
        text("""UPDATE website_pages SET title = COALESCE(:title, title), slug = COALESCE(:slug, slug),
                content = COALESCE(:content, content), meta_description = COALESCE(:meta_description, meta_description),
                is_published = COALESCE(:is_published, is_published), updated_at = NOW()
                WHERE id = :id"""),
        {"title": title, "slug": slug, "content": content, "meta_description": meta_description, "is_published": is_published, "id": page_id},
    )
    await db.commit()
    return {"message": "Page updated"}


@router.delete("/pages/{page_id}")
async def delete_page(page_id: int, current_user: User = Depends(require_website_view), db: AsyncSession = Depends(get_db)):
    existing = await db.execute(text("SELECT id FROM website_pages WHERE id = :id"), {"id": page_id})
    if not existing.first():
        raise HTTPException(status_code=404, detail="Page not found")
    await db.execute(text("DELETE FROM website_pages WHERE id = :id"), {"id": page_id})
    await db.commit()
    return {"message": "Page deleted"}


@router.get("/menus")
async def list_menus(current_user: User = Depends(require_website_view), db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        text("SELECT id, name, url, parent_id, sequence, is_active FROM website_menus ORDER BY sequence ASC")
    )
    rows = result.mappings().all()
    return [dict(row) for row in rows]


@router.post("/menus", status_code=status.HTTP_201_CREATED)
async def create_menu(payload: dict, current_user: User = Depends(require_website_view), db: AsyncSession = Depends(get_db)):
    name = payload.get("name", "").strip()
    url = payload.get("url", "").strip()
    parent_id = payload.get("parent_id")
    sequence = payload.get("sequence", 0)

    if not name:
        raise HTTPException(status_code=400, detail="Name is required")

    result = await db.execute(
        text("""INSERT INTO website_menus (name, url, parent_id, sequence)
                VALUES (:name, :url, :parent_id, :sequence) RETURNING id"""),
        {"name": name, "url": url, "parent_id": parent_id, "sequence": sequence},
    )
    menu_id = int(result.scalar_one())
    await db.commit()
    return {"id": menu_id, "name": name}
