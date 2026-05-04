from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class MrpBomAttachment(Base):
    __tablename__ = "mrp_bom_attachments"
    id = Column(Integer, primary_key=True, index=True)
    bom_id = Column(Integer, ForeignKey("mrp_boms.id", ondelete="CASCADE"), nullable=False)
    file_name = Column(String(255), nullable=False)
    file_url = Column(Text, nullable=False)
    file_type = Column(String(50))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
