from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class MaintenanceEquipment(Base):
    __tablename__ = "maintenance_equipment"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    description = Column(Text)
    status = Column(String(50), default="operational")
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class MaintenanceRepair(Base):
    __tablename__ = "maintenance_repairs"
    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("maintenance_equipment.id", ondelete="CASCADE"), nullable=False)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    assigned_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    description = Column(Text)
    status = Column(String(50), default="pending")
    priority = Column(String(50), default="normal")
    started_at = Column(DateTime(timezone=True))
    completed_at = Column(DateTime(timezone=True))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
