#!/usr/bin/env bash
set -Eeuo pipefail

HARNESS="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
if [[ $# -ne 1 ]]; then
  printf 'Usage: %s <TEST_ROOT>/runs/run.XXXXXX\n' "$0" >&2
  exit 2
fi

RUN_DIR="$(realpath "$1")"
[[ -f "$RUN_DIR/run.meta" && -f "$RUN_DIR/runtime.env" ]] || {
  printf 'Missing harness marker or runtime env in %s\n' "$RUN_DIR" >&2
  exit 2
}

PROJECT="$(awk -F= '$1=="PROJECT" {print $2}' "$RUN_DIR/run.meta")"
TEST_ROOT="$(awk -F= '$1=="TEST_ROOT" {sub(/^TEST_ROOT=/, ""); print; exit}' "$RUN_DIR/run.meta")"
[[ -n "$TEST_ROOT" && -d "$TEST_ROOT" ]] || {
  printf 'Missing TEST_ROOT marker in %s/run.meta\n' "$RUN_DIR" >&2
  exit 2
}
RUNS="$(realpath -m "$TEST_ROOT/runs")"
case "$RUN_DIR/" in
  "$RUNS"/*) ;;
  *) printf 'Refusing cleanup outside this harness run directory: %s\n' "$RUN_DIR" >&2; exit 2 ;;
esac
[[ "$PROJECT" == creapp-selfhost-check-* ]] || {
  printf 'Refusing unexpected Compose project name: %s\n' "$PROJECT" >&2
  exit 2
}

# The explicit project name scopes this removal to this acceptance run only.
docker compose --project-directory "$HARNESS" --env-file "$RUN_DIR/runtime.env" \
  -p "$PROJECT" -f "$HARNESS/compose.yaml" down --volumes --remove-orphans

# Retain results, command logs, copied source and backup dump as evidence.
# Remove only this run's ephemeral credentials and TLS private keys.
rm -f "$RUN_DIR/runtime.env" "$RUN_DIR/certs/ca.key" \
  "$RUN_DIR/certs/server.key" "$RUN_DIR/certs/server.csr" \
  "$RUN_DIR/certs/server.ext" "$RUN_DIR/certs/ca.srl"
printf 'Removed only project %s resources; retained evidence at %s\n' "$PROJECT" "$RUN_DIR"
