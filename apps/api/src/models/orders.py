from sqlalchemy import Boolean, Column, DateTime, ForeignKey, Integer, Numeric, String, Text
from sqlalchemy.sql import func

from src.core.db.base import Base


class CustomerOrder(Base):
    __tablename__ = "customer_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_number = Column(String(50), unique=True, nullable=False, index=True)

    user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    business_account_id = Column(Integer, ForeignKey("business_accounts.id", ondelete="SET NULL"), nullable=True)

    order_type = Column(String(20), nullable=False)
    status = Column(String(50), nullable=False)
    payment_status = Column(String(50), nullable=False)

    subtotal_amount = Column(Numeric(14, 2), nullable=False)
    vat_amount = Column(Numeric(14, 2), nullable=False)
    total_amount = Column(Numeric(14, 2), nullable=False)

    customer_name = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    shipping_address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="RESTRICT"), nullable=True, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=True, index=True)

    parent_order_id = Column(Integer, ForeignKey("customer_orders.id", ondelete="SET NULL"), nullable=True, index=True)
    is_master_order = Column(Boolean, nullable=False, default=False, server_default="false", index=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class CustomerOrderItem(Base):
    __tablename__ = "customer_order_items"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("customer_orders.id", ondelete="CASCADE"), nullable=False)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False)

    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(14, 2), nullable=False)
    line_total = Column(Numeric(14, 2), nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class SalesQuotation(Base):
    __tablename__ = "sales_quotations"

    id = Column(Integer, primary_key=True, index=True)
    quotation_number = Column(String(100), nullable=False, index=True)

    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False, index=True)
    business_account_id = Column(Integer, ForeignKey("business_accounts.id", ondelete="SET NULL"), nullable=True, index=True)
    converted_order_id = Column(Integer, ForeignKey("customer_orders.id", ondelete="SET NULL"), nullable=True, index=True)

    status = Column(String(50), nullable=False, default="draft", server_default="draft")
    customer_name = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    shipping_address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    subtotal_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    vat_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    total_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")

    valid_until = Column(DateTime(timezone=True), nullable=True)
    sent_at = Column(DateTime(timezone=True), nullable=True)
    approved_at = Column(DateTime(timezone=True), nullable=True)
    rejected_at = Column(DateTime(timezone=True), nullable=True)
    expired_at = Column(DateTime(timezone=True), nullable=True)
    converted_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class SalesQuotationItem(Base):
    __tablename__ = "sales_quotation_items"

    id = Column(Integer, primary_key=True, index=True)
    quotation_id = Column(Integer, ForeignKey("sales_quotations.id", ondelete="CASCADE"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)

    quantity = Column(Integer, nullable=False)
    unit_price = Column(Numeric(14, 2), nullable=False)
    line_total = Column(Numeric(14, 2), nullable=False)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class SalesInvoice(Base):
    __tablename__ = "sales_invoices"

    id = Column(Integer, primary_key=True, index=True)
    invoice_number = Column(String(100), nullable=False, index=True)

    order_id = Column(Integer, ForeignKey("customer_orders.id", ondelete="RESTRICT"), nullable=False, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False, index=True)

    status = Column(String(50), nullable=False, default="issued", server_default="issued")
    payment_status = Column(String(50), nullable=False, default="pending", server_default="pending")

    customer_name = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    billing_address = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    subtotal_amount = Column(Numeric(14, 2), nullable=False)
    vat_amount = Column(Numeric(14, 2), nullable=False)
    total_amount = Column(Numeric(14, 2), nullable=False)
    paid_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    remaining_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")

    issued_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    due_at = Column(DateTime(timezone=True), nullable=True)
    paid_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class SalesInvoiceReturn(Base):
    __tablename__ = "sales_invoice_returns"

    id = Column(Integer, primary_key=True, index=True)
    return_number = Column(String(100), nullable=False, index=True)

    invoice_id = Column(Integer, ForeignKey("sales_invoices.id", ondelete="RESTRICT"), nullable=False, index=True)
    order_id = Column(Integer, ForeignKey("customer_orders.id", ondelete="RESTRICT"), nullable=False, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False, index=True)

    return_type = Column(String(50), nullable=False, default="credit_note", server_default="credit_note")
    status = Column(String(50), nullable=False, default="issued", server_default="issued")
    reason = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    refunded_amount = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    refunded_at = Column(DateTime(timezone=True), nullable=True)
    cancelled_at = Column(DateTime(timezone=True), nullable=True)


class DeliveryNote(Base):
    __tablename__ = "delivery_notes"

    id = Column(Integer, primary_key=True, index=True)
    delivery_number = Column(String(100), nullable=False, index=True)

    order_id = Column(Integer, ForeignKey("customer_orders.id", ondelete="RESTRICT"), nullable=False, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)

    status = Column(String(50), nullable=False, default="dispatched", server_default="dispatched")
    customer_name = Column(String(255), nullable=True)
    customer_phone = Column(String(50), nullable=True)
    shipping_address = Column(Text, nullable=True)

    dispatched_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    delivered_at = Column(DateTime(timezone=True), nullable=True)

    dispatched_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    delivered_by_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)

    receiver_name = Column(String(255), nullable=True)
    receiver_phone = Column(String(50), nullable=True)
    proof_notes = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class WorkOrder(Base):
    __tablename__ = "work_orders"

    id = Column(Integer, primary_key=True, index=True)
    order_id = Column(Integer, ForeignKey("customer_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    factory_id = Column(Integer, ForeignKey("factories.id", ondelete="RESTRICT"), nullable=False, index=True)
    assigned_employee_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)

    status = Column(String(50), nullable=False, default="pending", server_default="pending")
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class WorkOrderMaterialAllocation(Base):
    __tablename__ = "work_order_material_allocations"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False, index=True)
    order_item_id = Column(Integer, ForeignKey("customer_order_items.id", ondelete="CASCADE"), nullable=False, index=True)
    warehouse_id = Column(Integer, ForeignKey("warehouses.id", ondelete="RESTRICT"), nullable=False, index=True)
    product_id = Column(Integer, ForeignKey("products.id", ondelete="RESTRICT"), nullable=False, index=True)

    allocated_quantity = Column(Numeric(14, 2), nullable=False, default=0, server_default="0")
    notes = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now(), onupdate=func.now())


class WorkOrderEvent(Base):
    __tablename__ = "work_order_events"

    id = Column(Integer, primary_key=True, index=True)
    work_order_id = Column(Integer, ForeignKey("work_orders.id", ondelete="CASCADE"), nullable=False, index=True)

    event_type = Column(String(100), nullable=False)
    from_status = Column(String(50), nullable=True)
    to_status = Column(String(50), nullable=True)

    actor_user_id = Column(Integer, ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    actor_name = Column(String(255), nullable=True)

    assigned_employee_id = Column(Integer, ForeignKey("employees.id", ondelete="SET NULL"), nullable=True, index=True)
    assigned_employee_name = Column(String(255), nullable=True)

    notes = Column(Text, nullable=True)
    meta_json = Column(Text, nullable=True)

    created_at = Column(DateTime(timezone=True), nullable=False, server_default=func.now())
