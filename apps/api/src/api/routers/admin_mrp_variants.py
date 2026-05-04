from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission
from src.core.db.session import get_db
from src.models.mrp_variant import MrpBomVariant
from pydantic import BaseModel

router = APIRouter(prefix="/admin/mrp/variants", tags=["mrp-variants"])

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not has_any_permission(permissions, "bom.view", "bom.manage"):
        raise HTTPException(403, "Access denied")
    return user

class VariantCreate(BaseModel):
    bom_id: int
    variant_name: str
    variant_value: str = None
    product_variant_id: int = None

@router.get("")
async def list_variants(bom_id: int = Query(...), db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    stmt = select(MrpBomVariant).where(MrpBomVariant.bom_id == bom_id)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [{"id":r.id,"bom_id":r.bom_id,"variant_name":r.variant_name,"variant_value":r.variant_value} for r in rows]

@router.post("")
async def create_variant(payload: VariantCreate, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    v = MrpBomVariant(**payload.dict())
    db.add(v)
    await db.commit()
    await db.refresh(v)
    return {"id":v.id}
