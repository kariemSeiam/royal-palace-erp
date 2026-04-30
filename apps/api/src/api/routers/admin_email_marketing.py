from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User
from src.models.email_marketing import EmailList, EmailSubscriber, EmailCampaign, EmailCampaignStat

router = APIRouter(prefix="/admin/email-marketing", tags=["admin-email-marketing"])

async def require_email_marketing_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "email_marketing.view", "email_marketing.manage"):
        raise HTTPException(status_code=403, detail="Email Marketing access denied")
    return user

@router.get("/lists")
async def list_lists(current_user: User = Depends(require_email_marketing_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(EmailList).order_by(EmailList.id.asc()))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"code":r.code} for r in rows]

@router.post("/lists", status_code=status.HTTP_201_CREATED)
async def create_list(payload: dict, current_user: User = Depends(require_email_marketing_view), db: AsyncSession = Depends(get_db)):
    lst = EmailList(name=payload["name"], code=payload["code"], description=payload.get("description"))
    db.add(lst)
    await db.commit()
    await db.refresh(lst)
    return {"id":lst.id,"name":lst.name,"code":lst.code}

@router.get("/subscribers")
async def list_subscribers(current_user: User = Depends(require_email_marketing_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(EmailSubscriber).order_by(EmailSubscriber.id.asc()).limit(200))
    rows = result.scalars().all()
    return [{"id":r.id,"list_id":r.list_id,"email":r.email,"name":r.name,"is_active":r.is_active,"subscribed_at":str(r.subscribed_at) if r.subscribed_at else None} for r in rows]

@router.post("/subscribers", status_code=status.HTTP_201_CREATED)
async def create_subscriber(payload: dict, current_user: User = Depends(require_email_marketing_view), db: AsyncSession = Depends(get_db)):
    sub = EmailSubscriber(list_id=payload["list_id"], email=payload["email"], name=payload.get("name"))
    db.add(sub)
    await db.commit()
    await db.refresh(sub)
    return {"id":sub.id,"email":sub.email}

@router.get("/campaigns")
async def list_campaigns(current_user: User = Depends(require_email_marketing_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(EmailCampaign).order_by(EmailCampaign.id.desc()).limit(50))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"subject":r.subject,"list_id":r.list_id,"scheduled_at":str(r.scheduled_at) if r.scheduled_at else None,"status":r.status,"sent_at":str(r.sent_at) if r.sent_at else None,"created_at":str(r.created_at)} for r in rows]

@router.post("/campaigns", status_code=status.HTTP_201_CREATED)
async def create_campaign(payload: dict, current_user: User = Depends(require_email_marketing_view), db: AsyncSession = Depends(get_db)):
    campaign = EmailCampaign(name=payload["name"], subject=payload["subject"], body=payload.get("body"), list_id=payload.get("list_id"), scheduled_at=payload.get("scheduled_at"), status=payload.get("status","draft"))
    db.add(campaign)
    await db.commit()
    await db.refresh(campaign)
    return {"id":campaign.id,"name":campaign.name,"status":campaign.status}

@router.put("/campaigns/{campaign_id}")
async def update_campaign(campaign_id: int, payload: dict, current_user: User = Depends(require_email_marketing_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(EmailCampaign).where(EmailCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign: raise HTTPException(status_code=404, detail="Campaign not found")
    for field in ["name","subject","body","list_id","scheduled_at","status"]:
        if field in payload: setattr(campaign, field, payload[field])
    await db.commit()
    await db.refresh(campaign)
    return {"id":campaign.id,"name":campaign.name,"status":campaign.status}

@router.delete("/campaigns/{campaign_id}")
async def delete_campaign(campaign_id: int, current_user: User = Depends(require_email_marketing_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(EmailCampaign).where(EmailCampaign.id == campaign_id))
    campaign = result.scalar_one_or_none()
    if not campaign: raise HTTPException(status_code=404, detail="Campaign not found")
    await db.delete(campaign)
    await db.commit()
    return {"message":"Campaign deleted"}
