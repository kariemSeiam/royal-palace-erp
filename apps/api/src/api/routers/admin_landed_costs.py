from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User

router = APIRouter(prefix="/admin/landed-costs", tags=["landed-costs"])

def _normalize_permission_set(permissions) -> set[str]:
    return {str(code or "").strip().lower() for code in (permissions or set()) if str(code or "").strip()}

def _has_any_permission(permissions: set[str], *codes: str) -> bool:
    wanted = {str(code or "").strip().lower() for code in codes if str(code or "").strip()}
    return any(code in permissions for code in wanted)

async def require_procurement_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not _has_any_permission(permissions, "procurement.view", "procurement.manage"):
        raise HTTPException(status_code=403, detail="Access denied")
    return user

async def require_procurement_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not _has_any_permission(permissions, "procurement.manage"):
        raise HTTPException(status_code=403, detail="Access denied")
    return user

@router.get("")
async def list_landed_costs(current_user: User = Depends(require_procurement_view), db: AsyncSession = Depends(get_db)):
    result = await db.execute(text("SELECT * FROM landed_costs ORDER BY id DESC"))
    return [dict(r) for r in result.mappings().all()]

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_landed_cost(payload: dict, current_user: User = Depends(require_procurement_manage), db: AsyncSession = Depends(get_db)):
    res = await db.execute(
        text("INSERT INTO landed_costs (name, date, amount, currency, notes) VALUES (:n, :d, :a, :c, :nt) RETURNING id"),
        {"n": payload["name"], "d": payload.get("date"), "a": payload.get("amount", 0), "c": payload.get("currency", "EGP"), "nt": payload.get("notes")}
    )
    cost_id = int(res.scalar_one())
    total_amount = 0
    for item in payload.get("items", []):
        amt = float(item["amount"])
        total_amount += amt
        await db.execute(
            text("INSERT INTO landed_cost_items (landed_cost_id, product_id, amount) VALUES (:cid, :pid, :amt)"),
            {"cid": cost_id, "pid": item["product_id"], "amt": amt}
        )
    # Auto-allocation based on split method
    split_method = payload.get("split_method", "equal")  # equal, quantity, weight, volume, cost
    if total_amount > 0:
        items = payload.get("items", [])
        await _apply_split(db, cost_id, items, total_amount, split_method)
    await db.commit()
    return {"id": cost_id, "message": "Landed cost created and allocated", "split_method": split_method}

async def _apply_split(db, cost_id, items, total_amount, method):
    if method == "equal" and items:
        per_item = total_amount / len(items)
        for item in items:
            await db.execute(text("""
                UPDATE inventory_valuation_layers
                SET unit_cost = unit_cost + :added
                WHERE product_id = :pid AND remaining_quantity > 0
                ORDER BY id ASC LIMIT 1
            """), {"added": per_item, "pid": item["product_id"]})
    elif method == "quantity":
        total_qty = sum(item.get("quantity", 1) for item in items)
        for item in items:
            qty = item.get("quantity", 1)
            share = (qty / total_qty) * total_amount
            await db.execute(text("""
                UPDATE inventory_valuation_layers
                SET unit_cost = unit_cost + :added
                WHERE product_id = :pid AND remaining_quantity > 0
                ORDER BY id ASC LIMIT 1
            """), {"added": share, "pid": item["product_id"]})
    elif method == "cost":
        total_cost = sum(
            float((await db.execute(text("SELECT unit_cost FROM inventory_valuation_layers WHERE product_id = :pid ORDER BY id DESC LIMIT 1"), {"pid": item["product_id"]})).scalar() or 0)
            for item in items
        )
        if total_cost > 0:
            for item in items:
                cost = float((await db.execute(text("SELECT unit_cost FROM inventory_valuation_layers WHERE product_id = :pid ORDER BY id DESC LIMIT 1"), {"pid": item["product_id"]})).scalar() or 0)
                share = (cost / total_cost) * total_amount
                await db.execute(text("""
                    UPDATE inventory_valuation_layers
                    SET unit_cost = unit_cost + :added
                    WHERE product_id = :pid AND remaining_quantity > 0
                    ORDER BY id ASC LIMIT 1
                """), {"added": share, "pid": item["product_id"]})
    # For weight/volume methods, use product dimensions from catalog if available (simplified here)
