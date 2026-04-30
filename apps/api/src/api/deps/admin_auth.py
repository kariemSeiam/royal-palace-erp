from fastapi import Depends, Header, HTTPException
from jose import jwt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config.settings import settings
from src.core.db.session import get_db
from src.core.security.jwt import ALGORITHM
from src.models.user import Role, User

BLOCKED_ADMIN_CODES = {"customer", "store_customer", "customer_user"}

IT_PERMISSION_CODES = {
    "it.view",
    "it.manage",
    "infrastructure.view",
    "infrastructure.manage",
    "servers.view",
    "servers.manage",
    "backups.view",
    "backups.manage",
    "logs.view",
    "monitoring.view",
    "deployments.view",
    "deployments.manage",
    "catalog.view",
    "catalog.manage",
    "media.view",
    "media.manage",
    "themes.view",
    "themes.manage",
    "branding.view",
    "branding.manage",
    "pages.view",
    "pages.manage",
    "layout.manage",
    "ui_settings.manage",
    "global_settings.manage",
    "products.view",
    "products.manage",
}

PERMISSION_ALIASES = {
    "dashboard.view": {"dashboard.view", "dashboard.read"},
    "dashboard.read": {"dashboard.view", "dashboard.read"},
    "users.view": {"users.view", "users.read"},
    "users.read": {"users.view", "users.read"},
    "users.manage": {"users.manage", "users.create", "users.update", "users.assign_roles"},
    "users.create": {"users.manage", "users.create"},
    "users.update": {"users.manage", "users.update"},
    "users.assign_roles": {"users.manage", "users.assign_roles"},
    "roles.view": {"roles.view", "roles.read"},
    "roles.read": {"roles.view", "roles.read"},
    "roles.manage": {"roles.manage", "roles.create", "roles.update", "roles.assign_permissions"},
    "roles.create": {"roles.manage", "roles.create"},
    "roles.update": {"roles.manage", "roles.update"},
    "roles.assign_permissions": {"roles.manage", "roles.assign_permissions"},
    "factories.view": {"factories.view", "factories.read"},
    "factories.read": {"factories.view", "factories.read"},
    "factories.manage": {"factories.manage", "factories.create", "factories.update"},
    "factories.create": {"factories.manage", "factories.create"},
    "factories.update": {"factories.manage", "factories.update"},
    "categories.view": {"categories.view", "categories.read"},
    "categories.read": {"categories.view", "categories.read"},
    "categories.manage": {"categories.manage", "categories.create", "categories.update"},
    "categories.create": {"categories.manage", "categories.create"},
    "categories.update": {"categories.manage", "categories.update"},
    "products.view": {"products.view", "products.read", "catalog.view", "catalog.read"},
    "products.read": {"products.view", "products.read", "catalog.view", "catalog.read"},
    "products.manage": {"products.manage", "products.create", "products.update", "catalog.manage", "catalog.create", "catalog.update"},
    "products.create": {"products.manage", "products.create"},
    "products.update": {"products.manage", "products.update"},
    "catalog.view": {"catalog.view", "catalog.read", "products.view", "products.read"},
    "catalog.read": {"catalog.view", "catalog.read", "products.view", "products.read"},
    "catalog.manage": {"catalog.manage", "catalog.create", "catalog.update", "products.manage", "products.create", "products.update"},
    "catalog.create": {"catalog.manage", "catalog.create"},
    "catalog.update": {"catalog.manage", "catalog.update"},
    "departments.view": {"departments.view", "departments.read"},
    "departments.read": {"departments.view", "departments.read"},
    "departments.manage": {"departments.manage", "departments.create", "departments.update"},
    "departments.create": {"departments.manage", "departments.create"},
    "departments.update": {"departments.manage", "departments.update"},
    "employees.view": {"employees.view", "employees.read"},
    "employees.read": {"employees.view", "employees.read"},
    "employees.manage": {"employees.manage", "employees.create", "employees.update"},
    "employees.create": {"employees.manage", "employees.create"},
    "employees.update": {"employees.manage", "employees.update"},
    "attendance.view": {"attendance.view", "attendance.read"},
    "attendance.read": {"attendance.view", "attendance.read"},
    "attendance.manage": {"attendance.manage", "attendance.review", "attendance.create", "attendance.update"},
    "attendance.review": {"attendance.manage", "attendance.review"},
    "attendance.create": {"attendance.manage", "attendance.create"},
    "attendance.update": {"attendance.manage", "attendance.update"},
    "orders.view": {"orders.view", "orders.read"},
    "orders.read": {"orders.view", "orders.read"},
    "orders.manage": {"orders.manage", "orders.create", "orders.update", "orders.approve"},
    "orders.create": {"orders.manage", "orders.create"},
    "orders.update": {"orders.manage", "orders.update"},
    "orders.approve": {"orders.manage", "orders.approve"},
    "b2b.view": {"b2b.view", "b2b.read"},
    "b2b.read": {"b2b.view", "b2b.read"},
    "b2b.manage": {"b2b.manage", "b2b.create", "b2b.update"},
    "b2b.create": {"b2b.manage", "b2b.create"},
    "b2b.update": {"b2b.manage", "b2b.update"},
    "warehouses.view": {"warehouses.view", "warehouses.read"},
    "warehouses.read": {"warehouses.view", "warehouses.read"},
    "warehouses.manage": {"warehouses.manage", "warehouses.create", "warehouses.update"},
    "warehouses.create": {"warehouses.manage", "warehouses.create"},
    "warehouses.update": {"warehouses.manage", "warehouses.update"},
    "inventory.view": {"inventory.view", "inventory.read", "stock.view", "stock.read"},
    "inventory.read": {"inventory.view", "inventory.read", "stock.view", "stock.read"},
    "inventory.manage": {"inventory.manage", "inventory.adjust", "stock.manage", "stock.adjust"},
    "inventory.adjust": {"inventory.manage", "inventory.adjust", "stock.manage", "stock.adjust"},
    "stock.view": {"stock.view", "stock.read", "inventory.view", "inventory.read"},
    "stock.read": {"stock.view", "stock.read", "inventory.view", "inventory.read"},
    "stock.manage": {"stock.manage", "stock.adjust", "inventory.manage", "inventory.adjust"},
    "stock.adjust": {"stock.manage", "stock.adjust", "inventory.manage", "inventory.adjust"},
    "hr.view": {
        "hr.view", "hr.read", "employee_leaves.view", "employee_leaves.read",
        "employee_evaluations.view", "employee_evaluations.read",
        "employee_compensations.view", "employee_compensations.read",
        "payroll.view", "payroll.read",
    },
    "hr.read": {
        "hr.view", "hr.read", "employee_leaves.view", "employee_leaves.read",
        "employee_evaluations.view", "employee_evaluations.read",
        "employee_compensations.view", "employee_compensations.read",
        "payroll.view", "payroll.read",
    },
    "hr.manage": {
        "hr.manage", "employee_leaves.manage", "employee_leaves.create", "employee_leaves.update",
        "employee_evaluations.manage", "employee_evaluations.create", "employee_evaluations.update",
        "employee_compensations.manage", "employee_compensations.create", "employee_compensations.update",
        "payroll.manage", "payroll.generate", "payroll.mark_paid",
    },
    "employee_leaves.view": {"employee_leaves.view", "employee_leaves.read", "hr.view", "hr.read"},
    "employee_leaves.read": {"employee_leaves.view", "employee_leaves.read", "hr.view", "hr.read"},
    "employee_leaves.manage": {"employee_leaves.manage", "employee_leaves.create", "employee_leaves.update", "hr.manage"},
    "employee_leaves.create": {"employee_leaves.manage", "employee_leaves.create", "hr.manage"},
    "employee_leaves.update": {"employee_leaves.manage", "employee_leaves.update", "hr.manage"},
    "employee_evaluations.view": {"employee_evaluations.view", "employee_evaluations.read", "hr.view", "hr.read"},
    "employee_evaluations.read": {"employee_evaluations.view", "employee_evaluations.read", "hr.view", "hr.read"},
    "employee_evaluations.manage": {"employee_evaluations.manage", "employee_evaluations.create", "employee_evaluations.update", "hr.manage"},
    "employee_evaluations.create": {"employee_evaluations.manage", "employee_evaluations.create", "hr.manage"},
    "employee_evaluations.update": {"employee_evaluations.manage", "employee_evaluations.update", "hr.manage"},
    "employee_compensations.view": {"employee_compensations.view", "employee_compensations.read", "hr.view", "hr.read"},
    "employee_compensations.read": {"employee_compensations.view", "employee_compensations.read", "hr.view", "hr.read"},
    "employee_compensations.manage": {"employee_compensations.manage", "employee_compensations.create", "employee_compensations.update", "hr.manage"},
    "employee_compensations.create": {"employee_compensations.manage", "employee_compensations.create", "hr.manage"},
    "employee_compensations.update": {"employee_compensations.manage", "employee_compensations.update", "hr.manage"},
    "payroll.view": {"payroll.view", "payroll.read", "hr.view", "hr.read"},
    "payroll.read": {"payroll.view", "payroll.read", "hr.view", "hr.read"},
    "payroll.manage": {"payroll.manage", "payroll.generate", "payroll.mark_paid", "hr.manage"},
    "payroll.generate": {"payroll.manage", "payroll.generate", "hr.manage"},
    "payroll.mark_paid": {"payroll.manage", "payroll.mark_paid", "hr.manage"},
    "it.view": {"it.view", "it.read"},
    "it.read": {"it.view", "it.read"},
    "it.manage": {"it.manage", "it.update", "it.configure"},
    "finance.view": {"finance.view", "finance.read"},
    "finance.read": {"finance.view", "finance.read"},
    "finance.manage": {"finance.manage", "finance.view", "finance.read"},
    "procurement.view": {"procurement.view", "procurement.read"},
    "procurement.manage": {"procurement.manage", "procurement.create", "procurement.update"},
    "suppliers.view": {"suppliers.view", "suppliers.read"},
    "suppliers.manage": {"suppliers.manage", "suppliers.create", "suppliers.update"},
    "sales_invoices.view": {"sales_invoices.view", "sales_invoices.read"},
    "sales_invoices.manage": {"sales_invoices.manage", "sales_invoices.create", "sales_invoices.update"},
    "sales_quotations.view": {"sales_quotations.view", "sales_quotations.read"},
    "sales_quotations.manage": {"sales_quotations.manage", "sales_quotations.create", "sales_quotations.update"},
    "work_orders.view": {"work_orders.view", "work_orders.read"},
    "work_orders.manage": {"work_orders.manage", "work_orders.create", "work_orders.update"},
    "accounting.view": {"accounting.view", "accounting.read"},
    "accounting.manage": {"accounting.manage", "accounting.create"},
    "costing.view": {"costing.view", "costing.read", "finance.view", "finance.read"},
    "deliveries.view": {"deliveries.view", "deliveries.read"},
    "deliveries.manage": {"deliveries.manage", "deliveries.create", "deliveries.update"},
}


