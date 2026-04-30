from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class PosPaymentMethod(Base):
    __tablename__ = "pos_payment_methods"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class PosSession(Base):
    __tablename__ = "pos_sessions"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="SET NULL"))
    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    opened_at = Column(DateTime(timezone=True), server_default=func.now())
    closed_at = Column(DateTime(timezone=True))
    state = Column(String(50), default="opened")
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class PosOrder(Base):
    __tablename__ = "pos_orders"
    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("pos_sessions.id", ondelete="SET NULL"))
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    customer_name = Column(String(255))
    total_amount = Column(Numeric(14,2), default=0)
    state = Column(String(50), default="draft")
    payment_method_id = Column(Integer, ForeignKey("pos_payment_methods.id", ondelete="SET NULL"))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class PosOrderLine(Base):
    __tablename__ = "pos_order_lines"
    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("pos_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"))
    product_name = Column(String(255))
    quantity = Column(Numeric(14,2), default=1)
    unit_price = Column(Numeric(14,2), default=0)
    line_total = Column(Numeric(14,2))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
