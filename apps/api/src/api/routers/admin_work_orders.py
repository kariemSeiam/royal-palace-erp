from collections import defaultdict

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    get_user_factory_scope_id,
    is_factory_scoped_user,
    require_orders_view,
    require_orders_manage,
    enforce_factory_scope,
)
from src.core.db.session import get_db
from src.models.user import User

router = APIRouter(prefix="/admin/work-orders", tags=["admin-work-orders"])

ALLOWED_WORK_ORDER_STATUSES = {
    "pending",
    "materials_allocated",
    "manufacturing_started",
    "assembly",
    "quality_control",
    "packaging",
    "completed",
    "cancelled",
}

WORK_ORDER_STATUS_TRANSITIONS = {
    "pending": {"materials_allocated", "cancelled"},
    "materials_allocated": {"manufacturing_started", "cancelled"},
    "manufacturing_started": {"assembly", "cancelled"},
    "assembly": {"quality_control", "cancelled"},
    "quality_control": {"packaging", "cancelled"},
    "packaging": {"completed", "cancelled"},
    "completed": set(),
    "cancelled": set(),
}

ORDER_STATUS_SYNC_MAP = {
    "materials_allocated": "materials_allocated",
    "manufacturing_started": "manufacturing_started",
    "assembly": "assembly",
    "quality_control": "quality_control",
    "packaging": "packaging",
    "completed": "packaging",
    "cancelled": "cancelled",
}

ALLOWED_WORK_ORDER_PRIORITIES = {"low", "normal", "high", "urgent"}


async def ensure_work_orders_schema(db: AsyncSession):
    await db.execute(
        text(
            """
            ALTER TABLE work_orders
            ADD COLUMN IF NOT EXISTS assigned_employee_id INTEGER NULL REFERENCES employees(id) ON DELETE SET NULL
            """
        )
    )
    await db.execute(
        text(
            """
            ALTER TABLE work_orders
            ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'normal'
            """
        )
    )
    await db.execute(
        text(
            """
            ALTER TABLE work_orders
            ADD COLUMN IF NOT EXISTS due_date TIMESTAMPTZ NULL
            """
        )
    )
    await db.execute(
        text(
            """
            ALTER TABLE work_orders
            ADD COLUMN IF NOT EXISTS planned_start_at TIMESTAMPTZ NULL
            """
        )
    )
    await db.execute(
        text(
            """
            ALTER TABLE work_orders
            ADD COLUMN IF NOT EXISTS planned_end_at TIMESTAMPTZ NULL
            """
        )
    )
    await db.execute(
        text(
            """
            ALTER TABLE work_orders
            ADD COLUMN IF NOT EXISTS progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0
            """
        )
    )
    await db.execute(
        text(
            """
            ALTER TABLE work_orders
            ADD COLUMN IF NOT EXISTS actual_minutes NUMERIC(12,2) NOT NULL DEFAULT 0
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_work_orders_assigned_employee_id
            ON work_orders(assigned_employee_id)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_work_orders_priority
            ON work_orders(priority)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_work_orders_due_date
            ON work_orders(due_date)
            """
        )
    )
    await db.commit()


async def ensure_material_allocations_table(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS work_order_material_allocations (
                id SERIAL PRIMARY KEY,
                work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
                order_item_id INTEGER NOT NULL REFERENCES customer_order_items(id) ON DELETE CASCADE,
                warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE RESTRICT,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
                allocated_quantity NUMERIC(14, 2) NOT NULL DEFAULT 0,
                notes TEXT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE UNIQUE INDEX IF NOT EXISTS uq_work_order_material_allocations_work_order_item
            ON work_order_material_allocations(work_order_id, order_item_id)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_work_order_material_allocations_work_order_id
            ON work_order_material_allocations(work_order_id)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_work_order_material_allocations_warehouse_id
            ON work_order_material_allocations(warehouse_id)
            """
        )
    )
    await db.commit()


async def ensure_work_order_events_table(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS work_order_events (
                id SERIAL PRIMARY KEY,
                work_order_id INTEGER NOT NULL REFERENCES work_orders(id) ON DELETE CASCADE,
                event_type VARCHAR(100) NOT NULL,
                from_status VARCHAR(50) NULL,
                to_status VARCHAR(50) NULL,
                actor_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
                actor_name VARCHAR(255) NULL,
                assigned_employee_id INTEGER NULL REFERENCES employees(id) ON DELETE SET NULL,
                assigned_employee_name VARCHAR(255) NULL,
                notes TEXT NULL,
                meta_json TEXT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
    )
    await db.execute(
        text(
            """
            ALTER TABLE work_order_events
            ADD COLUMN IF NOT EXISTS assigned_employee_id INTEGER NULL REFERENCES employees(id) ON DELETE SET NULL
            """
        )
    )
    await db.execute(
        text(
            """
            ALTER TABLE work_order_events
            ADD COLUMN IF NOT EXISTS assigned_employee_name VARCHAR(255) NULL
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_work_order_events_work_order_id
            ON work_order_events(work_order_id)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_work_order_events_assigned_employee_id
            ON work_order_events(assigned_employee_id)
            """
        )
    )
    await db.commit()


def serialize_employee_option(row):
    data = dict(row)
    full_name = f"{data.get('first_name') or ''} {data.get('last_name') or ''}".strip()
    if not full_name:
        full_name = f"Employee #{data.get('id')}"
    return {
        "id": data.get("id"),
        "factory_id": data.get("factory_id"),
        "department_id": data.get("department_id"),
        "first_name": data.get("first_name"),
        "last_name": data.get("last_name"),
        "full_name": full_name,
        "job_title": data.get("job_title"),
        "employee_code": data.get("employee_code"),
        "is_active": bool(data.get("is_active")),
    }


async def resolve_employee_for_factory(
    db: AsyncSession,
    employee_id: int | None,
    factory_id: int,
):
    if employee_id is None:
        return None

    result = await db.execute(
        text(
            """
            SELECT
                id,
                factory_id,
                department_id,
                employee_code,
                first_name,
                last_name,
                job_title,
                is_active
            FROM employees
            WHERE id = :employee_id
            LIMIT 1
            """
        ),
        {"employee_id": employee_id},
    )
    row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Assigned employee not found")

    if int(row["factory_id"]) != int(factory_id):
        raise HTTPException(status_code=409, detail="Assigned employee belongs to another factory")

    if not bool(row["is_active"]):
        raise HTTPException(status_code=409, detail="Assigned employee is inactive")

    full_name = f"{row.get('first_name') or ''} {row.get('last_name') or ''}".strip()
    if not full_name:
        full_name = f"Employee #{row['id']}"

    return {
        "id": int(row["id"]),
        "full_name": full_name,
        "job_title": row.get("job_title"),
    }


def _normalize_priority(value: str | None) -> str:
    normalized = str(value or "normal").strip().lower()
    if normalized not in ALLOWED_WORK_ORDER_PRIORITIES:
        raise HTTPException(status_code=400, detail="Invalid work order priority")
    return normalized


def _normalize_optional_datetime(value, field_name: str):
    if value in [None, ""]:
        return None
    value = str(value).strip()
    return value or None


def _normalize_progress(value):
    if value in [None, ""]:
        return None
    try:
        numeric = float(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid progress_percent")
    if numeric < 0 or numeric > 100:
        raise HTTPException(status_code=400, detail="progress_percent must be between 0 and 100")
    return numeric


def _normalize_non_negative_number(value, field_name: str):
    if value in [None, ""]:
        return None
    try:
        numeric = float(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")
    if numeric < 0:
        raise HTTPException(status_code=400, detail=f"{field_name} cannot be negative")
    return numeric


async def create_work_order_event(
    db: AsyncSession,
    work_order_id: int,
    event_type: str,
    actor: User | None,
    from_status: str | None = None,
    to_status: str | None = None,
    notes: str | None = None,
    meta_json: str | None = None,
    assigned_employee_id: int | None = None,
    assigned_employee_name: str | None = None,
):
    await db.execute(
        text(
            """
            INSERT INTO work_order_events (
                work_order_id,
                event_type,
                from_status,
                to_status,
                actor_user_id,
                actor_name,
                assigned_employee_id,
                assigned_employee_name,
                notes,
                meta_json
            )
            VALUES (
                :work_order_id,
                :event_type,
                :from_status,
                :to_status,
                :actor_user_id,
                :actor_name,
                :assigned_employee_id,
                :assigned_employee_name,
                :notes,
                :meta_json
            )
            """
        ),
        {
            "work_order_id": work_order_id,
            "event_type": event_type,
            "from_status": from_status,
            "to_status": to_status,
            "actor_user_id": getattr(actor, "id", None),
            "actor_name": getattr(actor, "full_name", None),
            "assigned_employee_id": assigned_employee_id,
            "assigned_employee_name": assigned_employee_name,
            "notes": notes,
            "meta_json": meta_json,
        },
    )


async def fetch_work_order_events(db: AsyncSession, work_order_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                id,
                work_order_id,
                event_type,
                from_status,
                to_status,
                actor_user_id,
                actor_name,
                assigned_employee_id,
                assigned_employee_name,
                notes,
                meta_json,
                created_at
            FROM work_order_events
            WHERE work_order_id = :work_order_id
            ORDER BY id DESC
            """
        ),
        {"work_order_id": work_order_id},
    )

    return [dict(row) for row in result.mappings().all()]


