from fastapi import APIRouter, Depends, HTTPException, status
from passlib.context import CryptContext
from sqlalchemy import select, text, func, or_
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    require_roles_manage,
    require_roles_view,
    require_users_manage,
    require_users_view,
)
from src.core.db.session import get_db
from src.models.erp_org import Employee
from src.models.user import Factory, Role, User

router = APIRouter(prefix="/admin/users", tags=["admin-users"])

DEFAULT_PERMISSION_CATALOG = [
    {"code": "dashboard.view", "name": "عرض لوحة التحكم", "module": "dashboard", "is_active": True},
    {"code": "users.view", "name": "عرض المستخدمين", "module": "users", "is_active": True},
    {"code": "users.manage", "name": "إدارة المستخدمين", "module": "users", "is_active": True},
    {"code": "roles.view", "name": "عرض الأدوار", "module": "roles", "is_active": True},
    {"code": "roles.manage", "name": "إدارة الأدوار والصلاحيات", "module": "roles", "is_active": True},
    {"code": "factories.view", "name": "عرض المصانع", "module": "factories", "is_active": True},
    {"code": "factories.manage", "name": "إدارة المصانع", "module": "factories", "is_active": True},
    {"code": "categories.view", "name": "عرض الأقسام الرئيسية", "module": "categories", "is_active": True},
    {"code": "categories.manage", "name": "إدارة الأقسام الرئيسية", "module": "categories", "is_active": True},
    {"code": "departments.view", "name": "عرض الأقسام", "module": "departments", "is_active": True},
    {"code": "departments.manage", "name": "إدارة الأقسام", "module": "departments", "is_active": True},
    {"code": "employees.view", "name": "عرض الموظفين", "module": "employees", "is_active": True},
    {"code": "employees.manage", "name": "إدارة الموظفين", "module": "employees", "is_active": True},
    {"code": "attendance.view", "name": "عرض الحضور", "module": "attendance", "is_active": True},
    {"code": "attendance.manage", "name": "إدارة الحضور", "module": "attendance", "is_active": True},
    {"code": "products.view", "name": "عرض المنتجات", "module": "products", "is_active": True},
    {"code": "products.manage", "name": "إدارة المنتجات", "module": "products", "is_active": True},
    {"code": "orders.view", "name": "عرض الطلبات", "module": "orders", "is_active": True},
    {"code": "orders.manage", "name": "إدارة الطلبات", "module": "orders", "is_active": True},
    {"code": "b2b.view", "name": "عرض حسابات B2B", "module": "b2b", "is_active": True},
    {"code": "b2b.manage", "name": "إدارة حسابات B2B", "module": "b2b", "is_active": True},
    {"code": "it.view", "name": "عرض قسم تقنية المعلومات", "module": "it", "is_active": True},
    {"code": "it.manage", "name": "إدارة قسم تقنية المعلومات", "module": "it", "is_active": True},
    {"code": "infrastructure.view", "name": "عرض البنية التحتية", "module": "infrastructure", "is_active": True},
    {"code": "infrastructure.manage", "name": "إدارة البنية التحتية", "module": "infrastructure", "is_active": True},
    {"code": "servers.view", "name": "عرض الخوادم", "module": "servers", "is_active": True},
    {"code": "servers.manage", "name": "إدارة الخوادم", "module": "servers", "is_active": True},
    {"code": "backups.view", "name": "عرض النسخ الاحتياطية", "module": "backups", "is_active": True},
    {"code": "backups.manage", "name": "إدارة النسخ الاحتياطية", "module": "backups", "is_active": True},
    {"code": "logs.view", "name": "عرض السجلات", "module": "logs", "is_active": True},
    {"code": "monitoring.view", "name": "عرض المراقبة", "module": "monitoring", "is_active": True},
    {"code": "deployments.view", "name": "عرض النشرات", "module": "deployments", "is_active": True},
    {"code": "deployments.manage", "name": "إدارة النشرات", "module": "deployments", "is_active": True},
    {"code": "catalog.view", "name": "عرض الكتالوج", "module": "catalog", "is_active": True},
    {"code": "catalog.manage", "name": "إدارة الكتالوج", "module": "catalog", "is_active": True},
    {"code": "media.view", "name": "عرض الوسائط", "module": "media", "is_active": True},
    {"code": "media.manage", "name": "إدارة الوسائط", "module": "media", "is_active": True},
    {"code": "themes.view", "name": "عرض الثيمات", "module": "themes", "is_active": True},
    {"code": "themes.manage", "name": "إدارة الثيمات", "module": "themes", "is_active": True},
    {"code": "branding.view", "name": "عرض الهوية البصرية", "module": "branding", "is_active": True},
    {"code": "branding.manage", "name": "إدارة الهوية البصرية", "module": "branding", "is_active": True},
    {"code": "pages.view", "name": "عرض الصفحات", "module": "pages", "is_active": True},
    {"code": "pages.manage", "name": "إدارة الصفحات", "module": "pages", "is_active": True},
    {"code": "layout.manage", "name": "إدارة التخطيط العام", "module": "layout", "is_active": True},
    {"code": "ui_settings.manage", "name": "إدارة إعدادات الواجهة", "module": "ui_settings", "is_active": True},
    {"code": "global_settings.manage", "name": "إدارة الإعدادات العامة", "module": "global_settings", "is_active": True},
    {"code": "supervisor.override", "name": "السماح بتجاوز صلاحيات المستخدمين", "module": "users", "is_active": True},
]

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def is_factory_scoped(user: User) -> bool:
    scope = getattr(user, "scope", None)
    if str(scope or "").strip().lower() == "group":
        return False
    return (not user.is_superuser) and getattr(user, "factory_id", None) is not None