def normalize_role_code(role: Role | None) -> str:
    if not role:
        return ""
    return str(getattr(role, "code", "") or "").strip().lower()


def expand_permission_codes(*codes: str) -> set[str]:
    expanded: set[str] = set()
    for code in codes:
        normalized = str(code or "").strip().lower()
        if not normalized:
            continue
        expanded.add(normalized)
        expanded.update(PERMISSION_ALIASES.get(normalized, {normalized}))
    return expanded


async def ensure_role_permissions_table(db: AsyncSession):
    await db.execute(
        text(
            """
        CREATE TABLE IF NOT EXISTS role_permissions (
            id SERIAL PRIMARY KEY,
            role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
            permission_code VARCHAR(150) NOT NULL,
            created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
            UNIQUE(role_id, permission_code)
        )
    """
        )
    )
    await db.commit()


async def get_role_permission_codes(db: AsyncSession, role_id: int | None) -> set[str]:
    if not role_id:
        return set()
    await ensure_role_permissions_table(db)
    result = await db.execute(
        text("SELECT permission_code FROM role_permissions WHERE role_id = :role_id"),
        {"role_id": int(role_id)},
    )
    rows = result.mappings().all()
    return {
        str(row["permission_code"]).strip().lower()
        for row in rows
        if row.get("permission_code")
    }


