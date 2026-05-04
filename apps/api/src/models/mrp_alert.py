from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class MrpQualityAlert(Base):
    __tablename__ = "mrp_quality_alerts"
    id = Column(Integer, primary_key=True, index=True)
    quality_check_id = Column(Integer, ForeignKey("quality_checks.id", ondelete="CASCADE"))
    user_id = Column(Integer, ForeignKey("users.id"))
    message = Column(Text, nullable=False)
    is_read = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
