from sqlalchemy import String, Boolean, ForeignKey, Text, Integer, DateTime
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func
from src.core.db.base import Base, TimestampMixin

class BarcodeTemplate(Base, TimestampMixin):
    __tablename__ = "barcode_templates"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    factory_id: Mapped[int | None] = mapped_column(ForeignKey("factories.id", ondelete="SET NULL"), nullable=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    format_type: Mapped[str] = mapped_column(String(50), default="code128")
    width: Mapped[int] = mapped_column(Integer, default=300)
    height: Mapped[int] = mapped_column(Integer, default=100)
    include_text: Mapped[bool] = mapped_column(Boolean, default=True)

class BarcodePrintLog(Base, TimestampMixin):
    __tablename__ = "barcode_print_logs"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    factory_id: Mapped[int | None] = mapped_column(ForeignKey("factories.id", ondelete="SET NULL"), nullable=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    entity_type: Mapped[str] = mapped_column(String(100), nullable=False)
    entity_id: Mapped[int] = mapped_column(Integer, nullable=False)
    barcode_data: Mapped[str] = mapped_column(String(500), nullable=False)
    printed_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())
