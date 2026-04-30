from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role, is_factory_scoped, get_user_factory_scope_id
from src.core.db.session import get_db
from src.models.user import User
from src.models.pos import PosPaymentMethod, PosSession, PosOrder, PosOrderLine

router = APIRouter(prefix="/admin/pos", tags=["admin-pos"])

async def require_pos_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "pos.view", "pos.manage"):
        raise HTTPException(status_code=403, detail="POS access denied")
    return user

def _scope_filter(stmt, factory_column, current_user):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            stmt = stmt.where(factory_column == scoped_id)
    return stmt

@router.get("/sessions")
async def list_sessions(current_user: User = Depends(require_pos_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(PosSession).order_by(PosSession.id.desc())
    stmt = _scope_filter(stmt, PosSession.factory_id, current_user)
    result = await db.execute(stmt.limit(50))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"factory_id":r.factory_id,"state":r.state,"opened_at":str(r.opened_at) if r.opened_at else None,"closed_at":str(r.closed_at) if r.closed_at else None} for r in rows]

@router.post("/sessions", status_code=201)
async def open_session(payload: dict, current_user: User = Depends(require_pos_view), db: AsyncSession = Depends(get_db)):
    session = PosSession(name=payload["name"], factory_id=payload.get("factory_id"), warehouse_id=payload.get("warehouse_id"), user_id=current_user.id, state="opened", notes=payload.get("notes"))
    db.add(session)
    await db.commit()
    await db.refresh(session)
    return {"id":session.id,"name":session.name,"state":session.state}

@router.put("/sessions/{session_id}/close")
async def close_session(session_id: int, current_user: User = Depends(require_pos_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(PosSession).where(PosSession.id == session_id))
    session = result.scalar_one_or_none()
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    session.state = "closed"
    from datetime import datetime
    session.closed_at = datetime.utcnow()
    await db.commit()
    await db.refresh(session)
    return {"id":session.id,"state":session.state}

@router.get("/orders")
async def list_orders(current_user: User = Depends(require_pos_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(PosOrder).order_by(PosOrder.id.desc())
    stmt = _scope_filter(stmt, PosOrder.factory_id, current_user)
    result = await db.execute(stmt.limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"session_id":r.session_id,"customer_name":r.customer_name,"total_amount":float(r.total_amount or 0),"state":r.state,"payment_method_id":r.payment_method_id,"notes":r.notes,"created_at":str(r.created_at)} for r in rows]

@router.post("/orders", status_code=201)
async def create_order(payload: dict, current_user: User = Depends(require_pos_view), db: AsyncSession = Depends(get_db)):
    order = PosOrder(session_id=payload.get("session_id"), factory_id=payload.get("factory_id"), customer_name=payload.get("customer_name"), state="draft", payment_method_id=payload.get("payment_method_id"), notes=payload.get("notes"))
    db.add(order)
    await db.commit()
    await db.refresh(order)
    return {"id":order.id,"state":order.state}

@router.post("/orders/{order_id}/lines", status_code=201)
async def add_order_line(order_id: int, payload: dict, current_user: User = Depends(require_pos_view), db: AsyncSession = Depends(get_db)):
    line = PosOrderLine(order_id=order_id, product_id=payload.get("product_id"), product_name=payload.get("product_name"), quantity=float(payload.get("quantity",1)), unit_price=float(payload.get("unit_price",0)), notes=payload.get("notes"))
    db.add(line)
    await db.commit()
    await db.refresh(line)
    return {"id":line.id,"product_name":line.product_name,"line_total":float(line.line_total or 0)}

@router.get("/payment-methods")
async def list_payment_methods(current_user: User = Depends(require_pos_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(PosPaymentMethod).order_by(PosPaymentMethod.id.asc()))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"code":r.code} for r in rows]
