#!/usr/bin/env bash
set -euo pipefail

repository_root="$(git rev-parse --show-toplevel 2>/dev/null)" || {
  echo "Repository hygiene check must run inside a Git worktree." >&2
  exit 1
}
cd "$repository_root"

failed=0

report_failure() {
  printf 'ERROR: %s\n' "$1" >&2
  failed=1
}

is_environment_template() {
  [[ "$1" == *.example ]]
}

while IFS= read -r -d '' path; do
  case "$path" in
    .env|*/.env|.env.*|*/.env.*|.envrc|*/.envrc)
      if ! is_environment_template "$path"; then
        report_failure "tracked local environment file: $path"
      fi
      ;;
  esac

  case "$path" in
    node_modules/*|*/node_modules/*|\
    .pnpm-store/*|*/.pnpm-store/*|\
    .turbo/*|*/.turbo/*|\
    dist/*|*/dist/*|\
    build/*|*/build/*|\
    out/*|*/out/*|\
    coverage/*|*/coverage/*|\
    .next/*|*/.next/*|\
    .expo/*|*/.expo/*|\
    supabase/.temp/*|*/supabase/.temp/*|\
    *.tsbuildinfo|*.log)
      report_failure "tracked generated artifact: $path"
      ;;
  esac
done < <(git ls-files -z)

ignored_paths=(
  ".env"
  "apps/backend/.env.local"
  "node_modules/example"
  ".pnpm-store/example"
  ".turbo/example"
  "dist/example"
  "build/example"
  "out/example"
  "coverage/example"
  ".next/example"
  ".expo/example"
  "example.tsbuildinfo"
  "example.log"
  "supabase/.temp/example"
)

for path in "${ignored_paths[@]}"; do
  if ! git check-ignore --quiet --no-index "$path"; then
    report_failure "expected path is not ignored: $path"
  fi
done

template_paths=(
  ".env.example"
  "apps/backend/.env.example"
  "Vastra_Supabase_SQL_and_Env_Pack/.env.backend.example"
)

for path in "${template_paths[@]}"; do
  if git check-ignore --quiet --no-index "$path"; then
    report_failure "sanitized environment template is ignored: $path"
  fi
done

if [[ "$failed" -ne 0 ]]; then
  echo "Repository hygiene check failed." >&2
  exit 1
fi

echo "Repository hygiene check passed."
