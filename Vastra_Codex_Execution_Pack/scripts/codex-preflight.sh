#!/usr/bin/env bash
set -euo pipefail

required_docs=(
  "docs/product/mvp-scope.md"
  "docs/product/business-rules.md"
  "docs/workflows/order-state-machine.md"
  "docs/architecture/security-model.md"
  "docs/api/openapi.yaml"
  "docs/testing/acceptance-tests.md"
)

missing=0
for file in "${required_docs[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "MISSING: $file"
    missing=1
  else
    echo "OK: $file"
  fi
done

if [[ ! -f "AGENTS.md" ]]; then
  echo "MISSING: AGENTS.md"
  missing=1
else
  echo "OK: AGENTS.md"
fi

if [[ "$missing" -ne 0 ]]; then
  echo
  echo "Preflight failed. Extract both the docs pack and Codex execution pack into the repository root."
  exit 1
fi

echo
echo "Preflight passed."
echo "Next: run codex/prompts/00-repository-audit.md"
