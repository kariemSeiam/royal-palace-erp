from datetime import datetime
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.routers.admin_finance import require_finance_view
from src.api.deps.admin_auth import get_current_user_and_role, get_user_factory_scope_id
from src.core.db.session import get_db
from src.models.user import User

router = APIRouter(prefix="/admin/accounting", tags=["admin-accounting"])


class ChartAccountCreatePayload(BaseModel):
    account_code: str = Field(min_length=1, max_length=50)
    account_name: str = Field(min_length=1, max_length=255)
    account_type: str = Field(min_length=1, max_length=50)
    parent_account_id: int | None = None
    allow_manual_entries: bool = True
    is_active: bool = True


class JournalEntryLinePayload(BaseModel):
    account_id: int
    line_description: str | None = None
    debit_amount: float = 0
    credit_amount: float = 0


class JournalEntryCreatePayload(BaseModel):
    entry_date: datetime | None = None
    source_module: str | None = None
    source_type: str | None = None
    source_id: int | None = None
    factory_id: int | None = None
    currency: str = "EGP"
    description: str | None = None
    lines: list[JournalEntryLinePayload] = Field(default_factory=list)


def _safe_float(value):
    try:
        return float(value or 0)
    except Exception:
        return 0.0


def _scoped_factory_id_or_none(current_user: User):
    if getattr(current_user, "is_superuser", False):
        return None
    return get_user_factory_scope_id(current_user)


async def require_finance_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor

    if user.is_superuser:
        return user

    normalized = {
        str(code or "").strip().lower()
        for code in (permissions or set())
        if str(code or "").strip()
    }
    if "finance.manage" not in normalized:
        raise HTTPException(status_code=403, detail="Accounting management access denied")
    return user


