#!/usr/bin/env bash

set -euo pipefail

if ! command -v supabase >/dev/null 2>&1; then
  echo "ERROR: Supabase CLI is required to run database tests." >&2
  exit 1
fi

started_stack=0

cleanup() {
  local exit_code=$?

  trap - EXIT

  if [[ "$started_stack" -eq 1 ]]; then
    supabase stop --no-backup >/dev/null 2>&1 || true
  fi

  exit "$exit_code"
}

trap cleanup EXIT

if ! supabase status --output json >/dev/null 2>&1; then
  # Database tests require only PostgreSQL. Avoid starting unrelated
  # services such as Mailpit/Inbucket, which can cause CI port collisions.
  supabase db start
  started_stack=1
fi

supabase db reset --local
supabase migration list --local
supabase test db --local
bash scripts/run-db-concurrency-tests.sh
supabase db advisors --local
