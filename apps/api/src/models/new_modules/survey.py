from sqlalchemy import Column, Integer, String, Text, Boolean, DateTime, ForeignKey, Numeric, JSON, Date
from sqlalchemy.sql import func
from src.core.db.session import Base

class Surveys(Base):
    __tablename__ = "surveys"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(255), nullable=False)
    description = Column(Text)
    status = Column(String(50), default='draft')
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class SurveyQuestions(Base):
    __tablename__ = "survey_questions"
    id = Column(Integer, primary_key=True, index=True)
    survey_id = Column(Integer, ForeignKey('surveys.id'))
    question_text = Column(Text, nullable=False)
    question_type = Column(String(50), default='text')
    options = Column(JSONB)
    sort_order = Column(Integer, default=0)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class SurveyResponses(Base):
    __tablename__ = "survey_responses"
    id = Column(Integer, primary_key=True, index=True)
    question_id = Column(Integer, ForeignKey('survey_questions.id'))
    user_id = Column(Integer, ForeignKey('users.id'))
    answer_text = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
