from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db

router = APIRouter(prefix="/admin/payment-terms", tags=["admin-payment-terms"])

def _int(v, field):
    try: return int(v)
    except: raise HTTPException(400, f"{field} must be a number")

async def require_auth(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not any(c in {str(c).strip().lower() for c in (permissions or set())} for c in ["payment_terms.view","payment_terms.manage"]):
        raise HTTPException(403, "Access denied")
    return user

@router.get("")
async def list_terms(user=Depends(require_auth), db=Depends(get_db)):
    r = await db.execute(text("SELECT * FROM account_payment_terms ORDER BY sequence ASC, id ASC"))
    return [dict(row) for row in r.mappings().all()]

@router.post("")
async def create_term(payload: dict, user=Depends(require_auth), db=Depends(get_db)):
    name = payload.get("name")
    if not name: raise HTTPException(400, "name required")
    r = await db.execute(text("INSERT INTO account_payment_terms (name, code, sequence, description) VALUES (:n,:c,:s,:d) RETURNING id"), {"n":name,"c":payload.get("code"),"s":_int(payload.get("sequence","10"),"sequence"),"d":payload.get("description")})
    await db.commit()
    return {"id": r.scalar_one(), "name": name}

@router.put("/{id}")
async def update_term(id: int, payload: dict, user=Depends(require_auth), db=Depends(get_db)):
    await db.execute(text("UPDATE account_payment_terms SET name=COALESCE(:n,name), code=COALESCE(:c,code), sequence=COALESCE(:s,sequence), is_active=COALESCE(:ia,is_active), description=COALESCE(:d,description), updated_at=NOW() WHERE id=:id"), {"n":payload.get("name"),"c":payload.get("code"),"s":payload.get("sequence"),"ia":payload.get("is_active"),"d":payload.get("description"),"id":id})
    await db.commit()
    return {"ok": True}

@router.delete("/{id}")
async def delete_term(id: int, user=Depends(require_auth), db=Depends(get_db)):
    await db.execute(text("DELETE FROM account_payment_terms WHERE id=:id"), {"id": id})
    await db.commit()
    return {"ok": True}
