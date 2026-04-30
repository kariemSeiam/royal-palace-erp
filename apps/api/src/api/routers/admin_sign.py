from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User
from src.models.sign import SignRequest

router = APIRouter(prefix="/admin/sign", tags=["admin-sign"])

async def require_sign_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "sign.view", "sign.manage"):
        raise HTTPException(status_code=403, detail="Sign access denied")
    return user

@router.get("/requests")
async def list_requests(current_user: User = Depends(require_sign_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(SignRequest).order_by(SignRequest.id.desc()).limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"title":r.title,"document_url":r.document_url,"requested_by_user_id":r.requested_by_user_id,"signer_name":r.signer_name,"signer_email":r.signer_email,"status":r.status,"notes":r.notes} for r in rows]

@router.post("/requests", status_code=status.HTTP_201_CREATED)
async def create_request(payload: dict, current_user: User = Depends(require_sign_view), db: AsyncSession = Depends(get_db)):
    req = SignRequest(title=payload["title"], document_url=payload.get("document_url"), requested_by_user_id=current_user.id, signer_name=payload.get("signer_name"), signer_email=payload.get("signer_email"), status=payload.get("status","pending"), notes=payload.get("notes"))
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return {"id":req.id,"title":req.title,"status":req.status}

@router.put("/requests/{request_id}")
async def update_request(request_id: int, payload: dict, current_user: User = Depends(require_sign_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(SignRequest).where(SignRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req: raise HTTPException(status_code=404, detail="Request not found")
    for field in ["title","document_url","signer_name","signer_email","status","notes"]:
        if field in payload: setattr(req, field, payload[field])
    await db.commit()
    await db.refresh(req)
    return {"id":req.id,"title":req.title,"status":req.status}

@router.delete("/requests/{request_id}")
async def delete_request(request_id: int, current_user: User = Depends(require_sign_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(SignRequest).where(SignRequest.id == request_id))
    req = result.scalar_one_or_none()
    if not req: raise HTTPException(status_code=404, detail="Request not found")
    await db.delete(req)
    await db.commit()
    return {"message":"Request deleted"}
