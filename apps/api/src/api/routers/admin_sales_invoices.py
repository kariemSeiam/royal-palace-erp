from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    enforce_factory_scope,
    get_user_factory_scope_id,
    is_factory_scoped_user,
    require_orders_manage,
    require_orders_view,
)
from src.core.db.session import get_db
from src.api.routers.admin_audit import log_audit_event
from src.models.user import User

router = APIRouter(prefix="/admin/sales-invoices", tags=["admin-sales-invoices"])


def _safe_float(value):
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _normalize_optional_text(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None

def serialize_invoice(row):
    data = dict(row)
    return {
        "id": data.get("id"),
        "invoice_number": data.get("invoice_number"),
        "order_id": data.get("order_id"),
        "order_number": data.get("order_number"),
        "factory_id": data.get("factory_id"),
        "factory_name": data.get("factory_name"),
        "status": data.get("status"),
        "payment_status": data.get("payment_status"),
        "customer_name": data.get("customer_name"),
        "customer_phone": data.get("customer_phone"),
        "billing_address": data.get("billing_address"),
        "notes": data.get("notes"),
        "subtotal_amount": str(data.get("subtotal_amount")) if data.get("subtotal_amount") is not None else None,
        "vat_amount": str(data.get("vat_amount")) if data.get("vat_amount") is not None else None,
        "total_amount": str(data.get("total_amount")) if data.get("total_amount") is not None else None,
        "paid_amount": str(data.get("paid_amount")) if data.get("paid_amount") is not None else None,
        "remaining_amount": str(data.get("remaining_amount")) if data.get("remaining_amount") is not None else None,
        "credit_notes_total": str(data.get("credit_notes_total")) if data.get("credit_notes_total") is not None else "0",
        "refunds_total": str(data.get("refunds_total")) if data.get("refunds_total") is not None else "0",
        "net_invoice_amount": str(data.get("net_invoice_amount")) if data.get("net_invoice_amount") is not None else None,
        "issued_at": data.get("issued_at").isoformat() if data.get("issued_at") else None,
        "due_at": data.get("due_at").isoformat() if data.get("due_at") else None,
        "paid_at": data.get("paid_at").isoformat() if data.get("paid_at") else None,
        "cancelled_at": data.get("cancelled_at").isoformat() if data.get("cancelled_at") else None,
        "created_at": data.get("created_at").isoformat() if data.get("created_at") else None,
        "updated_at": data.get("updated_at").isoformat() if data.get("updated_at") else None,
    }


def serialize_return(row):
    data = dict(row)
    return {
        "id": data.get("id"),
        "return_number": data.get("return_number"),
        "invoice_id": data.get("invoice_id"),
        "invoice_number": data.get("invoice_number"),
        "order_id": data.get("order_id"),
        "order_number": data.get("order_number"),
        "factory_id": data.get("factory_id"),
        "factory_name": data.get("factory_name"),
        "return_type": data.get("return_type"),
        "status": data.get("status"),
        "reason": data.get("reason"),
        "notes": data.get("notes"),
        "amount": str(data.get("amount")) if data.get("amount") is not None else None,
        "refunded_amount": str(data.get("refunded_amount")) if data.get("refunded_amount") is not None else None,
        "created_at": data.get("created_at").isoformat() if data.get("created_at") else None,
        "refunded_at": data.get("refunded_at").isoformat() if data.get("refunded_at") else None,
        "cancelled_at": data.get("cancelled_at").isoformat() if data.get("cancelled_at") else None,
    }


async def ensure_sales_invoices_table(db: AsyncSession):
    await db.execute(text("""CREATE TABLE IF NOT EXISTS sales_invoices (
        id SERIAL PRIMARY KEY,
        invoice_number VARCHAR(100) NOT NULL,
        order_id INTEGER NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT,
        factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
        status VARCHAR(50) NOT NULL DEFAULT 'issued',
        payment_status VARCHAR(50) NOT NULL DEFAULT 'pending',
        customer_name VARCHAR(255),
        customer_phone VARCHAR(50),
        billing_address TEXT,
        notes TEXT,
        subtotal_amount NUMERIC(14, 2) NOT NULL,
        vat_amount NUMERIC(14, 2) NOT NULL,
        total_amount NUMERIC(14, 2) NOT NULL,
        paid_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        remaining_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        due_at TIMESTAMPTZ NULL,
        paid_at TIMESTAMPTZ NULL,
        cancelled_at TIMESTAMPTZ NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )"""))
    await db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoices_factory_invoice_number ON sales_invoices(factory_id, invoice_number)"))
    await db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoices_order_id ON sales_invoices(order_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_sales_invoices_status ON sales_invoices(status)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_sales_invoices_payment_status ON sales_invoices(payment_status)"))
    await db.commit()


async def ensure_sales_invoice_returns_table(db: AsyncSession):
    await db.execute(text("""CREATE TABLE IF NOT EXISTS sales_invoice_returns (
        id SERIAL PRIMARY KEY,
        return_number VARCHAR(100) NOT NULL,
        invoice_id INTEGER NOT NULL REFERENCES sales_invoices(id) ON DELETE RESTRICT,
        order_id INTEGER NOT NULL REFERENCES customer_orders(id) ON DELETE RESTRICT,
        factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
        return_type VARCHAR(50) NOT NULL DEFAULT 'credit_note',
        status VARCHAR(50) NOT NULL DEFAULT 'issued',
        reason TEXT,
        notes TEXT,
        amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        refunded_amount NUMERIC(14, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        refunded_at TIMESTAMPTZ NULL,
        cancelled_at TIMESTAMPTZ NULL
    )"""))
    await db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_sales_invoice_returns_factory_return_number ON sales_invoice_returns(factory_id, return_number)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_sales_invoice_returns_invoice_id ON sales_invoice_returns(invoice_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_sales_invoice_returns_status ON sales_invoice_returns(status)"))
    await db.commit()


async def ensure_sales_documents_tables(db: AsyncSession):
    await ensure_sales_invoices_table(db)
    await ensure_sales_invoice_returns_table(db)


async def fetch_order_or_404(db: AsyncSession, order_id: int):
    result = await db.execute(text("""
        SELECT co.*, f.name AS factory_name, dn.delivery_number, dn.status AS delivery_status, dn.dispatched_at, dn.delivered_at
        FROM customer_orders co
        LEFT JOIN factories f ON f.id = co.factory_id
        LEFT JOIN delivery_notes dn ON dn.order_id = co.id
        WHERE co.id = :order_id
        LIMIT 1
    """), {"order_id": order_id})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Order not found")
    return row


async def fetch_invoice_or_404(db: AsyncSession, invoice_id: int):
    result = await db.execute(text("""
        SELECT
            si.*,
            co.order_number,
            co.status AS order_status,
            dn.delivery_number,
            dn.status AS delivery_status,
            f.name AS factory_name,
            COALESCE((SELECT SUM(CASE WHEN sir.return_type = 'credit_note' AND sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.invoice_id = si.id), 0) AS credit_notes_total,
            COALESCE((SELECT SUM(CASE WHEN sir.return_type = 'refund' AND sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.invoice_id = si.id), 0) AS refunds_total,
            (si.total_amount - COALESCE((SELECT SUM(CASE WHEN sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.invoice_id = si.id), 0)) AS net_invoice_amount
        FROM sales_invoices si
        JOIN customer_orders co ON co.id = si.order_id
        LEFT JOIN delivery_notes dn ON dn.order_id = co.id
        LEFT JOIN factories f ON f.id = si.factory_id
        WHERE si.id = :invoice_id
        LIMIT 1
    """), {"invoice_id": invoice_id})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Sales invoice not found")
    return row


async def fetch_invoice_by_order_id(db: AsyncSession, order_id: int):
    result = await db.execute(text("""
        SELECT
            si.*,
            co.order_number,
            co.status AS order_status,
            dn.delivery_number,
            dn.status AS delivery_status,
            f.name AS factory_name,
            COALESCE((SELECT SUM(CASE WHEN sir.return_type = 'credit_note' AND sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.invoice_id = si.id), 0) AS credit_notes_total,
            COALESCE((SELECT SUM(CASE WHEN sir.return_type = 'refund' AND sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.invoice_id = si.id), 0) AS refunds_total,
            (si.total_amount - COALESCE((SELECT SUM(CASE WHEN sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.invoice_id = si.id), 0)) AS net_invoice_amount
        FROM sales_invoices si
        JOIN customer_orders co ON co.id = si.order_id
        LEFT JOIN delivery_notes dn ON dn.order_id = co.id
        LEFT JOIN factories f ON f.id = si.factory_id
        WHERE si.order_id = :order_id
        LIMIT 1
    """), {"order_id": order_id})
    return result.mappings().first()


async def fetch_return_or_404(db: AsyncSession, return_id: int):
    result = await db.execute(text("""
        SELECT
            sir.*,
            si.invoice_number,
            co.order_number,
            co.status AS order_status,
            dn.delivery_number,
            dn.status AS delivery_status,
            f.name AS factory_name
        FROM sales_invoice_returns sir
        JOIN sales_invoices si ON si.id = sir.invoice_id
        JOIN customer_orders co ON co.id = sir.order_id
        LEFT JOIN delivery_notes dn ON dn.order_id = co.id
        LEFT JOIN factories f ON f.id = sir.factory_id
        WHERE sir.id = :return_id
        LIMIT 1
    """), {"return_id": return_id})
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Sales return / credit note not found")
    return row

async def generate_invoice_number(db: AsyncSession, factory_id: int) -> str:
    prefix = f"SI-{factory_id}"
    result = await db.execute(text("SELECT invoice_number FROM sales_invoices WHERE factory_id = :factory_id ORDER BY id DESC LIMIT 1"), {"factory_id": factory_id})
    row = result.mappings().first()
    next_seq = 1
    if row and row.get("invoice_number"):
        raw = str(row["invoice_number"]).strip()
        if raw.startswith(prefix + "-"):
            try:
                next_seq = int(raw.split("-")[-1]) + 1
            except Exception:
                next_seq = 1
    return f"{prefix}-{str(next_seq).zfill(6)}"


async def generate_return_number(db: AsyncSession, factory_id: int) -> str:
    prefix = f"SR-{factory_id}"
    result = await db.execute(text("SELECT return_number FROM sales_invoice_returns WHERE factory_id = :factory_id ORDER BY id DESC LIMIT 1"), {"factory_id": factory_id})
    row = result.mappings().first()
    next_seq = 1
    if row and row.get("return_number"):
        raw = str(row["return_number"]).strip()
        if raw.startswith(prefix + "-"):
            try:
                next_seq = int(raw.split("-")[-1]) + 1
            except Exception:
                next_seq = 1
    return f"{prefix}-{str(next_seq).zfill(6)}"


async def get_invoice_return_totals(db: AsyncSession, invoice_id: int):
    result = await db.execute(text("""
        SELECT
            COALESCE(SUM(CASE WHEN return_type = 'credit_note' AND status != 'cancelled' THEN amount ELSE 0 END), 0) AS credit_notes_total,
            COALESCE(SUM(CASE WHEN return_type = 'refund' AND status != 'cancelled' THEN amount ELSE 0 END), 0) AS refunds_total,
            COALESCE(SUM(CASE WHEN status != 'cancelled' THEN amount ELSE 0 END), 0) AS returns_total
        FROM sales_invoice_returns
        WHERE invoice_id = :invoice_id
    """), {"invoice_id": invoice_id})
    row = result.mappings().first() or {}
    return {"credit_notes_total": _safe_float(row.get("credit_notes_total")), "refunds_total": _safe_float(row.get("refunds_total")), "returns_total": _safe_float(row.get("returns_total"))}


async def recalc_invoice_state(db: AsyncSession, invoice_id: int):
    invoice = await fetch_invoice_or_404(db, invoice_id)
    totals = await get_invoice_return_totals(db, invoice_id)
    total_amount = _safe_float(invoice.get("total_amount"))
    paid_amount = _safe_float(invoice.get("paid_amount"))
    returns_total = totals["returns_total"]
    net_invoice_amount = max(total_amount - returns_total, 0)
    remaining_amount = max(net_invoice_amount - paid_amount, 0)

    if net_invoice_amount == 0 and returns_total > 0:
        new_status = "refunded"
        new_payment_status = "refunded"
    elif returns_total > 0:
        new_status = "partially_refunded"
        new_payment_status = "partially_refunded" if remaining_amount > 0 else "paid"
    elif paid_amount >= total_amount and total_amount > 0:
        new_status = "paid"
        new_payment_status = "paid"
    else:
        new_status = "issued"
        new_payment_status = "pending"

    await db.execute(text("UPDATE sales_invoices SET status = :status, payment_status = :payment_status, remaining_amount = :remaining_amount, updated_at = NOW() WHERE id = :invoice_id"), {"invoice_id": invoice_id, "status": new_status, "payment_status": new_payment_status, "remaining_amount": remaining_amount})
    await db.execute(text("UPDATE customer_orders SET payment_status = :payment_status, updated_at = NOW() WHERE id = :order_id"), {"order_id": invoice["order_id"], "payment_status": "paid" if new_payment_status == "paid" else new_payment_status})


@router.get("")
async def list_sales_invoices(current_user: User = Depends(require_orders_view), db: AsyncSession = Depends(get_db)):
    await ensure_sales_documents_tables(db)
    params = {}
    where_sql = ""
    if is_factory_scoped_user(current_user):
        params["factory_id"] = get_user_factory_scope_id(current_user)
        where_sql = " WHERE si.factory_id = :factory_id "
    result = await db.execute(text(f"""
        SELECT
            si.*,
            co.order_number,
            co.status AS order_status,
            dn.delivery_number,
            dn.status AS delivery_status,
            f.name AS factory_name,
            COALESCE((SELECT SUM(CASE WHEN sir.return_type = 'credit_note' AND sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.invoice_id = si.id), 0) AS credit_notes_total,
            COALESCE((SELECT SUM(CASE WHEN sir.return_type = 'refund' AND sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.invoice_id = si.id), 0) AS refunds_total,
            (si.total_amount - COALESCE((SELECT SUM(CASE WHEN sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.invoice_id = si.id), 0)) AS net_invoice_amount
        FROM sales_invoices si
        JOIN customer_orders co ON co.id = si.order_id
        LEFT JOIN delivery_notes dn ON dn.order_id = co.id
        LEFT JOIN factories f ON f.id = si.factory_id
        {where_sql}
        ORDER BY si.id DESC
    """), params)
    return [serialize_invoice(row) for row in result.mappings().all()]


@router.get("/summary")
async def get_sales_invoices_summary(current_user: User = Depends(require_orders_view), db: AsyncSession = Depends(get_db)):
    await ensure_sales_documents_tables(db)
    params = {}
    where_sql = ""
    paid_filter = " WHERE payment_status = 'paid' "
    pending_filter = " WHERE payment_status NOT IN ('paid', 'refunded') "
    cancelled_filter = " WHERE status = 'cancelled' "
    if is_factory_scoped_user(current_user):
        params["factory_id"] = get_user_factory_scope_id(current_user)
        where_sql = " WHERE factory_id = :factory_id "
        paid_filter = " WHERE factory_id = :factory_id AND payment_status = 'paid' "
        pending_filter = " WHERE factory_id = :factory_id AND payment_status NOT IN ('paid', 'refunded') "
        cancelled_filter = " WHERE factory_id = :factory_id AND status = 'cancelled' "

    total_count = int((await db.execute(text(f"SELECT COUNT(*) FROM sales_invoices {where_sql}"), params)).scalar() or 0)
    total_amount = float((await db.execute(text(f"SELECT COALESCE(SUM(total_amount), 0) FROM sales_invoices {where_sql}"), params)).scalar() or 0)
    paid_amount = float((await db.execute(text(f"SELECT COALESCE(SUM(paid_amount), 0) FROM sales_invoices {where_sql}"), params)).scalar() or 0)
    remaining_amount = float((await db.execute(text(f"SELECT COALESCE(SUM(remaining_amount), 0) FROM sales_invoices {where_sql}"), params)).scalar() or 0)
    paid_count = int((await db.execute(text(f"SELECT COUNT(*) FROM sales_invoices {paid_filter}"), params)).scalar() or 0)
    pending_count = int((await db.execute(text(f"SELECT COUNT(*) FROM sales_invoices {pending_filter}"), params)).scalar() or 0)
    cancelled_count = int((await db.execute(text(f"SELECT COUNT(*) FROM sales_invoices {cancelled_filter}"), params)).scalar() or 0)

    if where_sql:
        credit_sql = "SELECT COALESCE(SUM(amount), 0) FROM sales_invoice_returns WHERE factory_id = :factory_id AND return_type = 'credit_note' AND status != 'cancelled'"
        refund_sql = "SELECT COALESCE(SUM(amount), 0) FROM sales_invoice_returns WHERE factory_id = :factory_id AND return_type = 'refund' AND status != 'cancelled'"
    else:
        credit_sql = "SELECT COALESCE(SUM(amount), 0) FROM sales_invoice_returns WHERE return_type = 'credit_note' AND status != 'cancelled'"
        refund_sql = "SELECT COALESCE(SUM(amount), 0) FROM sales_invoice_returns WHERE return_type = 'refund' AND status != 'cancelled'"

    credit_notes_total = float((await db.execute(text(credit_sql), params)).scalar() or 0)
    refunds_total = float((await db.execute(text(refund_sql), params)).scalar() or 0)
    net_sales_total = total_amount - credit_notes_total - refunds_total
    return {"total_count": total_count, "paid_count": paid_count, "pending_count": pending_count, "cancelled_count": cancelled_count, "total_amount": total_amount, "paid_amount": paid_amount, "remaining_amount": remaining_amount, "credit_notes_total": credit_notes_total, "refunds_total": refunds_total, "net_sales_total": net_sales_total}

@router.get("/returns")
async def list_sales_returns(current_user: User = Depends(require_orders_view), db: AsyncSession = Depends(get_db)):
    await ensure_sales_documents_tables(db)
    params = {}
    where_sql = ""
    if is_factory_scoped_user(current_user):
        params["factory_id"] = get_user_factory_scope_id(current_user)
        where_sql = " WHERE sir.factory_id = :factory_id "
    result = await db.execute(text(f"""
        SELECT
            sir.*,
            si.invoice_number,
            co.order_number,
            co.status AS order_status,
            dn.delivery_number,
            dn.status AS delivery_status,
            f.name AS factory_name
        FROM sales_invoice_returns sir
        JOIN sales_invoices si ON si.id = sir.invoice_id
        JOIN customer_orders co ON co.id = sir.order_id
        LEFT JOIN delivery_notes dn ON dn.order_id = co.id
        LEFT JOIN factories f ON f.id = sir.factory_id
        {where_sql}
        ORDER BY sir.id DESC
    """), params)
    return [serialize_return(row) for row in result.mappings().all()]


@router.get("/returns/summary")
async def get_sales_returns_summary(current_user: User = Depends(require_orders_view), db: AsyncSession = Depends(get_db)):
    await ensure_sales_documents_tables(db)
    params = {}
    where_sql = ""
    if is_factory_scoped_user(current_user):
        params["factory_id"] = get_user_factory_scope_id(current_user)
        where_sql = " WHERE factory_id = :factory_id "
    total_count = int((await db.execute(text(f"SELECT COUNT(*) FROM sales_invoice_returns {where_sql}"), params)).scalar() or 0)
    if where_sql:
        credit_sql = "SELECT COALESCE(SUM(amount), 0) FROM sales_invoice_returns WHERE factory_id = :factory_id AND return_type = 'credit_note' AND status != 'cancelled'"
        refund_sql = "SELECT COALESCE(SUM(amount), 0) FROM sales_invoice_returns WHERE factory_id = :factory_id AND return_type = 'refund' AND status != 'cancelled'"
    else:
        credit_sql = "SELECT COALESCE(SUM(amount), 0) FROM sales_invoice_returns WHERE return_type = 'credit_note' AND status != 'cancelled'"
        refund_sql = "SELECT COALESCE(SUM(amount), 0) FROM sales_invoice_returns WHERE return_type = 'refund' AND status != 'cancelled'"
    credit_notes_total = float((await db.execute(text(credit_sql), params)).scalar() or 0)
    refunds_total = float((await db.execute(text(refund_sql), params)).scalar() or 0)
    return {"total_count": total_count, "credit_notes_total": credit_notes_total, "refunds_total": refunds_total, "returns_total": credit_notes_total + refunds_total}


@router.get("/customer-statement")
async def get_customer_statement(customer_name: str, current_user: User = Depends(require_orders_view), db: AsyncSession = Depends(get_db)):
    await ensure_sales_documents_tables(db)
    customer_name = _normalize_optional_text(customer_name)
    if not customer_name:
        raise HTTPException(status_code=400, detail="customer_name is required")

    params = {"customer_name": customer_name}
    where_sql = " WHERE si.customer_name = :customer_name "
    if is_factory_scoped_user(current_user):
        params["factory_id"] = get_user_factory_scope_id(current_user)
        where_sql = " WHERE si.customer_name = :customer_name AND si.factory_id = :factory_id "
    result = await db.execute(text(f"""
        SELECT
            si.*,
            co.order_number,
            co.status AS order_status,
            dn.delivery_number,
            dn.status AS delivery_status,
            f.name AS factory_name,
            COALESCE((SELECT SUM(CASE WHEN sir.return_type = 'credit_note' AND sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.invoice_id = si.id), 0) AS credit_notes_total,
            COALESCE((SELECT SUM(CASE WHEN sir.return_type = 'refund' AND sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.invoice_id = si.id), 0) AS refunds_total,
            (si.total_amount - COALESCE((SELECT SUM(CASE WHEN sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.invoice_id = si.id), 0)) AS net_invoice_amount
        FROM sales_invoices si
        JOIN customer_orders co ON co.id = si.order_id
        LEFT JOIN delivery_notes dn ON dn.order_id = co.id
        LEFT JOIN factories f ON f.id = si.factory_id
        {where_sql}
        ORDER BY si.id DESC
    """), params)
    rows = [serialize_invoice(row) for row in result.mappings().all()]
    total_amount = sum(float(item["total_amount"] or 0) for item in rows)
    paid_amount = sum(float(item["paid_amount"] or 0) for item in rows)
    remaining_amount = sum(float(item["remaining_amount"] or 0) for item in rows)
    credit_notes_total = sum(float(item["credit_notes_total"] or 0) for item in rows)
    refunds_total = sum(float(item["refunds_total"] or 0) for item in rows)
    net_sales_total = sum(float(item["net_invoice_amount"] or 0) for item in rows)
    return {"customer_name": customer_name, "invoices": rows, "summary": {"total_amount": total_amount, "paid_amount": paid_amount, "remaining_amount": remaining_amount, "credit_notes_total": credit_notes_total, "refunds_total": refunds_total, "net_sales_total": net_sales_total}}


@router.post("/from-order/{order_id}")
async def create_sales_invoice_from_order(order_id: int, payload: dict | None = None, current_user: User = Depends(require_orders_manage), db: AsyncSession = Depends(get_db)):
    await ensure_sales_documents_tables(db)
    order_row = await fetch_order_or_404(db, order_id)
    enforce_factory_scope(current_user, order_row.get("factory_id"), "Access denied for this order factory scope")

    if bool(order_row.get("is_master_order")):
        raise HTTPException(status_code=409, detail="Master orders cannot be invoiced directly")
    if order_row.get("parent_order_id") and not order_row.get("factory_id"):
        raise HTTPException(status_code=409, detail="Operational child order must have factory assignment")
    if order_row.get("factory_id") is None:
        raise HTTPException(status_code=409, detail="Order factory is not assigned")
    if str(order_row.get("status") or "") not in {"delivery_dispatched", "delivered"}:
        raise HTTPException(status_code=409, detail="Invoice creation requires order dispatch or delivery confirmation")
    if not order_row.get("delivery_number"):
        raise HTTPException(status_code=409, detail="Invoice creation requires delivery note")
    if str(order_row.get("payment_status") or "") == "refunded":
        raise HTTPException(status_code=409, detail="Refunded order cannot be invoiced")

    existing_invoice = await fetch_invoice_by_order_id(db, order_id)
    if existing_invoice:
        raise HTTPException(status_code=409, detail="Sales invoice already exists for this order")

    payload = payload or {}
    notes = _normalize_optional_text(payload.get("notes")) or _normalize_optional_text(order_row.get("notes"))
    billing_address = _normalize_optional_text(payload.get("billing_address")) or _normalize_optional_text(order_row.get("shipping_address"))
    due_at = _normalize_optional_text(payload.get("due_at"))
    invoice_number = await generate_invoice_number(db, int(order_row["factory_id"]))

    try:
        await db.execute(text("INSERT INTO sales_invoices (invoice_number, order_id, factory_id, status, payment_status, customer_name, customer_phone, billing_address, notes, subtotal_amount, vat_amount, total_amount, paid_amount, remaining_amount, due_at) VALUES (:invoice_number, :order_id, :factory_id, 'issued', :payment_status, :customer_name, :customer_phone, :billing_address, :notes, :subtotal_amount, :vat_amount, :total_amount, :paid_amount, :remaining_amount, CAST(:due_at AS TIMESTAMPTZ))"), {"invoice_number": invoice_number, "order_id": order_id, "factory_id": int(order_row["factory_id"]), "payment_status": order_row.get("payment_status") or "pending", "customer_name": order_row.get("customer_name"), "customer_phone": order_row.get("customer_phone"), "billing_address": billing_address, "notes": notes, "subtotal_amount": order_row.get("subtotal_amount"), "vat_amount": order_row.get("vat_amount"), "total_amount": order_row.get("total_amount"), "paid_amount": order_row.get("total_amount") if str(order_row.get("payment_status") or "") == "paid" else 0, "remaining_amount": 0 if str(order_row.get("payment_status") or "") == "paid" else order_row.get("total_amount"), "due_at": due_at})
        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_invoice",
            action="sales_invoice_created",
            factory_id=int(order_row["factory_id"]),
            title="إنشاء فاتورة مبيعات",
            description=f"Created sales invoice {invoice_number} from order {order_row.get('order_number')}",
            reference_type="customer_order",
            reference_id=order_id,
            metadata={"invoice_number": invoice_number, "order_id": order_id},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create sales invoice: {exc}")

    created = await fetch_invoice_by_order_id(db, order_id)
    return serialize_invoice(created)


@router.post("/{invoice_id}/mark-paid")
async def mark_sales_invoice_paid(invoice_id: int, current_user: User = Depends(require_orders_manage), db: AsyncSession = Depends(get_db)):
    await ensure_sales_documents_tables(db)
    invoice_row = await fetch_invoice_or_404(db, invoice_id)
    enforce_factory_scope(current_user, invoice_row.get("factory_id"), "Access denied for this invoice factory scope")
    if str(invoice_row.get("status") or "") == "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled invoice cannot be marked paid")
    if str(invoice_row.get("payment_status") or "") == "refunded":
        raise HTTPException(status_code=409, detail="Refunded invoice cannot be marked paid")
    try:
        await db.execute(text("UPDATE sales_invoices SET paid_amount = total_amount, paid_at = NOW(), updated_at = NOW() WHERE id = :invoice_id"), {"invoice_id": invoice_id})
        await recalc_invoice_state(db, invoice_id)
        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_invoice",
            entity_id=invoice_id,
            action="sales_invoice_marked_paid",
            factory_id=invoice_row.get("factory_id"),
            title="تحصيل فاتورة مبيعات",
            description=f"Marked sales invoice {invoice_row.get('invoice_number')} paid",
            reference_type="sales_invoice",
            reference_id=invoice_id,
            metadata={"order_id": invoice_row.get("order_id")},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to mark sales invoice paid: {exc}")
    updated = await fetch_invoice_or_404(db, invoice_id)
    return serialize_invoice(updated)


@router.post("/{invoice_id}/cancel")
async def cancel_sales_invoice(invoice_id: int, current_user: User = Depends(require_orders_manage), db: AsyncSession = Depends(get_db)):
    await ensure_sales_documents_tables(db)
    invoice_row = await fetch_invoice_or_404(db, invoice_id)
    enforce_factory_scope(current_user, invoice_row.get("factory_id"), "Access denied for this invoice factory scope")
    if str(invoice_row.get("payment_status") or "") == "paid":
        raise HTTPException(status_code=409, detail="Paid invoice cannot be cancelled directly. Use refund / credit note flow.")
    if str(invoice_row.get("delivery_status") or "") == "delivered":
        raise HTTPException(status_code=409, detail="Delivered commercial document should be reversed through return / refund flow, not direct cancellation.")
    try:
        await db.execute(text("UPDATE sales_invoices SET status = 'cancelled', cancelled_at = NOW(), updated_at = NOW(), remaining_amount = 0 WHERE id = :invoice_id"), {"invoice_id": invoice_id})
        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_invoice",
            entity_id=invoice_id,
            action="sales_invoice_cancelled",
            factory_id=invoice_row.get("factory_id"),
            title="إلغاء فاتورة مبيعات",
            description=f"Cancelled sales invoice {invoice_row.get('invoice_number')}",
            reference_type="sales_invoice",
            reference_id=invoice_id,
            metadata={"order_id": invoice_row.get("order_id")},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to cancel sales invoice: {exc}")
    updated = await fetch_invoice_or_404(db, invoice_id)
    return serialize_invoice(updated)


@router.post("/{invoice_id}/create-return")
async def create_sales_return_or_credit_note(invoice_id: int, payload: dict | None = None, current_user: User = Depends(require_orders_manage), db: AsyncSession = Depends(get_db)):
    await ensure_sales_documents_tables(db)
    invoice_row = await fetch_invoice_or_404(db, invoice_id)
    enforce_factory_scope(current_user, invoice_row.get("factory_id"), "Access denied for this invoice factory scope")
    if str(invoice_row.get("status") or "") == "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled invoice cannot receive credit note / refund")
    if str(invoice_row.get("order_status") or "") not in {"delivery_dispatched", "delivered"}:
        raise HTTPException(status_code=409, detail="Return / refund requires dispatched or delivered order")
    if not invoice_row.get("delivery_number"):
        raise HTTPException(status_code=409, detail="Return / refund requires delivery note traceability")

    payload = payload or {}
    return_type = str(payload.get("return_type") or "credit_note").strip().lower()
    if return_type not in {"credit_note", "refund"}:
        raise HTTPException(status_code=400, detail="Invalid return_type. Use credit_note or refund")
    amount = _safe_float(payload.get("amount"))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Return / refund amount must be greater than zero")

    totals = await get_invoice_return_totals(db, invoice_id)
    available_amount = max(_safe_float(invoice_row.get("total_amount")) - totals["returns_total"], 0)
    if amount > available_amount:
        raise HTTPException(status_code=409, detail=f"Amount exceeds available reversible amount ({available_amount:.2f})")

    reason = _normalize_optional_text(payload.get("reason"))
    notes = _normalize_optional_text(payload.get("notes"))
    return_number = await generate_return_number(db, int(invoice_row["factory_id"]))

    status = "issued"
    refunded_amount = 0
    refunded_at_sql = "NULL"
    if return_type == "refund":
        status = "refunded"
        refunded_amount = amount
        refunded_at_sql = "NOW()"

    try:
        await db.execute(text(f"INSERT INTO sales_invoice_returns (return_number, invoice_id, order_id, factory_id, return_type, status, reason, notes, amount, refunded_amount, refunded_at) VALUES (:return_number, :invoice_id, :order_id, :factory_id, :return_type, :status, :reason, :notes, :amount, :refunded_amount, {refunded_at_sql})"), {"return_number": return_number, "invoice_id": invoice_id, "order_id": invoice_row["order_id"], "factory_id": invoice_row["factory_id"], "return_type": return_type, "status": status, "reason": reason, "notes": notes, "amount": amount, "refunded_amount": refunded_amount})
        await recalc_invoice_state(db, invoice_id)
        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_invoice",
            entity_id=invoice_id,
            action="sales_invoice_return_created",
            factory_id=invoice_row.get("factory_id"),
            title="إنشاء مرتجع / إشعار دائن",
            description=f"Created {return_type} on sales invoice {invoice_row.get('invoice_number')}",
            reference_type="sales_invoice",
            reference_id=invoice_id,
            metadata={"return_number": return_number, "return_type": return_type, "amount": amount},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create sales return / credit note: {exc}")

    result = await db.execute(text("SELECT id FROM sales_invoice_returns WHERE invoice_id = :invoice_id ORDER BY id DESC LIMIT 1"), {"invoice_id": invoice_id})
    created_id = result.scalar()
    created = await fetch_return_or_404(db, int(created_id))
    return serialize_return(created)


@router.post("/returns/{return_id}/mark-refunded")
async def mark_sales_return_refunded(return_id: int, current_user: User = Depends(require_orders_manage), db: AsyncSession = Depends(get_db)):
    await ensure_sales_documents_tables(db)
    return_row = await fetch_return_or_404(db, return_id)
    enforce_factory_scope(current_user, return_row.get("factory_id"), "Access denied for this return factory scope")
    if str(return_row.get("status") or "") == "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled return cannot be marked refunded")
    if str(return_row.get("status") or "") == "refunded":
        raise HTTPException(status_code=409, detail="Return is already refunded")
    try:
        await db.execute(text("UPDATE sales_invoice_returns SET return_type = 'refund', status = 'refunded', refunded_amount = amount, refunded_at = NOW() WHERE id = :return_id"), {"return_id": return_id})
        await recalc_invoice_state(db, int(return_row["invoice_id"]))
        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_invoice_return",
            entity_id=return_id,
            action="sales_return_marked_refunded",
            factory_id=return_row.get("factory_id"),
            title="اعتماد رد مبلغ",
            description=f"Marked return {return_row.get('return_number')} refunded",
            reference_type="sales_invoice",
            reference_id=return_row.get("invoice_id"),
            metadata={"invoice_id": return_row.get("invoice_id"), "amount": return_row.get("amount")},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to mark return refunded: {exc}")
    updated = await fetch_return_or_404(db, return_id)
    return serialize_return(updated)


