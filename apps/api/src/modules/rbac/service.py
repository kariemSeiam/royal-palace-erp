from __future__ import annotations

from sqlalchemy import select
from sqlalchemy.orm import selectinload
from sqlalchemy.ext.asyncio import AsyncSession

from src.modules.rbac.models import Permission, Role


DEFAULT_PERMISSIONS = [
    {"code": "dashboard.view", "name": "View Dashboard", "module": "dashboard"},
    {"code": "users.view", "name": "View Users", "module": "users"},
    {"code": "users.create", "name": "Create Users", "module": "users"},
    {"code": "users.update", "name": "Update Users", "module": "users"},
    {"code": "users.assign_roles", "name": "Assign Roles To Users", "module": "users"},
    {"code": "roles.view", "name": "View Roles", "module": "roles"},
    {"code": "roles.create", "name": "Create Roles", "module": "roles"},
    {"code": "roles.update", "name": "Update Roles", "module": "roles"},
    {"code": "roles.manage_permissions", "name": "Manage Role Permissions", "module": "roles"},
    {"code": "catalog.view", "name": "View Catalog", "module": "catalog"},
    {"code": "catalog.manage", "name": "Manage Catalog", "module": "catalog"},
    {"code": "orders.view", "name": "View Orders", "module": "orders"},
    {"code": "employees.view", "name": "View Employees", "module": "employees"},
    {"code": "attendance.view", "name": "View Attendance", "module": "attendance"},
    {"code": "super_admin.access", "name": "Super Admin Access", "module": "platform"},
]


async def seed_permissions_and_roles(db: AsyncSession) -> None:
    existing_result = await db.execute(select(Permission))
    existing = {p.code: p for p in existing_result.scalars().all()}

    for item in DEFAULT_PERMISSIONS:
        if item["code"] not in existing:
            db.add(
                Permission(
                    code=item["code"],
                    name=item["name"],
                    module=item["module"],
                    is_active=True,
                )
            )

    await db.commit()

    perms_result = await db.execute(select(Permission))
    perms = perms_result.scalars().all()
    by_code = {p.code: p for p in perms}

    super_admin_result = await db.execute(
        select(Role).where(Role.code == "super_admin").options(selectinload(Role.permissions))
    )
    super_admin = super_admin_result.scalar_one_or_none()

    if not super_admin:
        super_admin = Role(
            code="super_admin",
            name="Super Admin",
            description="Full platform access",
            is_system=True,
            is_active=True,
        )
        db.add(super_admin)
        await db.commit()
        await db.refresh(super_admin)

    super_admin.permissions = list(by_code.values())

    admin_result = await db.execute(
        select(Role).where(Role.code == "admin").options(selectinload(Role.permissions))
    )
    admin = admin_result.scalar_one_or_none()

    if not admin:
        admin = Role(
            code="admin",
            name="Admin",
            description="Administrative access without full platform control",
            is_system=True,
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        await db.refresh(admin)

    admin.permissions = [
        by_code["dashboard.view"],
        by_code["users.view"],
        by_code["roles.view"],
        by_code["catalog.view"],
        by_code["catalog.manage"],
        by_code["orders.view"],
        by_code["employees.view"],
        by_code["attendance.view"],
    ]

    await db.commit()


async def get_role_by_code(db: AsyncSession, code: str) -> Role | None:
    result = await db.execute(
        select(Role)
        .where(Role.code == code)
        .options(selectinload(Role.permissions))
    )
    return result.scalar_one_or_none()


async def list_roles(db: AsyncSession) -> list[Role]:
    result = await db.execute(
        select(Role)
        .options(selectinload(Role.permissions))
        .order_by(Role.id.asc())
    )
    return list(result.scalars().unique().all())


async def list_permissions(db: AsyncSession) -> list[Permission]:
    result = await db.execute(
        select(Permission).order_by(Permission.module.asc(), Permission.code.asc())
    )
    return list(result.scalars().all())
