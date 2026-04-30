from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session

from src.core.security.password import hash_password
from src.models.user import Factory, Role, User

DATABASE_URL = "postgresql+psycopg://royal_palace:change_this_now@postgres:5432/royal_palace_erp"

engine = create_engine(DATABASE_URL, future=True)

FACTORIES = [
    {"code": "AL_MASRIA_FOAM", "name": "Al-Masria Foam Factory"},
    {"code": "ROYAL_PALACE_FURNITURE", "name": "Royal Palace Furniture Factory"},
    {"code": "CLOUD_BED", "name": "Cloud Bed Factory"},
]

ROLES = [
    {"code": "super_admin", "name": "Super Admin"},
    {"code": "factory_admin", "name": "Factory Admin"},
    {"code": "hr_manager", "name": "HR Manager"},
    {"code": "payroll_officer", "name": "Payroll Officer"},
    {"code": "production_manager", "name": "Production Manager"},
    {"code": "warehouse_manager", "name": "Warehouse Manager"},
    {"code": "quality_manager", "name": "Quality Manager"},
    {"code": "maintenance_manager", "name": "Maintenance Manager"},
    {"code": "worker", "name": "Worker"},
]

ADMIN_EMAIL = "admin@royalpalace-group.com"
ADMIN_USERNAME = "superadmin"
ADMIN_PASSWORD = "Admin@123456"

with Session(engine) as session:
    for f in FACTORIES:
        exists = session.execute(select(Factory).where(Factory.code == f["code"])).scalar_one_or_none()
        if not exists:
            session.add(Factory(code=f["code"], name=f["name"], is_active=True))

    for r in ROLES:
        exists = session.execute(select(Role).where(Role.code == r["code"])).scalar_one_or_none()
        if not exists:
            session.add(Role(code=r["code"], name=r["name"], is_active=True))

    session.commit()

    super_admin_role = session.execute(select(Role).where(Role.code == "super_admin")).scalar_one()
    existing_admin = session.execute(select(User).where(User.email == ADMIN_EMAIL)).scalar_one_or_none()

    if not existing_admin:
        admin_user = User(
            full_name="Royal Palace Super Admin",
            username=ADMIN_USERNAME,
            email=ADMIN_EMAIL,
            password_hash=hash_password(ADMIN_PASSWORD),
            role_id=super_admin_role.id,
            factory_id=None,
            is_active=True,
            is_superuser=True,
        )
        session.add(admin_user)
        session.commit()

print("Seed completed successfully.")
print(f"Admin username: {ADMIN_USERNAME}")
print(f"Admin email: {ADMIN_EMAIL}")
print(f"Admin password: {ADMIN_PASSWORD}")
