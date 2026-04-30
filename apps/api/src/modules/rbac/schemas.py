from __future__ import annotations

from pydantic import BaseModel, Field
from typing import List, Optional


class PermissionOut(BaseModel):
    id: int
    code: str
    name: str
    module: str
    description: Optional[str] = None
    is_active: bool

    class Config:
        from_attributes = True


class RoleCreate(BaseModel):
    code: str = Field(..., min_length=2, max_length=120)
    name: str = Field(..., min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    permission_codes: List[str] = Field(default_factory=list)


class RoleUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=200)
    description: Optional[str] = Field(default=None, max_length=500)
    is_active: Optional[bool] = None
    permission_codes: Optional[List[str]] = None


class RoleOut(BaseModel):
    id: int
    code: str
    name: str
    description: Optional[str] = None
    is_system: bool
    is_active: bool
    permissions: List[PermissionOut] = []

    class Config:
        from_attributes = True


class AssignUserRolesIn(BaseModel):
    role_codes: List[str] = Field(default_factory=list)


class UserRoleOut(BaseModel):
    user_id: int
    role_codes: List[str]
    permissions: List[str]
