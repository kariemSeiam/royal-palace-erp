from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class PlanningResource(Base):
    __tablename__ = "planning_resources"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    resource_type = Column(String(50), default="employee")
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"))
    work_order_id = Column(Integer, ForeignKey("work_orders.id", ondelete="SET NULL"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class PlanningSlot(Base):
    __tablename__ = "planning_slots"
    id = Column(Integer, primary_key=True, index=True)
    resource_id = Column(Integer, ForeignKey("planning_resources.id", ondelete="CASCADE"), nullable=False)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    work_order_id = Column(Integer, ForeignKey("work_orders.id", ondelete="SET NULL"))
    planned_start_at = Column(DateTime(timezone=True), nullable=False)
    planned_end_at = Column(DateTime(timezone=True), nullable=False)
    actual_start_at = Column(DateTime(timezone=True))
    actual_end_at = Column(DateTime(timezone=True))
    status = Column(String(50), default="planned")
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