def product_industrial_messages(item: dict) -> list[str]:
    messages = []

    if not item.get("product_family"):
        messages.append("العائلة الصناعية غير محددة")
    if not item.get("product_type"):
        messages.append("نوع المنتج غير محدد")
    if not item.get("production_mode"):
        messages.append("نمط الإنتاج غير محدد")
    if int(item.get("bom_items_count") or 0) <= 0:
        messages.append("لا يوجد BOM للمنتج")
    if int(item.get("routing_steps_count") or 0) <= 0:
        messages.append("لا توجد خطوات تشغيل للمنتج")

    return messages


def _schedule_health(data: dict) -> str:
    status = str(data.get("status") or "")
    due_date = data.get("due_date")
    planned_end_at = data.get("planned_end_at")
    progress_percent = float(data.get("progress_percent") or 0)

    if status in {"completed", "cancelled"}:
        return "closed"

    if due_date and planned_end_at and str(planned_end_at) > str(due_date):
        return "at_risk"

    if due_date and progress_percent < 100:
        return "scheduled"

    return "open"


def serialize_work_order(
    row,
    items: list[dict] | None = None,
    allocations: list[dict] | None = None,
    events: list[dict] | None = None,
):
    data = dict(row)
    safe_items = items or []
    safe_allocations = allocations or []
    safe_events = events or []

    industrial_ready_items = sum(1 for item in safe_items if item.get("industrial_ready"))
    shortage_items = sum(1 for item in safe_items if bool(item.get("has_shortage")))
    ready_for_production_items = sum(1 for item in safe_items if bool(item.get("ready_for_production")))

    return {
        "id": data.get("id"),
        "order_id": data.get("order_id"),
        "order_number": data.get("order_number"),
        "factory_id": data.get("factory_id"),
        "factory_name": data.get("factory_name"),
        "order_status": data.get("order_status"),
        "payment_status": data.get("payment_status"),
        "customer_name": data.get("customer_name"),
        "customer_phone": data.get("customer_phone"),
        "shipping_address": data.get("shipping_address"),
        "warehouse_id": data.get("warehouse_id"),
        "warehouse_name": data.get("warehouse_name"),
        "warehouse_code": data.get("warehouse_code"),
        "status": data.get("status"),
        "priority": data.get("priority") or "normal",
        "due_date": data.get("due_date"),
        "planned_start_at": data.get("planned_start_at"),
        "planned_end_at": data.get("planned_end_at"),
        "progress_percent": float(data.get("progress_percent") or 0),
        "actual_minutes": float(data.get("actual_minutes") or 0),
        "schedule_health": _schedule_health(data),
        "notes": data.get("notes"),
        "assigned_employee_id": data.get("assigned_employee_id"),
        "assigned_employee_name": data.get("assigned_employee_name"),
        "assigned_employee_job_title": data.get("assigned_employee_job_title"),
        "created_at": data.get("created_at"),
        "updated_at": data.get("updated_at"),
        "items": safe_items,
        "items_count": len(safe_items),
        "items_quantity_total": sum(float(item.get("quantity") or 0) for item in safe_items),
        "industrial_ready_items_count": industrial_ready_items,
        "industrial_missing_items_count": max(len(safe_items) - industrial_ready_items, 0),
        "ready_for_production_items_count": ready_for_production_items,
        "shortage_items_count": shortage_items,
        "industrial_ready": bool(safe_items) and industrial_ready_items == len(safe_items),
        "ready_for_production": bool(safe_items) and ready_for_production_items == len(safe_items),
        "has_shortage": shortage_items > 0,
        "allocations": safe_allocations,
        "allocations_count": len(safe_allocations),
        "allocated_quantity_total": sum(float(item.get("allocated_quantity") or 0) for item in safe_allocations),
        "allocation_complete": bool(safe_items) and all(bool(item.get("allocation_complete")) for item in safe_items),
        "events": safe_events,
        "events_count": len(safe_events),
    }


async def fetch_bom_preview(db: AsyncSession, product_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                id,
                line_no,
                material_name,
                material_code,
                material_type,
                quantity,
                unit,
                waste_percent,
                notes,
                is_active
            FROM product_bom_items
            WHERE product_id = :product_id
            ORDER BY line_no ASC, id ASC
            LIMIT 20
            """
        ),
        {"product_id": product_id},
    )
    rows = []
    for row in result.mappings().all():
        data = dict(row)
        rows.append(
            {
                "id": data.get("id"),
                "line_no": data.get("line_no"),
                "material_name": data.get("material_name"),
                "material_code": data.get("material_code"),
                "material_type": data.get("material_type"),
                "quantity": float(data.get("quantity") or 0),
                "unit": data.get("unit"),
                "waste_percent": float(data.get("waste_percent") or 0) if data.get("waste_percent") is not None else None,
                "notes": data.get("notes"),
                "is_active": bool(data.get("is_active")) if data.get("is_active") is not None else True,
            }
        )
    return rows


async def fetch_routing_preview(db: AsyncSession, product_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                id,
                step_no,
                step_code,
                step_name,
                work_center,
                standard_minutes,
                notes,
                is_outsourced,
                is_active
            FROM product_routing_steps
            WHERE product_id = :product_id
            ORDER BY step_no ASC, id ASC
            LIMIT 30
            """
        ),
        {"product_id": product_id},
    )
    rows = []
    for row in result.mappings().all():
        data = dict(row)
        rows.append(
            {
                "id": data.get("id"),
                "step_no": data.get("step_no"),
                "step_code": data.get("step_code"),
                "step_name": data.get("step_name"),
                "work_center": data.get("work_center"),
                "standard_minutes": float(data.get("standard_minutes") or 0) if data.get("standard_minutes") is not None else None,
                "notes": data.get("notes"),
                "is_outsourced": bool(data.get("is_outsourced")) if data.get("is_outsourced") is not None else False,
                "is_active": bool(data.get("is_active")) if data.get("is_active") is not None else True,
            }
        )
    return rows


