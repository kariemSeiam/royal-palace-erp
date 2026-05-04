from sqlalchemy import Column, DateTime, ForeignKey, Integer, String
from sqlalchemy.sql import func
from src.core.db.base import Base

class MrpBomVariant(Base):
    __tablename__ = "mrp_bom_variants"
    id = Column(Integer, primary_key=True, index=True)
    bom_id = Column(Integer, ForeignKey("mrp_boms.id", ondelete="CASCADE"), nullable=False)
    variant_name = Column(String(100), nullable=False)
    variant_value = Column(String(100))
    product_variant_id = Column(Integer)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
