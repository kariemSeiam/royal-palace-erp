from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User
from src.models.ecommerce import EcommerceSetting

router = APIRouter(prefix="/admin/ecommerce", tags=["admin-ecommerce"])

async def require_ecommerce_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "website.view", "website.manage"):
        raise HTTPException(status_code=403, detail="Ecommerce access denied")
    return user

@router.get("/settings")
async def list_settings(current_user: User = Depends(require_ecommerce_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(EcommerceSetting).order_by(EcommerceSetting.id.asc()).limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"key":r.key,"value":r.value,"is_active":r.is_active} for r in rows]
