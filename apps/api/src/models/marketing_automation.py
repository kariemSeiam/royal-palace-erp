from sqlalchemy import String, Boolean, ForeignKey, Text, Integer, JSON
from sqlalchemy.orm import Mapped, mapped_column
from src.core.db.base import Base, TimestampMixin

class AutomationWorkflow(Base, TimestampMixin):
    __tablename__ = "automation_workflows"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    factory_id: Mapped[int | None] = mapped_column(ForeignKey("factories.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    trigger_type: Mapped[str] = mapped_column(String(100), nullable=False)
    action_config: Mapped[dict] = mapped_column(JSON, nullable=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
