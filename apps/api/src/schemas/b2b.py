from pydantic import BaseModel
from decimal import Decimal

class BusinessAccountCreateRequest(BaseModel):
    company_name: str
    business_type: str | None = None
    tax_number: str | None = None
    commercial_registration: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address_text: str | None = None
    partner_category: str | None = None
    payment_terms: str | None = None
    credit_limit: Decimal | None = None
    is_active: bool = True

class BusinessAccountOut(BaseModel):
    id: int
    company_name: str
    business_type: str | None = None
    tax_number: str | None = None
    commercial_registration: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    address_text: str | None = None
    partner_category: str | None = None
    payment_terms: str | None = None
    credit_limit: Decimal | None = None
    is_active: bool
