from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role, is_factory_scoped, get_user_factory_scope_id
from src.core.db.session import get_db
from src.models.user import User
from src.models.asset import Asset, AssetDepreciationLine

router = APIRouter(prefix="/admin/assets", tags=["admin-assets"])

async def require_assets_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "assets.view", "assets.manage"):
        raise HTTPException(status_code=403, detail="Assets access denied")
    return user

def _scope_filter(stmt, factory_column, current_user):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            stmt = stmt.where(factory_column == scoped_id)
    return stmt

@router.get("")
async def list_assets(current_user: User = Depends(require_assets_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(Asset).order_by(Asset.id.desc())
    stmt = _scope_filter(stmt, Asset.factory_id, current_user)
    result = await db.execute(stmt.limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"code":r.code,"factory_id":r.factory_id,"purchase_date":str(r.purchase_date) if r.purchase_date else None,"purchase_value":float(r.purchase_value) if r.purchase_value else 0,"salvage_value":float(r.salvage_value) if r.salvage_value else 0,"useful_life_years":r.useful_life_years,"current_value":float(r.current_value) if r.current_value else 0,"depreciation_method":r.depreciation_method,"status":r.status,"notes":r.notes} for r in rows]

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_asset(payload: dict, current_user: User = Depends(require_assets_view), db: AsyncSession = Depends(get_db)):
    asset = Asset(name=payload["name"], code=payload["code"], factory_id=payload.get("factory_id"), purchase_date=payload.get("purchase_date"), purchase_value=payload.get("purchase_value"), salvage_value=payload.get("salvage_value"), useful_life_years=payload.get("useful_life_years",5), current_value=payload.get("purchase_value"), depreciation_method=payload.get("depreciation_method","straight_line"), status=payload.get("status","active"), notes=payload.get("notes"))
    db.add(asset)
    await db.commit()
    await db.refresh(asset)
    return {"id":asset.id,"name":asset.name,"code":asset.code}

@router.put("/{asset_id}")
async def update_asset(asset_id: int, payload: dict, current_user: User = Depends(require_assets_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset: raise HTTPException(status_code=404, detail="Asset not found")
    for field in ["name","code","factory_id","purchase_date","purchase_value","salvage_value","useful_life_years","current_value","depreciation_method","status","notes"]:
        if field in payload: setattr(asset, field, payload[field])
    await db.commit()
    await db.refresh(asset)
    return {"id":asset.id,"name":asset.name,"code":asset.code}

@router.delete("/{asset_id}")
async def delete_asset(asset_id: int, current_user: User = Depends(require_assets_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset: raise HTTPException(status_code=404, detail="Asset not found")
    await db.delete(asset)
    await db.commit()
    return {"message":"Asset deleted"}

@router.post("/{asset_id}/depreciate")
async def calculate_depreciation(asset_id: int, current_user: User = Depends(require_assets_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Asset).where(Asset.id == asset_id))
    asset = result.scalar_one_or_none()
    if not asset: raise HTTPException(status_code=404, detail="Asset not found")
    if not asset.purchase_value or not asset.salvage_value or not asset.useful_life_years:
        raise HTTPException(status_code=400, detail="Missing purchase value, salvage value, or useful life years")
    annual_dep = (float(asset.purchase_value) - float(asset.salvage_value)) / max(1, asset.useful_life_years)
    annual_dep = round(annual_dep, 2)
    existing = await db.execute(sa_select(AssetDepreciationLine).where(AssetDepreciationLine.asset_id == asset_id).order_by(AssetDepreciationLine.fiscal_year.desc()).limit(1))
    last_line = existing.scalar_one_or_none()
    accumulated = (float(last_line.accumulated_depreciation) if last_line else 0) + annual_dep
    net_book = max(0, float(asset.purchase_value) - accumulated)
    line = AssetDepreciationLine(asset_id=asset.id, fiscal_year=2026, depreciation_amount=annual_dep, accumulated_depreciation=round(accumulated,2), net_book_value=round(net_book,2))
    db.add(line)
    asset.current_value = round(net_book,2)
    await db.commit()
    await db.refresh(line)
    return {"id":line.id,"annual_depreciation":annual_dep,"accumulated":round(accumulated,2),"net_book_value":round(net_book,2)}

@router.get("/{asset_id}/depreciation")
async def list_depreciation(asset_id: int, current_user: User = Depends(require_assets_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(AssetDepreciationLine).where(AssetDepreciationLine.asset_id == asset_id).order_by(AssetDepreciationLine.fiscal_year.asc()))
    rows = result.scalars().all()
    return [{"id":r.id,"fiscal_year":r.fiscal_year,"depreciation_amount":float(r.depreciation_amount),"accumulated_depreciation":float(r.accumulated_depreciation),"net_book_value":float(r.net_book_value) if r.net_book_value else 0} for r in rows]
