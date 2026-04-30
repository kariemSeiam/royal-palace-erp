from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class AccountPaymentTermLine(Base):
    __tablename__ = "account_payment_term_lines"
    id = Column(Integer, primary_key=True, index=True)
    term_id = Column(Integer, ForeignKey("account_payment_terms.id", ondelete="CASCADE"), nullable=False)
    sequence = Column(Integer, default=10)
    value_type = Column(String(20), default="percent")
    value = Column(Numeric(14,2), default=0)
    days = Column(Integer, default=0)
    discount_percentage = Column(Numeric(5,2))
    discount_days = Column(Integer)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
