from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db

router = APIRouter(prefix="/admin/cost-centers", tags=["admin-cost-centers"])

async def require_finance_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser:
        return user
    if "finance.manage" not in {str(p).strip().lower() for p in (permissions or set())}:
        raise HTTPException(status_code=403, detail="Finance manage access required")
    return user

@router.get("")
async def list_cost_centers(db: AsyncSession = Depends(get_db), current_user=Depends(require_finance_manage)):
    result = await db.execute(text("SELECT * FROM cost_centers ORDER BY id ASC"))
    return [dict(row) for row in result.mappings().all()]

@router.post("")
async def create_cost_center(payload: dict, db: AsyncSession = Depends(get_db), current_user=Depends(require_finance_manage)):
    name = payload.get("name")
    code = payload.get("code")
    if not name or not code:
        raise HTTPException(400, "name and code required")
    result = await db.execute(text("""
        INSERT INTO cost_centers (name, code, factory_id, is_active)
        VALUES (:name, :code, :factory_id, :is_active) RETURNING id
    """), {
        "name": name,
        "code": code,
        "factory_id": payload.get("factory_id"),
        "is_active": payload.get("is_active", True)
    })
    await db.commit()
    return {"id": result.scalar_one()}

@router.put("/{id}")
async def update_cost_center(id: int, payload: dict, db: AsyncSession = Depends(get_db), current_user=Depends(require_finance_manage)):
    await db.execute(text("""
        UPDATE cost_centers SET name=COALESCE(:name, name), code=COALESCE(:code, code),
        factory_id=COALESCE(:factory_id, factory_id), is_active=COALESCE(:is_active, is_active),
        updated_at=NOW() WHERE id=:id
    """), {
        "id": id,
        "name": payload.get("name"),
        "code": payload.get("code"),
        "factory_id": payload.get("factory_id"),
        "is_active": payload.get("is_active")
    })
    await db.commit()
    return {"ok": True}

@router.delete("/{id}")
async def delete_cost_center(id: int, db: AsyncSession = Depends(get_db), current_user=Depends(require_finance_manage)):
    await db.execute(text("DELETE FROM cost_centers WHERE id=:id"), {"id": id})
    await db.commit()
    return {"ok": True}
