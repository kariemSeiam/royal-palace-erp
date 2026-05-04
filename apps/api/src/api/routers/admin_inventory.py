from datetime import date, timedelta
from fastapi import APIRouter, Depends, HTTPException, Query, status
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
    return {str(code or "").strip().lower() for code in (permissions or set()) if str(code or "").strip()}

def _has_any_permission(permissions: set[str], *codes: str) -> bool:
    wanted = {str(code or "").strip().lower() for code in codes if str(code or "").strip()}
    return any(code in permissions for code in wanted)

async def require_inventory_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    normalized = _normalize_permission_set(permissions)
    if user.is_superuser: return user
    if not _has_any_permission(normalized, "inventory.view", "inventory.manage", "stock.view", "stock.manage", "warehouses.view", "warehouses.manage", "dashboard.view"):
        raise HTTPException(status_code=403, detail="Inventory access denied")
    return user

async def require_inventory_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    normalized = _normalize_permission_set(permissions)
    if user.is_superuser: return user
    if not _has_any_permission(normalized, "inventory.manage", "stock.manage", "warehouses.manage"):
        raise HTTPException(status_code=403, detail="Inventory management access denied")
    return user

def _scoped_factory_id_or_none(current_user: User):
    if getattr(current_user, "is_superuser", False): return None
    return get_user_factory_scope_id(current_user)

def _enforce_target_factory(current_user: User, target_factory_id: int | None):
    if getattr(current_user, "is_superuser", False): return
    scoped = _scoped_factory_id_or_none(current_user)
    if scoped is None: return
    if target_factory_id is None: raise HTTPException(status_code=403, detail="Factory scope is required")
    if int(scoped) != int(target_factory_id): raise HTTPException(status_code=403, detail="Access denied for this factory scope")

def _clean_text(value):
    if value is None: return None
    value = str(value).strip()
    return value or None

def _to_int(value, field_name: str, required: bool = False):
    if value in [None, ""]:
        if required: raise HTTPException(status_code=400, detail=f"{field_name} is required")
        return None
    try: return int(value)
    except: raise HTTPException(status_code=400, detail=f"Invalid {field_name}")

def _to_float(value, field_name: str, required: bool = False):
    if value in [None, ""]:
        if required: raise HTTPException(status_code=400, detail=f"{field_name} is required")
        return None
    try: return float(value)
    except: raise HTTPException(status_code=400, detail=f"Invalid {field_name}")

