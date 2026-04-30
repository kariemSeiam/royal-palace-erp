from __future__ import annotations

import logging

from jose import JWTError, jwt
from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy import or_, select, text
from sqlalchemy.ext.asyncio import AsyncSession

from src.core.config.settings import settings
from src.core.db.session import get_db
from src.core.security.jwt import ALGORITHM, create_access_token, create_refresh_token
from src.models.user import Factory, Role, User
from src.schemas.auth import LoginRequest, RegisterRequest, TokenResponse

logger = logging.getLogger("auth-router")

try:
    from src.core.security.password import verify_password, hash_password
except ImportError:
    from src.core.security.password import verify_password, get_password_hash as hash_password

router = APIRouter(prefix="/auth", tags=["auth"])


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


async def get_role_permission_codes(db: AsyncSession, role_id: int | None) -> list[str]:
    if not role_id:
        return []

    await db.execute(
        text(
            """
            CREATE TABLE IF NOT EXISTS role_permissions (
                id SERIAL PRIMARY KEY,
                role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
                permission_code VARCHAR(150) NOT NULL,
                created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT NOW(),
                UNIQUE(role_id, permission_code)
            )
            """
        )
    )
    await db.commit()

    result = await db.execute(
        text(
            """
            SELECT permission_code
            FROM role_permissions
            WHERE role_id = :role_id
            ORDER BY permission_code ASC
            """
        ),
        {"role_id": int(role_id)},
    )
    rows = result.mappings().all()
    return [str(row["permission_code"]).strip() for row in rows if row.get("permission_code")]


def serialize_me(user: User, role: Role | None, permissions: list[str], factory: Factory | None = None) -> dict:
    return {
        "id": user.id,
        "full_name": user.full_name,
        "username": user.username,
        "email": user.email,
        "phone": user.phone,
        "is_active": user.is_active,
        "is_superuser": user.is_superuser,
        "scope": getattr(user, "scope", "factory"),
        "factory_id": getattr(user, "factory_id", None),
        "factory_name": factory.name if factory else None,
        "employee_id": getattr(user, "employee_id", None),
        "role_id": role.id if role else getattr(user, "role_id", None),
        "role_name": role.name if role else None,
        "role_code": role.code if role else None,
        "permissions": permissions,
    }


async def get_or_create_customer_role(db: AsyncSession) -> Role:
    result = await db.execute(select(Role).where(Role.code == "customer"))
    role = result.scalars().first()
    if role:
        return role

    role = Role(code="customer", name="Customer", is_active=True)
    db.add(role)
    await db.flush()
    return role


async def get_user_from_authorization(authorization: str, db: AsyncSession) -> tuple[User, Role | None, Factory | None]:
    if not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Unauthorized")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Unauthorized")

    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[ALGORITHM])
        if payload.get("type") not in (None, "access"):
            raise HTTPException(status_code=401, detail="Unauthorized")
        user_id = int(payload.get("sub"))
    except (JWTError, ValueError, TypeError):
        raise HTTPException(status_code=401, detail="Unauthorized")

    result = await db.execute(
        select(User, Role, Factory)
        .outerjoin(Role, Role.id == User.role_id)
        .outerjoin(Factory, Factory.id == User.factory_id)
        .where(User.id == user_id)
    )
    row = result.first()
    if not row:
        raise HTTPException(status_code=404, detail="User not found")

    user, role, factory = row
    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    return user, role, factory


@router.post("/register", status_code=status.HTTP_201_CREATED)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    await ensure_customer_profiles_table(db)

    for field, value in [
        ("username", payload.username),
        ("email", payload.email),
        ("phone", payload.phone),
    ]:
        existing = await db.execute(select(User).where(getattr(User, field) == value))
        if existing.scalar_one_or_none():
            raise HTTPException(status_code=409, detail=f"{field.capitalize()} already registered")

    role = await get_or_create_customer_role(db)

    user_data = {
        "full_name": payload.full_name,
        "username": payload.username,
        "email": payload.email,
        "phone": payload.phone,
        "role_id": role.id,
        "is_active": True,
        "is_superuser": False,
    }

    if hasattr(User, "password_hash"):
        user_data["password_hash"] = hash_password(payload.password)
    else:
        user_data["hashed_password"] = hash_password(payload.password)

    user = User(**user_data)
    db.add(user)
    await db.flush()

    await db.execute(
        text(
            """
            INSERT INTO customer_profiles (
                user_id, governorate, city, address_line, address_notes,
                created_at, updated_at
            )
            VALUES (:user_id, :governorate, :city, :address_line, :address_notes, NOW(), NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                governorate = EXCLUDED.governorate,
                city = EXCLUDED.city,
                address_line = EXCLUDED.address_line,
                address_notes = EXCLUDED.address_notes,
                updated_at = NOW()
            """
        ),
        {
            "user_id": user.id,
            "governorate": getattr(payload, "governorate", None),
            "city": getattr(payload, "city", None),
            "address_line": getattr(payload, "address_line", None),
            "address_notes": getattr(payload, "address_notes", None) or "",
        },
    )

    await db.commit()

    return {
        "message": "Success",
        "id": user.id,
    }


