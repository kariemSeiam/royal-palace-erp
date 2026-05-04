from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db
from src.models.mrp_alert import MrpQualityAlert
from pydantic import BaseModel

router = APIRouter(prefix="/admin/mrp/alerts", tags=["mrp-alerts"])

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not has_any_permission(permissions, "quality.view", "quality.manage"):
        raise HTTPException(403, "Access denied")
    return user

@router.get("")
async def list_alerts(user_id: int = None, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    if user_id:
        stmt = select(MrpQualityAlert).where(MrpQualityAlert.user_id == user_id).order_by(MrpQualityAlert.id.desc())
    else:
        stmt = select(MrpQualityAlert).order_by(MrpQualityAlert.id.desc())
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [{"id":r.id,"quality_check_id":r.quality_check_id,"message":r.message,"is_read":r.is_read,"created_at":str(r.created_at)} for r in rows]

@router.post("/{alert_id}/read")
async def mark_read(alert_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    alert = await db.execute(select(MrpQualityAlert).where(MrpQualityAlert.id == alert_id))
    a = alert.scalar_one_or_none()
    if not a: raise HTTPException(404, "Alert not found")
    a.is_read = True
    await db.commit()
    return {"ok": True}