async def get_current_user_and_role(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")
    token = authorization.replace("Bearer ", "", 1)
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") not in (None, "access"):
            raise HTTPException(status_code=401, detail="Invalid access token")
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid access token")

    result = await db.execute(
        select(User, Role).join(Role, Role.id == User.role_id).where(User.id == user_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")
    user, role = row
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")
    permissions = await get_role_permission_codes(db, role.id if role else None)
    return user, role, permissions


def ensure_not_blocked_admin_role(role: Role | None):
    role_code = normalize_role_code(role)
    if role_code in BLOCKED_ADMIN_CODES:
        raise HTTPException(status_code=403, detail="Admin panel access denied")
    return role_code


def has_any_permission(permissions: set[str], *codes: str) -> bool:
    if not codes:
        return False
    expanded = expand_permission_codes(*codes)
    normalized_permissions = {str(item or "").strip().lower() for item in permissions}
    return any(code in normalized_permissions for code in expanded)


def has_it_access(permissions: set[str]) -> bool:
    normalized = {str(code or "").strip().lower() for code in permissions}
    expanded = set(normalized)
    for code in list(normalized):
        expanded.update(PERMISSION_ALIASES.get(code, {code}))
    return any(code in IT_PERMISSION_CODES for code in expanded)


def is_factory_scoped(user: User) -> bool:
    scope = getattr(user, "scope", None)
    if str(scope or "").strip().lower() == "group":
        return False
    if user.is_superuser:
        return False
    return getattr(user, "factory_id", None) is not None


def is_factory_scoped_user(user: User) -> bool:
    scope = getattr(user, "scope", None)
    if str(scope or "").strip().lower() == "group":
        return False
    return (not user.is_superuser) and getattr(user, "factory_id", None) is not None


def get_user_factory_scope_id(user: User) -> int | None:
    scope = getattr(user, "scope", None)
    if str(scope or "").strip().lower() == "group":
        return None
    if user.is_superuser:
        return None
    factory_id = getattr(user, "factory_id", None)
    if factory_id in [None, ""]:
        return None
    try:
        return int(factory_id)
    except Exception:
        return None


def enforce_factory_scope(
    user: User,
    target_factory_id: int | None,
    detail: str = "Access denied for this factory scope",
):
    if user.is_superuser:
        return
    scope = getattr(user, "scope", None)
    if str(scope or "").strip().lower() == "group":
        return
    scoped_factory_id = get_user_factory_scope_id(user)
    if scoped_factory_id is None:
        return
    if target_factory_id is None:
        raise HTTPException(status_code=403, detail=detail)
    if int(target_factory_id) != int(scoped_factory_id):
        raise HTTPException(status_code=403, detail=detail)


def apply_factory_scope_filter(stmt, model_factory_column, user: User):
    if user.is_superuser:
        return stmt
    scope = getattr(user, "scope", None)
    if str(scope or "").strip().lower() == "group":
        return stmt
    scoped_factory_id = get_user_factory_scope_id(user)
    if scoped_factory_id is None:
        return stmt
    return stmt.where(model_factory_column == scoped_factory_id)


def _ensure_module_access(user, role, permissions, *, any_of, detail):
    ensure_not_blocked_admin_role(role)
    if user.is_superuser or user.supervisor_override:
        return user
    if not has_any_permission(permissions, *any_of):
        raise HTTPException(status_code=403, detail=detail)
    return user


async def require_admin_panel_user(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    role_code = ensure_not_blocked_admin_role(role)
    if user.is_superuser or user.supervisor_override:
        return user
    if not role_code:
        raise HTTPException(status_code=403, detail="Admin panel access denied")
    if not permissions:
        raise HTTPException(status_code=403, detail="No admin permissions assigned")
    return user


async def require_dashboard_user(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("dashboard.view", "dashboard.read"), detail="Admin dashboard access denied")


async def require_super_admin(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    role_code = normalize_role_code(role)
    if user.is_superuser:
        return user
    if role_code not in {"super_admin", "superadmin"}:
        raise HTTPException(status_code=403, detail="Super admin access required")
    return user


async def require_factory_admin_or_super_admin(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("factories.view", "factories.read", "factories.manage"), detail="Admin factories access denied")


async def require_roles_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("roles.view", "roles.read", "roles.manage"), detail="Roles access denied")


async def require_roles_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("roles.manage", "roles.create", "roles.update", "roles.assign_permissions"), detail="Roles management access denied")


async def require_users_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("users.view", "users.read", "users.manage"), detail="Users access denied")


async def require_users_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("users.manage", "users.create", "users.update", "users.assign_roles"), detail="Users management access denied")


async def require_factories_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("factories.view", "factories.read", "factories.manage"), detail="Factories access denied")


