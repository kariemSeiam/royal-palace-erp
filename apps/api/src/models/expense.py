from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text, Date
from sqlalchemy.sql import func
from src.core.db.base import Base

class ExpenseCategory(Base):
    __tablename__ = "expense_categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class Expense(Base):
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("expense_categories.id", ondelete="SET NULL"))
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"))
    submitted_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    budget_id = Column(Integer, ForeignKey("budgets.id", ondelete="SET NULL"))
    cost_center_id = Column(Integer, ForeignKey("cost_centers.id", ondelete="SET NULL"))
    description = Column(Text, nullable=False)
    amount = Column(Numeric(14,2), nullable=False)
    expense_date = Column(Date)
    status = Column(String(50), default="draft")
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
