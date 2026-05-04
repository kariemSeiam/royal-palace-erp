from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission
from src.core.db.session import get_db
from src.models.mrp_bom_version import MrpBomVersion
from pydantic import BaseModel
from typing import Optional
from datetime import datetime

router = APIRouter(prefix="/admin/mrp/bom-versions", tags=["mrp-bom-versions"])

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not has_any_permission(permissions, "bom.view", "bom.manage"):
        raise HTTPException(403, "Access denied")
    return user

class VersionCreate(BaseModel):
    bom_id: int
    version_number: int
    eco_number: Optional[str] = None
    changes: Optional[str] = None

class StateUpdate(BaseModel):
    eco_state: str
    approved_by: Optional[int] = None

@router.get("")
async def list_versions(bom_id: int = Query(...), db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    stmt = select(MrpBomVersion).where(MrpBomVersion.bom_id == bom_id).order_by(MrpBomVersion.version_number.desc())
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [{"id":r.id,"version_number":r.version_number,"eco_number":r.eco_number,"eco_state":r.eco_state,"changes":r.changes,"created_at":str(r.created_at)} for r in rows]

@router.post("")
async def create_version(payload: VersionCreate, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    v = MrpBomVersion(**payload.dict())
    db.add(v)
    await db.commit()
    await db.refresh(v)
    return {"id":v.id}

@router.put("/{version_id}/state")
async def change_state(version_id: int, payload: StateUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(select(MrpBomVersion).where(MrpBomVersion.id == version_id))
    v = result.scalar_one_or_none()
    if not v: raise HTTPException(404, "Version not found")
    v.eco_state = payload.eco_state
    if payload.eco_state == "approved":
        v.approved_by = payload.approved_by or user.id
        v.approved_at = datetime.utcnow()
    await db.commit()
    return {"ok": True}
