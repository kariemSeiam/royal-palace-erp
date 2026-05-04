from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class MrpBomVersion(Base):
    __tablename__ = "mrp_bom_versions"
    id = Column(Integer, primary_key=True, index=True)
    bom_id = Column(Integer, ForeignKey("mrp_boms.id", ondelete="CASCADE"), nullable=False)
    version_number = Column(Integer, nullable=False)
    eco_number = Column(String(100))
    eco_state = Column(String(50), nullable=False, default="draft")
    approved_by = Column(Integer, ForeignKey("users.id"))
    approved_at = Column(DateTime(timezone=True))
    changes = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
