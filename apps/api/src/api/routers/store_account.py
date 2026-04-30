from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.routers.orders import get_user_id_from_bearer
from src.core.db.session import get_db

router = APIRouter(prefix="/store", tags=["store-account"])


async def ensure_customer_profiles_table(db: AsyncSession) -> None:
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS customer_profiles (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
                governorate VARCHAR(120),
                city VARCHAR(120),
                address_line TEXT,
                address_notes TEXT,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            )
            """
        )
    )
    await db.commit()


async def ensure_customer_addresses_table(db: AsyncSession) -> None:
    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS customer_addresses (
                id SERIAL PRIMARY KEY,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                label VARCHAR(120),
                full_name VARCHAR(255),
                phone VARCHAR(80),
                city VARCHAR(120),
                area VARCHAR(120),
                address_line_1 TEXT,
                address_line_2 TEXT,
                postal_code VARCHAR(50),
                is_default BOOLEAN NOT NULL DEFAULT FALSE,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW()
            )
            """
        )
    )
    await db.commit()


def serialize_account_row(row: dict) -> dict:
    return {
        "id": row["id"],
        "full_name": row["full_name"],
        "username": row["username"],
        "email": row["email"],
        "phone": row["phone"],
        "governorate": row["governorate"],
        "city": row["city"],
        "address": row["address_line"],
        "address_line": row["address_line"],
        "address_notes": row["address_notes"],
        "created_at": row["created_at"],
    }


