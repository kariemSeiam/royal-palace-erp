from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db
from src.models.mrp_attachment import MrpBomAttachment
from pydantic import BaseModel

router = APIRouter(prefix="/admin/mrp/attachments", tags=["mrp-attachments"])

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not has_any_permission(permissions, "bom.view", "bom.manage"):
        raise HTTPException(403, "Access denied")
    return user

class AttachmentCreate(BaseModel):
    bom_id: int
    file_name: str
    file_url: str
    file_type: str = None

@router.get("")
async def list_attachments(bom_id: int = Query(...), db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    stmt = select(MrpBomAttachment).where(MrpBomAttachment.bom_id == bom_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [{"id":r.id,"file_name":r.file_name,"file_url":r.file_url,"file_type":r.file_type,"created_at":str(r.created_at)} for r in rows]

@router.post("")
async def create_attachment(payload: AttachmentCreate, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    a = MrpBomAttachment(**payload.dict())
    db.add(a)
    await db.commit()
    await db.refresh(a)
    return {"id":a.id}
