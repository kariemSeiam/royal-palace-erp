from __future__ import annotations

from datetime import datetime
from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    String,
    Table,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

try:
    from src.db.base import Base
except Exception:
    try:
        from src.db.base_class import Base
    except Exception:
        from sqlalchemy.orm import declarative_base
        Base = declarative_base()


role_permissions = Table(
    "rbac_role_permissions",
    Base.metadata,
    Column("role_id", ForeignKey("rbac_roles.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", ForeignKey("rbac_permissions.id", ondelete="CASCADE"), primary_key=True),
)

user_roles = Table(
    "rbac_user_roles",
    Base.metadata,
    Column("user_id", ForeignKey("users.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", ForeignKey("rbac_roles.id", ondelete="CASCADE"), primary_key=True),
)


class Permission(Base):
    __tablename__ = "rbac_permissions"
    __table_args__ = (
        UniqueConstraint("code", name="uq_rbac_permissions_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    module: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    roles: Mapped[list["Role"]] = relationship(
        "Role",
        secondary=role_permissions,
        back_populates="permissions",
    )


class Role(Base):
    __tablename__ = "rbac_roles"
    __table_args__ = (
        UniqueConstraint("code", name="uq_rbac_roles_code"),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    code: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    name: Mapped[str] = mapped_column(String(200), nullable=False)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_system: Mapped[bool] = mapped_column(Boolean, default=False, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    permissions: Mapped[list["Permission"]] = relationship(
        "Permission",
        secondary=role_permissions,
        back_populates="roles",
        lazy="selectin",
    )


def attach_user_role_relationships(UserModel):
    if not hasattr(UserModel, "roles"):
        UserModel.roles = relationship(
            "Role",
            secondary=user_roles,
            backref="users",
            lazy="selectin",
        )
