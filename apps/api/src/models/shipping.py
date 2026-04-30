from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class ShippingCarrier(Base):
    __tablename__ = "shipping_carriers"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    tracking_url_prefix = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ShippingRate(Base):
    __tablename__ = "shipping_rates"
    id = Column(Integer, primary_key=True, index=True)
    carrier_id = Column(Integer, ForeignKey("shipping_carriers.id", ondelete="CASCADE"))
    name = Column(String(255), nullable=False)
    price = Column(Numeric(14,2), default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
