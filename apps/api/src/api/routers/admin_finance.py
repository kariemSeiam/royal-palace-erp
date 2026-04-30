from fastapi import APIRouter, Depends
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    ensure_not_blocked_admin_role,
    get_current_user_and_role,
    get_user_factory_scope_id,
)
from src.core.db.session import get_db
from src.models.user import User

router = APIRouter(prefix="/admin/finance", tags=["admin-finance"])


def _normalize_permission_set(permissions) -> set[str]:
    return {
        str(code or "").strip().lower()
        for code in (permissions or set())
        if str(code or "").strip()
    }


def _has_any_permission(permissions: set[str], *codes: str) -> bool:
    wanted = {str(code or "").strip().lower() for code in codes if str(code or "").strip()}
    return any(code in permissions for code in wanted)


async def require_finance_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    normalized = _normalize_permission_set(permissions)

    if user.is_superuser:
        return user

    if not _has_any_permission(
        normalized,
        "finance.view",
        "finance.manage",
        "dashboard.view",
        "orders.view",
        "orders.manage",
        "procurement.view",
        "procurement.manage",
        "inventory.view",
        "inventory.manage",
        "hr.view",
        "hr.manage",
        "payroll.view",
        "payroll.read",
        "payroll.manage",
    ):
        from fastapi import HTTPException
        raise HTTPException(status_code=403, detail="Finance access denied")

    return user


def _scoped_factory_id_or_none(current_user: User):
    if getattr(current_user, "is_superuser", False):
        return None
    return get_user_factory_scope_id(current_user)


async def _scalar_float(db: AsyncSession, sql_text: str, params: dict | None = None) -> float:
    result = await db.execute(text(sql_text), params or {})
    value = result.scalar()
    return float(value or 0)


async def _scalar_int(db: AsyncSession, sql_text: str, params: dict | None = None) -> int:
    result = await db.execute(text(sql_text), params or {})
    value = result.scalar()
    return int(value or 0)


