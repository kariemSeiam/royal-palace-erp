from decimal import Decimal
from pydantic import BaseModel, Field


class CategoryOut(BaseModel):
    id: int
    name_ar: str
    name_en: str | None = None
    name: str | None = None
    slug: str
    description_ar: str | None = None
    description_en: str | None = None
    description: str | None = None
    image_url: str | None = None
    banner_image_url: str | None = None
    sort_order: int | None = 0
    is_active: bool = True


class ProductCardOut(BaseModel):
    id: int
    name_ar: str
    name_en: str | None = None
    name: str | None = None
    slug: str
    sku: str | None = None
    base_price: Decimal | None = None
    price: Decimal | None = None
    currency: str | None = "EGP"
    is_featured: bool = False
    ar_enabled: bool = False
    is_active: bool = True
    is_published: bool = True
    category_id: int | None = None
    primary_image_url: str | None = None
    preview_image_url: str | None = None
    image_url: str | None = None
    gallery_images: list[str] = Field(default_factory=list)


class ProductDetailOut(BaseModel):
    id: int
    name_ar: str
    name_en: str | None = None
    name: str | None = None
    slug: str
    sku: str | None = None
    description_ar: str | None = None
    description_en: str | None = None
    description: str | None = None
    short_description: str | None = None
    material_specifications: str | None = None
    technical_specifications: str | None = None
    specifications: str | None = None
    materials: str | None = None
    dimensions: str | None = None
    color_options: str | None = None
    base_price: Decimal | None = None
    price: Decimal | None = None
    currency: str | None = "EGP"
    is_featured: bool = False
    ar_enabled: bool = False
    is_active: bool = True
    is_published: bool = True
    category_id: int | None = None
    primary_image_url: str | None = None
    preview_image_url: str | None = None
    image_url: str | None = None
    gallery_images: list[str] = Field(default_factory=list)
    glb_url: str | None = None
    glb_model_url: str | None = None
    usdz_url: str | None = None
    usdz_model_url: str | None = None

