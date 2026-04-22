# Juanie Platform Contract

This repository is connected to **Juanie**.

## Platform-managed files

- `{{CI_FILE}}`
- `juanie.yaml`
- `.env.juanie.example`
- `JUANIE.md`

These files are injected and updated by Juanie during project import or project creation.

## Rules

- Do not hand-edit the platform-managed files above.
- Real secrets and runtime environment values live in Juanie, not in this repository.
- If the Juanie workflow contract becomes stale or preview/release triggering fails, re-sync the project from Juanie instead of patching the files manually.

## What Juanie reads from this repo

- service build and runtime structure
- schema and database intent from `juanie.yaml`
- application source at the selected branch or commit

## What Juanie owns outside this repo

- environment variables and secrets
- managed databases and networking
- preview and release orchestration

Project: `{{PROJECT_NAME}}`
Slug: `{{PROJECT_SLUG}}`
