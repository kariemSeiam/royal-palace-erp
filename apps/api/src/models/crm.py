from sqlalchemy import String, Boolean, ForeignKey, Integer, Numeric, Date, Text, CheckConstraint, DateTime
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column
from src.core.db.base import Base, TimestampMixin

class CrmContact(Base, TimestampMixin):
    __tablename__ = "crm_contacts"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    mobile: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    job_title: Mapped[str | None] = mapped_column(String(255))
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class CrmTeam(Base, TimestampMixin):
    __tablename__ = "crm_teams"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    code: Mapped[str] = mapped_column(String(50), unique=True, nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class CrmLead(Base, TimestampMixin):
    __tablename__ = "crm_leads"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("crm_contacts.id", ondelete="SET NULL"))
    team_id: Mapped[int | None] = mapped_column(ForeignKey("crm_teams.id", ondelete="SET NULL"))
    factory_id: Mapped[int | None] = mapped_column(ForeignKey("factories.id", ondelete="SET NULL"))
    assigned_to_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    contact_name: Mapped[str] = mapped_column(String(255), nullable=False)
    company_name: Mapped[str | None] = mapped_column(String(255))
    email: Mapped[str | None] = mapped_column(String(255))
    phone: Mapped[str | None] = mapped_column(String(50))
    mobile: Mapped[str | None] = mapped_column(String(50))
    address: Mapped[str | None] = mapped_column(Text)
    city: Mapped[str | None] = mapped_column(String(100))
    country: Mapped[str | None] = mapped_column(String(100))
    source: Mapped[str | None] = mapped_column(String(100))
    priority: Mapped[str] = mapped_column(String(50), default="medium")
    status: Mapped[str] = mapped_column(String(50), default="new")
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class CrmOpportunity(Base, TimestampMixin):
    __tablename__ = "crm_opportunities"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("crm_leads.id", ondelete="SET NULL"))
    contact_id: Mapped[int | None] = mapped_column(ForeignKey("crm_contacts.id", ondelete="SET NULL"))
    team_id: Mapped[int | None] = mapped_column(ForeignKey("crm_teams.id", ondelete="SET NULL"))
    factory_id: Mapped[int | None] = mapped_column(ForeignKey("factories.id", ondelete="SET NULL"))
    assigned_to_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    contact_name: Mapped[str | None] = mapped_column(String(255))
    company_name: Mapped[str | None] = mapped_column(String(255))
    expected_revenue: Mapped[float | None] = mapped_column(Numeric(14,2))
    probability: Mapped[int] = mapped_column(Integer, default=0)
    stage: Mapped[str] = mapped_column(String(50), default="qualification")
    priority: Mapped[str] = mapped_column(String(50), default="medium")
    expected_closing_date: Mapped[str | None] = mapped_column(Date)
    notes: Mapped[str | None] = mapped_column(Text)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class CrmActivity(Base, TimestampMixin):
    __tablename__ = "crm_activities"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("crm_leads.id", ondelete="SET NULL"))
    opportunity_id: Mapped[int | None] = mapped_column(ForeignKey("crm_opportunities.id", ondelete="SET NULL"))
    team_id: Mapped[int | None] = mapped_column(ForeignKey("crm_teams.id", ondelete="SET NULL"))
    assigned_to_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))
    activity_type: Mapped[str] = mapped_column(String(50), default="task")
    subject: Mapped[str] = mapped_column(String(255), nullable=False)
    description: Mapped[str | None] = mapped_column(Text)
    due_date: Mapped[DateTime] = mapped_column(DateTime, nullable=True)
    is_done: Mapped[bool] = mapped_column(Boolean, default=False)
    done_at: Mapped[DateTime] = mapped_column(DateTime, nullable=True)
    notes: Mapped[str | None] = mapped_column(Text)

class CrmNote(Base, TimestampMixin):
    __tablename__ = "crm_notes"
    __table_args__ = (CheckConstraint("(lead_id IS NOT NULL) OR (opportunity_id IS NOT NULL)", name="crm_notes_entity"),)
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    lead_id: Mapped[int | None] = mapped_column(ForeignKey("crm_leads.id", ondelete="SET NULL"))
    opportunity_id: Mapped[int | None] = mapped_column(ForeignKey("crm_opportunities.id", ondelete="SET NULL"))
    note_type: Mapped[str] = mapped_column(String(50), default="comment")
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    created_by_user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"))

class CrmPipelineStage(Base, TimestampMixin):
    __tablename__ = "crm_pipeline_stages"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    team_id: Mapped[int | None] = mapped_column(ForeignKey("crm_teams.id", ondelete="SET NULL"))
    name: Mapped[str] = mapped_column(String(100), nullable=False)
    sequence: Mapped[int] = mapped_column(Integer, default=0)
    requirements: Mapped[str | None] = mapped_column(Text)
    automation_action: Mapped[str | None] = mapped_column(String(50))
    automation_trigger: Mapped[str | None] = mapped_column(String(50))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

class CrmAutomationRule(Base, TimestampMixin):
    __tablename__ = "crm_automation_rules"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    model: Mapped[str] = mapped_column(String(100), default="crm.lead")
    trigger_field: Mapped[str] = mapped_column(String(100))
    trigger_value: Mapped[str] = mapped_column(String(255))
    action_type: Mapped[str] = mapped_column(String(100))
    action_config: Mapped[dict] = mapped_column(JSONB, default={})
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
