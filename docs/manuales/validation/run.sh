#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

HARNESS="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
SOURCE_DIR="${SOURCE_DIR:-${1:-}}"
if [[ -z "$SOURCE_DIR" || ! -d "$SOURCE_DIR" ]]; then
  printf 'Set SOURCE_DIR to an approved source checkout/archive; no checkout is inferred.\n' >&2
  exit 2
fi
SOURCE_DIR="$(cd -- "$SOURCE_DIR" && pwd -P)"
SOURCE_REPO_ROOT="$(git -C "$SOURCE_DIR" rev-parse --show-toplevel 2>/dev/null || printf '%s' "$SOURCE_DIR")"
SOURCE_REPO_ROOT="$(realpath -e -- "$SOURCE_REPO_ROOT")"
if [[ -n "${TEST_ROOT:-}" ]]; then
  TEST_ROOT="$(realpath -m -- "$TEST_ROOT")"
else
  TEST_ROOT="$(mktemp -d /tmp/creapp-selfhost-validation.XXXXXX)"
fi
for protected in "$SOURCE_DIR" "$SOURCE_REPO_ROOT"; do
  case "$TEST_ROOT" in
    "$protected"|"$protected"/*)
      printf 'TEST_ROOT must not be inside or equal to the selected source/repository tree: %s\n' "$TEST_ROOT" >&2
      exit 2
      ;;
  esac
  case "$protected" in
    "$TEST_ROOT"/*)
      printf 'TEST_ROOT must not contain the selected source/repository tree: %s\n' "$TEST_ROOT" >&2
      exit 2
      ;;
  esac
done
mkdir -p -- "$TEST_ROOT"
TEST_ROOT="$(cd -- "$TEST_ROOT" && pwd -P)"

if [[ -n "${SOURCE_SHA:-}" ]]; then
  [[ "$SOURCE_SHA" =~ ^([[:xdigit:]]{40}|[[:xdigit:]]{64})$ ]] || {
    printf 'SOURCE_SHA must be a 40- or 64-character hexadecimal immutable source identifier.\n' >&2
    exit 2
  }
  SOURCE_SHA="${SOURCE_SHA,,}"
  SOURCE_SHA_METHOD=operator-supplied
else
  SOURCE_SHA="$(git -C "$SOURCE_DIR" rev-parse --verify HEAD 2>/dev/null || true)"
  [[ "$SOURCE_SHA" =~ ^([[:xdigit:]]{40}|[[:xdigit:]]{64})$ ]] || {
    printf 'Set SOURCE_SHA for source archives without Git metadata.\n' >&2
    exit 2
  }
  if [[ -n "$(git -C "$SOURCE_DIR" status --porcelain --untracked-files=normal 2>/dev/null)" ]]; then
    printf 'Git source is not clean; supply an immutable SOURCE_SHA for the exact source.\n' >&2
    exit 2
  fi
  SOURCE_SHA_METHOD=verified-git-head-clean-tree
fi
RUNS="$TEST_ROOT/runs"
RUN_ID="$(date +%Y%m%d%H%M%S)-$$"
PROJECT="creapp-selfhost-check-$RUN_ID"

if [[ ! -f "$HARNESS/compose.yaml" || ! -f "$HARNESS/Dockerfile" ]]; then
  printf 'No se encontró el harness portable junto a %s\n' "$HARNESS" >&2
  exit 2
fi
mkdir -p "$RUNS"
RUN_DIR="$(mktemp -d "$RUNS/run.XXXXXX")"
chmod 0700 "$RUN_DIR"
WORKTREE="$RUN_DIR/source"
LOG_DIR="$RUN_DIR/logs"
ENV_FILE="$RUN_DIR/runtime.env"
mkdir -p "$WORKTREE" "$LOG_DIR" "$RUN_DIR/certs"
# Parent run dir is 0700; the disposable nginx worker needs read/traverse access
# to this test certificate directory mounted from the child.
chmod 0755 "$RUN_DIR/certs"
STACK_MAY_EXIST=0
KEEP_STACK="${KEEP:-0}"

printf 'CREApp self-host acceptance run\nProject: %s\nStarted: %s\n' \
  "$PROJECT" "$(date --iso-8601=seconds)" > "$RUN_DIR/results.txt"
printf 'RUN_DIR=%s\nPROJECT=%s\nTEST_ROOT=%s\nSOURCE_DIR=%s\nSOURCE_SHA=%s\nSOURCE_SHA_METHOD=%s\n' \
  "$RUN_DIR" "$PROJECT" "$TEST_ROOT" "$SOURCE_DIR" "$SOURCE_SHA" "$SOURCE_SHA_METHOD" > "$RUN_DIR/run.meta"

dc() {
  docker compose --project-directory "$HARNESS" --env-file "$ENV_FILE" \
    -p "$PROJECT" -f "$HARNESS/compose.yaml" "$@"
}

step() {
  local name="$1" started ended status
  shift
  started="$(date +%s)"
  printf 'START %s %s\n' "$name" "$(date --iso-8601=seconds)" | tee -a "$RUN_DIR/results.txt"
  if "$@" >"$LOG_DIR/$name.log" 2>&1; then
    ended="$(date +%s)"
    printf 'PASS  %s duration=%ss log=%s\n' "$name" "$((ended-started))" "$LOG_DIR/$name.log" | tee -a "$RUN_DIR/results.txt"
  else
    status=$?
    ended="$(date +%s)"
    printf 'FAIL  %s status=%s duration=%ss log=%s\n' \
      "$name" "$status" "$((ended-started))" "$LOG_DIR/$name.log" | tee -a "$RUN_DIR/results.txt"
    return "$status"
  fi
}

finish() {
  local status=$?
  trap - EXIT
  printf 'Finished: %s\nExit status: %s\n' "$(date --iso-8601=seconds)" "$status" >> "$RUN_DIR/results.txt"
  if [[ "$STACK_MAY_EXIST" == 1 ]]; then
    if [[ "$status" -ne 0 && -f "$ENV_FILE" ]]; then
      docker compose --project-directory "$HARNESS" --env-file "$ENV_FILE" \
        -p "$PROJECT" -f "$HARNESS/compose.yaml" ps -a \
        > "$LOG_DIR/compose-ps-on-failure.log" 2>&1 || true
      docker compose --project-directory "$HARNESS" --env-file "$ENV_FILE" \
        -p "$PROJECT" -f "$HARNESS/compose.yaml" logs --no-color \
        > "$LOG_DIR/compose-logs-on-failure.log" 2>&1 || true
    fi
    if [[ "$KEEP_STACK" == 1 ]]; then
      printf 'KEEP=1: recursos Docker conservados. Limpiar únicamente este proyecto con:\n  %q %q\n' \
        "$HARNESS/cleanup-run.sh" "$RUN_DIR" | tee -a "$RUN_DIR/results.txt"
    else
      if "$HARNESS/cleanup-run.sh" "$RUN_DIR" >> "$RUN_DIR/results.txt" 2>&1; then
        printf 'Cleaned only Compose project %s; evidence retained at %s\n' "$PROJECT" "$RUN_DIR" | tee -a "$RUN_DIR/results.txt"
      else
        printf 'WARNING: cleanup failed; use %s %s after Docker access is restored\n' \
          "$HARNESS/cleanup-run.sh" "$RUN_DIR" | tee -a "$RUN_DIR/results.txt"
      fi
    fi
  else
    rm -f "$ENV_FILE" "$RUN_DIR/certs/ca.key" "$RUN_DIR/certs/server.key" \
      "$RUN_DIR/certs/server.csr" "$RUN_DIR/certs/server.ext" "$RUN_DIR/certs/ca.srl"
  fi
  exit "$status"
}
trap finish EXIT

# Refuse to create or run containers until Docker access is available.
step docker-daemon docker info
step docker-compose-version docker compose version
printf 'SOURCE_SHA=%s (%s)\n' "$SOURCE_SHA" "$SOURCE_SHA_METHOD" | tee -a "$RUN_DIR/results.txt"

# Copy only application source. Exclude all dotenv files and local build/data artifacts.
step prepare-source python3 - "$SOURCE_DIR" "$WORKTREE" <<'PY'
from pathlib import Path
from shutil import copy2, copytree
import sys

source = Path(sys.argv[1]).resolve()
dest = Path(sys.argv[2]).resolve()
if not (source / "backend" / "manage.py").is_file():
    raise SystemExit(f"No backend/manage.py in source archive: {source}")
if not (source / "frontend" / "package-lock.json").is_file():
    raise SystemExit(f"No frontend/package-lock.json in source archive: {source}")

ignored_names = {
    ".git", ".venv", "venv", "node_modules", "__pycache__", "staticfiles",
    "dist", ".tmp", "backups", "backup",
}

def ignore(_directory, names):
    blocked = []
    for name in names:
        if name in ignored_names or name == ".env" or name.startswith(".env."):
            blocked.append(name)
        elif name.endswith((".dump", ".sqlite3", ".pyc")):
            blocked.append(name)
    return blocked

for directory in ("backend", "frontend", "scripts", "docs"):
    candidate = source / directory
    if candidate.exists():
        copytree(candidate, dest / directory, ignore=ignore, dirs_exist_ok=True)
for filename in ("requirements.txt", "runtime.txt", ".gitignore"):
    candidate = source / filename
    if candidate.is_file():
        copy2(candidate, dest / filename)

leaks = [p for p in dest.rglob("*") if p.is_file() and (p.name == ".env" or p.name.startswith(".env."))]
if leaks:
    raise SystemExit("Unexpected env files in disposable copy: " + ", ".join(map(str, leaks)))
print(f"Temporary source copy prepared: {dest}; no .env files copied")
PY

cp "$HARNESS/Dockerfile" "$WORKTREE/Dockerfile.selfhost-validation"
cat > "$WORKTREE/.dockerignore" <<'EOF'
.git
.env
.env.*
**/.env
**/.env.*
**/.venv
**/venv
**/node_modules
**/__pycache__
**/*.py[cod]
**/staticfiles
*.dump
EOF
chmod 0644 "$WORKTREE/.dockerignore" "$WORKTREE/Dockerfile.selfhost-validation"

