#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="/opt/royal-palace-erp"
COMPOSE_FILE="${PROJECT_ROOT}/infra/compose/docker-compose.yml"
SQL_FILE="${PROJECT_ROOT}/apps/api/src/db/sql/rbac_init.sql"

if [ ! -f "${COMPOSE_FILE}" ]; then
  echo "[ERROR] docker-compose.yml not found at ${COMPOSE_FILE}"
  exit 1
fi

if [ ! -f "${SQL_FILE}" ]; then
  echo "[ERROR] SQL file not found at ${SQL_FILE}"
  exit 1
fi

DB_SERVICE="${1:-postgres}"

echo "[INFO] Applying RBAC bootstrap SQL using service: ${DB_SERVICE}"
docker compose -f "${COMPOSE_FILE}" exec -T "${DB_SERVICE}" psql -U postgres -d postgres < "${SQL_FILE}"

echo "[OK] RBAC bootstrap applied successfully"
