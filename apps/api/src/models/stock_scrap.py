from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class StockScrap(Base):
    __tablename__ = "stock_scraps"
    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)
    lot_id = Column(Integer, ForeignKey("stock_lots.id", ondelete="SET NULL"))
    quantity = Column(Numeric(14,2), nullable=False)
    uom_id = Column(Integer)
    scrap_reason = Column(String(200))
    state = Column(String(20), default="draft")
    date_done = Column(DateTime(timezone=True))
    notes = Column(Text)
    movement_id = Column(Integer, ForeignKey("inventory_movements.id", ondelete="SET NULL"))
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
