from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.modules.rbac.deps import require_permission
from src.modules.rbac.schemas import DashboardSummaryRead
from src.modules.rbac.service import RBACService

router = APIRouter(prefix="/api/v1/dashboard", tags=["Dashboard"])


@router.get("/summary", response_model=DashboardSummaryRead)
def get_dashboard_summary(
    db: Session = Depends(get_db),
    _: dict = Depends(require_permission("dashboard.read")),
):
    return RBACService(db).dashboard_summary()
