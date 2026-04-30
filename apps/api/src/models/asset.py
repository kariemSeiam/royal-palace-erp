from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, Date
from sqlalchemy.sql import func
from src.core.db.base import Base

class Asset(Base):
    __tablename__ = "assets"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    purchase_date = Column(Date)
    purchase_value = Column(Numeric(14,2))
    salvage_value = Column(Numeric(14,2))
    useful_life_years = Column(Integer, default=5)
    current_value = Column(Numeric(14,2))
    depreciation_method = Column(String(50), default="straight_line")
    status = Column(String(50), default="active")
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class AssetDepreciationLine(Base):
    __tablename__ = "asset_depreciation_lines"
    id = Column(Integer, primary_key=True, index=True)
    asset_id = Column(Integer, ForeignKey("assets.id", ondelete="CASCADE"), nullable=False)
    fiscal_year = Column(Integer, nullable=False)
    depreciation_amount = Column(Numeric(14,2), default=0)
    accumulated_depreciation = Column(Numeric(14,2), default=0)
    net_book_value = Column(Numeric(14,2))
    created_at = Column(DateTime(timezone=True), server_default=func.now())
