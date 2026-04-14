#!/usr/bin/env bash

set -euo pipefail

cd "$(git rev-parse --show-toplevel)"

files=()
while IFS= read -r file; do
  [[ -f "$file" ]] || continue
  [[ "$file" == src/* ]] || continue
  case "$file" in
    *.ts|*.tsx|*.js|*.jsx|*.json|*.css|*.md)
      files+=("$file")
      ;;
  esac
done < <(git diff --cached --name-only --diff-filter=ACMR)

if ((${#files[@]} > 0)); then
  bunx biome check --write "${files[@]}"
  git add -- "${files[@]}"
fi

bun run typecheck
