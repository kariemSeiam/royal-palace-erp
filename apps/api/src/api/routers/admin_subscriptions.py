from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User
from src.models.subscription import SubscriptionPlan, Subscription

router = APIRouter(prefix="/admin/subscriptions", tags=["admin-subscriptions"])

async def require_sub_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "subscription.view", "subscription.manage"):
        raise HTTPException(status_code=403, detail="Subscriptions access denied")
    return user

@router.get("")
async def list_subscriptions(current_user: User = Depends(require_sub_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Subscription).order_by(Subscription.id.desc()).limit(200))
    rows = result.scalars().all()
    return [{"id":r.id,"plan_id":r.plan_id,"customer_name":r.customer_name,"email":r.email,"start_date":str(r.start_date) if r.start_date else None,"end_date":str(r.end_date) if r.end_date else None,"status":r.status,"auto_renew":r.auto_renew,"notes":r.notes} for r in rows]

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_subscription(payload: dict, current_user: User = Depends(require_sub_view), db: AsyncSession = Depends(get_db)):
    sub = Subscription(plan_id=payload.get("plan_id"), customer_name=payload["customer_name"], email=payload.get("email"), start_date=payload.get("start_date"), end_date=payload.get("end_date"), status=payload.get("status","active"), auto_renew=payload.get("auto_renew",False), notes=payload.get("notes"))
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return {"id":sub.id,"customer_name":sub.customer_name,"status":sub.status}

@router.put("/{subscription_id}")
async def update_subscription(subscription_id: int, payload: dict, current_user: User = Depends(require_sub_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Subscription).where(Subscription.id == subscription_id))
    sub = result.scalar_one_or_none()
    if not sub: raise HTTPException(status_code=404, detail="Subscription not found")
    for field in ["plan_id","customer_name","email","start_date","end_date","status","auto_renew","notes"]:
        if field in payload: setattr(sub, field, payload[field])
    await db.commit()
    await db.refresh(sub)
    return {"id":sub.id,"customer_name":sub.customer_name,"status":sub.status}

@router.delete("/{subscription_id}")
async def delete_subscription(subscription_id: int, current_user: User = Depends(require_sub_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Subscription).where(Subscription.id == subscription_id))
    sub = result.scalar_one_or_none()
    if not sub: raise HTTPException(status_code=404, detail="Subscription not found")
    await db.delete(sub)
    await db.commit()
    return {"message":"Subscription deleted"}

@router.get("/plans")
async def list_plans(current_user: User = Depends(require_sub_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(SubscriptionPlan).order_by(SubscriptionPlan.id.asc()))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"code":r.code,"price":float(r.price) if r.price else 0,"interval":r.interval,"description":r.description} for r in rows]

@router.post("/plans", status_code=status.HTTP_201_CREATED)
async def create_plan(payload: dict, current_user: User = Depends(require_sub_view), db: AsyncSession = Depends(get_db)):
    plan = SubscriptionPlan(name=payload["name"], code=payload["code"], price=payload.get("price"), interval=payload.get("interval","monthly"), description=payload.get("description"))
    db.add(plan)
    await db.commit()
    await db.refresh(plan)
    return {"id":plan.id,"name":plan.name,"code":plan.code}
