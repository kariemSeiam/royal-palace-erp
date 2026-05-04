from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class MrpUnbuildOrder(Base):
    __tablename__ = "mrp_unbuild_orders"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    quantity = Column(Numeric(14,3), nullable=False, default=0)
    bom_id = Column(Integer, ForeignKey("mrp_boms.id", ondelete="SET NULL"))
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    state = Column(String(50), nullable=False, default="draft")
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
