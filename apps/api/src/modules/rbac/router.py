from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.permissions import require_permission
from src.modules.rbac.models import Role, Permission, attach_user_role_relationships
from src.modules.rbac.schemas import (
    AssignUserRolesIn,
    RoleCreate,
    RoleOut,
    RoleUpdate,
    PermissionOut,
    UserRoleOut,
)
from src.modules.rbac.service import (
    get_role_by_code,
    list_permissions,
    list_roles,
    seed_permissions_and_roles,
)
from src.core.db.session import get_db

User = None
user_candidates = [
    "src.models.user",
    "src.modules.users.models",
]

for mod_name in user_candidates:
    try:
        module = __import__(mod_name, fromlist=["User"])
        User = getattr(module, "User", None)
        if User is not None:
            break
    except Exception:
        pass

router = APIRouter(prefix="/admin/rbac", tags=["RBAC"])

if User is not None:
    attach_user_role_relationships(User)


@router.post("/seed", status_code=200)
async def seed_rbac(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("super_admin.access")),
):
    await seed_permissions_and_roles(db)
    return {"status": "ok", "message": "RBAC seed completed"}


@router.get("/permissions", response_model=list[PermissionOut])
async def get_permissions(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("roles.view")),
):
    return await list_permissions(db)


@router.get("/roles", response_model=list[RoleOut])
async def get_roles(
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("roles.view")),
):
    return await list_roles(db)


@router.post("/roles", response_model=RoleOut, status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: RoleCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("roles.create")),
):
    existing = await db.execute(select(Role).where(Role.code == payload.code.strip().lower()))
    existing_role = existing.scalar_one_or_none()
    if existing_role:
        raise HTTPException(status_code=400, detail="Role code already exists")

    permissions = []
    if payload.permission_codes:
        permissions_result = await db.execute(
            select(Permission).where(Permission.code.in_(payload.permission_codes))
        )
        permissions = list(permissions_result.scalars().all())

    role = Role(
        code=payload.code.strip().lower(),
        name=payload.name.strip(),
        description=payload.description.strip() if payload.description else None,
        is_system=False,
        is_active=True,
    )
    role.permissions = permissions
    db.add(role)
    await db.commit()
    await db.refresh(role)

    role_result = await db.execute(
        select(Role)
        .where(Role.id == role.id)
        .options(selectinload(Role.permissions))
    )
    return role_result.scalar_one()


@router.put("/roles/{role_code}", response_model=RoleOut)
async def update_role(
    role_code: str,
    payload: RoleUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("roles.update")),
):
    role = await get_role_by_code(db, role_code)
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if payload.name is not None:
        role.name = payload.name.strip()

    if payload.description is not None:
        role.description = payload.description.strip() if payload.description else None

    if payload.is_active is not None:
        role.is_active = payload.is_active

    if payload.permission_codes is not None:
        permissions_result = await db.execute(
            select(Permission).where(Permission.code.in_(payload.permission_codes))
        )
        role.permissions = list(permissions_result.scalars().all())

    db.add(role)
    await db.commit()
    await db.refresh(role)

    return await get_role_by_code(db, role.code)


@router.post("/users/{user_id}/roles", response_model=UserRoleOut)
async def assign_roles_to_user(
    user_id: int,
    payload: AssignUserRolesIn,
    db: AsyncSession = Depends(get_db),
    _=Depends(require_permission("users.assign_roles")),
):
    if User is None:
        raise HTTPException(status_code=500, detail="User model import failed")

    user_result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles).selectinload(Role.permissions))
    )
    user = user_result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    roles = []
    if payload.role_codes:
        roles_result = await db.execute(
            select(Role)
            .where(Role.code.in_(payload.role_codes))
            .options(selectinload(Role.permissions))
        )
        roles = list(roles_result.scalars().unique().all())

    user.roles = roles
    db.add(user)
    await db.commit()
    await db.refresh(user)

    refreshed_user_result = await db.execute(
        select(User)
        .where(User.id == user_id)
        .options(selectinload(User.roles).selectinload(Role.permissions))
    )
    refreshed_user = refreshed_user_result.scalar_one()

    permission_codes = sorted(
        {
            p.code
            for role in refreshed_user.roles
            for p in getattr(role, "permissions", []) or []
            if getattr(p, "is_active", False)
        }
    )

    return UserRoleOut(
        user_id=refreshed_user.id,
        role_codes=[r.code for r in refreshed_user.roles],
        permissions=permission_codes,
    )
