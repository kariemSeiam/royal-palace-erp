from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric
from sqlalchemy.sql import func
from src.core.db.base import Base

class MrpRule(Base):
    __tablename__ = "mrp_mrp_rules"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    minimum_quantity = Column(Numeric(14,3), default=0)
    maximum_quantity = Column(Numeric(14,3), default=1000)
    reorder_quantity = Column(Numeric(14,3), default=100)
    supplier_id = Column(Integer)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
