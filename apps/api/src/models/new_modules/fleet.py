from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric, JSON, Date
from sqlalchemy.sql import func
from src.core.db.session import Base

class FleetVehicles(Base):
    __tablename__ = "fleet_vehicles"
    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey('factories.id'))
    name = Column(String(255), nullable=False)
    model = Column(String(100))
    plate_number = Column(String(50))
    vin = Column(String(100))
    status = Column(String(50), default='active')
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
