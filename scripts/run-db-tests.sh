#!/usr/bin/env bash

set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: Supabase CLI is required to run database tests." >&2
  exit 1
fi

started_stack=0
tmp_dir="$(mktemp -d)"
diagnostics_dir="${DB_TEST_DIAGNOSTICS_DIR:-/tmp/vastra-db-test-diagnostics}"

rm -rf "$diagnostics_dir"
mkdir -p "$diagnostics_dir"

cleanup() {
  local exit_code=$?

  trap - EXIT

  rm -rf "$tmp_dir"

  if [[ "$started_stack" -eq 1 ]]; then
    if ! supabase stop >/dev/null 2>&1; then
      if [[ "$exit_code" -eq 0 ]]; then
        exit_code=1
      fi
    fi
  fi

  exit "$exit_code"
}

trap cleanup EXIT

run_logged() {
  local label="$1"
  shift

  local safe_label="${label//[^a-zA-Z0-9_-]/_}"
  local log_file="$tmp_dir/${safe_label}.log"

  printf '\n--- %s ---\n' "$label"

  if "$@" >"$log_file" 2>&1; then
    echo "PASS: $label"
    return 0
  fi

  cp "$log_file" "$diagnostics_dir/${safe_label}.log"
  tail -n 240 "$log_file" >"$diagnostics_dir/${safe_label}-tail.log"
  printf 'Failed step: %s\n' "$label" >"$diagnostics_dir/summary.txt"

  echo "ERROR: $label failed" >&2
  echo "--- bounded failure output (last 240 lines) ---" >&2
  cat "$diagnostics_dir/${safe_label}-tail.log" >&2
  return 1
}

if ! supabase status --output json >/dev/null 2>&1; then
  # Database tests require only PostgreSQL. Avoid starting unrelated
  # services such as Mailpit/Inbucket, which can cause CI port collisions.
  run_logged "start database" supabase db start
  started_stack=1
fi

run_logged "reset database" supabase db reset --local
run_logged "list migrations" supabase migration list --local
run_logged "pgTAP suite" supabase test db --local
run_logged "legacy concurrency" bash scripts/run-db-concurrency-tests.sh
run_logged "branch inventory concurrency" \
  bash scripts/run-branch-inventory-concurrency-tests.sh
run_logged "Phase 2D checkout concurrency" \
  bash scripts/run-phase-2d-checkout-concurrency-tests.sh
run_logged "database advisers" supabase db advisors --local
