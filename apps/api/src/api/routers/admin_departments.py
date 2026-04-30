from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    require_departments_view,
    require_departments_manage,
    apply_factory_scope_filter,
    is_factory_scoped,
    get_user_factory_scope_id,
)
from src.core.db.session import get_db
from src.models.department import Department
from src.models.user import User
from src.schemas.department import DepartmentCreate, DepartmentOut

router = APIRouter(prefix="/admin/departments", tags=["departments"])


@router.get("", response_model=list[DepartmentOut])
async def list_departments(
    current_user: User = Depends(require_departments_view),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Department).order_by(Department.id.asc())
    stmt = apply_factory_scope_filter(stmt, Department.factory_id, current_user)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreate,
    current_user: User = Depends(require_departments_manage),
    db: AsyncSession = Depends(get_db),
):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None and payload.factory_id != scoped_id:
            raise HTTPException(status_code=403, detail="Cannot create department outside your factory scope")

    department = Department(
        factory_id=payload.factory_id,
        name=payload.name,
        code=payload.code,
    )
    db.add(department)
    await db.commit()
    await db.refresh(department)
    return department
