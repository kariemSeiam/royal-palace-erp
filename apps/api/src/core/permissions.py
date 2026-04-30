from __future__ import annotations

from typing import Callable
from fastapi import Depends, HTTPException, status


def _resolve_get_db():
    candidates = [
        "src.core.db.session",
    ]
    for mod_name in candidates:
        try:
            module = __import__(mod_name, fromlist=["get_db"])
            fn = getattr(module, "get_db", None)
            if fn is not None:
                return fn
        except Exception:
            pass
    raise RuntimeError("Could not import get_db from known DB modules")


def _resolve_get_current_user():
    candidates = [
        "src.modules.auth.dependencies",
        "src.modules.auth.deps",
        "src.modules.auth.router",
        "src.modules.auth.service",
        "src.auth.dependencies",
        "src.auth.deps",
    ]
    for mod_name in candidates:
        try:
            module = __import__(mod_name, fromlist=["get_current_user"])
            fn = getattr(module, "get_current_user", None)
            if fn is not None:
                return fn
        except Exception:
            pass
    return None


def require_permission(permission_code: str) -> Callable:
    get_db = _resolve_get_db()
    get_current_user = _resolve_get_current_user()

    async def checker(
        current_user=Depends(get_current_user) if get_current_user else None,
        db=Depends(get_db),
    ):
        if get_current_user is None:
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail="get_current_user dependency is not configured",
            )

        roles = getattr(current_user, "roles", []) or []
        permission_codes = set()

        for role in roles:
            for permission in getattr(role, "permissions", []) or []:
                if getattr(permission, "is_active", False):
                    permission_codes.add(permission.code)

        if "super_admin.access" in permission_codes:
            return current_user

        if permission_code not in permission_codes:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Missing permission: {permission_code}",
            )

        return current_user

    return checker