select_port() {
  python3 - <<'PY'
import random
import socket

ports = list(range(49152, 65536))
random.shuffle(ports)
for port in ports:
    with socket.socket() as sock:
        try:
            sock.bind(("127.0.0.1", port))
        except OSError:
            continue
        print(port)
        break
else:
    raise SystemExit("No free loopback high port available")
PY
}

HTTPS_PORT="$(select_port)"
POSTGRES_ADMIN_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_hex(24))')"
APP_DB_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_hex(24))')"
DJANGO_SECRET_KEY="$(python3 -c 'import secrets; print(secrets.token_urlsafe(48))')"
DJANGO_SUPERUSER_PASSWORD="$(python3 -c 'import secrets; print(secrets.token_urlsafe(24))')"
cat > "$ENV_FILE" <<EOF
HARNESS_DIR=$HARNESS
WORKTREE=$WORKTREE
CERT_DIR=$RUN_DIR/certs
HTTPS_PORT=$HTTPS_PORT
POSTGRES_ADMIN_PASSWORD=$POSTGRES_ADMIN_PASSWORD
APP_DB_PASSWORD=$APP_DB_PASSWORD
DJANGO_SECRET_KEY=$DJANGO_SECRET_KEY
DJANGO_SUPERUSER_PASSWORD=$DJANGO_SUPERUSER_PASSWORD
EOF
chmod 0600 "$ENV_FILE"
unset POSTGRES_ADMIN_PASSWORD APP_DB_PASSWORD DJANGO_SECRET_KEY DJANGO_SUPERUSER_PASSWORD

