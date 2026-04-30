from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from datetime import date
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db

router = APIRouter(prefix="/admin/supplier-products", tags=["admin-supplier-products"])

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

async def require_auth(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not any(c in {str(c).strip().lower() for c in (permissions or set())} for c in ["supplier_info.view","supplier_info.manage"]):
        raise HTTPException(403, "Access denied")
    return user

@router.get("")
async def list_infos(user=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    r = await db.execute(text("""
        SELECT psi.*, p.name_ar AS product_name, p.sku, s.name AS supplier_name, s.code AS supplier_code
        FROM product_supplierinfos psi
        JOIN products p ON p.id=psi.product_id JOIN suppliers s ON s.id=psi.supplier_id
        ORDER BY psi.id ASC
    """))
    return [dict(row) for row in r.mappings().all()]

@router.post("")
async def create_info(payload: dict, user=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    pid = _int(payload.get("product_id"), "product_id")
    sid = _int(payload.get("supplier_id"), "supplier_id")
    r = await db.execute(text("""
        INSERT INTO product_supplierinfos (product_id, supplier_id, supplier_sku, product_name, min_order_qty, price, currency_id, date_start, date_end, lead_time_days, is_preferred, notes)
        VALUES (:pid,:sid,:sku,:pn,:moq,:price,:cid,:ds,:de,:lt,:pref,:notes) RETURNING id
    """), {
        "pid":pid, "sid":sid,
        "sku":payload.get("supplier_sku"),
        "pn":payload.get("product_name"),
        "moq":_float(payload.get("min_order_qty","0"),"min_order_qty"),
        "price":_float(payload.get("price","0"),"price"),
        "cid":_int(payload.get("currency_id"), "currency_id") if payload.get("currency_id") else None,
        "ds":_date(payload.get("date_start"), "date_start"),
        "de":_date(payload.get("date_end"), "date_end"),
        "lt":_int(payload.get("lead_time_days","7"),"lead_time_days"),
        "pref":payload.get("is_preferred",False),
        "notes":payload.get("notes")
    })
    await db.commit()
    return {"id": r.scalar_one()}

@router.put("/{id}")
async def update_info(id: int, payload: dict, user=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    date_start = _date(payload.get("date_start"), "date_start") if payload.get("date_start") is not None else None
    date_end = _date(payload.get("date_end"), "date_end") if payload.get("date_end") is not None else None
    await db.execute(text("""
        UPDATE product_supplierinfos SET
            supplier_sku=COALESCE(:sku,supplier_sku),
            product_name=COALESCE(:pn,product_name),
            min_order_qty=COALESCE(:moq,min_order_qty),
            price=COALESCE(:price,price),
            currency_id=COALESCE(:cid,currency_id),
            date_start=COALESCE(:ds,date_start),
            date_end=COALESCE(:de,date_end),
            lead_time_days=COALESCE(:lt,lead_time_days),
            is_preferred=COALESCE(:pref,is_preferred),
            notes=COALESCE(:notes,notes),
            updated_at=NOW() WHERE id=:id
    """), {
        "sku":payload.get("supplier_sku"),
        "pn":payload.get("product_name"),
        "moq":payload.get("min_order_qty"),
        "price":payload.get("price"),
        "cid":payload.get("currency_id"),
        "ds":date_start,
        "de":date_end,
        "lt":payload.get("lead_time_days"),
        "pref":payload.get("is_preferred"),
        "notes":payload.get("notes"),
        "id":id
    })
    await db.commit()
    return {"ok": True}

@router.delete("/{id}")
async def delete_info(id: int, user=Depends(require_auth), db: AsyncSession = Depends(get_db)):
    await db.execute(text("DELETE FROM product_supplierinfos WHERE id=:id"), {"id": id})
    await db.commit()
    return {"ok": True}
