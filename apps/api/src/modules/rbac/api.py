from __future__ import annotations

from typing import Optional
from uuid import UUID

from fastapi import APIRouter, Depends, Response, status
from sqlalchemy.orm import Session

from src.db.session import get_db
from src.modules.rbac.deps import require_permission
from src.modules.rbac.schemas import (
    AssignPermissionsPayload,
    PermissionRead,
    RoleCreate,
    RoleRead,
    RoleUpdate,
    RoleWithPermissionsRead,
    UserRoleAssignPayload,
    UserRoleRead,
)
from src.modules.rbac.service import RBACService

router = APIRouter(prefix="/api/v1/rbac", tags=["RBAC"])


@router.get("/roles", response_model=list[RoleWithPermissionsRead])
def list_roles(
    db: Session = Depends(get_db),
    _: dict = Depends(require_permission("roles.read")),
):
    roles = RBACService(db).list_roles()
    result = []
    for role in roles:
        result.append(
            {
                "id": role.id,
                "code": role.code,
                "name": role.name,
                "description": role.description,
                "is_system": role.is_system,
                "is_active": role.is_active,
                "created_at": role.created_at,
                "permissions": [rp.permission for rp in role.permissions if rp.permission],
            }
        )
    return result


@router.get("/roles/{role_id}", response_model=RoleWithPermissionsRead)
def get_role(
    role_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(require_permission("roles.read")),
):
    role = RBACService(db).get_role(role_id)
    return {
        "id": role.id,
        "code": role.code,
        "name": role.name,
        "description": role.description,
        "is_system": role.is_system,
        "is_active": role.is_active,
        "created_at": role.created_at,
        "permissions": [rp.permission for rp in role.permissions if rp.permission],
    }


@router.post("/roles", response_model=RoleRead, status_code=status.HTTP_201_CREATED)
def create_role(
    payload: RoleCreate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_permission("roles.create")),
):
    return RBACService(db).create_role(payload)


@router.put("/roles/{role_id}", response_model=RoleRead)
def update_role(
    role_id: UUID,
    payload: RoleUpdate,
    db: Session = Depends(get_db),
    _: dict = Depends(require_permission("roles.update")),
):
    return RBACService(db).update_role(role_id, payload)


@router.get("/permissions", response_model=list[PermissionRead])
def list_permissions(
    db: Session = Depends(get_db),
    _: dict = Depends(require_permission("roles.read")),
):
    return RBACService(db).list_permissions()


@router.put("/roles/{role_id}/permissions", response_model=list[PermissionRead])
def assign_permissions(
    role_id: UUID,
    payload: AssignPermissionsPayload,
    db: Session = Depends(get_db),
    _: dict = Depends(require_permission("roles.assign_permissions")),
):
    return RBACService(db).assign_permissions(role_id, payload.permission_ids)


@router.post("/user-roles", response_model=UserRoleRead, status_code=status.HTTP_201_CREATED)
def assign_user_role(
    payload: UserRoleAssignPayload,
    db: Session = Depends(get_db),
    auth: dict = Depends(require_permission("users.assign_roles")),
):
    return RBACService(db).assign_user_role(payload, assigned_by=auth["user_id"])


@router.get("/user-roles", response_model=list[UserRoleRead])
def list_user_roles(
    user_id: Optional[UUID] = None,
    db: Session = Depends(get_db),
    _: dict = Depends(require_permission("users.read")),
):
    return RBACService(db).list_user_roles(user_id=user_id)


@router.delete("/user-roles/{user_role_id}", status_code=status.HTTP_204_NO_CONTENT)
def revoke_user_role(
    user_role_id: UUID,
    db: Session = Depends(get_db),
    _: dict = Depends(require_permission("users.assign_roles")),
):
    RBACService(db).revoke_user_role(user_role_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)
