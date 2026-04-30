from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func

from src.core.db.base import Base


class AccountingChartAccount(Base):
    __tablename__ = "accounting_chart_accounts"

    id = Column(Integer, primary_key=True, index=True)
    account_code = Column(String(50), nullable=False, unique=True, index=True)
    account_name = Column(String(255), nullable=False)
    account_type = Column(String(50), nullable=False, index=True)
    parent_account_id = Column(Integer, ForeignKey("accounting_chart_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    allow_manual_entries = Column(Boolean, nullable=False, default=True, server_default="true")
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class AccountingJournalEntry(Base):
    __tablename__ = "accounting_journal_entries"

    id = Column(Integer, primary_key=True, index=True)
    entry_number = Column(String(100), nullable=False, unique=True, index=True)
    entry_date = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    source_module = Column(String(100), nullable=True, index=True)
    source_type = Column(String(100), nullable=True, index=True)
    source_id = Column(Integer, nullable=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"), nullable=True, index=True)
    currency = Column(String(10), nullable=False, default="EGP", server_default="EGP")
    description = Column(Text, nullable=True)
    status = Column(String(50), nullable=False, default="posted", server_default="posted")
    created_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class AccountingJournalEntryLine(Base):
    __tablename__ = "accounting_journal_entry_lines"

    id = Column(Integer, primary_key=True, index=True)
    entry_id = Column(Integer, ForeignKey("accounting_journal_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    account_id = Column(Integer, ForeignKey("accounting_chart_accounts.id", ondelete="RESTRICT"), nullable=False, index=True)
    line_description = Column(Text, nullable=True)
    debit_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    credit_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"), nullable=True, index=True)
    source_module = Column(String(100), nullable=True, index=True)
    source_type = Column(String(100), nullable=True, index=True)
    source_id = Column(Integer, nullable=True, index=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())
