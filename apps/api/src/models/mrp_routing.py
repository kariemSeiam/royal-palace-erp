from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class MrpRouting(Base):
    __tablename__ = "mrp_routings"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(100), nullable=False, unique=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"))
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class MrpRoutingStep(Base):
    __tablename__ = "mrp_routing_steps"
    id = Column(Integer, primary_key=True, index=True)
    routing_id = Column(Integer, ForeignKey("mrp_routings.id", ondelete="CASCADE"), nullable=False)
    step_no = Column(Integer, nullable=False, default=1)
    step_code = Column(String(100))
    step_name = Column(String(255), nullable=False)
    workcenter_id = Column(Integer, ForeignKey("mrp_workcenters.id", ondelete="SET NULL"))
    standard_minutes = Column(Numeric(10,2))
    notes = Column(Text)
    is_outsourced = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
