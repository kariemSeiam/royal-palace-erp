from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, String, JSON
from sqlalchemy.sql import func
from src.core.db.base import Base

class MobileSyncQueue(Base):
    __tablename__ = "mobile_sync_queue"
    id = Column(Integer, primary_key=True)
    user_id = Column(Integer)
    table_name = Column(String(100))
    record_id = Column(Integer)
    action = Column(String(20))
    payload = Column(JSON)
    synced = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
