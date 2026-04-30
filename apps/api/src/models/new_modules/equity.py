from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric, JSON, Date
from sqlalchemy.sql import func
from src.core.db.session import Base

class EquityShares(Base):
    __tablename__ = "equity_shares"
    id = Column(Integer, primary_key=True, index=True)
    partner_name = Column(String(255), nullable=False)
    percentage = Column(Numeric(5,2), nullable=False)
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
