from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    apply_factory_scope_filter,
    enforce_factory_scope,
    get_user_factory_scope_id,
    is_factory_scoped_user,
    require_departments_manage,
    require_departments_view,
    require_employees_manage,
    require_employees_view,
    require_factories_manage,
    require_factories_view,
)
from src.core.db.session import get_db
from src.models.erp_org import Department, Employee
from src.models.user import Factory, User
from src.schemas.erp_org import (
    DepartmentCreateRequest,
    DepartmentOut,
    EmployeeCreateRequest,
    EmployeeOut,
)

router = APIRouter(prefix="/admin/erp", tags=["admin-erp"])


def serialize_factory(row: Factory) -> dict:
    return {
        "id": row.id,
        "code": row.code,
        "name": row.name,
        "is_active": row.is_active,
    }


def serialize_department(row: Department) -> DepartmentOut:
    return DepartmentOut(
        id=row.id,
        factory_id=row.factory_id,
        name=row.name,
        code=row.code,
        is_active=row.is_active,
    )


def serialize_employee(row: Employee) -> EmployeeOut:
    return EmployeeOut(
        id=row.id,
        factory_id=row.factory_id,
        department_id=row.department_id,
        employee_code=row.employee_code,
        first_name=row.first_name,
        last_name=row.last_name,
        job_title=row.job_title,
        hire_date=row.hire_date,
        phone=row.phone,
        email=row.email,
        employment_status=row.employment_status,
        is_active=row.is_active,
    )