async def require_factories_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("factories.manage", "factories.create", "factories.update"), detail="Factories management access denied")


async def require_categories_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("categories.view", "categories.read", "categories.manage"), detail="Categories access denied")


async def require_categories_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("categories.manage", "categories.create", "categories.update"), detail="Categories management access denied")


async def require_products_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("products.view", "products.read", "products.manage", "catalog.view", "catalog.read", "catalog.manage"), detail="Products access denied")


async def require_products_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("products.manage", "products.create", "products.update", "catalog.manage", "catalog.create", "catalog.update"), detail="Products management access denied")


async def require_departments_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("departments.view", "departments.read", "departments.manage"), detail="Departments access denied")


async def require_departments_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("departments.manage", "departments.create", "departments.update"), detail="Departments management access denied")


async def require_employees_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("employees.view", "employees.read", "employees.manage"), detail="Employees access denied")


async def require_employees_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("employees.manage", "employees.create", "employees.update"), detail="Employees management access denied")


async def require_attendance_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("attendance.view", "attendance.read", "attendance.manage"), detail="Attendance access denied")


async def require_attendance_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("attendance.manage", "attendance.review", "attendance.create", "attendance.update"), detail="Attendance management access denied")


async def require_orders_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("orders.view", "orders.read", "orders.manage"), detail="Orders access denied")


