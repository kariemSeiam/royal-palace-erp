from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db

router = APIRouter(prefix="/admin/stock-scraps", tags=["admin-stock-scraps"])

def _int(v, field):
    try: return int(v)
    except: raise HTTPException(400, f"{field} must be a number")
def _float(v, field):
    try: return float(v)
    except: raise HTTPException(400, f"{field} must be a number")

async def require_auth(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not any(c in {str(c).strip().lower() for c in (permissions or set())} for c in ["scrap.view","scrap.manage"]):
        raise HTTPException(403, "Access denied")
    return user

@router.get("")
async def list_scraps(user=Depends(require_auth), db=Depends(get_db)):
    r = await db.execute(text("""
        SELECT ss.*, p.name_ar AS product_name, p.sku, w.name AS warehouse_name, f.name AS factory_name,
        sl.lot_number, u.full_name AS created_by_name
        FROM stock_scraps ss
        JOIN products p ON p.id=ss.product_id JOIN warehouses w ON w.id=ss.warehouse_id JOIN factories f ON f.id=ss.factory_id
        LEFT JOIN stock_lots sl ON sl.id=ss.lot_id LEFT JOIN users u ON u.id=ss.created_by_user_id
        ORDER BY ss.id DESC
    """))
    return [dict(row) for row in r.mappings().all()]

@router.post("")
async def create_scrap(payload: dict, user=Depends(require_auth), db=Depends(get_db)):
    fid = _int(payload.get("factory_id"), "factory_id")
    wid = _int(payload.get("warehouse_id"), "warehouse_id")
    pid = _int(payload.get("product_id"), "product_id")
    qty = _float(payload.get("quantity"), "quantity")
    lid = _int(payload.get("lot_id"), "lot_id") if payload.get("lot_id") else None
    state = payload.get("state","draft")
    uid = getattr(user, "id", None)
    factory = await db.execute(text("SELECT id FROM factories WHERE id=:fid"), {"fid":fid})
    if not factory.first(): raise HTTPException(404, "Factory not found")
    warehouse = await db.execute(text("SELECT id FROM warehouses WHERE id=:wid"), {"wid":wid})
    if not warehouse.first(): raise HTTPException(404, "Warehouse not found")
    product = await db.execute(text("SELECT id FROM products WHERE id=:pid"), {"pid":pid})
    if not product.first(): raise HTTPException(404, "Product not found")
    if state == "done":
        move = await db.execute(text("INSERT INTO inventory_movements (factory_id, warehouse_id, product_id, movement_type, quantity, reference_type, notes, created_by_user_id) VALUES (:fid,:wid,:pid,'out',:qty,'scrap',:notes,:uid) RETURNING id"), {"fid":fid,"wid":wid,"pid":pid,"qty":qty,"notes":payload.get("notes",""),"uid":uid})
        mid = move.scalar_one()
        scrap = await db.execute(text("INSERT INTO stock_scraps (factory_id, warehouse_id, product_id, lot_id, quantity, uom_id, state, date_done, scrap_reason, notes, movement_id, created_by_user_id) VALUES (:fid,:wid,:pid,:lid,:qty,:uom_id,:state,NOW(),:reason,:notes,:mid,:uid) RETURNING id"), {"fid":fid,"wid":wid,"pid":pid,"lid":lid,"qty":qty,"uom_id":payload.get("uom_id"),"state":state,"reason":payload.get("scrap_reason"),"notes":payload.get("notes"),"mid":mid,"uid":uid})
        await db.commit()
        return {"id": scrap.scalar_one(), "movement_id": mid}
    else:
        scrap = await db.execute(text("INSERT INTO stock_scraps (factory_id, warehouse_id, product_id, lot_id, quantity, uom_id, state, scrap_reason, notes, created_by_user_id) VALUES (:fid,:wid,:pid,:lid,:qty,:uom_id,'draft',:reason,:notes,:uid) RETURNING id"), {"fid":fid,"wid":wid,"pid":pid,"lid":lid,"qty":qty,"uom_id":payload.get("uom_id"),"reason":payload.get("scrap_reason"),"notes":payload.get("notes"),"uid":uid})
        await db.commit()
        return {"id": scrap.scalar_one()}

@router.put("/{id}/done")
async def mark_scrap_done(id: int, user=Depends(require_auth), db=Depends(get_db)):
    scrap = await db.execute(text("SELECT * FROM stock_scraps WHERE id=:id"), {"id":id})
    s = scrap.mappings().first()
    if not s: raise HTTPException(404, "Scrap not found")
    if s.get("state") == "done": raise HTTPException(409, "Already done")
    fid=s["factory_id"]; wid=s["warehouse_id"]; pid=s["product_id"]; qty=s["quantity"]; notes=s.get("notes","")
    uid = getattr(user, "id", None)
    move = await db.execute(text("INSERT INTO inventory_movements (factory_id, warehouse_id, product_id, movement_type, quantity, reference_type, notes, created_by_user_id) VALUES (:fid,:wid,:pid,'out',:qty,'scrap',:notes,:uid) RETURNING id"), {"fid":fid,"wid":wid,"pid":pid,"qty":qty,"notes":notes,"uid":uid})
    mid = move.scalar_one()
    await db.execute(text("UPDATE stock_scraps SET state='done', date_done=NOW(), movement_id=:mid, updated_at=NOW() WHERE id=:id"), {"id":id,"mid":mid})
    await db.commit()
    return {"ok": True}

@router.delete("/{id}")
async def delete_scrap(id: int, user=Depends(require_auth), db=Depends(get_db)):
    await db.execute(text("DELETE FROM stock_scraps WHERE id=:id"), {"id": id})
    await db.commit()
    return {"ok": True}
