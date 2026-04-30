from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role, is_factory_scoped, get_user_factory_scope_id
from src.core.db.session import get_db
from src.models.user import User
from src.models.inventory import StockLocation, StockPickingType, StockPicking, StockMove, StockQuant, StockInventoryAdjustment

router = APIRouter(prefix="/admin/advanced-inventory", tags=["admin-advanced-inventory"])

async def require_stock_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "stock.view", "stock.manage", "picking.view", "picking.manage"):
        raise HTTPException(status_code=403, detail="Stock access denied")
    return user

def _scope_filter(stmt, factory_column, current_user):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            stmt = stmt.where(factory_column == scoped_id)
    return stmt

@router.get("/locations")
async def list_locations(current_user: User = Depends(require_stock_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(StockLocation).order_by(StockLocation.id.asc())
    stmt = _scope_filter(stmt, StockLocation.factory_id, current_user)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"code":r.code,"factory_id":r.factory_id,"location_type":r.location_type,"parent_location_id":r.parent_location_id,"is_active":r.is_active} for r in rows]

@router.post("/locations", status_code=201)
async def create_location(payload: dict, current_user: User = Depends(require_stock_view), db: AsyncSession = Depends(get_db)):
    loc = StockLocation(name=payload["name"], code=payload["code"], factory_id=payload.get("factory_id"), location_type=payload.get("location_type","internal"), parent_location_id=payload.get("parent_location_id"))
    db.add(loc)
    await db.commit()
    await db.refresh(loc)
    return {"id":loc.id,"name":loc.name,"code":loc.code}

@router.get("/pickings")
async def list_pickings(current_user: User = Depends(require_stock_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(StockPicking).order_by(StockPicking.id.desc())
    stmt = _scope_filter(stmt, StockPicking.factory_id, current_user)
    result = await db.execute(stmt.limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"factory_id":r.factory_id,"location_id":r.location_id,"location_dest_id":r.location_dest_id,"scheduled_date":str(r.scheduled_date) if r.scheduled_date else None,"state":r.state,"notes":r.notes} for r in rows]

@router.post("/pickings", status_code=201)
async def create_picking(payload: dict, current_user: User = Depends(require_stock_view), db: AsyncSession = Depends(get_db)):
    picking = StockPicking(factory_id=payload.get("factory_id"), location_id=payload.get("location_id"), location_dest_id=payload.get("location_dest_id"), picking_type_id=payload.get("picking_type_id"), scheduled_date=payload.get("scheduled_date"), state=payload.get("state","draft"), notes=payload.get("notes"))
    db.add(picking)
    await db.commit()
    await db.refresh(picking)
    return {"id":picking.id,"state":picking.state}

@router.get("/moves")
async def list_moves(current_user: User = Depends(require_stock_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(StockMove).order_by(StockMove.id.desc()).limit(200)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [{"id":r.id,"product_id":r.product_id,"location_id":r.location_id,"location_dest_id":r.location_dest_id,"state":r.state,"quantity":float(r.quantity)} for r in rows]

@router.get("/quants")
async def list_quants(current_user: User = Depends(require_stock_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(StockQuant).order_by(StockQuant.id.desc()).limit(200)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [{"id":r.id,"product_id":r.product_id,"location_id":r.location_id,"quantity":float(r.quantity),"reserved_quantity":float(r.reserved_quantity),"cost":float(r.cost)} for r in rows]

@router.get("/inventory-adjustments")
async def list_inventory_adjustments(current_user: User = Depends(require_stock_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(StockInventoryAdjustment).order_by(StockInventoryAdjustment.id.desc())
    stmt = _scope_filter(stmt, StockInventoryAdjustment.factory_id, current_user)
    result = await db.execute(stmt.limit(30))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"location_id":r.location_id,"state":r.state,"scheduled_date":str(r.scheduled_date) if r.scheduled_date else None,"notes":r.notes} for r in rows]

@router.post("/inventory-adjustments", status_code=201)
async def create_inventory_adjustment(payload: dict, current_user: User = Depends(require_stock_view), db: AsyncSession = Depends(get_db)):
    adj = StockInventoryAdjustment(name=payload["name"], location_id=payload.get("location_id"), factory_id=payload.get("factory_id"), scheduled_date=payload.get("scheduled_date"), state="draft", notes=payload.get("notes"))
    db.add(adj)
    await db.commit()
    await db.refresh(adj)
    return {"id":adj.id,"name":adj.name,"state":adj.state}

@router.put("/inventory-adjustments/{adjustment_id}/apply")
async def apply_inventory_adjustment(adjustment_id: int, current_user: User = Depends(require_stock_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(StockInventoryAdjustment).where(StockInventoryAdjustment.id == adjustment_id))
    adj = result.scalar_one_or_none()
    if not adj:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    adj.state = "done"
    await db.commit()
    return {"message": "Adjustment applied"}

@router.get("/inventory-adjustments")
async def list_inventory_adjustments(current_user: User = Depends(require_stock_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(StockInventoryAdjustment).order_by(StockInventoryAdjustment.id.desc())
    stmt = _scope_filter(stmt, StockInventoryAdjustment.factory_id, current_user)
    result = await db.execute(stmt.limit(30))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"location_id":r.location_id,"state":r.state,"scheduled_date":str(r.scheduled_date) if r.scheduled_date else None,"notes":r.notes} for r in rows]

@router.post("/inventory-adjustments", status_code=201)
async def create_inventory_adjustment(payload: dict, current_user: User = Depends(require_stock_view), db: AsyncSession = Depends(get_db)):
    adj = StockInventoryAdjustment(name=payload["name"], location_id=payload.get("location_id"), factory_id=payload.get("factory_id"), scheduled_date=payload.get("scheduled_date"), state="draft", notes=payload.get("notes"))
    db.add(adj)
    await db.commit()
    await db.refresh(adj)
    return {"id":adj.id,"name":adj.name,"state":adj.state}

@router.put("/inventory-adjustments/{adjustment_id}/apply")
async def apply_inventory_adjustment(adjustment_id: int, current_user: User = Depends(require_stock_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(StockInventoryAdjustment).where(StockInventoryAdjustment.id == adjustment_id))
    adj = result.scalar_one_or_none()
    if not adj:
        raise HTTPException(status_code=404, detail="Adjustment not found")
    adj.state = "done"
    await db.commit()
    return {"message": "Adjustment applied"}
