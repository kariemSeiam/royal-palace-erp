from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User
from src.models.knowledge import KnowledgeArticle

router = APIRouter(prefix="/admin/knowledge", tags=["admin-knowledge"])

async def ensure_knowledge_tables(db: AsyncSession):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS knowledge_articles (
            id SERIAL PRIMARY KEY,
            factory_id INTEGER REFERENCES factories(id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL,
            content TEXT NOT NULL,
            category VARCHAR(100),
            tags VARCHAR(500),
            author_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
            is_published BOOLEAN DEFAULT FALSE,
            view_count INTEGER DEFAULT 0,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    await db.commit()

async def require_knowledge_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "knowledge.view", "knowledge.manage"):
        raise HTTPException(status_code=403, detail="Knowledge access denied")
    return user

@router.get("")
async def list_articles(current_user: User = Depends(require_knowledge_view), db: AsyncSession = Depends(get_db)):
    await ensure_knowledge_tables(db)
    result = await db.execute(select(KnowledgeArticle).order_by(KnowledgeArticle.id.desc()))
    rows = result.scalars().all()
    return [{"id":r.id,"title":r.title,"category":r.category,"is_published":r.is_published} for r in rows]

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_article(payload: dict, current_user: User = Depends(require_knowledge_view), db: AsyncSession = Depends(get_db)):
    await ensure_knowledge_tables(db)
    article = KnowledgeArticle(
        title=payload["title"],
        content=payload.get("content",""),
        category=payload.get("category"),
        tags=payload.get("tags"),
        is_published=payload.get("is_published",False),
        author_id=current_user.id,
        factory_id=current_user.factory_id if not current_user.is_superuser else None
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return {"id":article.id,"title":article.title}

@router.delete("/{article_id}")
async def delete_article(article_id: int, current_user: User = Depends(require_knowledge_view), db: AsyncSession = Depends(get_db)):
    await ensure_knowledge_tables(db)
    result = await db.execute(select(KnowledgeArticle).where(KnowledgeArticle.id == article_id))
    article = result.scalar_one_or_none()
    if not article: raise HTTPException(status_code=404, detail="Article not found")
    await db.delete(article)
    await db.commit()
    return {"message":"Article deleted"}
