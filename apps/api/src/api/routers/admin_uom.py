from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db

router = APIRouter(prefix="/admin/uom", tags=["admin-uom"])

@router.get("")
async def list_uom(user=Depends(get_current_user_and_role), db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("SELECT id, name, code, factor, rounding, active, uom_type FROM uom ORDER BY id"))
    return [dict(row) for row in r.mappings().all()]
