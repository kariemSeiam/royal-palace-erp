from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    ensure_not_blocked_admin_role,
    get_current_user_and_role,
    get_user_factory_scope_id,
)
from src.core.db.session import get_db
from src.models.user import User
from src.api.routers.admin_audit import log_audit_event

router = APIRouter(prefix="/admin/inventory", tags=["admin-inventory"])


def _normalize_permission_set(permissions) -> set[str]:
    return {
        str(code or "").strip().lower()
        for code in (permissions or set())
        if str(code or "").strip()
    }


def _has_any_permission(permissions: set[str], *codes: str) -> bool:
    wanted = {str(code or "").strip().lower() for code in codes if str(code or "").strip()}
    return any(code in permissions for code in wanted)


async def require_inventory_view(
    actor=Depends(get_current_user_and_role),
):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    normalized = _normalize_permission_set(permissions)

    if user.is_superuser:
        return user

    if not _has_any_permission(
        normalized,
        "inventory.view",
        "inventory.manage",
        "stock.view",
        "stock.manage",
        "warehouses.view",
        "warehouses.manage",
        "dashboard.view",
    ):
        raise HTTPException(status_code=403, detail="Inventory access denied")

    return user


async def require_inventory_manage(
    actor=Depends(get_current_user_and_role),
):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    normalized = _normalize_permission_set(permissions)

    if user.is_superuser:
        return user

    if not _has_any_permission(
        normalized,
        "inventory.manage",
        "stock.manage",
        "warehouses.manage",
    ):
        raise HTTPException(status_code=403, detail="Inventory management access denied")

    return user


def _scoped_factory_id_or_none(current_user: User):
    if getattr(current_user, "is_superuser", False):
        return None
    return get_user_factory_scope_id(current_user)


def _enforce_target_factory(current_user: User, target_factory_id: int | None):
    if getattr(current_user, "is_superuser", False):
        return

    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    if scoped_factory_id is None:
        return

    if target_factory_id is None:
        raise HTTPException(status_code=403, detail="Factory scope is required")

    if int(scoped_factory_id) != int(target_factory_id):
        raise HTTPException(status_code=403, detail="Access denied for this factory scope")


