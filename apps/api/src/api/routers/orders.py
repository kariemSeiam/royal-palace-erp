from __future__ import annotations

from decimal import Decimal
from uuid import uuid4

from jose import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config.settings import settings
from src.core.db.session import get_db
from src.core.security.jwt import ALGORITHM
from src.models.inventory import Warehouse
from src.models.orders import CustomerOrder, CustomerOrderItem
from src.schemas.orders import OrderCreateRequest, OrderOut

router = APIRouter(prefix="/orders", tags=["orders"])

VAT_RATE = Decimal("0.00")


def get_user_id_from_bearer(authorization: str) -> int:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")

    token = authorization.replace("Bearer ", "", 1).strip()

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") not in (None, "access"):
            raise HTTPException(status_code=401, detail="Invalid access token")
        user_id = int(payload.get("sub"))
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid access token")

    return user_id


def generate_order_number(prefix: str = "ORD") -> str:
    return f"{prefix}-{uuid4().hex[:10].upper()}"


async def create_work_order(db: AsyncSession, order_id: int, factory_id: int) -> None:
    await db.execute(
        text(
            """
            INSERT INTO work_orders (order_id, factory_id, status, notes)
            VALUES (:order_id, :factory_id, 'pending', 'Auto-created from order')
            """
        ),
        {
            "order_id": order_id,
            "factory_id": factory_id,
        },
    )


async def resolve_products_grouped_by_factory(db: AsyncSession, items) -> tuple[dict[int, list[dict]], Decimal]:
    grouped: dict[int, list[dict]] = {}
    subtotal = Decimal("0.00")

    for item in items:
        product_result = await db.execute(
            text(
                """
                SELECT id, base_price, factory_id, is_active, name_ar, sku
                FROM products
                WHERE id = :product_id
                LIMIT 1
                """
            ),
            {"product_id": item.product_id},
        )
        product = product_result.mappings().first()

        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")

        if not bool(product["is_active"]):
            raise HTTPException(status_code=409, detail=f"Product {item.product_id} is inactive")

        if product["factory_id"] is None:
            raise HTTPException(status_code=409, detail=f"Product {item.product_id} has no factory assignment")

        unit_price = Decimal(str(product["base_price"]))
        line_total = unit_price * item.quantity
        subtotal += line_total

        grouped.setdefault(int(product["factory_id"]), []).append(
            {
                "product_id": int(product["id"]),
                "quantity": int(item.quantity),
                "unit_price": unit_price,
                "line_total": line_total,
                "name_ar": product["name_ar"],
                "sku": product["sku"],
            }
        )

    return grouped, subtotal


async def resolve_active_warehouse_for_factory(db: AsyncSession, factory_id: int) -> int:
    warehouse_result = await db.execute(
        text(
            """
            SELECT id
            FROM warehouses
            WHERE factory_id = :factory_id
              AND is_active = TRUE
            ORDER BY id ASC
            LIMIT 1
            """
        ),
        {"factory_id": factory_id},
    )
    warehouse_row = warehouse_result.mappings().first()

    if not warehouse_row:
        raise HTTPException(
            status_code=409,
            detail=f"No active warehouse is available for factory #{factory_id}",
        )

    return int(warehouse_row["id"])


def serialize_order_summary(row: dict) -> dict:
    return {
        "id": row["id"],
        "order_number": row["order_number"],
        "order_type": row["order_type"],
        "status": row["status"],
        "payment_status": row["payment_status"],
        "currency": "EGP",
        "subtotal_amount": float(row["subtotal_amount"] or 0),
        "vat_amount": float(row["vat_amount"] or 0),
        "total_amount": float(row["total_amount"] or 0),
        "customer_name": row["customer_name"],
        "customer_phone": row["customer_phone"],
        "shipping_address": row["shipping_address"],
        "factory_id": row.get("factory_id"),
        "factory_name": row.get("factory_name"),
        "warehouse_id": row.get("warehouse_id"),
        "warehouse_name": row.get("warehouse_name"),
        "created_at": row["created_at"],
        "updated_at": row["updated_at"],
    }


