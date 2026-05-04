from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db

router = APIRouter(prefix="/admin/sms-marketing", tags=["sms-marketing"])

@router.get("/campaigns")
async def list_campaigns(db: AsyncSession = Depends(get_db), user=Depends(get_current_user_and_role)):
    return []