async def fetch_stock_summary_map(db: AsyncSession, warehouse_id: int | None):
    if not warehouse_id:
        return {}

    result = await db.execute(
        text(
            """
            SELECT
                product_id,
                COALESCE(SUM(
                    CASE
                        WHEN movement_type = 'in' THEN quantity
                        WHEN movement_type = 'adjustment' THEN quantity
                        WHEN movement_type = 'out' THEN -quantity
                        ELSE 0
                    END
                ), 0) AS current_stock
            FROM inventory_movements
            WHERE warehouse_id = :warehouse_id
            GROUP BY product_id
            """
        ),
        {"warehouse_id": warehouse_id},
    )

    mapping = {}
    for row in result.mappings().all():
        mapping[int(row["product_id"])] = float(row["current_stock"] or 0)
    return mapping


async def fetch_work_order_items(
    db: AsyncSession,
    order_id: int,
    work_order_id: int | None = None,
    warehouse_id: int | None = None,
):
    allocation_map = {}
    if work_order_id is not None:
        allocation_result = await db.execute(
            text(
                """
                SELECT
                    order_item_id,
                    COALESCE(SUM(allocated_quantity), 0) AS allocated_quantity_total
                FROM work_order_material_allocations
                WHERE work_order_id = :work_order_id
                GROUP BY order_item_id
                """
            ),
            {"work_order_id": work_order_id},
        )
        for row in allocation_result.mappings().all():
            allocation_map[int(row["order_item_id"])] = float(row["allocated_quantity_total"] or 0)

    stock_map = await fetch_stock_summary_map(db, warehouse_id)

    result = await db.execute(
        text(
            """
            SELECT
                coi.id,
                coi.order_id,
                coi.product_id,
                coi.quantity,
                coi.unit_price,
                coi.line_total,
                p.name_ar,
                p.name_en,
                p.slug,
                p.sku,
                p.primary_image_url,
                p.product_family,
                p.product_type,
                p.production_mode,
                p.thickness_cm,
                p.width_cm,
                p.length_cm,
                p.foam_density,
                p.foam_density_unit,
                p.firmness_level,
                p.has_springs,
                p.spring_type,
                p.has_pillow_top,
                p.has_wood_frame,
                p.fabric_spec,
                p.requires_upholstery,
                p.requires_quilting,
                p.notes_internal,
                COALESCE((
                    SELECT COUNT(*)
                    FROM product_bom_items pbi
                    WHERE pbi.product_id = p.id
                ), 0) AS bom_items_count,
                COALESCE((
                    SELECT COUNT(*)
                    FROM product_routing_steps prs
                    WHERE prs.product_id = p.id
                ), 0) AS routing_steps_count
            FROM customer_order_items coi
            JOIN products p ON p.id = coi.product_id
            WHERE coi.order_id = :order_id
            ORDER BY coi.id ASC
            """
        ),
        {"order_id": order_id},
    )

    items = []
    for row in result.mappings().all():
        data = dict(row)
        ordered_qty = float(data.get("quantity") or 0)
        allocated_qty = float(allocation_map.get(int(data["id"]), 0) or 0)
        bom_items_count = int(data.get("bom_items_count") or 0)
        routing_steps_count = int(data.get("routing_steps_count") or 0)
        stock_available = float(stock_map.get(int(data["product_id"]), 0) or 0)

        bom_preview = await fetch_bom_preview(db, int(data["product_id"]))
        routing_preview = await fetch_routing_preview(db, int(data["product_id"]))

        item = {
            "id": data.get("id"),
            "order_id": data.get("order_id"),
            "product_id": data.get("product_id"),
            "name_ar": data.get("name_ar"),
            "name_en": data.get("name_en"),
            "slug": data.get("slug"),
            "sku": data.get("sku"),
            "primary_image_url": data.get("primary_image_url"),
            "quantity": ordered_qty,
            "unit_price": str(data.get("unit_price")) if data.get("unit_price") is not None else None,
            "line_total": str(data.get("line_total")) if data.get("line_total") is not None else None,
            "allocated_quantity": allocated_qty,
            "remaining_quantity": max(ordered_qty - allocated_qty, 0),
            "allocation_complete": allocated_qty >= ordered_qty and ordered_qty > 0,
            "product_family": data.get("product_family"),
            "product_type": data.get("product_type"),
            "production_mode": data.get("production_mode"),
            "thickness_cm": str(data.get("thickness_cm")) if data.get("thickness_cm") is not None else None,
            "width_cm": str(data.get("width_cm")) if data.get("width_cm") is not None else None,
            "length_cm": str(data.get("length_cm")) if data.get("length_cm") is not None else None,
            "foam_density": str(data.get("foam_density")) if data.get("foam_density") is not None else None,
            "foam_density_unit": data.get("foam_density_unit"),
            "firmness_level": data.get("firmness_level"),
            "has_springs": bool(data.get("has_springs")) if data.get("has_springs") is not None else False,
            "spring_type": data.get("spring_type"),
            "has_pillow_top": bool(data.get("has_pillow_top")) if data.get("has_pillow_top") is not None else False,
            "has_wood_frame": bool(data.get("has_wood_frame")) if data.get("has_wood_frame") is not None else False,
            "fabric_spec": data.get("fabric_spec"),
            "requires_upholstery": bool(data.get("requires_upholstery")) if data.get("requires_upholstery") is not None else False,
            "requires_quilting": bool(data.get("requires_quilting")) if data.get("requires_quilting") is not None else False,
            "notes_internal": data.get("notes_internal"),
            "bom_items_count": bom_items_count,
            "routing_steps_count": routing_steps_count,
            "bom_preview": bom_preview,
            "routing_steps_preview": routing_preview,
            "routing_minutes_total": sum(float(step.get("standard_minutes") or 0) for step in routing_preview),
            "work_centers": [step.get("work_center") for step in routing_preview if step.get("work_center")],
            "stock_available": stock_available,
            "has_shortage": stock_available < ordered_qty,
            "shortage_quantity": max(ordered_qty - stock_available, 0),
        }

        missing_messages = product_industrial_messages(item)
        item["industrial_messages"] = missing_messages
        item["industrial_ready"] = len(missing_messages) == 0
        item["ready_for_production"] = bool(item["industrial_ready"]) and not bool(item["has_shortage"])
        items.append(item)

    return items


