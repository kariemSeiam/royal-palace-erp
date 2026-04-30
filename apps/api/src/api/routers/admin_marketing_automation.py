from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User
from src.models.marketing_automation import AutomationWorkflow

router = APIRouter(prefix="/admin/marketing-automation", tags=["admin-marketing-automation"])

async def ensure_marketing_automation_tables(db: AsyncSession):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS automation_workflows (
            id SERIAL PRIMARY KEY,
            factory_id INTEGER REFERENCES factories(id) ON DELETE SET NULL,
            name VARCHAR(255) NOT NULL,
            trigger_type VARCHAR(100) NOT NULL,
            action_config JSON NOT NULL,
            is_active BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    await db.commit()

async def require_marketing_automation_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "marketing_automation.view", "marketing_automation.manage"):
        raise HTTPException(status_code=403, detail="Marketing Automation access denied")
    return user

@router.get("")
async def list_workflows(current_user: User = Depends(require_marketing_automation_view), db: AsyncSession = Depends(get_db)):
    await ensure_marketing_automation_tables(db)
    result = await db.execute(select(AutomationWorkflow).order_by(AutomationWorkflow.id.desc()))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"trigger_type":r.trigger_type,"is_active":r.is_active} for r in rows]

@router.post("", status_code=status.HTTP_201_CREATED)
async def create_workflow(payload: dict, current_user: User = Depends(require_marketing_automation_view), db: AsyncSession = Depends(get_db)):
    await ensure_marketing_automation_tables(db)
    workflow = AutomationWorkflow(
        name=payload["name"],
        trigger_type=payload["trigger_type"],
        action_config=payload.get("action_config",{}),
        is_active=payload.get("is_active",True),
        factory_id=current_user.factory_id if not current_user.is_superuser else None
    )
    db.add(workflow)
    await db.commit()
    await db.refresh(workflow)
    return {"id":workflow.id,"name":workflow.name}

@router.delete("/{workflow_id}")
async def delete_workflow(workflow_id: int, current_user: User = Depends(require_marketing_automation_view), db: AsyncSession = Depends(get_db)):
    await ensure_marketing_automation_tables(db)
    result = await db.execute(select(AutomationWorkflow).where(AutomationWorkflow.id == workflow_id))
    workflow = result.scalar_one_or_none()
    if not workflow: raise HTTPException(status_code=404, detail="Workflow not found")
    await db.delete(workflow)
    await db.commit()
    return {"message":"Workflow deleted"}
