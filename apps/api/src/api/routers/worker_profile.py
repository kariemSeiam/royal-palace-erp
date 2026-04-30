from fastapi import APIRouter, Depends, Header, HTTPException
from jose import JWTError, jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config.settings import settings
from src.core.db.session import get_db
from src.core.security.jwt import ALGORITHM
from src.models.erp_org import Department, Employee
from src.models.user import Factory, Role, User

router = APIRouter(prefix="/worker/profile", tags=["worker-profile"])


async def get_current_worker_user(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.split(" ", 1)[1]

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Unauthorized")

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
            Employee.is_active == True,
        )
    )
    employee = employee_result.scalar_one_or_none()

    if not employee:
        raise HTTPException(status_code=404, detail="Employee record not found")

    return user, employee


@router.get("")
async def get_worker_profile(
    actor=Depends(get_current_worker_user),
    db: AsyncSession = Depends(get_db),
):
    user, employee = actor

    department = None
    if employee.department_id:
        department_result = await db.execute(
            select(Department).where(Department.id == employee.department_id)
        )
        department = department_result.scalar_one_or_none()

    factory = None
    if user.factory_id:
        factory_result = await db.execute(
            select(Factory).where(Factory.id == user.factory_id)
        )
        factory = factory_result.scalar_one_or_none()

    role = None
    if user.role_id:
        role_result = await db.execute(
            select(Role).where(Role.id == user.role_id)
        )
        role = role_result.scalar_one_or_none()

    return {
        "user": {
            "id": user.id,
            "full_name": user.full_name,
            "username": user.username,
            "email": user.email,
            "phone": user.phone,
            "is_active": user.is_active,
            "is_superuser": user.is_superuser,
            "factory_id": user.factory_id,
            "role_id": user.role_id,
            "employee_id": user.employee_id,
        },
        "employee": {
            "id": employee.id,
            "factory_id": employee.factory_id,
            "department_id": employee.department_id,
            "employee_code": employee.employee_code,
            "first_name": employee.first_name,
            "last_name": employee.last_name,
            "job_title": employee.job_title,
            "hire_date": employee.hire_date.isoformat() if employee.hire_date else None,
            "phone": employee.phone,
            "email": employee.email,
            "employment_status": employee.employment_status,
            "is_active": employee.is_active,
        },
        "factory": {
            "id": factory.id,
            "code": factory.code,
            "name": factory.name,
            "is_active": factory.is_active,
        } if factory else None,
        "department": {
            "id": department.id,
            "name": department.name,
            "code": department.code,
            "is_active": department.is_active,
        } if department else None,
        "role": {
            "id": role.id,
            "code": role.code,
            "name": role.name,
            "is_active": role.is_active,
        } if role else None,
        "assignments": {
            "machine": None,
            "workstation": None,
            "production_line": None,
            "shift": None,
        },
    }
