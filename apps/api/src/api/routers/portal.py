from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db
from src.models.user import User

router = APIRouter(prefix="/portal", tags=["portal"])

@router.get("/me")
async def portal_me(current_user: User = Depends(get_current_user_and_role), db: AsyncSession = Depends(get_db)):
    return {
        "id": current_user.id,
        "full_name": current_user.full_name,
        "email": current_user.email,
        "phone": current_user.phone,
        "factory_id": current_user.factory_id,
    }
