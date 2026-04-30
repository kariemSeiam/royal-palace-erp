from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    require_employees_view,
    require_employees_manage,
    apply_factory_scope_filter,
    is_factory_scoped,
    get_user_factory_scope_id,
)
from src.core.db.session import get_db
from src.models.employee import Employee
from src.models.user import User
from src.schemas.employee import EmployeeCreate, EmployeeOut

router = APIRouter(prefix="/admin/employees", tags=["employees"])


@router.get("", response_model=list[EmployeeOut])
async def list_employees(
    current_user: User = Depends(require_employees_view),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Employee).order_by(Employee.id.asc())
    stmt = apply_factory_scope_filter(stmt, Employee.factory_id, current_user)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreate,
    current_user: User = Depends(require_employees_manage),
    db: AsyncSession = Depends(get_db),
):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None and payload.factory_id != scoped_id:
            raise HTTPException(status_code=403, detail="Cannot create employee outside your factory scope")

    employee = Employee(
        factory_id=payload.factory_id,
        department_id=payload.department_id,
        first_name=payload.first_name,
        last_name=payload.last_name,
        job_title=payload.job_title,
        phone=payload.phone,
        email=payload.email,
    )
    db.add(employee)
    await db.commit()
    await db.refresh(employee)
    return employee
