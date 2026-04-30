from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role, is_factory_scoped, get_user_factory_scope_id
from src.core.db.session import get_db
from src.models.user import User
from src.models.maintenance import MaintenanceEquipment, MaintenanceRepair

router = APIRouter(prefix="/admin/maintenance", tags=["admin-maintenance"])

async def require_maintenance_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "maintenance.view", "maintenance.manage"):
        raise HTTPException(status_code=403, detail="Maintenance access denied")
    return user

def _scope_filter(stmt, factory_column, current_user):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            stmt = stmt.where(factory_column == scoped_id)
    return stmt

@router.get("/equipment")
async def list_equipment(current_user: User = Depends(require_maintenance_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(MaintenanceEquipment).order_by(MaintenanceEquipment.id.asc())
    stmt = _scope_filter(stmt, MaintenanceEquipment.factory_id, current_user)
    result = await db.execute(stmt.limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"code":r.code,"factory_id":r.factory_id,"description":r.description,"status":r.status} for r in rows]

@router.post("/equipment", status_code=status.HTTP_201_CREATED)
async def create_equipment(payload: dict, current_user: User = Depends(require_maintenance_view), db: AsyncSession = Depends(get_db)):
    eq = MaintenanceEquipment(name=payload["name"], code=payload["code"], factory_id=payload.get("factory_id"), description=payload.get("description"), status=payload.get("status","operational"))
    db.add(eq)
    await db.commit()
    await db.refresh(eq)
    return {"id":eq.id,"name":eq.name,"code":eq.code}

@router.put("/equipment/{equipment_id}")
async def update_equipment(equipment_id: int, payload: dict, current_user: User = Depends(require_maintenance_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(MaintenanceEquipment).where(MaintenanceEquipment.id == equipment_id))
    eq = result.scalar_one_or_none()
    if not eq: raise HTTPException(status_code=404, detail="Equipment not found")
    for field in ["name","code","factory_id","description","status"]:
        if field in payload: setattr(eq, field, payload[field])
    await db.commit()
    await db.refresh(eq)
    return {"id":eq.id,"name":eq.name,"code":eq.code}

@router.delete("/equipment/{equipment_id}")
async def delete_equipment(equipment_id: int, current_user: User = Depends(require_maintenance_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(MaintenanceEquipment).where(MaintenanceEquipment.id == equipment_id))
    eq = result.scalar_one_or_none()
    if not eq: raise HTTPException(status_code=404, detail="Equipment not found")
    await db.delete(eq)
    await db.commit()
    return {"message":"Equipment deleted"}

@router.get("/repairs")
async def list_repairs(current_user: User = Depends(require_maintenance_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(MaintenanceRepair).order_by(MaintenanceRepair.id.desc())
    stmt = _scope_filter(stmt, MaintenanceRepair.factory_id, current_user)
    result = await db.execute(stmt.limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"equipment_id":r.equipment_id,"assigned_user_id":r.assigned_user_id,"description":r.description,"status":r.status,"priority":r.priority,"started_at":str(r.started_at) if r.started_at else None,"completed_at":str(r.completed_at) if r.completed_at else None,"notes":r.notes} for r in rows]

@router.post("/repairs", status_code=status.HTTP_201_CREATED)
async def create_repair(payload: dict, current_user: User = Depends(require_maintenance_view), db: AsyncSession = Depends(get_db)):
    repair = MaintenanceRepair(equipment_id=payload["equipment_id"], factory_id=payload.get("factory_id"), assigned_user_id=payload.get("assigned_user_id"), description=payload.get("description"), status=payload.get("status","pending"), priority=payload.get("priority","normal"), started_at=payload.get("started_at"), completed_at=payload.get("completed_at"), notes=payload.get("notes"))
    db.add(repair)
    await db.commit()
    await db.refresh(repair)
    return {"id":repair.id,"equipment_id":repair.equipment_id,"status":repair.status}

@router.put("/repairs/{repair_id}")
async def update_repair(repair_id: int, payload: dict, current_user: User = Depends(require_maintenance_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(MaintenanceRepair).where(MaintenanceRepair.id == repair_id))
    repair = result.scalar_one_or_none()
    if not repair: raise HTTPException(status_code=404, detail="Repair not found")
    for field in ["equipment_id","factory_id","assigned_user_id","description","status","priority","started_at","completed_at","notes"]:
        if field in payload: setattr(repair, field, payload[field])
    await db.commit()
    await db.refresh(repair)
    return {"id":repair.id,"equipment_id":repair.equipment_id,"status":repair.status}

@router.delete("/repairs/{repair_id}")
async def delete_repair(repair_id: int, current_user: User = Depends(require_maintenance_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(MaintenanceRepair).where(MaintenanceRepair.id == repair_id))
    repair = result.scalar_one_or_none()
    if not repair: raise HTTPException(status_code=404, detail="Repair not found")
    await db.delete(repair)
    await db.commit()
    return {"message":"Repair deleted"}
