from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, Time
from sqlalchemy.sql import func
from src.core.db.base import Base

class MrpWorkcenter(Base):
    __tablename__ = "mrp_workcenters"
    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False)
    name = Column(String(255), nullable=False)
    code = Column(String(100), nullable=False)
    capacity_per_day = Column(Numeric(10,2), default=0)
    time_efficiency = Column(Numeric(6,2), default=100)
    hourly_cost = Column(Numeric(12,4), default=0)
    hourly_overhead = Column(Numeric(12,4), default=0)
    costs_hour_account_id = Column(Integer)
    resource_calendar_id = Column(Integer)
    time_start = Column(Time, default="08:00")
    time_end = Column(Time, default="17:00")
    notes = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