async def ensure_inventory_tables(db: AsyncSession):
    # existing tables + valuation layers + routes + putaway (fixed) + uom/packaging
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS inventory_reorder_rules (
            id SERIAL PRIMARY KEY, factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
            warehouse_id INTEGER NOT NULL REFERENCES warehouses(id) ON DELETE CASCADE,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            min_stock_level NUMERIC(14,2) NOT NULL DEFAULT 0, reorder_level NUMERIC(14,2) NOT NULL DEFAULT 0,
            reorder_quantity NUMERIC(14,2) NOT NULL DEFAULT 0, notes TEXT NULL,
            is_active BOOLEAN NOT NULL DEFAULT TRUE, created_by_user_id INTEGER NULL REFERENCES users(id) ON DELETE SET NULL,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await db.execute(text("CREATE UNIQUE INDEX IF NOT EXISTS uq_inventory_reorder_rules_wh_product ON inventory_reorder_rules(warehouse_id, product_id)"))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_inventory_reorder_rules_factory_id ON inventory_reorder_rules(factory_id)"))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS inventory_valuation_layers (
            id SERIAL PRIMARY KEY, factory_id INTEGER NOT NULL REFERENCES factories(id) ON DELETE RESTRICT,
            product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            movement_id INTEGER NULL REFERENCES inventory_movements(id) ON DELETE SET NULL,
            quantity NUMERIC(14,2) NOT NULL DEFAULT 0, unit_cost NUMERIC(14,2) NOT NULL DEFAULT 0,
            remaining_quantity NUMERIC(14,2) NOT NULL DEFAULT 0, method VARCHAR(10) NOT NULL DEFAULT 'FIFO',
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await db.execute(text("CREATE INDEX IF NOT EXISTS ix_val_layers_factory_product ON inventory_valuation_layers(factory_id, product_id)"))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS stock_routes (
            id SERIAL PRIMARY KEY, name VARCHAR(255) NOT NULL, code VARCHAR(50) UNIQUE NOT NULL,
            factory_id INTEGER NULL REFERENCES factories(id) ON DELETE CASCADE, is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(), updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS stock_route_rules (
            id SERIAL PRIMARY KEY, route_id INTEGER NOT NULL REFERENCES stock_routes(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL, sequence INTEGER DEFAULT 0, action VARCHAR(50) NOT NULL,
            location_src_id INTEGER NULL REFERENCES stock_locations(id) ON DELETE SET NULL,
            location_dest_id INTEGER NULL REFERENCES stock_locations(id) ON DELETE SET NULL,
            picking_type_id INTEGER NULL REFERENCES stock_picking_types(id) ON DELETE SET NULL,
            auto BOOLEAN DEFAULT FALSE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS stock_putaway_rules (
            id SERIAL PRIMARY KEY, product_id INTEGER NULL REFERENCES products(id) ON DELETE CASCADE,
            category_id INTEGER NULL,
            location_src_id INTEGER NULL REFERENCES stock_locations(id) ON DELETE SET NULL,
            location_out_id INTEGER NULL REFERENCES stock_locations(id) ON DELETE SET NULL,
            route_id INTEGER NULL REFERENCES stock_routes(id) ON DELETE CASCADE,
            is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS product_uom (
            id SERIAL PRIMARY KEY, name VARCHAR(100) NOT NULL, code VARCHAR(20) UNIQUE NOT NULL,
            factor NUMERIC(14,6) DEFAULT 1.0, rounding NUMERIC(14,6) DEFAULT 0.01,
            is_active BOOLEAN DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS product_packaging (
            id SERIAL PRIMARY KEY, product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
            name VARCHAR(255) NOT NULL, uom_id INTEGER NOT NULL REFERENCES product_uom(id),
            qty NUMERIC(14,2) DEFAULT 1.0, is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
    """))
    existing = await db.execute(text("SELECT COUNT(*) FROM stock_picking_types"))
    if existing.scalar() == 0:
        await db.execute(text("INSERT INTO stock_picking_types (name, code, sequence_code) VALUES ('Receipts', 'incoming', 'IN'), ('Delivery Orders', 'outgoing', 'OUT'), ('Internal Transfers', 'internal', 'INT') ON CONFLICT (code) DO NOTHING"))
    await db.commit()

async def _warehouse_exists_in_scope(db, warehouse_id, current_user):
    scoped = _scoped_factory_id_or_none(current_user)
    if scoped is None:
        result = await db.execute(text("SELECT id, factory_id, code, name, is_active FROM warehouses WHERE id = :wid LIMIT 1"), {"wid": warehouse_id})
    else:
        result = await db.execute(text("SELECT id, factory_id, code, name, is_active FROM warehouses WHERE id = :wid AND factory_id = :fid LIMIT 1"), {"wid": warehouse_id, "fid": scoped})
    row = result.mappings().first()
    if not row: raise HTTPException(status_code=404, detail="Warehouse not found")
    return row

async def _product_exists_in_scope(db, product_id, current_user):
    scoped = _scoped_factory_id_or_none(current_user)
    if scoped is None:
        result = await db.execute(text("SELECT id, factory_id, name_ar, sku, is_active FROM products WHERE id = :pid LIMIT 1"), {"pid": product_id})
    else:
        result = await db.execute(text("SELECT id, factory_id, name_ar, sku, is_active FROM products WHERE id = :pid AND factory_id = :fid LIMIT 1"), {"pid": product_id, "fid": scoped})
    row = result.mappings().first()
    if not row: raise HTTPException(status_code=404, detail="Product not found")
    return row

async def _current_stock(db, warehouse_id, product_id) -> float:
    stock_result = await db.execute(text("""
        SELECT COALESCE(SUM(
            CASE
                WHEN movement_type = 'in' THEN quantity
                WHEN movement_type = 'adjustment' THEN quantity
                WHEN movement_type = 'out' THEN -quantity
                ELSE 0
            END
        ), 0) AS current_stock
        FROM inventory_movements
        WHERE warehouse_id = :wid AND product_id = :pid
    """), {"wid": warehouse_id, "pid": product_id})
    return float(stock_result.scalar() or 0)

async def _insert_movement(db, *, factory_id, warehouse_id, product_id, movement_type, quantity, reference_type=None, reference_id=None, notes=None, created_by_user_id=None, unit_cost=None):
    result = await db.execute(text("""
        INSERT INTO inventory_movements (factory_id, warehouse_id, product_id, movement_type, quantity, reference_type, reference_id, notes, created_by_user_id)
        VALUES (:factory_id, :warehouse_id, :product_id, :movement_type, :quantity, :reference_type, :reference_id, :notes, :created_by_user_id)
        RETURNING id
    """), {
        "factory_id": factory_id, "warehouse_id": warehouse_id, "product_id": product_id,
        "movement_type": movement_type, "quantity": quantity,
        "reference_type": reference_type, "reference_id": reference_id, "notes": notes,
        "created_by_user_id": created_by_user_id,
    })
    movement_id = int(result.scalar_one())
    cost = unit_cost if unit_cost is not None else 0.0
    await db.execute(text("""
        INSERT INTO inventory_valuation_layers (factory_id, product_id, movement_id, quantity, unit_cost, remaining_quantity, method)
        VALUES (:fid, :pid, :mid, :qty, :cost, :rem, 'FIFO')
    """), {"fid": factory_id, "pid": product_id, "mid": movement_id, "qty": quantity, "cost": cost, "rem": quantity})
    return movement_id

@router.get("/warehouses")
async def list_warehouses(current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    scoped_factory_id = _scoped_factory_id_or_none(current_user)
    sql = """
        SELECT w.id, w.factory_id, f.name AS factory_name, w.code, w.name, w.description, w.is_active, w.created_at, w.updated_at,
            COALESCE((SELECT COUNT(*) FROM inventory_movements im WHERE im.warehouse_id = w.id),0) AS movements_count,
            COALESCE((SELECT COUNT(DISTINCT im.product_id) FROM inventory_movements im WHERE im.warehouse_id = w.id),0) AS products_count,
            COALESCE((SELECT SUM(CASE WHEN im.movement_type='in' THEN im.quantity WHEN im.movement_type='adjustment' THEN im.quantity WHEN im.movement_type='out' THEN -im.quantity ELSE 0 END) FROM inventory_movements im WHERE im.warehouse_id = w.id),0) AS stock_units_total
        FROM warehouses w JOIN factories f ON f.id = w.factory_id
    """
    params = {}
    if scoped_factory_id is not None: sql += " WHERE w.factory_id = :factory_id"; params["factory_id"] = scoped_factory_id
    sql += " ORDER BY w.id DESC"
    result = await db.execute(text(sql), params)
    return [dict(row) for row in result.mappings().all()]

@router.post("/warehouses", status_code=status.HTTP_201_CREATED)
async def create_warehouse(payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    factory_id = _to_int(payload.get("factory_id"), "factory_id", required=True)
    code = _clean_text(payload.get("code"))
    name = _clean_text(payload.get("name"))
    if not code or not name: raise HTTPException(status_code=400, detail="code and name are required")
    _enforce_target_factory(current_user, factory_id)
    result = await db.execute(text("INSERT INTO warehouses (factory_id, code, name, description, is_active) VALUES (:factory_id, :code, :name, :description, :is_active) RETURNING id"), {
        "factory_id": factory_id, "code": code, "name": name, "description": _clean_text(payload.get("description")), "is_active": bool(payload.get("is_active", True))
    })
    warehouse_id = int(result.scalar_one())
    await db.commit()
    row = await db.execute(text("SELECT w.*, f.name AS factory_name, 0 AS movements_count, 0 AS products_count, 0 AS stock_units_total FROM warehouses w JOIN factories f ON f.id = w.factory_id WHERE w.id = :wid"), {"wid": warehouse_id})
    return dict(row.mappings().first())

@router.put("/warehouses/{warehouse_id}")
async def update_warehouse(warehouse_id: int, payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    existing = await _warehouse_exists_in_scope(db, warehouse_id, current_user)
    await db.execute(text("UPDATE warehouses SET code=:code, name=:name, description=:desc, is_active=:active, updated_at=NOW() WHERE id=:wid"), {
        "wid": warehouse_id, "code": payload.get("code", existing["code"]), "name": payload.get("name", existing["name"]),
        "desc": _clean_text(payload.get("description", existing.get("description"))), "active": bool(payload.get("is_active", existing["is_active"]))
    })
    await db.commit()
    row = await db.execute(text("SELECT w.*, f.name AS factory_name FROM warehouses w JOIN factories f ON f.id = w.factory_id WHERE w.id = :wid"), {"wid": warehouse_id})
    return dict(row.mappings().first())

@router.delete("/warehouses/{warehouse_id}")
async def delete_warehouse(warehouse_id: int, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    existing = await _warehouse_exists_in_scope(db, warehouse_id, current_user)
    if (await db.execute(text("SELECT 1 FROM inventory_movements WHERE warehouse_id = :wid LIMIT 1"), {"wid": warehouse_id})).first():
        raise HTTPException(status_code=409, detail="Cannot delete warehouse with movements")
    await db.execute(text("DELETE FROM warehouses WHERE id = :wid"), {"wid": warehouse_id})
    await db.commit()
    return {"message": "Warehouse deleted"}

@router.get("/movements")
async def list_movements(current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db),
                         limit: int = Query(100, ge=1), offset: int = Query(0, ge=0),
                         movement_type: str = Query(None), warehouse_id: int = Query(None), product_id: int = Query(None)):
    await ensure_inventory_tables(db)
    scoped = _scoped_factory_id_or_none(current_user)
    sql = """
        SELECT im.*, f.name AS factory_name, w.name AS warehouse_name, w.code AS warehouse_code,
               p.name_ar AS product_name, p.sku AS product_sku, u.full_name AS created_by_name
        FROM inventory_movements im
        JOIN warehouses w ON w.id = im.warehouse_id
        JOIN factories f ON f.id = im.factory_id
        JOIN products p ON p.id = im.product_id
        LEFT JOIN users u ON u.id = im.created_by_user_id
    """
    params = {}
    conditions = []
    if scoped is not None: conditions.append("im.factory_id = :factory_id"); params["factory_id"] = scoped
    if movement_type: conditions.append("im.movement_type = :mtype"); params["mtype"] = movement_type
    if warehouse_id: conditions.append("im.warehouse_id = :wid"); params["wid"] = warehouse_id
    if product_id: conditions.append("im.product_id = :pid"); params["pid"] = product_id
    if conditions: sql += " WHERE " + " AND ".join(conditions)
    sql += " ORDER BY im.id DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit; params["offset"] = offset
    result = await db.execute(text(sql), params)
    return [dict(row) for row in result.mappings().all()]

@router.post("/movements", status_code=status.HTTP_201_CREATED)
async def create_movement(payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    warehouse_id = _to_int(payload.get("warehouse_id"), "warehouse_id", required=True)
    product_id = _to_int(payload.get("product_id"), "product_id", required=True)
    movement_type = str(payload.get("movement_type") or "").strip().lower()
    quantity = _to_float(payload.get("quantity"), "quantity", required=True)
    if movement_type not in {"in", "out", "adjustment"}: raise HTTPException(status_code=400, detail="Invalid movement_type")
    if quantity <= 0: raise HTTPException(status_code=400, detail="Quantity must be > 0")
    wh = await _warehouse_exists_in_scope(db, warehouse_id, current_user)
    prod = await _product_exists_in_scope(db, product_id, current_user)
    factory_id = int(wh["factory_id"])
    if int(prod["factory_id"] or 0) != factory_id: raise HTTPException(status_code=409, detail="Factory mismatch")
    if movement_type == "out":
        stock = await _current_stock(db, warehouse_id, product_id)
        if quantity > stock: raise HTTPException(status_code=409, detail=f"Insufficient stock: {stock}")
    mid = await _insert_movement(db, factory_id=factory_id, warehouse_id=warehouse_id, product_id=product_id, movement_type=movement_type, quantity=quantity, reference_type=_clean_text(payload.get("reference_type")), reference_id=_to_int(payload.get("reference_id")), notes=_clean_text(payload.get("notes")), created_by_user_id=getattr(current_user, "id", None), unit_cost=payload.get("unit_cost"))
    await db.commit()
    row = await db.execute(text("SELECT im.*, f.name AS factory_name, w.name AS warehouse_name, w.code AS warehouse_code, p.name_ar AS product_name, p.sku AS product_sku, u.full_name AS created_by_name FROM inventory_movements im JOIN warehouses w ON w.id=im.warehouse_id JOIN factories f ON f.id=im.factory_id JOIN products p ON p.id=im.product_id LEFT JOIN users u ON u.id=im.created_by_user_id WHERE im.id=:mid"), {"mid": mid})
    return dict(row.mappings().first())

@router.put("/movements/{movement_id}")
async def update_movement(movement_id: int, payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    result = await db.execute(text("SELECT * FROM inventory_movements WHERE id = :mid LIMIT 1"), {"mid": movement_id})
    mov = result.mappings().first()
    if not mov: raise HTTPException(status_code=404, detail="Movement not found")
    wh = await _warehouse_exists_in_scope(db, int(mov["warehouse_id"]), current_user)
    new_qty = _to_float(payload.get("quantity", mov["quantity"]), "quantity")
    if new_qty <= 0: raise HTTPException(status_code=400, detail="Quantity > 0")
    await db.execute(text("UPDATE inventory_movements SET quantity=:qty, notes=:notes, updated_at=NOW() WHERE id=:mid"), {"qty": new_qty, "notes": _clean_text(payload.get("notes", mov.get("notes"))), "mid": movement_id})
    await db.commit()
    row = await db.execute(text("SELECT im.*, f.name AS factory_name, w.name AS warehouse_name, w.code AS warehouse_code, p.name_ar AS product_name, p.sku AS product_sku, u.full_name AS created_by_name FROM inventory_movements im JOIN warehouses w ON w.id=im.warehouse_id JOIN factories f ON f.id=im.factory_id JOIN products p ON p.id=im.product_id LEFT JOIN users u ON u.id=im.created_by_user_id WHERE im.id=:mid"), {"mid": movement_id})
    return dict(row.mappings().first())

@router.delete("/movements/{movement_id}")
async def delete_movement(movement_id: int, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    result = await db.execute(text("SELECT * FROM inventory_movements WHERE id = :mid LIMIT 1"), {"mid": movement_id})
    mov = result.mappings().first()
    if not mov: raise HTTPException(status_code=404, detail="Movement not found")
    wh = await _warehouse_exists_in_scope(db, int(mov["warehouse_id"]), current_user)
    await db.execute(text("DELETE FROM inventory_movements WHERE id = :mid"), {"mid": movement_id})
    await db.commit()
    return {"message": "Movement deleted"}

@router.post("/movements/transfer", status_code=status.HTTP_201_CREATED)
async def transfer(payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    from_wh = _to_int(payload.get("from_warehouse_id"), "from_warehouse_id", required=True)
    to_wh = _to_int(payload.get("to_warehouse_id"), "to_warehouse_id", required=True)
    product_id = _to_int(payload.get("product_id"), "product_id", required=True)
    quantity = _to_float(payload.get("quantity"), "quantity", required=True)
    if from_wh == to_wh: raise HTTPException(status_code=400, detail="Same warehouse")
    if quantity <= 0: raise HTTPException(status_code=400, detail="Quantity must be > 0")
    f_wh = await _warehouse_exists_in_scope(db, from_wh, current_user)
    t_wh = await _warehouse_exists_in_scope(db, to_wh, current_user)
    prod = await _product_exists_in_scope(db, product_id, current_user)
    factory_id = int(f_wh["factory_id"])
    if int(t_wh["factory_id"]) != factory_id or int(prod["factory_id"] or 0) != factory_id:
        raise HTTPException(status_code=409, detail="Factory mismatch")
    stock = await _current_stock(db, from_wh, product_id)
    if quantity > stock: raise HTTPException(status_code=409, detail="Insufficient stock")
    out_id = await _insert_movement(db, factory_id=factory_id, warehouse_id=from_wh, product_id=product_id, movement_type="out", quantity=quantity, reference_type="warehouse_transfer", notes=f"Transfer to {t_wh['code']}", created_by_user_id=getattr(current_user, "id", None))
    in_id = await _insert_movement(db, factory_id=factory_id, warehouse_id=to_wh, product_id=product_id, movement_type="in", quantity=quantity, reference_type="warehouse_transfer", reference_id=out_id, notes=f"Transfer from {f_wh['code']}", created_by_user_id=getattr(current_user, "id", None))
    await db.execute(text("UPDATE inventory_movements SET reference_id = :in_id WHERE id = :out_id"), {"out_id": out_id, "in_id": in_id})
    await db.commit()
    return {"ok": True, "from_warehouse_id": from_wh, "to_warehouse_id": to_wh, "product_id": product_id, "quantity": quantity, "out_movement_id": out_id, "in_movement_id": in_id}

@router.get("/stock-summary")
async def stock_summary(current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db), limit: int=100, offset: int=0):
    await ensure_inventory_tables(db)
    scoped = _scoped_factory_id_or_none(current_user)
    sql = """
        SELECT im.factory_id, f.name AS factory_name, im.warehouse_id, w.name AS warehouse_name, w.code AS warehouse_code,
               im.product_id, p.name_ar AS product_name, p.sku AS product_sku,
               COALESCE(SUM(CASE WHEN im.movement_type='in' THEN im.quantity WHEN im.movement_type='adjustment' THEN im.quantity WHEN im.movement_type='out' THEN -im.quantity ELSE 0 END),0) AS current_stock
        FROM inventory_movements im
        JOIN warehouses w ON w.id=im.warehouse_id JOIN factories f ON f.id=im.factory_id JOIN products p ON p.id=im.product_id
    """
    params = {}
    if scoped is not None: sql += " WHERE im.factory_id = :fid"; params["fid"] = scoped
    sql += " GROUP BY im.factory_id, f.name, im.warehouse_id, w.name, w.code, im.product_id, p.name_ar, p.sku ORDER BY im.factory_id, im.warehouse_id, im.product_id LIMIT :limit OFFSET :offset"
    params["limit"] = limit; params["offset"] = offset
    result = await db.execute(text(sql), params)
    return [dict(row) for row in result.mappings().all()]

@router.get("/warehouse-summary")
async def warehouse_summary(current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    scoped = _scoped_factory_id_or_none(current_user)
    sql = """
        SELECT w.id AS warehouse_id, w.factory_id, f.name AS factory_name, w.code AS warehouse_code, w.name AS warehouse_name, w.is_active,
               COALESCE(COUNT(DISTINCT im.product_id),0) AS products_count, COALESCE(COUNT(im.id),0) AS movements_count,
               COALESCE(SUM(CASE WHEN im.movement_type='in' THEN im.quantity WHEN im.movement_type='adjustment' THEN im.quantity WHEN im.movement_type='out' THEN -im.quantity ELSE 0 END),0) AS stock_units_total
        FROM warehouses w JOIN factories f ON f.id = w.factory_id LEFT JOIN inventory_movements im ON im.warehouse_id = w.id
    """
    params = {}
    if scoped is not None: sql += " WHERE w.factory_id = :fid"; params["fid"] = scoped
    sql += " GROUP BY w.id, w.factory_id, f.name, w.code, w.name, w.is_active ORDER BY w.id DESC"
    result = await db.execute(text(sql), params)
    return [dict(row) for row in result.mappings().all()]

@router.get("/reorder-rules")
async def list_reorder_rules(current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db), limit: int=100, offset: int=0):
    await ensure_inventory_tables(db)
    scoped = _scoped_factory_id_or_none(current_user)
    sql = """
        SELECT rr.*, f.name AS factory_name, w.name AS warehouse_name, w.code AS warehouse_code,
               p.name_ar AS product_name, p.sku AS product_sku, u.full_name AS created_by_name
        FROM inventory_reorder_rules rr
        JOIN factories f ON f.id = rr.factory_id JOIN warehouses w ON w.id = rr.warehouse_id
        JOIN products p ON p.id = rr.product_id LEFT JOIN users u ON u.id = rr.created_by_user_id
    """
    params = {}
    if scoped is not None: sql += " WHERE rr.factory_id = :fid"; params["fid"] = scoped
    sql += " ORDER BY rr.id DESC LIMIT :limit OFFSET :offset"
    params["limit"] = limit; params["offset"] = offset
    result = await db.execute(text(sql), params)
    return [dict(row) for row in result.mappings().all()]

@router.post("/reorder-rules", status_code=201)
async def create_reorder_rule(payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    warehouse_id = _to_int(payload.get("warehouse_id"), "warehouse_id", required=True)
    product_id = _to_int(payload.get("product_id"), "product_id", required=True)
    min_stock = _to_float(payload.get("min_stock_level", 0), "min_stock_level")
    reorder_level = _to_float(payload.get("reorder_level", 0), "reorder_level")
    reorder_qty = _to_float(payload.get("reorder_quantity", 0), "reorder_quantity")
    wh = await _warehouse_exists_in_scope(db, warehouse_id, current_user)
    prod = await _product_exists_in_scope(db, product_id, current_user)
    factory_id = int(wh["factory_id"])
    if int(prod["factory_id"] or 0) != factory_id: raise HTTPException(status_code=409, detail="Factory mismatch")
    if (await db.execute(text("SELECT 1 FROM inventory_reorder_rules WHERE warehouse_id=:wid AND product_id=:pid"), {"wid": warehouse_id, "pid": product_id})).first():
        raise HTTPException(status_code=409, detail="Rule already exists")
    result = await db.execute(text("INSERT INTO inventory_reorder_rules (factory_id, warehouse_id, product_id, min_stock_level, reorder_level, reorder_quantity, notes, is_active, created_by_user_id) VALUES (:fid,:wid,:pid,:min,:re,:qty,:notes,:active,:uid) RETURNING id"), {
        "fid": factory_id, "wid": warehouse_id, "pid": product_id, "min": min_stock, "re": reorder_level, "qty": reorder_qty,
        "notes": _clean_text(payload.get("notes")), "active": bool(payload.get("is_active", True)), "uid": getattr(current_user, "id", None)
    })
    rid = int(result.scalar_one())
    await db.commit()
    row = await db.execute(text("SELECT rr.*, f.name AS factory_name, w.name AS warehouse_name, w.code AS warehouse_code, p.name_ar AS product_name, p.sku AS product_sku, u.full_name AS created_by_name FROM inventory_reorder_rules rr JOIN factories f ON f.id=rr.factory_id JOIN warehouses w ON w.id=rr.warehouse_id JOIN products p ON p.id=rr.product_id LEFT JOIN users u ON u.id=rr.created_by_user_id WHERE rr.id=:rid"), {"rid": rid})
    return dict(row.mappings().first())

@router.put("/reorder-rules/{rule_id}")
async def update_reorder_rule(rule_id: int, payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    result = await db.execute(text("SELECT * FROM inventory_reorder_rules WHERE id=:rid"), {"rid": rule_id})
    current = result.mappings().first()
    if not current: raise HTTPException(status_code=404, detail="Rule not found")
    _enforce_target_factory(current_user, int(current["factory_id"]))
    await db.execute(text("UPDATE inventory_reorder_rules SET min_stock_level=:min, reorder_level=:re, reorder_quantity=:qty, notes=:notes, is_active=:active, updated_at=NOW() WHERE id=:rid"), {
        "rid": rule_id, "min": _to_float(payload.get("min_stock_level", current["min_stock_level"]), "min"),
        "re": _to_float(payload.get("reorder_level", current["reorder_level"]), "re"),
        "qty": _to_float(payload.get("reorder_quantity", current["reorder_quantity"]), "qty"),
        "notes": _clean_text(payload.get("notes", current.get("notes"))), "active": bool(payload.get("is_active", current["is_active"]))
    })
    await db.commit()
    row = await db.execute(text("SELECT rr.*, f.name AS factory_name, w.name AS warehouse_name, w.code AS warehouse_code, p.name_ar AS product_name, p.sku AS product_sku, u.full_name AS created_by_name FROM inventory_reorder_rules rr JOIN factories f ON f.id=rr.factory_id JOIN warehouses w ON w.id=rr.warehouse_id JOIN products p ON p.id=rr.product_id LEFT JOIN users u ON u.id=rr.created_by_user_id WHERE rr.id=:rid"), {"rid": rule_id})
    return dict(row.mappings().first())

@router.delete("/reorder-rules/{rule_id}")
async def delete_reorder_rule(rule_id: int, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    result = await db.execute(text("SELECT * FROM inventory_reorder_rules WHERE id=:rid"), {"rid": rule_id})
    current = result.mappings().first()
    if not current: raise HTTPException(status_code=404, detail="Rule not found")
    _enforce_target_factory(current_user, int(current["factory_id"]))
    await db.execute(text("DELETE FROM inventory_reorder_rules WHERE id=:rid"), {"rid": rule_id})
    await db.commit()
    return {"message": "Reorder rule deleted"}

@router.get("/stock-alerts")
async def stock_alerts(current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    scoped = _scoped_factory_id_or_none(current_user)
    sql = """
        WITH stock AS (
            SELECT im.factory_id, im.warehouse_id, im.product_id,
                   COALESCE(SUM(CASE WHEN im.movement_type='in' THEN im.quantity WHEN im.movement_type='adjustment' THEN im.quantity WHEN im.movement_type='out' THEN -im.quantity ELSE 0 END),0) AS current_stock
            FROM inventory_movements im GROUP BY im.factory_id, im.warehouse_id, im.product_id
        )
        SELECT rr.*, f.name AS factory_name, w.name AS warehouse_name, w.code AS warehouse_code,
               p.name_ar AS product_name, p.sku AS product_sku,
               COALESCE(stock.current_stock,0) AS current_stock,
               CASE
                  WHEN COALESCE(stock.current_stock,0) < 0 THEN 'negative_stock'
                  WHEN COALESCE(stock.current_stock,0) = 0 THEN 'out_of_stock'
                  WHEN COALESCE(stock.current_stock,0) <= rr.min_stock_level THEN 'below_min_stock'
                  WHEN COALESCE(stock.current_stock,0) <= rr.reorder_level THEN 'reorder_needed'
                  ELSE 'healthy'
               END AS alert_status
        FROM inventory_reorder_rules rr
        JOIN factories f ON f.id = rr.factory_id
        JOIN warehouses w ON w.id = rr.warehouse_id
        JOIN products p ON p.id = rr.product_id
        LEFT JOIN stock ON stock.factory_id = rr.factory_id AND stock.warehouse_id = rr.warehouse_id AND stock.product_id = rr.product_id
        WHERE rr.is_active = TRUE
    """
    params = {}
    if scoped is not None: sql += " AND rr.factory_id = :fid"; params["fid"] = scoped
    sql += " ORDER BY CASE WHEN COALESCE(stock.current_stock,0) < 0 THEN 1 WHEN COALESCE(stock.current_stock,0)=0 THEN 2 WHEN COALESCE(stock.current_stock,0) <= rr.min_stock_level THEN 3 ELSE 4 END, rr.id DESC"
    result = await db.execute(text(sql), params)
    return [dict(row) for row in result.mappings().all()]

@router.get("/stock-valuation")
async def stock_valuation(current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db), product_id: int = Query(None), method: str = Query("FIFO")):
    await ensure_inventory_tables(db)
    scoped = _scoped_factory_id_or_none(current_user)
    sql = """
        SELECT vl.*, p.name_ar AS product_name, p.sku AS product_sku, f.name AS factory_name
        FROM inventory_valuation_layers vl
        JOIN products p ON p.id = vl.product_id JOIN factories f ON f.id = vl.factory_id
    """
    params = {}
    conditions = []
    if scoped is not None: conditions.append("vl.factory_id = :fid"); params["fid"] = scoped
    if product_id: conditions.append("vl.product_id = :pid"); params["pid"] = product_id
    if conditions: sql += " WHERE " + " AND ".join(conditions)
    sql += " AND vl.method = :method ORDER BY vl.created_at ASC LIMIT 500"
    params["method"] = method
    result = await db.execute(text(sql), params)
    return [dict(row) for row in result.mappings().all()]

@router.get("/dashboard-detailed")
async def inventory_dashboard_detailed(current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    scoped = _scoped_factory_id_or_none(current_user)
    params = {}
    wh_filter = ""
    if scoped is not None: params["fid"] = scoped; wh_filter = " WHERE factory_id = :fid"
    total_warehouses = (await db.execute(text(f"SELECT COUNT(*) FROM warehouses {wh_filter}"), params)).scalar()
    total_movements = (await db.execute(text(f"SELECT COUNT(*) FROM inventory_movements {wh_filter}"), params)).scalar()
    total_products = (await db.execute(text(f"SELECT COUNT(DISTINCT product_id) FROM inventory_movements {wh_filter}"), params)).scalar()

    idle_threshold = date.today() - timedelta(days=30)
    params["idle_date"] = idle_threshold
    idle_products = await db.execute(text(f"""
        SELECT p.id, p.name_ar, p.sku, COALESCE(s.current_stock, 0) as current_stock
        FROM products p
        LEFT JOIN (
            SELECT product_id, SUM(CASE WHEN movement_type='in' THEN quantity WHEN movement_type='adjustment' THEN quantity WHEN movement_type='out' THEN -quantity ELSE 0 END) as current_stock
            FROM inventory_movements {wh_filter + " AND " if wh_filter else " WHERE "} created_at <= :idle_date
            GROUP BY product_id
        ) s ON s.product_id = p.id
        WHERE p.is_active = true
          AND NOT EXISTS (
              SELECT 1 FROM inventory_movements im
              WHERE im.product_id = p.id AND im.created_at > :idle_date
          )
          AND COALESCE(s.current_stock, 0) > 0
        ORDER BY COALESCE(s.current_stock, 0) DESC LIMIT 10
    """), params)
    idle_list = [{"product_id": row.product_id, "product_name": row.name_ar or row.sku, "current_stock": float(row.current_stock)} for row in idle_products]

    top_moved = await db.execute(text(f"""
        SELECT p.id, p.name_ar, p.sku, COUNT(im.id) as movement_count
        FROM inventory_movements im JOIN products p ON p.id = im.product_id {wh_filter}
        GROUP BY p.id, p.name_ar, p.sku ORDER BY movement_count DESC LIMIT 10
    """), params)
    top_moved_list = [{"product_id": row.id, "product_name": row.name_ar or row.sku, "movement_count": row.movement_count} for row in top_moved]

    movement_types = await db.execute(text(f"""
        SELECT movement_type, COUNT(*) as cnt FROM inventory_movements {wh_filter} GROUP BY movement_type
    """), params)
    type_counts = {"in": 0, "out": 0, "adjustment": 0}
    for row in movement_types:
        if row.movement_type in type_counts: type_counts[row.movement_type] = row.cnt

    stock_value = await db.execute(text(f"""
        SELECT COALESCE(SUM(unit_cost * remaining_quantity), 0) FROM inventory_valuation_layers {wh_filter}
    """), params)
    total_value = float(stock_value.scalar() or 0)

    return {
        "total_warehouses": int(total_warehouses or 0), "total_movements": int(total_movements or 0),
        "total_products_in_stock": int(total_products or 0), "total_stock_value": total_value,
        "idle_products": idle_list, "top_moved_products": top_moved_list,
        "movement_type_distribution": type_counts, "factory_scope": scoped
    }

@router.get("/routes")
async def list_routes(current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    scoped = _scoped_factory_id_or_none(current_user)
    sql = "SELECT * FROM stock_routes"
    params = {}
    if scoped is not None: sql += " WHERE factory_id = :fid OR factory_id IS NULL"; params["fid"] = scoped
    result = await db.execute(text(sql), params)
    return [dict(r) for r in result.mappings().all()]

@router.post("/routes", status_code=201)
async def create_route(payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    result = await db.execute(text("INSERT INTO stock_routes (name, code, factory_id) VALUES (:n, :c, :fid) RETURNING id"), {"n": payload["name"], "c": payload["code"], "fid": payload.get("factory_id")})
    rid = result.scalar_one()
    await db.commit()
    return {"id": rid}

@router.get("/route-rules/{route_id}")
async def list_route_rules(route_id: int, current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    result = await db.execute(text("SELECT * FROM stock_route_rules WHERE route_id = :rid ORDER BY sequence"), {"rid": route_id})
    return [dict(r) for r in result.mappings().all()]

@router.post("/route-rules", status_code=201)
async def create_route_rule(payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    await db.execute(text("INSERT INTO stock_route_rules (route_id, name, sequence, action, location_src_id, location_dest_id, picking_type_id, auto) VALUES (:rid, :n, :seq, :act, :src, :dest, :ptid, :auto)"), {
        "rid": payload["route_id"], "n": payload["name"], "seq": payload.get("sequence", 0),
        "act": payload["action"], "src": payload.get("location_src_id"), "dest": payload.get("location_dest_id"),
        "ptid": payload.get("picking_type_id"), "auto": payload.get("auto", False)
    })
    await db.commit()
    return {"message": "Rule created"}

@router.get("/putaway-rules")
async def list_putaway_rules(current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    result = await db.execute(text("SELECT * FROM stock_putaway_rules"))
    return [dict(r) for r in result.mappings().all()]

@router.post("/putaway-rules", status_code=201)
async def create_putaway_rule(payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    await db.execute(text("INSERT INTO stock_putaway_rules (product_id, category_id, location_src_id, location_out_id, route_id) VALUES (:pid, :cid, :src, :out, :rid)"), {
        "pid": payload.get("product_id"), "cid": payload.get("category_id"),
        "src": payload.get("location_src_id"), "out": payload.get("location_out_id"), "rid": payload.get("route_id")
    })
    await db.commit()
    return {"message": "Putaway rule created"}

@router.get("/uom")
async def list_uom(current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    result = await db.execute(text("SELECT * FROM product_uom"))
    return [dict(r) for r in result.mappings().all()]

@router.post("/uom", status_code=201)
async def create_uom(payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    await db.execute(text("INSERT INTO product_uom (name, code, factor, rounding) VALUES (:n, :c, :f, :r)"), {"n": payload["name"], "c": payload["code"], "f": payload.get("factor",1.0), "r": payload.get("rounding",0.01)})
    await db.commit()
    return {"message": "UoM created"}

@router.get("/packaging")
async def list_packaging(current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    result = await db.execute(text("SELECT pp.*, p.name_ar as product_name, u.name as uom_name FROM product_packaging pp JOIN products p ON p.id=pp.product_id JOIN product_uom u ON u.id=pp.uom_id"))
    return [dict(r) for r in result.mappings().all()]

@router.post("/packaging", status_code=201)
async def create_packaging(payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    await db.execute(text("INSERT INTO product_packaging (product_id, name, uom_id, qty) VALUES (:pid, :n, :uid, :qty)"), {"pid": payload["product_id"], "n": payload["name"], "uid": payload["uom_id"], "qty": payload.get("qty",1.0)})
    await db.commit()
    return {"message": "Packaging created"}

@router.get("/stock-ledger")
async def stock_ledger(product_id: int, current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    result = await db.execute(text("""
        SELECT im.id, im.movement_type, im.quantity, im.warehouse_id, w.name as warehouse_name, im.reference_type, im.reference_id, im.created_at
        FROM inventory_movements im
        JOIN warehouses w ON w.id = im.warehouse_id
        WHERE im.product_id = :pid
        ORDER BY im.id DESC
        LIMIT 200
    """), {"pid": product_id})
    return [dict(r) for r in result.mappings().all()]

@router.post("/reserve")
async def reserve_stock(payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    wh_id = payload["warehouse_id"]
    prod_id = payload["product_id"]
    qty = float(payload["quantity"])
    stock = await _current_stock(db, wh_id, prod_id)
    if qty > stock:
        raise HTTPException(409, f"Insufficient stock: {stock}")
    await db.execute(text("""
        INSERT INTO stock_quants (product_id, location_id, quantity, reserved_quantity)
        VALUES (:pid, (SELECT id FROM stock_locations WHERE code='WH/Reserve' LIMIT 1), 0, :qty)
    """), {"pid": prod_id, "qty": qty})
    await db.commit()
    return {"message": "Reserved"}

@router.post("/movements/with-lot")
async def create_movement_with_lot(payload: dict, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    warehouse_id = _to_int(payload.get("warehouse_id"), "warehouse_id", required=True)
    product_id = _to_int(payload.get("product_id"), "product_id", required=True)
    movement_type = str(payload.get("movement_type") or "").strip().lower()
    quantity = _to_float(payload.get("quantity"), "quantity", required=True)
    lot_id = _to_int(payload.get("lot_id"), "lot_id")
    if movement_type not in {"in", "out", "adjustment"}: raise HTTPException(status_code=400, detail="Invalid movement_type")
    if quantity <= 0: raise HTTPException(status_code=400, detail="Quantity must be > 0")
    wh = await _warehouse_exists_in_scope(db, warehouse_id, current_user)
    prod = await _product_exists_in_scope(db, product_id, current_user)
    factory_id = int(wh["factory_id"])
    if int(prod["factory_id"] or 0) != factory_id: raise HTTPException(status_code=409, detail="Factory mismatch")
    if movement_type == "out":
        stock = await _current_stock(db, warehouse_id, product_id)
        if quantity > stock: raise HTTPException(status_code=409, detail=f"Insufficient stock: {stock}")
    result = await db.execute(text("""
        INSERT INTO inventory_movements (factory_id, warehouse_id, product_id, movement_type, quantity, lot_id, reference_type, reference_id, notes, created_by_user_id)
        VALUES (:factory_id, :warehouse_id, :product_id, :movement_type, :quantity, :lot_id, :reference_type, :reference_id, :notes, :created_by_user_id)
        RETURNING id
    """), {
        "factory_id": factory_id, "warehouse_id": warehouse_id, "product_id": product_id,
        "movement_type": movement_type, "quantity": quantity, "lot_id": lot_id,
        "reference_type": _clean_text(payload.get("reference_type")), "reference_id": _to_int(payload.get("reference_id")),
        "notes": _clean_text(payload.get("notes")), "created_by_user_id": getattr(current_user, "id", None),
    })
    movement_id = int(result.scalar_one())
    # valuation layer
    await db.execute(text("""
        INSERT INTO inventory_valuation_layers (factory_id, product_id, movement_id, quantity, unit_cost, remaining_quantity, method)
        VALUES (:fid, :pid, :mid, :qty, :cost, :rem, 'FIFO')
    """), {"fid": factory_id, "pid": product_id, "mid": movement_id, "qty": quantity, "cost": payload.get("unit_cost", 0), "rem": quantity})
    await db.commit()
    return {"id": movement_id}

@router.get("/lot-trace/{lot_id}")
async def trace_lot(lot_id: int, current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT im.id, im.movement_type, im.quantity, w.name as warehouse_name, p.name_ar as product_name, im.created_at
        FROM inventory_movements im
        JOIN warehouses w ON w.id = im.warehouse_id
        JOIN products p ON p.id = im.product_id
        WHERE im.lot_id = :lot_id
        ORDER BY im.id DESC
    """), {"lot_id": lot_id})
    return [dict(r) for r in result.mappings().all()]

@router.get("/forecast")
async def demand_forecast(product_id: int, months: int = 3, current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("""
        SELECT DATE_TRUNC('month', created_at) as month, SUM(quantity) as total_out
        FROM inventory_movements
        WHERE product_id = :pid AND movement_type = 'out' AND created_at >= NOW() - INTERVAL '6 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month
    """), {"pid": product_id})
    rows = result.mappings().all()
    if not rows:
        return {"product_id": product_id, "average_monthly_out": 0, "suggested_order": 0}
    total = sum(r["total_out"] for r in rows)
    avg = total / len(rows)
    suggested = avg * months
    return {"product_id": product_id, "average_monthly_out": round(avg, 2), "suggested_order": round(suggested, 2)}

@router.post("/auto-replenish")
async def auto_replenish(current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    await ensure_inventory_tables(db)
    rules = (await db.execute(text("SELECT * FROM inventory_reorder_rules WHERE is_active = TRUE"))).mappings().all()
    created_pos = []
    for rule in rules:
        current_stock = await _current_stock(db, rule["warehouse_id"], rule["product_id"])
        if current_stock <= rule["reorder_level"]:
            supplier = (await db.execute(text("SELECT id FROM suppliers WHERE factory_id = :fid LIMIT 1"), {"fid": rule["factory_id"]})).scalar()
            if not supplier:
                continue
            po_number = f"PO-REP-{rule['id']}-{int(datetime.utcnow().timestamp())}"
            result = await db.execute(text("""
                INSERT INTO purchase_orders (factory_id, supplier_id, warehouse_id, po_number, status, notes, created_by_user_id)
                VALUES (:fid, :sid, :wid, :po, 'draft', :note, :uid) RETURNING id
            """), {
                "fid": rule["factory_id"], "sid": supplier, "wid": rule["warehouse_id"],
                "po": po_number, "note": f"Auto replenishment for rule #{rule['id']}",
                "uid": getattr(current_user, "id", None)
            })
            po_id = int(result.scalar_one())
            await db.execute(text("""
                INSERT INTO purchase_order_items (purchase_order_id, product_id, quantity, unit_cost, line_total)
                VALUES (:po, :pid, :qty, 0, 0)
            """), {"po": po_id, "pid": rule["product_id"], "qty": rule["reorder_quantity"]})
            created_pos.append({"rule_id": rule["id"], "po_id": po_id, "po_number": po_number})
    await db.commit()
    return {"created_pos": created_pos}

# ---------- CYCLE COUNT SCHEDULING ----------
@router.post("/cycle-count-schedule")
async def schedule_cycle_counts(current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    """إنشاء مهام جرد تلقائي بناءً على تردد كل موقع"""
    await ensure_inventory_tables(db)
    locations = (await db.execute(text("SELECT * FROM stock_locations WHERE is_active = TRUE"))).mappings().all()
    created = 0
    for loc in locations:
        freq_days = loc.get("cycle_count_frequency_days") or 30
        last_count = (await db.execute(text("SELECT MAX(scheduled_date) FROM stock_inventory_adjustments WHERE location_id = :lid"), {"lid": loc["id"]})).scalar()
        if last_count is None or (date.today() - last_count).days >= freq_days:
            await db.execute(text("INSERT INTO stock_inventory_adjustments (name, location_id, factory_id, state, scheduled_date) VALUES (:n, :lid, :fid, 'draft', :sd)"),
                             {"n": f"جرد دوري {loc['name']}", "lid": loc["id"], "fid": loc["factory_id"], "sd": date.today() + timedelta(days=1)})
            created += 1
    await db.commit()
    return {"message": f"تم إنشاء {created} مهمة جرد"}

# ---------- AI REPLENISHMENT (Enhanced) ----------
@router.get("/ai-forecast")
async def ai_forecast(product_id: int, months: int = 3, current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    """تنبؤ بالطلب باستخدام متوسط متحرك مرجح مع اكتشاف الموسمية"""
    result = await db.execute(text("""
        SELECT DATE_TRUNC('month', created_at) as month, SUM(quantity) as total_out
        FROM inventory_movements
        WHERE product_id = :pid AND movement_type = 'out' AND created_at >= NOW() - INTERVAL '12 months'
        GROUP BY DATE_TRUNC('month', created_at)
        ORDER BY month
    """), {"pid": product_id})
    rows = result.mappings().all()
    if not rows: return {"product_id": product_id, "average_monthly_out": 0, "suggested_order": 0, "trend": "stable"}
    values = [r["total_out"] for r in rows]
    # Weighted moving average (exponential smoothing alpha=0.7)
    alpha = 0.7
    smoothed = values[0]
    for v in values[1:]: smoothed = alpha * v + (1 - alpha) * smoothed
    monthly_avg = round(smoothed, 2)
    # Detect trend: increasing/decreasing/flat
    if len(values) >= 3:
        recent_trend = (values[-1] - values[-3]) / max(values[-3], 1)
        trend = "increasing" if recent_trend > 0.2 else "decreasing" if recent_trend < -0.2 else "stable"
    else: trend = "stable"
    suggested = max(round(monthly_avg * months * (1.2 if trend == "increasing" else 1.0)), monthly_avg)
    # Stock + reorder position
    current_stock = await _current_stock(db, (await db.execute(text("SELECT id FROM warehouses WHERE factory_id = (SELECT factory_id FROM products WHERE id = :pid) LIMIT 1"), {"pid": product_id})).scalar() or 1, product_id)
    return {"product_id": product_id, "weighted_monthly_out": monthly_avg, "suggested_order": suggested, "current_stock": current_stock, "trend": trend}

# ---------- LOT UPSTREAM / DOWNSTREAM TRACEABILITY ----------
@router.get("/lot-trace-full/{lot_id}")
async def full_lot_trace(lot_id: int, current_user: User = Depends(require_inventory_view), db: AsyncSession = Depends(get_db)):
    """شجرة تتبع كاملة للوت (Upstream + Downstream)"""
    # Upstream: movements where lot entered (in + sources)
    upstream = await db.execute(text("""
        SELECT im.id, im.movement_type, im.quantity, w.name as warehouse_name, p.name_ar as product_name,
               im.reference_type, im.reference_id, im.created_at
        FROM inventory_movements im
        JOIN warehouses w ON w.id = im.warehouse_id
        JOIN products p ON p.id = im.product_id
        WHERE im.lot_id = :lot_id AND im.movement_type = 'in'
        ORDER BY im.id DESC
    """), {"lot_id": lot_id})
    # Downstream: movements where lot left (out + destinations)
    downstream = await db.execute(text("""
        SELECT im.id, im.movement_type, im.quantity, w.name as warehouse_name, p.name_ar as product_name,
               im.reference_type, im.reference_id, im.created_at
        FROM inventory_movements im
        JOIN warehouses w ON w.id = im.warehouse_id
        JOIN products p ON p.id = im.product_id
        WHERE im.lot_id = :lot_id AND im.movement_type = 'out'
        ORDER BY im.id DESC
    """), {"lot_id": lot_id})
    lot_info = (await db.execute(text("SELECT * FROM stock_lots WHERE id = :lid"), {"lid": lot_id})).mappings().first()
    return {
        "lot": {"id": lot_id, "lot_number": lot_info["lot_number"] if lot_info else "-", "product_name": lot_info["product_name"] if lot_info else "-"},
        "upstream": [dict(r) for r in upstream.mappings().all()],
        "downstream": [dict(r) for r in downstream.mappings().all()]
    }

# ---------- AUTO PUTAWAY (at reception) ----------
async def _apply_putaway_rule(db, product_id, warehouse_id, factory_id):
    """تطبيق قاعدة putaway أثناء استلام بضاعة"""
    rule = (await db.execute(text("""
        SELECT * FROM stock_putaway_rules
        WHERE product_id = :pid AND is_active = TRUE
        LIMIT 1
    """), {"pid": product_id})).mappings().first()
    if rule and rule["location_out_id"]:
        # Update the movement to redirect to putaway location
        await db.execute(text("""
            UPDATE inventory_movements
            SET warehouse_id = (SELECT id FROM warehouses WHERE factory_id = :fid LIMIT 1),
                notes = CONCAT(notes, ' - Putaway applied')
            WHERE product_id = :pid AND warehouse_id = :wid AND id = (SELECT MAX(id) FROM inventory_movements WHERE product_id = :pid AND warehouse_id = :wid)
        """), {"pid": product_id, "wid": warehouse_id, "fid": factory_id})
        return {"putaway_applied": True, "location": rule["location_out_id"]}
    return {"putaway_applied": False}

@router.post("/apply-putaway/{movement_id}")
async def apply_putaway(movement_id: int, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    mov = (await db.execute(text("SELECT * FROM inventory_movements WHERE id = :mid"), {"mid": movement_id})).mappings().first()
    if not mov: raise HTTPException(status_code=404, detail="Movement not found")
    result = await _apply_putaway_rule(db, mov["product_id"], mov["warehouse_id"], mov["factory_id"])
    return result

# ---------- ACCOUNTING INTEGRATION (Stock Move → JE) ----------
@router.post("/movements/{movement_id}/accounting-entry")
async def create_accounting_entry_for_movement(movement_id: int, current_user: User = Depends(require_inventory_manage), db: AsyncSession = Depends(get_db)):
    mov = (await db.execute(text("SELECT im.*, p.name_ar as product_name FROM inventory_movements im JOIN products p ON p.id = im.product_id WHERE im.id = :mid"), {"mid": movement_id})).mappings().first()
    if not mov: raise HTTPException(status_code=404, detail="Movement not found")
    cost = (await db.execute(text("SELECT unit_cost FROM inventory_valuation_layers WHERE movement_id = :mid ORDER BY id DESC LIMIT 1"), {"mid": movement_id})).scalar() or 0
    total_amount = float(mov["quantity"]) * float(cost)
    if total_amount <= 0: raise HTTPException(status_code=400, detail="No value to record")
    entry = await db.execute(text("INSERT INTO accounting_journal_entries (reference, date, amount) VALUES (:ref, CURRENT_DATE, :amt) RETURNING id"), {"ref": f"MOV-{movement_id}", "amt": total_amount})
    entry_id = int(entry.scalar_one())
    # Debit inventory account (in), Credit counterpart (out)
    if mov["movement_type"] in ("in", "adjustment"):
        await db.execute(text("INSERT INTO accounting_journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (:eid, (SELECT id FROM accounting_chart_accounts WHERE code='1401' LIMIT 1), :amt, 0)"), {"eid": entry_id, "amt": total_amount})
        await db.execute(text("INSERT INTO accounting_journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (:eid, (SELECT id FROM accounting_chart_accounts WHERE code='5001' LIMIT 1), 0, :amt)"), {"eid": entry_id, "amt": total_amount})
    else:
        await db.execute(text("INSERT INTO accounting_journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (:eid, (SELECT id FROM accounting_chart_accounts WHERE code='5001' LIMIT 1), :amt, 0)"), {"eid": entry_id, "amt": total_amount})
        await db.execute(text("INSERT INTO accounting_journal_entry_lines (journal_entry_id, account_id, debit, credit) VALUES (:eid, (SELECT id FROM accounting_chart_accounts WHERE code='1401' LIMIT 1), 0, :amt)"), {"eid": entry_id, "amt": total_amount})
    await db.commit()
    return {"ok": True, "journal_entry_id": entry_id}
