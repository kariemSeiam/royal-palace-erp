from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select, func, desc
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.notification import Notification, InternalMessage
from src.models.user import User

router = APIRouter(prefix="/admin", tags=["admin-notifications"])


async def require_notifications_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser:
        return user
    if not has_any_permission(permissions, "notifications.view", "notifications.manage"):
        raise HTTPException(status_code=403, detail="Notifications access denied")
    return user


@router.get("/notifications")
async def list_notifications(
    current_user: User = Depends(require_notifications_view),
    db: AsyncSession = Depends(get_db),
    include_read: bool = False,
    limit: int = 50,
):
    stmt = select(Notification).where(Notification.user_id == current_user.id)
    if not include_read:
        stmt = stmt.where(Notification.is_read == False)
    stmt = stmt.order_by(desc(Notification.created_at)).limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "id": row.id,
            "title": row.title,
            "body": row.body,
            "notification_type": row.notification_type,
            "reference_type": row.reference_type,
            "reference_id": row.reference_id,
            "is_read": row.is_read,
            "created_at": str(row.created_at),
        }
        for row in rows
    ]


@router.put("/notifications/{notification_id}/read")
async def mark_notification_read(
    notification_id: int,
    current_user: User = Depends(require_notifications_view),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Notification).where(Notification.id == notification_id, Notification.user_id == current_user.id))
    notif = result.scalar_one_or_none()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    notif.is_read = True
    await db.commit()
    return {"message": "تم تحديد الإشعار كمقروء"}


@router.put("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(require_notifications_view),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        select(Notification).where(Notification.user_id == current_user.id, Notification.is_read == False)
    )
    result = await db.execute(
        select(Notification).where(Notification.user_id == current_user.id, Notification.is_read == False)
    )
    rows = result.scalars().all()
    for row in rows:
        row.is_read = True
    await db.commit()
    return {"message": f"تم تحديد {len(rows)} إشعار كمقروء"}


@router.get("/notifications/unread-count")
async def unread_notifications_count(
    current_user: User = Depends(require_notifications_view),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(func.count(Notification.id)).where(
            Notification.user_id == current_user.id,
            Notification.is_read == False,
        )
    )
    count = result.scalar() or 0
    return {"unread_count": int(count)}


@router.get("/messages")
async def list_messages(
    current_user: User = Depends(require_notifications_view),
    db: AsyncSession = Depends(get_db),
    limit: int = 100,
):
    stmt = select(InternalMessage).where(
        (InternalMessage.sender_user_id == current_user.id) | (InternalMessage.recipient_user_id == current_user.id)
    ).order_by(desc(InternalMessage.created_at)).limit(limit)
    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [
        {
            "id": row.id,
            "sender_user_id": row.sender_user_id,
            "recipient_user_id": row.recipient_user_id,
            "message_text": row.message_text,
            "is_read": row.is_read,
            "created_at": str(row.created_at),
        }
        for row in rows
    ]


@router.post("/messages", status_code=status.HTTP_201_CREATED)
async def send_message(
    payload: dict,
    current_user: User = Depends(require_notifications_view),
    db: AsyncSession = Depends(get_db),
):
    recipient_id = payload.get("recipient_user_id")
    message_text = payload.get("message_text", "").strip()
    if not message_text:
        raise HTTPException(status_code=400, detail="Message text is required")
    msg = InternalMessage(
        sender_user_id=current_user.id,
        recipient_user_id=int(recipient_id) if recipient_id else None,
        message_text=message_text,
    )
    db.add(msg)
    await db.commit()
    await db.refresh(msg)
    return {
        "id": msg.id,
        "sender_user_id": msg.sender_user_id,
        "recipient_user_id": msg.recipient_user_id,
        "message_text": msg.message_text,
        "is_read": msg.is_read,
        "created_at": str(msg.created_at),
    }