async def require_orders_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("orders.manage", "orders.create", "orders.update", "orders.approve"), detail="Orders management access denied")


async def require_b2b_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("b2b.view", "b2b.read", "b2b.manage"), detail="B2B access denied")


async def require_b2b_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("b2b.manage", "b2b.create", "b2b.update"), detail="B2B management access denied")


async def require_hr_payroll_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("hr.view", "hr.read", "employee_leaves.view", "employee_leaves.read", "employee_evaluations.view", "employee_evaluations.read", "employee_compensations.view", "employee_compensations.read", "payroll.view", "payroll.read"), detail="HR/Payroll access denied")


async def require_hr_payroll_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("hr.manage", "employee_leaves.manage", "employee_leaves.create", "employee_leaves.update", "employee_evaluations.manage", "employee_evaluations.create", "employee_evaluations.update", "employee_compensations.manage", "employee_compensations.create", "employee_compensations.update", "payroll.manage", "payroll.generate", "payroll.mark_paid"), detail="HR/Payroll management access denied")


async def require_it_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("it.view", "it.manage", "infrastructure.view", "infrastructure.manage", "servers.view", "servers.manage", "backups.view", "backups.manage", "logs.view", "monitoring.view", "deployments.view", "deployments.manage", "catalog.view", "catalog.manage", "media.view", "media.manage", "themes.view", "themes.manage", "branding.view", "branding.manage", "pages.view", "pages.manage", "layout.manage", "ui_settings.manage", "global_settings.manage", "products.view", "products.manage"), detail="IT access denied")


async def require_it_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("it.manage", "infrastructure.manage", "servers.manage", "backups.manage", "deployments.manage", "catalog.manage", "media.manage", "themes.manage", "branding.manage", "pages.manage", "layout.manage", "ui_settings.manage", "global_settings.manage", "products.manage"), detail="IT management access denied")


async def require_finance_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("finance.view", "finance.read", "finance.manage"), detail="Finance access denied")


async def require_finance_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("finance.manage",), detail="Finance management access denied")


async def require_procurement_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("procurement.view", "procurement.read", "procurement.manage"), detail="Procurement access denied")


async def require_procurement_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("procurement.manage", "procurement.create", "procurement.update"), detail="Procurement management access denied")


async def require_suppliers_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("suppliers.view", "suppliers.read", "suppliers.manage"), detail="Suppliers access denied")


async def require_suppliers_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("suppliers.manage", "suppliers.create", "suppliers.update"), detail="Suppliers management access denied")


async def require_sales_invoices_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("sales_invoices.view", "sales_invoices.read", "sales_invoices.manage"), detail="Sales invoices access denied")


async def require_sales_invoices_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("sales_invoices.manage", "sales_invoices.create", "sales_invoices.update"), detail="Sales invoices management access denied")


async def require_sales_quotations_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("sales_quotations.view", "sales_quotations.read", "sales_quotations.manage"), detail="Sales quotations access denied")


async def require_sales_quotations_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("sales_quotations.manage", "sales_quotations.create", "sales_quotations.update"), detail="Sales quotations management access denied")


async def require_work_orders_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("work_orders.view", "work_orders.read", "work_orders.manage"), detail="Work orders access denied")


async def require_work_orders_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("work_orders.manage", "work_orders.create", "work_orders.update"), detail="Work orders management access denied")


async def require_accounting_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("accounting.view", "accounting.read", "accounting.manage"), detail="Accounting access denied")


