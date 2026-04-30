from sqlalchemy import String, Boolean, ForeignKey, Text, Integer, Date
from sqlalchemy.orm import Mapped, mapped_column
from src.core.db.base import Base, TimestampMixin

class JobPosting(Base, TimestampMixin):
    __tablename__ = "job_postings"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    factory_id: Mapped[int | None] = mapped_column(ForeignKey("factories.id", ondelete="SET NULL"), nullable=True)
    title: Mapped[str] = mapped_column(String(255), nullable=False)
    department_id: Mapped[int | None] = mapped_column(ForeignKey("departments.id", ondelete="SET NULL"), nullable=True)
    description: Mapped[str] = mapped_column(Text, nullable=False)
    requirements: Mapped[str] = mapped_column(Text, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="open")
    posted_date: Mapped[Date] = mapped_column(Date, nullable=True)
    closing_date: Mapped[Date] = mapped_column(Date, nullable=True)

class JobApplication(Base, TimestampMixin):
    __tablename__ = "job_applications"
    id: Mapped[int] = mapped_column(primary_key=True, autoincrement=True)
    job_posting_id: Mapped[int] = mapped_column(ForeignKey("job_postings.id", ondelete="CASCADE"))
    applicant_name: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    phone: Mapped[str] = mapped_column(String(50), nullable=True)
    resume_url: Mapped[str] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="received")
    rating: Mapped[int] = mapped_column(Integer, nullable=True)
