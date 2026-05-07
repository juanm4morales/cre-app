#!/usr/bin/env bash
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ENV_FILE:-${REPO_ROOT}/backend/.env}"
OUTPUT_FILE="${1:-${REPO_ROOT}/backup_creapp_$(date +%Y%m%d_%H%M%S).dump}"

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

PGPASSWORD="${POSTGRES_PASSWORD}" pg_dump \
  -h "${POSTGRES_HOST}" \
  -p "${POSTGRES_PORT}" \
  -U "${POSTGRES_USER}" \
  -d "${POSTGRES_DB}" \
  -F c \
  -f "${OUTPUT_FILE}"

echo "Backup generado: ${OUTPUT_FILE}"