async def ensure_accounting_tables(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS accounting_chart_accounts (
                id SERIAL PRIMARY KEY,
                account_code VARCHAR(50) NOT NULL UNIQUE,
                account_name VARCHAR(255) NOT NULL,
                account_type VARCHAR(50) NOT NULL,
                parent_account_id INTEGER NULL REFERENCES accounting_chart_accounts(id) ON DELETE SET NULL,
                allow_manual_entries BOOLEAN NOT NULL DEFAULT TRUE,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS accounting_journal_entries (
                id SERIAL PRIMARY KEY,
                entry_number VARCHAR(100) NOT NULL UNIQUE,
                entry_date TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                source_module VARCHAR(100) NULL,
                source_type VARCHAR(100) NULL,
                source_id INTEGER NULL,
                factory_id INTEGER NULL REFERENCES factories(id) ON DELETE SET NULL,
                currency VARCHAR(10) NOT NULL DEFAULT 'EGP',
                description TEXT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'posted',
                created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS accounting_journal_entry_lines (
                id SERIAL PRIMARY KEY,
                entry_id INTEGER NOT NULL REFERENCES accounting_journal_entries(id) ON DELETE CASCADE,
                account_id INTEGER NOT NULL REFERENCES accounting_chart_accounts(id) ON DELETE RESTRICT,
                line_description TEXT NULL,
                debit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
                credit_amount NUMERIC(14,2) NOT NULL DEFAULT 0,
                factory_id INTEGER NULL REFERENCES factories(id) ON DELETE SET NULL,
                source_module VARCHAR(100) NULL,
                source_type VARCHAR(100) NULL,
                source_id INTEGER NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )

    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_accounting_chart_accounts_type ON accounting_chart_accounts(account_type)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_accounting_journal_entries_factory ON accounting_journal_entries(factory_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_accounting_journal_entries_source ON accounting_journal_entries(source_module, source_type, source_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_accounting_journal_entry_lines_entry ON accounting_journal_entry_lines(entry_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_accounting_journal_entry_lines_account ON accounting_journal_entry_lines(account_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_accounting_journal_entry_lines_factory ON accounting_journal_entry_lines(factory_id)"))
    await db.commit()

    await db.execute(text("SELECT pg_advisory_xact_lock(91824018)"))

    defaults = [
        ("1100", "الصندوق", "asset"),
        ("1200", "البنك", "asset"),
        ("1300", "العملاء", "asset"),
        ("1400", "المخزون", "asset"),
        ("2100", "الموردون", "liability"),
        ("2200", "ضريبة القيمة المضافة المستحقة", "liability"),
        ("3100", "رأس المال", "equity"),
        ("4100", "إيرادات المبيعات", "revenue"),
        ("5100", "تكلفة المشتريات", "expense"),
        ("5200", "الرواتب والأجور", "expense"),
    ]

    for code, name, acc_type in defaults:
        await db.execute(
            text(
                """
                INSERT INTO accounting_chart_accounts (
                    account_code,
                    account_name,
                    account_type,
                    allow_manual_entries,
                    is_active
                )
                VALUES (
                    :account_code,
                    :account_name,
                    :account_type,
                    TRUE,
                    TRUE
                )
                ON CONFLICT (account_code) DO NOTHING
                """
            ),
            {
                "account_code": code,
                "account_name": name,
                "account_type": acc_type,
            },
        )

    await db.commit()


async def _get_account_by_code(db: AsyncSession, account_code: str):
    result = await db.execute(
        text(
            """
            SELECT id, account_code, account_name, account_type
            FROM accounting_chart_accounts
            WHERE account_code = :account_code
            LIMIT 1
            """
        ),
        {"account_code": str(account_code).strip()},
    )
    return result.mappings().first()


async def _require_default_accounts(db: AsyncSession):
    required = ["1100", "1300", "2100", "2200", "4100", "5100", "5200"]
    accounts = {}
    for code in required:
        row = await _get_account_by_code(db, code)
        if not row:
            raise HTTPException(
                status_code=409,
                detail=f"Missing default accounting account {code}. Re-run accounting initialization.",
            )
        accounts[code] = row
    return accounts


async def _source_entry_exists(
    db: AsyncSession,
    *,
    source_module: str,
    source_type: str,
    source_id: int,
):
    result = await db.execute(
        text(
            """
            SELECT id, entry_number, status, factory_id, currency, description
            FROM accounting_journal_entries
            WHERE source_module = :source_module
              AND source_type = :source_type
              AND source_id = :source_id
            ORDER BY id DESC
            LIMIT 1
            """
        ),
        {
            "source_module": source_module,
            "source_type": source_type,
            "source_id": source_id,
        },
    )
    return result.mappings().first()


async def _create_journal_entry_internal(
    db: AsyncSession,
    *,
    current_user: User,
    source_module: str | None,
    source_type: str | None,
    source_id: int | None,
    factory_id: int | None,
    currency: str,
    description: str | None,
    lines: list[dict],
    entry_date: datetime | None = None,
):
    await ensure_accounting_tables(db)

    if not lines:
        raise HTTPException(status_code=400, detail="Journal entry must include at least one line")

    total_debit = round(sum(_safe_float(line.get("debit_amount")) for line in lines), 2)
    total_credit = round(sum(_safe_float(line.get("credit_amount")) for line in lines), 2)

    if total_debit <= 0 or total_credit <= 0:
        raise HTTPException(status_code=400, detail="Journal entry must contain debit and credit values")

    if round(total_debit - total_credit, 2) != 0:
        raise HTTPException(status_code=400, detail="Journal entry is not balanced")

    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    target_factory_id = factory_id if factory_id is not None else scoped_factory_id
    if scoped_factory_id is not None and int(target_factory_id or 0) != int(scoped_factory_id):
        raise HTTPException(status_code=403, detail="Accounting access denied for this factory scope")

    if source_module and source_type and source_id is not None:
        existing = await _source_entry_exists(
            db,
            source_module=source_module,
            source_type=source_type,
            source_id=int(source_id),
        )
        if existing:
            raise HTTPException(
                status_code=409,
                detail=f"Accounting entry already exists for {source_module}/{source_type}/{source_id}",
            )

    next_number_result = await db.execute(
        text(
            """
            SELECT CONCAT(
                'JE-',
                TO_CHAR(NOW(), 'YYYYMMDD'),
                '-',
                LPAD((COALESCE(MAX(id), 0) + 1)::text, 6, '0')
            ) AS code
            FROM accounting_journal_entries
            """
        )
    )
    entry_number = str(next_number_result.scalar() or "").strip()
    if not entry_number:
        entry_number = f"JE-{datetime.utcnow().strftime('%Y%m%d')}-000001"

    entry_result = await db.execute(
        text(
            """
            INSERT INTO accounting_journal_entries (
                entry_number,
                entry_date,
                source_module,
                source_type,
                source_id,
                factory_id,
                currency,
                description,
                status,
                created_by_user_id
            )
            VALUES (
                :entry_number,
                :entry_date,
                :source_module,
                :source_type,
                :source_id,
                :factory_id,
                :currency,
                :description,
                'posted',
                :created_by_user_id
            )
            RETURNING id
            """
        ),
        {
            "entry_number": entry_number,
            "entry_date": entry_date or datetime.utcnow(),
            "source_module": source_module,
            "source_type": source_type,
            "source_id": source_id,
            "factory_id": target_factory_id,
            "currency": currency or "EGP",
            "description": description,
            "created_by_user_id": getattr(current_user, "id", None),
        },
    )
    entry_id = int(entry_result.scalar())

    for line in lines:
        await db.execute(
            text(
                """
                INSERT INTO accounting_journal_entry_lines (
                    entry_id,
                    account_id,
                    line_description,
                    debit_amount,
                    credit_amount,
                    factory_id,
                    source_module,
                    source_type,
                    source_id
                )
                VALUES (
                    :entry_id,
                    :account_id,
                    :line_description,
                    :debit_amount,
                    :credit_amount,
                    :factory_id,
                    :source_module,
                    :source_type,
                    :source_id
                )
                """
            ),
            {
                "entry_id": entry_id,
                "account_id": int(line["account_id"]),
                "line_description": line.get("line_description"),
                "debit_amount": _safe_float(line.get("debit_amount")),
                "credit_amount": _safe_float(line.get("credit_amount")),
                "factory_id": target_factory_id,
                "source_module": source_module,
                "source_type": source_type,
                "source_id": source_id,
            },
        )

    await db.commit()

    return {
        "id": entry_id,
        "entry_number": entry_number,
        "factory_id": target_factory_id,
        "currency": currency or "EGP",
        "total_debit": total_debit,
        "total_credit": total_credit,
        "status": "posted",
        "source_module": source_module,
        "source_type": source_type,
        "source_id": source_id,
    }


async def _sales_invoice_or_404(db: AsyncSession, sales_invoice_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                si.*,
                co.order_number,
                f.name AS factory_name
            FROM sales_invoices si
            JOIN customer_orders co ON co.id = si.order_id
            LEFT JOIN factories f ON f.id = si.factory_id
            WHERE si.id = :sales_invoice_id
            LIMIT 1
            """
        ),
        {"sales_invoice_id": sales_invoice_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Sales invoice not found")
    return row


async def _sales_return_or_404(db: AsyncSession, sales_return_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                sir.*,
                si.invoice_number,
                f.name AS factory_name
            FROM sales_invoice_returns sir
            JOIN sales_invoices si ON si.id = sir.invoice_id
            LEFT JOIN factories f ON f.id = sir.factory_id
            WHERE sir.id = :sales_return_id
            LIMIT 1
            """
        ),
        {"sales_return_id": sales_return_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Sales return not found")
    return row


async def _supplier_invoice_or_404(db: AsyncSession, supplier_invoice_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                si.*,
                s.name AS supplier_name,
                s.code AS supplier_code,
                f.name AS factory_name
            FROM supplier_invoices si
            JOIN suppliers s ON s.id = si.supplier_id
            LEFT JOIN factories f ON f.id = si.factory_id
            WHERE si.id = :supplier_invoice_id
            LIMIT 1
            """
        ),
        {"supplier_invoice_id": supplier_invoice_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Supplier invoice not found")
    return row


async def _supplier_payment_or_404(db: AsyncSession, supplier_payment_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                sp.*,
                si.invoice_number,
                s.name AS supplier_name,
                f.name AS factory_name
            FROM supplier_payments sp
            LEFT JOIN supplier_invoices si ON si.id = sp.supplier_invoice_id
            JOIN suppliers s ON s.id = sp.supplier_id
            LEFT JOIN factories f ON f.id = sp.factory_id
            WHERE sp.id = :supplier_payment_id
            LIMIT 1
            """
        ),
        {"supplier_payment_id": supplier_payment_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Supplier payment not found")
    return row


async def _payroll_run_or_404(db: AsyncSession, payroll_run_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                pr.*,
                f.name AS factory_name,
                COALESCE(SUM(pl.net_salary), 0) AS net_salary_total
            FROM payroll_runs pr
            JOIN factories f ON f.id = pr.factory_id
            LEFT JOIN payroll_lines pl ON pl.payroll_run_id = pr.id
            WHERE pr.id = :payroll_run_id
            GROUP BY pr.id, f.name
            LIMIT 1
            """
        ),
        {"payroll_run_id": payroll_run_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Payroll run not found")
    return row


async def _enforce_current_user_scope(current_user: User, target_factory_id: int | None):
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    if scoped_factory_id is not None and int(scoped_factory_id or 0) != int(target_factory_id or 0):
        raise HTTPException(status_code=403, detail="Accounting access denied for this factory scope")


@router.get("/chart-of-accounts")
async def list_chart_of_accounts(
    current_user: User = Depends(require_finance_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_accounting_tables(db)
    result = await db.execute(
        text(
            """
            SELECT
                id,
                account_code,
                account_name,
                account_type,
                parent_account_id,
                allow_manual_entries,
                is_active,
                created_at,
                updated_at
            FROM accounting_chart_accounts
            ORDER BY account_code ASC, id ASC
            """
        )
    )
    return [dict(row) for row in result.mappings().all()]


@router.post("/chart-of-accounts", status_code=status.HTTP_201_CREATED)
async def create_chart_account(
    payload: ChartAccountCreatePayload,
    current_user: User = Depends(require_finance_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_accounting_tables(db)

    existing = await db.execute(
        text("SELECT id FROM accounting_chart_accounts WHERE account_code = :account_code"),
        {"account_code": payload.account_code.strip()},
    )
    if existing.scalar():
        raise HTTPException(status_code=409, detail="Account code already exists")

    result = await db.execute(
        text(
            """
            INSERT INTO accounting_chart_accounts (
                account_code,
                account_name,
                account_type,
                parent_account_id,
                allow_manual_entries,
                is_active
            )
            VALUES (
                :account_code,
                :account_name,
                :account_type,
                :parent_account_id,
                :allow_manual_entries,
                :is_active
            )
            RETURNING
                id,
                account_code,
                account_name,
                account_type,
                parent_account_id,
                allow_manual_entries,
                is_active,
                created_at,
                updated_at
            """
        ),
        {
            "account_code": payload.account_code.strip(),
            "account_name": payload.account_name.strip(),
            "account_type": payload.account_type.strip().lower(),
            "parent_account_id": payload.parent_account_id,
            "allow_manual_entries": payload.allow_manual_entries,
            "is_active": payload.is_active,
        },
    )
    await db.commit()
    row = result.mappings().first()
    return dict(row)


@router.get("/journal-entries")
async def list_journal_entries(
    current_user: User = Depends(require_finance_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_accounting_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    params = {}
    where_sql = ""

    if scoped_factory_id is not None:
        params["factory_id"] = scoped_factory_id
        where_sql = " WHERE e.factory_id = :factory_id "

    result = await db.execute(
        text(
            f"""
            SELECT
                e.id,
                e.entry_number,
                e.entry_date,
                e.source_module,
                e.source_type,
                e.source_id,
                e.factory_id,
                f.name AS factory_name,
                e.currency,
                e.description,
                e.status,
                e.created_by_user_id,
                COALESCE(SUM(l.debit_amount), 0) AS total_debit,
                COALESCE(SUM(l.credit_amount), 0) AS total_credit
            FROM accounting_journal_entries e
            LEFT JOIN accounting_journal_entry_lines l ON l.entry_id = e.id
            LEFT JOIN factories f ON f.id = e.factory_id
            {where_sql}
            GROUP BY e.id, f.name
            ORDER BY e.id DESC
            LIMIT 100
            """
        ),
        params,
    )
    return [dict(row) for row in result.mappings().all()]


@router.post("/journal-entries", status_code=status.HTTP_201_CREATED)
async def create_journal_entry(
    payload: JournalEntryCreatePayload,
    current_user: User = Depends(require_finance_manage),
    db: AsyncSession = Depends(get_db),
):
    return await _create_journal_entry_internal(
        db,
        current_user=current_user,
        source_module=payload.source_module,
        source_type=payload.source_type,
        source_id=payload.source_id,
        factory_id=payload.factory_id,
        currency=payload.currency,
        description=payload.description,
        entry_date=payload.entry_date,
        lines=[
            {
                "account_id": line.account_id,
                "line_description": line.line_description,
                "debit_amount": line.debit_amount,
                "credit_amount": line.credit_amount,
            }
            for line in payload.lines
        ],
    )


@router.post("/postings/sales-invoices/{sales_invoice_id}", status_code=status.HTTP_201_CREATED)
async def post_sales_invoice_accounting(
    sales_invoice_id: int,
    current_user: User = Depends(require_finance_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_accounting_tables(db)
    defaults = await _require_default_accounts(db)
    invoice = await _sales_invoice_or_404(db, sales_invoice_id)
    await _enforce_current_user_scope(current_user, invoice.get("factory_id"))

    total_amount = _safe_float(invoice.get("total_amount"))
    vat_amount = _safe_float(invoice.get("vat_amount"))
    revenue_amount = max(total_amount - vat_amount, 0)

    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="Sales invoice total amount must be greater than zero")

    return await _create_journal_entry_internal(
        db,
        current_user=current_user,
        source_module="sales",
        source_type="sales_invoice",
        source_id=sales_invoice_id,
        factory_id=int(invoice["factory_id"]),
        currency="EGP",
        description=f"Posting sales invoice {invoice.get('invoice_number')}",
        lines=[
            {
                "account_id": int(defaults["1300"]["id"]),
                "line_description": f"Receivable for sales invoice {invoice.get('invoice_number')}",
                "debit_amount": total_amount,
                "credit_amount": 0,
            },
            {
                "account_id": int(defaults["4100"]["id"]),
                "line_description": f"Revenue for sales invoice {invoice.get('invoice_number')}",
                "debit_amount": 0,
                "credit_amount": revenue_amount,
            },
            {
                "account_id": int(defaults["2200"]["id"]),
                "line_description": f"VAT for sales invoice {invoice.get('invoice_number')}",
                "debit_amount": 0,
                "credit_amount": vat_amount,
            },
        ],
    )


@router.post("/postings/sales-returns/{sales_return_id}", status_code=status.HTTP_201_CREATED)
async def post_sales_return_accounting(
    sales_return_id: int,
    current_user: User = Depends(require_finance_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_accounting_tables(db)
    defaults = await _require_default_accounts(db)
    sales_return = await _sales_return_or_404(db, sales_return_id)
    await _enforce_current_user_scope(current_user, sales_return.get("factory_id"))

    amount = _safe_float(sales_return.get("amount"))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Sales return amount must be greater than zero")

    return await _create_journal_entry_internal(
        db,
        current_user=current_user,
        source_module="sales",
        source_type="sales_return",
        source_id=sales_return_id,
        factory_id=int(sales_return["factory_id"]),
        currency="EGP",
        description=f"Posting sales return {sales_return.get('return_number')}",
        lines=[
            {
                "account_id": int(defaults["4100"]["id"]),
                "line_description": f"Reverse revenue for sales return {sales_return.get('return_number')}",
                "debit_amount": amount,
                "credit_amount": 0,
            },
            {
                "account_id": int(defaults["1300"]["id"]),
                "line_description": f"Reduce receivable for sales return {sales_return.get('return_number')}",
                "debit_amount": 0,
                "credit_amount": amount,
            },
        ],
    )


@router.post("/postings/supplier-invoices/{supplier_invoice_id}", status_code=status.HTTP_201_CREATED)
async def post_supplier_invoice_accounting(
    supplier_invoice_id: int,
    current_user: User = Depends(require_finance_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_accounting_tables(db)
    defaults = await _require_default_accounts(db)
    invoice = await _supplier_invoice_or_404(db, supplier_invoice_id)
    await _enforce_current_user_scope(current_user, invoice.get("factory_id"))

    total_amount = _safe_float(invoice.get("total_amount"))
    vat_amount = _safe_float(invoice.get("vat_amount"))
    expense_amount = max(total_amount - vat_amount, 0)

    if total_amount <= 0:
        raise HTTPException(status_code=400, detail="Supplier invoice total amount must be greater than zero")

    return await _create_journal_entry_internal(
        db,
        current_user=current_user,
        source_module="procurement",
        source_type="supplier_invoice",
        source_id=supplier_invoice_id,
        factory_id=int(invoice["factory_id"]),
        currency="EGP",
        description=f"Posting supplier invoice {invoice.get('invoice_number')}",
        lines=[
            {
                "account_id": int(defaults["5100"]["id"]),
                "line_description": f"Expense for supplier invoice {invoice.get('invoice_number')}",
                "debit_amount": expense_amount,
                "credit_amount": 0,
            },
            {
                "account_id": int(defaults["2200"]["id"]),
                "line_description": f"VAT for supplier invoice {invoice.get('invoice_number')}",
                "debit_amount": vat_amount,
                "credit_amount": 0,
            },
            {
                "account_id": int(defaults["2100"]["id"]),
                "line_description": f"Payable for supplier invoice {invoice.get('invoice_number')}",
                "debit_amount": 0,
                "credit_amount": total_amount,
            },
        ],
    )


@router.post("/postings/supplier-payments/{supplier_payment_id}", status_code=status.HTTP_201_CREATED)
async def post_supplier_payment_accounting(
    supplier_payment_id: int,
    current_user: User = Depends(require_finance_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_accounting_tables(db)
    defaults = await _require_default_accounts(db)
    payment = await _supplier_payment_or_404(db, supplier_payment_id)
    await _enforce_current_user_scope(current_user, payment.get("factory_id"))

    amount = _safe_float(payment.get("amount"))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Supplier payment amount must be greater than zero")

    return await _create_journal_entry_internal(
        db,
        current_user=current_user,
        source_module="procurement",
        source_type="supplier_payment",
        source_id=supplier_payment_id,
        factory_id=int(payment["factory_id"]),
        currency="EGP",
        description=f"Posting supplier payment {payment.get('reference_number') or payment.get('invoice_number') or supplier_payment_id}",
        lines=[
            {
                "account_id": int(defaults["2100"]["id"]),
                "line_description": f"Reduce payable for supplier payment {supplier_payment_id}",
                "debit_amount": amount,
                "credit_amount": 0,
            },
            {
                "account_id": int(defaults["1100"]["id"]),
                "line_description": f"Cash/bank movement for supplier payment {supplier_payment_id}",
                "debit_amount": 0,
                "credit_amount": amount,
            },
        ],
    )


@router.post("/postings/payroll-runs/{payroll_run_id}", status_code=status.HTTP_201_CREATED)
async def post_payroll_run_accounting(
    payroll_run_id: int,
    current_user: User = Depends(require_finance_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_accounting_tables(db)
    defaults = await _require_default_accounts(db)
    payroll_run = await _payroll_run_or_404(db, payroll_run_id)
    await _enforce_current_user_scope(current_user, payroll_run.get("factory_id"))

    amount = _safe_float(payroll_run.get("net_salary_total"))
    if amount <= 0:
        raise HTTPException(status_code=400, detail="Payroll run net salary total must be greater than zero")

    return await _create_journal_entry_internal(
        db,
        current_user=current_user,
        source_module="hr_payroll",
        source_type="payroll_run",
        source_id=payroll_run_id,
        factory_id=int(payroll_run["factory_id"]),
        currency="EGP",
        description=f"Posting payroll run {payroll_run_id} for {payroll_run.get('payroll_month')}/{payroll_run.get('payroll_year')}",
        lines=[
            {
                "account_id": int(defaults["5200"]["id"]),
                "line_description": f"Payroll expense for run {payroll_run_id}",
                "debit_amount": amount,
                "credit_amount": 0,
            },
            {
                "account_id": int(defaults["1100"]["id"]),
                "line_description": f"Cash/bank payroll settlement for run {payroll_run_id}",
                "debit_amount": 0,
                "credit_amount": amount,
            },
        ],
    )


@router.get("/postings/source-check")
async def check_posting_source(
    source_module: str,
    source_type: str,
    source_id: int,
    current_user: User = Depends(require_finance_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_accounting_tables(db)
    existing = await _source_entry_exists(
        db,
        source_module=source_module.strip(),
        source_type=source_type.strip(),
        source_id=source_id,
    )
    return {
        "exists": bool(existing),
        "entry": dict(existing) if existing else None,
    }


@router.get("/trial-balance")
async def get_trial_balance(
    current_user: User = Depends(require_finance_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_accounting_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    params = {}
    where_sql = ""

    if scoped_factory_id is not None:
        params["factory_id"] = scoped_factory_id
        where_sql = " WHERE l.factory_id = :factory_id "

    result = await db.execute(
        text(
            f"""
            SELECT
                a.id AS account_id,
                a.account_code,
                a.account_name,
                a.account_type,
                COALESCE(SUM(l.debit_amount), 0) AS total_debit,
                COALESCE(SUM(l.credit_amount), 0) AS total_credit,
                COALESCE(SUM(l.debit_amount), 0) - COALESCE(SUM(l.credit_amount), 0) AS balance
            FROM accounting_chart_accounts a
            LEFT JOIN accounting_journal_entry_lines l
                ON l.account_id = a.id
            {where_sql}
            GROUP BY a.id
            ORDER BY a.account_code ASC, a.id ASC
            """
        ),
        params,
    )

    rows = [dict(row) for row in result.mappings().all()]
    totals = {
        "total_debit": round(sum(float(row["total_debit"] or 0) for row in rows), 2),
        "total_credit": round(sum(float(row["total_credit"] or 0) for row in rows), 2),
    }
    totals["is_balanced"] = round(totals["total_debit"] - totals["total_credit"], 2) == 0

    return {
        "factory_scope": scoped_factory_id,
        "totals": totals,
        "rows": rows,
    }

