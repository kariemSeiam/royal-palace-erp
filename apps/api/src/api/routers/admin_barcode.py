from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select as sa_select
from app.core.database import get_db
from app.models.product import Product
from app.api.deps import admin_required

router = APIRouter(prefix="/barcode", tags=["barcode"])

@router.get("/products")
async def list_products_with_barcode(
    db: AsyncSession = Depends(get_db),
    _=Depends(admin_required)
):
    # مؤقتاً نستخدم sku بدلاً من barcode حتى يتم إضافة العمود
    result = await db.execute(
        sa_select(Product).where(Product.sku != None).order_by(Product.id.asc()).limit(200)
    )
    rows = result.scalars().all()
    return [
        {
            "id": r.id,
            "name_ar": r.name_ar,
            "sku": r.sku,
            "barcode": "",  # سيتم إضافته لاحقاً
            "use_serial_number": False
        }
        for r in rows
    ]
