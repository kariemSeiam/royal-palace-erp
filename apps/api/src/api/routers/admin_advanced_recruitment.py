from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User
from src.models.advanced_recruitment import JobPosting, JobApplication

router = APIRouter(prefix="/admin/recruitment", tags=["admin-recruitment"])

async def ensure_recruitment_tables(db: AsyncSession):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS job_postings (
            id SERIAL PRIMARY KEY,
            factory_id INTEGER REFERENCES factories(id) ON DELETE SET NULL,
            title VARCHAR(255) NOT NULL,
            department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL,
            description TEXT NOT NULL,
            requirements TEXT,
            status VARCHAR(50) DEFAULT 'open',
            posted_date DATE,
            closing_date DATE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    await db.commit()

async def require_advanced_recruitment_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "advanced_recruitment.view", "advanced_recruitment.manage"):
        raise HTTPException(status_code=403, detail="Advanced Recruitment access denied")
    return user

@router.get("/postings")
async def list_postings(current_user: User = Depends(require_advanced_recruitment_view), db: AsyncSession = Depends(get_db)):
    await ensure_recruitment_tables(db)
    result = await db.execute(select(JobPosting).order_by(JobPosting.id.desc()))
    rows = result.scalars().all()
    return [{"id":r.id,"title":r.title,"status":r.status,"posted_date":str(r.posted_date) if r.posted_date else None} for r in rows]

@router.post("/postings", status_code=status.HTTP_201_CREATED)
async def create_posting(payload: dict, current_user: User = Depends(require_advanced_recruitment_view), db: AsyncSession = Depends(get_db)):
    await ensure_recruitment_tables(db)
    posting = JobPosting(
        title=payload["title"],
        description=payload.get("description",""),
        department_id=payload.get("department_id"),
        requirements=payload.get("requirements"),
        status=payload.get("status","open"),
        factory_id=current_user.factory_id if not current_user.is_superuser else None
    )
    db.add(posting)
    await db.commit()
    await db.refresh(posting)
    return {"id":posting.id,"title":posting.title}

@router.delete("/postings/{posting_id}")
async def delete_posting(posting_id: int, current_user: User = Depends(require_advanced_recruitment_view), db: AsyncSession = Depends(get_db)):
    await ensure_recruitment_tables(db)
    result = await db.execute(select(JobPosting).where(JobPosting.id == posting_id))
    posting = result.scalar_one_or_none()
    if not posting: raise HTTPException(status_code=404, detail="Job posting not found")
    await db.delete(posting)
    await db.commit()
    return {"message":"Job posting deleted"}