@router.get("/summary")
async def get_finance_summary(current_user: User = Depends(require_finance_view), db: AsyncSession = Depends(get_db)):
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    params = {}
    order_where = ""
    procurement_where = ""
    payroll_where = ""
    inventory_where = ""
    sales_invoice_where = ""
    sales_return_where = ""

    if scoped_factory_id is not None:
        params["factory_id"] = scoped_factory_id
        order_where = " WHERE factory_id = :factory_id "
        procurement_where = " WHERE factory_id = :factory_id "
        payroll_where = " WHERE factory_id = :factory_id "
        inventory_where = " WHERE factory_id = :factory_id "
        sales_invoice_where = " WHERE factory_id = :factory_id "
        sales_return_where = " WHERE factory_id = :factory_id "

    sales_orders_count = await _scalar_int(db, f"SELECT COUNT(*) FROM customer_orders {order_where}", params)
    sales_subtotal = await _scalar_float(db, f"SELECT COALESCE(SUM(subtotal_amount), 0) FROM customer_orders {order_where}", params)
    sales_vat_total = await _scalar_float(db, f"SELECT COALESCE(SUM(vat_amount), 0) FROM customer_orders {order_where}", params)
    sales_total = await _scalar_float(db, f"SELECT COALESCE(SUM(total_amount), 0) FROM customer_orders {order_where}", params)

    sales_invoices_count = await _scalar_int(db, f"SELECT COUNT(*) FROM sales_invoices {sales_invoice_where}", params)
    sales_invoices_total = await _scalar_float(db, f"SELECT COALESCE(SUM(total_amount), 0) FROM sales_invoices {sales_invoice_where}", params)
    collected_revenue = await _scalar_float(db, f"SELECT COALESCE(SUM(paid_amount), 0) FROM sales_invoices {sales_invoice_where}", params)
    outstanding_receivables = await _scalar_float(db, f"SELECT COALESCE(SUM(remaining_amount), 0) FROM sales_invoices {sales_invoice_where}", params)

    if sales_return_where:
        credit_sql = "SELECT COALESCE(SUM(amount), 0) FROM sales_invoice_returns WHERE factory_id = :factory_id AND return_type = 'credit_note' AND status != 'cancelled'"
        refund_sql = "SELECT COALESCE(SUM(amount), 0) FROM sales_invoice_returns WHERE factory_id = :factory_id AND return_type = 'refund' AND status != 'cancelled'"
    else:
        credit_sql = "SELECT COALESCE(SUM(amount), 0) FROM sales_invoice_returns WHERE return_type = 'credit_note' AND status != 'cancelled'"
        refund_sql = "SELECT COALESCE(SUM(amount), 0) FROM sales_invoice_returns WHERE return_type = 'refund' AND status != 'cancelled'"

    credit_notes_total = await _scalar_float(db, credit_sql, params)
    refunds_total = await _scalar_float(db, refund_sql, params)

    supplier_invoices_count = await _scalar_int(db, f"SELECT COUNT(*) FROM supplier_invoices {procurement_where}", params)
    supplier_invoices_total = await _scalar_float(db, f"SELECT COALESCE(SUM(total_amount), 0) FROM supplier_invoices {procurement_where}", params)
    supplier_paid_total = await _scalar_float(db, f"SELECT COALESCE(SUM(paid_amount), 0) FROM supplier_invoices {procurement_where}", params)
    supplier_remaining_total = await _scalar_float(db, f"SELECT COALESCE(SUM(remaining_amount), 0) FROM supplier_invoices {procurement_where}", params)

    payroll_runs_count = await _scalar_int(db, f"SELECT COUNT(*) FROM payroll_runs {payroll_where}", params)
    payroll_total = await _scalar_float(db, f"SELECT COALESCE(SUM(pl.net_salary), 0) FROM payroll_lines pl {payroll_where.replace('factory_id', 'pl.factory_id')}", params)
    purchase_receipts_total_cost = await _scalar_float(db, f"SELECT COALESCE(SUM(received_quantity * unit_cost), 0) FROM purchase_receipts {procurement_where}", params)

    inventory_in_total = await _scalar_float(
        db,
        f"SELECT COALESCE(SUM(quantity), 0) FROM inventory_movements {inventory_where + (' AND ' if inventory_where else ' WHERE ')} movement_type = 'in'",
        params,
    )
    inventory_out_total = await _scalar_float(
        db,
        f"SELECT COALESCE(SUM(quantity), 0) FROM inventory_movements {inventory_where + (' AND ' if inventory_where else ' WHERE ')} movement_type = 'out'",
        params,
    )

    net_sales_total = sales_invoices_total - credit_notes_total - refunds_total
    estimated_operating_cost = purchase_receipts_total_cost + payroll_total
    estimated_gross_profit = net_sales_total - purchase_receipts_total_cost
    estimated_operating_profit = net_sales_total - estimated_operating_cost

    return {
        "factory_scope": scoped_factory_id,
        "summary": {
            "vat_rate_percent": 0,
            "sales_orders_count": sales_orders_count,
            "sales_invoices_count": sales_invoices_count,
            "sales_subtotal": sales_subtotal,
            "sales_vat_total": sales_vat_total,
            "sales_total": sales_total,
            "sales_invoices_total": sales_invoices_total,
            "credit_notes_total": credit_notes_total,
            "refunds_total": refunds_total,
            "net_sales_total": net_sales_total,
            "collected_revenue": collected_revenue,
            "outstanding_receivables": outstanding_receivables,
            "supplier_invoices_count": supplier_invoices_count,
            "supplier_invoices_total": supplier_invoices_total,
            "supplier_paid_total": supplier_paid_total,
            "supplier_remaining_total": supplier_remaining_total,
            "payroll_runs_count": payroll_runs_count,
            "payroll_total": payroll_total,
            "purchase_receipts_total_cost": purchase_receipts_total_cost,
            "inventory_in_total": inventory_in_total,
            "inventory_out_total": inventory_out_total,
            "estimated_gross_profit": estimated_gross_profit,
            "estimated_operating_cost": estimated_operating_cost,
            "estimated_operating_profit": estimated_operating_profit,
        },
    }


