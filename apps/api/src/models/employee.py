from sqlalchemy import String, Boolean, ForeignKey, Date
from sqlalchemy.orm import Mapped, mapped_column
from src.core.db.base import Base, TimestampMixin

class Employee(Base, TimestampMixin):
    __tablename__ = "employees"

    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)

    factory_id: Mapped[int] = mapped_column(ForeignKey("factories.id"), nullable=False)
    department_id: Mapped[int] = mapped_column(ForeignKey("departments.id"), nullable=False)

    first_name: Mapped[str] = mapped_column(String(100), nullable=False)
    last_name: Mapped[str] = mapped_column(String(100), nullable=False)

    job_title: Mapped[str | None] = mapped_column(String(255))

    hire_date: Mapped[str | None] = mapped_column(Date)

    phone: Mapped[str | None] = mapped_column(String(50))
    email: Mapped[str | None] = mapped_column(String(255))

    status: Mapped[str] = mapped_column(String(50), default="active")

    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
