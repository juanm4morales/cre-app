#!/usr/bin/env bash
set -euo pipefail

if [[ $# -lt 1 ]]; then
  echo "Uso: $0 <archivo.dump>"
  exit 1
fi

DUMP_FILE="$1"
if [[ ! -f "${DUMP_FILE}" ]]; then
  echo "No existe el dump: ${DUMP_FILE}"
  exit 1
fi

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/backend/.env}"

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "No existe el archivo de entorno: ${ENV_FILE}"
  exit 1
fi

while IFS= read -r line || [[ -n "${line}" ]]; do
  line="${line%$'\r'}"
  [[ -z "${line}" || "${line}" =~ ^[[:space:]]*# ]] && continue
  [[ "${line}" != *=* ]] && continue

  key="${line%%=*}"
  value="${line#*=}"
  key="${key//[[:space:]]/}"

  if [[ "${value}" =~ ^\".*\"$ ]] || [[ "${value}" =~ ^\'.*\'$ ]]; then
    value="${value:1:${#value}-2}"
  fi

  if [[ "${key}" =~ ^[A-Za-z_][A-Za-z0-9_]*$ ]]; then
    printf -v "${key}" '%s' "${value}"
    export "${key}"
  fi
done < "${ENV_FILE}"

: "${POSTGRES_DB:?POSTGRES_DB no definido}"
: "${POSTGRES_USER:?POSTGRES_USER no definido}"
: "${POSTGRES_PASSWORD:?POSTGRES_PASSWORD no definido}"
: "${POSTGRES_HOST:=localhost}"
: "${POSTGRES_PORT:=5432}"

DB_EXISTS=$(PGPASSWORD="${POSTGRES_PASSWORD}" psql \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d postgres \
  -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'")

if [[ "${DB_EXISTS}" != "1" ]]; then
  PGPASSWORD="${POSTGRES_PASSWORD}" createdb \
    -h "${POSTGRES_HOST}" \
    -p "${POSTGRES_PORT}" \
    -U "${POSTGRES_USER}" \
    "${POSTGRES_DB}"
fi

PGPASSWORD="${POSTGRES_PASSWORD}" pg_restore \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  --clean \
  --if-exists \
  "${DUMP_FILE}"

echo "Restore completado desde: ${DUMP_FILE}"
