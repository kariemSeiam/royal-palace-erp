from pydantic import BaseModel

class EmployeeCreate(BaseModel):
    factory_id: int
    department_id: int
    first_name: str
    last_name: str
    job_title: str | None = None
    phone: str | None = None
    email: str | None = None

class EmployeeOut(BaseModel):
    id: int
    factory_id: int
    department_id: int
    first_name: str
    last_name: str
    job_title: str | None = None
    phone: str | None = None
    email: str | None = None
