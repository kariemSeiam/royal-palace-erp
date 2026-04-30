from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role, is_factory_scoped, get_user_factory_scope_id
from src.core.db.session import get_db
from src.models.user import User
from src.models.field_service import FieldServiceOrder, FieldServiceTask, FieldServiceTeam, FieldServiceWorker

router = APIRouter(prefix="/admin/field-service", tags=["admin-field-service"])

async def require_field_service_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "field_service.view", "field_service.manage"):
        raise HTTPException(status_code=403, detail="Field service access denied")
    return user

def _scope_filter(stmt, factory_column, current_user):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            stmt = stmt.where(factory_column == scoped_id)
    return stmt

@router.get("/orders")
async def list_orders(current_user: User = Depends(require_field_service_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(FieldServiceOrder).order_by(FieldServiceOrder.id.desc())
    stmt = _scope_filter(stmt, FieldServiceOrder.factory_id, current_user)
    result = await db.execute(stmt.limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"team_id":r.team_id,"assigned_worker_id":r.assigned_worker_id,"customer_name":r.customer_name,"customer_phone":r.customer_phone,"address":r.address,"scheduled_date":str(r.scheduled_date) if r.scheduled_date else None,"status":r.status,"priority":r.priority,"description":r.description,"resolution_notes":r.resolution_notes,"created_at":str(r.created_at)} for r in rows]

@router.post("/orders", status_code=status.HTTP_201_CREATED)
async def create_order(payload: dict, current_user: User = Depends(require_field_service_view), db: AsyncSession = Depends(get_db)):
    order = FieldServiceOrder(team_id=payload.get("team_id"), assigned_worker_id=payload.get("assigned_worker_id"), factory_id=payload.get("factory_id"), customer_name=payload["customer_name"], customer_phone=payload.get("customer_phone"), address=payload.get("address"), scheduled_date=payload.get("scheduled_date"), status=payload.get("status","pending"), priority=payload.get("priority","normal"), description=payload.get("description"), resolution_notes=payload.get("resolution_notes"))
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return {"id":order.id,"customer_name":order.customer_name,"status":order.status}

@router.put("/orders/{order_id}")
async def update_order(order_id: int, payload: dict, current_user: User = Depends(require_field_service_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(FieldServiceOrder).where(FieldServiceOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    for field in ["team_id","assigned_worker_id","customer_name","customer_phone","address","scheduled_date","status","priority","description","resolution_notes"]:
        if field in payload: setattr(order, field, payload[field])
    await db.commit()
    await db.refresh(order)
    return {"id":order.id,"status":order.status}

@router.delete("/orders/{order_id}")
async def delete_order(order_id: int, current_user: User = Depends(require_field_service_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(FieldServiceOrder).where(FieldServiceOrder.id == order_id))
    order = result.scalar_one_or_none()
    if not order: raise HTTPException(status_code=404, detail="Order not found")
    await db.delete(order)
    await db.commit()
    return {"message":"Order deleted"}

@router.get("/teams")
async def list_teams(current_user: User = Depends(require_field_service_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(FieldServiceTeam).order_by(FieldServiceTeam.id.asc()))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"code":r.code} for r in rows]

@router.get("/workers")
async def list_workers(current_user: User = Depends(require_field_service_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(FieldServiceWorker).order_by(FieldServiceWorker.id.asc()))
    rows = result.scalars().all()
    return [{"id":r.id,"user_id":r.user_id,"team_id":r.team_id,"employee_id":r.employee_id} for r in rows]
