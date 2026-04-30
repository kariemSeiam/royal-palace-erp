from pydantic import BaseModel, Field


class FactoryCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255)
    code: str = Field(min_length=2, max_length=50)
    is_active: bool = True


class FactoryOut(BaseModel):
    id: int
    name: str
    code: str
    is_active: bool