def normalize_factory_id(value):
    if value in ["", None]:
        return None
    return int(value)


def role_is_super_admin(role: Role | None) -> bool:
    code = str(getattr(role, "code", "") or "").strip().lower()
    return code in {"super_admin", "superadmin"}


def serialize_user_row(user: User, role: Role, factory: Factory | None, employee: Employee | None):
    employee_name = None
    if employee:
        employee_name = f"{employee.first_name} {employee.last_name}"

    return {
        "id": user.id,
        "email": user.email,
        "username": getattr(user, "username", None),
        "full_name": user.full_name,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "scope": getattr(user, "scope", "factory"),
        "supervisor_override": getattr(user, "supervisor_override", False),
        "data_ownership": getattr(user, "data_ownership", "factory"),
        "role_id": role.id,
        "role_name": role.name,
        "role_code": role.code,
        "employee_id": getattr(user, "employee_id", None),
        "employee_name": employee_name,
        "factory_id": getattr(user, "factory_id", None),
        "factory_name": factory.name if factory else None,
    }


def serialize_role_row(role: Role, users_count: int = 0):
    return {
        "id": role.id,
        "name": role.name,
        "code": role.code,
        "is_active": getattr(role, "is_active", True),
        "users_count": int(users_count or 0),
    }


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


async def ensure_permissions_catalog_table(db: AsyncSession):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS admin_permissions_catalog (
            id SERIAL PRIMARY KEY,
            code VARCHAR(150) NOT NULL UNIQUE,
            name VARCHAR(255) NOT NULL,
            module VARCHAR(120) NOT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
        )
    """))

    for item in DEFAULT_PERMISSION_CATALOG:
        await db.execute(
            text("""
                INSERT INTO admin_permissions_catalog (code, name, module, is_active)
                VALUES (:code, :name, :module, :is_active)
                ON CONFLICT (code) DO UPDATE
                SET name = EXCLUDED.name,
                    module = EXCLUDED.module,
                    is_active = EXCLUDED.is_active,
                    updated_at = NOW()
            """),
            item,
        )

    await db.commit()


async def list_permissions_from_db(db: AsyncSession):
    await ensure_permissions_catalog_table(db)
    result = await db.execute(
        text("""
            SELECT id, code, name, module, is_active, created_at, updated_at
            FROM admin_permissions_catalog
            ORDER BY module ASC, code ASC
        """)
    )
    return [dict(row) for row in result.mappings().all()]


async def get_permission_by_id(db: AsyncSession, permission_id: int):
    await ensure_permissions_catalog_table(db)
    result = await db.execute(
        text("""
            SELECT id, code, name, module, is_active, created_at, updated_at
            FROM admin_permissions_catalog
            WHERE id = :permission_id
        """),
        {"permission_id": permission_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Permission not found")
    return dict(row)


async def get_allowed_permission_codes(db: AsyncSession):
    rows = await list_permissions_from_db(db)
    return {row["code"] for row in rows if row.get("is_active", True)}


def resolve_scope(payload_scope: str | None, is_superuser: bool, current_admin: User | None) -> str:
    if is_superuser:
        return "group"
    if not current_admin.is_superuser:
        return "factory"
    raw = str(payload_scope or "factory").strip().lower()
    if raw not in ("factory", "group"):
        raw = "factory"
    return raw


async def resolve_factory(
    db: AsyncSession,
    factory_id_raw,
    *,
    current_admin: User | None = None,
):
    requested_factory_id = normalize_factory_id(factory_id_raw)

    if current_admin and is_factory_scoped(current_admin):
        forced_factory_id = int(current_admin.factory_id)
        if requested_factory_id is not None and requested_factory_id != forced_factory_id:
            raise HTTPException(status_code=403, detail="Cannot assign user outside your factory scope")
        requested_factory_id = forced_factory_id

    if requested_factory_id is None:
        return None, None

    result = await db.execute(select(Factory).where(Factory.id == requested_factory_id))
    factory = result.scalar_one_or_none()
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")

    return requested_factory_id, factory


async def resolve_employee(
    db: AsyncSession,
    employee_id_raw,
    factory_id,
    *,
    current_admin: User | None = None,
):
    if employee_id_raw in ["", None]:
        return None, None

    employee_id = int(employee_id_raw)
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    employee = result.scalar_one_or_none()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found")

    if current_admin and is_factory_scoped(current_admin):
        if employee.factory_id != current_admin.factory_id:
            raise HTTPException(status_code=403, detail="Cannot link employee outside your factory scope")

    if factory_id is not None and employee.factory_id != factory_id:
        raise HTTPException(
            status_code=400,
            detail="Selected employee does not belong to the selected factory",
        )

    return employee_id, employee


async def get_role_or_404(db: AsyncSession, role_id: int) -> Role:
    result = await db.execute(select(Role).where(Role.id == role_id))
    role = result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")
    return role


def enforce_manageable_target_scope(
    current_admin: User,
    *,
    target_user: User | None = None,
    target_employee: Employee | None = None,
    target_factory_id: int | None = None,
):
    if current_admin.is_superuser:
        return

    target_scope = None
    if target_user is not None:
        target_scope = getattr(target_user, "scope", "factory")
    if str(target_scope or "").strip().lower() == "group":
        return

    scoped_factory_id = getattr(current_admin, "factory_id", None)
    if scoped_factory_id is None:
        return

    if target_user is not None:
        user_factory_id = getattr(target_user, "factory_id", None)
        if user_factory_id != scoped_factory_id:
            raise HTTPException(status_code=403, detail="Cannot manage user outside your factory scope")

    if target_employee is not None and target_employee.factory_id != scoped_factory_id:
        raise HTTPException(status_code=403, detail="Cannot manage employee link outside your factory scope")

    if target_factory_id is not None and target_factory_id != scoped_factory_id:
        raise HTTPException(status_code=403, detail="Cannot manage data outside your factory scope")


def can_manage_supervisor_override(actor: User) -> bool:
    if actor.is_superuser:
        return True
    # Check permission from role_permissions (will be loaded via dependency)
    return False  # will be replaced in endpoint


# ====================== Endpoints ======================

@router.get("/roles")
async def list_roles(
    _: User = Depends(require_roles_view),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Role, func.count(User.id).label("users_count"))
        .outerjoin(User, User.role_id == Role.id)
        .group_by(Role.id)
        .order_by(Role.id.asc())
    )
    rows = result.all()
    return [serialize_role_row(role, users_count) for role, users_count in rows]


@router.post("/roles", status_code=status.HTTP_201_CREATED)
async def create_role(
    payload: dict,
    _: User = Depends(require_roles_manage),
    db: AsyncSession = Depends(get_db),
):
    name = str(payload.get("name", "")).strip()
    code = str(payload.get("code", "")).strip().lower()
    is_active = bool(payload.get("is_active", True))

    if not name or not code:
        raise HTTPException(status_code=400, detail="Missing required role fields")

    existing_name = await db.execute(select(Role).where(Role.name == name))
    if existing_name.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Role name already exists")

    existing_code = await db.execute(select(Role).where(Role.code == code))
    if existing_code.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Role code already exists")

    role = Role(name=name, code=code, is_active=is_active)
    db.add(role)
    await db.commit()
    await db.refresh(role)

    return {**serialize_role_row(role, 0), "message": "Role created successfully"}


@router.put("/roles/{role_id}")
async def update_role(
    role_id: int,
    payload: dict,
    _: User = Depends(require_roles_manage),
    db: AsyncSession = Depends(get_db),
):
    role = await get_role_or_404(db, role_id)

    name = str(payload.get("name", role.name)).strip()
    code = str(payload.get("code", role.code)).strip().lower()
    is_active = bool(payload.get("is_active", role.is_active))

    if not name or not code:
        raise HTTPException(status_code=400, detail="Missing required role fields")

    existing_name = await db.execute(select(Role).where(Role.name == name, Role.id != role_id))
    if existing_name.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Role name already exists")

    existing_code = await db.execute(select(Role).where(Role.code == code, Role.id != role_id))
    if existing_code.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Role code already exists")

    role.name = name
    role.code = code
    role.is_active = is_active

    await db.commit()
    await db.refresh(role)

    users_count_result = await db.execute(select(func.count(User.id)).where(User.role_id == role.id))
    users_count = users_count_result.scalar_one()

    return {**serialize_role_row(role, users_count), "message": "Role updated successfully"}


@router.delete("/roles/{role_id}")
async def delete_role(
    role_id: int,
    _: User = Depends(require_roles_manage),
    db: AsyncSession = Depends(get_db),
):
    role = await get_role_or_404(db, role_id)

    linked_users_result = await db.execute(select(func.count(User.id)).where(User.role_id == role.id))
    linked_users_count = linked_users_result.scalar_one()

    if linked_users_count > 0:
        raise HTTPException(status_code=409, detail="Cannot delete role because it is assigned to one or more users")

    await db.execute(text("DELETE FROM role_permissions WHERE role_id = :role_id"), {"role_id": role.id})
    await db.delete(role)
    await db.commit()

    return {"message": "Role deleted successfully"}


@router.get("/permissions/catalog")
async def list_permission_catalog(
    _: User = Depends(require_roles_view),
    db: AsyncSession = Depends(get_db),
):
    return await list_permissions_from_db(db)


@router.post("/permissions/catalog", status_code=status.HTTP_201_CREATED)
async def create_permission_catalog_item(
    payload: dict,
    _: User = Depends(require_roles_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_permissions_catalog_table(db)

    code = str(payload.get("code", "")).strip().lower()
    name = str(payload.get("name", "")).strip()
    module = str(payload.get("module", "")).strip().lower()
    is_active = bool(payload.get("is_active", True))

    if not code or not name or not module:
        raise HTTPException(status_code=400, detail="Missing required permission fields")

    existing = await db.execute(
        text("SELECT id FROM admin_permissions_catalog WHERE code = :code"),
        {"code": code},
    )
    if existing.first():
        raise HTTPException(status_code=409, detail="Permission code already exists")

    await db.execute(
        text("""
            INSERT INTO admin_permissions_catalog (code, name, module, is_active)
            VALUES (:code, :name, :module, :is_active)
        """),
        {"code": code, "name": name, "module": module, "is_active": is_active},
    )
    await db.commit()

    result = await db.execute(
        text("""
            SELECT id, code, name, module, is_active, created_at, updated_at
            FROM admin_permissions_catalog
            WHERE code = :code
        """),
        {"code": code},
    )
    row = result.mappings().first()
    return dict(row)


@router.put("/permissions/catalog/{permission_id}")
async def update_permission_catalog_item(
    permission_id: int,
    payload: dict,
    _: User = Depends(require_roles_manage),
    db: AsyncSession = Depends(get_db),
):
    current = await get_permission_by_id(db, permission_id)

    code = str(payload.get("code", current["code"])).strip().lower()
    name = str(payload.get("name", current["name"])).strip()
    module = str(payload.get("module", current["module"])).strip().lower()
    is_active = bool(payload.get("is_active", current["is_active"]))

    if not code or not name or not module:
        raise HTTPException(status_code=400, detail="Missing required permission fields")

    existing = await db.execute(
        text("""
            SELECT id
            FROM admin_permissions_catalog
            WHERE code = :code AND id != :permission_id
        """),
        {"code": code, "permission_id": permission_id},
    )
    if existing.first():
        raise HTTPException(status_code=409, detail="Permission code already exists")

    old_code = current["code"]

    await db.execute(
        text("""
            UPDATE admin_permissions_catalog
            SET code = :code,
                name = :name,
                module = :module,
                is_active = :is_active,
                updated_at = NOW()
            WHERE id = :permission_id
        """),
        {
            "permission_id": permission_id,
            "code": code,
            "name": name,
            "module": module,
            "is_active": is_active,
        },
    )

    if old_code != code:
        await db.execute(
            text("""
                UPDATE role_permissions
                SET permission_code = :new_code
                WHERE permission_code = :old_code
            """),
            {"old_code": old_code, "new_code": code},
        )

    await db.commit()
    return await get_permission_by_id(db, permission_id)


@router.delete("/permissions/catalog/{permission_id}")
async def delete_permission_catalog_item(
    permission_id: int,
    _: User = Depends(require_roles_manage),
    db: AsyncSession = Depends(get_db),
):
    current = await get_permission_by_id(db, permission_id)

    linked = await db.execute(
        text("""
            SELECT COUNT(*) AS total
            FROM role_permissions
            WHERE permission_code = :code
        """),
        {"code": current["code"]},
    )
    linked_count = linked.scalar_one()

    if linked_count > 0:
        raise HTTPException(
            status_code=409,
            detail="Cannot delete permission because it is assigned to one or more roles",
        )

    await db.execute(
        text("DELETE FROM admin_permissions_catalog WHERE id = :permission_id"),
        {"permission_id": permission_id},
    )
    await db.commit()

    return {"message": "Permission deleted successfully"}


@router.get("/roles/{role_id}/permissions")
async def get_role_permissions(
    role_id: int,
    _: User = Depends(require_roles_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_role_permissions_table(db)
    role = await get_role_or_404(db, role_id)

    result = await db.execute(
        text("""
            SELECT permission_code
            FROM role_permissions
            WHERE role_id = :role_id
            ORDER BY permission_code ASC
        """),
        {"role_id": role_id},
    )
    rows = result.mappings().all()

    return {
        "role_id": role.id,
        "permissions": [row["permission_code"] for row in rows],
    }


@router.put("/roles/{role_id}/permissions")
async def update_role_permissions(
    role_id: int,
    payload: dict,
    _: User = Depends(require_roles_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_role_permissions_table(db)
    role = await get_role_or_404(db, role_id)

    permissions = payload.get("permissions", [])
    if not isinstance(permissions, list):
        raise HTTPException(status_code=400, detail="Permissions must be a list")

    normalized_permissions = []
    for code in permissions:
        value = str(code or "").strip().lower()
        if value:
            normalized_permissions.append(value)

    permissions = list(dict.fromkeys(normalized_permissions))

    allowed_codes = await get_allowed_permission_codes(db)
    invalid_codes = [code for code in permissions if code not in allowed_codes]
    if invalid_codes:
        raise HTTPException(status_code=400, detail=f"Invalid permission codes: {', '.join(invalid_codes)}")

    await db.execute(
        text("DELETE FROM role_permissions WHERE role_id = :role_id"),
        {"role_id": role.id},
    )

    for code in permissions:
        await db.execute(
            text("""
                INSERT INTO role_permissions (role_id, permission_code)
                VALUES (:role_id, :permission_code)
            """),
            {"role_id": role.id, "permission_code": code},
        )

    await db.commit()

    return {
        "role_id": role.id,
        "permissions": permissions,
        "message": "Role permissions updated successfully",
    }


@router.get("/factories")
async def list_factories_for_users(
    current_admin: User = Depends(require_users_view),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Factory).order_by(Factory.id.asc())
    if is_factory_scoped(current_admin):
        stmt = stmt.where(Factory.id == current_admin.factory_id)

    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        {"id": row.id, "name": row.name, "code": row.code, "is_active": row.is_active}
        for row in rows
    ]


@router.get("/employees")
async def list_employees_for_linking(
    current_admin: User = Depends(require_users_view),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Employee).order_by(Employee.id.asc())
    if is_factory_scoped(current_admin):
        stmt = stmt.where(Employee.factory_id == current_admin.factory_id)

    result = await db.execute(stmt)
    rows = result.scalars().all()

    return [
        {
            "id": row.id,
            "employee_code": row.employee_code,
            "full_name": f"{row.first_name} {row.last_name}",
            "factory_id": row.factory_id,
            "department_id": row.department_id,
            "is_active": row.is_active,
        }
        for row in rows
    ]


@router.get("")
async def list_users(
    current_admin: User = Depends(require_users_view),
    db: AsyncSession = Depends(get_db),
):
    stmt = (
        select(User, Role, Factory, Employee)
        .join(Role, Role.id == User.role_id)
        .outerjoin(Factory, Factory.id == User.factory_id)
        .outerjoin(Employee, Employee.id == User.employee_id)
        .order_by(User.id.asc())
    )

    if is_factory_scoped(current_admin):
        stmt = stmt.where(
            or_(
                User.factory_id == current_admin.factory_id,
                Employee.factory_id == current_admin.factory_id,
            )
        )

    result = await db.execute(stmt)
    rows = result.all()

    return [serialize_user_row(user, role, factory, employee) for user, role, factory, employee in rows]


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: dict,
    current_admin: User = Depends(require_users_manage),
    db: AsyncSession = Depends(get_db),
):
    email = str(payload.get("email", "")).strip().lower()
    username = str(payload.get("username", "")).strip()
    full_name = str(payload.get("full_name", "")).strip()
    password = str(payload.get("password", "")).strip()
    role_id = payload.get("role_id")
    factory_id_raw = payload.get("factory_id")
    employee_id_raw = payload.get("employee_id")
    is_active = bool(payload.get("is_active", True))
    requested_is_superuser = bool(payload.get("is_superuser", False))
    requested_scope = str(payload.get("scope", "factory")).strip().lower()
    supervisor_override = bool(payload.get("supervisor_override", False))
    data_ownership = str(payload.get("data_ownership", "factory")).strip().lower()

    if not email or not username or not full_name or not password or not role_id:
        raise HTTPException(status_code=400, detail="Missing required fields")

    existing_email = await db.execute(select(User).where(User.email == email))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already exists")

    existing_username = await db.execute(select(User).where(User.username == username))
    if existing_username.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already exists")

    role_result = await db.execute(select(Role).where(Role.id == int(role_id)))
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role_is_super_admin(role) and not current_admin.is_superuser:
        raise HTTPException(status_code=403, detail="Only super admin can assign super admin role")

    if requested_is_superuser and not current_admin.is_superuser:
        raise HTTPException(status_code=403, detail="Only super admin can create super admin users")

    effective_scope = resolve_scope(requested_scope, requested_is_superuser, current_admin)

    if effective_scope == "group":
        factory_id = None
        factory = None
        employee_id = None
        employee = None
    else:
        factory_id, factory = await resolve_factory(db, factory_id_raw, current_admin=current_admin)
        employee_id, employee = await resolve_employee(
            db, employee_id_raw, factory_id, current_admin=current_admin,
        )

        enforce_manageable_target_scope(
            current_admin,
            target_employee=employee,
            target_factory_id=factory_id,
        )

        if employee_id is not None:
            existing_employee_link = await db.execute(select(User).where(User.employee_id == employee_id))
            if existing_employee_link.scalar_one_or_none():
                raise HTTPException(status_code=409, detail="Employee already linked to another user")

    user = User(
        email=email,
        username=username,
        full_name=full_name,
        password_hash=pwd_context.hash(password),
        role_id=role.id,
        employee_id=employee_id,
        factory_id=factory_id,
        is_active=is_active,
        is_superuser=bool(requested_is_superuser) if current_admin.is_superuser else False,
        scope=effective_scope,
        supervisor_override=supervisor_override if (current_admin.is_superuser or current_admin.supervisor_override) else False,
        data_ownership=data_ownership,
    )

    db.add(user)
    await db.commit()
    await db.refresh(user)

    return {
        **serialize_user_row(user, role, factory, employee),
        "message": "User created successfully",
    }


@router.put("/{user_id}")
async def update_user(
    user_id: int,
    payload: dict,
    current_admin: User = Depends(require_users_manage),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User, Employee)
        .outerjoin(Employee, Employee.id == User.employee_id)
        .where(User.id == user_id)
    )
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    user, current_employee = row

    enforce_manageable_target_scope(
        current_admin,
        target_user=user,
        target_employee=current_employee,
        target_factory_id=getattr(user, "factory_id", None),
    )

    email = str(payload.get("email", user.email)).strip().lower()
    username = str(payload.get("username", user.username)).strip()
    full_name = str(payload.get("full_name", user.full_name)).strip()
    role_id = payload.get("role_id", user.role_id)
    factory_id_raw = payload.get("factory_id", user.factory_id)
    employee_id_raw = payload.get("employee_id", user.employee_id)
    is_active = bool(payload.get("is_active", user.is_active))
    requested_is_superuser = bool(payload.get("is_superuser", user.is_superuser))
    requested_scope = str(payload.get("scope", getattr(user, "scope", "factory"))).strip().lower()
    password = str(payload.get("password", "")).strip()
    supervisor_override = payload.get("supervisor_override", getattr(user, "supervisor_override", False))
    data_ownership = str(payload.get("data_ownership", getattr(user, "data_ownership", "factory"))).strip().lower()

    if not email or not username or not full_name or not role_id:
        raise HTTPException(status_code=400, detail="Missing required fields")

    existing_email = await db.execute(select(User).where(User.email == email, User.id != user_id))
    if existing_email.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Email already exists")

    existing_username = await db.execute(select(User).where(User.username == username, User.id != user_id))
    if existing_username.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Username already exists")

    role_result = await db.execute(select(Role).where(Role.id == int(role_id)))
    role = role_result.scalar_one_or_none()
    if not role:
        raise HTTPException(status_code=404, detail="Role not found")

    if role_is_super_admin(role) and not current_admin.is_superuser:
        raise HTTPException(status_code=403, detail="Only super admin can assign super admin role")

    if requested_is_superuser and not current_admin.is_superuser:
        raise HTTPException(status_code=403, detail="Only super admin can grant super admin flag")

    effective_scope = resolve_scope(requested_scope, requested_is_superuser, current_admin)

    if effective_scope == "group":
        factory_id = None
        factory = None
        employee_id = None
        employee = None
    else:
        factory_id, factory = await resolve_factory(db, factory_id_raw, current_admin=current_admin)
        employee_id, employee = await resolve_employee(
            db,
            employee_id_raw,
            factory_id,
            current_admin=current_admin,
        )

    enforce_manageable_target_scope(
        current_admin,
        target_user=user,
        target_employee=employee,
        target_factory_id=factory_id,
    )

    if employee_id is not None:
        existing_employee_link = await db.execute(
            select(User).where(User.employee_id == employee_id, User.id != user_id)
        )
        if existing_employee_link.scalar_one_or_none():
            raise HTTPException(status_code=409, detail="Employee already linked to another user")

    user.email = email
    user.username = username
    user.full_name = full_name
    user.role_id = int(role_id)
    user.factory_id = factory_id
    user.employee_id = employee_id
    user.is_active = is_active
    user.is_superuser = bool(requested_is_superuser) if current_admin.is_superuser else False
    user.scope = effective_scope

    if current_admin.is_superuser or getattr(current_admin, "supervisor_override", False):
        user.supervisor_override = bool(supervisor_override)
    user.data_ownership = data_ownership

    if password:
        user.password_hash = pwd_context.hash(password)

    await db.commit()
    await db.refresh(user)

    return {
        **serialize_user_row(user, role, factory, employee),
        "message": "User updated successfully",
    }


@router.put("/{user_id}/factory-scope")
async def update_user_factory_scope(
    user_id: int,
    payload: dict,
    current_admin: User = Depends(require_users_manage),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User, Role, Employee)
        .join(Role, Role.id == User.role_id)
        .outerjoin(Employee, Employee.id == User.employee_id)
        .where(User.id == user_id)
    )
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    user, role, employee = row

    enforce_manageable_target_scope(
        current_admin,
        target_user=user,
        target_employee=employee,
        target_factory_id=getattr(user, "factory_id", None),
    )

    factory_id_raw = payload.get("factory_id")

    factory_id, factory = await resolve_factory(db, factory_id_raw, current_admin=current_admin)

    if employee and factory_id is not None and employee.factory_id != factory_id:
        raise HTTPException(
            status_code=400,
            detail="Cannot assign factory scope different from linked employee factory",
        )

    if employee and factory_id is None:
        factory_id = employee.factory_id
        factory_result = await db.execute(select(Factory).where(Factory.id == factory_id))
        factory = factory_result.scalar_one_or_none()

    enforce_manageable_target_scope(
        current_admin,
        target_user=user,
        target_employee=employee,
        target_factory_id=factory_id,
    )

    user.factory_id = factory_id

    await db.commit()
    await db.refresh(user)

    return {
        **serialize_user_row(user, role, factory, employee),
        "message": "User factory scope updated successfully",
    }


@router.delete("/{user_id}")
async def delete_user(
    user_id: int,
    current_admin: User = Depends(require_users_manage),
    db: AsyncSession = Depends(get_db),
):
    if current_admin.id == user_id:
        raise HTTPException(status_code=409, detail="You cannot delete your own account")

    result = await db.execute(
        select(User, Employee)
        .outerjoin(Employee, Employee.id == User.employee_id)
        .where(User.id == user_id)
    )
    row = result.first()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    user, employee = row

    enforce_manageable_target_scope(
        current_admin,
        target_user=user,
        target_employee=employee,
        target_factory_id=getattr(user, "factory_id", None),
    )

    if user.is_superuser and not current_admin.is_superuser:
        raise HTTPException(status_code=403, detail="Only super admin can delete super admin users")

    await db.delete(user)
    await db.commit()

    return {"message": "User deleted successfully"}