step generate-ephemeral-test-tls bash -c '
  set -eu
  cd "$1"
  openssl req -x509 -newkey rsa:2048 -sha256 -nodes -days 2 \
    -subj "/CN=CREApp disposable test CA" \
    -addext "basicConstraints=critical,CA:TRUE" \
    -addext "keyUsage=critical,keyCertSign,cRLSign" \
    -keyout ca.key -out ca.crt >/dev/null 2>&1
  openssl req -newkey rsa:2048 -sha256 -nodes -subj "/CN=creapp.test" \
    -keyout server.key -out server.csr >/dev/null 2>&1
  printf "%s\n" \
    "basicConstraints=critical,CA:FALSE" \
    "keyUsage=critical,digitalSignature,keyEncipherment" \
    "extendedKeyUsage=serverAuth" \
    "subjectAltName=DNS:creapp.test,IP:127.0.0.1" > server.ext
  openssl x509 -req -in server.csr -CA ca.crt -CAkey ca.key -CAcreateserial \
    -days 2 -sha256 -extfile server.ext -out server.crt >/dev/null 2>&1
  chmod 0644 ca.crt server.crt server.key
' _ "$RUN_DIR/certs"

step node22-frontend-checks docker run --rm \
  --user "$(id -u):$(id -g)" \
  -e HOME=/tmp/node-home \
  -v "$WORKTREE/frontend:/workspace" -w /workspace node:22-bookworm \
  sh -ec 'mkdir -p "$HOME"; node --version; npm --version; npm ci; npm run typecheck; npm test; VITE_API_URL=/api VITE_STATIC_BASE=/api/static/ npm run build'

