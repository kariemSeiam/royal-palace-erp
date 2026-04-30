from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric, JSON, Date
from sqlalchemy.sql import func
from src.core.db.session import Base

class SmsCampaigns(Base):
    __tablename__ = "sms_campaigns"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    message_text = Column(Text, nullable=False)
    recipient_list = Column(JSONB)
    scheduled_at = Column(DateTime(timezone=True))
    sent_at = Column(DateTime(timezone=True))
    status = Column(String(50), default='draft')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
