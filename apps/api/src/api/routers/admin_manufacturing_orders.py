from sqlalchemy import select
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime

router = APIRouter(prefix="/admin/manufacturing/orders", tags=["admin-manufacturing-orders"])

ALLOWED_STATUSES = {"draft","confirmed","in_progress","done","cancelled"}
STATUS_TRANSITIONS = {
    "draft": {"confirmed", "cancelled"},
    "confirmed": {"in_progress", "cancelled"},
    "in_progress": {"done", "cancelled"},
    "done": set(),
    "cancelled": set(),
}

async def require_mo_access(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "work_orders.view", "work_orders.manage"):
        raise HTTPException(403, "Manufacturing order access denied")
    return user

class ManufacturingOrderCreate(BaseModel):
    order_id: int
    factory_id: int
    notes: Optional[str] = None
    bom_id: Optional[int] = None
    routing_id: Optional[int] = None
    product_qty: float = 0
    priority: str = "normal"
    planned_start_at: Optional[str] = None
    planned_end_at: Optional[str] = None

class StatusUpdate(BaseModel):
    status: str
    notes: Optional[str] = None

async def reserve_materials(mo_id: int, db: AsyncSession):
    mo = await db.execute(select(text("*")).select_from(text("work_orders")).where(text("id = :id")), {"id": mo_id})
    row = mo.mappings().first()
    if not row or not row.get("bom_id"):
        return
    bom_lines = await db.execute(text("SELECT product_id, quantity, unit FROM mrp_bom_lines WHERE bom_id = :bid AND is_active = true"), {"bid": row["bom_id"]})
    for line in bom_lines.mappings():
        await db.execute(text("INSERT INTO stock_moves (product_id, quantity, state, notes, location_id) VALUES (:pid, :qty, 'reserved', :note, (SELECT id FROM stock_locations LIMIT 1))"),
                         {"pid": line["product_id"], "qty": float(line["quantity"] or 0), "note": f"Reserved for MO-{mo_id}"})
    await db.execute(text("UPDATE work_orders SET stock_move_consumed_id = :moid WHERE id = :id"), {"moid": mo_id, "id": mo_id})

async def generate_work_orders(mo_id: int, db: AsyncSession):
    mo = await db.execute(select(text("*")).select_from(text("work_orders")).where(text("id = :id")), {"id": mo_id})
    row = mo.mappings().first()
    if not row or not row.get("routing_id"):
        return
    steps = await db.execute(text("SELECT * FROM mrp_routing_steps WHERE routing_id = :rid ORDER BY step_no"), {"rid": row["routing_id"]})
    for step in steps.mappings():
        await db.execute(text("INSERT INTO mrp_work_orders (manufacturing_order_id, routing_step_id, workcenter_id, state, planned_start_at, planned_end_at, duration_minutes) VALUES (:mid, :sid, :wid, 'pending', NOW(), NOW() + (:dur * interval '1 minute'), :dur)"),
                         {"mid": mo_id, "sid": step["id"], "wid": step.get("workcenter_id"), "dur": float(step.get("standard_minutes", 0) or 0)})

async def create_shipping_for_mo(mo_id: int, db: AsyncSession):
    mo = await db.execute(select(text("*")).select_from(text("work_orders")).where(text("id = :id")), {"id": mo_id})
    row = mo.mappings().first()
    if not row: return
    order_id = row.get("order_id")
    if not order_id: return
    order = await db.execute(select(text("*")).select_from(text("customer_orders")).where(text("id = :id")), {"id": order_id})
    ord_row = order.mappings().first()
    if not ord_row: return
    loc_src = await db.execute(text("SELECT id FROM stock_locations LIMIT 1"))
    loc_dst = await db.execute(text("SELECT id FROM stock_locations OFFSET 1 LIMIT 1"))
    src_id = loc_src.scalar()
    dst_id = loc_dst.scalar() or src_id
    picking = await db.execute(text("INSERT INTO stock_pickings (factory_id, location_id, location_dest_id, partner_id, state, notes) VALUES (:fid, :sid, :did, :uid, 'draft', 'Shipping from MO-' || :mid) RETURNING id"),
                              {"fid": row.get("factory_id") or 1, "sid": src_id, "did": dst_id, "uid": ord_row.get("user_id"), "mid": str(mo_id)})
    picking_id = picking.scalar_one()
    items = await db.execute(select(text("*")).select_from(text("customer_order_items")).where(text("order_id = :oid")), {"oid": order_id})
    for item in items.mappings():
        await db.execute(text("INSERT INTO stock_moves (picking_id, product_id, quantity, state, notes) VALUES (:pid, :prid, :qty, 'draft', :note)"),
                         {"pid": picking_id, "prid": item["product_id"], "qty": float(item.get("quantity", 0) or 0), "note": f"Ship MO-{mo_id}"})
    await db.execute(text("UPDATE work_orders SET stock_move_produced_id = :pid WHERE id = :id"), {"pid": picking_id, "id": mo_id})

