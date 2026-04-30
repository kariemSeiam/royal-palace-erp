from __future__ import annotations

import os
from pathlib import Path
from urllib.parse import quote_plus

from sqlalchemy import create_engine, text


def _load_env_file(path: Path) -> None:
    if not path.exists() or not path.is_file():
        return

    for raw_line in path.read_text().splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key and key not in os.environ:
            os.environ[key] = value


def _try_load_common_env_files() -> None:
    candidates = [
        Path("/app/.env"),
        Path("/app/src/.env"),
        Path("/app/.env.production"),
        Path("/app/.env.local"),
        Path("/app/infra/compose/.env"),
    ]
    for path in candidates:
        _load_env_file(path)


def _build_database_url_from_parts() -> str | None:
    host = (
        os.getenv("POSTGRES_HOST")
        or os.getenv("DB_HOST")
        or os.getenv("DATABASE_HOST")
        or os.getenv("PGHOST")
    )
    port = (
        os.getenv("POSTGRES_PORT")
        or os.getenv("DB_PORT")
        or os.getenv("DATABASE_PORT")
        or os.getenv("PGPORT")
        or "5432"
    )
    database = (
        os.getenv("POSTGRES_DB")
        or os.getenv("DB_NAME")
        or os.getenv("DATABASE_NAME")
        or os.getenv("PGDATABASE")
    )
    username = (
        os.getenv("POSTGRES_USER")
        or os.getenv("DB_USER")
        or os.getenv("DATABASE_USER")
        or os.getenv("PGUSER")
    )
    password = (
        os.getenv("POSTGRES_PASSWORD")
        or os.getenv("DB_PASSWORD")
        or os.getenv("DATABASE_PASSWORD")
        or os.getenv("PGPASSWORD")
    )

    if not all([host, port, database, username]):
        return None

    password_part = quote_plus(password or "")
    return f"postgresql+psycopg2://{quote_plus(username)}:{password_part}@{host}:{port}/{database}"


def _resolve_database_url() -> str:
    _try_load_common_env_files()

    direct_candidates = [
        "DATABASE_URL",
        "SQLALCHEMY_DATABASE_URI",
        "POSTGRES_DSN",
        "DB_URL",
        "APP_DATABASE_URL",
    ]
    for key in direct_candidates:
        value = os.getenv(key)
        if value:
            return value

    built = _build_database_url_from_parts()
    if built:
        return built

    raise RuntimeError(
        "Could not resolve database connection. "
        "No DATABASE_URL/SQLALCHEMY_DATABASE_URI found and could not build one from POSTGRES_* vars."
    )


database_url = _resolve_database_url()
engine = create_engine(database_url)

sql_statements = [
    """
    CREATE TABLE IF NOT EXISTS customer_addresses (
        id BIGSERIAL PRIMARY KEY,
        user_id BIGINT NOT NULL,
        label VARCHAR(255),
        full_name VARCHAR(255),
        phone VARCHAR(100),
        city VARCHAR(255),
        area VARCHAR(255),
        address_line_1 TEXT,
        address_line_2 TEXT,
        postal_code VARCHAR(50),
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT NOW()
    )
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_customer_addresses_user_id
    ON customer_addresses (user_id)
    """,
    """
    CREATE INDEX IF NOT EXISTS ix_customer_addresses_user_default
    ON customer_addresses (user_id, is_default)
    """,
]

with engine.begin() as conn:
    for stmt in sql_statements:
        conn.execute(text(stmt))

print("customer_addresses table ensured successfully")
