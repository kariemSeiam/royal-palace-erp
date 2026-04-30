from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db

router = APIRouter(prefix="/admin/stock-lots", tags=["admin-stock-lots"])

def _int(v, field):
    try: return int(v)
    except: raise HTTPException(400, f"{field} must be a number")
def _float(v, field):
    try: return float(v)
    except: raise HTTPException(400, f"{field} must be a number")
def _date(v, field):
    if not v: return None
    try: return date.fromisoformat(v)
    except: raise HTTPException(400, f"{field} must be a valid date")
def _tracking(v):
    if not v: return "lot"
    v = str(v).strip().lower()
    if v not in ("lot","serial"): raise HTTPException(400, "tracking must be lot or serial")
    return v

async def require_auth(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not any(c in {str(c).strip().lower() for c in (permissions or set())} for c in ["lot.view","lot.manage"]):
        raise HTTPException(403, "Access denied")
    return user

@router.get("")
async def list_lots(user=Depends(require_auth), db=Depends(get_db)):
    r = await db.execute(text("SELECT sl.*, p.name_ar AS product_name, p.sku, f.name AS factory_name FROM stock_lots sl JOIN products p ON p.id=sl.product_id JOIN factories f ON f.id=sl.factory_id ORDER BY sl.id DESC"))
    return [dict(row) for row in r.mappings().all()]

@router.post("")
async def create_lot(payload: dict, user=Depends(require_auth), db=Depends(get_db)):
    fid = _int(payload.get("factory_id"), "factory_id")
    pid = _int(payload.get("product_id"), "product_id")
    lot = payload.get("lot_number")
    if not lot: raise HTTPException(400, "lot_number required")
    tracking = _tracking(payload.get("tracking"))
    qty = _float(payload.get("quantity","0"), "quantity")
    prod_date = _date(payload.get("production_date"), "production_date")
    exp_date = _date(payload.get("expiration_date"), "expiration_date")
    alert_date = _date(payload.get("alert_date"), "alert_date")
    removal_date = _date(payload.get("removal_date"), "removal_date")
    r = await db.execute(text("""
        INSERT INTO stock_lots (factory_id, product_id, lot_number, tracking, description, production_date, expiration_date, alert_date, removal_date, quantity, uom)
        VALUES (:fid,:pid,:lot,:tracking,:desc,:prod_date,:exp_date,:alert_date,:removal_date,:qty,:uom) RETURNING id
    """), {"fid":fid,"pid":pid,"lot":lot,"tracking":tracking,"desc":payload.get("description"),"prod_date":prod_date,"exp_date":exp_date,"alert_date":alert_date,"removal_date":removal_date,"qty":qty,"uom":payload.get("uom","Units")})
    await db.commit()
    return {"id": r.scalar_one(), "lot_number": lot}

@router.put("/{id}")
async def update_lot(id: int, payload: dict, user=Depends(require_auth), db=Depends(get_db)):
    await db.execute(text("UPDATE stock_lots SET quantity=COALESCE(:q,quantity), tracking=COALESCE(:t,tracking), expiration_date=COALESCE(:e,expiration_date), alert_date=COALESCE(:a,alert_date), removal_date=COALESCE(:r,removal_date), description=COALESCE(:d,description), updated_at=NOW() WHERE id=:id"), {"q":payload.get("quantity"),"t":payload.get("tracking"),"e":payload.get("expiration_date"),"a":payload.get("alert_date"),"r":payload.get("removal_date"),"d":payload.get("description"),"id":id})
    await db.commit()
    return {"ok": True}

@router.delete("/{id}")
async def delete_lot(id: int, user=Depends(require_auth), db=Depends(get_db)):
    await db.execute(text("DELETE FROM stock_lots WHERE id=:id"), {"id": id})
    await db.commit()
    return {"ok": True}
