from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class MrpWorkOrder(Base):
    __tablename__ = "mrp_work_orders"
    id = Column(Integer, primary_key=True, index=True)
    manufacturing_order_id = Column(Integer, ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False)
    routing_step_id = Column(Integer, ForeignKey("mrp_routing_steps.id", ondelete="SET NULL"))
    workcenter_id = Column(Integer, ForeignKey("mrp_workcenters.id", ondelete="SET NULL"))
    state = Column(String(50), nullable=False, default="pending")
    planned_start_at = Column(DateTime(timezone=True))
    planned_end_at = Column(DateTime(timezone=True))
    actual_start_at = Column(DateTime(timezone=True))
    actual_end_at = Column(DateTime(timezone=True))
    duration_minutes = Column(Numeric(10,2))
    notes = Column(Text)
    scrap_quantity = Column(Numeric(14,3), default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
