from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User
from src.models.shipping import ShippingCarrier, ShippingRate

router = APIRouter(prefix="/admin/delivery", tags=["admin-delivery"])

async def require_delivery_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "delivery.view", "delivery.manage"):
        raise HTTPException(status_code=403, detail="Delivery access denied")
    return user

@router.get("/carriers")
async def list_carriers(current_user: User = Depends(require_delivery_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(ShippingCarrier).order_by(ShippingCarrier.id.asc()).limit(50))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"code":r.code,"tracking_url_prefix":r.tracking_url_prefix,"is_active":r.is_active} for r in rows]

@router.post("/carriers", status_code=status.HTTP_201_CREATED)
async def create_carrier(payload: dict, current_user: User = Depends(require_delivery_view), db: AsyncSession = Depends(get_db)):
    carrier = ShippingCarrier(name=payload["name"], code=payload["code"], tracking_url_prefix=payload.get("tracking_url_prefix"))
    db.add(carrier)
    await db.commit()
    await db.refresh(carrier)
    return {"id":carrier.id,"name":carrier.name,"code":carrier.code}

@router.delete("/carriers/{carrier_id}")
async def delete_carrier(carrier_id: int, current_user: User = Depends(require_delivery_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(ShippingCarrier).where(ShippingCarrier.id == carrier_id))
    carrier = result.scalar_one_or_none()
    if not carrier: raise HTTPException(status_code=404, detail="Carrier not found")
    await db.delete(carrier)
    await db.commit()
    return {"message":"Carrier deleted"}

@router.get("/rates")
async def list_rates(current_user: User = Depends(require_delivery_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(ShippingRate).order_by(ShippingRate.id.asc()).limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"carrier_id":r.carrier_id,"name":r.name,"price":float(r.price) if r.price else 0,"is_active":r.is_active} for r in rows]

@router.post("/rates", status_code=status.HTTP_201_CREATED)
async def create_rate(payload: dict, current_user: User = Depends(require_delivery_view), db: AsyncSession = Depends(get_db)):
    rate = ShippingRate(carrier_id=payload["carrier_id"], name=payload["name"], price=payload.get("price",0))
    db.add(rate)
    await db.commit()
    await db.refresh(rate)
    return {"id":rate.id,"name":rate.name,"price":float(rate.price) if rate.price else 0}

@router.delete("/rates/{rate_id}")
async def delete_rate(rate_id: int, current_user: User = Depends(require_delivery_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(ShippingRate).where(ShippingRate.id == rate_id))
    rate = result.scalar_one_or_none()
    if not rate: raise HTTPException(status_code=404, detail="Rate not found")
    await db.delete(rate)
    await db.commit()
    return {"message":"Rate deleted"}
