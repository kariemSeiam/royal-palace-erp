from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db

router = APIRouter(prefix="/admin/taxes", tags=["admin-taxes"])

def _int(v, field):
    try: return int(v)
    except: raise HTTPException(400, f"{field} must be a number")
def _float(v, field):
    try: return float(v)
    except: raise HTTPException(400, f"{field} must be a number")

async def require_auth(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not any(c in {str(c).strip().lower() for c in (permissions or set())} for c in ["tax.view","tax.manage"]):
        raise HTTPException(403, "Access denied")
    return user

@router.get("")
async def list_taxes(user=Depends(require_auth), db=Depends(get_db)):
    r = await db.execute(text("SELECT * FROM account_taxes ORDER BY id ASC"))
    return [dict(row) for row in r.mappings().all()]

@router.post("")
async def create_tax(payload: dict, user=Depends(require_auth), db=Depends(get_db)):
    name = payload.get("name")
    code = payload.get("code")
    if not name or not code: raise HTTPException(400, "name and code required")
    r = await db.execute(text("""
        INSERT INTO account_taxes (name, code, rate, tax_type, tax_scope, country_id, account_id, price_include, include_base_amount, description)
        VALUES (:n,:c,:r,:t,:ts,:cid,:aid,:pi,:iba,:d) RETURNING id
    """), {"n":name,"c":code,"r":_float(payload.get("rate","0"),"rate"),"t":payload.get("tax_type","sales"),"ts":payload.get("tax_scope","goods"),"cid":payload.get("country_id"),"aid":payload.get("account_id"),"pi":payload.get("price_include",False),"iba":payload.get("include_base_amount",False),"d":payload.get("description")})
    await db.commit()
    return {"id": r.scalar_one(), "name": name}

@router.put("/{id}")
async def update_tax(id: int, payload: dict, user=Depends(require_auth), db=Depends(get_db)):
    await db.execute(text("""
        UPDATE account_taxes SET name=COALESCE(:n,name), rate=COALESCE(:r,rate), tax_type=COALESCE(:t,tax_type), tax_scope=COALESCE(:ts,tax_scope),
        country_id=COALESCE(:cid,country_id), account_id=COALESCE(:aid,account_id), price_include=COALESCE(:pi,price_include),
        include_base_amount=COALESCE(:iba,include_base_amount), description=COALESCE(:d,description), updated_at=NOW() WHERE id=:id
    """), {"n":payload.get("name"),"r":payload.get("rate"),"t":payload.get("tax_type"),"ts":payload.get("tax_scope"),"cid":payload.get("country_id"),"aid":payload.get("account_id"),"pi":payload.get("price_include"),"iba":payload.get("include_base_amount"),"d":payload.get("description"),"id":id})
    await db.commit()
    return {"ok": True}

@router.delete("/{id}")
async def delete_tax(id: int, user=Depends(require_auth), db=Depends(get_db)):
    await db.execute(text("DELETE FROM account_taxes WHERE id=:id"), {"id": id})
    await db.commit()
    return {"ok": True}
