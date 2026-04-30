from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User
from src.models.social_media_marketing import SocialMediaPost

router = APIRouter(prefix="/admin/social-media", tags=["admin-social-media"])

async def ensure_social_media_tables(db: AsyncSession):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS social_media_posts (
            id SERIAL PRIMARY KEY,
            factory_id INTEGER REFERENCES factories(id) ON DELETE SET NULL,
            platform VARCHAR(50) NOT NULL,
            content TEXT NOT NULL,
            scheduled_at TIMESTAMP WITH TIME ZONE,
            posted_at TIMESTAMP WITH TIME ZONE,
            status VARCHAR(50) DEFAULT 'draft',
            engagement_score INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    await db.commit()

async def require_social_media_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "social_media.view", "social_media.manage"):
        raise HTTPException(status_code=403, detail="Social Media access denied")
    return user

@router.get("")
async def list_posts(current_user: User = Depends(require_social_media_view), db: AsyncSession = Depends(get_db)):
    await ensure_social_media_tables(db)
    result = await db.execute(select(SocialMediaPost).order_by(SocialMediaPost.id.desc()))
    rows = result.scalars().all()
    return [{"id":r.id,"platform":r.platform,"content":r.content[:100],"status":r.status,"scheduled_at":str(r.scheduled_at) if r.scheduled_at else None} for r in rows]

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_post(payload: dict, current_user: User = Depends(require_social_media_view), db: AsyncSession = Depends(get_db)):
    await ensure_social_media_tables(db)
    post = SocialMediaPost(
        platform=payload["platform"],
        content=payload["content"],
        scheduled_at=payload.get("scheduled_at"),
        factory_id=current_user.factory_id if not current_user.is_superuser else None
    )
    db.add(post)
    await db.commit()
    await db.refresh(post)
    return {"id":post.id,"platform":post.platform}

@router.delete("/{post_id}")
async def delete_post(post_id: int, current_user: User = Depends(require_social_media_view), db: AsyncSession = Depends(get_db)):
    await ensure_social_media_tables(db)
    result = await db.execute(select(SocialMediaPost).where(SocialMediaPost.id == post_id))
    post = result.scalar_one_or_none()
    if not post: raise HTTPException(status_code=404, detail="Post not found")
    await db.delete(post)
    await db.commit()
    return {"message":"Post deleted"}
