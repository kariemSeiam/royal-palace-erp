from sqlalchemy import Column, Date, DateTime, ForeignKey, Integer, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class MaintenancePreventiveRule(Base):
    __tablename__ = "maintenance_preventive_rules"
    id = Column(Integer, primary_key=True, index=True)
    equipment_id = Column(Integer, ForeignKey("maintenance_equipment.id", ondelete="CASCADE"), nullable=False)
    frequency_hours = Column(Integer)
    frequency_days = Column(Integer)
    next_maintenance_date = Column(Date)
    instructions = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
