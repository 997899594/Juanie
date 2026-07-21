# Control-Plane Schema Convergence Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Prevent Juanie runtime rollouts against an incompatible control-plane PostgreSQL schema and
repair the existing release-migration-plan lineage through a forward-only revision.

**Architecture:** Add a convergent Atlas migration for both known historical states. Generate the
runtime compatibility contract from Drizzle metadata, validate it after expand migrations, then run
bounded representative read models before the Helm hook allows Web rollout.

**Tech Stack:** Bun, TypeScript, Drizzle ORM, PostgreSQL catalogs, Atlas Community, Helm hooks

---

### Task 1: Lock the forward-only repair decision

**Files:**
- Create: `docs/adr/0008-enforce-control-plane-schema-convergence.md`
- Create: `docs/plans/2026-07-21-control-plane-schema-convergence-design.md`

**Steps:**
1. Record the divergent migration hashes and failure mode.
2. Document required-subset compatibility and rejected alternatives.
3. Confirm that no existing migration file is modified.

### Task 2: Add the convergent migration

**Files:**
- Create: `migrations/20260721163000_reconcile_release_migration_plan_schema.sql`
- Modify: `migrations/atlas.sum`
- Test: `src/lib/db/__tests__/control-plane-schema-convergence.test.ts`

**Steps:**
1. Write tests that require guarded enum, table, column, constraint, and index creation.
2. Add the append-only reconciliation DDL.
3. Refresh Atlas checksums.
4. Validate the migration directory against a fresh PostgreSQL database.

### Task 3: Generate and inspect the runtime schema contract

**Files:**
- Create: `src/lib/db/control-plane-schema-contract.ts`
- Test: `src/lib/db/__tests__/control-plane-schema-contract.test.ts`

**Steps:**
1. Test contract generation for `releaseMigrationPlan` and `migrationRun`.
2. Test bounded violations for missing tables, columns, enum values, indexes, and constraints.
3. Build expected objects from Drizzle table/enum metadata.
4. Inspect matching PostgreSQL catalog records through the control-plane connection.
5. Fail closed with bounded operator-safe diagnostics.

### Task 4: Add representative read-model smoke gates

**Files:**
- Create: `src/lib/db/control-plane-read-model-smoke.ts`
- Modify: `src/lib/db/control-plane-atlas.ts`
- Test: `src/lib/db/__tests__/control-plane-read-model-smoke.test.ts`

**Steps:**
1. Define bounded migration-run and release-migration-plan Drizzle query graphs.
2. Execute them after schema contract validation.
3. Log only read-model names and success counts.
4. Verify schema contract and read-model smoke run after every expand apply.

### Task 5: Verify the complete release boundary

**Files:**
- Modify only if assertions require it: `.github/workflows/ci.yml`
- Test: existing Helm contract and schema-runner image smoke checks

**Steps:**
1. Run focused unit tests.
2. Run `bun run db:hash` and `bun run db:validate`.
3. Run the full Bun test suite, lint, typecheck, and Biome check.
4. Build the production Next.js and schema-runner images/contracts.
5. Confirm the worktree contains no modification to pre-existing migration SQL files.
