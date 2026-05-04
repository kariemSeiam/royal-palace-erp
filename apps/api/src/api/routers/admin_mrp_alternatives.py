from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission
from src.core.db.session import get_db
from src.models.mrp_alternative import MrpProductAlternative
from pydantic import BaseModel

router = APIRouter(prefix="/admin/mrp/alternatives", tags=["mrp-alternatives"])

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not has_any_permission(permissions, "bom.view", "work_orders.view"):
        raise HTTPException(403, "Access denied")
    return user

class AlternativeCreate(BaseModel):
    product_id: int
    alternative_product_id: int
    priority: int = 1

@router.get("")
async def list_alternatives(product_id: int = Query(...), db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    stmt = select(MrpProductAlternative).where(MrpProductAlternative.product_id == product_id).order_by(MrpProductAlternative.priority)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [{"id":r.id, "product_id":r.product_id, "alternative_product_id":r.alternative_product_id, "priority":r.priority} for r in rows]

@router.post("")
async def create_alternative(payload: AlternativeCreate, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    alt = MrpProductAlternative(**payload.dict())
    db.add(alt)
    await db.commit()
    return {"id": alt.id}

@router.delete("/{alt_id}")
async def delete_alternative(alt_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(select(MrpProductAlternative).where(MrpProductAlternative.id == alt_id))
    row = result.scalar_one_or_none()
    if not row: raise HTTPException(404, "Not found")
    await db.delete(row)
    await db.commit()
    return {"ok": True}

@router.get("/suggest")
async def suggest_alternatives(product_id: int, quantity: float = 1.0, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    stock = await db.execute(text("SELECT COALESCE(SUM(quantity),0) FROM stock_moves WHERE product_id = :pid AND state='done'"), {"pid": product_id})
    available = float(stock.scalar() or 0)
    if available >= quantity:
        return {"product_id": product_id, "available": available, "sufficient": True, "alternatives": []}
    alts = await db.execute(select(MrpProductAlternative).where(MrpProductAlternative.product_id == product_id).order_by(MrpProductAlternative.priority))
    alternatives = []
    for a in alts.scalars().all():
        astock = await db.execute(text("SELECT COALESCE(SUM(quantity),0) FROM stock_moves WHERE product_id = :pid AND state='done'"), {"pid": a.alternative_product_id})
        av = float(astock.scalar() or 0)
        alternatives.append({"product_id": a.alternative_product_id, "available": av})
    return {"product_id": product_id, "available": available, "sufficient": False, "alternatives": alternatives}
