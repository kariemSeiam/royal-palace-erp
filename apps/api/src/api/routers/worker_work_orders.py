from fastapi import APIRouter, Depends, HTTPException, Header
from jose import jwt
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config.settings import settings
from src.core.db.session import get_db
from src.core.security.jwt import ALGORITHM
from src.models.user import User
from src.models.erp_org import Employee

router = APIRouter(prefix="/worker/work-orders", tags=["worker-work-orders"])


def get_user_id_from_bearer(authorization: str) -> int:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    token = authorization.replace("Bearer ", "", 1)

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") not in (None, "access"):
            raise HTTPException(status_code=401, detail="Invalid access token")
        return int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid access token")


async def get_current_worker_user(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    user_id = get_user_id_from_bearer(authorization)

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    if not user.employee_id:
        raise HTTPException(status_code=403, detail="This account is not linked to an employee")

    if not user.factory_id:
        raise HTTPException(status_code=403, detail="This account is not linked to a factory")

    employee_result = await db.execute(
        select(Employee).where(
            Employee.id == user.employee_id,
            Employee.factory_id == user.factory_id,
        )
    )
    employee = employee_result.scalar_one_or_none()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee not found for this user")

    return user, employee


def serialize_worker_work_order(row, items: list[dict] | None = None):
    data = dict(row)
    return {
        "id": data.get("id"),
        "order_id": data.get("order_id"),
        "order_number": data.get("order_number"),
        "factory_id": data.get("factory_id"),
        "factory_name": data.get("factory_name"),
        "status": data.get("status"),
        "notes": data.get("notes"),
        "assigned_employee_id": data.get("assigned_employee_id"),
        "assigned_employee_name": data.get("assigned_employee_name"),
        "assigned_employee_job_title": data.get("assigned_employee_job_title"),
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
        "items_count": len(items or []),
        "items_quantity_total": sum(int(item.get("quantity") or 0) for item in (items or [])),
        "items": items or [],
    }


async def fetch_worker_work_order_items(db: AsyncSession, order_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                coi.id,
                coi.order_id,
                coi.product_id,
                coi.quantity,
                p.name_ar,
                p.name_en,
                p.slug,
                p.sku,
                p.primary_image_url
            FROM customer_order_items coi
            JOIN products p ON p.id = coi.product_id
            WHERE coi.order_id = :order_id
            ORDER BY coi.id ASC
            """
        ),
        {"order_id": order_id},
    )

    items = []
    for row in result.mappings().all():
        data = dict(row)
        items.append(
            {
                "id": data.get("id"),
                "order_id": data.get("order_id"),
                "product_id": data.get("product_id"),
                "name_ar": data.get("name_ar"),
                "name_en": data.get("name_en"),
                "slug": data.get("slug"),
                "sku": data.get("sku"),
                "primary_image_url": data.get("primary_image_url"),
                "quantity": int(data.get("quantity") or 0),
            }
        )

    return items


async def fetch_worker_work_order_or_404(
    db: AsyncSession,
    work_order_id: int,
    factory_id: int,
    employee_id: int,
):
    result = await db.execute(
        text(
            """
            SELECT
                wo.id,
                wo.order_id,
                wo.factory_id,
                wo.status,
                wo.notes,
                wo.assigned_employee_id,
                wo.created_at,
                wo.updated_at,
                co.order_number,
                f.name AS factory_name,
                e.first_name AS assigned_employee_first_name,
                e.last_name AS assigned_employee_last_name,
                e.job_title AS assigned_employee_job_title
            FROM work_orders wo
            JOIN customer_orders co ON co.id = wo.order_id
            LEFT JOIN factories f ON f.id = wo.factory_id
            LEFT JOIN employees e ON e.id = wo.assigned_employee_id
            WHERE wo.id = :id
              AND wo.factory_id = :factory_id
              AND wo.assigned_employee_id = :employee_id
            LIMIT 1
            """
        ),
        {
            "id": work_order_id,
            "factory_id": factory_id,
            "employee_id": employee_id,
        },
    )
    row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Work order not found")

    row_dict = dict(row)
    full_name = f"{row_dict.get('assigned_employee_first_name') or ''} {row_dict.get('assigned_employee_last_name') or ''}".strip()
    row_dict["assigned_employee_name"] = full_name or None
    return row_dict


@router.get("")
async def list_worker_work_orders(
    actor=Depends(get_current_worker_user),
    db: AsyncSession = Depends(get_db),
):
    user, employee = actor

    result = await db.execute(
        text(
            """
            SELECT
                wo.id,
                wo.order_id,
                wo.factory_id,
                wo.status,
                wo.notes,
                wo.assigned_employee_id,
                wo.created_at,
                wo.updated_at,
                co.order_number,
                f.name AS factory_name,
                e.first_name AS assigned_employee_first_name,
                e.last_name AS assigned_employee_last_name,
                e.job_title AS assigned_employee_job_title
            FROM work_orders wo
            JOIN customer_orders co ON co.id = wo.order_id
            LEFT JOIN factories f ON f.id = wo.factory_id
            LEFT JOIN employees e ON e.id = wo.assigned_employee_id
            WHERE wo.factory_id = :factory_id
              AND wo.assigned_employee_id = :employee_id
            ORDER BY wo.id DESC
            """
        ),
        {
            "factory_id": int(user.factory_id),
            "employee_id": int(employee.id),
        },
    )

    rows = result.mappings().all()
    output = []

    for row in rows:
        row_dict = dict(row)
        full_name = f"{row_dict.get('assigned_employee_first_name') or ''} {row_dict.get('assigned_employee_last_name') or ''}".strip()
        row_dict["assigned_employee_name"] = full_name or None
        items = await fetch_worker_work_order_items(db, int(row_dict["order_id"]))
        output.append(serialize_worker_work_order(row_dict, items))

    return {
        "employee_id": int(employee.id),
        "employee_name": f"{employee.first_name} {employee.last_name}".strip(),
        "factory_id": int(user.factory_id),
        "items": output,
    }


@router.get("/{work_order_id}")
async def get_worker_work_order(
    work_order_id: int,
    actor=Depends(get_current_worker_user),
    db: AsyncSession = Depends(get_db),
):
    user, employee = actor

    row = await fetch_worker_work_order_or_404(
        db=db,
        work_order_id=work_order_id,
        factory_id=int(user.factory_id),
        employee_id=int(employee.id),
    )
    items = await fetch_worker_work_order_items(db, int(row["order_id"]))

    return {
        "employee_id": int(employee.id),
        "employee_name": f"{employee.first_name} {employee.last_name}".strip(),
        "factory_id": int(user.factory_id),
        "work_order": serialize_worker_work_order(row, items),
    }
