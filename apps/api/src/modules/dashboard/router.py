from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func

from src.database import get_db
from src.modules.orders.models import Order
from src.modules.employees.models import Employee
from src.modules.products.models import Product

router = APIRouter(prefix="/api/v1/admin/dashboard", tags=["dashboard"])


@router.get("/stats")
def dashboard_stats(db: Session = Depends(get_db)):

    orders_count = db.query(func.count(Order.id)).scalar() or 0
    employees_count = db.query(func.count(Employee.id)).scalar() or 0
    products_count = db.query(func.count(Product.id)).scalar() or 0

    return {
        "orders": orders_count,
        "employees": employees_count,
        "products": products_count,
        "revenue": 0,
        "production": 0
    }
