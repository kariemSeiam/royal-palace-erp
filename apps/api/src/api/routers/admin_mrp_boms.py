from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func as sa_func
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.mrp_bom import MrpBom, MrpBomLine
from pydantic import BaseModel
from typing import Optional, List

router = APIRouter(prefix="/admin/mrp/boms", tags=["admin-mrp-boms"])

async def require_bom_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "bom.view", "bom.manage"):
        raise HTTPException(403, "BOM access denied")
    return user

class BomCreate(BaseModel):
    name: str
    code: str
    product_id: Optional[int] = None
    bom_type: str = "manufacture"
    version: int = 1
    notes: Optional[str] = None
    factory_id: Optional[int] = None

class BomUpdate(BaseModel):
    name: Optional[str] = None
    code: Optional[str] = None
    product_id: Optional[int] = None
    bom_type: Optional[str] = None
    version: Optional[int] = None
    is_active: Optional[bool] = None
    notes: Optional[str] = None
    factory_id: Optional[int] = None

class BomLineCreate(BaseModel):
    bom_id: int
    line_no: int = 1
    product_id: Optional[int] = None
    raw_material_name: Optional[str] = None
    quantity: float = 0
    unit: Optional[str] = None
    waste_percent: Optional[float] = 0
    notes: Optional[str] = None

@router.get("")
async def list_boms(db: AsyncSession = Depends(get_db), user=Depends(require_bom_access)):
    stmt = select(MrpBom).order_by(MrpBom.id)
    result = await db.execute(stmt.limit(200))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"code":r.code,"product_id":r.product_id,"bom_type":r.bom_type,"version":r.version,"is_active":r.is_active,"factory_id":r.factory_id} for r in rows]

@router.post("")
async def create_bom(payload: BomCreate, db: AsyncSession = Depends(get_db), user=Depends(require_bom_access)):
    bom = MrpBom(**payload.dict())
    db.add(bom)
    await db.commit()
    await db.refresh(bom)
    return {"id":bom.id, "name":bom.name, "code":bom.code}

@router.put("/{bom_id}")
async def update_bom(bom_id: int, payload: BomUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_bom_access)):
    result = await db.execute(select(MrpBom).where(MrpBom.id == bom_id))
    bom = result.scalar_one_or_none()
    if not bom: raise HTTPException(404, "BOM not found")
    update_data = payload.dict(exclude_unset=True)
    for field, value in update_data.items():
        setattr(bom, field, value)
    await db.commit()
    return {"ok": True}

@router.delete("/{bom_id}")
async def delete_bom(bom_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_bom_access)):
    result = await db.execute(select(MrpBom).where(MrpBom.id == bom_id))
    bom = result.scalar_one_or_none()
    if not bom: raise HTTPException(404, "BOM not found")
    await db.delete(bom)
    await db.commit()
    return {"ok": True}

@router.get("/lines")
async def list_bom_lines(bom_id: int = Query(...), db: AsyncSession = Depends(get_db), user=Depends(require_bom_access)):
    stmt = select(MrpBomLine).where(MrpBomLine.bom_id == bom_id).order_by(MrpBomLine.line_no)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [{"id":r.id,"bom_id":r.bom_id,"line_no":r.line_no,"product_id":r.product_id,"raw_material_name":r.raw_material_name,"quantity":float(r.quantity),"unit":r.unit,"waste_percent":float(r.waste_percent) if r.waste_percent else 0,"notes":r.notes} for r in rows]

@router.post("/lines")
async def create_bom_line(payload: BomLineCreate, db: AsyncSession = Depends(get_db), user=Depends(require_bom_access)):
    line = MrpBomLine(**payload.dict())
    db.add(line)
    await db.commit()
    await db.refresh(line)
    return {"id":line.id, "bom_id":line.bom_id}