@router.post("/returns/{return_id}/cancel")
async def cancel_sales_return(return_id: int, current_user: User = Depends(require_orders_manage), db: AsyncSession = Depends(get_db)):
    await ensure_sales_documents_tables(db)
    return_row = await fetch_return_or_404(db, return_id)
    enforce_factory_scope(current_user, return_row.get("factory_id"), "Access denied for this return factory scope")
    if str(return_row.get("status") or "") == "cancelled":
        raise HTTPException(status_code=409, detail="Return is already cancelled")
    try:
        await db.execute(text("UPDATE sales_invoice_returns SET status = 'cancelled', cancelled_at = NOW() WHERE id = :return_id"), {"return_id": return_id})
        await recalc_invoice_state(db, int(return_row["invoice_id"]))
        await log_audit_event(
            db,
            current_user=current_user,
            module="sales",
            entity_type="sales_invoice_return",
            entity_id=return_id,
            action="sales_return_cancelled",
            factory_id=return_row.get("factory_id"),
            title="إلغاء مرتجع / إشعار دائن",
            description=f"Cancelled return {return_row.get('return_number')}",
            reference_type="sales_invoice",
            reference_id=return_row.get("invoice_id"),
            metadata={"invoice_id": return_row.get("invoice_id")},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to cancel return: {exc}")
    updated = await fetch_return_or_404(db, return_id)
    return serialize_return(updated)
