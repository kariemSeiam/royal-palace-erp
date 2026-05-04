from sqlalchemy import Column, DateTime, ForeignKey, Integer
from sqlalchemy.sql import func
from src.core.db.base import Base

class MrpProductAlternative(Base):
    __tablename__ = "mrp_product_alternatives"
    id = Column(Integer, primary_key=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    alternative_product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    priority = Column(Integer, default=1)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