@router.post("/login", response_model=TokenResponse)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    ident = payload.identifier.strip()
    result = await db.execute(
        select(User).where(
            or_(User.username == ident, User.email == ident, User.phone == ident)
        )
    )
    user = result.scalar_one_or_none()

    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")

    password_hash = getattr(user, "password_hash", getattr(user, "hashed_password", None))
    if not password_hash or not verify_password(payload.password, password_hash):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    if not user.is_active:
        raise HTTPException(status_code=403, detail="User is inactive")

    return TokenResponse(
        access_token=create_access_token(str(user.id)),
        refresh_token=create_refresh_token(str(user.id)),
    )


@router.get("/me")
async def current_user(
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    user, role, factory = await get_user_from_authorization(authorization, db)
    permissions = await get_role_permission_codes(db, role.id if role else None)
    return serialize_me(user, role, permissions, factory)


@router.put("/profile")
async def update_profile(
    payload: dict,
    authorization: str = Header(default=""),
    db: AsyncSession = Depends(get_db),
):
    await ensure_customer_profiles_table(db)

    user, role, factory = await get_user_from_authorization(authorization, db)

    full_name = payload.get("full_name")
    phone = payload.get("phone")
    governorate = payload.get("governorate")
    city = payload.get("city")
    address_line = payload.get("address_line") or payload.get("address")
    address_notes = payload.get("address_notes")

    if full_name is not None or phone is not None:
        await db.execute(
            text(
                """
                UPDATE users
                SET full_name = COALESCE(:full_name, full_name),
                    phone = COALESCE(:phone, phone),
                    updated_at = NOW()
                WHERE id = :user_id
                """
            ),
            {"user_id": user.id, "full_name": full_name, "phone": phone},
        )

    await db.execute(
        text(
            """
            INSERT INTO customer_profiles (
                user_id, governorate, city, address_line, address_notes,
                created_at, updated_at
            )
            VALUES (:user_id, :governorate, :city, :address_line, :address_notes, NOW(), NOW())
            ON CONFLICT (user_id) DO UPDATE SET
                governorate = COALESCE(EXCLUDED.governorate, customer_profiles.governorate),
                city = COALESCE(EXCLUDED.city, customer_profiles.city),
                address_line = COALESCE(EXCLUDED.address_line, customer_profiles.address_line),
                address_notes = COALESCE(EXCLUDED.address_notes, customer_profiles.address_notes),
                updated_at = NOW()
            """
        ),
        {
            "user_id": user.id,
            "governorate": governorate,
            "city": city,
            "address_line": address_line,
            "address_notes": address_notes,
        },
    )

    await db.commit()

    refreshed_user, refreshed_role, refreshed_factory = await get_user_from_authorization(authorization, db)
    permissions = await get_role_permission_codes(db, refreshed_role.id if refreshed_role else None)
    me = serialize_me(refreshed_user, refreshed_role, permissions, refreshed_factory)

    profile_result = await db.execute(
        text("SELECT governorate, city, address_line, address_notes FROM customer_profiles WHERE user_id = :user_id LIMIT 1"),
        {"user_id": refreshed_user.id},
    )
    profile_row = profile_result.mappings().first()

    return {
        **me,
        "governorate": profile_row["governorate"] if profile_row else None,
        "city": profile_row["city"] if profile_row else None,
        "address_line": profile_row["address_line"] if profile_row else None,
        "address_notes": profile_row["address_notes"] if profile_row else None,
    }
