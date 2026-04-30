from fastapi import APIRouter, Depends
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    IT_PERMISSION_CODES,
    get_role_permission_codes,
    require_it_view,
    is_factory_scoped,
    get_user_factory_scope_id,
)
from src.core.db.session import get_db
from src.models.user import User, Role, Factory

router = APIRouter(prefix="/admin/it/access-center", tags=["admin-it-access"])


def has_it_permission_codes(permission_codes: set[str] | list[str]) -> bool:
    normalized = {str(code or "").strip().lower() for code in permission_codes}
    return any(code in IT_PERMISSION_CODES for code in normalized)


async def ensure_role_permissions_table(db: AsyncSession):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS role_permissions (
            id SERIAL PRIMARY KEY,
            role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            permission_code VARCHAR(150) NOT NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            UNIQUE(role_id, permission_code)
        )
    """))
    await db.commit()


async def build_access_center_payload(current_user: User, db: AsyncSession):
    await ensure_role_permissions_table(db)

    roles_result = await db.execute(
        select(Role).order_by(Role.id.asc())
    )
    roles = roles_result.scalars().all()

    role_items = []
    role_user_count_map: dict[int, int] = {}

    for role in roles:
        permissions = await get_role_permission_codes(db, role.id)
        normalized_permissions = sorted(
            str(code or "").strip().lower()
            for code in permissions
            if str(code or "").strip()
        )
        it_permissions = [code for code in normalized_permissions if code in IT_PERMISSION_CODES]

        if it_permissions:
            role_items.append({
                "role_id": role.id,
                "role_code": role.code,
                "role_name": role.name,
                "users_count": 0,
                "it_permissions": it_permissions,
            })

    users_stmt = (
        select(User, Role, Factory)
        .join(Role, Role.id == User.role_id)
        .outerjoin(Factory, Factory.id == User.factory_id)
        .order_by(User.id.asc())
    )

    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            users_stmt = users_stmt.where(User.factory_id == scoped_id)

    users_result = await db.execute(users_stmt)
    user_rows = users_result.all()

    user_items = []
    active_users_with_it_access = 0
    superusers_count = 0
    factory_scoped_users_count = 0

    for user, role, factory in user_rows:
        role_permissions = await get_role_permission_codes(db, role.id if role else None)
        normalized_permissions = sorted(
            str(code or "").strip().lower()
            for code in role_permissions
            if str(code or "").strip()
        )
        it_permissions = [code for code in normalized_permissions if code in IT_PERMISSION_CODES]

        has_it_access = bool(user.is_superuser) or bool(it_permissions)
        if not has_it_access:
            continue

        if role and role.id:
            role_user_count_map[role.id] = role_user_count_map.get(role.id, 0) + 1

        if user.is_active:
            active_users_with_it_access += 1

        if user.is_superuser:
            superusers_count += 1

        if is_factory_scoped(user):
            factory_scoped_users_count += 1

        user_items.append({
            "id": user.id,
            "full_name": user.full_name,
            "username": user.username,
            "email": user.email,
            "is_active": bool(user.is_active),
            "is_superuser": bool(user.is_superuser),
            "factory_id": getattr(user, "factory_id", None),
            "factory_name": factory.name if factory else None,
            "role_id": role.id if role else None,
            "role_code": role.code if role else None,
            "role_name": role.name if role else None,
            "scope_label": "Group-Wide" if user.is_superuser or str(getattr(user, "scope", "")).strip().lower() == "group" else ("Factory Scoped" if getattr(user, "factory_id", None) else "No Scope"),
            "it_permissions": ["group.super_admin_override"] if user.is_superuser else it_permissions,
        })

    for item in role_items:
        item["users_count"] = int(role_user_count_map.get(item["role_id"], 0))

    payload = {
        "summary": {
            "active_users_with_it_access": int(active_users_with_it_access),
            "superusers_count": int(superusers_count),
            "factory_scoped_users_count": int(factory_scoped_users_count),
            "total_roles_with_it_permissions": int(len(role_items)),
            "total_users_with_it_access": int(len(user_items)),
            "viewer_factory_scope": get_user_factory_scope_id(current_user),
            "scope_mode": "group" if current_user.is_superuser or str(getattr(current_user, "scope", "")).strip().lower() == "group" else ("factory" if is_factory_scoped(current_user) else "mixed"),
        },
        "roles": role_items,
        "users": user_items,
    }
    return payload


@router.get("")
async def get_it_access_center(
    current_user: User = Depends(require_it_view),
    db: AsyncSession = Depends(get_db),
):
    return await build_access_center_payload(current_user, db)


@router.get("/summary")
async def get_it_access_center_summary(
    current_user: User = Depends(require_it_view),
    db: AsyncSession = Depends(get_db),
):
    return await build_access_center_payload(current_user, db)