async def fetch_work_order_allocations(db: AsyncSession, work_order_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                wa.id,
                wa.work_order_id,
                wa.order_item_id,
                wa.warehouse_id,
                wa.product_id,
                wa.allocated_quantity,
                wa.notes,
                wa.created_at,
                wa.updated_at,
                w.name AS warehouse_name,
                w.code AS warehouse_code,
                p.name_ar,
                p.name_en,
                p.slug,
                p.sku
            FROM work_order_material_allocations wa
            JOIN warehouses w ON w.id = wa.warehouse_id
            JOIN products p ON p.id = wa.product_id
            WHERE wa.work_order_id = :work_order_id
            ORDER BY wa.id ASC
            """
        ),
        {"work_order_id": work_order_id},
    )
    allocations = []
    for row in result.mappings().all():
        data = dict(row)
        allocations.append(
            {
                "id": data.get("id"),
                "work_order_id": data.get("work_order_id"),
                "order_item_id": data.get("order_item_id"),
                "warehouse_id": data.get("warehouse_id"),
                "warehouse_name": data.get("warehouse_name"),
                "warehouse_code": data.get("warehouse_code"),
                "product_id": data.get("product_id"),
                "name_ar": data.get("name_ar"),
                "name_en": data.get("name_en"),
                "slug": data.get("slug"),
                "sku": data.get("sku"),
                "allocated_quantity": float(data.get("allocated_quantity") or 0),
                "notes": data.get("notes"),
                "created_at": data.get("created_at"),
                "updated_at": data.get("updated_at"),
            }
        )
    return allocations


async def fetch_work_order_or_404(db: AsyncSession, work_order_id: int):
    result = await db.execute(
        text(
            """
            SELECT
                wo.*,
                co.order_number,
                co.status AS order_status,
                co.payment_status,
                co.customer_name,
                co.customer_phone,
                co.shipping_address,
                co.warehouse_id,
                f.name AS factory_name,
                w.name AS warehouse_name,
                w.code AS warehouse_code,
                e.first_name AS assigned_employee_first_name,
                e.last_name AS assigned_employee_last_name,
                e.job_title AS assigned_employee_job_title
            FROM work_orders wo
            JOIN customer_orders co ON co.id = wo.order_id
            LEFT JOIN factories f ON f.id = wo.factory_id
            LEFT JOIN warehouses w ON w.id = co.warehouse_id
            LEFT JOIN employees e ON e.id = wo.assigned_employee_id
            WHERE wo.id = :id
            LIMIT 1
            """
        ),
        {"id": work_order_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Work order not found")

    row_dict = dict(row)
    full_name = f"{row_dict.get('assigned_employee_first_name') or ''} {row_dict.get('assigned_employee_last_name') or ''}".strip()
    row_dict["assigned_employee_name"] = full_name or None
    return row_dict


async def ensure_work_order_delete_is_safe(
    db: AsyncSession,
    work_order_id: int,
    order_id: int,
):
    order_result = await db.execute(
        text(
            """
            SELECT status
            FROM customer_orders
            WHERE id = :order_id
            LIMIT 1
            """
        ),
        {"order_id": order_id},
    )
    order_row = order_result.mappings().first()

    if not order_row:
        raise HTTPException(status_code=404, detail="Linked order not found")

    if str(order_row.get("status") or "") == "delivery_dispatched":
        raise HTTPException(status_code=409, detail="Cannot delete work order after order dispatch")

    movement_result = await db.execute(
        text(
            """
            SELECT id
            FROM inventory_movements
            WHERE reference_type = 'order_dispatch'
              AND reference_id = :order_id
            LIMIT 1
            """
        ),
        {"order_id": order_id},
    )
    if movement_result.first():
        raise HTTPException(status_code=409, detail="Cannot delete work order after inventory dispatch movement exists")

    duplicate_result = await db.execute(
        text(
            """
            SELECT COUNT(*) AS total
            FROM work_orders
            WHERE order_id = :order_id
            """
        ),
        {"order_id": order_id},
    )
    duplicate_count = int(duplicate_result.mappings().first()["total"] or 0)
    if duplicate_count <= 1:
        raise HTTPException(status_code=409, detail="Cannot delete the only work order linked to this order")


async def sync_linked_order_status(
    db: AsyncSession,
    order_id: int,
    work_order_status: str,
):
    next_order_status = ORDER_STATUS_SYNC_MAP.get(work_order_status)
    if not next_order_status:
        return

    await db.execute(
        text(
            """
            UPDATE customer_orders
            SET
                status = :status,
                updated_at = NOW()
            WHERE id = :order_id
            """
        ),
        {
            "order_id": order_id,
            "status": next_order_status,
        },
    )


async def resolve_stock_available_for_allocation(
    db: AsyncSession,
    warehouse_id: int,
    product_id: int,
    current_work_order_id: int,
):
    stock_result = await db.execute(
        text(
            """
            SELECT COALESCE(SUM(
                CASE
                    WHEN movement_type = 'in' THEN quantity
                    WHEN movement_type = 'adjustment' THEN quantity
                    WHEN movement_type = 'out' THEN -quantity
                    ELSE 0
                END
            ), 0) AS current_stock
            FROM inventory_movements
            WHERE warehouse_id = :warehouse_id
              AND product_id = :product_id
            """
        ),
        {
            "warehouse_id": warehouse_id,
            "product_id": product_id,
        },
    )
    current_stock = float(stock_result.scalar() or 0)

    allocation_result = await db.execute(
        text(
            """
            SELECT COALESCE(SUM(allocated_quantity), 0) AS allocated_total
            FROM work_order_material_allocations
            WHERE warehouse_id = :warehouse_id
              AND product_id = :product_id
              AND work_order_id != :current_work_order_id
            """
        ),
        {
            "warehouse_id": warehouse_id,
            "product_id": product_id,
            "current_work_order_id": current_work_order_id,
        },
    )
    allocated_elsewhere = float(allocation_result.scalar() or 0)
    return current_stock - allocated_elsewhere


async def ensure_valid_target_warehouse(
    db: AsyncSession,
    warehouse_id: int,
    factory_id: int,
):
    result = await db.execute(
        text(
            """
            SELECT id, factory_id, is_active, name, code
            FROM warehouses
            WHERE id = :warehouse_id
            LIMIT 1
            """
        ),
        {"warehouse_id": warehouse_id},
    )
    row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="Warehouse not found")

    if int(row["factory_id"]) != int(factory_id):
        raise HTTPException(status_code=409, detail="Warehouse does not belong to this work order factory")

    if not bool(row["is_active"]):
        raise HTTPException(status_code=409, detail="Warehouse is inactive")

    return row


async def auto_sync_work_order_status_from_allocations(
    db: AsyncSession,
    work_order_id: int,
    actor: User | None = None,
):
    work_order = await fetch_work_order_or_404(db, work_order_id)
    items = await fetch_work_order_items(
        db,
        int(work_order["order_id"]),
        int(work_order_id),
        int(work_order.get("warehouse_id")) if work_order.get("warehouse_id") else None,
    )
    current_status = str(work_order.get("status") or "pending")

    has_items = len(items) > 0
    all_fully_allocated = has_items and all(bool(item.get("allocation_complete")) for item in items)

    next_status = None

    if all_fully_allocated:
        if current_status in {"pending", "materials_allocated"}:
            next_status = "materials_allocated"
    else:
        if current_status in {"pending", "materials_allocated"}:
            next_status = "pending"

    if next_status is None or next_status == current_status:
        return

    await db.execute(
        text(
            """
            UPDATE work_orders
            SET
                status = :status,
                updated_at = NOW()
            WHERE id = :work_order_id
            """
        ),
        {
            "work_order_id": work_order_id,
            "status": next_status,
        },
    )

    await sync_linked_order_status(
        db=db,
        order_id=int(work_order["order_id"]),
        work_order_status=next_status,
    )

    await create_work_order_event(
        db=db,
        work_order_id=work_order_id,
        event_type="auto_status_sync_from_allocation",
        actor=actor,
        from_status=current_status,
        to_status=next_status,
        notes="Automatic work order status sync after materials allocation check",
        assigned_employee_id=work_order.get("assigned_employee_id"),
        assigned_employee_name=work_order.get("assigned_employee_name"),
    )


async def ensure_valid_work_order_transition(
    db: AsyncSession,
    work_order_id: int,
    current_status: str,
    next_status: str,
    order_id: int,
    warehouse_id: int | None,
):
    if next_status == current_status:
        return

    if current_status == "cancelled":
        raise HTTPException(status_code=409, detail="Cancelled work order cannot be changed")

    if current_status == "completed":
        raise HTTPException(status_code=409, detail="Completed work order cannot be changed")

    allowed_next = WORK_ORDER_STATUS_TRANSITIONS.get(current_status, set())
    if next_status not in allowed_next:
        raise HTTPException(
            status_code=409,
            detail=f"Invalid work order status transition from {current_status} to {next_status}",
        )

    if next_status in {"manufacturing_started", "assembly", "quality_control", "packaging", "completed"}:
        items = await fetch_work_order_items(db, int(order_id), int(work_order_id), warehouse_id)
        if not items:
            raise HTTPException(status_code=409, detail="Work order has no items")

        if not all(bool(item.get("allocation_complete")) for item in items):
            raise HTTPException(
                status_code=409,
                detail="Cannot move to the next production stage before materials allocation is complete",
            )

        if not all(bool(item.get("industrial_ready")) for item in items):
            blocking = []
            for item in items:
                if not item.get("industrial_ready"):
                    label = item.get("name_ar") or item.get("name_en") or item.get("sku") or f"Product #{item.get('product_id')}"
                    reasons = ", ".join(item.get("industrial_messages") or [])
                    blocking.append(f"{label}: {reasons}")
            raise HTTPException(
                status_code=409,
                detail="Industrial product definition is incomplete for one or more order items. " + " | ".join(blocking),
            )

        if any(bool(item.get("has_shortage")) for item in items):
            blocking = []
            for item in items:
                if item.get("has_shortage"):
                    label = item.get("name_ar") or item.get("name_en") or item.get("sku") or f"Product #{item.get('product_id')}"
                    blocking.append(
                        f"{label}: available={item.get('stock_available', 0)} required={item.get('quantity', 0)} shortage={item.get('shortage_quantity', 0)}"
                    )
            raise HTTPException(
                status_code=409,
                detail="Cannot move to production because one or more items have stock shortage. " + " | ".join(blocking),
            )


@router.get("/employees/options")
async def list_work_order_employee_options(
    current_user: User = Depends(require_orders_view),
    db: AsyncSession = Depends(get_db),
):
    scoped_factory_id = get_user_factory_scope_id(current_user) if is_factory_scoped_user(current_user) else None

    if scoped_factory_id is None:
        result = await db.execute(
            text(
                """
                SELECT
                    id,
                    factory_id,
                    department_id,
                    employee_code,
                    first_name,
                    last_name,
                    job_title,
                    is_active
                FROM employees
                WHERE is_active = TRUE
                ORDER BY factory_id ASC, first_name ASC, last_name ASC, id ASC
                """
            )
        )
    else:
        result = await db.execute(
            text(
                """
                SELECT
                    id,
                    factory_id,
                    department_id,
                    employee_code,
                    first_name,
                    last_name,
                    job_title,
                    is_active
                FROM employees
                WHERE is_active = TRUE
                  AND factory_id = :factory_id
                ORDER BY first_name ASC, last_name ASC, id ASC
                """
            ),
            {"factory_id": scoped_factory_id},
        )

    return [serialize_employee_option(row) for row in result.mappings().all()]


@router.get("/summary")
async def get_work_orders_summary(
    current_user: User = Depends(require_orders_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_work_orders_schema(db)
    await ensure_material_allocations_table(db)
    await ensure_work_order_events_table(db)

    work_orders = await list_work_orders(current_user=current_user, db=db)

    summary = {
        "total": len(work_orders),
        "completed": 0,
        "cancelled": 0,
        "ready_for_production": 0,
        "has_shortage": 0,
        "overdue_or_at_risk": 0,
        "assigned": 0,
        "events_total": 0,
        "avg_progress_percent": 0,
    }

    progress_values = []
    for item in work_orders:
        status = str(item.get("status") or "")
        if status == "completed":
            summary["completed"] += 1
        if status == "cancelled":
            summary["cancelled"] += 1
        if item.get("ready_for_production"):
            summary["ready_for_production"] += 1
        if item.get("has_shortage"):
            summary["has_shortage"] += 1
        if item.get("schedule_health") == "at_risk":
            summary["overdue_or_at_risk"] += 1
        if item.get("assigned_employee_id"):
            summary["assigned"] += 1
        summary["events_total"] += int(item.get("events_count") or 0)
        progress_values.append(float(item.get("progress_percent") or 0))

    if progress_values:
        summary["avg_progress_percent"] = round(sum(progress_values) / len(progress_values), 2)

    return summary


@router.get("")
async def list_work_orders(
    current_user: User = Depends(require_orders_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_work_orders_schema(db)
    await ensure_material_allocations_table(db)
    await ensure_work_order_events_table(db)

    result = await db.execute(
        text(
            """
            SELECT
                wo.*,
                co.order_number,
                co.status AS order_status,
                co.payment_status,
                co.customer_name,
                co.customer_phone,
                co.shipping_address,
                co.warehouse_id,
                f.name AS factory_name,
                w.name AS warehouse_name,
                w.code AS warehouse_code,
                e.first_name AS assigned_employee_first_name,
                e.last_name AS assigned_employee_last_name,
                e.job_title AS assigned_employee_job_title
            FROM work_orders wo
            JOIN customer_orders co ON co.id = wo.order_id
            LEFT JOIN factories f ON f.id = wo.factory_id
            LEFT JOIN warehouses w ON w.id = co.warehouse_id
            LEFT JOIN employees e ON e.id = wo.assigned_employee_id
            ORDER BY
                CASE wo.priority
                    WHEN 'urgent' THEN 1
                    WHEN 'high' THEN 2
                    WHEN 'normal' THEN 3
                    WHEN 'low' THEN 4
                    ELSE 5
                END,
                COALESCE(wo.due_date, wo.created_at) ASC,
                wo.id DESC
            """
        )
    )
    rows = result.mappings().all()

    output = []
    for row in rows:
        row_dict = dict(row)
        full_name = f"{row_dict.get('assigned_employee_first_name') or ''} {row_dict.get('assigned_employee_last_name') or ''}".strip()
        row_dict["assigned_employee_name"] = full_name or None

        order_factory_id = row_dict.get("factory_id")
        enforce_factory_scope(
            current_user,
            order_factory_id,
            "Access denied for this work order factory scope",
        )

        work_order_id = int(row_dict["id"])
        warehouse_id = int(row_dict.get("warehouse_id")) if row_dict.get("warehouse_id") else None
        items = await fetch_work_order_items(db, int(row_dict["order_id"]), work_order_id, warehouse_id)
        allocations = await fetch_work_order_allocations(db, work_order_id)
        events = await fetch_work_order_events(db, work_order_id)
        output.append(serialize_work_order(row_dict, items, allocations, events))

    return output


@router.post("")
async def create_work_order(
    payload: dict,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_work_orders_schema(db)
    await ensure_material_allocations_table(db)
    await ensure_work_order_events_table(db)

    order_id = payload.get("order_id")
    factory_id = payload.get("factory_id")
    notes = payload.get("notes")
    assigned_employee_id = payload.get("assigned_employee_id")
    priority = _normalize_priority(payload.get("priority"))
    due_date = _normalize_optional_datetime(payload.get("due_date"), "due_date")
    planned_start_at = _normalize_optional_datetime(payload.get("planned_start_at"), "planned_start_at")
    planned_end_at = _normalize_optional_datetime(payload.get("planned_end_at"), "planned_end_at")
    progress_percent = _normalize_progress(payload.get("progress_percent"))
    actual_minutes = _normalize_non_negative_number(payload.get("actual_minutes"), "actual_minutes")

    if not order_id or not factory_id:
        raise HTTPException(status_code=400, detail="order_id and factory_id are required")

    try:
        order_id = int(order_id)
        factory_id = int(factory_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid order_id or factory_id")

    if assigned_employee_id in ["", None]:
        assigned_employee_id = None
    else:
        try:
            assigned_employee_id = int(assigned_employee_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid assigned_employee_id")

    order_result = await db.execute(
        text(
            """
            SELECT id, factory_id
            FROM customer_orders
            WHERE id = :order_id
            LIMIT 1
            """
        ),
        {"order_id": order_id},
    )
    order = order_result.mappings().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    enforce_factory_scope(current_user, order.get("factory_id"))
    assigned_employee = await resolve_employee_for_factory(db, assigned_employee_id, factory_id)

    duplicate_result = await db.execute(
        text(
            """
            SELECT id
            FROM work_orders
            WHERE order_id = :order_id
              AND factory_id = :factory_id
            LIMIT 1
            """
        ),
        {"order_id": order_id, "factory_id": factory_id},
    )
    duplicate = duplicate_result.mappings().first()
    if duplicate:
        raise HTTPException(status_code=409, detail="Work order already exists for this order and factory")

    result = await db.execute(
        text(
            """
            INSERT INTO work_orders (
                order_id,
                factory_id,
                assigned_employee_id,
                status,
                notes,
                priority,
                due_date,
                planned_start_at,
                planned_end_at,
                progress_percent,
                actual_minutes
            )
            VALUES (
                :order_id,
                :factory_id,
                :assigned_employee_id,
                'pending',
                :notes,
                :priority,
                :due_date,
                :planned_start_at,
                :planned_end_at,
                :progress_percent,
                :actual_minutes
            )
            RETURNING id
            """
        ),
        {
            "order_id": order_id,
            "factory_id": factory_id,
            "assigned_employee_id": assigned_employee["id"] if assigned_employee else None,
            "notes": notes,
            "priority": priority,
            "due_date": due_date,
            "planned_start_at": planned_start_at,
            "planned_end_at": planned_end_at,
            "progress_percent": 0 if progress_percent is None else progress_percent,
            "actual_minutes": 0 if actual_minutes is None else actual_minutes,
        },
    )
    work_order_id = int(result.scalar_one())

    await create_work_order_event(
        db=db,
        work_order_id=work_order_id,
        event_type="created",
        actor=current_user,
        to_status="pending",
        notes=notes or "Work order created",
        meta_json=(
            f'{{"priority":"{priority}","due_date":"{due_date or ""}","planned_start_at":"{planned_start_at or ""}","planned_end_at":"{planned_end_at or ""}"}}'
        ),
        assigned_employee_id=assigned_employee["id"] if assigned_employee else None,
        assigned_employee_name=assigned_employee["full_name"] if assigned_employee else None,
    )

    await db.commit()

    row = await fetch_work_order_or_404(db, work_order_id)
    items = await fetch_work_order_items(
        db,
        int(row["order_id"]),
        int(row["id"]),
        int(row.get("warehouse_id")) if row.get("warehouse_id") else None,
    )
    allocations = await fetch_work_order_allocations(db, int(row["id"]))
    events = await fetch_work_order_events(db, int(row["id"]))
    return serialize_work_order(row, items, allocations, events)


@router.put("/{work_order_id}")
async def update_work_order(
    work_order_id: int,
    payload: dict,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_work_orders_schema(db)
    await ensure_material_allocations_table(db)
    await ensure_work_order_events_table(db)

    work_order = await fetch_work_order_or_404(db, work_order_id)
    enforce_factory_scope(
        current_user,
        work_order.get("factory_id"),
        "Access denied for this work order factory scope",
    )

    current_status = str(work_order.get("status") or "pending")
    status_value = str(payload.get("status", current_status) or "").strip().lower()
    notes = payload.get("notes", work_order.get("notes"))
    priority = _normalize_priority(payload.get("priority", work_order.get("priority") or "normal"))
    due_date = _normalize_optional_datetime(payload.get("due_date", work_order.get("due_date")), "due_date")
    planned_start_at = _normalize_optional_datetime(payload.get("planned_start_at", work_order.get("planned_start_at")), "planned_start_at")
    planned_end_at = _normalize_optional_datetime(payload.get("planned_end_at", work_order.get("planned_end_at")), "planned_end_at")
    progress_percent = _normalize_progress(payload.get("progress_percent"))
    actual_minutes = _normalize_non_negative_number(payload.get("actual_minutes"), "actual_minutes")

    if status_value not in ALLOWED_WORK_ORDER_STATUSES:
        raise HTTPException(status_code=400, detail="Invalid work order status")

    await ensure_valid_work_order_transition(
        db=db,
        work_order_id=work_order_id,
        current_status=current_status,
        next_status=status_value,
        order_id=int(work_order["order_id"]),
        warehouse_id=int(work_order.get("warehouse_id")) if work_order.get("warehouse_id") else None,
    )

    try:
        await db.execute(
            text(
                """
                UPDATE work_orders
                SET
                    status = :status,
                    notes = :notes,
                    priority = :priority,
                    due_date = :due_date,
                    planned_start_at = :planned_start_at,
                    planned_end_at = :planned_end_at,
                    progress_percent = COALESCE(:progress_percent, progress_percent),
                    actual_minutes = COALESCE(:actual_minutes, actual_minutes),
                    updated_at = NOW()
                WHERE id = :id
                """
            ),
            {
                "id": work_order_id,
                "status": status_value,
                "notes": notes,
                "priority": priority,
                "due_date": due_date,
                "planned_start_at": planned_start_at,
                "planned_end_at": planned_end_at,
                "progress_percent": progress_percent,
                "actual_minutes": actual_minutes,
            },
        )

        await sync_linked_order_status(
            db=db,
            order_id=int(work_order["order_id"]),
            work_order_status=status_value,
        )

        if status_value != current_status or notes != work_order.get("notes") or priority != (work_order.get("priority") or "normal"):
            await create_work_order_event(
                db=db,
                work_order_id=work_order_id,
                event_type="status_updated",
                actor=current_user,
                from_status=current_status,
                to_status=status_value,
                notes=notes,
                meta_json=(
                    f'{{"priority":"{priority}","due_date":"{due_date or ""}","planned_start_at":"{planned_start_at or ""}","planned_end_at":"{planned_end_at or ""}","progress_percent":"{progress_percent if progress_percent is not None else work_order.get("progress_percent") or 0}","actual_minutes":"{actual_minutes if actual_minutes is not None else work_order.get("actual_minutes") or 0}"}}'
                ),
                assigned_employee_id=work_order.get("assigned_employee_id"),
                assigned_employee_name=work_order.get("assigned_employee_name"),
            )

        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update work order: {exc}")

    updated = await fetch_work_order_or_404(db, work_order_id)
    items = await fetch_work_order_items(
        db,
        int(updated["order_id"]),
        int(updated["id"]),
        int(updated.get("warehouse_id")) if updated.get("warehouse_id") else None,
    )
    allocations = await fetch_work_order_allocations(db, int(updated["id"]))
    events = await fetch_work_order_events(db, int(updated["id"]))
    return serialize_work_order(updated, items, allocations, events)


@router.put("/{work_order_id}/assignment")
async def update_work_order_assignment(
    work_order_id: int,
    payload: dict,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_work_orders_schema(db)
    await ensure_work_order_events_table(db)

    work_order = await fetch_work_order_or_404(db, work_order_id)
    enforce_factory_scope(
        current_user,
        work_order.get("factory_id"),
        "Access denied for this work order factory scope",
    )

    assigned_employee_id = payload.get("assigned_employee_id")
    notes = str(payload.get("notes") or "").strip() or None

    if assigned_employee_id in ["", None]:
        assigned_employee_id = None
    else:
        try:
            assigned_employee_id = int(assigned_employee_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid assigned_employee_id")

    assigned_employee = await resolve_employee_for_factory(
        db=db,
        employee_id=assigned_employee_id,
        factory_id=int(work_order["factory_id"]),
    )

    previous_employee_name = work_order.get("assigned_employee_name")

    try:
        await db.execute(
            text(
                """
                UPDATE work_orders
                SET
                    assigned_employee_id = :assigned_employee_id,
                    updated_at = NOW()
                WHERE id = :work_order_id
                """
            ),
            {
                "work_order_id": work_order_id,
                "assigned_employee_id": assigned_employee["id"] if assigned_employee else None,
            },
        )

        await create_work_order_event(
            db=db,
            work_order_id=work_order_id,
            event_type="assignment_updated",
            actor=current_user,
            notes=notes or "Responsible employee updated",
            meta_json=(
                f'{{"previous_employee_name":"{previous_employee_name or ""}","new_employee_name":"{assigned_employee["full_name"] if assigned_employee else ""}"}}'
            ),
            assigned_employee_id=assigned_employee["id"] if assigned_employee else None,
            assigned_employee_name=assigned_employee["full_name"] if assigned_employee else None,
        )

        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update responsible employee: {exc}")

    updated = await fetch_work_order_or_404(db, work_order_id)
    items = await fetch_work_order_items(
        db,
        int(updated["order_id"]),
        int(updated["id"]),
        int(updated.get("warehouse_id")) if updated.get("warehouse_id") else None,
    )
    allocations = await fetch_work_order_allocations(db, int(updated["id"]))
    events = await fetch_work_order_events(db, int(updated["id"]))
    return serialize_work_order(updated, items, allocations, events)


@router.put("/{work_order_id}/planning")
async def update_work_order_planning(
    work_order_id: int,
    payload: dict,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_work_orders_schema(db)
    await ensure_work_order_events_table(db)

    work_order = await fetch_work_order_or_404(db, work_order_id)
    enforce_factory_scope(
        current_user,
        work_order.get("factory_id"),
        "Access denied for this work order factory scope",
    )

    priority = _normalize_priority(payload.get("priority", work_order.get("priority") or "normal"))
    due_date = _normalize_optional_datetime(payload.get("due_date", work_order.get("due_date")), "due_date")
    planned_start_at = _normalize_optional_datetime(payload.get("planned_start_at", work_order.get("planned_start_at")), "planned_start_at")
    planned_end_at = _normalize_optional_datetime(payload.get("planned_end_at", work_order.get("planned_end_at")), "planned_end_at")
    notes = str(payload.get("notes") or "").strip() or None

    try:
        await db.execute(
            text(
                """
                UPDATE work_orders
                SET
                    priority = :priority,
                    due_date = :due_date,
                    planned_start_at = :planned_start_at,
                    planned_end_at = :planned_end_at,
                    updated_at = NOW()
                WHERE id = :work_order_id
                """
            ),
            {
                "work_order_id": work_order_id,
                "priority": priority,
                "due_date": due_date,
                "planned_start_at": planned_start_at,
                "planned_end_at": planned_end_at,
            },
        )

        await create_work_order_event(
            db=db,
            work_order_id=work_order_id,
            event_type="planning_updated",
            actor=current_user,
            notes=notes or "Planning updated",
            meta_json=(
                f'{{"priority":"{priority}","due_date":"{due_date or ""}","planned_start_at":"{planned_start_at or ""}","planned_end_at":"{planned_end_at or ""}"}}'
            ),
            assigned_employee_id=work_order.get("assigned_employee_id"),
            assigned_employee_name=work_order.get("assigned_employee_name"),
        )

        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update work order planning: {exc}")

    updated = await fetch_work_order_or_404(db, work_order_id)
    items = await fetch_work_order_items(
        db,
        int(updated["order_id"]),
        int(updated["id"]),
        int(updated.get("warehouse_id")) if updated.get("warehouse_id") else None,
    )
    allocations = await fetch_work_order_allocations(db, int(updated["id"]))
    events = await fetch_work_order_events(db, int(updated["id"]))
    return serialize_work_order(updated, items, allocations, events)


@router.put("/{work_order_id}/execution")
async def update_work_order_execution(
    work_order_id: int,
    payload: dict,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_work_orders_schema(db)
    await ensure_work_order_events_table(db)

    work_order = await fetch_work_order_or_404(db, work_order_id)
    enforce_factory_scope(
        current_user,
        work_order.get("factory_id"),
        "Access denied for this work order factory scope",
    )

    progress_percent = _normalize_progress(payload.get("progress_percent"))
    actual_minutes = _normalize_non_negative_number(payload.get("actual_minutes"), "actual_minutes")
    notes = str(payload.get("notes") or "").strip() or None

    if progress_percent is None and actual_minutes is None:
        raise HTTPException(status_code=400, detail="progress_percent or actual_minutes is required")

    try:
        await db.execute(
            text(
                """
                UPDATE work_orders
                SET
                    progress_percent = COALESCE(:progress_percent, progress_percent),
                    actual_minutes = COALESCE(:actual_minutes, actual_minutes),
                    updated_at = NOW()
                WHERE id = :work_order_id
                """
            ),
            {
                "work_order_id": work_order_id,
                "progress_percent": progress_percent,
                "actual_minutes": actual_minutes,
            },
        )

        await create_work_order_event(
            db=db,
            work_order_id=work_order_id,
            event_type="execution_progress_updated",
            actor=current_user,
            notes=notes or "Execution progress updated",
            meta_json=(
                f'{{"progress_percent":"{progress_percent if progress_percent is not None else work_order.get("progress_percent") or 0}","actual_minutes":"{actual_minutes if actual_minutes is not None else work_order.get("actual_minutes") or 0}"}}'
            ),
            assigned_employee_id=work_order.get("assigned_employee_id"),
            assigned_employee_name=work_order.get("assigned_employee_name"),
        )

        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update work order execution: {exc}")

    updated = await fetch_work_order_or_404(db, work_order_id)
    items = await fetch_work_order_items(
        db,
        int(updated["order_id"]),
        int(updated["id"]),
        int(updated.get("warehouse_id")) if updated.get("warehouse_id") else None,
    )
    allocations = await fetch_work_order_allocations(db, int(updated["id"]))
    events = await fetch_work_order_events(db, int(updated["id"]))
    return serialize_work_order(updated, items, allocations, events)


@router.put("/{work_order_id}/materials-allocation")
async def update_work_order_materials_allocation(
    work_order_id: int,
    payload: dict,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_work_orders_schema(db)
    await ensure_material_allocations_table(db)
    await ensure_work_order_events_table(db)

    work_order = await fetch_work_order_or_404(db, work_order_id)
    enforce_factory_scope(
        current_user,
        work_order.get("factory_id"),
        "Access denied for this work order factory scope",
    )

    warehouse_id = payload.get("warehouse_id")
    allocations = payload.get("allocations") or []
    notes = payload.get("notes")

    if not warehouse_id:
        raise HTTPException(status_code=400, detail="warehouse_id is required")

    try:
        warehouse_id = int(warehouse_id)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid warehouse_id")

    await ensure_valid_target_warehouse(
        db=db,
        warehouse_id=warehouse_id,
        factory_id=int(work_order["factory_id"]),
    )

    items_result = await db.execute(
        text(
            """
            SELECT
                coi.id,
                coi.order_id,
                coi.product_id,
                coi.quantity
            FROM customer_order_items coi
            WHERE coi.order_id = :order_id
            ORDER BY coi.id ASC
            """
        ),
        {"order_id": int(work_order["order_id"])},
    )
    order_items = items_result.mappings().all()
    order_items_map = {int(row["id"]): row for row in order_items}

    requested = []
    for entry in allocations:
        try:
            order_item_id = int(entry.get("order_item_id"))
            allocated_quantity = float(entry.get("allocated_quantity") or 0)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid allocation payload")

        if order_item_id not in order_items_map:
            raise HTTPException(status_code=404, detail=f"Order item #{order_item_id} not found for this work order")

        if allocated_quantity < 0:
            raise HTTPException(status_code=400, detail="allocated_quantity cannot be negative")

        order_item = order_items_map[order_item_id]
        required_quantity = float(order_item.get("quantity") or 0)
        if allocated_quantity > required_quantity:
            raise HTTPException(
                status_code=409,
                detail=f"Allocated quantity exceeds required quantity for order item #{order_item_id}",
            )

        requested.append(
            {
                "order_item_id": order_item_id,
                "product_id": int(order_item["product_id"]),
                "allocated_quantity": allocated_quantity,
                "notes": str(entry.get("notes") or "").strip() or notes,
            }
        )

    grouped_requested = defaultdict(float)
    for entry in requested:
        grouped_requested[(warehouse_id, entry["product_id"])] += float(entry["allocated_quantity"] or 0)

    for (group_warehouse_id, product_id), requested_total in grouped_requested.items():
        available_stock = await resolve_stock_available_for_allocation(
            db=db,
            warehouse_id=group_warehouse_id,
            product_id=product_id,
            current_work_order_id=work_order_id,
        )
        if requested_total > available_stock:
            raise HTTPException(
                status_code=409,
                detail=f"Insufficient available stock for product #{product_id}. Available stock is {available_stock}, requested allocation is {requested_total}",
            )

    try:
        await db.execute(
            text(
                """
                DELETE FROM work_order_material_allocations
                WHERE work_order_id = :work_order_id
                """
            ),
            {"work_order_id": work_order_id},
        )

        for entry in requested:
            if float(entry["allocated_quantity"] or 0) <= 0:
                continue

            await db.execute(
                text(
                    """
                    INSERT INTO work_order_material_allocations (
                        work_order_id,
                        order_item_id,
                        warehouse_id,
                        product_id,
                        allocated_quantity,
                        notes
                    )
                    VALUES (
                        :work_order_id,
                        :order_item_id,
                        :warehouse_id,
                        :product_id,
                        :allocated_quantity,
                        :notes
                    )
                    """
                ),
                {
                    "work_order_id": work_order_id,
                    "order_item_id": entry["order_item_id"],
                    "warehouse_id": warehouse_id,
                    "product_id": entry["product_id"],
                    "allocated_quantity": entry["allocated_quantity"],
                    "notes": entry["notes"],
                },
            )

        await create_work_order_event(
            db=db,
            work_order_id=work_order_id,
            event_type="materials_allocation_saved",
            actor=current_user,
            notes=notes or "Materials allocation saved",
            meta_json=f'{{"warehouse_id": {warehouse_id}, "lines": {len(requested)}}}',
            assigned_employee_id=work_order.get("assigned_employee_id"),
            assigned_employee_name=work_order.get("assigned_employee_name"),
        )

        await auto_sync_work_order_status_from_allocations(db, work_order_id, current_user)
        await db.commit()
    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to save materials allocation: {exc}")

    updated = await fetch_work_order_or_404(db, work_order_id)
    items = await fetch_work_order_items(
        db,
        int(updated["order_id"]),
        int(updated["id"]),
        int(updated.get("warehouse_id")) if updated.get("warehouse_id") else None,
    )
    saved_allocations = await fetch_work_order_allocations(db, int(updated["id"]))
    events = await fetch_work_order_events(db, int(updated["id"]))
    return serialize_work_order(updated, items, saved_allocations, events)


@router.post("/{work_order_id}/events")
async def add_work_order_event(
    work_order_id: int,
    payload: dict,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_work_orders_schema(db)
    await ensure_work_order_events_table(db)

    work_order = await fetch_work_order_or_404(db, work_order_id)
    enforce_factory_scope(
        current_user,
        work_order.get("factory_id"),
        "Access denied for this work order factory scope",
    )

    event_type = str(payload.get("event_type") or "note").strip().lower()
    notes = str(payload.get("notes") or "").strip()
    assigned_employee_id = payload.get("assigned_employee_id")

    if not notes:
        raise HTTPException(status_code=400, detail="Event notes are required")

    if assigned_employee_id in ["", None]:
        assigned_employee_id = work_order.get("assigned_employee_id")
    else:
        try:
            assigned_employee_id = int(assigned_employee_id)
        except Exception:
            raise HTTPException(status_code=400, detail="Invalid assigned_employee_id")

    assigned_employee = await resolve_employee_for_factory(
        db=db,
        employee_id=assigned_employee_id,
        factory_id=int(work_order["factory_id"]),
    )

    try:
        await create_work_order_event(
            db=db,
            work_order_id=work_order_id,
            event_type=event_type,
            actor=current_user,
            notes=notes,
            assigned_employee_id=assigned_employee["id"] if assigned_employee else None,
            assigned_employee_name=assigned_employee["full_name"] if assigned_employee else None,
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to add work order event: {exc}")

    updated = await fetch_work_order_or_404(db, work_order_id)
    items = await fetch_work_order_items(
        db,
        int(updated["order_id"]),
        int(updated["id"]),
        int(updated.get("warehouse_id")) if updated.get("warehouse_id") else None,
    )
    allocations = await fetch_work_order_allocations(db, int(updated["id"]))
    events = await fetch_work_order_events(db, int(updated["id"]))
    return serialize_work_order(updated, items, allocations, events)


@router.delete("/{work_order_id}")
async def delete_work_order(
    work_order_id: int,
    current_user: User = Depends(require_orders_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_work_orders_schema(db)
    await ensure_material_allocations_table(db)
    await ensure_work_order_events_table(db)

    work_order = await fetch_work_order_or_404(db, work_order_id)
    enforce_factory_scope(
        current_user,
        work_order.get("factory_id"),
        "Access denied for this work order factory scope",
    )

    await ensure_work_order_delete_is_safe(
        db=db,
        work_order_id=work_order_id,
        order_id=int(work_order["order_id"]),
    )

    try:
        await db.execute(
            text(
                """
                DELETE FROM work_order_events
                WHERE work_order_id = :id
                """
            ),
            {"id": work_order_id},
        )

        await db.execute(
            text(
                """
                DELETE FROM work_order_material_allocations
                WHERE work_order_id = :id
                """
            ),
            {"id": work_order_id},
        )

        await db.execute(
            text(
                """
                DELETE FROM work_orders
                WHERE id = :id
                """
            ),
            {"id": work_order_id},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete work order: {exc}")

    return {
        "ok": True,
        "deleted_work_order_id": work_order_id,
    }
