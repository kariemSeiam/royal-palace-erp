from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric, JSON, Date
from sqlalchemy.sql import func
from src.core.db.session import Base

class RentalProducts(Base):
    __tablename__ = "rental_products"
    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey('factories.id'))
    name = Column(String(255), nullable=False)
    description = Column(Text)
    daily_rate = Column(Numeric(10,2))
    status = Column(String(50), default='available')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class RentalContracts(Base):
    __tablename__ = "rental_contracts"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey('rental_products.id'))
    customer_name = Column(String(255), nullable=False)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String(50), default='active')
    notes = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
