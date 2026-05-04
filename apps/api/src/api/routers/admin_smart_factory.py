from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission
from src.core.db.session import get_db
from datetime import date

router = APIRouter(prefix="/admin/smart-factory", tags=["smart-factory"])

async def require_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser: return user
    if not has_any_permission(permissions, "work_orders.view", "planning.view"):
        raise HTTPException(403, "Access denied")
    return user

@router.get("/live-oee")
async def live_oee(workcenter_id: int = None, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    query = """
    SELECT wc.id, wc.name,
           COALESCE(md.availability, 100) as availability,
           COALESCE(md.performance, 100) as performance,
           COALESCE(md.quality, 100) as quality,
           COALESCE(md.oee, 100) as oee
    FROM mrp_workcenters wc
    LEFT JOIN (
        SELECT workcenter_id,
               AVG(metric_value) FILTER (WHERE metric_name='availability') as availability,
               AVG(metric_value) FILTER (WHERE metric_name='performance') as performance,
               AVG(metric_value) FILTER (WHERE metric_name='quality') as quality,
               AVG(metric_value) FILTER (WHERE metric_name='oee') as oee
        FROM mrp_machine_data
        WHERE timestamp > now() - interval '1 hour'
        GROUP BY workcenter_id
    ) md ON md.workcenter_id = wc.id
    """
    if workcenter_id:
        query += " WHERE wc.id = :wid"
        result = await db.execute(text(query), {"wid": workcenter_id})
    else:
        result = await db.execute(text(query))
    rows = result.mappings().all()
    return [dict(r) for r in rows]

@router.post("/machine-data")
async def ingest_machine_data(machine_id: str, metric_name: str, metric_value: float, workcenter_id: int = None, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    await db.execute(text("INSERT INTO mrp_machine_data (machine_id, workcenter_id, metric_name, metric_value) VALUES (:mid, :wid, :mn, :mv)"), {"mid": machine_id, "wid": workcenter_id, "mn": metric_name, "mv": metric_value})
    await db.commit()
    thresholds = await db.execute(text("SELECT metric_name, min_value, max_value, alert_message FROM maintenance_iot_thresholds WHERE active = true AND metric_name = :mn"), {"mn": metric_name})
    for th in thresholds.mappings():
        if metric_value < float(th["min_value"] or 0) or metric_value > float(th["max_value"] or 999999):
            await db.execute(text("INSERT INTO mrp_quality_alerts (user_id, message) VALUES (NULL, :msg)"), {"msg": f"{th['alert_message']} (value {metric_value})"})
    await db.commit()
    return {"ok": True}

@router.get("/predictive-maintenance")
async def predictive_alerts(db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(text("SELECT e.name, t.metric_name, t.alert_message FROM maintenance_iot_thresholds t JOIN maintenance_equipment e ON e.id = t.equipment_id WHERE t.active = true"))
    return [dict(r) for r in result.mappings()]

@router.get("/digital-twin")
async def digital_twin(factory_id: int = Query(...), db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(text("SELECT * FROM mrp_factory_layout WHERE factory_id = :fid"), {"fid": factory_id})
    rows = result.mappings().all()
    return [{"id":r["id"],"name":r["name"],"pos_x":float(r["pos_x"]),"pos_y":float(r["pos_y"]),"width":float(r["width"]),"height":float(r["height"]),"element_type":r["element_type"],"state":r["state"]} for r in rows]

@router.get("/demand-forecast")
async def demand_forecast(product_id: int, days: int = 30, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    result = await db.execute(text("SELECT forecast_date, predicted_quantity, confidence FROM mrp_demand_forecasts WHERE product_id = :pid AND forecast_date >= CURRENT_DATE ORDER BY forecast_date LIMIT :days"), {"pid": product_id, "days": days})
    rows = result.mappings().all()
    return [{"date": str(r["forecast_date"]), "quantity": float(r["predicted_quantity"]), "confidence": float(r["confidence"])} for r in rows]

@router.post("/auto-workflow")
async def create_auto_workflow(name: str, trigger_event: str, action_type: str, condition_json: str = None, action_params: str = None, db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    await db.execute(text("INSERT INTO mrp_auto_workflows (name, trigger_event, condition_json, action_type, action_params) VALUES (:name, :event, :cond, :atype, :aparams)"), {"name": name, "event": trigger_event, "cond": condition_json, "atype": action_type, "aparams": action_params})
    await db.commit()
    return {"ok": True}
