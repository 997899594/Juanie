# Atlas Bounded Community Runner Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the vulnerable Atlas extended binary with a reproducibly built community CLI while preserving exact target-version migration boundaries.

**Architecture:** Juanie owns release boundaries instead of depending on the extended-only `--to-version` flag. A shared planner derives the exact positional migration count from the ordered migration directory, completed Atlas revisions, and the requested target; baseline adoption is explicit through `migrate set`, and every bounded execution verifies the target revision afterward.

**Tech Stack:** Bun, TypeScript, Atlas Community CLI 1.2.3, Go 1.26.5, Docker BuildKit, Trivy

**Production lineage addendum:** A historical merge inserted four migrations behind the already
published `20260714120000` revision. The permanent repair is
`20260714130000_reconcile_control_plane_history.sql`: it restores the skipped expand schema,
backfills credential envelopes, and becomes the new continuity baseline. Only this marked lineage
uses Atlas `linear-skip`; the missing destructive revision remains unrecorded and is superseded by
the independently promoted contract chain. CI enforces append-only migration versions after this
checkpoint.

---

### Task 1: Define The Bounded Migration Contract

**Files:**
- Modify: `src/lib/migrations/atlas.ts`
- Test: `src/lib/migrations/__tests__/atlas.test.ts`

**Step 1: Write failing planner tests**

Cover fresh databases, partially applied histories, an already-applied target, an unreachable target behind the latest revision, and unknown declared/applied versions.

**Step 2: Verify the tests fail**

Run: `bun test src/lib/migrations/__tests__/atlas.test.ts`

Expected: FAIL because the bounded planner and positional argument contract do not exist.

**Step 3: Implement the shared planner**

Add `resolveAtlasBoundedMigrationCount()` with this contract:

```ts
resolveAtlasBoundedMigrationCount({
  declaredVersions,
  appliedVersions,
  targetVersion,
}): number | null
```

Return `null` for an unbounded apply, `0` when the target is already complete, and otherwise the exact number of migrations after the latest completed revision through the target. Reject undeclared targets, unknown applied revisions, duplicate declarations, and histories that have passed a missing target.

Replace `--to-version` and `--baseline` in `buildAtlasMigrateApplyArgs()` with an optional positive positional `migrationCount`. Add `buildAtlasMigrateSetArgs()` for explicit baseline adoption.

**Step 4: Verify helper tests pass**

Run: `bun test src/lib/migrations/__tests__/atlas.test.ts`

Expected: PASS.

### Task 2: Apply The Contract To Project Migrations

**Files:**
- Modify: `src/lib/migrations/executor.ts`
- Test: `src/lib/migrations/__tests__/atlas.test.ts`

**Step 1: Adopt baselines explicitly**

When an existing database has no Atlas history and declares a baseline, execute `migrate set` before planning the bounded apply.

**Step 2: Execute the exact count**

Use the shared planner with workspace versions and completed database revisions. Skip Atlas apply when the count is zero; otherwise pass the count as the command's sole positional argument.

**Step 3: Verify the postcondition**

After execution, fail the migration run if a requested target is absent from completed Atlas revisions. Continue recording only revisions newly observed after the run.

**Step 4: Run migration tests**

Run: `bun test src/lib/migrations/__tests__/atlas.test.ts src/lib/migrations/__tests__/executor.test.ts`

Expected: PASS.

### Task 3: Apply The Contract To Control-Plane Expand

**Files:**
- Modify: `src/lib/db/control-plane-atlas.ts`
- Modify: `src/lib/db/__tests__/control-plane-migration-phases.test.ts`

**Step 1: Read completed revisions as one ordered set**

Query only successful, fully applied Atlas revisions and reuse that result for boundary planning and postcondition checks.

**Step 2: Replace the extended flag**

Create a control-plane helper that plans the exact migration count through the credential-envelope boundary, runs community Atlas with the positional amount, and asserts that the boundary revision was recorded.

**Step 3: Update the architectural source test**

Assert use of the bounded helper and the absence of `--to-version` in the control-plane runner.

**Step 4: Run control-plane migration tests**

Run: `bun test src/lib/db/__tests__/control-plane-migration-phases.test.ts`

Expected: PASS.

### Task 4: Rebuild Atlas Reproducibly And Gate Its Capabilities

**Files:**
- Modify: `Dockerfile`
- Modify: `.github/workflows/ci.yml`
- Modify: `AGENTS.md`

**Step 1: Restore a source-based Atlas build**

Download the pinned Atlas 1.2.3 source commit and Go 1.26.5 archives with architecture-specific SHA256 checks, then compile the community flavor with `GOTOOLCHAIN=local` and `-trimpath`.

**Step 2: Gate the expected CLI contract**

At image build time and in the published-image smoke test, require the `apply [flags] [amount]` usage and reject `--to-version` so the runtime cannot silently drift back to the extended contract.

**Step 3: Update repository guidance**

Document that Juanie owns bounded migration planning and that schema-runner must use the pinned, security-current community build.

**Step 4: Verify locally**

Run:

```bash
bun run lint
bun run typecheck
bun test src/lib/migrations/__tests__/atlas.test.ts \
  src/lib/db/__tests__/control-plane-migration-phases.test.ts
docker buildx build --load --target schema-runner -t juanie-schema-runner:bounded-atlas .
trivy image --skip-db-update --severity HIGH,CRITICAL --ignore-unfixed \
  --exit-code 1 juanie-schema-runner:bounded-atlas
```

Expected: all checks pass and the schema-runner image contains no fixable HIGH/CRITICAL vulnerabilities.

### Task 5: Release And Verify Production

**Files:**
- No additional source files.

**Step 1: Commit and push**

Commit the bounded migration implementation and push `HEAD:main`.

**Step 2: Monitor CI**

Require quality, integration, all three signed/scanned images, and the schema-runner capability smoke to succeed.

**Step 3: Verify production**

Confirm the Helm schema-expand job succeeds, the release is deployed, workloads roll out, and production health endpoints remain healthy.