DC=(docker compose --project-directory "$HARNESS" --env-file "$ENV_FILE" \
  -p "$PROJECT" -f "$HARNESS/compose.yaml")
step compose-static-config docker compose --project-directory "$HARNESS" \
  --env-file "$ENV_FILE" -p "$PROJECT" -f "$HARNESS/compose.yaml" config --quiet
step backend-image-build docker compose --project-directory "$HARNESS" \
  --env-file "$ENV_FILE" -p "$PROJECT" -f "$HARNESS/compose.yaml" build api
STACK_MAY_EXIST=1
printf 'Compose project: %s\nHTTPS loopback port: %s\nDatabase host port: none\n' \
  "$PROJECT" "$HTTPS_PORT" >> "$RUN_DIR/results.txt"
step postgres17-start docker compose --project-directory "$HARNESS" \
  --env-file "$ENV_FILE" -p "$PROJECT" -f "$HARNESS/compose.yaml" up -d db

wait_for_db() {
  local attempt
  for attempt in $(seq 1 60); do
    if "${DC[@]}" exec -T db pg_isready -U postgres -d postgres >/dev/null 2>&1; then
      "${DC[@]}" exec -T db postgres --version
      return 0
    fi
    sleep 2
  done
  printf 'PostgreSQL did not become ready. Inspect logs in %s\n' "$LOG_DIR" >&2
  return 1
}
step postgres-ready wait_for_db
step bootstrap-disposable-db bash -c '"$@" exec -T db sh -s' _ "${DC[@]}" < "$HARNESS/bootstrap-db.sh"
step python-django-gunicorn-versions "${DC[@]}" run --rm api python -c \
  'import django, gunicorn; print("Python", __import__("sys").version.split()[0]); print("Django", django.get_version()); print("Gunicorn", gunicorn.__version__)'
step migrate-empty-postgresql "${DC[@]}" run --rm api python backend/manage.py migrate --noinput
step makemigrations-check "${DC[@]}" run --rm api python backend/manage.py makemigrations --check --dry-run
step importer-preservation-tests "${DC[@]}" run --rm --workdir /app/backend api python manage.py test \
  planning.tests.ImportTipoActividadXlsxCommandTests
# Django's built-in test Client exercises plain HTTP. Disable only HTTPS redirect
# in this disposable test-run process; the real API container remains HTTPS-only.
step full-django-test-suite "${DC[@]}" run --rm --workdir /app/backend \
  -e SECURE_SSL_REDIRECT=False api python manage.py test
step check-deploy-report "${DC[@]}" run --rm api python backend/manage.py check --deploy
step staticfiles-volume-permissions "${DC[@]}" run --rm --user 0 api \
  chown -R 10001:10001 /app/backend/staticfiles
