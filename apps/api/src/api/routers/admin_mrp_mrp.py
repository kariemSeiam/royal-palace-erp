from fastapi import APIRouter, Depends, Query
from sqlalchemy import text, select
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission
from src.core.db.session import get_db
from src.models.mrp_mrp import MrpRule

router = APIRouter(prefix="/admin/mrp/mrp", tags=["mrp-mrp"])

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not has_any_permission(permissions, "work_orders.view", "planning.view"):
        raise HTTPException(403, "Access denied")
    return user

@router.get("/suggest")
async def suggest_procurement(db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    rules = (await db.execute(select(MrpRule).where(MrpRule.active == True))).scalars().all()
    suggestions = []
    for r in rules:
        stock_q = await db.execute(text("SELECT available_quantity FROM inventory_stock WHERE product_id = :pid"), {"pid": r.product_id})
        stock = float(stock_q.scalar() or 0)
        if stock < float(r.minimum_quantity):
            needed = float(r.reorder_quantity)
            suggestions.append({"product_id": r.product_id, "current_stock": stock, "min": float(r.minimum_quantity), "suggested_order": needed, "supplier_id": r.supplier_id, "factory_id": r.factory_id})
    return {"suggestions": suggestions}