async def get_factory_or_404(db: AsyncSession, factory_id: int) -> Factory:
    result = await db.execute(select(Factory).where(Factory.id == factory_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Factory not found")
    return row


async def get_department_or_404(db: AsyncSession, department_id: int) -> Department:
    result = await db.execute(select(Department).where(Department.id == department_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Department not found")
    return row


async def get_employee_or_404(db: AsyncSession, employee_id: int) -> Employee:
    result = await db.execute(select(Employee).where(Employee.id == employee_id))
    row = result.scalar_one_or_none()
    if not row:
        raise HTTPException(status_code=404, detail="Employee not found")
    return row


@router.get("/factories")
async def list_factories(
    current_user: User = Depends(require_factories_view),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Factory).order_by(Factory.id.asc())

    scoped_factory_id = get_user_factory_scope_id(current_user)
    if scoped_factory_id is not None and not current_user.is_superuser:
        stmt = stmt.where(Factory.id == scoped_factory_id)

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [serialize_factory(row) for row in rows]


@router.post("/factories", status_code=status.HTTP_201_CREATED)
async def create_factory(
    payload: dict,
    current_user: User = Depends(require_factories_manage),
    db: AsyncSession = Depends(get_db),
):
    if is_factory_scoped_user(current_user):
        raise HTTPException(status_code=403, detail="Factory-scoped admin cannot create factories")

    code = str(payload.get("code") or "").strip()
    name = str(payload.get("name") or "").strip()
    is_active = payload.get("is_active", True)

    if not code or not name:
        raise HTTPException(status_code=400, detail="Factory code and name are required")

    existing_code = await db.execute(select(Factory).where(Factory.code == code))
    if existing_code.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Factory code already exists")

    existing_name = await db.execute(select(Factory).where(Factory.name == name))
    if existing_name.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Factory name already exists")

    factory = Factory(code=code, name=name, is_active=bool(is_active))
    db.add(factory)
    await db.commit()
    await db.refresh(factory)

    return serialize_factory(factory)


@router.put("/factories/{factory_id}")
async def update_factory(
    factory_id: int,
    payload: dict,
    current_user: User = Depends(require_factories_manage),
    db: AsyncSession = Depends(get_db),
):
    if is_factory_scoped_user(current_user):
        raise HTTPException(status_code=403, detail="Factory-scoped admin cannot modify factories")

    factory = await get_factory_or_404(db, factory_id)

    code = str(payload.get("code") or "").strip()
    name = str(payload.get("name") or "").strip()
    is_active = payload.get("is_active", factory.is_active)

    if not code or not name:
        raise HTTPException(status_code=400, detail="Factory code and name are required")

    existing_code = await db.execute(
        select(Factory).where(Factory.code == code, Factory.id != factory_id)
    )
    if existing_code.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Factory code already exists")

    existing_name = await db.execute(
        select(Factory).where(Factory.name == name, Factory.id != factory_id)
    )
    if existing_name.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Factory name already exists")

    factory.code = code
    factory.name = name
    factory.is_active = bool(is_active)

    await db.commit()
    await db.refresh(factory)
    return serialize_factory(factory)


@router.patch("/factories/{factory_id}/status")
async def update_factory_status(
    factory_id: int,
    payload: dict,
    current_user: User = Depends(require_factories_manage),
    db: AsyncSession = Depends(get_db),
):
    if is_factory_scoped_user(current_user):
        raise HTTPException(status_code=403, detail="Factory-scoped admin cannot modify factories")

    factory = await get_factory_or_404(db, factory_id)

    if "is_active" not in payload:
        raise HTTPException(status_code=400, detail="is_active is required")

    factory.is_active = bool(payload.get("is_active"))
    await db.commit()
    await db.refresh(factory)

    response = serialize_factory(factory)
    response["message"] = "Factory status updated successfully"
    return response


@router.delete("/factories/{factory_id}")
async def delete_factory(
    factory_id: int,
    current_user: User = Depends(require_factories_manage),
    db: AsyncSession = Depends(get_db),
):
    if is_factory_scoped_user(current_user):
        raise HTTPException(status_code=403, detail="Factory-scoped admin cannot delete factories")

    factory = await get_factory_or_404(db, factory_id)

    department_exists = await db.execute(
        select(Department).where(Department.factory_id == factory_id)
    )
    if department_exists.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Cannot delete factory with linked departments")

    employee_exists = await db.execute(
        select(Employee).where(Employee.factory_id == factory_id)
    )
    if employee_exists.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Cannot delete factory with linked employees")

    await db.delete(factory)
    await db.commit()
    return {"message": "Factory deleted successfully"}


@router.get("/departments", response_model=list[DepartmentOut])
async def list_departments(
    current_user: User = Depends(require_departments_view),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Department).order_by(Department.id.asc())
    stmt = apply_factory_scope_filter(stmt, Department.factory_id, current_user)

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [serialize_department(row) for row in rows]


@router.post("/departments", response_model=DepartmentOut, status_code=status.HTTP_201_CREATED)
async def create_department(
    payload: DepartmentCreateRequest,
    current_user: User = Depends(require_departments_manage),
    db: AsyncSession = Depends(get_db),
):
    enforce_factory_scope(
        current_user,
        payload.factory_id,
        detail="Cannot create department outside assigned factory",
    )

    await get_factory_or_404(db, payload.factory_id)

    existing = await db.execute(
        select(Department).where(
            Department.factory_id == payload.factory_id,
            Department.code == payload.code,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Department code already exists for this factory")

    department = Department(
        factory_id=payload.factory_id,
        name=payload.name,
        code=payload.code,
        is_active=payload.is_active,
    )
    db.add(department)
    await db.commit()
    await db.refresh(department)

    return serialize_department(department)


@router.put("/departments/{department_id}", response_model=DepartmentOut)
async def update_department(
    department_id: int,
    payload: dict,
    current_user: User = Depends(require_departments_manage),
    db: AsyncSession = Depends(get_db),
):
    department = await get_department_or_404(db, department_id)

    enforce_factory_scope(
        current_user,
        department.factory_id,
        detail="Cannot update department outside assigned factory",
    )

    name = str(payload.get("name") or "").strip()
    code = str(payload.get("code") or "").strip()
    is_active = payload.get("is_active", department.is_active)

    if not name or not code:
        raise HTTPException(status_code=400, detail="Department name and code are required")

    existing = await db.execute(
        select(Department).where(
            Department.factory_id == department.factory_id,
            Department.code == code,
            Department.id != department_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Department code already exists for this factory")

    department.name = name
    department.code = code
    department.is_active = bool(is_active)

    await db.commit()
    await db.refresh(department)

    return serialize_department(department)


@router.delete("/departments/{department_id}")
async def delete_department(
    department_id: int,
    current_user: User = Depends(require_departments_manage),
    db: AsyncSession = Depends(get_db),
):
    department = await get_department_or_404(db, department_id)

    enforce_factory_scope(
        current_user,
        department.factory_id,
        detail="Cannot delete department outside assigned factory",
    )

    employee_exists = await db.execute(
        select(Employee).where(Employee.department_id == department_id)
    )
    if employee_exists.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Cannot delete department with linked employees")

    await db.delete(department)
    await db.commit()
    return {"message": "Department deleted successfully"}


@router.get("/employees", response_model=list[EmployeeOut])
async def list_employees(
    current_user: User = Depends(require_employees_view),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Employee).order_by(Employee.id.asc())
    stmt = apply_factory_scope_filter(stmt, Employee.factory_id, current_user)

    result = await db.execute(stmt)
    rows = result.scalars().all()
    return [serialize_employee(row) for row in rows]


@router.post("/employees", response_model=EmployeeOut, status_code=status.HTTP_201_CREATED)
async def create_employee(
    payload: EmployeeCreateRequest,
    current_user: User = Depends(require_employees_manage),
    db: AsyncSession = Depends(get_db),
):
    enforce_factory_scope(
        current_user,
        payload.factory_id,
        detail="Cannot create employee outside assigned factory",
    )

    await get_factory_or_404(db, payload.factory_id)

    department_result = await db.execute(
        select(Department).where(
            Department.id == payload.department_id,
            Department.factory_id == payload.factory_id,
        )
    )
    department = department_result.scalar_one_or_none()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found for this factory")

    code_result = await db.execute(
        select(Employee).where(
            Employee.factory_id == payload.factory_id,
            Employee.employee_code == payload.employee_code,
        )
    )
    if code_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Employee code already exists for this factory")

    employee = Employee(
        factory_id=payload.factory_id,
        department_id=payload.department_id,
        employee_code=payload.employee_code,
        first_name=payload.first_name,
        last_name=payload.last_name,
        job_title=payload.job_title,
        hire_date=payload.hire_date,
        phone=payload.phone,
        email=payload.email,
        employment_status=payload.employment_status,
        is_active=payload.is_active,
    )
    db.add(employee)
    await db.commit()
    await db.refresh(employee)

    return serialize_employee(employee)


@router.put("/employees/{employee_id}", response_model=EmployeeOut)
async def update_employee(
    employee_id: int,
    payload: EmployeeCreateRequest,
    current_user: User = Depends(require_employees_manage),
    db: AsyncSession = Depends(get_db),
):
    employee = await get_employee_or_404(db, employee_id)

    enforce_factory_scope(
        current_user,
        employee.factory_id,
        detail="Cannot update employee outside assigned factory",
    )
    enforce_factory_scope(
        current_user,
        payload.factory_id,
        detail="Cannot move employee outside assigned factory",
    )

    await get_factory_or_404(db, payload.factory_id)

    department_result = await db.execute(
        select(Department).where(
            Department.id == payload.department_id,
            Department.factory_id == payload.factory_id,
        )
    )
    department = department_result.scalar_one_or_none()
    if not department:
        raise HTTPException(status_code=404, detail="Department not found for this factory")

    code_result = await db.execute(
        select(Employee).where(
            Employee.factory_id == payload.factory_id,
            Employee.employee_code == payload.employee_code,
            Employee.id != employee_id,
        )
    )
    if code_result.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Employee code already exists for this factory")

    employee.factory_id = payload.factory_id
    employee.department_id = payload.department_id
    employee.employee_code = payload.employee_code
    employee.first_name = payload.first_name
    employee.last_name = payload.last_name
    employee.job_title = payload.job_title
    employee.hire_date = payload.hire_date
    employee.phone = payload.phone
    employee.email = payload.email
    employee.employment_status = payload.employment_status
    employee.is_active = payload.is_active

    await db.commit()
    await db.refresh(employee)

    return serialize_employee(employee)


@router.delete("/employees/{employee_id}")
async def delete_employee(
    employee_id: int,
    current_user: User = Depends(require_employees_manage),
    db: AsyncSession = Depends(get_db),
):
    employee = await get_employee_or_404(db, employee_id)

    enforce_factory_scope(
        current_user,
        employee.factory_id,
        detail="Cannot delete employee outside assigned factory",
    )

    await db.delete(employee)
    await db.commit()
    return {"message": "Employee deleted successfully"}
