import json
from datetime import date, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    get_user_factory_scope_id,
    is_factory_scoped_user,
    require_it_view,
)
from src.core.db.session import get_db
from src.models.user import User

router = APIRouter(prefix="/admin/audit", tags=["admin-audit"])


def _safe_int(value, default=0):
    try:
        return int(value or 0)
    except Exception:
        return default


def _safe_float(value, default=0.0):
    try:
        return float(value or 0)
    except Exception:
        return default


def _scoped_factory_id_or_none(current_user: User):
    if getattr(current_user, "is_superuser", False):
        return None
    return get_user_factory_scope_id(current_user)


async def ensure_audit_tables(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS audit_logs (
                id SERIAL PRIMARY KEY,
                factory_id INTEGER NULL REFERENCES factories(id) ON DELETE SET NULL,
                actor_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                module VARCHAR(100) NOT NULL,
                entity_type VARCHAR(100) NOT NULL,
                entity_id INTEGER NULL,
                action VARCHAR(100) NOT NULL,
                status VARCHAR(50) NOT NULL DEFAULT 'success',
                title VARCHAR(255) NULL,
                description TEXT NULL,
                reference_type VARCHAR(100) NULL,
                reference_id INTEGER NULL,
                metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_factory_id ON audit_logs(factory_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_actor_user_id ON audit_logs(actor_user_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_module ON audit_logs(module)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_entity_type_id ON audit_logs(entity_type, entity_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_reference_type_id ON audit_logs(reference_type, reference_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_audit_logs_created_at ON audit_logs(created_at DESC)"))
    await db.commit()




def _json_safe(value):
    if value is None:
        return None
    if isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, dict):
        return {str(k): _json_safe(v) for k, v in value.items()}
    if isinstance(value, (list, tuple, set)):
        return [_json_safe(v) for v in value]
    if isinstance(value, (date, datetime)):
        return value.isoformat()
    return str(value)


async def log_audit_event(
    db: AsyncSession,
    *,
    current_user: User | None,
    module: str,
    entity_type: str,
    action: str,
    entity_id: int | None = None,
    factory_id: int | None = None,
    status: str = "success",
    title: str | None = None,
    description: str | None = None,
    reference_type: str | None = None,
    reference_id: int | None = None,
    metadata: dict | None = None,
):
    await ensure_audit_tables(db)
    await db.execute(
        text(
            """
            INSERT INTO audit_logs (
                factory_id,
                actor_user_id,
                module,
                entity_type,
                entity_id,
                action,
                status,
                title,
                description,
                reference_type,
                reference_id,
                metadata_json
            )
            VALUES (
                :factory_id,
                :actor_user_id,
                :module,
                :entity_type,
                :entity_id,
                :action,
                :status,
                :title,
                :description,
                :reference_type,
                :reference_id,
                CAST(:metadata_json AS JSONB)
            )
            """
        ),
        {
            "factory_id": factory_id,
            "actor_user_id": getattr(current_user, "id", None) if current_user else None,
            "module": module,
            "entity_type": entity_type,
            "entity_id": entity_id,
            "action": action,
            "status": status,
            "title": title,
            "description": description,
            "reference_type": reference_type,
            "reference_id": reference_id,
            "metadata_json": json.dumps(_json_safe(metadata or {}), ensure_ascii=False),
        },
    )


async def _seed_audit_logs_from_existing_state(db: AsyncSession):
    checks = [
        ("purchase_order", "purchase_order_seed"),
        ("supplier_invoice", "supplier_invoice_seed"),
        ("inventory_movement", "inventory_movement_seed"),
        ("sales_invoice", "sales_invoice_seed"),
        ("sales_quotation", "sales_quotation_seed"),
        ("delivery_note", "delivery_note_seed"),
    ]

    for entity_type, action_name in checks:
        exists = await db.execute(
            text(
                """
                SELECT 1
                FROM audit_logs
                WHERE entity_type = :entity_type
                  AND action = :action
                LIMIT 1
                """
            ),
            {"entity_type": entity_type, "action": action_name},
        )
        if exists.first():
            continue

        if entity_type == "purchase_order":
            await db.execute(
                text(
                    """
                    INSERT INTO audit_logs (
                        factory_id, actor_user_id, module, entity_type, entity_id, action, status,
                        title, description, reference_type, reference_id, metadata_json, created_at
                    )
                    SELECT
                        po.factory_id,
                        COALESCE(po.approved_by_user_id, po.created_by_user_id),
                        'procurement',
                        'purchase_order',
                        po.id,
                        :action,
                        'success',
                        'تهيئة سجل أمر شراء',
                        CONCAT('PO ', po.po_number, ' بالحالة ', COALESCE(po.status, '-')),
                        'purchase_order',
                        po.id,
                        jsonb_build_object(
                            'po_number', po.po_number,
                            'status', po.status,
                            'created_by_user_id', po.created_by_user_id,
                            'approved_by_user_id', po.approved_by_user_id
                        ),
                        COALESCE(po.approved_at, po.created_at)
                    FROM purchase_orders po
                    """
                ),
                {"action": action_name},
            )

        if entity_type == "supplier_invoice":
            await db.execute(
                text(
                    """
                    INSERT INTO audit_logs (
                        factory_id, actor_user_id, module, entity_type, entity_id, action, status,
                        title, description, reference_type, reference_id, metadata_json, created_at
                    )
                    SELECT
                        si.factory_id,
                        si.created_by_user_id,
                        'procurement',
                        'supplier_invoice',
                        si.id,
                        :action,
                        'success',
                        'تهيئة سجل فاتورة مورد',
                        CONCAT('Invoice ', si.invoice_number, ' بالحالة ', COALESCE(si.status, '-')),
                        'supplier_invoice',
                        si.id,
                        jsonb_build_object(
                            'invoice_number', si.invoice_number,
                            'status', si.status,
                            'paid_amount', si.paid_amount,
                            'remaining_amount', si.remaining_amount,
                            'purchase_order_id', si.purchase_order_id
                        ),
                        si.created_at
                    FROM supplier_invoices si
                    """
                ),
                {"action": action_name},
            )

        if entity_type == "inventory_movement":
            await db.execute(
                text(
                    """
                    INSERT INTO audit_logs (
                        factory_id, actor_user_id, module, entity_type, entity_id, action, status,
                        title, description, reference_type, reference_id, metadata_json, created_at
                    )
                    SELECT
                        im.factory_id,
                        im.created_by_user_id,
                        'inventory',
                        'inventory_movement',
                        im.id,
                        :action,
                        'success',
                        'تهيئة سجل حركة مخزون',
                        CONCAT('Movement ', COALESCE(im.movement_type, '-'), ' quantity ', COALESCE(im.quantity::text, '0')),
                        COALESCE(im.reference_type, 'inventory_movement'),
                        COALESCE(im.reference_id, im.id),
                        jsonb_build_object(
                            'movement_type', im.movement_type,
                            'quantity', im.quantity,
                            'warehouse_id', im.warehouse_id,
                            'product_id', im.product_id,
                            'reference_type', im.reference_type,
                            'reference_id', im.reference_id
                        ),
                        im.created_at
                    FROM inventory_movements im
                    """
                ),
                {"action": action_name},
            )

        if entity_type == "sales_invoice":
            await db.execute(
                text(
                    """
                    INSERT INTO audit_logs (
                        factory_id, actor_user_id, module, entity_type, entity_id, action, status,
                        title, description, reference_type, reference_id, metadata_json, created_at
                    )
                    SELECT
                        si.factory_id,
                        NULL,
                        'sales',
                        'sales_invoice',
                        si.id,
                        :action,
                        'success',
                        'تهيئة سجل فاتورة مبيعات',
                        CONCAT('Sales invoice ', si.invoice_number, ' بالحالة ', COALESCE(si.status, '-')),
                        'sales_invoice',
                        si.id,
                        jsonb_build_object(
                            'invoice_number', si.invoice_number,
                            'status', si.status,
                            'payment_status', si.payment_status,
                            'order_id', si.order_id
                        ),
                        si.created_at
                    FROM sales_invoices si
                    """
                ),
                {"action": action_name},
            )

        if entity_type == "sales_quotation":
            await db.execute(
                text(
                    """
                    INSERT INTO audit_logs (
                        factory_id, actor_user_id, module, entity_type, entity_id, action, status,
                        title, description, reference_type, reference_id, metadata_json, created_at
                    )
                    SELECT
                        sq.factory_id,
                        NULL,
                        'sales',
                        'sales_quotation',
                        sq.id,
                        :action,
                        'success',
                        'تهيئة سجل عرض سعر',
                        CONCAT('Quotation ', sq.quotation_number, ' بالحالة ', COALESCE(sq.status, '-')),
                        'sales_quotation',
                        sq.id,
                        jsonb_build_object(
                            'quotation_number', sq.quotation_number,
                            'status', sq.status,
                            'converted_order_id', sq.converted_order_id
                        ),
                        sq.created_at
                    FROM sales_quotations sq
                    """
                ),
                {"action": action_name},
            )

        if entity_type == "delivery_note":
            await db.execute(
                text(
                    """
                    INSERT INTO audit_logs (
                        factory_id, actor_user_id, module, entity_type, entity_id, action, status,
                        title, description, reference_type, reference_id, metadata_json, created_at
                    )
                    SELECT
                        dn.factory_id,
                        COALESCE(dn.delivered_by_user_id, dn.dispatched_by_user_id),
                        'orders',
                        'delivery_note',
                        dn.id,
                        :action,
                        'success',
                        'تهيئة سجل إذن تسليم',
                        CONCAT('Delivery ', dn.delivery_number, ' بالحالة ', COALESCE(dn.status, '-')),
                        'delivery_note',
                        dn.id,
                        jsonb_build_object(
                            'delivery_number', dn.delivery_number,
                            'status', dn.status,
                            'order_id', dn.order_id,
                            'dispatched_by_user_id', dn.dispatched_by_user_id,
                            'delivered_by_user_id', dn.delivered_by_user_id
                        ),
                        COALESCE(dn.delivered_at, dn.dispatched_at, dn.created_at)
                    FROM delivery_notes dn
                    """
                ),
                {"action": action_name},
            )

    await db.commit()


@router.get("/summary")
async def get_audit_summary(
    current_user: User = Depends(require_it_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_audit_tables(db)
    await _seed_audit_logs_from_existing_state(db)

    params = {}
    where_sql = ""
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    if scoped_factory_id is not None:
        params["factory_id"] = scoped_factory_id
        where_sql = " WHERE factory_id = :factory_id "

    audit_logs_count = _safe_int((await db.execute(text(f"SELECT COUNT(*) FROM audit_logs {where_sql}"), params)).scalar())
    actors_count = _safe_int((await db.execute(text(f"SELECT COUNT(DISTINCT actor_user_id) FROM audit_logs {where_sql}"), params)).scalar())
    open_supplier_payables = _safe_float((await db.execute(text(f"SELECT COALESCE(SUM(remaining_amount), 0) FROM supplier_invoices {where_sql}"), params)).scalar())
    po_approved_count = _safe_int((await db.execute(text(f"SELECT COUNT(*) FROM purchase_orders {where_sql + (' AND ' if where_sql else ' WHERE ')} approved_by_user_id IS NOT NULL"), params)).scalar())
    inventory_with_actor = _safe_int((await db.execute(text(f"SELECT COUNT(*) FROM inventory_movements {where_sql + (' AND ' if where_sql else ' WHERE ')} created_by_user_id IS NOT NULL"), params)).scalar())
    delivery_with_actor = _safe_int((await db.execute(text(f"SELECT COUNT(*) FROM delivery_notes {where_sql + (' AND ' if where_sql else ' WHERE ')} (dispatched_by_user_id IS NOT NULL OR delivered_by_user_id IS NOT NULL)"), params)).scalar())

    return {
        "summary": {
            "audit_logs_count": audit_logs_count,
            "actors_count": actors_count,
            "open_supplier_payables": open_supplier_payables,
            "po_approved_count": po_approved_count,
            "inventory_with_actor": inventory_with_actor,
            "delivery_with_actor": delivery_with_actor,
        }
    }


@router.get("/recent")
async def list_recent_audit_events(
    current_user: User = Depends(require_it_view),
    db: AsyncSession = Depends(get_db),
    limit: int = Query(default=60, ge=1, le=200),
):
    await ensure_audit_tables(db)
    await _seed_audit_logs_from_existing_state(db)

    params = {"limit": limit}
    where_sql = ""
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    if scoped_factory_id is not None:
        params["factory_id"] = scoped_factory_id
        where_sql = " WHERE al.factory_id = :factory_id "

    result = await db.execute(
        text(
            f"""
            SELECT
                al.id,
                al.factory_id,
                f.name AS factory_name,
                al.actor_user_id,
                u.full_name AS actor_name,
                al.module,
                al.entity_type,
                al.entity_id,
                al.action,
                al.status,
                al.title,
                al.description,
                al.reference_type,
                al.reference_id,
                al.metadata_json,
                al.created_at
            FROM audit_logs al
            LEFT JOIN factories f ON f.id = al.factory_id
            LEFT JOIN users u ON u.id = al.actor_user_id
            {where_sql}
            ORDER BY al.created_at DESC, al.id DESC
            LIMIT :limit
            """
        ),
        params,
    )
    return [dict(row) for row in result.mappings().all()]


@router.get("/entity-history")
async def get_entity_history(
    entity_type: str,
    entity_id: int,
    current_user: User = Depends(require_it_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_audit_tables(db)
    await _seed_audit_logs_from_existing_state(db)

    entity_type = str(entity_type or "").strip().lower()
    if not entity_type:
        raise HTTPException(status_code=400, detail="entity_type is required")
    if entity_id <= 0:
        raise HTTPException(status_code=400, detail="entity_id must be greater than zero")

    params = {"entity_type": entity_type, "entity_id": entity_id}
    scope_sql = ""
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    if scoped_factory_id is not None:
        params["factory_id"] = scoped_factory_id
        scope_sql = " AND al.factory_id = :factory_id "

    result = await db.execute(
        text(
            f"""
            SELECT
                al.id,
                al.factory_id,
                f.name AS factory_name,
                al.actor_user_id,
                u.full_name AS actor_name,
                al.module,
                al.entity_type,
                al.entity_id,
                al.action,
                al.status,
                al.title,
                al.description,
                al.reference_type,
                al.reference_id,
                al.metadata_json,
                al.created_at
            FROM audit_logs al
            LEFT JOIN factories f ON f.id = al.factory_id
            LEFT JOIN users u ON u.id = al.actor_user_id
            WHERE al.entity_type = :entity_type
              AND al.entity_id = :entity_id
              {scope_sql}
            ORDER BY al.created_at DESC, al.id DESC
            """
        ),
        params,
    )
    rows = [dict(row) for row in result.mappings().all()]
    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "history": rows,
        "count": len(rows),
    }


@router.get("/surfaces")
async def get_history_surfaces(
    current_user: User = Depends(require_it_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_audit_tables(db)
    await _seed_audit_logs_from_existing_state(db)

    params = {}
    po_scope = ""
    inv_scope = ""
    q_scope = ""
    so_scope = ""
    si_scope = ""
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    if scoped_factory_id is not None:
        params["factory_id"] = scoped_factory_id
        po_scope = " WHERE po.factory_id = :factory_id "
        inv_scope = " WHERE im.factory_id = :factory_id "
        q_scope = " WHERE sq.factory_id = :factory_id "
        so_scope = " WHERE co.factory_id = :factory_id "
        si_scope = " WHERE si.factory_id = :factory_id "

    purchase_orders = await db.execute(
        text(
            f"""
            SELECT
                po.id,
                po.po_number,
                po.factory_id,
                f.name AS factory_name,
                s.name AS supplier_name,
                po.status,
                po.created_by_user_id,
                cu.full_name AS created_by_name,
                po.approved_by_user_id,
                au.full_name AS approved_by_name,
                po.approved_at,
                po.created_at
            FROM purchase_orders po
            LEFT JOIN factories f ON f.id = po.factory_id
            LEFT JOIN suppliers s ON s.id = po.supplier_id
            LEFT JOIN users cu ON cu.id = po.created_by_user_id
            LEFT JOIN users au ON au.id = po.approved_by_user_id
            {po_scope}
            ORDER BY po.id DESC
            LIMIT 20
            """
        ),
        params,
    )

    inventory_movements = await db.execute(
        text(
            f"""
            SELECT
                im.id,
                im.factory_id,
                f.name AS factory_name,
                im.warehouse_id,
                w.name AS warehouse_name,
                im.product_id,
                p.name_ar AS product_name,
                p.sku AS product_sku,
                im.movement_type,
                im.quantity,
                im.reference_type,
                im.reference_id,
                im.created_by_user_id,
                u.full_name AS created_by_name,
                im.created_at
            FROM inventory_movements im
            LEFT JOIN factories f ON f.id = im.factory_id
            LEFT JOIN warehouses w ON w.id = im.warehouse_id
            LEFT JOIN products p ON p.id = im.product_id
            LEFT JOIN users u ON u.id = im.created_by_user_id
            {inv_scope}
            ORDER BY im.id DESC
            LIMIT 20
            """
        ),
        params,
    )

    quotations = await db.execute(
        text(
            f"""
            SELECT
                sq.id,
                sq.quotation_number,
                sq.factory_id,
                f.name AS factory_name,
                sq.status,
                sq.customer_name,
                sq.converted_order_id,
                sq.converted_at,
                sq.created_at
            FROM sales_quotations sq
            LEFT JOIN factories f ON f.id = sq.factory_id
            {q_scope}
            ORDER BY sq.id DESC
            LIMIT 20
            """
        ),
        params,
    )

    orders = await db.execute(
        text(
            f"""
            SELECT
                co.id,
                co.order_number,
                co.factory_id,
                f.name AS factory_name,
                co.status,
                co.payment_status,
                dn.delivery_number,
                dn.dispatched_by_user_id,
                du.full_name AS dispatched_by_name,
                dn.delivered_by_user_id,
                lu.full_name AS delivered_by_name,
                co.created_at
            FROM customer_orders co
            LEFT JOIN factories f ON f.id = co.factory_id
            LEFT JOIN delivery_notes dn ON dn.order_id = co.id
            LEFT JOIN users du ON du.id = dn.dispatched_by_user_id
            LEFT JOIN users lu ON lu.id = dn.delivered_by_user_id
            {so_scope}
            ORDER BY co.id DESC
            LIMIT 20
            """
        ),
        params,
    )

    sales_invoices = await db.execute(
        text(
            f"""
            SELECT
                si.id,
                si.invoice_number,
                si.factory_id,
                f.name AS factory_name,
                si.status,
                si.payment_status,
                si.total_amount,
                si.paid_amount,
                si.remaining_amount,
                si.created_at
            FROM sales_invoices si
            LEFT JOIN factories f ON f.id = si.factory_id
            {si_scope}
            ORDER BY si.id DESC
            LIMIT 20
            """
        ),
        params,
    )

    return {
        "purchase_orders": [dict(row) for row in purchase_orders.mappings().all()],
        "inventory_movements": [dict(row) for row in inventory_movements.mappings().all()],
        "sales_quotations": [dict(row) for row in quotations.mappings().all()],
        "orders": [dict(row) for row in orders.mappings().all()],
        "sales_invoices": [dict(row) for row in sales_invoices.mappings().all()],
    }
