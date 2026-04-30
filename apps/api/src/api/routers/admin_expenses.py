from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role, is_factory_scoped, get_user_factory_scope_id
from src.core.db.session import get_db
from src.models.user import User
from src.models.expense import ExpenseCategory, Expense

router = APIRouter(prefix="/admin/expenses", tags=["admin-expenses"])

async def require_expenses_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "expenses.view", "expenses.manage"):
        raise HTTPException(status_code=403, detail="Expenses access denied")
    return user

def _scope_filter(stmt, factory_column, current_user):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            stmt = stmt.where(factory_column == scoped_id)
    return stmt

@router.get("/categories")
async def list_categories(current_user: User = Depends(require_expenses_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(ExpenseCategory).order_by(ExpenseCategory.id.asc()))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"code":r.code} for r in rows]

@router.get("")
async def list_expenses(current_user: User = Depends(require_expenses_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(Expense).order_by(Expense.id.desc())
    stmt = _scope_filter(stmt, Expense.factory_id, current_user)
    result = await db.execute(stmt.limit(200))
    rows = result.scalars().all()
    return [{"id":r.id,"category_id":r.category_id,"factory_id":r.factory_id,"employee_id":r.employee_id,"submitted_by_user_id":r.submitted_by_user_id,"description":r.description,"amount":float(r.amount),"expense_date":str(r.expense_date) if r.expense_date else None,"status":r.status,"notes":r.notes,"created_at":str(r.created_at)} for r in rows]

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_expense(payload: dict, current_user: User = Depends(require_expenses_view), db: AsyncSession = Depends(get_db)):
    expense = Expense(category_id=payload.get("category_id"), factory_id=payload.get("factory_id"), employee_id=payload.get("employee_id"), submitted_by_user_id=current_user.id, description=payload["description"], amount=payload["amount"], expense_date=payload.get("expense_date"), status=payload.get("status","draft"), notes=payload.get("notes"))
    db.add(expense)
    await db.commit()
    await db.refresh(expense)
    return {"id":expense.id,"description":expense.description,"amount":float(expense.amount)}

@router.put("/{expense_id}")
async def update_expense(expense_id: int, payload: dict, current_user: User = Depends(require_expenses_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense: raise HTTPException(status_code=404, detail="Expense not found")
    for field in ["category_id","factory_id","employee_id","description","amount","expense_date","status","notes"]:
        if field in payload: setattr(expense, field, payload[field])
    await db.commit()
    await db.refresh(expense)
    return {"id":expense.id,"description":expense.description,"amount":float(expense.amount)}

@router.delete("/{expense_id}")
async def delete_expense(expense_id: int, current_user: User = Depends(require_expenses_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(Expense).where(Expense.id == expense_id))
    expense = result.scalar_one_or_none()
    if not expense: raise HTTPException(status_code=404, detail="Expense not found")
    await db.delete(expense)
    await db.commit()
    return {"message":"Expense deleted"}
