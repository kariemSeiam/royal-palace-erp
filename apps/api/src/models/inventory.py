from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func
from src.core.db.base import Base

class Warehouse(Base):
    __tablename__ = "warehouses"
    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False, index=True)
    code = Column(String(100), nullable=False)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True, server_default="true")
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

class InventoryMovement(Base):
    __tablename__ = "inventory_movements"
    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)
    movement_type = Column(String(30), nullable=False)
    quantity = Column(Numeric(14, 2), nullable=False)
    reference_type = Column(String(100), nullable=True, index=True)
    reference_id = Column(Integer, nullable=True, index=True)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())

class StockLocation(Base):
    __tablename__ = "stock_locations"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    location_type = Column(String(50), default="internal")
    parent_location_id = Column(Integer, ForeignKey("stock_locations.id", ondelete="SET NULL"))
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class StockPickingType(Base):
    __tablename__ = "stock_picking_types"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    sequence_code = Column(String(10), default="WH")
    is_active = Column(Boolean, default=True)
    quality_template_id = Column(Integer, ForeignKey("quality_templates.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class StockPicking(Base):
    __tablename__ = "stock_pickings"
    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    location_id = Column(Integer, ForeignKey("stock_locations.id", ondelete="SET NULL"))
    location_dest_id = Column(Integer, ForeignKey("stock_locations.id", ondelete="SET NULL"))
    picking_type_id = Column(Integer, ForeignKey("stock_picking_types.id", ondelete="SET NULL"))
    partner_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"))
    scheduled_date = Column(DateTime(timezone=True))
    state = Column(String(50), default="draft")
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class StockMove(Base):
    __tablename__ = "stock_moves"
    id = Column(Integer, primary_key=True, index=True)
    picking_id = Column(Integer, ForeignKey("stock_pickings.id", ondelete="SET NULL"))
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"))
    location_id = Column(Integer, ForeignKey("stock_locations.id", ondelete="SET NULL"))
    location_dest_id = Column(Integer, ForeignKey("stock_locations.id", ondelete="SET NULL"))
    state = Column(String(50), default="draft")
    quantity = Column(Numeric(14,2), default=0)
    uom = Column(String(20), default="Units")
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class StockQuant(Base):
    __tablename__ = "stock_quants"
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"))
    location_id = Column(Integer, ForeignKey("stock_locations.id", ondelete="SET NULL"))
    lot_id = Column(Integer, ForeignKey("stock_moves.id", ondelete="SET NULL"))
    quantity = Column(Numeric(14,2), default=0)
    reserved_quantity = Column(Numeric(14,2), default=0)
    uom = Column(String(20), default="Units")
    cost = Column(Numeric(14,2), default=0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class StockInventoryAdjustment(Base):
    __tablename__ = "stock_inventory_adjustments"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    location_id = Column(Integer, ForeignKey("stock_locations.id", ondelete="SET NULL"))
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="SET NULL"))
    state = Column(String(50), default="draft")
    scheduled_date = Column(DateTime(timezone=True))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class StockInventoryLine(Base):
    __tablename__ = "stock_inventory_lines"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    adjustment_id = Column(Integer, ForeignKey("stock_inventory_adjustments.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"))
    location_id = Column(Integer, ForeignKey("stock_locations.id", ondelete="SET NULL"))
    expected_quantity = Column(Numeric(14,2), default=0)
    counted_quantity = Column(Numeric(14,2), default=0)
    difference_quantity = Column(Numeric(14,2))
    notes = Column(Text)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class StockValuationLayer(Base):
    __tablename__ = "stock_valuation_layers"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="SET NULL"))
    location_id = Column(Integer, ForeignKey("stock_locations.id", ondelete="SET NULL"))
    move_id = Column(Integer, ForeignKey("stock_moves.id", ondelete="SET NULL"))
    quantity = Column(Numeric(14,2), default=0)
    unit_cost = Column(Numeric(14,2), default=0)
    remaining_quantity = Column(Numeric(14,2), default=0)
    method = Column(String(10), default="FIFO")
    date = Column(DateTime(timezone=True), server_default=func.now())
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class StockRoute(Base):
    __tablename__ = "stock_routes"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(255), nullable=False)
    code = Column(String(50), unique=True, nullable=False)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="CASCADE"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

class StockRouteRule(Base):
    __tablename__ = "stock_route_rules"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    route_id = Column(Integer, ForeignKey("stock_routes.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    sequence = Column(Integer, default=0)
    action = Column(String(50), nullable=False)  # push, pull
    location_src_id = Column(Integer, ForeignKey("stock_locations.id", ondelete="SET NULL"))
    location_dest_id = Column(Integer, ForeignKey("stock_locations.id", ondelete="SET NULL"))
    picking_type_id = Column(Integer, ForeignKey("stock_picking_types.id", ondelete="SET NULL"))
    auto = Column(Boolean, default=False)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class StockPutawayRule(Base):
    __tablename__ = "stock_putaway_rules"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"))
    category_id = Column(Integer, ForeignKey("categories.id", ondelete="CASCADE"), nullable=True)
    location_src_id = Column(Integer, ForeignKey("stock_locations.id", ondelete="SET NULL"))
    location_out_id = Column(Integer, ForeignKey("stock_locations.id", ondelete="SET NULL"))
    route_id = Column(Integer, ForeignKey("stock_routes.id", ondelete="CASCADE"), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ProductUoM(Base):
    __tablename__ = "product_uom"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    code = Column(String(20), unique=True, nullable=False)
    factor = Column(Numeric(14,6), default=1.0)
    rounding = Column(Numeric(14,6), default=0.01)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

class ProductPackaging(Base):
    __tablename__ = "product_packaging"
    __table_args__ = {'extend_existing': True}
    id = Column(Integer, primary_key=True, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="CASCADE"), nullable=False)
    name = Column(String(255), nullable=False)
    uom_id = Column(Integer, ForeignKey("product_uom.id"), nullable=False)
    qty = Column(Numeric(14,2), default=1.0)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), server_default=func.now())
