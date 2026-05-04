from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db

router = APIRouter(prefix="/admin/mrp/pivot", tags=["mrp-pivot"])

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not has_any_permission(permissions, "work_orders.view", "planning.view"):
        raise HTTPException(403, "Access denied")
    return user

@router.get("/orders-by-status")
async def orders_by_status(db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(text("SELECT status, COUNT(*) as cnt FROM work_orders GROUP BY status"))
    rows = result.mappings().all()
    return [{"status": r["status"], "count": r["cnt"]} for r in rows]

@router.get("/production-by-factory")
async def production_by_factory(db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(text("SELECT f.name, COUNT(wo.id) as total_orders, SUM(wo.product_qty) as total_qty FROM work_orders wo JOIN factories f ON f.id = wo.factory_id GROUP BY f.name"))
    rows = result.mappings().all()
    return [{"factory": r["name"], "total_orders": r["total_orders"], "total_quantity": float(r["total_qty"] or 0)} for r in rows]

@router.get("/scrap-by-workcenter")
async def scrap_by_workcenter(db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(text("SELECT wc.name, SUM(wo.scrap_quantity) as total_scrap FROM mrp_work_orders wo JOIN mrp_workcenters wc ON wc.id = wo.workcenter_id GROUP BY wc.name"))
    rows = result.mappings().all()
    return [{"workcenter": r["name"], "total_scrap": float(r["total_scrap"] or 0)} for r in rows]

@router.get("/oee-by-workcenter")
async def oee_by_workcenter(db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(text("SELECT wc.name, AVG(md.metric_value) as avg_oee FROM mrp_machine_data md JOIN mrp_workcenters wc ON wc.id = md.workcenter_id WHERE md.metric_name='oee' GROUP BY wc.name"))
    rows = result.mappings().all()
    return [{"workcenter": r["name"], "avg_oee": float(r["avg_oee"] or 0)} for r in rows]
