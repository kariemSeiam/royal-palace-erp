from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class SignRequest(Base):
    __tablename__ = "sign_requests"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    document_url = Column(Text)
    requested_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    signer_name = Column(String(255))
    signer_email = Column(String(255))
    status = Column(String(50), default="pending")
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
