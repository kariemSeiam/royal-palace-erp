from sqlalchemy import Column, DateTime, ForeignKey, Integer, Numeric, String
from src.core.db.base import Base

class FactoryLayout(Base):
    __tablename__ = "mrp_factory_layout"
    id = Column(Integer, primary_key=True)
    factory_id = Column(Integer, ForeignKey("factories.id"))
    name = Column(String(255))
    pos_x = Column(Numeric(10,2))
    pos_y = Column(Numeric(10,2))
    width = Column(Numeric(10,2))
    height = Column(Numeric(10,2))
    element_type = Column(String(50))
    state = Column(String(50), default='idle')
    last_updated = Column(DateTime(timezone=True))
