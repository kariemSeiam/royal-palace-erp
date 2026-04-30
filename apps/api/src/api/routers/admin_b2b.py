from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    require_b2b_manage,
    require_b2b_view,
    get_user_factory_scope_id,
    is_factory_scoped_user,
    enforce_factory_scope,
)
from src.core.db.session import get_db
from src.models.user import User

router = APIRouter(prefix="/admin/b2b", tags=["admin-b2b"])


def serialize_business_account(row):
    data = dict(row)
    return {
        "id": data.get("id"),
        "factory_id": data.get("factory_id"),
        "factory_name": data.get("factory_name"),
        "company_name": data.get("company_name"),
        "business_type": data.get("business_type"),
        "tax_number": data.get("tax_number"),
        "commercial_registration": data.get("commercial_registration"),
        "contact_email": data.get("contact_email"),
        "contact_phone": data.get("contact_phone"),
        "address_text": data.get("address_text"),
        "partner_category": data.get("partner_category"),
        "payment_terms": data.get("payment_terms"),
        "credit_limit": data.get("credit_limit"),
        "is_active": data.get("is_active"),
    }


def clean_text(value):
    if value is None:
        return None
    value = str(value).strip()
    return value or None


def resolve_requested_factory_id(payload: dict):
    value = payload.get("factory_id")
    if value in [None, ""]:
        return None
    try:
        return int(value)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid factory_id")


async def ensure_factory_exists(db: AsyncSession, factory_id: int) -> bool:
    result = await db.execute(
        text("SELECT id FROM factories WHERE id = :factory_id LIMIT 1"),
        {"factory_id": factory_id},
    )
    return bool(result.first())


async def resolve_target_factory_id_for_create(db: AsyncSession, current_user: User, payload: dict) -> int:
    requested_factory_id = resolve_requested_factory_id(payload)
    scoped_factory_id = get_user_factory_scope_id(current_user)

    if is_factory_scoped_user(current_user):
        if scoped_factory_id is None:
            raise HTTPException(status_code=403, detail="Factory scope is required for this user")
        if requested_factory_id not in [None, scoped_factory_id]:
            raise HTTPException(status_code=403, detail="Cannot create records for another factory")
        target_factory_id = scoped_factory_id
    else:
        if requested_factory_id is None:
            raise HTTPException(status_code=400, detail="factory_id is required")
        target_factory_id = requested_factory_id

    if not await ensure_factory_exists(db, target_factory_id):
        raise HTTPException(status_code=404, detail="Factory not found")

    return target_factory_id


async def fetch_business_account_or_404(db: AsyncSession, account_id: int):
    result = await db.execute(
        text(
            """
            SELECT ba.*, f.name AS factory_name
            FROM business_accounts ba
            LEFT JOIN factories f ON f.id = ba.factory_id
            WHERE ba.id = :account_id
            LIMIT 1
            """
        ),
        {"account_id": account_id},
    )
    row = result.mappings().first()
    if not row:
        raise HTTPException(status_code=404, detail="Business account not found")
    return row


@router.get("/accounts")
async def list_business_accounts(
    current_user: User = Depends(require_b2b_view),
    db: AsyncSession = Depends(get_db),
):
    sql = """
        SELECT ba.*, f.name AS factory_name
        FROM business_accounts ba
        LEFT JOIN factories f ON f.id = ba.factory_id
    """
    params = {}

    if is_factory_scoped_user(current_user):
        sql += " WHERE ba.factory_id = :factory_id "
        params["factory_id"] = get_user_factory_scope_id(current_user)

    sql += " ORDER BY ba.id DESC "

    result = await db.execute(text(sql), params)
    rows = result.mappings().all()
    return [serialize_business_account(row) for row in rows]


@router.post("/accounts", status_code=status.HTTP_201_CREATED)
async def create_business_account(
    payload: dict,
    current_user: User = Depends(require_b2b_manage),
    db: AsyncSession = Depends(get_db),
):
    company_name = clean_text(payload.get("company_name"))
    factory_id = await resolve_target_factory_id_for_create(db, current_user, payload)

    if not company_name:
        raise HTTPException(status_code=400, detail="Company name is required")

    existing = await db.execute(
        text(
            """
            SELECT id
            FROM business_accounts
            WHERE company_name = :company_name
            LIMIT 1
            """
        ),
        {"company_name": company_name},
    )
    if existing.first():
        raise HTTPException(status_code=409, detail="Business account already exists")

    insert_data = {
        "factory_id": factory_id,
        "company_name": company_name,
        "business_type": clean_text(payload.get("business_type")),
        "tax_number": clean_text(payload.get("tax_number")),
        "commercial_registration": clean_text(payload.get("commercial_registration")),
        "contact_email": clean_text(payload.get("contact_email")),
        "contact_phone": clean_text(payload.get("contact_phone")),
        "address_text": clean_text(payload.get("address_text")),
        "partner_category": clean_text(payload.get("partner_category")),
        "payment_terms": clean_text(payload.get("payment_terms")),
        "credit_limit": payload.get("credit_limit"),
        "is_active": bool(payload.get("is_active", True)),
    }

    try:
        result = await db.execute(
            text(
                """
                INSERT INTO business_accounts (
                    factory_id,
                    company_name,
                    business_type,
                    tax_number,
                    commercial_registration,
                    contact_email,
                    contact_phone,
                    address_text,
                    partner_category,
                    payment_terms,
                    credit_limit,
                    is_active
                )
                VALUES (
                    :factory_id,
                    :company_name,
                    :business_type,
                    :tax_number,
                    :commercial_registration,
                    :contact_email,
                    :contact_phone,
                    :address_text,
                    :partner_category,
                    :payment_terms,
                    :credit_limit,
                    :is_active
                )
                RETURNING id
                """
            ),
            insert_data,
        )
        created_id = result.scalar_one()
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to create business account: {exc}")

    row = await fetch_business_account_or_404(db, created_id)
    return serialize_business_account(row)


