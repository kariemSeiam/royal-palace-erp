from sqlalchemy import Boolean, Column, Date, DateTime, ForeignKey, Integer, Numeric, String, JSON
from sqlalchemy.sql import func
from src.core.db.base import Base

class MachineData(Base):
    __tablename__ = "mrp_machine_data"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True)
    machine_id = Column(String(100), nullable=False)
    workcenter_id = Column(Integer, ForeignKey("mrp_workcenters.id"))
    metric_name = Column(String(100), nullable=False)
    metric_value = Column(Numeric(14,4), nullable=False)
    timestamp = Column(DateTime(timezone=True), server_default=func.now())

class ProductionEvent(Base):
    __tablename__ = "mrp_production_events"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True)
    manufacturing_order_id = Column(Integer, ForeignKey("work_orders.id"))
    event_type = Column(String(100))
    previous_hash = Column(String(255))
    current_hash = Column(String(255), nullable=False)
    data_json = Column(JSON)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class AutoWorkflow(Base):
    __tablename__ = "mrp_auto_workflows"
    id = Column(Integer, primary_key=True)
    name = Column(String(255), nullable=False)
    trigger_event = Column(String(100), nullable=False)
    condition_json = Column(JSON)
    action_type = Column(String(50), nullable=False)
    action_params = Column(JSON)
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class DemandForecast(Base):
    __tablename__ = "mrp_demand_forecasts"
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id"))
    forecast_date = Column(Date, nullable=False)
    predicted_quantity = Column(Numeric(14,3))
    confidence = Column(Numeric(5,2))
    model_version = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
