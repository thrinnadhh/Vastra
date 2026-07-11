#!/usr/bin/env bash
set -euo pipefail

if ! command -v codex >/dev/null 2>&1; then
  echo "Codex CLI is not installed or not on PATH."
  exit 1
fi

echo "Verifying root instructions..."
codex --ask-for-approval never \
  "List the instruction files you loaded and summarize the frozen Vastra MVP boundary. Do not modify files."

for dir in apps/backend apps/customer-app apps/merchant-app apps/captain-app apps/admin-dashboard supabase; do
  if [[ -d "$dir" ]]; then
    echo
    echo "Verifying instructions for $dir ..."
    codex --cd "$dir" --ask-for-approval never \
      "List the instruction files active in this directory. Do not modify files."
  fi
done

echo
echo "Instruction verification completed."
