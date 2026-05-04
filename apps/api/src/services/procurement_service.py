from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

try:
    from src.models.procurement_rfq import ProcurementRFQ, SupplierQuotation, SupplierQuotationItem
except ImportError:
    ProcurementRFQ = None
    SupplierQuotation = None
    SupplierQuotationItem = None

from typing import List, Dict, Any

class ProcurementService:
    @staticmethod
    async def get_rfq_comparison(db: AsyncSession, rfq_id: int) -> Dict[str, Any]:
        if ProcurementRFQ is None:
            return {"error": "RFQ model not available"}
        rfq_result = await db.execute(
            select(ProcurementRFQ).filter(ProcurementRFQ.id == rfq_id)
        )
        rfq = rfq_result.scalar_one_or_none()
        if not rfq:
            return {"error": "RFQ not found"}

        quotations_result = await db.execute(
            select(SupplierQuotation).filter(SupplierQuotation.rfq_id == rfq_id)
        )
        quotations = quotations_result.scalars().all()

        comparison_data = {
            "rfq_id": rfq.id,
            "rfq_number": rfq.rfq_number,
            "items": [],
            "suppliers": []
        }

        unique_products = {}
        for q in quotations:
            items_result = await db.execute(
                select(SupplierQuotationItem).filter(SupplierQuotationItem.quotation_id == q.id)
            )
            q_items = items_result.scalars().all()

            supplier_info = {
                "quotation_id": q.id,
                "supplier_id": q.supplier_id,
                "total_amount": float(q.total_amount),
                "currency": q.currency,
                "valid_until": q.valid_until.isoformat() if q.valid_until else None,
                "delivery_lead_time": q.delivery_lead_time,
                "status": q.status
            }
            comparison_data["suppliers"].append(supplier_info)

            for item in q_items:
                if item.product_id not in unique_products:
                    unique_products[item.product_id] = {
                        "product_id": item.product_id,
                        "quotes": {}
                    }
                unique_products[item.product_id]["quotes"][q.supplier_id] = {
                    "unit_price": float(item.unit_price),
                    "quantity": float(item.quantity)
                }

        comparison_data["items"] = list(unique_products.values())

        for item in comparison_data["items"]:
            if item["quotes"]:
                item["best_price"] = min(q["unit_price"] for q in item["quotes"].values())
                item["best_supplier_id"] = [sid for sid, q in item["quotes"].items() if q["unit_price"] == item["best_price"]][0]

        return comparison_data

    @staticmethod
    async def analyze_procurement_trends(db: AsyncSession, factory_id: int):
        return {"factory_id": factory_id, "trends": "Implementation in progress"}
