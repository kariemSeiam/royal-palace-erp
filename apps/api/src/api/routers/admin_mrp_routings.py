from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from pydantic import BaseModel
from typing import Optional

router = APIRouter(prefix="/admin/mrp/routings", tags=["admin-mrp-routings"])

async def require_routing_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "routing.view", "routing.manage"):
        raise HTTPException(403, "Routing access denied")
    return user

class RoutingCreate(BaseModel):
    name: str
    code: str
    product_id: Optional[int] = None
    notes: Optional[str] = None
    factory_id: Optional[int] = None

class RoutingStepCreate(BaseModel):
    routing_id: int
    step_no: int = 1
    step_code: Optional[str] = None
    step_name: str
    workcenter_id: Optional[int] = None
    standard_minutes: Optional[float] = None
    notes: Optional[str] = None
    is_outsourced: bool = False

@router.get("")
async def list_routings(db: AsyncSession = Depends(get_db), user=Depends(require_routing_access)):
    result = await db.execute(text("SELECT * FROM mrp_routings ORDER BY id"))
    rows = result.mappings().all()
    return [dict(r) for r in rows]

@router.post("")
async def create_routing(payload: RoutingCreate, db: AsyncSession = Depends(get_db), user=Depends(require_routing_access)):
    ins = text("INSERT INTO mrp_routings (name, code, product_id, notes, factory_id) VALUES (:name, :code, :pid, :notes, :fid) RETURNING id")
    result = await db.execute(ins, {"name": payload.name, "code": payload.code, "pid": payload.product_id, "notes": payload.notes, "fid": payload.factory_id})
    await db.commit()
    return {"id": result.scalar_one(), "name": payload.name, "code": payload.code}

@router.put("/{routing_id}")
async def update_routing(routing_id: int, payload: dict, db: AsyncSession = Depends(get_db), user=Depends(require_routing_access)):
    await db.execute(text("UPDATE mrp_routings SET name=COALESCE(:name,name), code=COALESCE(:code,code), product_id=COALESCE(:pid,product_id) WHERE id=:id"),
                     {"name": payload.get("name"), "code": payload.get("code"), "pid": payload.get("product_id"), "id": routing_id})
    await db.commit()
    return {"ok": True}

@router.delete("/{routing_id}")
async def delete_routing(routing_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_routing_access)):
    await db.execute(text("DELETE FROM mrp_routings WHERE id=:id"), {"id": routing_id})
    await db.commit()
    return {"ok": True}

@router.get("/steps")
async def list_steps(routing_id: int = Query(...), db: AsyncSession = Depends(get_db), user=Depends(require_routing_access)):
    result = await db.execute(text("SELECT * FROM mrp_routing_steps WHERE routing_id=:rid ORDER BY step_no"), {"rid": routing_id})
    rows = result.mappings().all()
    return [dict(r) for r in rows]

@router.post("/steps")
async def create_step(payload: RoutingStepCreate, db: AsyncSession = Depends(get_db), user=Depends(require_routing_access)):
    ins = text("INSERT INTO mrp_routing_steps (routing_id, step_no, step_code, step_name, workcenter_id, standard_minutes, notes, is_outsourced) VALUES (:rid, :sno, :scode, :sname, :wid, :sm, :notes, :is_out) RETURNING id")
    result = await db.execute(ins, {"rid": payload.routing_id, "sno": payload.step_no, "scode": payload.step_code, "sname": payload.step_name, "wid": payload.workcenter_id, "sm": payload.standard_minutes, "notes": payload.notes, "is_out": payload.is_outsourced})
    await db.commit()
    return {"id": result.scalar_one(), "routing_id": payload.routing_id, "step_name": payload.step_name}

@router.delete("/steps/{step_id}")
async def delete_step(step_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_routing_access)):
    await db.execute(text("DELETE FROM mrp_routing_steps WHERE id=:id"), {"id": step_id})
    await db.commit()
    return {"ok": True}