@router.get("/factory-profitability")
async def get_factory_profitability(current_user: User = Depends(require_finance_view), db: AsyncSession = Depends(get_db)):
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    params = {}
    where_sql = ""

    if scoped_factory_id is not None:
        params["factory_id"] = scoped_factory_id
        where_sql = " WHERE f.id = :factory_id "

    result = await db.execute(
        text(
            f"""
            SELECT
                f.id AS factory_id,
                f.name AS factory_name,
                COALESCE((SELECT SUM(si.total_amount) FROM sales_invoices si WHERE si.factory_id = f.id), 0) AS sales_invoices_total,
                COALESCE((SELECT SUM(si.paid_amount) FROM sales_invoices si WHERE si.factory_id = f.id), 0) AS sales_collected_total,
                COALESCE((SELECT SUM(si.remaining_amount) FROM sales_invoices si WHERE si.factory_id = f.id), 0) AS sales_remaining_total,
                COALESCE((SELECT SUM(CASE WHEN sir.return_type = 'credit_note' AND sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.factory_id = f.id), 0) AS credit_notes_total,
                COALESCE((SELECT SUM(CASE WHEN sir.return_type = 'refund' AND sir.status != 'cancelled' THEN sir.amount ELSE 0 END) FROM sales_invoice_returns sir WHERE sir.factory_id = f.id), 0) AS refunds_total,
                COALESCE((SELECT SUM(spi.total_amount) FROM supplier_invoices spi WHERE spi.factory_id = f.id), 0) AS supplier_invoices_total,
                COALESCE((SELECT SUM(spi.remaining_amount) FROM supplier_invoices spi WHERE spi.factory_id = f.id), 0) AS supplier_remaining_total,
                COALESCE((SELECT SUM(pr.received_quantity * pr.unit_cost) FROM purchase_orders po JOIN purchase_receipts pr ON pr.purchase_order_id = po.id WHERE po.factory_id = f.id), 0) AS procurement_cost_total,
                COALESCE((SELECT SUM(pl.net_salary) FROM payroll_lines pl WHERE pl.factory_id = f.id), 0) AS payroll_total
            FROM factories f
            {where_sql}
            ORDER BY f.id ASC
            """
        ),
        params,
    )

    rows = []
    for row in result.mappings().all():
        sales_invoices_total = float(row["sales_invoices_total"] or 0)
        credit_notes_total = float(row["credit_notes_total"] or 0)
        refunds_total = float(row["refunds_total"] or 0)
        net_sales_total = sales_invoices_total - credit_notes_total - refunds_total
        procurement_cost_total = float(row["procurement_cost_total"] or 0)
        payroll_total = float(row["payroll_total"] or 0)
        estimated_operating_cost = procurement_cost_total + payroll_total

        rows.append(
            {
                "factory_id": row["factory_id"],
                "factory_name": row["factory_name"],
                "sales_total": sales_invoices_total,
                "sales_collected_total": float(row["sales_collected_total"] or 0),
                "sales_remaining_total": float(row["sales_remaining_total"] or 0),
                "credit_notes_total": credit_notes_total,
                "refunds_total": refunds_total,
                "net_sales_total": net_sales_total,
                "supplier_invoices_total": float(row["supplier_invoices_total"] or 0),
                "supplier_remaining_total": float(row["supplier_remaining_total"] or 0),
                "procurement_cost_total": procurement_cost_total,
                "payroll_total": payroll_total,
                "estimated_gross_profit": net_sales_total - procurement_cost_total,
                "estimated_operating_profit": net_sales_total - estimated_operating_cost,
            }
        )

    return rows


@router.get("/recent-orders")
async def get_recent_finance_orders(current_user: User = Depends(require_finance_view), db: AsyncSession = Depends(get_db)):
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    params = {}
    where_sql = ""

    if scoped_factory_id is not None:
        params["factory_id"] = scoped_factory_id
        where_sql = " WHERE co.factory_id = :factory_id "

    result = await db.execute(
        text(
            f"""
            SELECT
                co.id,
                co.order_number,
                co.factory_id,
                f.name AS factory_name,
                co.status,
                co.payment_status,
                co.subtotal_amount,
                co.vat_amount,
                co.total_amount,
                co.customer_name,
                co.created_at
            FROM customer_orders co
            LEFT JOIN factories f ON f.id = co.factory_id
            {where_sql}
            ORDER BY co.id DESC
            LIMIT 20
            """
        ),
        params,
    )

    return [dict(row) for row in result.mappings().all()]


