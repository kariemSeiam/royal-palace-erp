from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class MrpBom(Base):
    __tablename__ = "mrp_boms"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(100), nullable=False, unique=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"))
    bom_type = Column(String(50), nullable=False, default="manufacture")
    version = Column(Integer, nullable=False, default=1)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(Text)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)

class MrpBomLine(Base):
    __tablename__ = "mrp_bom_lines"
    id = Column(Integer, primary_key=True, index=True)
    bom_id = Column(Integer, ForeignKey("mrp_boms.id", ondelete="CASCADE"), nullable=False)
    line_no = Column(Integer, nullable=False, default=1)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"))
    raw_material_name = Column(String(255))
    quantity = Column(Numeric(14,3), nullable=False, default=0)
    unit = Column(String(50))
    waste_percent = Column(Numeric(8,2), default=0)
    notes = Column(Text)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
