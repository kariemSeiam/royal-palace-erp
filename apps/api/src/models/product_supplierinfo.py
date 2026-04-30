from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, Date
from sqlalchemy.sql import func
from src.core.db.base import Base

class ProductSupplierInfo(Base):
    __tablename__ = "product_supplierinfos"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="CASCADE"), nullable=False)
    supplier_sku = Column(String(100))
    product_name = Column(String(255))
    min_order_qty = Column(Numeric(14,2), default=0)
    price = Column(Numeric(14,2), default=0)
    currency_id = Column(Integer)
    date_start = Column(Date)
    date_end = Column(Date)
    lead_time_days = Column(Integer, default=7)
    is_preferred = Column(Boolean, nullable=False, default=False)
    notes = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
