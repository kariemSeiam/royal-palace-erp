from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission
from src.core.db.session import get_db
import hashlib, json
from pydantic import BaseModel

router = APIRouter(prefix="/admin/blockchain", tags=["blockchain"])

class BlockchainEvent(BaseModel):
    mo_id: int
    event_type: str
    data: dict

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not has_any_permission(permissions, "work_orders.view", "planning.view"):
        raise HTTPException(403, "Access denied")
    return user

@router.post("/add-event")
async def add_event(payload: BlockchainEvent, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    last = await db.execute(text("SELECT current_hash FROM mrp_production_events WHERE manufacturing_order_id = :mo_id ORDER BY id DESC LIMIT 1"), {"mo_id": payload.mo_id})
    last_row = last.mappings().first()
    previous_hash = last_row["current_hash"] if last_row else '0'
    raw = json.dumps(payload.data, sort_keys=True) + previous_hash
    current_hash = hashlib.sha256(raw.encode()).hexdigest()
    await db.execute(text("INSERT INTO mrp_production_events (manufacturing_order_id, event_type, previous_hash, current_hash, data_json) VALUES (:mo, :et, :ph, :ch, :data)"),
                     {"mo": payload.mo_id, "et": payload.event_type, "ph": previous_hash, "ch": current_hash, "data": json.dumps(payload.data)})
    await db.commit()
    return {"current_hash": current_hash}

@router.get("/trace")
async def trace_mo(mo_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(text("SELECT id, event_type, previous_hash, current_hash, data_json, created_at FROM mrp_production_events WHERE manufacturing_order_id = :mo_id ORDER BY id ASC"), {"mo_id": mo_id})
    events = result.mappings().all()
    return [{"id": r.id, "event_type": r.event_type, "previous_hash": r.previous_hash, "current_hash": r.current_hash, "data": r.data_json, "created_at": str(r.created_at)} for r in events]