@router.post("", response_model=OrderOut, status_code=status.HTTP_201_CREATED)
async def create_order(
    payload: OrderCreateRequest,
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    user_id = get_user_id_from_bearer(authorization)

    if payload.order_type not in ["b2c", "b2b"]:
        raise HTTPException(status_code=400, detail="Invalid order type")

    if not payload.items:
        raise HTTPException(status_code=400, detail="Order items are required")

    user_result = await db.execute(
        text(
            """
            SELECT u.id, u.full_name, u.email, u.phone,
                   cp.governorate, cp.city, cp.address_line, cp.address_notes
            FROM users u
            LEFT JOIN customer_profiles cp ON cp.user_id = u.id
            WHERE u.id = :user_id
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    )
    user_row = user_result.mappings().first()

    if not user_row:
        raise HTTPException(status_code=404, detail="User not found")

    grouped_items, subtotal = await resolve_products_grouped_by_factory(db, payload.items)

    vat_amount = (subtotal * VAT_RATE).quantize(Decimal("0.01"))
    total_amount = (subtotal + vat_amount).quantize(Decimal("0.01"))

    fallback_address_parts = [
        user_row["governorate"],
        user_row["city"],
        user_row["address_line"],
    ]
    fallback_address = " - ".join([part for part in fallback_address_parts if part])

    customer_name = payload.customer_name or user_row["full_name"]
    customer_phone = payload.customer_phone or user_row["phone"]
    shipping_address = payload.shipping_address or fallback_address
    notes = payload.notes or user_row["address_notes"]

    if not customer_name or not customer_phone or not shipping_address:
        raise HTTPException(
            status_code=400,
            detail="Customer profile is incomplete. Please complete your account details first.",
        )

    try:
        if len(grouped_items) == 1:
            factory_id = list(grouped_items.keys())[0]
            warehouse_id = await resolve_active_warehouse_for_factory(db, factory_id)

            order = CustomerOrder(
                order_number=generate_order_number("ORD"),
                user_id=user_id,
                business_account_id=payload.business_account_id,
                order_type=payload.order_type,
                status="order_received",
                payment_status="pending",
                subtotal_amount=subtotal,
                vat_amount=vat_amount,
                total_amount=total_amount,
                customer_name=customer_name,
                customer_phone=customer_phone,
                shipping_address=shipping_address,
                notes=notes,
                factory_id=factory_id,
                warehouse_id=warehouse_id,
                parent_order_id=None,
                is_master_order=False,
            )

            db.add(order)
            await db.flush()

            await create_work_order(db, order.id, factory_id)

            for item in grouped_items[factory_id]:
                db.add(
                    CustomerOrderItem(
                        order_id=order.id,
                        product_id=item["product_id"],
                        quantity=item["quantity"],
                        unit_price=item["unit_price"],
                        line_total=item["line_total"],
                    )
                )

            await db.commit()
            await db.refresh(order)

            return OrderOut(
                id=order.id,
                order_number=order.order_number,
                order_type=order.order_type,
                status=order.status,
                payment_status=order.payment_status,
                subtotal_amount=order.subtotal_amount,
                vat_amount=order.vat_amount,
                total_amount=order.total_amount,
                customer_name=order.customer_name,
                customer_phone=order.customer_phone,
                shipping_address=order.shipping_address,
            )

        master_order = CustomerOrder(
            order_number=generate_order_number("ORDM"),
            user_id=user_id,
            business_account_id=payload.business_account_id,
            order_type=payload.order_type,
            status="order_received",
            payment_status="pending",
            subtotal_amount=subtotal,
            vat_amount=vat_amount,
            total_amount=total_amount,
            customer_name=customer_name,
            customer_phone=customer_phone,
            shipping_address=shipping_address,
            notes=notes,
            factory_id=None,
            warehouse_id=None,
            parent_order_id=None,
            is_master_order=True,
        )

        db.add(master_order)
        await db.flush()

        for factory_id, factory_items in grouped_items.items():
            child_subtotal = sum((item["line_total"] for item in factory_items), Decimal("0.00"))
            child_vat = (child_subtotal * VAT_RATE).quantize(Decimal("0.01"))
            child_total = (child_subtotal + child_vat).quantize(Decimal("0.01"))
            warehouse_id = await resolve_active_warehouse_for_factory(db, factory_id)

            child_order = CustomerOrder(
                order_number=generate_order_number("ORD"),
                user_id=user_id,
                business_account_id=payload.business_account_id,
                order_type=payload.order_type,
                status="order_received",
                payment_status="pending",
                subtotal_amount=child_subtotal,
                vat_amount=child_vat,
                total_amount=child_total,
                customer_name=customer_name,
                customer_phone=customer_phone,
                shipping_address=shipping_address,
                notes=notes,
                factory_id=factory_id,
                warehouse_id=warehouse_id,
                parent_order_id=master_order.id,
                is_master_order=False,
            )

            db.add(child_order)
            await db.flush()

            await create_work_order(db, child_order.id, factory_id)

            for item in factory_items:
                db.add(
                    CustomerOrderItem(
                        order_id=child_order.id,
                        product_id=item["product_id"],
                        quantity=item["quantity"],
                        unit_price=item["unit_price"],
                        line_total=item["line_total"],
                    )
                )

        await db.commit()
        await db.refresh(master_order)

        return OrderOut(
            id=master_order.id,
            order_number=master_order.order_number,
            order_type=master_order.order_type,
            status=master_order.status,
            payment_status=master_order.payment_status,
            subtotal_amount=master_order.subtotal_amount,
            vat_amount=master_order.vat_amount,
            total_amount=master_order.total_amount,
            customer_name=master_order.customer_name,
            customer_phone=master_order.customer_phone,
            shipping_address=master_order.shipping_address,
        )

    except HTTPException:
        await db.rollback()
        raise
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create order: {exc}")


@router.get("/my")
async def list_my_orders(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    user_id = get_user_id_from_bearer(authorization)

    result = await db.execute(
        text(
            """
            SELECT
                co.id,
                co.order_number,
                co.order_type,
                co.status,
                co.payment_status,
                co.subtotal_amount,
                co.vat_amount,
                co.total_amount,
                co.customer_name,
                co.customer_phone,
                co.shipping_address,
                co.factory_id,
                co.warehouse_id,
                co.created_at,
                co.updated_at,
                f.name AS factory_name,
                w.name AS warehouse_name
            FROM customer_orders co
            LEFT JOIN factories f ON f.id = co.factory_id
            LEFT JOIN warehouses w ON w.id = co.warehouse_id
            WHERE co.user_id = :user_id
            ORDER BY co.id DESC
            """
        ),
        {"user_id": user_id},
    )

    rows = result.mappings().all()
    return [serialize_order_summary(dict(row)) for row in rows]


@router.get("/my/{order_id}")
async def get_my_order_details(
    order_id: int,
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    user_id = get_user_id_from_bearer(authorization)

    order_result = await db.execute(
        text(
            """
            SELECT
                co.id,
                co.order_number,
                co.order_type,
                co.status,
                co.payment_status,
                co.subtotal_amount,
                co.vat_amount,
                co.total_amount,
                co.customer_name,
                co.customer_phone,
                co.shipping_address,
                co.notes,
                co.factory_id,
                co.warehouse_id,
                co.parent_order_id,
                co.is_master_order,
                co.created_at,
                co.updated_at,
                f.name AS factory_name,
                w.name AS warehouse_name
            FROM customer_orders co
            LEFT JOIN factories f ON f.id = co.factory_id
            LEFT JOIN warehouses w ON w.id = co.warehouse_id
            WHERE co.id = :order_id
              AND co.user_id = :user_id
            LIMIT 1
            """
        ),
        {"order_id": order_id, "user_id": user_id},
    )
    order = order_result.mappings().first()

    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    items_result = await db.execute(
        text(
            """
            SELECT
                oi.id,
                oi.product_id,
                oi.quantity,
                oi.unit_price,
                oi.line_total,
                p.name_ar,
                p.name_en,
                p.slug,
                p.primary_image_url,
                p.preview_image_url
            FROM customer_order_items oi
            LEFT JOIN products p ON p.id = oi.product_id
            WHERE oi.order_id = :order_id
            ORDER BY oi.id ASC
            """
        ),
        {"order_id": order_id},
    )
    item_rows = items_result.mappings().all()

    items = []
    for row in item_rows:
        product_name = row["name_ar"] or row["name_en"] or f"Product #{row['product_id']}"
        image_url = row["primary_image_url"] or row["preview_image_url"]

        items.append(
            {
                "id": row["id"],
                "product_id": row["product_id"],
                "product_name": product_name,
                "sku": row["slug"],
                "quantity": float(row["quantity"] or 0),
                "unit_price": float(row["unit_price"] or 0),
                "line_total": float(row["line_total"] or 0),
                "image_url": image_url,
            }
        )

    return {
        **serialize_order_summary(dict(order)),
        "notes": order["notes"],
        "parent_order_id": order["parent_order_id"],
        "is_master_order": bool(order["is_master_order"]),
        "shipping_address_object": {
            "full_name": order["customer_name"],
            "phone": order["customer_phone"],
            "city": None,
            "area": None,
            "address_line_1": order["shipping_address"],
            "address_line_2": order["notes"],
            "postal_code": None,
        },
        "items": items,
    }
