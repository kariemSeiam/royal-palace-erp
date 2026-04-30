from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric, JSON, Date
from sqlalchemy.sql import func
from src.core.db.session import Base

class TimesheetEntries(Base):
    __tablename__ = "timesheet_entries"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey('users.id'))
    project_id = Column(Integer, ForeignKey('project_projects.id'))
    task_id = Column(Integer, ForeignKey('project_tasks.id'))
    date = Column(Date, nullable=False)
    hours = Column(Numeric(4,2), default=0)
    description = Column(Text)
    status = Column(String(50), default='draft')
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
