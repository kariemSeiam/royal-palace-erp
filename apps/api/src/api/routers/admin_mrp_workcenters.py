from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import time
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db

router = APIRouter(prefix="/admin/work-centers", tags=["admin-work-centers"])

def _int(v, field):
    try: return int(v)
    except: raise HTTPException(400, f"{field} must be a number")
def _float(v, field):
    try: return float(v)
    except: raise HTTPException(400, f"{field} must be a number")
def _time(v, field):
    if not v: return None
    try:
        parts = str(v).strip().split(":")
        return time(int(parts[0]), int(parts[1]))
    except: raise HTTPException(400, f"{field} must be a valid time (HH:MM)")

async def require_auth(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not any(c in {str(c).strip().lower() for c in (permissions or set())} for c in ["workcenter.view","workcenter.manage"]):
        raise HTTPException(403, "Access denied")
    return user

@router.get("")
async def list_wc(user=Depends(require_auth), db=Depends(get_db)):
    r = await db.execute(text("SELECT wc.*, f.name AS factory_name FROM mrp_workcenters wc JOIN factories f ON f.id=wc.factory_id ORDER BY wc.id ASC"))
    return [dict(row) for row in r.mappings().all()]

@router.post("")
async def create_wc(payload: dict, user=Depends(require_auth), db=Depends(get_db)):
    fid = _int(payload.get("factory_id"), "factory_id")
    name = payload.get("name")
    code = payload.get("code")
    if not name or not code: raise HTTPException(400, "name and code required")
    ts = _time(payload.get("time_start","08:00"), "time_start")
    te = _time(payload.get("time_end","17:00"), "time_end")
    r = await db.execute(text("""
        INSERT INTO mrp_workcenters (factory_id, name, code, capacity_per_day, time_efficiency, hourly_cost, hourly_overhead, costs_hour_account_id, resource_calendar_id, time_start, time_end, notes)
        VALUES (:fid,:n,:c,:cap,:teff,:cost,:oh,:chaid,:cal,:ts,:te,:notes) RETURNING id
    """), {"fid":fid,"n":name,"c":code,"cap":_float(payload.get("capacity_per_day","0"),"capacity"),"teff":_float(payload.get("time_efficiency","100"),"time_efficiency"),"cost":_float(payload.get("hourly_cost","0"),"cost"),"oh":_float(payload.get("hourly_overhead","0"),"overhead"),"chaid":payload.get("costs_hour_account_id"),"cal":payload.get("resource_calendar_id"),"ts":ts,"te":te,"notes":payload.get("notes")})
    await db.commit()
    return {"id": r.scalar_one(), "name": name}

@router.put("/{id}")
async def update_wc(id: int, payload: dict, user=Depends(require_auth), db=Depends(get_db)):
    ts = _time(payload.get("time_start"), "time_start") if payload.get("time_start") is not None else None
    te = _time(payload.get("time_end"), "time_end") if payload.get("time_end") is not None else None
    await db.execute(text("""
        UPDATE mrp_workcenters SET name=COALESCE(:n,name), capacity_per_day=COALESCE(:c,capacity_per_day), time_efficiency=COALESCE(:te,time_efficiency),
        hourly_cost=COALESCE(:h,hourly_cost), hourly_overhead=COALESCE(:o,hourly_overhead), costs_hour_account_id=COALESCE(:chaid,costs_hour_account_id),
        resource_calendar_id=COALESCE(:cal,resource_calendar_id), time_start=COALESCE(:ts,time_start), time_end=COALESCE(:te2,time_end),
        notes=COALESCE(:nt,notes), updated_at=NOW() WHERE id=:id
    """), {"n":payload.get("name"),"c":payload.get("capacity_per_day"),"te":payload.get("time_efficiency"),"h":payload.get("hourly_cost"),"o":payload.get("hourly_overhead"),"chaid":payload.get("costs_hour_account_id"),"cal":payload.get("resource_calendar_id"),"ts":ts,"te2":te,"nt":payload.get("notes"),"id":id})
    await db.commit()
    return {"ok": True}

@router.delete("/{id}")
async def delete_wc(id: int, user=Depends(require_auth), db=Depends(get_db)):
    await db.execute(text("DELETE FROM mrp_workcenters WHERE id=:id"), {"id": id})
    await db.commit()
    return {"ok": True}
