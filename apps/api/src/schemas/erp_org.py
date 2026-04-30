from pydantic import BaseModel, Field
from datetime import date

class DepartmentCreateRequest(BaseModel):
    factory_id: int
    name: str = Field(min_length=2, max_length=255)
    code: str = Field(min_length=2, max_length=50)
    is_active: bool = True

class DepartmentOut(BaseModel):
    id: int
    factory_id: int
    name: str
    code: str
    is_active: bool

class EmployeeCreateRequest(BaseModel):
    factory_id: int
    department_id: int
    employee_code: str = Field(min_length=2, max_length=50)
    first_name: str = Field(min_length=2, max_length=100)
    last_name: str = Field(min_length=2, max_length=100)
    job_title: str | None = None
    hire_date: date | None = None
    phone: str | None = None
    email: str | None = None
    employment_status: str = "active"
    is_active: bool = True

class EmployeeOut(BaseModel):
    id: int
    factory_id: int
    department_id: int
    employee_code: str
    first_name: str
    last_name: str
    job_title: str | None = None
    hire_date: date | None = None
    phone: str | None = None
    email: str | None = None
    employment_status: str
    is_active: bool