step django-collectstatic "${DC[@]}" run --rm api python backend/manage.py collectstatic --noinput
step create-disposable-admin "${DC[@]}" run --rm api python backend/manage.py createsuperuser --noinput
step start-api-and-unprivileged-nginx "${DC[@]}" up -d api nginx
step record-image-digests bash -c '
  set -eu
  for image in node:22-bookworm postgres:17 nginxinc/nginx-unprivileged:stable-alpine; do
    docker image inspect --format "IMAGE {{.RepoTags}} {{.Id}} {{json .RepoDigests}}" "$image" | tee -a "$5/run.meta"
  done
  api_image=$(docker compose --project-directory "$1" --env-file "$2" -p "$3" -f "$4" images -q api)
  docker image inspect --format "IMAGE api {{.Id}} {{json .RepoDigests}}" "$api_image" | tee -a "$5/run.meta"
' _ "$HARNESS" "$ENV_FILE" "$PROJECT" "$HARNESS/compose.yaml" "$RUN_DIR"
step nginx-config-test "${DC[@]}" exec -T nginx nginx -t
step compose-service-state "${DC[@]}" ps --all
step nginx-published-port docker inspect --format '{{json .NetworkSettings.Ports}}' "$PROJECT-nginx-1"

step https-api-spa-csrf-admin-smoke env \
  BASE_URL="https://creapp.test:$HTTPS_PORT" \
  CA_FILE="$RUN_DIR/certs/ca.crt" \
  TEST_ADMIN_USERNAME=creapp-smoke-admin \
  TEST_ADMIN_PASSWORD="$(awk -F= '$1=="DJANGO_SUPERUSER_PASSWORD" {print $2}' "$ENV_FILE")" \
  python3 "$HARNESS/probe.py"

count_rows() {
  local database="$1"
  "${DC[@]}" exec -T db sh -ec \
    'PGPASSWORD="$APP_DB_PASSWORD" psql -h 127.0.0.1 -U creapp_usr -d "$1" -Atc "SELECT count(*) FROM unidad_academica"' \
    sh "$database"
}

step pg-dump-custom-format bash -c '
  set -eu
  umask 077
  docker compose --project-directory "$1" --env-file "$2" -p "$3" -f "$4" \
    exec -T db sh -ec '\''PGPASSWORD="$APP_DB_PASSWORD" pg_dump -h 127.0.0.1 -U creapp_usr -d creapp_db -Fc'\'' \
    > "$5/creapp-acceptance.dump"
' _ "$HARNESS" "$ENV_FILE" "$PROJECT" "$HARNESS/compose.yaml" "$RUN_DIR"
step pg-create-isolated-restore-db "${DC[@]}" exec -T db \
  psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
  -c 'CREATE DATABASE creapp_restore_test OWNER creapp_usr ENCODING '\''UTF8'\'''
before_count="$(count_rows creapp_db)"
step pg-restore-exit-on-error-single-transaction bash -c '
  set -eu
  docker compose --project-directory "$1" --env-file "$2" -p "$3" -f "$4" \
    exec -T db sh -ec '\''PGPASSWORD="$APP_DB_PASSWORD" pg_restore --exit-on-error --single-transaction -h 127.0.0.1 -U creapp_usr -d creapp_restore_test'\'' \
    < "$5/creapp-acceptance.dump"
' _ "$HARNESS" "$ENV_FILE" "$PROJECT" "$HARNESS/compose.yaml" "$RUN_DIR"
after_count="$(count_rows creapp_restore_test)"
printf 'backup restore table unidad_academica: source=%s restored=%s\n' \
  "$before_count" "$after_count" | tee -a "$RUN_DIR/results.txt"
[[ "$before_count" == "$after_count" ]]
printf 'PASS  pg-backup-restore-row-count-equality\n' | tee -a "$RUN_DIR/results.txt"

printf '\nALL ACCEPTANCE STEPS PASSED\nEvidence: %s\n' "$RUN_DIR" | tee -a "$RUN_DIR/results.txt"
