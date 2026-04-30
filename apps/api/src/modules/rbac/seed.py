from __future__ import annotations

import asyncio

from src.modules.rbac.models import Base
from src.modules.rbac.service import seed_permissions_and_roles
from src.core.db.session import SessionLocal, engine


async def main():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with SessionLocal() as db:
        await seed_permissions_and_roles(db)
        print("RBAC tables created and seeded successfully")


if __name__ == "__main__":
    asyncio.run(main())
