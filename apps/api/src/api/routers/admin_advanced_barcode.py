from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text, select
from src.api.deps.admin_auth import get_current_user_and_role, has_any_permission, ensure_not_blocked_admin_role
from src.core.db.session import get_db
from src.models.user import User
from src.models.advanced_barcode import BarcodeTemplate, BarcodePrintLog

router = APIRouter(prefix="/admin/barcode", tags=["admin-barcode"])

async def ensure_barcode_tables(db: AsyncSession):
    await db.execute(text("""
        CREATE TABLE IF NOT EXISTS barcode_templates (
            id SERIAL PRIMARY KEY,
            factory_id INTEGER REFERENCES factories(id) ON DELETE SET NULL,
            name VARCHAR(255) NOT NULL,
            format_type VARCHAR(50) DEFAULT 'code128',
            width INTEGER DEFAULT 300,
            height INTEGER DEFAULT 100,
            include_text BOOLEAN DEFAULT TRUE,
            created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
            updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        )
    """))
    await db.commit()

async def require_advanced_barcode_view(actor=Depends(get_current_user_and_role)):
    user, role, permissions = actor
    ensure_not_blocked_admin_role(role)
    if user.is_superuser: return user
    if not has_any_permission(permissions, "advanced_barcode.view", "advanced_barcode.manage"):
        raise HTTPException(status_code=403, detail="Advanced Barcode access denied")
    return user

@router.get("/templates")
async def list_templates(current_user: User = Depends(require_advanced_barcode_view), db: AsyncSession = Depends(get_db)):
    await ensure_barcode_tables(db)
    result = await db.execute(select(BarcodeTemplate).order_by(BarcodeTemplate.id.desc()))
    rows = result.scalars().all()
    return [{"id":r.id,"name":r.name,"format_type":r.format_type,"width":r.width,"height":r.height,"include_text":r.include_text} for r in rows]

@router.post("/templates", status_code=status.HTTP_201_CREATED)
async def create_template(payload: dict, current_user: User = Depends(require_advanced_barcode_view), db: AsyncSession = Depends(get_db)):
    await ensure_barcode_tables(db)
    template = BarcodeTemplate(
        name=payload["name"],
        format_type=payload.get("format_type","code128"),
        width=payload.get("width",300),
        height=payload.get("height",100),
        include_text=payload.get("include_text",True),
        factory_id=current_user.factory_id if not current_user.is_superuser else None
    )
    db.add(template)
    await db.commit()
    await db.refresh(template)
    return {"id":template.id,"name":template.name}

@router.delete("/templates/{template_id}")
async def delete_template(template_id: int, current_user: User = Depends(require_advanced_barcode_view), db: AsyncSession = Depends(get_db)):
    await ensure_barcode_tables(db)
    result = await db.execute(select(BarcodeTemplate).where(BarcodeTemplate.id == template_id))
    template = result.scalar_one_or_none()
    if not template: raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(template)
    await db.commit()
    return {"message":"Template deleted"}
