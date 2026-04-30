from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from src.core.db.base import Base


class Category(Base):
    __tablename__ = "categories"

    id = Column(Integer, primary_key=True, index=True)
    name_ar = Column(String(255), nullable=False)
    name_en = Column(String(255), nullable=True)
    slug = Column(String(255), unique=True, index=True)
    description_ar = Column(Text, nullable=True)
    description_en = Column(Text, nullable=True)
    image_url = Column(Text, nullable=True)
    banner_image_url = Column(Text, nullable=True)
    sort_order = Column(Integer, nullable=False, default=0)
    is_active = Column(Boolean, nullable=False, default=True)

    products = relationship("Product", back_populates="category")


class Product(Base):
    __tablename__ = "products"

    id = Column(Integer, primary_key=True, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id"), nullable=True, index=True)
    category_id = Column(Integer, ForeignKey("categories.id"), nullable=False, index=True)

    name_ar = Column(String(255), nullable=False)
    name_en = Column(String(255), nullable=True)
    slug = Column(String(255), unique=True, index=True)
    sku = Column(String(100), unique=True)

    description_ar = Column(Text, nullable=True)
    description_en = Column(Text, nullable=True)
    material_specifications = Column(Text, nullable=True)
    technical_specifications = Column(Text, nullable=True)
    specifications = Column(Text, nullable=True)
    materials = Column(Text, nullable=True)
    dimensions = Column(Text, nullable=True)
    color_options = Column(Text, nullable=True)

    base_price = Column(Numeric(12, 2), nullable=True)

    is_featured = Column(Boolean, nullable=False, default=False)
    ar_enabled = Column(Boolean, nullable=False, default=False)
    is_active = Column(Boolean, nullable=False, default=True)
    is_published = Column(Boolean, nullable=False, default=True)

    primary_image_url = Column(Text, nullable=True)
    preview_image_url = Column(Text, nullable=True)
    glb_url = Column(Text, nullable=True)
    glb_model_url = Column(Text, nullable=True)
    usdz_url = Column(Text, nullable=True)
    usdz_model_url = Column(Text, nullable=True)

    product_family = Column(String(100), nullable=True)
    product_type = Column(String(100), nullable=True)
    production_mode = Column(String(100), nullable=True)

    thickness_cm = Column(Numeric(10, 2), nullable=True)
    width_cm = Column(Numeric(10, 2), nullable=True)
    length_cm = Column(Numeric(10, 2), nullable=True)

    foam_density = Column(Numeric(10, 2), nullable=True)
    foam_density_unit = Column(String(50), nullable=True)
    firmness_level = Column(String(100), nullable=True)

    has_springs = Column(Boolean, nullable=False, default=False)
    spring_type = Column(String(100), nullable=True)
    has_pillow_top = Column(Boolean, nullable=False, default=False)
    has_wood_frame = Column(Boolean, nullable=False, default=False)
    fabric_spec = Column(Text, nullable=True)
    requires_upholstery = Column(Boolean, nullable=False, default=False)
    requires_quilting = Column(Boolean, nullable=False, default=False)
    notes_internal = Column(Text, nullable=True)

    category = relationship("Category", back_populates="products")

