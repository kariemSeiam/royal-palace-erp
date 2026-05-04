from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from src.core.db.base import Base

class IotThreshold(Base):
    __tablename__ = "maintenance_iot_thresholds"
    id = Column(Integer, primary_key=True)
    equipment_id = Column(Integer, ForeignKey("maintenance_equipment.id"))
    metric_name = Column(String(100))
    min_value = Column(Numeric(14,4))
    max_value = Column(Numeric(14,4))
    alert_message = Column(Text)
    active = Column(Boolean, default=True)
