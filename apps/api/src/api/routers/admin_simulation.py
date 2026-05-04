from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db
import random, asyncio

router = APIRouter(prefix="/admin/simulation", tags=["simulation"])

async def require_access(actor=Depends(get_current_user_and_role)):
    return actor[0]

@router.post("/start-live-oee")
async def start_live_oee(db: AsyncSession = Depends(get_db), user=Depends(require_access)):
    workcenters = await db.execute(text("SELECT id FROM mrp_workcenters WHERE is_active = true"))
    wc_ids = [row[0] for row in workcenters]
    if not wc_ids:
        return {"message": "No active workcenters"}
    for _ in range(20):
        for wc_id in wc_ids:
            availability = round(random.uniform(85, 100), 2)
            performance = round(random.uniform(80, 100), 2)
            quality = round(random.uniform(90, 100), 2)
            oee = round((availability * performance * quality) / 10000, 2)
            await db.execute(text("INSERT INTO mrp_machine_data (machine_id, workcenter_id, metric_name, metric_value) VALUES ('sim', :wid, 'availability', :av), ('sim', :wid, 'performance', :pf), ('sim', :wid, 'quality', :qa), ('sim', :wid, 'oee', :oe)"),
                             {"wid": wc_id, "av": availability, "pf": performance, "qa": quality, "oe": oee})
    await db.commit()
    return {"message": f"Simulated {len(wc_ids)} workcenters x 20 readings"}
