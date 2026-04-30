from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class FieldServiceTeam(Base):
    __tablename__ = "field_service_teams"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class FieldServiceWorker(Base):
    __tablename__ = "field_service_workers"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), unique=True)
    team_id = Column(Integer, ForeignKey("field_service_teams.id", ondelete="SET NULL"))
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class FieldServiceOrder(Base):
    __tablename__ = "field_service_orders"
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("field_service_teams.id", ondelete="SET NULL"))
    assigned_worker_id = Column(Integer, ForeignKey("field_service_workers.id", ondelete="SET NULL"))
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    customer_name = Column(String(255), nullable=False)
    customer_phone = Column(String(50))
    address = Column(Text)
    scheduled_date = Column(DateTime(timezone=True))
    completed_date = Column(DateTime(timezone=True))
    status = Column(String(50), default="pending")
    priority = Column(String(50), default="normal")
    description = Column(Text)
    resolution_notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class FieldServiceTask(Base):
    __tablename__ = "field_service_tasks"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("field_service_orders.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    assigned_worker_id = Column(Integer, ForeignKey("field_service_workers.id", ondelete="SET NULL"))
    completed = Column(Boolean, default=False)
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
