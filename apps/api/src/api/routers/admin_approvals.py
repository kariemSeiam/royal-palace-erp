from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import Any, List, Optional
from pydantic import BaseModel
from src.core.db.session import get_db
from src.api.deps.admin_auth import (
    get_current_user_and_role,
    ensure_not_blocked_admin_role,
    has_any_permission,
)
from src.models.user import User
import datetime

router = APIRouter(prefix="/admin/approvals", tags=["admin-approvals"])

class ApprovalPolicyOut(BaseModel):
    id: int
    module: str
    entity_type: str
    action_code: str
    title: str
    maker_permission_code: Optional[str]
    checker_permission_code: Optional[str]
    is_active: bool

class ApprovalRequestOut(BaseModel):
    id: int
    policy_id: int
    entity_type: str
    entity_id: int
    action_code: str
    status: str
    requested_by_user_id: Optional[int]
    assigned_checker_user_id: Optional[int]
    checked_by_user_id: Optional[int]
    request_reason: Optional[str]
    requested_at: datetime.datetime

async def require_approvals_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser:
        return user
    if not has_any_permission(permissions, "it.view", "it.manage"):
        raise HTTPException(status_code=403, detail="Approvals access denied")
    return user

@router.get("/policies", response_model=List[ApprovalPolicyOut])
def list_policies(db: Session = Depends(get_db), current_user: User = Depends(require_approvals_view)):
    rows = db.execute("SELECT * FROM approval_policies ORDER BY id").fetchall()
    return [dict(row) for row in rows]

@router.get("/requests", response_model=List[ApprovalRequestOut])
def list_requests(
    status: Optional[str] = Query(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approvals_view)
):
    if status:
        rows = db.execute(
            "SELECT * FROM approval_requests WHERE status = :status ORDER BY requested_at DESC",
            {"status": status}
        ).fetchall()
    else:
        rows = db.execute("SELECT * FROM approval_requests ORDER BY requested_at DESC").fetchall()
    return [dict(row) for row in rows]

@router.post("/requests/{request_id}/approve")
def approve_request(request_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_approvals_view)):
    req = db.execute("SELECT * FROM approval_requests WHERE id = :id", {"id": request_id}).fetchone()
    if not req:
        raise HTTPException(404, "طلب غير موجود")
    if req.status != "pending":
        raise HTTPException(400, "الطلب ليس معلقاً")
    db.execute(
        "UPDATE approval_requests SET status='approved', checked_by_user_id=:uid, checked_at=now() WHERE id=:id",
        {"uid": current_user.id, "id": request_id}
    )
    db.commit()
    return {"ok": True}

@router.post("/requests/{request_id}/reject")
def reject_request(
    request_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approvals_view)
):
    req = db.execute("SELECT * FROM approval_requests WHERE id = :id", {"id": request_id}).fetchone()
    if not req:
        raise HTTPException(404, "طلب غير موجود")
    if req.status != "pending":
        raise HTTPException(400, "الطلب ليس معلقاً")
    db.execute(
        "UPDATE approval_requests SET status='rejected', checked_by_user_id=:uid, rejection_reason=:reason, checked_at=now() WHERE id=:id",
        {"uid": current_user.id, "reason": reason, "id": request_id}
    )
    db.commit()
    return {"ok": True}

@router.post("/requests/{request_id}/override")
def override_request(
    request_id: int,
    reason: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_approvals_view)
):
    req = db.execute("SELECT * FROM approval_requests WHERE id = :id", {"id": request_id}).fetchone()
    if not req:
        raise HTTPException(404, "طلب غير موجود")
    if req.status not in ("pending", "rejected"):
        raise HTTPException(400, "الطلب لا يمكن تجاوزه")
    db.execute(
        "UPDATE approval_requests SET status='overridden', checked_by_user_id=:uid, override_reason=:reason, checked_at=now() WHERE id=:id",
        {"uid": current_user.id, "reason": reason, "id": request_id}
    )
    db.commit()
    return {"ok": True}
