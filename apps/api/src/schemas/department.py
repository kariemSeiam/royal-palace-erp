from pydantic import BaseModel

class DepartmentCreate(BaseModel):
    factory_id: int
    name: str
    code: str

class DepartmentOut(BaseModel):
    id: int
    factory_id: int
    name: str
    code: str
