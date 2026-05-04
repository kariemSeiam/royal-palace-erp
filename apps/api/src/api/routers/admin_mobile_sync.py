from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission
from src.core.db.session import get_db
from src.models.mobile_sync import MobileSyncQueue
from pydantic import BaseModel

router = APIRouter(prefix="/admin/mobile-sync", tags=["mobile-sync"])

class SyncPush(BaseModel):
    user_id: int
    table_name: str
    record_id: int
    action: str
    payload: dict = {}

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    return user

@router.post("/push")
async def push_sync(data: SyncPush, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    entry = MobileSyncQueue(user_id=data.user_id, table_name=data.table_name, record_id=data.record_id, action=data.action, payload=data.payload)
    db.add(entry)
    await db.commit()
    return {"id": entry.id}

@router.get("/pull")
async def pull_sync(user_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(select(MobileSyncQueue).where(MobileSyncQueue.user_id == user_id, MobileSyncQueue.synced == False).order_by(MobileSyncQueue.id))
    entries = result.scalars().all()
    return [{"id":e.id,"table_name":e.table_name,"record_id":e.record_id,"action":e.action,"payload":e.payload} for e in entries]

@router.post("/mark-synced")
async def mark_synced(ids: list[int], db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    await db.execute(text("UPDATE mobile_sync_queue SET synced = true WHERE id = ANY(:ids)"), {"ids": ids})
    await db.commit()
    return {"ok": True}