async def run_auto_workflows(trigger_event: str, mo_id: int, db: AsyncSession):
    wfs = await db.execute(text("SELECT * FROM mrp_auto_workflows WHERE trigger_event = :ev AND active = true"), {"ev": trigger_event})
    for wf in wfs.mappings():
        if wf["action_type"] == "notify":
            await db.execute(text("INSERT INTO mrp_quality_alerts (user_id, message) VALUES (NULL, :msg)"), {"msg": f"Workflow '{wf['name']}' triggered for MO {mo_id}"})
        elif wf["action_type"] == "create_activity":
            await db.execute(text("INSERT INTO crm_activities (opportunity_id, activity_type, subject, due_date) VALUES (NULL, 'task', 'Auto: ' || :wfname, CURRENT_DATE + 3)"), {"wfname": wf["name"]})
    await db.commit()

@router.get("")
async def list_mo(db: AsyncSession = Depends(get_db), user=Depends(require_mo_access),
                  status: Optional[str] = None, factory_id: Optional[int] = None, search: Optional[str] = None):
    query = "SELECT wo.*, co.order_number, f.name as factory_name FROM work_orders wo JOIN customer_orders co ON co.id = wo.order_id LEFT JOIN factories f ON f.id = wo.factory_id WHERE 1=1"
    params = {}
    if status:
        query += " AND wo.status = :status"
        params["status"] = status
    if factory_id:
        query += " AND wo.factory_id = :factory_id"
        params["factory_id"] = factory_id
    if search:
        query += " AND (CAST(wo.id AS TEXT) ILIKE :search OR co.order_number ILIKE :search)"
        params["search"] = f"%{search}%"
    query += " ORDER BY wo.id DESC LIMIT 200"
    result = await db.execute(text(query), params)
    rows = result.mappings().all()
    return [dict(row) for row in rows]

