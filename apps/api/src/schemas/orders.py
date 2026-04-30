from pydantic import BaseModel
from decimal import Decimal
from datetime import datetime


class OrderItemCreateRequest(BaseModel):
    product_id: int
    quantity: int


class OrderCreateRequest(BaseModel):
    order_type: str
    business_account_id: int | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None
    notes: str | None = None
    items: list[OrderItemCreateRequest]


class OrderOut(BaseModel):
    id: int
    order_number: str
    order_type: str
    status: str
    payment_status: str
    subtotal_amount: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    customer_name: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None


class SalesQuotationItemPayload(BaseModel):
    product_id: int
    quantity: int
    unit_price: Decimal | None = None


class SalesQuotationCreateRequest(BaseModel):
    factory_id: int
    business_account_id: int | None = None
    customer_name: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None
    notes: str | None = None
    valid_until: datetime | None = None
    items: list[SalesQuotationItemPayload]


class SalesQuotationUpdateRequest(BaseModel):
    customer_name: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None
    notes: str | None = None
    valid_until: datetime | None = None
    items: list[SalesQuotationItemPayload] | None = None


class SalesQuotationStatusRequest(BaseModel):
    notes: str | None = None


class SalesQuotationConvertRequest(BaseModel):
    notes: str | None = None


class SalesQuotationItemOut(BaseModel):
    id: int
    quotation_id: int
    product_id: int
    product_name: str | None = None
    sku: str | None = None
    quantity: int
    unit_price: Decimal
    line_total: Decimal


class SalesQuotationOut(BaseModel):
    id: int
    quotation_number: str
    factory_id: int
    factory_name: str | None = None
    business_account_id: int | None = None
    converted_order_id: int | None = None
    converted_order_number: str | None = None
    status: str
    customer_name: str | None = None
    customer_phone: str | None = None
    shipping_address: str | None = None
    notes: str | None = None
    subtotal_amount: Decimal
    vat_amount: Decimal
    total_amount: Decimal
    item_count: int = 0
    valid_until: datetime | None = None
    sent_at: datetime | None = None
    approved_at: datetime | None = None
    rejected_at: datetime | None = None
    expired_at: datetime | None = None
    converted_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    items: list[SalesQuotationItemOut] = []
