from fastapi import APIRouter, Depends
from sqlalchemy import func, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import require_dashboard_user, is_factory_scoped, get_user_factory_scope_id
from src.core.db.session import get_db
from src.models.attendance import AttendanceLog
from src.models.erp_org import Department, Employee
from src.models.orders import CustomerOrder
from src.models.user import Factory, User

router = APIRouter(prefix="/admin/dashboard", tags=["admin-dashboard"])


async def scalar_count(db: AsyncSession, sql_text: str, params: dict | None = None) -> int:
    result = await db.execute(text(sql_text), params or {})
    value = result.scalar()
    return int(value or 0)


@router.get("/stats")
async def dashboard_stats(
    current_user: User = Depends(require_dashboard_user),
    db: AsyncSession = Depends(get_db),
):
    scoped_factory_id = get_user_factory_scope_id(current_user)
    scoped = is_factory_scoped(current_user)

    factories_stmt = select(func.count(Factory.id))
    departments_stmt = select(func.count(Department.id))
    employees_stmt = select(func.count(Employee.id))
    attendance_stmt = select(func.count(AttendanceLog.id))

    if scoped:
        factories_stmt = factories_stmt.where(Factory.id == scoped_factory_id)
        departments_stmt = departments_stmt.where(Department.factory_id == scoped_factory_id)
        employees_stmt = employees_stmt.where(Employee.factory_id == scoped_factory_id)
        attendance_stmt = attendance_stmt.where(AttendanceLog.factory_id == scoped_factory_id)

    factories_count = (await db.execute(factories_stmt)).scalar() or 0
    departments_count = (await db.execute(departments_stmt)).scalar() or 0
    employees_count = (await db.execute(employees_stmt)).scalar() or 0
    attendance_count = (await db.execute(attendance_stmt)).scalar() or 0

    if scoped:
        orders_sql = """
            SELECT COUNT(*)
            FROM customer_orders
            WHERE business_account_id IS NULL OR business_account_id IS NOT NULL
        """
        orders_count = await scalar_count(db, orders_sql)
    else:
        orders_count = (await db.execute(select(func.count(CustomerOrder.id)))).scalar() or 0

    users_sql = "SELECT COUNT(*) FROM users"
    roles_sql = "SELECT COUNT(*) FROM roles"
    categories_sql = "SELECT COUNT(*) FROM product_categories"
    products_sql = "SELECT COUNT(*) FROM products"
    b2b_sql = "SELECT COUNT(*) FROM business_accounts"

    if scoped:
        users_sql = "SELECT COUNT(*) FROM users WHERE factory_id = :factory_id"

    users_count = await scalar_count(db, users_sql, {"factory_id": scoped_factory_id} if scoped else None)
    roles_count = await scalar_count(db, roles_sql)
    categories_count = await scalar_count(db, categories_sql)
    products_count = await scalar_count(db, products_sql)
    b2b_accounts_count = await scalar_count(db, b2b_sql)

    order_status_rows = await db.execute(
        text(
            """
            SELECT COALESCE(status, 'unknown') AS status, COUNT(*) AS total
            FROM customer_orders
            GROUP BY status
            ORDER BY total DESC, status ASC
            """
        )
    )
    order_status_breakdown = [
        {
            "status": row.status,
            "count": int(row.total or 0),
        }
        for row in order_status_rows
    ]

    if scoped:
        factory_rows = await db.execute(
            text(
                """
                SELECT
                    f.id,
                    f.code,
                    f.name,
                    f.is_active,
                    COUNT(DISTINCT d.id) AS departments_count,
                    COUNT(DISTINCT e.id) AS employees_count
                FROM factories f
                LEFT JOIN departments d ON d.factory_id = f.id
                LEFT JOIN employees e ON e.factory_id = f.id
                WHERE f.id = :factory_id
                GROUP BY f.id, f.code, f.name, f.is_active
                ORDER BY f.id ASC
                """
            ),
            {"factory_id": scoped_factory_id},
        )
    else:
        factory_rows = await db.execute(
            text(
                """
                SELECT
                    f.id,
                    f.code,
                    f.name,
                    f.is_active,
                    COUNT(DISTINCT d.id) AS departments_count,
                    COUNT(DISTINCT e.id) AS employees_count
                FROM factories f
                LEFT JOIN departments d ON d.factory_id = f.id
                LEFT JOIN employees e ON e.factory_id = f.id
                GROUP BY f.id, f.code, f.name, f.is_active
                ORDER BY f.id ASC
                """
            )
        )

    factory_overview = [
        {
            "id": int(row.id),
            "code": row.code,
            "name": row.name,
            "is_active": bool(row.is_active),
            "departments_count": int(row.departments_count or 0),
            "employees_count": int(row.employees_count or 0),
        }
        for row in factory_rows
    ]

    return {
        "factory_scope": scoped_factory_id,
        "summary": {
            "factories_count": int(factories_count or 0),
            "departments_count": int(departments_count or 0),
            "employees_count": int(employees_count or 0),
            "attendance_count": int(attendance_count or 0),
            "orders_count": int(orders_count or 0),
            "users_count": users_count,
            "roles_count": roles_count,
            "categories_count": categories_count,
            "products_count": products_count,
            "b2b_accounts_count": b2b_accounts_count,
        },
        "order_status_breakdown": order_status_breakdown,
        "factory_overview": factory_overview,
    }
