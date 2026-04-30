from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db

router = APIRouter(prefix="/admin/payment-term-lines", tags=["admin-payment-term-lines"])

def _int(v, field):
    try: return int(v)
    except: raise HTTPException(400, f"{field} must be a number")
def _float(v, field):
    try: return float(v)
    except: raise HTTPException(400, f"{field} must be a number")

async def require_auth(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not any(c in {str(c).strip().lower() for c in (permissions or set())} for c in ["payment_terms.view","payment_terms.manage"]):
        raise HTTPException(403, "Access denied")
    return user

@router.get("")
async def list_lines(term_id: int, user=Depends(require_auth), db=Depends(get_db)):
    r = await db.execute(text("SELECT * FROM account_payment_term_lines WHERE term_id=:tid ORDER BY sequence ASC, id ASC"), {"tid":term_id})
    return [dict(row) for row in r.mappings().all()]

@router.post("")
async def create_line(payload: dict, user=Depends(require_auth), db=Depends(get_db)):
    tid = _int(payload.get("term_id"), "term_id")
    r = await db.execute(text("""
        INSERT INTO account_payment_term_lines (term_id, sequence, value_type, value, days, discount_percentage, discount_days, description)
        VALUES (:tid,:seq,:vt,:v,:days,:dp,:dd,:desc) RETURNING id
    """), {"tid":tid,"seq":_int(payload.get("sequence","10"),"sequence"),"vt":payload.get("value_type","percent"),"v":_float(payload.get("value","0"),"value"),"days":_int(payload.get("days","0"),"days"),"dp":payload.get("discount_percentage"),"dd":payload.get("discount_days"),"desc":payload.get("description")})
    await db.commit()
    return {"id": r.scalar_one()}

@router.put("/{id}")
async def update_line(id: int, payload: dict, user=Depends(require_auth), db=Depends(get_db)):
    await db.execute(text("""
        UPDATE account_payment_term_lines SET sequence=COALESCE(:seq,sequence), value_type=COALESCE(:vt,value_type),
        value=COALESCE(:v,value), days=COALESCE(:d,days), discount_percentage=COALESCE(:dp,discount_percentage),
        discount_days=COALESCE(:dd,discount_days), description=COALESCE(:desc,description), updated_at=NOW() WHERE id=:id
    """), {"seq":payload.get("sequence"),"vt":payload.get("value_type"),"v":payload.get("value"),"d":payload.get("days"),"dp":payload.get("discount_percentage"),"dd":payload.get("discount_days"),"desc":payload.get("description"),"id":id})
    await db.commit()
    return {"ok": True}

@router.delete("/{id}")
async def delete_line(id: int, user=Depends(require_auth), db=Depends(get_db)):
    await db.execute(text("DELETE FROM account_payment_term_lines WHERE id=:id"), {"id": id})
    await db.commit()
    return {"ok": True}
