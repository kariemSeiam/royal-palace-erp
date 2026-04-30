from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, Date
from sqlalchemy.sql import func
from src.core.db.base import Base

class StockLot(Base):
    __tablename__ = "stock_lots"
    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    lot_number = Column(String(100), nullable=False)
    tracking = Column(String(20), default="lot")
    description = Column(Text)
    production_date = Column(Date)
    expiration_date = Column(Date)
    alert_date = Column(Date)
    removal_date = Column(Date)
    quantity = Column(Numeric(14,2), nullable=False, default=0)
    reserved_quantity = Column(Numeric(14,2), nullable=False, default=0)
    uom = Column(String(20), default="Units")
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
