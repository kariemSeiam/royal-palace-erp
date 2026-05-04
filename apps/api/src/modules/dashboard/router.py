from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func, select

from src.core.db.session import get_db
from src.models.orders import CustomerOrder
from src.models.employee import Employee
from src.models.catalog import Product

router = APIRouter(prefix="/api/v1/admin/dashboard", tags=["dashboard"])


@router.get("/stats")
async def dashboard_stats(db: Session = Depends(get_db)):
    """Get dashboard statistics"""
    try:
        orders_count = await db.execute(select(func.count(CustomerOrder.id)))
        orders_result = orders_count.scalar() or 0
        
        employees_count = await db.execute(select(func.count(Employee.id)))
        employees_result = employees_count.scalar() or 0
        
        products_count = await db.execute(select(func.count(Product.id)))
        products_result = products_count.scalar() or 0

        return {
            "orders": orders_result,
            "employees": employees_result,
            "products": products_result,
            "revenue": 0,
            "production": 0
        }
    except Exception as e:
        # Log the error but don't crash
        import logging
        logging.error(f"Dashboard stats error: {e}")
        return {
            "orders": 0,
            "employees": 0,
            "products": 0,
            "revenue": 0,
            "production": 0,
            "error": str(e)
        }
