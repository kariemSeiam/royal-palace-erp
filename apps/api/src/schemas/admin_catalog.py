from decimal import Decimal
from pydantic import BaseModel, Field


class CategoryCreateRequest(BaseModel):
    name_ar: str = Field(min_length=2, max_length=255)
    name_en: str | None = Field(default=None, min_length=2, max_length=255)
    slug: str = Field(min_length=2, max_length=255)
    description_ar: str | None = None
    description_en: str | None = None
    image_url: str | None = None
    banner_image_url: str | None = None
    is_active: bool = True
    sort_order: int = 0


class CategoryUpdateRequest(BaseModel):
    name_ar: str | None = None
    name_en: str | None = None
    slug: str | None = None
    description_ar: str | None = None
    description_en: str | None = None
    image_url: str | None = None
    banner_image_url: str | None = None
    is_active: bool | None = None
    sort_order: int | None = None


class ProductBomItemIn(BaseModel):
    line_no: int | None = None
    material_name: str = Field(min_length=1, max_length=255)
    material_code: str | None = None
    material_type: str | None = None
    quantity: Decimal
    unit: str | None = None
    waste_percent: Decimal | None = None
    notes: str | None = None
    is_active: bool = True


class ProductRoutingStepIn(BaseModel):
    step_no: int | None = None
    step_code: str | None = None
    step_name: str = Field(min_length=1, max_length=255)
    work_center: str | None = None
    standard_minutes: Decimal | None = None
    notes: str | None = None
    is_outsourced: bool = False
    is_active: bool = True


class ProductVariantIn(BaseModel):
    variant_name_ar: str = Field(min_length=1, max_length=255)
    variant_name_en: str = Field(min_length=1, max_length=255)
    variant_sku: str = Field(min_length=1, max_length=100)
    color: str | None = None
    size_label: str | None = None
    price_override: Decimal | None = None
    is_active: bool = True


class ProductGalleryItemIn(BaseModel):
    media_type: str = "image"
    file_url: str
    alt_text_ar: str | None = None
    alt_text_en: str | None = None
    sort_order: int | None = None
    is_primary: bool | None = None


class ProductCreateRequest(BaseModel):
    factory_id: int | None = None
    category_id: int
    name_ar: str = Field(min_length=2, max_length=255)
    name_en: str | None = Field(default=None, min_length=2, max_length=255)
    slug: str = Field(min_length=2, max_length=255)
    sku: str = Field(min_length=2, max_length=100)
    description_ar: str | None = None
    description_en: str | None = None
    material_specifications: str | None = None
    technical_specifications: str | None = None
    specifications: str | None = None
    materials: str | None = None
    dimensions: str | None = None
    color_options: str | None = None
    base_price: Decimal | None = None
    is_active: bool = True
    is_published: bool = True
    is_featured: bool = False
    ar_enabled: bool = False
    primary_image_url: str | None = None
    preview_image_url: str | None = None
    glb_url: str | None = None
    glb_model_url: str | None = None
    usdz_url: str | None = None
    usdz_model_url: str | None = None
    product_family: str | None = None
    product_type: str | None = None
    production_mode: str | None = None
    thickness_cm: Decimal | None = None
    width_cm: Decimal | None = None
    length_cm: Decimal | None = None
    foam_density: Decimal | None = None
    foam_density_unit: str | None = None
    firmness_level: str | None = None
    has_springs: bool = False
    spring_type: str | None = None
    has_pillow_top: bool = False
    has_wood_frame: bool = False
    fabric_spec: str | None = None
    requires_upholstery: bool = False
    requires_quilting: bool = False
    notes_internal: str | None = None
    bom_items: list[ProductBomItemIn] = Field(default_factory=list)
    routing_steps: list[ProductRoutingStepIn] = Field(default_factory=list)
    variants: list[ProductVariantIn] = Field(default_factory=list)
    gallery_items: list[str | ProductGalleryItemIn] = Field(default_factory=list)


class ProductUpdateRequest(BaseModel):
    factory_id: int | None = None
    category_id: int | None = None
    name_ar: str | None = None
    name_en: str | None = None
    slug: str | None = None
    sku: str | None = None
    description_ar: str | None = None
    description_en: str | None = None
    material_specifications: str | None = None
    technical_specifications: str | None = None
    specifications: str | None = None
    materials: str | None = None
    dimensions: str | None = None
    color_options: str | None = None
    base_price: Decimal | None = None
    is_active: bool | None = None
    is_published: bool | None = None
    is_featured: bool | None = None
    ar_enabled: bool | None = None
    primary_image_url: str | None = None
    preview_image_url: str | None = None
    glb_url: str | None = None
    glb_model_url: str | None = None
    usdz_url: str | None = None
    usdz_model_url: str | None = None
    product_family: str | None = None
    product_type: str | None = None
    production_mode: str | None = None
    thickness_cm: Decimal | None = None
    width_cm: Decimal | None = None
    length_cm: Decimal | None = None
    foam_density: Decimal | None = None
    foam_density_unit: str | None = None
    firmness_level: str | None = None
    has_springs: bool | None = None
    spring_type: str | None = None
    has_pillow_top: bool | None = None
    has_wood_frame: bool | None = None
    fabric_spec: str | None = None
    requires_upholstery: bool | None = None
    requires_quilting: bool | None = None
    notes_internal: str | None = None
    bom_items: list[ProductBomItemIn] | None = None
    routing_steps: list[ProductRoutingStepIn] | None = None
    variants: list[ProductVariantIn] | None = None
    gallery_items: list[str | ProductGalleryItemIn] | None = None

