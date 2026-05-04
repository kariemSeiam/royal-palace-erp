from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.sql import func

from src.core.db.base import Base


class RequestForQuotation(Base):
    __tablename__ = "procurement_requests_for_quotation"

    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    rfq_number = Column(String(100), unique=True, nullable=False, index=True)
    status = Column(String(50), nullable=False, default="draft", server_default="draft") # draft, sent, received, analyzed, closed, cancelled
    
    # Supplier Information (optional, if RFQ is sent to specific suppliers)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="SET NULL"), nullable=True, index=True)
    
    # Dates
    request_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    due_date = Column(DateTime(timezone=True), nullable=True)
    response_deadline = Column(DateTime(timezone=True), nullable=True)

    # Details
    title = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    
    # Audit Fields
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    sent_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class RequestForQuotationItem(Base):
    __tablename__ = "procurement_request_for_quotation_items"

    id = Column(Integer, primary_key=True, index=True)
    rfq_id = Column(Integer, ForeignKey("procurement_requests_for_quotation.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    quantity = Column(Numeric(14, 2), nullable=False, default=0)
    unit_of_measure = Column(String(50), nullable=True) # e.g., "Units", "KG", "Liter"
    
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class SupplierQuotation(Base):
    __tablename__ = "procurement_supplier_quotations"

    id = Column(Integer, primary_key=True, index=True)
    rfq_id = Column(Integer, ForeignKey("procurement_requests_for_quotation.id", ondelete="CASCADE"), nullable=False, index=True)
    supplier_id = Column(Integer, ForeignKey("suppliers.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    quotation_number = Column(String(100), nullable=False, index=True)
    quotation_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    valid_until = Column(DateTime(timezone=True), nullable=True)
    
    status = Column(String(50), nullable=False, default="received", server_default="received") # received, accepted, rejected, expired
    
    total_amount = Column(Numeric(14, 2), nullable=False, default=0)
    currency = Column(String(10), nullable=False, default="EGP")
    
    notes = Column(Text, nullable=True)
    
    submitted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    accepted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    accepted_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class SupplierQuotationItem(Base):
    __tablename__ = "procurement_supplier_quotation_items"

    id = Column(Integer, primary_key=True, index=True)
    quotation_id = Column(Integer, ForeignKey("procurement_supplier_quotations.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    
    quantity = Column(Numeric(14, 2), nullable=False, default=0)
    unit_price = Column(Numeric(14, 2), nullable=False, default=0)
    line_total = Column(Numeric(14, 2), nullable=False, default=0)
    
    notes = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
