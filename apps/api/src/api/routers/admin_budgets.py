from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role
from src.core.db.session import get_db

router = APIRouter(prefix="/admin/budgets", tags=["admin-budgets"])

async def require_finance_manage(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    if user.is_superuser:
        return user
    if "finance.manage" not in {str(p).strip().lower() for p in (permissions or set())}:
        raise HTTPException(status_code=403, detail="Finance manage access required")
    return user

@router.get("")
async def list_budgets(db: AsyncSession = Depends(get_db), current_user=Depends(require_finance_manage)):
    result = await db.execute(text("SELECT * FROM budgets ORDER BY id DESC"))
    return [dict(row) for row in result.mappings().all()]

@router.post("")
async def create_budget(payload: dict, db: AsyncSession = Depends(get_db), current_user=Depends(require_finance_manage)):
    name = payload.get("name")
    if not name:
        raise HTTPException(400, "name required")
    result = await db.execute(text("""
        INSERT INTO budgets (name, factory_id, department_id, fiscal_year, period, amount, description, is_active)
        VALUES (:name, :factory_id, :department_id, :fiscal_year, :period, :amount, :description, :is_active)
        RETURNING id
    """), {
        "name": name,
        "factory_id": payload.get("factory_id"),
        "department_id": payload.get("department_id"),
        "fiscal_year": payload.get("fiscal_year"),
        "period": payload.get("period", "yearly"),
        "amount": payload.get("amount", 0),
        "description": payload.get("description"),
        "is_active": payload.get("is_active", True)
    })
    await db.commit()
    return {"id": result.scalar_one()}

@router.put("/{budget_id}")
async def update_budget(budget_id: int, payload: dict, db: AsyncSession = Depends(get_db), current_user=Depends(require_finance_manage)):
    await db.execute(text("""
        UPDATE budgets SET name=COALESCE(:name, name), factory_id=COALESCE(:factory_id, factory_id),
        department_id=COALESCE(:department_id, department_id), fiscal_year=COALESCE(:fiscal_year, fiscal_year),
        period=COALESCE(:period, period), amount=COALESCE(:amount, amount),
        description=COALESCE(:description, description), is_active=COALESCE(:is_active, is_active),
        updated_at=NOW() WHERE id=:id
    """), {
        "id": budget_id,
        "name": payload.get("name"),
        "factory_id": payload.get("factory_id"),
        "department_id": payload.get("department_id"),
        "fiscal_year": payload.get("fiscal_year"),
        "period": payload.get("period"),
        "amount": payload.get("amount"),
        "description": payload.get("description"),
        "is_active": payload.get("is_active")
    })
    await db.commit()
    return {"ok": True}

@router.delete("/{budget_id}")
async def delete_budget(budget_id: int, db: AsyncSession = Depends(get_db), current_user=Depends(require_finance_manage)):
    await db.execute(text("DELETE FROM budgets WHERE id=:id"), {"id": budget_id})
    await db.commit()
    return {"ok": True}
