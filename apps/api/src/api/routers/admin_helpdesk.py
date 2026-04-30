from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role, is_factory_scoped, get_user_factory_scope_id
from src.core.db.session import get_db
from src.models.user import User

router = APIRouter(prefix="/admin/helpdesk", tags=["admin-helpdesk"])


async def require_helpdesk_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser:
        return user
    if not has_any_permission(permissions, "helpdesk.view", "helpdesk.manage"):
        raise HTTPException(status_code=403, detail="Helpdesk access denied")
    return user


def _scope_filter(stmt, factory_column, current_user):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            stmt = stmt.where(factory_column == scoped_id)
    return stmt


@router.get("/tickets")
async def list_tickets(current_user: User = Depends(require_helpdesk_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    from src.models.helpdesk import HelpdeskTicket
    stmt = sa_select(HelpdeskTicket).order_by(HelpdeskTicket.id.desc())
    stmt = _scope_filter(stmt, HelpdeskTicket.factory_id, current_user)
    result = await db.execute(stmt.limit(100))
    rows = result.scalars().all()
    return [{"id": r.id, "team_id": r.team_id, "subject": r.subject, "status": r.status, "priority": r.priority, "ticket_type": r.ticket_type, "customer_name": r.customer_name, "customer_email": r.customer_email, "assigned_to_user_id": r.assigned_to_user_id, "created_at": str(r.created_at)} for r in rows]


@router.post("/tickets", status_code=status.HTTP_201_CREATED)
async def create_ticket(payload: dict, current_user: User = Depends(require_helpdesk_view), db: AsyncSession = Depends(get_db)):
    from src.models.helpdesk import HelpdeskTicket
    ticket = HelpdeskTicket(
        team_id=payload.get("team_id"),
        factory_id=payload.get("factory_id"),
        assigned_to_user_id=payload.get("assigned_to_user_id"),
        subject=payload["subject"],
        description=payload.get("description"),
        status=payload.get("status", "new"),
        priority=payload.get("priority", "normal"),
        ticket_type=payload.get("ticket_type", "issue"),
        customer_name=payload.get("customer_name"),
        customer_email=payload.get("customer_email"),
        customer_phone=payload.get("customer_phone"),
        resolution_notes=payload.get("resolution_notes"),
    )
    db.add(ticket)
    await db.commit()
    await db.refresh(ticket)
    return {"id": ticket.id, "subject": ticket.subject, "status": ticket.status}


@router.put("/tickets/{ticket_id}")
async def update_ticket(ticket_id: int, payload: dict, current_user: User = Depends(require_helpdesk_view), db: AsyncSession = Depends(get_db)):
    from src.models.helpdesk import HelpdeskTicket
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(HelpdeskTicket).where(HelpdeskTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    for field in ["team_id", "assigned_to_user_id", "subject", "description", "status", "priority", "ticket_type", "customer_name", "customer_email", "customer_phone", "resolution_notes"]:
        if field in payload:
            setattr(ticket, field, payload[field])
    await db.commit()
    await db.refresh(ticket)
    return {"id": ticket.id, "subject": ticket.subject, "status": ticket.status}


@router.delete("/tickets/{ticket_id}")
async def delete_ticket(ticket_id: int, current_user: User = Depends(require_helpdesk_view), db: AsyncSession = Depends(get_db)):
    from src.models.helpdesk import HelpdeskTicket
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(HelpdeskTicket).where(HelpdeskTicket.id == ticket_id))
    ticket = result.scalar_one_or_none()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
    await db.delete(ticket)
    await db.commit()
    return {"message": "Ticket deleted"}


@router.get("/teams")
async def list_teams(current_user: User = Depends(require_helpdesk_view), db: AsyncSession = Depends(get_db)):
    from src.models.helpdesk import HelpdeskTeam
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(HelpdeskTeam).order_by(HelpdeskTeam.id.asc()))
    rows = result.scalars().all()
    return [{"id": r.id, "name": r.name, "code": r.code} for r in rows]
