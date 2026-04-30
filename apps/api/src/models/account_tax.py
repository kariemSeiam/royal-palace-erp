from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class AccountTax(Base):
    __tablename__ = "account_taxes"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    rate = Column(Numeric(8,2), nullable=False, default=0)
    tax_type = Column(String(50), nullable=False, default="sales")
    tax_scope = Column(String(50), default="goods")
    country_id = Column(Integer)
    account_id = Column(Integer, ForeignKey("accounting_chart_accounts.id", ondelete="RESTRICT"))
    price_include = Column(Boolean, default=False)
    include_base_amount = Column(Boolean, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    description = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
