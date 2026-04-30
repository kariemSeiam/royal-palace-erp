from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from src.api.deps.admin_auth import (
    require_factories_manage,
    require_factories_view,
    is_factory_scoped,
    get_user_factory_scope_id,
)
from src.core.db.session import get_db
from src.models.user import Factory, User
from src.schemas.factory import FactoryCreate, FactoryOut

router = APIRouter(prefix="/admin/factories", tags=["factories"])


@router.get("", response_model=list[FactoryOut])
async def list_factories(
    current_user: User = Depends(require_factories_view),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Factory).order_by(Factory.id.asc())
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None:
            stmt = stmt.where(Factory.id == scoped_id)

    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=FactoryOut, status_code=status.HTTP_201_CREATED)
async def create_factory(
    payload: FactoryCreate,
    current_user: User = Depends(require_factories_manage),
    db: AsyncSession = Depends(get_db),
):
    if is_factory_scoped(current_user):
        raise HTTPException(status_code=403, detail="Factory-scoped admin cannot create factories")

    existing_code = await db.execute(select(Factory).where(Factory.code == payload.code))
    if existing_code.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Factory code already exists")

    existing_name = await db.execute(select(Factory).where(Factory.name == payload.name))
    if existing_name.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Factory name already exists")

    factory = Factory(
        code=payload.code,
        name=payload.name,
        is_active=payload.is_active if hasattr(payload, 'is_active') else True,
    )
    db.add(factory)
    await db.commit()
    await db.refresh(factory)
    return factory


@router.put("/{factory_id}", response_model=FactoryOut)
async def update_factory(
    factory_id: int,
    payload: FactoryCreate,
    current_user: User = Depends(require_factories_manage),
    db: AsyncSession = Depends(get_db),
):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None and scoped_id != factory_id:
            raise HTTPException(status_code=403, detail="Cannot modify factory outside your scope")

    result = await db.execute(select(Factory).where(Factory.id == factory_id))
    factory = result.scalar_one_or_none()
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")

    existing_code = await db.execute(select(Factory).where(Factory.code == payload.code, Factory.id != factory_id))
    if existing_code.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Factory code already exists")

    existing_name = await db.execute(select(Factory).where(Factory.name == payload.name, Factory.id != factory_id))
    if existing_name.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Factory name already exists")

    factory.code = payload.code
    factory.name = payload.name
    if hasattr(payload, 'is_active'):
        factory.is_active = payload.is_active

    await db.commit()
    await db.refresh(factory)
    return factory


@router.delete("/{factory_id}", status_code=status.HTTP_200_OK)
async def delete_factory(
    factory_id: int,
    current_user: User = Depends(require_factories_manage),
    db: AsyncSession = Depends(get_db),
):
    if is_factory_scoped(current_user):
        scoped_id = get_user_factory_scope_id(current_user)
        if scoped_id is not None and scoped_id != factory_id:
            raise HTTPException(status_code=403, detail="Cannot delete factory outside your scope")

    result = await db.execute(select(Factory).where(Factory.id == factory_id))
    factory = result.scalar_one_or_none()
    if not factory:
        raise HTTPException(status_code=404, detail="Factory not found")

    await db.delete(factory)
    await db.commit()
    return {"message": "Factory deleted successfully"}
