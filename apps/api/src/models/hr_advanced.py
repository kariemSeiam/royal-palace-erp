from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text, Date, Numeric
from sqlalchemy.sql import func
from src.core.db.base import Base

class HrJobPosition(Base):
    __tablename__ = "hr_job_positions"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"))
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class HrApplicant(Base):
    __tablename__ = "hr_applicants"
    id = Column(Integer, primary_key=True, index=True)
    job_id = Column(Integer, ForeignKey("hr_job_positions.id", ondelete="SET NULL"))
    first_name = Column(String(255), nullable=False)
    last_name = Column(String(255), nullable=False)
    email = Column(String(255))
    phone = Column(String(50))
    resume_url = Column(Text)
    status = Column(String(50), default="new")
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class HrContract(Base):
    __tablename__ = "hr_contracts"
    id = Column(Integer, primary_key=True, index=True)
    employee_id = Column(Integer, ForeignKey("employees.id", ondelete="CASCADE"), nullable=False)
    contract_type = Column(String(50), default="permanent")
    start_date = Column(Date, nullable=False)
    end_date = Column(Date)
    job_title = Column(String(255))
    department_id = Column(Integer, ForeignKey("departments.id", ondelete="SET NULL"))
    salary_amount = Column(Numeric(14,2))
    status = Column(String(50), default="active")
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