@router.put("/accounts/{account_id}")
async def update_business_account(
    account_id: int,
    payload: dict,
    current_user: User = Depends(require_b2b_manage),
    db: AsyncSession = Depends(get_db),
):
    existing_row = await fetch_business_account_or_404(db, account_id)
    enforce_factory_scope(current_user, existing_row.get("factory_id"), "Access denied for this B2B factory scope")

    company_name = clean_text(payload.get("company_name")) if "company_name" in payload else existing_row.get("company_name")
    if not company_name:
        raise HTTPException(status_code=400, detail="Company name is required")

    duplicate = await db.execute(
        text(
            """
            SELECT id
            FROM business_accounts
            WHERE company_name = :company_name
              AND id != :account_id
            LIMIT 1
            """
        ),
        {"company_name": company_name, "account_id": account_id},
    )
    if duplicate.first():
        raise HTTPException(status_code=409, detail="Business account already exists")

    update_data = {
        "account_id": account_id,
        "company_name": company_name,
        "business_type": clean_text(payload.get("business_type")) if "business_type" in payload else existing_row.get("business_type"),
        "tax_number": clean_text(payload.get("tax_number")) if "tax_number" in payload else existing_row.get("tax_number"),
        "commercial_registration": clean_text(payload.get("commercial_registration")) if "commercial_registration" in payload else existing_row.get("commercial_registration"),
        "contact_email": clean_text(payload.get("contact_email")) if "contact_email" in payload else existing_row.get("contact_email"),
        "contact_phone": clean_text(payload.get("contact_phone")) if "contact_phone" in payload else existing_row.get("contact_phone"),
        "address_text": clean_text(payload.get("address_text")) if "address_text" in payload else existing_row.get("address_text"),
        "partner_category": clean_text(payload.get("partner_category")) if "partner_category" in payload else existing_row.get("partner_category"),
        "payment_terms": clean_text(payload.get("payment_terms")) if "payment_terms" in payload else existing_row.get("payment_terms"),
        "credit_limit": payload.get("credit_limit", existing_row.get("credit_limit")),
        "is_active": bool(payload.get("is_active", existing_row.get("is_active"))),
        "factory_id": existing_row.get("factory_id"),
    }

    if "factory_id" in payload:
        requested_factory_id = resolve_requested_factory_id(payload)
        if requested_factory_id is None:
            raise HTTPException(status_code=400, detail="factory_id cannot be empty")

        if is_factory_scoped_user(current_user):
            scoped_factory_id = get_user_factory_scope_id(current_user)
            if requested_factory_id != scoped_factory_id:
                raise HTTPException(status_code=403, detail="Cannot move B2B account to another factory")
            update_data["factory_id"] = scoped_factory_id
        else:
            if not await ensure_factory_exists(db, requested_factory_id):
                raise HTTPException(status_code=404, detail="Factory not found")
            update_data["factory_id"] = requested_factory_id

    try:
        await db.execute(
            text(
                """
                UPDATE business_accounts
                SET
                    factory_id = :factory_id,
                    company_name = :company_name,
                    business_type = :business_type,
                    tax_number = :tax_number,
                    commercial_registration = :commercial_registration,
                    contact_email = :contact_email,
                    contact_phone = :contact_phone,
                    address_text = :address_text,
                    partner_category = :partner_category,
                    payment_terms = :payment_terms,
                    credit_limit = :credit_limit,
                    is_active = :is_active,
                    updated_at = NOW()
                WHERE id = :account_id
                """
            ),
            update_data,
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to update business account: {exc}")

    row = await fetch_business_account_or_404(db, account_id)
    return serialize_business_account(row)


@router.delete("/accounts/{account_id}")
async def delete_business_account(
    account_id: int,
    current_user: User = Depends(require_b2b_manage),
    db: AsyncSession = Depends(get_db),
):
    existing_row = await fetch_business_account_or_404(db, account_id)
    enforce_factory_scope(current_user, existing_row.get("factory_id"), "Access denied for this B2B factory scope")

    try:
        await db.execute(
            text("DELETE FROM business_accounts WHERE id = :account_id"),
            {"account_id": account_id},
        )
        await db.commit()
    except Exception as exc:
        await db.rollback()
        raise HTTPException(status_code=500, detail=f"Failed to delete business account: {exc}")

    return {"message": "Business account deleted successfully"}
