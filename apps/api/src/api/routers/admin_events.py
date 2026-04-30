from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from src.core.db.session import get_db
from src.api.deps.admin_auth import get_current_user_and_role
from pydantic import BaseModel
from typing import Optional, List
import datetime

router = APIRouter(prefix="/admin/events", tags=["admin-events"])

class ItemOut(BaseModel):
    id: int
    name: Optional[str] = None
    description: Optional[str] = None
    location: Optional[str] = None
    event_type: Optional[str] = None
    start_at: Optional[str] = None
    end_at: Optional[str] = None
    status: Optional[str] = None
    is_active: Optional[bool] = None

@router.get("/", response_model=List[ItemOut])
async def list_items(db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user_and_role)):
    result = await db.execute(text("SELECT * FROM events ORDER BY id DESC"))
    rows = result.all()
    def serialize(row):
        d = dict(row._mapping)
        for k, v in d.items():
            if isinstance(v, datetime.datetime):
                d[k] = v.isoformat()
        return d
    return [serialize(row) for row in rows]

@router.post("/")
async def create_item(data: dict, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user_and_role)):
    valid_fields = ("name", "description", "location", "event_type", "start_at", "end_at", "status", "is_active")
    payload = {}
    for k, v in data.items():
        if k not in valid_fields or v is None:
            if k in ("start_at", "end_at", "scheduled_at", "sent_at", "date") and isinstance(v, str):
                try:
                    v = datetime.datetime.fromisoformat(v)
                except ValueError:
                    continue
            continue
        if k in ("start_at", "end_at") and isinstance(v, str):
            try:
                v = datetime.datetime.fromisoformat(v)
            except ValueError:
                continue
        payload[k] = v
    if not payload:
        raise HTTPException(status_code=400, detail="No valid fields")
    columns = ", ".join(payload.keys())
    placeholders = ", ".join(f":{k}" for k in payload.keys())
    await db.execute(text(f"INSERT INTO events ({columns}) VALUES ({placeholders})"), payload)
    await db.commit()
    return {"ok": True}

@router.put("/{item_id}")
async def update_item(item_id: int, data: dict, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user_and_role)):
    valid_fields = ("name", "description", "location", "event_type", "start_at", "end_at", "status", "is_active")
    payload = {}
    for k, v in data.items():
        if k not in valid_fields or v is None:
            if k in ("start_at", "end_at", "scheduled_at", "sent_at", "date") and isinstance(v, str):
                try:
                    v = datetime.datetime.fromisoformat(v)
                except ValueError:
                    continue
            continue
        if k in ("start_at", "end_at") and isinstance(v, str):
            try:
                v = datetime.datetime.fromisoformat(v)
            except ValueError:
                continue
        payload[k] = v
    if not payload:
        raise HTTPException(status_code=400, detail="No valid fields")
    set_clause = ", ".join(f"{k} = :{k}" for k in payload.keys())
    payload["id"] = item_id
    await db.execute(text(f"UPDATE events SET {set_clause} WHERE id = :id"), payload)
    await db.commit()
    return {"ok": True}

@router.delete("/{item_id}")
async def delete_item(item_id: int, db: AsyncSession = Depends(get_db), current_user = Depends(get_current_user_and_role)):
    await db.execute(text("DELETE FROM events WHERE id = :id"), {"id": item_id})
    await db.commit()
    return {"ok": True}