@router.get("/account/me")
async def get_account_me(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    await ensure_customer_profiles_table(db)
    user_id = get_user_id_from_bearer(authorization)

    result = await db.execute(
        text(
            """
            SELECT
                u.id,
                u.full_name,
                u.username,
                u.email,
                u.phone,
                u.created_at,
                cp.governorate,
                cp.city,
                cp.address_line,
                cp.address_notes
            FROM users u
            LEFT JOIN customer_profiles cp ON cp.user_id = u.id
            WHERE u.id = :user_id
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    )
    row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return serialize_account_row(dict(row))


@router.put("/account/me")
async def update_account_me(
    payload: dict,
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    await ensure_customer_profiles_table(db)
    user_id = get_user_id_from_bearer(authorization)

    full_name = payload.get("full_name")
    phone = payload.get("phone")
    governorate = payload.get("governorate")
    city = payload.get("city")
    address_line = payload.get("address") or payload.get("address_line")
    address_notes = payload.get("address_notes")

    if full_name is not None or phone is not None:
        await db.execute(
            text(
                """
                UPDATE users
                SET
                    full_name = COALESCE(:full_name, full_name),
                    phone = COALESCE(:phone, phone),
                    updated_at = NOW()
                WHERE id = :user_id
                """
            ),
            {
                "user_id": user_id,
                "full_name": full_name,
                "phone": phone,
            },
        )

    await db.execute(
        text(
            """
            INSERT INTO customer_profiles (
                user_id,
                governorate,
                city,
                address_line,
                address_notes,
                created_at,
                updated_at
            )
            VALUES (
                :user_id,
                :governorate,
                :city,
                :address_line,
                :address_notes,
                NOW(),
                NOW()
            )
            ON CONFLICT (user_id)
            DO UPDATE SET
                governorate = COALESCE(EXCLUDED.governorate, customer_profiles.governorate),
                city = COALESCE(EXCLUDED.city, customer_profiles.city),
                address_line = COALESCE(EXCLUDED.address_line, customer_profiles.address_line),
                address_notes = COALESCE(EXCLUDED.address_notes, customer_profiles.address_notes),
                updated_at = NOW()
            """
        ),
        {
            "user_id": user_id,
            "governorate": governorate,
            "city": city,
            "address_line": address_line,
            "address_notes": address_notes,
        },
    )

    await db.commit()

    result = await db.execute(
        text(
            """
            SELECT
                u.id,
                u.full_name,
                u.username,
                u.email,
                u.phone,
                u.created_at,
                cp.governorate,
                cp.city,
                cp.address_line,
                cp.address_notes
            FROM users u
            LEFT JOIN customer_profiles cp ON cp.user_id = u.id
            WHERE u.id = :user_id
            LIMIT 1
            """
        ),
        {"user_id": user_id},
    )
    row = result.mappings().first()

    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    return serialize_account_row(dict(row))


@router.get("/account/addresses")
async def list_account_addresses(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    await ensure_customer_addresses_table(db)
    user_id = get_user_id_from_bearer(authorization)

    result = await db.execute(
        text(
            """
            SELECT
                id,
                user_id,
                label,
                full_name,
                phone,
                city,
                area,
                address_line_1,
                address_line_2,
                postal_code,
                is_default,
                created_at,
                updated_at
            FROM customer_addresses
            WHERE user_id = :user_id
            ORDER BY is_default DESC, id DESC
            """
        ),
        {"user_id": user_id},
    )

    rows = result.mappings().all()
    return [dict(row) for row in rows]


@router.post("/account/addresses", status_code=status.HTTP_201_CREATED)
async def create_account_address(
    payload: dict,
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    await ensure_customer_addresses_table(db)
    user_id = get_user_id_from_bearer(authorization)

    label = payload.get("label")
    full_name = payload.get("full_name")
    phone = payload.get("phone")
    city = payload.get("city")
    area = payload.get("area")
    address_line_1 = payload.get("address_line_1")
    address_line_2 = payload.get("address_line_2")
    postal_code = payload.get("postal_code")
    is_default = bool(payload.get("is_default", False))

    if is_default:
        await db.execute(
            text(
                """
                UPDATE customer_addresses
                SET is_default = FALSE, updated_at = NOW()
                WHERE user_id = :user_id
                """
            ),
            {"user_id": user_id},
        )

    result = await db.execute(
        text(
            """
            INSERT INTO customer_addresses (
                user_id,
                label,
                full_name,
                phone,
                city,
                area,
                address_line_1,
                address_line_2,
                postal_code,
                is_default,
                created_at,
                updated_at
            )
            VALUES (
                :user_id,
                :label,
                :full_name,
                :phone,
                :city,
                :area,
                :address_line_1,
                :address_line_2,
                :postal_code,
                :is_default,
                NOW(),
                NOW()
            )
            RETURNING
                id,
                user_id,
                label,
                full_name,
                phone,
                city,
                area,
                address_line_1,
                address_line_2,
                postal_code,
                is_default,
                created_at,
                updated_at
            """
        ),
        {
            "user_id": user_id,
            "label": label,
            "full_name": full_name,
            "phone": phone,
            "city": city,
            "area": area,
            "address_line_1": address_line_1,
            "address_line_2": address_line_2,
            "postal_code": postal_code,
            "is_default": is_default,
        },
    )

    row = result.mappings().first()
    await db.commit()
    return dict(row)


@router.put("/account/addresses/{address_id}")
async def update_account_address(
    address_id: int,
    payload: dict,
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    await ensure_customer_addresses_table(db)
    user_id = get_user_id_from_bearer(authorization)

    exists_result = await db.execute(
        text(
            """
            SELECT id
            FROM customer_addresses
            WHERE id = :address_id AND user_id = :user_id
            LIMIT 1
            """
        ),
        {"address_id": address_id, "user_id": user_id},
    )
    exists = exists_result.mappings().first()

    if not exists:
        raise HTTPException(status_code=404, detail="Address not found")

    label = payload.get("label")
    full_name = payload.get("full_name")
    phone = payload.get("phone")
    city = payload.get("city")
    area = payload.get("area")
    address_line_1 = payload.get("address_line_1")
    address_line_2 = payload.get("address_line_2")
    postal_code = payload.get("postal_code")
    is_default = bool(payload.get("is_default", False))

    if is_default:
        await db.execute(
            text(
                """
                UPDATE customer_addresses
                SET is_default = FALSE, updated_at = NOW()
                WHERE user_id = :user_id
                  AND id <> :address_id
                """
            ),
            {"user_id": user_id, "address_id": address_id},
        )

    result = await db.execute(
        text(
            """
            UPDATE customer_addresses
            SET
                label = :label,
                full_name = :full_name,
                phone = :phone,
                city = :city,
                area = :area,
                address_line_1 = :address_line_1,
                address_line_2 = :address_line_2,
                postal_code = :postal_code,
                is_default = :is_default,
                updated_at = NOW()
            WHERE id = :address_id
              AND user_id = :user_id
            RETURNING
                id,
                user_id,
                label,
                full_name,
                phone,
                city,
                area,
                address_line_1,
                address_line_2,
                postal_code,
                is_default,
                created_at,
                updated_at
            """
        ),
        {
            "address_id": address_id,
            "user_id": user_id,
            "label": label,
            "full_name": full_name,
            "phone": phone,
            "city": city,
            "area": area,
            "address_line_1": address_line_1,
            "address_line_2": address_line_2,
            "postal_code": postal_code,
            "is_default": is_default,
        },
    )

    row = result.mappings().first()
    await db.commit()
    return dict(row)


@router.delete("/account/addresses/{address_id}")
async def delete_account_address(
    address_id: int,
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    await ensure_customer_addresses_table(db)
    user_id = get_user_id_from_bearer(authorization)

    result = await db.execute(
        text(
            """
            DELETE FROM customer_addresses
            WHERE id = :address_id
              AND user_id = :user_id
            """
        ),
        {"address_id": address_id, "user_id": user_id},
    )
    await db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Address not found")

    return {"success": True}


@router.get("/orders/my-orders")
async def list_store_my_orders(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    user_id = get_user_id_from_bearer(authorization)

    result = await db.execute(
        text(
            """
            SELECT
                id,
                order_number,
                order_type,
                status,
                payment_status,
                subtotal_amount,
                vat_amount,
                total_amount,
                customer_name,
                customer_phone,
                shipping_address,
                created_at,
                updated_at
            FROM customer_orders
            WHERE user_id = :user_id
            ORDER BY id DESC
            """
        ),
        {"user_id": user_id},
    )

    rows = result.mappings().all()
    return [
        {
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
            "created_at": row["created_at"],
            "updated_at": row["updated_at"],
        }
        for row in rows
    ]


@router.get("/orders/my-orders/{order_id}")
async def store_my_order_details(
    order_id: int,
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    user_id = get_user_id_from_bearer(authorization)

    order_result = await db.execute(
        text(
            """
            SELECT
                id,
                order_number,
                order_type,
                status,
                payment_status,
                subtotal_amount,
                vat_amount,
                total_amount,
                customer_name,
                customer_phone,
                shipping_address,
                notes,
                created_at,
                updated_at
            FROM customer_orders
            WHERE id = :order_id
              AND user_id = :user_id
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
        "id": order["id"],
        "order_number": order["order_number"],
        "order_type": order["order_type"],
        "status": order["status"],
        "payment_status": order["payment_status"],
        "currency": "EGP",
        "subtotal_amount": float(order["subtotal_amount"] or 0),
        "vat_amount": float(order["vat_amount"] or 0),
        "total_amount": float(order["total_amount"] or 0),
        "customer_name": order["customer_name"],
        "customer_phone": order["customer_phone"],
        "shipping_address": {
            "full_name": order["customer_name"],
            "phone": order["customer_phone"],
            "city": None,
            "area": None,
            "address_line_1": order["shipping_address"],
            "address_line_2": order["notes"],
            "postal_code": None,
        },
        "notes": order["notes"],
        "created_at": order["created_at"],
        "updated_at": order["updated_at"],
        "items": items,
    }
