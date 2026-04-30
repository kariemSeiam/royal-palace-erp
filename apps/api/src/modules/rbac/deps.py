from __future__ import annotations

from typing import Callable
from uuid import UUID

from fastapi import Depends, HTTPException, Request, status
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.modules.rbac.service import RBACService


def get_current_user_id(request: Request) -> UUID:
    user = getattr(request.state, "user", None)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")

    user_id = getattr(user, "id", None) or (user.get("id") if isinstance(user, dict) else None)
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authenticated user id missing")
    return UUID(str(user_id))


def require_permission(permission_code: str) -> Callable:
    def dependency(
        request: Request,
        db: Session = Depends(get_db),
    ) -> dict:
        user_id = get_current_user_id(request)
        service = RBACService(db)
        permission_codes = service.get_user_permission_codes(user_id)

        if permission_code not in permission_codes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing required permission: {permission_code}",
            )

        return {
            "user_id": user_id,
            "permissions": permission_codes,
        }

    return dependency
