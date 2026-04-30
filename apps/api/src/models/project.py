from sqlalchemy import String, Boolean, ForeignKey, Integer, Date, Text
from sqlalchemy.orm import Mapped, mapped_column
from src.core.db.base import Base, TimestampMixin

class ProjectProject(Base, TimestampMixin):
    __tablename__ = "project_projects"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    factory_id: Mapped[int | None] = mapped_column(ForeignKey("factories.id", ondelete="SET NULL"), nullable=True)
    manager_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    start_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    end_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="planning")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)

class ProjectTask(Base, TimestampMixin):
    __tablename__ = "project_tasks"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    project_id: Mapped[int] = mapped_column(ForeignKey("project_projects.id", ondelete="CASCADE"), nullable=False)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    assigned_to_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    factory_id: Mapped[int | None] = mapped_column(ForeignKey("factories.id", ondelete="SET NULL"), nullable=True)
    planned_start_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    planned_end_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    actual_start_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    actual_end_date: Mapped[str | None] = mapped_column(Date, nullable=True)
    progress_percent: Mapped[int] = mapped_column(Integer, default=0)
    priority: Mapped[str] = mapped_column(String(50), default="normal")
    stage: Mapped[str] = mapped_column(String(50), default="todo")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, nullable=False)