@router.delete("/lines/{line_id}")
async def delete_bom_line(line_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_bom_access)):
    result = await db.execute(select(MrpBomLine).where(MrpBomLine.id == line_id))
    line = result.scalar_one_or_none()
    if not line: raise HTTPException(404, "Line not found")
    await db.delete(line)
    await db.commit()
    return {"ok": True}

@router.get("/{bom_id}/check-availability")
async def check_availability(bom_id: int, quantity: float = 1.0, db: AsyncSession = Depends(get_db), user=Depends(require_bom_access)):
    result = await db.execute(select(MrpBomLine).where(MrpBomLine.bom_id == bom_id, MrpBomLine.is_active == True))
    lines = result.scalars().all()
    availability = []
    for line in lines:
        req_qty = float(line.quantity) * quantity * (1 + float(line.waste_percent or 0)/100)
        stock = 0
        if line.product_id:
            from sqlalchemy import text as sa_text
            stock_query = await db.execute(sa_text("SELECT COALESCE(SUM(quantity),0) FROM stock_moves WHERE product_id = :pid AND state='done'"), {"pid": line.product_id})
            stock = float(stock_query.scalar() or 0)
        availability.append({"line_id": line.id, "material": line.raw_material_name or f"Product #{line.product_id}", "required": round(req_qty, 3), "available": round(stock, 3), "sufficient": stock >= req_qty})
    return {"bom_id": bom_id, "quantity": quantity, "lines": availability}

@router.get("/{bom_id}/cost")
async def calculate_bom_cost(bom_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_bom_access)):
    result = await db.execute(select(MrpBomLine).where(MrpBomLine.bom_id == bom_id, MrpBomLine.is_active == True))
    lines = result.scalars().all()
    total_cost = 0.0
    details = []
    for line in lines:
        unit_cost = 0.0
        if line.product_id:
            from sqlalchemy import text as sa_text
            cost_query = await db.execute(sa_text("SELECT cost FROM products WHERE id = :pid"), {"pid": line.product_id})
            unit_cost = float(cost_query.scalar() or 0)
        line_cost = unit_cost * float(line.quantity)
        total_cost += line_cost
        details.append({"line_id": line.id, "material": line.raw_material_name or f"Product #{line.product_id}", "unit_cost": unit_cost, "quantity": float(line.quantity), "line_cost": round(line_cost, 2)})
    return {"bom_id": bom_id, "total_cost": round(total_cost, 2), "details": details}

@router.get("/{bom_id}/explode")
async def explode_bom(bom_id: int, quantity: float = 1.0, db: AsyncSession = Depends(get_db), user=Depends(require_bom_access)):
    from sqlalchemy import text as sa_text
    stmt = sa_text("SELECT product_id, raw_material_name, quantity, unit, waste_percent FROM mrp_bom_lines WHERE bom_id = :bid AND is_active = true")
    result = await db.execute(stmt, {"bid": bom_id})
    lines = result.mappings().all()
    items = []
    for line in lines:
        qty = float(line["quantity"]) * (1 + float(line["waste_percent"] or 0)/100) * quantity
        items.append({"product_id": line["product_id"], "material_name": line["raw_material_name"], "quantity": qty, "unit": line["unit"]})
    return {"bom_id": bom_id, "quantity": quantity, "components": items}

# نقاط نهاية للإصدارات والمرفقات والمتغيرات التي تم إنشاؤها سابقاً تعمل بشكل منفصل، نضيف هنا اختصار للوصول
@router.get("/{bom_id}/versions")
async def list_bom_versions(bom_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_bom_access)):
    result = await db.execute(text("SELECT * FROM mrp_bom_versions WHERE bom_id = :bid ORDER BY version_number DESC"), {"bid": bom_id})
    return [dict(r) for r in result.mappings()]

@router.get("/{bom_id}/attachments")
async def list_bom_attachments(bom_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_bom_access)):
    result = await db.execute(text("SELECT * FROM mrp_bom_attachments WHERE bom_id = :bid"), {"bid": bom_id})
    return [dict(r) for r in result.mappings()]