async def require_accounting_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("accounting.manage", "accounting.create"), detail="Accounting management access denied")


async def require_costing_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("costing.view", "costing.read", "finance.view", "finance.read"), detail="Costing access denied")


async def require_deliveries_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("deliveries.view", "deliveries.read", "deliveries.manage"), detail="Deliveries access denied")


async def require_deliveries_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("deliveries.manage", "deliveries.create", "deliveries.update"), detail="Deliveries management access denied")


async def require_inventory_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("inventory.view", "inventory.read", "inventory.manage", "stock.view", "stock.read"), detail="Inventory access denied")


async def require_inventory_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("inventory.manage", "inventory.adjust", "stock.manage", "stock.adjust"), detail="Inventory management access denied")


async def require_warehouses_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("warehouses.view", "warehouses.read", "warehouses.manage"), detail="Warehouses access denied")


async def require_warehouses_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("warehouses.manage", "warehouses.create", "warehouses.update"), detail="Warehouses management access denied")

# ========== دوال جديدة للوحدات المضافة ==========
async def require_knowledge_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("knowledge.view", "knowledge.manage"), detail="Knowledge access denied")

async def require_knowledge_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("knowledge.manage",), detail="Knowledge management access denied")

async def require_social_media_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("social_media.view", "social_media.manage"), detail="Social Media access denied")

async def require_social_media_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("social_media.manage",), detail="Social Media management access denied")

async def require_marketing_automation_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("marketing_automation.view", "marketing_automation.manage"), detail="Marketing Automation access denied")

async def require_marketing_automation_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("marketing_automation.manage",), detail="Marketing Automation management access denied")

async def require_advanced_recruitment_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("advanced_recruitment.view", "advanced_recruitment.manage"), detail="Advanced Recruitment access denied")

async def require_advanced_recruitment_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("advanced_recruitment.manage",), detail="Advanced Recruitment management access denied")

async def require_advanced_barcode_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("advanced_barcode.view", "advanced_barcode.manage"), detail="Advanced Barcode access denied")

async def require_advanced_barcode_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("advanced_barcode.manage",), detail="Advanced Barcode management access denied")

async def require_knowledge_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("knowledge.view", "knowledge.manage"), detail="Knowledge access denied")

async def require_knowledge_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("knowledge.manage",), detail="Knowledge management access denied")

async def require_social_media_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("social_media.view", "social_media.manage"), detail="Social Media access denied")

async def require_social_media_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("social_media.manage",), detail="Social Media management access denied")

async def require_marketing_automation_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("marketing_automation.view", "marketing_automation.manage"), detail="Marketing Automation access denied")

async def require_marketing_automation_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("marketing_automation.manage",), detail="Marketing Automation management access denied")

async def require_advanced_recruitment_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("advanced_recruitment.view", "advanced_recruitment.manage"), detail="Advanced Recruitment access denied")

async def require_advanced_recruitment_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("advanced_recruitment.manage",), detail="Advanced Recruitment management access denied")

async def require_advanced_barcode_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("advanced_barcode.view", "advanced_barcode.manage"), detail="Advanced Barcode access denied")

async def require_advanced_barcode_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("advanced_barcode.manage",), detail="Advanced Barcode management access denied")

async def require_knowledge_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("knowledge.view", "knowledge.manage"), detail="Knowledge access denied")

async def require_knowledge_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("knowledge.manage",), detail="Knowledge management access denied")

async def require_social_media_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("social_media.view", "social_media.manage"), detail="Social Media access denied")

async def require_social_media_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("social_media.manage",), detail="Social Media management access denied")

async def require_marketing_automation_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("marketing_automation.view", "marketing_automation.manage"), detail="Marketing Automation access denied")

async def require_marketing_automation_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("marketing_automation.manage",), detail="Marketing Automation management access denied")

async def require_advanced_recruitment_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("advanced_recruitment.view", "advanced_recruitment.manage"), detail="Advanced Recruitment access denied")

async def require_advanced_recruitment_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("advanced_recruitment.manage",), detail="Advanced Recruitment management access denied")

async def require_advanced_barcode_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("advanced_barcode.view", "advanced_barcode.manage"), detail="Advanced Barcode access denied")

async def require_advanced_barcode_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    return _ensure_module_access(user, role, permissions, any_of=("advanced_barcode.manage",), detail="Advanced Barcode management access denied")
