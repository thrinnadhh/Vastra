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
    if ! supabase stop; then
      if [[ "$exit_code" -eq 0 ]]; then
        exit_code=1
      fi
    fi
  fi

  exit "$exit_code"
}

trap cleanup EXIT

if ! supabase status --output json >/dev/null 2>&1; then
  supabase start
  started_stack=1
fi

supabase db reset --local
supabase test db --local
