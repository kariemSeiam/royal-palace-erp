from sqlalchemy import Column, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class VoiceCommand(Base):
    __tablename__ = "mrp_voice_commands"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    command_text = Column(Text, nullable=False)
    action_type = Column(String(50))
    result_text = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
