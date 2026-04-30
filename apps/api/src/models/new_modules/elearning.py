from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric, JSON, Date
from sqlalchemy.sql import func
from src.core.db.session import Base

class ElearningCourses(Base):
    __tablename__ = "elearning_courses"
    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey('factories.id'))
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default='draft')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