def _clean_text(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def _to_int(value, field_name: str, required: bool = False):
    if value in [None, ""]:
        if required:
            raise HTTPException(status_code=400, detail=f"{field_name} is required")
        return None
    try:
        return int(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")


def _to_float(value, field_name: str, required: bool = False):
    if value in [None, ""]:
        if required:
            raise HTTPException(status_code=400, detail=f"{field_name} is required")
        return None
    try:
        return float(value)
    except Exception:
        raise HTTPException(status_code=400, detail=f"Invalid {field_name}")


async def ensure_inventory_tables(db: AsyncSession):
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS inventory_reorder_rules (
                id SERIAL PRIMARY KEY,
                factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
                warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
                product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
                min_stock_level NUMERIC(14,2) NOT NULL DEFAULT 0,
                reorder_level NUMERIC(14,2) NOT NULL DEFAULT 0,
                reorder_quantity NUMERIC(14,2) NOT NULL DEFAULT 0,
                notes TEXT NULL,
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
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
            CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_reorder_rules_wh_product
            ON inventory_reorder_rules(warehouse_id, product_id)
            """
        )
    )
    await db.execute(
        text(
            """
            CREATE INDEX IF NOT EXISTS ix_inventory_reorder_rules_factory_id
            ON inventory_reorder_rules(factory_id)
            """
        )
    )
    await db.commit()


async def _warehouse_exists_in_scope(
    db: AsyncSession,
    warehouse_id: int,
    current_user: User,
):
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    if scoped_factory_id is None:
        result = await db.execute(
            text(
                """
                SELECT id, factory_id, code, name, is_active
                FROM warehouses
                WHERE id = :warehouse_id
                LIMIT 1
                """
            ),
            {"warehouse_id": warehouse_id},
        )
    else:
        result = await db.execute(
            text(
                """
                SELECT id, factory_id, code, name, is_active
                FROM warehouses
                WHERE id = :warehouse_id
                  AND factory_id = :factory_id
                LIMIT 1
                """
            ),
            {"warehouse_id": warehouse_id, "factory_id": scoped_factory_id},
        )

    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Warehouse not found")
    return row


async def _product_exists_in_scope(
    db: AsyncSession,
    product_id: int,
    current_user: User,
):
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    if scoped_factory_id is None:
        result = await db.execute(
            text(
                """
                SELECT id, factory_id, name_ar, sku, is_active
                FROM products
                WHERE id = :product_id
                LIMIT 1
                """
            ),
            {"product_id": product_id},
        )
    else:
        result = await db.execute(
            text(
                """
                SELECT id, factory_id, name_ar, sku, is_active
                FROM products
                WHERE id = :product_id
                  AND factory_id = :factory_id
                LIMIT 1
                """
            ),
            {"product_id": product_id, "factory_id": scoped_factory_id},
        )

    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Product not found")
    return row


async def _current_stock(db: AsyncSession, warehouse_id: int, product_id: int) -> float:
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
        {"warehouse_id": warehouse_id, "product_id": product_id},
    )
    return float(stock_result.scalar() or 0)


async def _insert_movement(
    db: AsyncSession,
    *,
    factory_id: int,
    warehouse_id: int,
    product_id: int,
    movement_type: str,
    quantity: float,
    reference_type: str | None,
    reference_id: int | None,
    notes: str | None,
    created_by_user_id: int | None,
):
    result = await db.execute(
        text(
            """
            INSERT INTO inventory_movements (
                factory_id,
                warehouse_id,
                product_id,
                movement_type,
                quantity,
                reference_type,
                reference_id,
                notes,
                created_by_user_id
            )
            VALUES (
                :factory_id,
                :warehouse_id,
                :product_id,
                :movement_type,
                :quantity,
                :reference_type,
                :reference_id,
                :notes,
                :created_by_user_id
            )
            RETURNING id
            """
        ),
        {
            "factory_id": factory_id,
            "warehouse_id": warehouse_id,
            "product_id": product_id,
            "movement_type": movement_type,
            "quantity": quantity,
            "reference_type": reference_type,
            "reference_id": reference_id,
            "notes": notes,
            "created_by_user_id": created_by_user_id,
        },
    )
    return int(result.scalar_one())


@router.get("/warehouses")
async def list_warehouses(
    current_user: User = Depends(require_inventory_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_inventory_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    sql = """
        SELECT
            w.id,
            w.factory_id,
            f.name AS factory_name,
            w.code,
            w.name,
            w.description,
            w.is_active,
            w.created_at,
            w.updated_at,
            COALESCE((
                SELECT COUNT(*)
                FROM inventory_movements im
                WHERE im.warehouse_id = w.id
            ), 0) AS movements_count,
            COALESCE((
                SELECT COUNT(DISTINCT im.product_id)
                FROM inventory_movements im
                WHERE im.warehouse_id = w.id
            ), 0) AS products_count,
            COALESCE((
                SELECT SUM(
                    CASE
                        WHEN im.movement_type = 'in' THEN im.quantity
                        WHEN im.movement_type = 'adjustment' THEN im.quantity
                        WHEN im.movement_type = 'out' THEN -im.quantity
                        ELSE 0
                    END
                )
                FROM inventory_movements im
                WHERE im.warehouse_id = w.id
            ), 0) AS stock_units_total
        FROM warehouses w
        JOIN factories f ON f.id = w.factory_id
    """
    params = {}

    if scoped_factory_id is not None:
        sql += " WHERE w.factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id

    sql += " ORDER BY w.id DESC"
    result = await db.execute(text(sql), params)
    rows = result.mappings().all()
    return [dict(row) for row in rows]


@router.post("/warehouses", status_code=status.HTTP_201_CREATED)
async def create_warehouse(
    payload: dict,
    current_user: User = Depends(require_inventory_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_inventory_tables(db)

    factory_id = _to_int(payload.get("factory_id"), "factory_id", required=True)
    code = _clean_text(payload.get("code"))
    name = _clean_text(payload.get("name"))
    description = _clean_text(payload.get("description"))
    is_active = bool(payload.get("is_active", True))

    if not code:
        raise HTTPException(status_code=400, detail="code is required")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    _enforce_target_factory(current_user, factory_id)

    factory_check = await db.execute(
        text("SELECT id, name FROM factories WHERE id = :factory_id LIMIT 1"),
        {"factory_id": factory_id},
    )
    if not factory_check.first():
        raise HTTPException(status_code=404, detail="Factory not found")

    duplicate = await db.execute(
        text(
            """
            SELECT id
            FROM warehouses
            WHERE factory_id = :factory_id
              AND (code = :code OR name = :name)
            LIMIT 1
            """
        ),
        {"factory_id": factory_id, "code": code, "name": name},
    )
    if duplicate.first():
        raise HTTPException(status_code=409, detail="Warehouse code or name already exists inside this factory")

    result = await db.execute(
        text(
            """
            INSERT INTO warehouses (
                factory_id, code, name, description, is_active
            )
            VALUES (
                :factory_id, :code, :name, :description, :is_active
            )
            RETURNING id
            """
        ),
        {
            "factory_id": factory_id,
            "code": code,
            "name": name,
            "description": description,
            "is_active": is_active,
        },
    )
    warehouse_id = int(result.scalar_one())
    await log_audit_event(
        db,
        current_user=current_user,
        module="inventory",
        entity_type="warehouse",
        entity_id=warehouse_id,
        action="warehouse_created",
        factory_id=factory_id,
        title="إنشاء مخزن",
        description=f"Created warehouse #{warehouse_id}",
        reference_type="warehouse",
        reference_id=warehouse_id,
        metadata={"warehouse_id": warehouse_id, "code": code, "name": name, "is_active": is_active},
    )
    await db.commit()

    row = await db.execute(
        text(
            """
            SELECT
                w.id,
                w.factory_id,
                f.name AS factory_name,
                w.code,
                w.name,
                w.description,
                w.is_active,
                w.created_at,
                w.updated_at,
                0 AS movements_count,
                0 AS products_count,
                0 AS stock_units_total
            FROM warehouses w
            JOIN factories f ON f.id = w.factory_id
            WHERE w.id = :warehouse_id
            LIMIT 1
            """
        ),
        {"warehouse_id": warehouse_id},
    )
    return dict(row.mappings().first())


@router.put("/warehouses/{warehouse_id}")
async def update_warehouse(
    warehouse_id: int,
    payload: dict,
    current_user: User = Depends(require_inventory_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_inventory_tables(db)

    existing = await _warehouse_exists_in_scope(db, warehouse_id, current_user)
    current_factory_id = int(existing["factory_id"])
    new_factory_id = _to_int(payload.get("factory_id", current_factory_id), "factory_id", required=True)

    _enforce_target_factory(current_user, new_factory_id)

    code = _clean_text(payload.get("code", existing["code"]))
    name = _clean_text(payload.get("name", existing["name"]))
    description = _clean_text(payload.get("description", existing.get("description")))
    is_active = bool(payload.get("is_active", existing["is_active"]))

    if not code:
        raise HTTPException(status_code=400, detail="code is required")
    if not name:
        raise HTTPException(status_code=400, detail="name is required")

    duplicate = await db.execute(
        text(
            """
            SELECT id
            FROM warehouses
            WHERE factory_id = :factory_id
              AND id != :warehouse_id
              AND (code = :code OR name = :name)
            LIMIT 1
            """
        ),
        {
            "factory_id": new_factory_id,
            "warehouse_id": warehouse_id,
            "code": code,
            "name": name,
        },
    )
    if duplicate.first():
        raise HTTPException(status_code=409, detail="Warehouse code or name already exists inside this factory")

    await db.execute(
        text(
            """
            UPDATE warehouses
            SET
                factory_id = :factory_id,
                code = :code,
                name = :name,
                description = :description,
                is_active = :is_active,
                updated_at = NOW()
            WHERE id = :warehouse_id
            """
        ),
        {
            "warehouse_id": warehouse_id,
            "factory_id": new_factory_id,
            "code": code,
            "name": name,
            "description": description,
            "is_active": is_active,
        },
    )
    await db.commit()

    row = await db.execute(
        text(
            """
            SELECT
                w.id,
                w.factory_id,
                f.name AS factory_name,
                w.code,
                w.name,
                w.description,
                w.is_active,
                w.created_at,
                w.updated_at,
                COALESCE((
                    SELECT COUNT(*)
                    FROM inventory_movements im
                    WHERE im.warehouse_id = w.id
                ), 0) AS movements_count,
                COALESCE((
                    SELECT COUNT(DISTINCT im.product_id)
                    FROM inventory_movements im
                    WHERE im.warehouse_id = w.id
                ), 0) AS products_count,
                COALESCE((
                    SELECT SUM(
                        CASE
                            WHEN im.movement_type = 'in' THEN im.quantity
                            WHEN im.movement_type = 'adjustment' THEN im.quantity
                            WHEN im.movement_type = 'out' THEN -im.quantity
                            ELSE 0
                        END
                    )
                    FROM inventory_movements im
                    WHERE im.warehouse_id = w.id
                ), 0) AS stock_units_total
            FROM warehouses w
            JOIN factories f ON f.id = w.factory_id
            WHERE w.id = :warehouse_id
            LIMIT 1
            """
        ),
        {"warehouse_id": warehouse_id},
    )
    return dict(row.mappings().first())


@router.delete("/warehouses/{warehouse_id}")
async def delete_warehouse(
    warehouse_id: int,
    current_user: User = Depends(require_inventory_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_inventory_tables(db)

    existing = await _warehouse_exists_in_scope(db, warehouse_id, current_user)

    movements = await db.execute(
        text(
            """
            SELECT id
            FROM inventory_movements
            WHERE warehouse_id = :warehouse_id
            LIMIT 1
            """
        ),
        {"warehouse_id": warehouse_id},
    )
    if movements.first():
        raise HTTPException(status_code=409, detail="Cannot delete warehouse linked to inventory movements")

    rules = await db.execute(
        text(
            """
            SELECT id
            FROM inventory_reorder_rules
            WHERE warehouse_id = :warehouse_id
            LIMIT 1
            """
        ),
        {"warehouse_id": warehouse_id},
    )
    if rules.first():
        raise HTTPException(status_code=409, detail="Cannot delete warehouse linked to reorder rules")

    await db.execute(
        text("DELETE FROM warehouses WHERE id = :warehouse_id"),
        {"warehouse_id": warehouse_id},
    )
    await db.commit()

    return {
        "message": "Warehouse deleted successfully",
        "deleted_id": warehouse_id,
        "factory_id": existing["factory_id"],
    }


@router.get("/movements")
async def list_inventory_movements(
    current_user: User = Depends(require_inventory_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_inventory_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    sql = """
        SELECT
            im.id,
            im.factory_id,
            f.name AS factory_name,
            im.warehouse_id,
            w.name AS warehouse_name,
            w.code AS warehouse_code,
            im.product_id,
            p.name_ar AS product_name,
            p.sku AS product_sku,
            im.movement_type,
            im.quantity,
            im.reference_type,
            im.reference_id,
            im.notes,
            im.created_by_user_id,
            u.full_name AS created_by_name,
            im.created_at,
            im.updated_at
        FROM inventory_movements im
        JOIN warehouses w ON w.id = im.warehouse_id
        JOIN factories f ON f.id = im.factory_id
        JOIN products p ON p.id = im.product_id
        LEFT JOIN users u ON u.id = im.created_by_user_id
    """

    params = {}
    if scoped_factory_id is not None:
        sql += " WHERE im.factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id

    sql += " ORDER BY im.id DESC"
    result = await db.execute(text(sql), params)
    rows = result.mappings().all()
    return [dict(row) for row in rows]


@router.post("/movements", status_code=status.HTTP_201_CREATED)
async def create_inventory_movement(
    payload: dict,
    current_user: User = Depends(require_inventory_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_inventory_tables(db)

    warehouse_id = _to_int(payload.get("warehouse_id"), "warehouse_id", required=True)
    product_id = _to_int(payload.get("product_id"), "product_id", required=True)
    movement_type = str(payload.get("movement_type") or "").strip().lower()
    quantity = _to_float(payload.get("quantity"), "quantity", required=True)
    reference_type = _clean_text(payload.get("reference_type"))
    reference_id = _to_int(payload.get("reference_id"), "reference_id", required=False)
    notes = _clean_text(payload.get("notes"))

    if movement_type not in {"in", "out", "adjustment"}:
        raise HTTPException(status_code=400, detail="movement_type must be one of: in, out, adjustment")
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be greater than zero")

    warehouse = await _warehouse_exists_in_scope(db, warehouse_id, current_user)
    product = await _product_exists_in_scope(db, product_id, current_user)

    warehouse_factory_id = int(warehouse["factory_id"])
    product_factory_id = int(product["factory_id"] or 0)

    if product_factory_id != warehouse_factory_id:
        raise HTTPException(status_code=409, detail="Warehouse factory and product factory must match")

    current_stock = await _current_stock(db, warehouse_id, product_id)
    if movement_type == "out" and quantity > current_stock:
        raise HTTPException(status_code=409, detail=f"Insufficient stock. Current stock is {current_stock}")

    movement_id = await _insert_movement(
        db,
        factory_id=warehouse_factory_id,
        warehouse_id=warehouse_id,
        product_id=product_id,
        movement_type=movement_type,
        quantity=quantity,
        reference_type=reference_type,
        reference_id=reference_id,
        notes=notes,
        created_by_user_id=getattr(current_user, "id", None),
    )
    await db.commit()

    row = await db.execute(
        text(
            """
            SELECT
                im.id,
                im.factory_id,
                f.name AS factory_name,
                im.warehouse_id,
                w.name AS warehouse_name,
                w.code AS warehouse_code,
                im.product_id,
                p.name_ar AS product_name,
                p.sku AS product_sku,
                im.movement_type,
                im.quantity,
                im.reference_type,
                im.reference_id,
                im.notes,
                im.created_by_user_id,
                u.full_name AS created_by_name,
                im.created_at,
                im.updated_at
            FROM inventory_movements im
            JOIN warehouses w ON w.id = im.warehouse_id
            JOIN factories f ON f.id = im.factory_id
            JOIN products p ON p.id = im.product_id
            LEFT JOIN users u ON u.id = im.created_by_user_id
            WHERE im.id = :movement_id
            LIMIT 1
            """
        ),
        {"movement_id": movement_id},
    )
    return dict(row.mappings().first())


@router.post("/movements/transfer", status_code=status.HTTP_201_CREATED)
async def create_inventory_transfer(
    payload: dict,
    current_user: User = Depends(require_inventory_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_inventory_tables(db)

    from_warehouse_id = _to_int(payload.get("from_warehouse_id"), "from_warehouse_id", required=True)
    to_warehouse_id = _to_int(payload.get("to_warehouse_id"), "to_warehouse_id", required=True)
    product_id = _to_int(payload.get("product_id"), "product_id", required=True)
    quantity = _to_float(payload.get("quantity"), "quantity", required=True)
    notes = _clean_text(payload.get("notes"))
    reference_type = _clean_text(payload.get("reference_type")) or "warehouse_transfer"

    if from_warehouse_id == to_warehouse_id:
        raise HTTPException(status_code=400, detail="Source and destination warehouses must differ")
    if quantity <= 0:
        raise HTTPException(status_code=400, detail="quantity must be greater than zero")

    from_wh = await _warehouse_exists_in_scope(db, from_warehouse_id, current_user)
    to_wh = await _warehouse_exists_in_scope(db, to_warehouse_id, current_user)
    product = await _product_exists_in_scope(db, product_id, current_user)

    from_factory_id = int(from_wh["factory_id"])
    to_factory_id = int(to_wh["factory_id"])
    product_factory_id = int(product["factory_id"] or 0)

    if from_factory_id != to_factory_id:
        raise HTTPException(status_code=409, detail="Warehouse transfer must stay inside the same factory")
    if product_factory_id != from_factory_id:
        raise HTTPException(status_code=409, detail="Product factory must match transfer warehouse factory")

    current_stock = await _current_stock(db, from_warehouse_id, product_id)
    if quantity > current_stock:
        raise HTTPException(status_code=409, detail=f"Insufficient stock in source warehouse. Current stock is {current_stock}")

    out_movement_id = await _insert_movement(
        db,
        factory_id=from_factory_id,
        warehouse_id=from_warehouse_id,
        product_id=product_id,
        movement_type="out",
        quantity=quantity,
        reference_type=reference_type,
        reference_id=None,
        notes=notes or f"Warehouse transfer out to {to_wh['code']}",
        created_by_user_id=getattr(current_user, "id", None),
    )

    in_movement_id = await _insert_movement(
        db,
        factory_id=to_factory_id,
        warehouse_id=to_warehouse_id,
        product_id=product_id,
        movement_type="in",
        quantity=quantity,
        reference_type=reference_type,
        reference_id=out_movement_id,
        notes=notes or f"Warehouse transfer in from {from_wh['code']}",
        created_by_user_id=getattr(current_user, "id", None),
    )

    await db.execute(
        text(
            """
            UPDATE inventory_movements
            SET reference_id = :in_movement_id, updated_at = NOW()
            WHERE id = :out_movement_id
            """
        ),
        {"out_movement_id": out_movement_id, "in_movement_id": in_movement_id},
    )

    await db.commit()

    return {
        "ok": True,
        "factory_id": from_factory_id,
        "from_warehouse_id": from_warehouse_id,
        "to_warehouse_id": to_warehouse_id,
        "product_id": product_id,
        "quantity": quantity,
        "out_movement_id": out_movement_id,
        "in_movement_id": in_movement_id,
    }


@router.get("/stock-summary")
async def get_stock_summary(
    current_user: User = Depends(require_inventory_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_inventory_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    sql = """
        SELECT
            im.factory_id,
            f.name AS factory_name,
            im.warehouse_id,
            w.name AS warehouse_name,
            w.code AS warehouse_code,
            im.product_id,
            p.name_ar AS product_name,
            p.sku AS product_sku,
            COALESCE(SUM(
                CASE
                    WHEN im.movement_type = 'in' THEN im.quantity
                    WHEN im.movement_type = 'adjustment' THEN im.quantity
                    WHEN im.movement_type = 'out' THEN -im.quantity
                    ELSE 0
                END
            ), 0) AS current_stock
        FROM inventory_movements im
        JOIN warehouses w ON w.id = im.warehouse_id
        JOIN factories f ON f.id = im.factory_id
        JOIN products p ON p.id = im.product_id
    """
    params = {}

    if scoped_factory_id is not None:
        sql += " WHERE im.factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id

    sql += """
        GROUP BY
            im.factory_id, f.name,
            im.warehouse_id, w.name, w.code,
            im.product_id, p.name_ar, p.sku
        ORDER BY im.factory_id ASC, im.warehouse_id ASC, im.product_id ASC
    """
    result = await db.execute(text(sql), params)
    rows = result.mappings().all()
    return [dict(row) for row in rows]


@router.get("/warehouse-summary")
async def get_warehouse_summary(
    current_user: User = Depends(require_inventory_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_inventory_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    sql = """
        SELECT
            w.id AS warehouse_id,
            w.factory_id,
            f.name AS factory_name,
            w.code AS warehouse_code,
            w.name AS warehouse_name,
            w.is_active,
            COALESCE(COUNT(DISTINCT im.product_id), 0) AS products_count,
            COALESCE(COUNT(im.id), 0) AS movements_count,
            COALESCE(SUM(
                CASE
                    WHEN im.movement_type = 'in' THEN im.quantity
                    WHEN im.movement_type = 'adjustment' THEN im.quantity
                    WHEN im.movement_type = 'out' THEN -im.quantity
                    ELSE 0
                END
            ), 0) AS stock_units_total
        FROM warehouses w
        JOIN factories f ON f.id = w.factory_id
        LEFT JOIN inventory_movements im ON im.warehouse_id = w.id
    """
    params = {}

    if scoped_factory_id is not None:
        sql += " WHERE w.factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id

    sql += """
        GROUP BY w.id, w.factory_id, f.name, w.code, w.name, w.is_active
        ORDER BY w.id DESC
    """

    result = await db.execute(text(sql), params)
    return [dict(row) for row in result.mappings().all()]


@router.get("/reorder-rules")
async def list_reorder_rules(
    current_user: User = Depends(require_inventory_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_inventory_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    sql = """
        SELECT
            rr.id,
            rr.factory_id,
            f.name AS factory_name,
            rr.warehouse_id,
            w.name AS warehouse_name,
            w.code AS warehouse_code,
            rr.product_id,
            p.name_ar AS product_name,
            p.sku AS product_sku,
            rr.min_stock_level,
            rr.reorder_level,
            rr.reorder_quantity,
            rr.notes,
            rr.is_active,
            rr.created_by_user_id,
            u.full_name AS created_by_name,
            rr.created_at,
            rr.updated_at
        FROM inventory_reorder_rules rr
        JOIN factories f ON f.id = rr.factory_id
        JOIN warehouses w ON w.id = rr.warehouse_id
        JOIN products p ON p.id = rr.product_id
        LEFT JOIN users u ON u.id = rr.created_by_user_id
    """
    params = {}

    if scoped_factory_id is not None:
        sql += " WHERE rr.factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id

    sql += " ORDER BY rr.id DESC"
    result = await db.execute(text(sql), params)
    return [dict(row) for row in result.mappings().all()]


@router.post("/reorder-rules", status_code=status.HTTP_201_CREATED)
async def create_reorder_rule(
    payload: dict,
    current_user: User = Depends(require_inventory_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_inventory_tables(db)

    warehouse_id = _to_int(payload.get("warehouse_id"), "warehouse_id", required=True)
    product_id = _to_int(payload.get("product_id"), "product_id", required=True)
    min_stock_level = _to_float(payload.get("min_stock_level", 0), "min_stock_level", required=True)
    reorder_level = _to_float(payload.get("reorder_level", 0), "reorder_level", required=True)
    reorder_quantity = _to_float(payload.get("reorder_quantity", 0), "reorder_quantity", required=True)
    notes = _clean_text(payload.get("notes"))
    is_active = bool(payload.get("is_active", True))

    if min_stock_level < 0 or reorder_level < 0 or reorder_quantity < 0:
        raise HTTPException(status_code=400, detail="Reorder rule values cannot be negative")

    warehouse = await _warehouse_exists_in_scope(db, warehouse_id, current_user)
    product = await _product_exists_in_scope(db, product_id, current_user)
    factory_id = int(warehouse["factory_id"])
    if int(product["factory_id"] or 0) != factory_id:
        raise HTTPException(status_code=409, detail="Warehouse factory and product factory must match")

    duplicate = await db.execute(
        text(
            """
            SELECT id
            FROM inventory_reorder_rules
            WHERE warehouse_id = :warehouse_id
              AND product_id = :product_id
            LIMIT 1
            """
        ),
        {"warehouse_id": warehouse_id, "product_id": product_id},
    )
    if duplicate.first():
        raise HTTPException(status_code=409, detail="Reorder rule already exists for this warehouse/product")

    result = await db.execute(
        text(
            """
            INSERT INTO inventory_reorder_rules (
                factory_id,
                warehouse_id,
                product_id,
                min_stock_level,
                reorder_level,
                reorder_quantity,
                notes,
                is_active,
                created_by_user_id
            )
            VALUES (
                :factory_id,
                :warehouse_id,
                :product_id,
                :min_stock_level,
                :reorder_level,
                :reorder_quantity,
                :notes,
                :is_active,
                :created_by_user_id
            )
            RETURNING id
            """
        ),
        {
            "factory_id": factory_id,
            "warehouse_id": warehouse_id,
            "product_id": product_id,
            "min_stock_level": min_stock_level,
            "reorder_level": reorder_level,
            "reorder_quantity": reorder_quantity,
            "notes": notes,
            "is_active": is_active,
            "created_by_user_id": getattr(current_user, "id", None),
        },
    )
    rule_id = int(result.scalar_one())
    await db.commit()

    row = await db.execute(
        text(
            """
            SELECT
                rr.id,
                rr.factory_id,
                f.name AS factory_name,
                rr.warehouse_id,
                w.name AS warehouse_name,
                w.code AS warehouse_code,
                rr.product_id,
                p.name_ar AS product_name,
                p.sku AS product_sku,
                rr.min_stock_level,
                rr.reorder_level,
                rr.reorder_quantity,
                rr.notes,
                rr.is_active,
                rr.created_by_user_id,
                u.full_name AS created_by_name,
                rr.created_at,
                rr.updated_at
            FROM inventory_reorder_rules rr
            JOIN factories f ON f.id = rr.factory_id
            JOIN warehouses w ON w.id = rr.warehouse_id
            JOIN products p ON p.id = rr.product_id
            LEFT JOIN users u ON u.id = rr.created_by_user_id
            WHERE rr.id = :rule_id
            LIMIT 1
            """
        ),
        {"rule_id": rule_id},
    )
    return dict(row.mappings().first())


@router.put("/reorder-rules/{rule_id}")
async def update_reorder_rule(
    rule_id: int,
    payload: dict,
    current_user: User = Depends(require_inventory_manage),
    db: AsyncSession = Depends(get_db),
):
    await ensure_inventory_tables(db)

    result = await db.execute(
        text(
            """
            SELECT *
            FROM inventory_reorder_rules
            WHERE id = :rule_id
            LIMIT 1
            """
        ),
        {"rule_id": rule_id},
    )
    current = result.mappings().first()
    if not current:
        raise HTTPException(status_code=404, detail="Reorder rule not found")

    _enforce_target_factory(current_user, int(current["factory_id"]))

    min_stock_level = _to_float(payload.get("min_stock_level", current["min_stock_level"]), "min_stock_level", required=True)
    reorder_level = _to_float(payload.get("reorder_level", current["reorder_level"]), "reorder_level", required=True)
    reorder_quantity = _to_float(payload.get("reorder_quantity", current["reorder_quantity"]), "reorder_quantity", required=True)
    notes = _clean_text(payload.get("notes", current.get("notes")))
    is_active = bool(payload.get("is_active", current["is_active"]))

    if min_stock_level < 0 or reorder_level < 0 or reorder_quantity < 0:
        raise HTTPException(status_code=400, detail="Reorder rule values cannot be negative")

    await db.execute(
        text(
            """
            UPDATE inventory_reorder_rules
            SET
                min_stock_level = :min_stock_level,
                reorder_level = :reorder_level,
                reorder_quantity = :reorder_quantity,
                notes = :notes,
                is_active = :is_active,
                updated_at = NOW()
            WHERE id = :rule_id
            """
        ),
        {
            "rule_id": rule_id,
            "min_stock_level": min_stock_level,
            "reorder_level": reorder_level,
            "reorder_quantity": reorder_quantity,
            "notes": notes,
            "is_active": is_active,
        },
    )
    await db.commit()

    row = await db.execute(
        text(
            """
            SELECT
                rr.id,
                rr.factory_id,
                f.name AS factory_name,
                rr.warehouse_id,
                w.name AS warehouse_name,
                w.code AS warehouse_code,
                rr.product_id,
                p.name_ar AS product_name,
                p.sku AS product_sku,
                rr.min_stock_level,
                rr.reorder_level,
                rr.reorder_quantity,
                rr.notes,
                rr.is_active,
                rr.created_by_user_id,
                u.full_name AS created_by_name,
                rr.created_at,
                rr.updated_at
            FROM inventory_reorder_rules rr
            JOIN factories f ON f.id = rr.factory_id
            JOIN warehouses w ON w.id = rr.warehouse_id
            JOIN products p ON p.id = rr.product_id
            LEFT JOIN users u ON u.id = rr.created_by_user_id
            WHERE rr.id = :rule_id
            LIMIT 1
            """
        ),
        {"rule_id": rule_id},
    )
    return dict(row.mappings().first())


@router.get("/stock-alerts")
async def get_stock_alerts(
    current_user: User = Depends(require_inventory_view),
    db: AsyncSession = Depends(get_db),
):
    await ensure_inventory_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)

    sql = """
        WITH stock AS (
            SELECT
                im.factory_id,
                im.warehouse_id,
                im.product_id,
                COALESCE(SUM(
                    CASE
                        WHEN im.movement_type = 'in' THEN im.quantity
                        WHEN im.movement_type = 'adjustment' THEN im.quantity
                        WHEN im.movement_type = 'out' THEN -im.quantity
                        ELSE 0
                    END
                ), 0) AS current_stock
            FROM inventory_movements im
            GROUP BY im.factory_id, im.warehouse_id, im.product_id
        )
        SELECT
            rr.id AS reorder_rule_id,
            rr.factory_id,
            f.name AS factory_name,
            rr.warehouse_id,
            w.name AS warehouse_name,
            w.code AS warehouse_code,
            rr.product_id,
            p.name_ar AS product_name,
            p.sku AS product_sku,
            rr.min_stock_level,
            rr.reorder_level,
            rr.reorder_quantity,
            COALESCE(stock.current_stock, 0) AS current_stock,
            CASE
                WHEN COALESCE(stock.current_stock, 0) < 0 THEN 'negative_stock'
                WHEN COALESCE(stock.current_stock, 0) = 0 THEN 'out_of_stock'
                WHEN COALESCE(stock.current_stock, 0) <= rr.min_stock_level THEN 'below_min_stock'
                WHEN COALESCE(stock.current_stock, 0) <= rr.reorder_level THEN 'reorder_needed'
                ELSE 'healthy'
            END AS alert_status,
            rr.notes,
            rr.is_active
        FROM inventory_reorder_rules rr
        JOIN factories f ON f.id = rr.factory_id
        JOIN warehouses w ON w.id = rr.warehouse_id
        JOIN products p ON p.id = rr.product_id
        LEFT JOIN stock
            ON stock.factory_id = rr.factory_id
           AND stock.warehouse_id = rr.warehouse_id
           AND stock.product_id = rr.product_id
        WHERE rr.is_active = TRUE
    """
    params = {}

    if scoped_factory_id is not None:
        sql += " AND rr.factory_id = :factory_id"
        params["factory_id"] = scoped_factory_id

    sql += """
        ORDER BY
            CASE
                WHEN COALESCE(stock.current_stock, 0) < 0 THEN 1
                WHEN COALESCE(stock.current_stock, 0) = 0 THEN 2
                WHEN COALESCE(stock.current_stock, 0) <= rr.min_stock_level THEN 3
                WHEN COALESCE(stock.current_stock, 0) <= rr.reorder_level THEN 4
                ELSE 5
            END,
            rr.id DESC
    """

    result = await db.execute(text(sql), params)
    return [dict(row) for row in result.mappings().all()]


