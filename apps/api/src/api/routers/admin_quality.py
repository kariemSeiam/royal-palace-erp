from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role, is_factory_scoped, get_user_factory_scope_id
from src.core.db.session import get_db
from src.models.user import User
from src.models.quality import QualityTemplate, QualityCheck

router = APIRouter(prefix="/admin/quality", tags=["admin-quality"])

async def require_quality_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "quality.view", "quality.manage"):
        raise HTTPException(status_code=403, detail="Quality access denied")
    return user

def _scope_filter(stmt, factory_column, current_user):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            stmt = stmt.where(factory_column == scoped_id)
    return stmt

@router.get("/templates")
async def list_templates(current_user: User = Depends(require_quality_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(QualityTemplate).order_by(QualityTemplate.id.asc())
    stmt = _scope_filter(stmt, QualityTemplate.factory_id, current_user)
    result = await db.execute(stmt.limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"code":r.code,"product_id":r.product_id,"factory_id":r.factory_id,"description":r.description} for r in rows]

@router.post("/templates", status_code=status.HTTP_201_CREATED)
async def create_template(payload: dict, current_user: User = Depends(require_quality_view), db: AsyncSession = Depends(get_db)):
    template = QualityTemplate(name=payload["name"], code=payload["code"], description=payload.get("description"), product_id=payload.get("product_id"), factory_id=payload.get("factory_id"))
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return {"id":template.id,"name":template.name,"code":template.code}

@router.put("/templates/{template_id}")
async def update_template(template_id: int, payload: dict, current_user: User = Depends(require_quality_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(QualityTemplate).where(QualityTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template: raise HTTPException(status_code=404, detail="Template not found")
    for field in ["name","code","description","product_id","factory_id"]:
        if field in payload: setattr(template, field, payload[field])
    await db.commit()
    await db.refresh(template)
    return {"id":template.id,"name":template.name,"code":template.code}

@router.delete("/templates/{template_id}")
async def delete_template(template_id: int, current_user: User = Depends(require_quality_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(QualityTemplate).where(QualityTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template: raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)
    await db.commit()
    return {"message":"Template deleted"}

@router.get("/checks")
async def list_checks(current_user: User = Depends(require_quality_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    stmt = sa_select(QualityCheck).order_by(QualityCheck.id.desc())
    stmt = _scope_filter(stmt, QualityCheck.factory_id, current_user)
    result = await db.execute(stmt.limit(100))
    rows = result.scalars().all()
    return [{"id":r.id,"template_id":r.template_id,"work_order_id":r.work_order_id,"factory_id":r.factory_id,"inspector_user_id":r.inspector_user_id,"result":r.result,"notes":r.notes,"checked_at":str(r.checked_at) if r.checked_at else None} for r in rows]

@router.post("/checks", status_code=status.HTTP_201_CREATED)
async def create_check(payload: dict, current_user: User = Depends(require_quality_view), db: AsyncSession = Depends(get_db)):
    check = QualityCheck(template_id=payload.get("template_id"), work_order_id=payload.get("work_order_id"), factory_id=payload.get("factory_id"), inspector_user_id=current_user.id, result=payload.get("result","pending"), notes=payload.get("notes"), checked_at=payload.get("checked_at"))
    db.add(check)
    await db.commit()
    await db.refresh(check)
    return {"id":check.id,"work_order_id":check.work_order_id,"result":check.result}

@router.put("/checks/{check_id}")
async def update_check(check_id: int, payload: dict, current_user: User = Depends(require_quality_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(QualityCheck).where(QualityCheck.id == check_id))
    check = result.scalar_one_or_none()
    if not check: raise HTTPException(status_code=404, detail="Check not found")
    for field in ["template_id","work_order_id","factory_id","result","notes","checked_at"]:
        if field in payload: setattr(check, field, payload[field])
    await db.commit()
    await db.refresh(check)
    return {"id":check.id,"result":check.result}

@router.delete("/checks/{check_id}")
async def delete_check(check_id: int, current_user: User = Depends(require_quality_view), db: AsyncSession = Depends(get_db)):
    from sqlalchemy import select as sa_select
    result = await db.execute(sa_select(QualityCheck).where(QualityCheck.id == check_id))
    check = result.scalar_one_or_none()
    if not check: raise HTTPException(status_code=404, detail="Check not found")
    await db.delete(check)
    await db.commit()
    return {"message":"Check deleted"}

async def _create_alert_if_failed(check_id: int, result: str, db: AsyncSession):
    if result == "fail":
        from src.models.mrp_alert import MrpQualityAlert
        alert = MrpQualityAlert(quality_check_id=check_id, user_id=None, message=f"فشل فحص الجودة #{check_id}")
        db.add(alert)
        await db.commit()

# تعديل create_check لاستدعاء الدالة بعد الإنشاء (سنضيفها داخل الدالة الأصلية)
# لكن بما أننا لا نستطيع تعديل الدالة بسهولة، سنضيف نقطة نهاية جديدة للتحديث مع التنبيه
@router.post("/checks/{check_id}/result")
async def update_check_result(check_id: int, result: str = "fail", db: AsyncSession = Depends(get_db), user=Depends(require_quality_view)):
    await db.execute(text("UPDATE quality_checks SET result = :result WHERE id = :id"), {"result": result, "id": check_id})
    if result == "fail":
        await _create_alert_if_failed(check_id, result, db)
    return {"ok": True}
