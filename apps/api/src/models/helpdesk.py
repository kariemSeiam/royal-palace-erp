from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class HelpdeskTeam(Base):
    __tablename__ = "helpdesk_teams"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class HelpdeskTicket(Base):
    __tablename__ = "helpdesk_tickets"
    id = Column(Integer, primary_key=True, index=True)
    team_id = Column(Integer, ForeignKey("helpdesk_teams.id", ondelete="SET NULL"))
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    assigned_to_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    subject = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default="new")
    priority = Column(String(50), default="normal")
    ticket_type = Column(String(50), default="issue")
    customer_name = Column(String(255))
    customer_email = Column(String(255))
    customer_phone = Column(String(50))
    resolution_notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