@router.get("/sales-trend")
async def get_sales_trend(current_user: User = Depends(require_finance_view), db: AsyncSession = Depends(get_db)):
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    params = {}
    where_sql = ""
    
    if scoped_factory_id is not None:
        params["factory_id"] = scoped_factory_id
        where_sql = " AND factory_id = :factory_id "
    
    result = await db.execute(
        text(f"""
            SELECT 
                DATE_TRUNC('month', created_at) as month,
                COALESCE(SUM(total_amount), 0) as total_sales,
                COALESCE(SUM(paid_amount), 0) as collected_amount,
                COALESCE(SUM(remaining_amount), 0) as outstanding_amount,
                COUNT(*) as invoice_count
            FROM sales_invoices
            WHERE created_at >= NOW() - INTERVAL '12 months'
            {where_sql}
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month ASC
        """),
        params
    )
    
    rows = []
    for row in result.mappings().all():
        month_val = row["month"]
        rows.append({
            "month": month_val.strftime("%Y-%m") if month_val else None,
            "total_sales": float(row["total_sales"] or 0),
            "collected_amount": float(row["collected_amount"] or 0),
            "outstanding_amount": float(row["outstanding_amount"] or 0),
            "invoice_count": int(row["invoice_count"] or 0)
        })
    
    return rows


@router.get("/cost-trend")
async def get_cost_trend(current_user: User = Depends(require_finance_view), db: AsyncSession = Depends(get_db)):
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    params = {}
    where_sql = ""
    
    if scoped_factory_id is not None:
        params["factory_id"] = scoped_factory_id
        where_sql = " AND factory_id = :factory_id "
    
    result = await db.execute(
        text(f"""
            SELECT 
                DATE_TRUNC('month', created_at) as month,
                COALESCE(SUM(received_quantity * unit_cost), 0) as procurement_cost,
                COUNT(DISTINCT purchase_order_id) as po_count
            FROM purchase_receipts
            WHERE created_at >= NOW() - INTERVAL '12 months'
            {where_sql}
            GROUP BY DATE_TRUNC('month', created_at)
            ORDER BY month ASC
        """),
        params
    )
    
    rows = []
    for row in result.mappings().all():
        month_val = row["month"]
        rows.append({
            "month": month_val.strftime("%Y-%m") if month_val else None,
            "procurement_cost": float(row["procurement_cost"] or 0),
            "po_count": int(row["po_count"] or 0)
        })
    
    return rows


@router.get("/top-products")
async def get_top_products(current_user: User = Depends(require_finance_view), db: AsyncSession = Depends(get_db), limit: int = 10):
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    params = {"limit": limit}
    where_sql = ""
    
    if scoped_factory_id is not None:
        params["factory_id"] = scoped_factory_id
        where_sql = " AND co.factory_id = :factory_id "
    
    result = await db.execute(
        text(f"""
            SELECT 
                p.id,
                p.name_ar,
                p.name_en,
                p.sku,
                COALESCE(SUM(coi.quantity), 0) as total_quantity_sold,
                COALESCE(SUM(co.subtotal_amount), 0) as total_revenue
            FROM customer_order_items coi
            JOIN customer_orders co ON co.id = coi.order_id
            JOIN products p ON p.id = coi.product_id
            WHERE co.status NOT IN ('cancelled')
            {where_sql}
            GROUP BY p.id, p.name_ar, p.name_en, p.sku
            ORDER BY total_revenue DESC
            LIMIT :limit
        """),
        params
    )
    
    rows = []
    for row in result.mappings().all():
        rows.append({
            "product_id": row["id"],
            "name_ar": row["name_ar"],
            "name_en": row["name_en"],
            "sku": row["sku"],
            "total_quantity_sold": float(row["total_quantity_sold"] or 0),
            "total_revenue": float(row["total_revenue"] or 0)
        })
    
    return rows
