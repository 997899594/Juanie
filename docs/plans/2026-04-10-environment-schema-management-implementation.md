# Environment Schema Management Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add environment-level schema management visibility to Juanie so operators can inspect whether a shared environment database is managed, ledger-missing, drifted, or blocked before release.

**Architecture:** Keep repo migration files as the source of truth and build a thin schema-state layer on top of the existing migration platform. Phase 1 only adds persisted schema state, inspection logic, inspection APIs, and environment-page visibility. It does not yet generate repair PRs or execute dynamic repair SQL.

**Tech Stack:** Next.js 16, TypeScript, Drizzle ORM, PostgreSQL, Bun, existing Juanie migration orchestration, existing NexusNote Drizzle migration contract.

---

## Current Capability Summary

Juanie already has:

- repo-backed migration spec parsing from `juanie.yaml`
- explicit migration execution modes: `automatic`, `manual_platform`, `external`
- release planning that counts migration gates
- release orchestration that blocks rollout on migration runs
- migration runner infrastructure for K8s jobs and worker execution
- approvals UI and run-level actions
- legacy script-level `baseline-adopted` logic in `scripts/db-push.ts`

NexusNote already has:

- CI that builds and pushes image, then triggers Juanie release
- tracked Drizzle migrations as deployment truth
- a `db:migrate` entrypoint that seeds legacy baseline when needed
- runtime schema verification and `503` health failure on incompatible schema
- `buildSha` exposure in `/api/health`

## Missing Capability

What is still missing is not migration execution. The missing layer is environment-level schema ownership state.

Today Juanie cannot answer these questions in-product:

- has this environment database ever been inspected?
- is it managed by the repo migration chain?
- is the migration ledger missing?
- is it behind or diverged from the repo migration chain?

## Product Decision

Phase 1 uses these schema states:

- `aligned`
- `aligned_untracked`
- `drifted`
- `unmanaged`
- `blocked`

Interpretation in Phase 1:

- `aligned`: observed migration ledger matches repo migration truth
- `aligned_untracked`: repo expects tracked migrations, the database has user tables, but the observed ledger is empty or missing
- `drifted`: observed migration ledger does not match the repo migration chain
- `unmanaged`: no usable repo migration truth or the environment has not yet entered managed migration flow
- `blocked`: inspection cannot complete safely

Phase 1 intentionally stops short of automatic repair generation.

## Inspection Strategy

Phase 1 supports these tool-specific inspectors:

### Drizzle

- resolve migration path from repo config
- load `drizzle/meta/_journal.json` from the child-app repo
- inspect target database `drizzle.__drizzle_migrations`
- classify state by comparing observed hashes against repo tags

### SQL

- resolve migration path from repo config
- fetch tracked SQL files from the child-app repo
- compare them with Juanie `databaseMigration` success records for that target database

### Unsupported tools

- classify as `blocked`
- return a clear summary so the operator knows the limitation is tooling, not the database

## Phase 1 Deliverables

### Task 1: Persist schema state

Add one table that stores the latest known inspection state per environment database.

Required fields:

- `projectId`
- `environmentId`
- `databaseId`
- `status`
- `expectedVersion`
- `actualVersion`
- `expectedChecksum`
- `actualChecksum`
- `hasLedger`
- `hasUserTables`
- `summary`
- `lastInspectedAt`
- `lastErrorCode`
- `lastErrorMessage`

This is the minimum state needed for visibility.

### Task 2: Add tool-specific inspection service

Implement a schema-management service that:

- resolves the effective migration specification for a target database
- runs the correct inspector for `drizzle` or `sql`
- classifies the result
- upserts the latest schema state row

Keep classification logic pure and unit-testable.

### Task 3: Add schema-state APIs

Add:

- `GET /api/projects/:id/databases/:dbId/schema/state`
- `POST /api/projects/:id/databases/:dbId/schema/inspect`

Rules:

- require project access
- enforce environment-management guardrails
- `GET` returns the latest persisted state if present
- `POST` runs inspection and persists the result

### Task 4: Surface schema state in the environment page

Extend environment list data so each database can show:

- current schema-state badge
- state summary
- inspect action
- last inspected timestamp

Do not create a brand-new screen. Reuse the environment page.

### Task 5: Defer adoption and repair generation

Do not implement these in Phase 1:

- baseline PR generation
- repair PR generation
- release preflight blocking on schema state

They stay in the next phase after inspection is trustworthy.

## Phase 2: Mark Aligned Adoption

After Phase 1, the next operator action is `标记为已对齐`.

Scope:

- only available for `aligned_untracked`
- must write real ledger metadata instead of only flipping UI state
- after the action completes, a fresh inspect must return `aligned`

Implementation rules:

- for `drizzle + postgresql`, create the Drizzle ledger schema/table when missing and seed ledger entries from repo journal tags
- for `sql`, mark repo migration files as successful in Juanie `databaseMigration`
- unsupported tools remain blocked
- release preflight may block on schema state, but `标记为已对齐` is the supported path to recover an `aligned_untracked` environment

## Data Contract

Phase 1 server responses should expose:

- raw `status`
- human-readable `statusLabel`
- `summary`
- `lastInspectedAt`
- `expectedVersion`
- `actualVersion`
- `hasLedger`
- `hasUserTables`

That is enough for UI and for future release preflight work.

## Implementation Notes

### Why no repair automation yet

Because the current gap is visibility, not execution. Shipping inspect + persisted state first gives operators a safe control surface and avoids inventing opaque production SQL.

### Why one row instead of full history first

Because Phase 1 is about current control-plane state. A history table can follow after the inspect contract settles.

### Why `aligned_untracked` is heuristic in Phase 1

Because repo truth exists, but some legacy environments may have user tables without a migration ledger. Phase 1 only detects that condition and surfaces it. It does not auto-accept it as healthy for release.

## Success Criteria

Phase 1 is complete when:

- an operator can open an environment in Juanie and see schema state for each database
- an operator can click inspect and get a persisted result
- Juanie can distinguish at least `aligned`, `aligned_untracked`, `drifted`, `unmanaged`, and `blocked`
- no destructive repair SQL is introduced
- no child-app migration contract is broken