@router.post("")
async def create_mo(payload: ManufacturingOrderCreate, db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    result = await db.execute(text(
        "INSERT INTO work_orders (order_id, factory_id, notes, bom_id, routing_id, product_qty, priority, planned_start_at, planned_end_at, status) "
        "VALUES (:order_id, :factory_id, :notes, :bom_id, :routing_id, :product_qty, :priority, :planned_start_at, :planned_end_at, 'draft') RETURNING id"
    ), payload.dict())
    await db.commit()
    mo_id = result.scalar_one()
    return {"id": mo_id}

@router.put("/{mo_id}")
async def update_mo(mo_id: int, payload: dict, db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    res = await db.execute(text("SELECT id FROM work_orders WHERE id = :id"), {"id": mo_id})
    if not res.first():
        raise HTTPException(404, "Order not found")
    set_clause = ", ".join([f"{k} = :{k}" for k in payload if k not in ("id",)])
    if set_clause:
        await db.execute(text(f"UPDATE work_orders SET {set_clause} WHERE id = :id"), {**payload, "id": mo_id})
        await db.commit()
    return {"ok": True}

@router.post("/{mo_id}/status")
async def change_status(mo_id: int, payload: StatusUpdate, db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    if payload.status not in ALLOWED_STATUSES:
        raise HTTPException(400, "Invalid status")
    current = await db.execute(text("SELECT status, bom_id, routing_id, cost_raw_materials, cost_operations FROM work_orders WHERE id = :id"), {"id": mo_id})
    row = current.mappings().first()
    if not row: raise HTTPException(404, "Order not found")
    if payload.status not in STATUS_TRANSITIONS.get(row["status"], set()):
        raise HTTPException(400, f"Cannot transition from {row['status']} to {payload.status}")
    await db.execute(text("UPDATE work_orders SET status = :status, notes = COALESCE(:notes, notes), updated_at = NOW() WHERE id = :id"),
                     {"status": payload.status, "notes": payload.notes, "id": mo_id})
    if payload.status == "confirmed":
        await reserve_materials(mo_id, db)
        await generate_work_orders(mo_id, db)
    if payload.status == "done":
        await create_shipping_for_mo(mo_id, db)
        try:
            total_cost = float(row.get("cost_raw_materials", 0) or 0) + float(row.get("cost_operations", 0) or 0)
            if total_cost > 0:
                entry = await db.execute(text("INSERT INTO accounting_journal_entries (reference, date, amount) VALUES (:ref, CURRENT_DATE, :amt) RETURNING id"), {"ref": f"MO-{mo_id}", "amt": total_cost})
                entry_id = entry.scalar_one()
                await db.execute(text("INSERT INTO accounting_journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (:eid, (SELECT id FROM accounting_chart_accounts WHERE code='5001' LIMIT 1), :amt, 0)"), {"eid": entry_id, "amt": total_cost})
                await db.execute(text("INSERT INTO accounting_journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (:eid, (SELECT id FROM accounting_chart_accounts WHERE code='1001' LIMIT 1), 0, :amt)"), {"eid": entry_id, "amt": total_cost})
                await db.execute(text("UPDATE work_orders SET cost_journal_entry_id = :eid WHERE id = :id"), {"eid": entry_id, "id": mo_id})
        except:
            pass
    await run_auto_workflows(payload.status, mo_id, db)
    await db.commit()
    return {"ok": True, "status": payload.status}

@router.delete("/{mo_id}")
async def delete_mo(mo_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    await db.execute(text("DELETE FROM work_orders WHERE id = :id"), {"id": mo_id})
    await db.commit()
    return {"ok": True}

@router.get("/calendar")
async def calendar_events(db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    result = await db.execute(text("SELECT id, order_id, factory_id, status, planned_start_at, planned_end_at FROM work_orders WHERE planned_start_at IS NOT NULL"))
    rows = result.mappings().all()
    return [{"id":r.id, "title": f"MO #{r.id}", "start": str(r.planned_start_at), "end": str(r.planned_end_at), "status": r.status} for r in rows]

@router.post("/{mo_id}/produce-all-safe")
async def produce_all_safe(mo_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    await db.execute(text("UPDATE work_orders SET status = 'done', updated_at = NOW(), date_finished = NOW() WHERE id = :id"), {"id": mo_id})
    await create_shipping_for_mo(mo_id, db)
    await db.commit()
    return {"ok": True, "status": "done"}

@router.post("/{mo_id}/split")
async def split_mo(mo_id: int, quantity: float, db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    original = await db.execute(select(text("*")).select_from(text("work_orders")).where(text("id = :id")), {"id": mo_id})
    if not original.first(): raise HTTPException(404, "MO not found")
    await db.execute(text("INSERT INTO work_orders (order_id, factory_id, status, notes, priority, product_qty, parent_mo_id, split_type) SELECT order_id, factory_id, 'draft', notes, priority, :qty, :pid, 'split' FROM work_orders WHERE id = :id"), {"qty": quantity, "pid": mo_id, "id": mo_id})
    await db.execute(text("UPDATE work_orders SET product_qty = product_qty - :qty WHERE id = :id"), {"qty": quantity, "id": mo_id})
    await db.commit()
    return {"ok": True}

@router.post("/{parent_id}/merge/{child_id}")
async def merge_mo(parent_id: int, child_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    res = await db.execute(select(text("product_qty")).select_from(text("work_orders")).where(text("id = :id")), {"id": child_id})
    child_row = res.mappings().first()
    if not child_row: raise HTTPException(404, "Child MO not found")
    qty = float(child_row["product_qty"] or 0)
    await db.execute(text("UPDATE work_orders SET product_qty = product_qty + :qty WHERE id = :id"), {"qty": qty, "id": parent_id})
    await db.execute(text("DELETE FROM work_orders WHERE id = :id"), {"id": child_id})
    await db.commit()
    return {"ok": True}

@router.post("/{mo_id}/produce-partial")
async def produce_partial(mo_id: int, quantity: float, db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    mo = await db.execute(select(text("*")).select_from(text("work_orders")).where(text("id = :id")), {"id": mo_id})
    row = mo.mappings().first()
    if not row: raise HTTPException(404, "MO not found")
    total_qty = float(row["product_qty"] or 0)
    if quantity >= total_qty:
        await db.execute(text("UPDATE work_orders SET status = 'done', updated_at = NOW(), date_finished = NOW() WHERE id = :id"), {"id": mo_id})
        await create_shipping_for_mo(mo_id, db)
        await db.commit()
        return {"ok": True, "status": "done"}
    await db.execute(text("UPDATE work_orders SET product_qty = product_qty - :qty WHERE id = :id"), {"qty": quantity, "id": mo_id})
    await db.execute(text("INSERT INTO work_orders (order_id, factory_id, status, notes, priority, product_qty, parent_mo_id, split_type) SELECT order_id, factory_id, 'draft', notes, priority, :qty, :pid, 'backorder' FROM work_orders WHERE id = :id"), {"qty": quantity, "pid": mo_id, "id": mo_id})
    await db.commit()
    return {"ok": True, "remaining": total_qty - quantity}

@router.post("/{mo_id}/produce-with-stock")
async def produce_with_stock(mo_id: int, quantity: float, db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    mo = await db.execute(select(text("*")).select_from(text("work_orders")).where(text("id = :id")), {"id": mo_id})
    row = mo.mappings().first()
    if not row: raise HTTPException(404, "MO not found")
    order_id = int(row.get("order_id", 0))
    product_id = None
    if order_id:
        item = await db.execute(select(text("product_id")).select_from(text("customer_order_items")).where(text("order_id = :oid")).limit(1), {"oid": order_id})
        product_id = item.scalar()
    if not product_id:
        product_id = int(row.get("product_id", 0))
    if not product_id:
        raise HTTPException(400, "No product linked to this order")
    await db.execute(text("INSERT INTO stock_moves (product_id, quantity, state, notes) VALUES (:pid, :qty, 'done', :ref)"), {"pid": product_id, "qty": quantity, "ref": f"MO-{mo_id}"})
    await db.execute(text("UPDATE work_orders SET status = 'done', updated_at = NOW(), date_finished = NOW() WHERE id = :id"), {"id": mo_id})
    await create_shipping_for_mo(mo_id, db)
    await db.commit()
    return {"ok": True, "stock_move": "created"}

@router.post("/{mo_id}/create-accounting-entry")
async def create_accounting_entry(mo_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    mo = await db.execute(select(text("*")).select_from(text("work_orders")).where(text("id = :id")), {"id": mo_id})
    row = mo.mappings().first()
    if not row: raise HTTPException(404, "MO not found")
    total_cost = float(row.get("cost_raw_materials", 0) or 0) + float(row.get("cost_operations", 0) or 0)
    if total_cost <= 0:
        raise HTTPException(400, "No cost to record")
    entry = await db.execute(text("INSERT INTO accounting_journal_entries (reference, date, amount) VALUES (:ref, CURRENT_DATE, :amt) RETURNING id"), {"ref": f"MO-{mo_id}", "amt": total_cost})
    entry_id = entry.scalar_one()
    await db.execute(text("INSERT INTO accounting_journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (:eid, (SELECT id FROM accounting_chart_accounts WHERE code='5001' LIMIT 1), :amt, 0)"), {"eid": entry_id, "amt": total_cost})
    await db.execute(text("INSERT INTO accounting_journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (:eid, (SELECT id FROM accounting_chart_accounts WHERE code='1001' LIMIT 1), 0, :amt)"), {"eid": entry_id, "amt": total_cost})
    await db.execute(text("UPDATE work_orders SET cost_journal_entry_id = :eid WHERE id = :id"), {"eid": entry_id, "id": mo_id})
    await db.commit()
    return {"ok": True, "journal_entry_id": entry_id}

@router.get("/{mo_id}/backward-schedule")
async def backward_schedule(mo_id: int, delivery_date: str, db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    from datetime import datetime, timedelta
    routing_steps = await db.execute(text("SELECT rs.* FROM mrp_routing_steps rs JOIN mrp_routings r ON r.id = rs.routing_id JOIN work_orders wo ON wo.routing_id = r.id WHERE wo.id = :mo_id ORDER BY rs.step_no DESC"), {"mo_id": mo_id})
    steps = routing_steps.mappings().all()
    if not steps:
        return {"message": "No routing steps found"}
    end_date = datetime.fromisoformat(delivery_date)
    schedule = []
    for step in steps:
        duration = float(step.get("standard_minutes", 0) or 0)
        start_date = end_date - timedelta(minutes=duration)
        schedule.append({"step_no": step["step_no"], "step_name": step["step_name"], "start": start_date.isoformat(), "end": end_date.isoformat()})
        end_date = start_date
    schedule.reverse()
    return {"schedule": schedule}

@router.post("/{mo_id}/subcontract")
async def subcontract_operation(mo_id: int, service_name: str, supplier_id: int, price: float, db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    mo = await db.execute(select(text("*")).select_from(text("work_orders")).where(text("id = :id")), {"id": mo_id})
    row = mo.mappings().first()
    if not row: raise HTTPException(404, "MO not found")
    factory_id = row.get("factory_id") or 1
    wh = await db.execute(text("SELECT id FROM warehouses LIMIT 1"))
    warehouse_id = wh.scalar() or 1
    po_number = f"SC-{mo_id}-{supplier_id}"
    await db.execute(text("INSERT INTO purchase_orders (factory_id, supplier_id, warehouse_id, po_number, status, notes) VALUES (:fid, :sid, :wid, :ponum, 'draft', :note)"),
                     {"fid": factory_id, "sid": supplier_id, "wid": warehouse_id, "ponum": po_number, "note": f"Subcontract MO {mo_id}: {service_name}"})
    await db.commit()
    return {"ok": True, "purchase_order": "created"}

@router.post("/from-opportunity/{opportunity_id}")
async def create_mo_from_opportunity(opportunity_id: int, db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    opp = await db.execute(select(text("*")).select_from(text("crm_opportunities")).where(text("id = :id")), {"id": opportunity_id})
    row = opp.mappings().first()
    if not row: raise HTTPException(404, "Opportunity not found")
    order_id = None
    if row.get("order_id"):
        order_id = int(row["order_id"])
    else:
        new_order = await db.execute(text("INSERT INTO customer_orders (customer_id, order_number, status) VALUES ((SELECT customer_id FROM crm_leads WHERE id = (SELECT lead_id FROM crm_opportunities WHERE id = :oid)), 'OPP-'||:oid, 'draft') RETURNING id"), {"oid": opportunity_id})
        order_id = new_order.scalar_one()
        await db.execute(text("UPDATE crm_opportunities SET order_id = :oid WHERE id = :id"), {"oid": order_id, "id": opportunity_id})
    mo = await db.execute(text("INSERT INTO work_orders (order_id, factory_id, status, notes, source_doc) VALUES (:oid, (SELECT factory_id FROM crm_opportunities WHERE id = :oppid), 'draft', 'From Opportunity #'||:oid, 'CRM') RETURNING id"), {"oid": order_id, "oppid": opportunity_id})
    await db.commit()
    return {"id": mo.scalar_one()}

@router.get("/gantt-data")
async def gantt_data(db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    result = await db.execute(text("SELECT id, order_id, factory_id, status, planned_start_at, planned_end_at, product_qty FROM work_orders WHERE planned_start_at IS NOT NULL ORDER BY planned_start_at"))
    rows = result.mappings().all()
    return [{"id":r.id, "text": f"MO #{r.id}", "start_date": str(r.planned_start_at)[:10] if r.planned_start_at else None, "end_date": str(r.planned_end_at)[:10] if r.planned_end_at else None, "progress": 1 if r.status == "done" else 0.5, "parent": 0, "type": "project"} for r in rows]

@router.get("/pivot-data")
async def pivot_data(db: AsyncSession = Depends(get_db), user=Depends(require_mo_access)):
    by_status = await db.execute(text("SELECT status, COUNT(*) as cnt FROM work_orders GROUP BY status"))
    status_rows = by_status.mappings().all()
    by_factory = await db.execute(text("SELECT f.name, COUNT(wo.id) as cnt, SUM(wo.product_qty) as total_qty FROM work_orders wo JOIN factories f ON f.id = wo.factory_id GROUP BY f.name"))
    factory_rows = by_factory.mappings().all()
    return {
        "by_status": [dict(r) for r in status_rows],
        "by_factory": [{"name": r["name"], "count": r["cnt"], "total_quantity": float(r["total_qty"] or 0)} for r in factory_rows]
    }
