from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric, JSON, Date
from sqlalchemy.sql import func
from src.core.db.session import Base

class ForumCategories(Base):
    __tablename__ = "forum_categories"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class ForumTopics(Base):
    __tablename__ = "forum_topics"
    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey('forum_categories.id'))
    user_id = Column(Integer, ForeignKey('users.id'))
    title = Column(String(255), nullable=False)
    content = Column(Text)
    is_pinned = Column(Boolean, default=False)
    is_closed = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
