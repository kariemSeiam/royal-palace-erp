from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User
from src.models.loyalty import Coupon, LoyaltyCard

router = APIRouter(prefix="/admin/loyalty", tags=["admin-loyalty"])

async def require_loyalty_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "loyalty.view", "loyalty.manage"):
        raise HTTPException(status_code=403, detail="Loyalty access denied")
    return user

@router.get("/coupons")
async def list_coupons(current_user: User = Depends(require_loyalty_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Coupon).order_by(Coupon.id.desc()).limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"code":r.code,"discount_percent":float(r.discount_percent) if r.discount_percent else 0,"discount_amount":float(r.discount_amount) if r.discount_amount else 0,"valid_from":str(r.valid_from) if r.valid_from else None,"valid_to":str(r.valid_to) if r.valid_to else None,"used_count":r.used_count,"is_active":r.is_active} for r in rows]

@router.post("/coupons", status_code=status.HTTP_201_CREATED)
async def create_coupon(payload: dict, current_user: User = Depends(require_loyalty_view), db: AsyncSession = Depends(get_db)):
    coupon = Coupon(code=payload["code"], discount_percent=payload.get("discount_percent"), discount_amount=payload.get("discount_amount"), valid_from=payload.get("valid_from"), valid_to=payload.get("valid_to"), usage_limit=payload.get("usage_limit"))
    db.add(coupon)
    await db.commit()
    await db.refresh(coupon)
    return {"id":coupon.id,"code":coupon.code}

@router.delete("/coupons/{coupon_id}")
async def delete_coupon(coupon_id: int, current_user: User = Depends(require_loyalty_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Coupon).where(Coupon.id == coupon_id))
    coupon = result.scalar_one_or_none()
    if not coupon: raise HTTPException(status_code=404, detail="Coupon not found")
    await db.delete(coupon)
    await db.commit()
    return {"message":"Coupon deleted"}

@router.get("/cards")
async def list_cards(current_user: User = Depends(require_loyalty_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(LoyaltyCard).order_by(LoyaltyCard.id.asc()).limit(200))
    rows = result.scalars().all()
    return [{"id":r.id,"customer_id":r.customer_id,"points":r.points,"tier":r.tier} for r in rows]
