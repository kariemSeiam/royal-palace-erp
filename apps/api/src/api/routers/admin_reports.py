from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User
from src.models.report import ReportTemplate, ReportSaved

router = APIRouter(prefix="/admin/reports", tags=["admin-reports"])

async def require_reports_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "reports.view", "reports.manage"):
        raise HTTPException(status_code=403, detail="Reports access denied")
    return user

@router.get("/templates")
async def list_templates(current_user: User = Depends(require_reports_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(ReportTemplate).order_by(ReportTemplate.id.asc()))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"code":r.code,"module":r.module,"description":r.description} for r in rows]

@router.post("/templates", status_code=status.HTTP_201_CREATED)
async def create_template(payload: dict, current_user: User = Depends(require_reports_view), db: AsyncSession = Depends(get_db)):
    template = ReportTemplate(name=payload["name"], code=payload["code"], module=payload["module"], query_text=payload["query_text"], description=payload.get("description"))
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return {"id":template.id,"name":template.name,"code":template.code}

@router.put("/templates/{template_id}")
async def update_template(template_id: int, payload: dict, current_user: User = Depends(require_reports_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(ReportTemplate).where(ReportTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template: raise HTTPException(status_code=404, detail="Template not found")
    for field in ["name","code","module","query_text","description"]:
        if field in payload: setattr(template, field, payload[field])
    await db.commit()
    await db.refresh(template)
    return {"id":template.id,"name":template.name,"code":template.code}

@router.delete("/templates/{template_id}")
async def delete_template(template_id: int, current_user: User = Depends(require_reports_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(ReportTemplate).where(ReportTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template: raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)
    await db.commit()
    return {"message":"Template deleted"}

@router.post("/templates/{template_id}/execute")
async def execute_template(template_id: int, current_user: User = Depends(require_reports_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(ReportTemplate).where(ReportTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template: raise HTTPException(status_code=404, detail="Template not found")
    try:
        exec_result = await db.execute(text(template.query_text))
        columns = list(exec_result.keys())
        rows = [dict(row) for row in exec_result.mappings().all()]
        return {"columns": columns, "rows": rows, "count": len(rows)}
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Query execution failed: {str(e)}")

@router.get("/saved")
async def list_saved_reports(current_user: User = Depends(require_reports_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(ReportSaved).order_by(ReportSaved.id.desc()).limit(50))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"template_id":r.template_id,"parameters":r.parameters,"result_data":r.result_data,"created_at":str(r.created_at)} for r in rows]

@router.post("/saved", status_code=status.HTTP_201_CREATED)
async def save_report(payload: dict, current_user: User = Depends(require_reports_view), db: AsyncSession = Depends(get_db)):
    saved = ReportSaved(name=payload["name"], template_id=payload.get("template_id"), parameters=payload.get("parameters",{}), result_data=payload.get("result_data",[]))
    db.add(saved)
    await db.commit()
    await db.refresh(saved)
    return {"id":saved.id,"name":saved.name}
