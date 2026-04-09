# Manual Migration Release Gate Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Turn hand-declared pre-deploy migrations into hard release gates in Juanie, then add NexusNote-side schema compatibility checks so new code never serves traffic against an incomplete database schema.

**Architecture:** Keep child-app CI limited to image build plus release trigger, but extend the Juanie release contract so every declared pre-deploy migration is resolved into one of three explicit execution modes: `automatic`, `manual_platform`, or `external`. Juanie must create a migration run for every pre-deploy migration, block deployment until each run reaches a satisfied terminal state, surface the blocking state in release planning and approvals UI, and let operators complete the action from Juanie instead of shelling into the platform. NexusNote then needs to declare the new execution mode explicitly, strengthen its schema verification, and fail health checks when the runtime schema does not satisfy the current app version.

**Tech Stack:** Next.js 16, Bun, Drizzle ORM, BullMQ, Zod, PostgreSQL, Node scripts, React 19.

---

### Task 1: Extend Juanie Migration Contract And Persistence

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/config/parser.ts`
- Modify: `src/lib/migrations/types.ts`
- Modify: `src/lib/queue/project-init.ts`
- Create: `migrations/003_manual_migration_execution_modes.sql`
- Test: `src/lib/releases/__tests__/planning.test.ts`
- Test: `src/lib/migrations/__tests__/resolver.test.ts`

**Step 1: Write the failing tests**

Add parser and planning coverage that proves these cases:

```ts
expect(parseJuanieConfig(yamlWithManualPlatform).data?.services[0]?.migrate?.executionMode)
  .toBe('manual_platform');

expect(parseJuanieConfig(yamlWithExternal).data?.services[0]?.migrate?.executionMode)
  .toBe('external');

expect(plan.migration.manualPlatformCount).toBe(1);
expect(plan.migration.externalCount).toBe(1);
```

Add resolver coverage that `executionMode` survives `juanie.yaml -> migrationSpecification -> ResolvedMigrationSpec`.

**Step 2: Run tests to verify they fail**

Run:

```bash
bun test src/lib/releases/__tests__/planning.test.ts src/lib/migrations/__tests__/resolver.test.ts
```

Expected: FAIL because `executionMode`, new counters, and new persistence fields do not exist yet.

**Step 3: Add the new contract fields**

Implement these contract changes:

```ts
export const migrationExecutionModes = ['automatic', 'manual_platform', 'external'] as const;
export type MigrationExecutionMode = (typeof migrationExecutionModes)[number];
```

Persist `executionMode` on `migrationSpecifications`. Add `awaiting_external_completion` to `migrationRunStatuses`. Add `awaiting_external_completion` to `releaseStatuses`.

In `parser.ts`, accept both:

```ts
executionMode?: 'automatic' | 'manual_platform' | 'external'
autoRun?: boolean
```

Translate old configs for backward compatibility:

```ts
if (!executionMode) {
  executionMode = autoRun === false ? 'manual_platform' : 'automatic';
}
```

In `project-init.ts`, stop generating `autoRun: false` for `db:push`. Generate:

```yaml
migrate:
  tool: drizzle
  command: npm run db:push
  phase: preDeploy
  executionMode: manual_platform
  approvalPolicy: manual_in_production
```

**Step 4: Add the schema migration**

Create `migrations/003_manual_migration_execution_modes.sql` to:
- create the new enum for migration execution mode
- add `executionMode` to `migrationSpecification`
- extend `migrationRunStatus` with `awaiting_external_completion`
- extend `releaseStatus` with `awaiting_external_completion`
- backfill existing rows: `autoRun = true -> automatic`, `autoRun = false -> manual_platform`

If Juanie still keeps Drizzle artifacts aligned, run:

```bash
bun run db:generate
```

**Step 5: Re-run tests**

Run:

```bash
bun test src/lib/releases/__tests__/planning.test.ts src/lib/migrations/__tests__/resolver.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/lib/db/schema.ts src/lib/config/parser.ts src/lib/migrations/types.ts src/lib/queue/project-init.ts migrations/003_manual_migration_execution_modes.sql src/lib/releases/__tests__/planning.test.ts src/lib/migrations/__tests__/resolver.test.ts
git commit -m "feat: add explicit migration execution modes"
```

### Task 2: Make Release Planning Count All Pre-Deploy Gates

**Files:**
- Modify: `src/lib/releases/planning.ts`
- Modify: `src/lib/releases/planning-view.ts`
- Modify: `src/lib/releases/client-actions.ts`
- Modify: `src/components/projects/ManualReleaseDialog.tsx`
- Test: `src/lib/releases/__tests__/planning.test.ts`

**Step 1: Write the failing test**

Extend planning tests so one production release with:
- one `automatic` pre-deploy migration
- one `manual_platform` pre-deploy migration
- one `external` pre-deploy migration

produces:

```ts
expect(plan.migration.preDeployCount).toBe(3);
expect(plan.migration.automaticCount).toBe(1);
expect(plan.migration.manualPlatformCount).toBe(1);
expect(plan.migration.externalCount).toBe(1);
expect(plan.issue?.code).toBe('approval_blocked');
expect(plan.blockingReason).toBe('存在未满足的前置迁移门禁');
```

**Step 2: Run the test**

Run:

```bash
bun test src/lib/releases/__tests__/planning.test.ts
```

Expected: FAIL because planning currently filters to `autoRun` only.

**Step 3: Change the planning model**

In `summarizeReleasePlan`, stop filtering to `autoRun` first. Instead:
- count all `preDeploy` specs
- count by `executionMode`
- treat `manual_platform` and `external` as release-blocking until satisfied
- keep `postDeploy` visible but not pre-deploy blocking

Recommended shape:

```ts
migration: {
  preDeployCount: number;
  postDeployCount: number;
  automaticCount: number;
  manualPlatformCount: number;
  externalCount: number;
  warnings: string[];
  requiresApproval: boolean;
  requiresExternalCompletion: boolean;
}
```

Set a clear blocking reason for pre-deploy manual/external gates.

**Step 4: Update planning consumers**

Update `planning-view.ts`, `client-actions.ts`, and `ManualReleaseDialog.tsx` so the UI shows chips like:
- `前置迁移 3 项`
- `平台手动 1 项`
- `外部确认 1 项`

Do not let the dialog read as “safe to submit” when unresolved pre-deploy gates exist.

**Step 5: Re-run tests**

Run:

```bash
bun test src/lib/releases/__tests__/planning.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/lib/releases/planning.ts src/lib/releases/planning-view.ts src/lib/releases/client-actions.ts src/components/projects/ManualReleaseDialog.tsx src/lib/releases/__tests__/planning.test.ts
git commit -m "feat: expose manual migration gates in release planning"
```

### Task 3: Create Migration Runs For Every Pre-Deploy Gate

**Files:**
- Modify: `src/lib/migrations/index.ts`
- Modify: `src/lib/releases/orchestration.ts`
- Modify: `src/lib/queue/release.ts`
- Modify: `src/lib/releases/state-machine.ts`
- Modify: `src/app/api/releases/[releaseId]/status/route.ts`
- Test: `src/lib/releases/__tests__/intelligence.test.ts`
- Test: `src/lib/releases/__tests__/detail-view.test.ts`

**Step 1: Write the failing tests**

Add orchestration-oriented tests that prove:
- `automatic` pre-deploy specs become queued runs and execute immediately
- `manual_platform` pre-deploy specs become `awaiting_approval`
- `external` pre-deploy specs become `awaiting_external_completion`
- release status becomes `awaiting_approval` or `awaiting_external_completion` before deploy
- `/api/releases/[releaseId]/status` returns `resolution: "action_required"` for both statuses

**Step 2: Run the tests**

Run:

```bash
bun test src/lib/releases/__tests__/intelligence.test.ts src/lib/releases/__tests__/detail-view.test.ts
```

Expected: FAIL because current orchestration only creates runs for `autoRun` specs and only knows `awaiting_approval`.

**Step 3: Change run creation semantics**

In `resolveAndCreateMigrationRuns`, create runs for all pre-deploy specs:

```ts
switch (spec.specification.executionMode) {
  case 'automatic':
    status = 'queued';
    break;
  case 'manual_platform':
    status = 'awaiting_approval';
    break;
  case 'external':
    status = 'awaiting_external_completion';
    break;
}
```

Do not enqueue BullMQ jobs for non-automatic modes.

**Step 4: Change release orchestration**

In `runReleaseMigrationPhase`:
- load all runs created for this phase
- enqueue only `automatic`
- stop deployment as soon as one run is `awaiting_approval`
- stop deployment as soon as one run is `awaiting_external_completion`
- only enter `deploying` when every pre-deploy run is `success` or otherwise satisfied

Introduce a dedicated orchestration error for external completion similar to `ReleaseApprovalRequiredError`.

**Step 5: Update state and status presentation**

Extend release state machine and status endpoint so:
- `awaiting_approval` => “Juanie 内需要审批并执行”
- `awaiting_external_completion` => “需要外部迁移完成确认”

Return a concrete message naming the blocking migration target.

**Step 6: Re-run tests**

Run:

```bash
bun test src/lib/releases/__tests__/intelligence.test.ts src/lib/releases/__tests__/detail-view.test.ts
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/lib/migrations/index.ts src/lib/releases/orchestration.ts src/lib/queue/release.ts src/lib/releases/state-machine.ts src/app/api/releases/[releaseId]/status/route.ts src/lib/releases/__tests__/intelligence.test.ts src/lib/releases/__tests__/detail-view.test.ts
git commit -m "feat: gate deploys on all pre-deploy migration runs"
```

### Task 4: Productize Manual Platform Actions And External Completion

**Files:**
- Modify: `src/app/api/projects/[id]/migration-runs/[runId]/route.ts`
- Modify: `src/app/api/projects/[id]/databases/[dbId]/migrations/route.ts`
- Modify: `src/components/projects/ReleaseMigrationActions.tsx`
- Modify: `src/components/projects/DatabaseMigrationDialog.tsx`
- Modify: `src/components/projects/ReleaseDetailSections.tsx`
- Modify: `src/app/approvals/page.tsx`
- Modify: `src/lib/approvals/view.ts`
- Test: `src/lib/approvals/__tests__/view.test.ts`

**Step 1: Write the failing tests**

Add approval view tests to prove a run with `status: "awaiting_external_completion"`:
- appears on the approvals page
- gets a distinct label like `待外部完成`
- shows the right next action

Add API tests if a local pattern exists; otherwise cover reducer/formatter logic first.

**Step 2: Run the tests**

Run:

```bash
bun test src/lib/approvals/__tests__/view.test.ts
```

Expected: FAIL because approvals logic only knows `awaiting_approval`.

**Step 3: Add new actions**

In `migration-runs/[runId]/route.ts`, support:
- `approve` for `manual_platform`
- `retry` for failed/canceled runs
- `mark_external_complete` for `awaiting_external_completion`
- `mark_external_failed` for `awaiting_external_completion`

For `mark_external_complete`, set:

```ts
status = 'success'
finishedAt = new Date()
errorCode = null
errorMessage = null
```

Resume the owning release when the remaining pre-deploy runs are now satisfied.

For `mark_external_failed`, mark the run failed and the release `migration_pre_failed`.

**Step 4: Update the migration execution API**

In `databases/[dbId]/migrations/route.ts`:
- include `executionMode` in the plan payload
- do not enqueue a K8s job for `external`
- do not require command confirmation for `external`
- return operator-facing hints for both `manual_platform` and `external`

**Step 5: Update UI**

Change button surface in `ReleaseMigrationActions.tsx`:
- `awaiting_approval` => `Approve And Run`
- `awaiting_external_completion` => `Mark Complete` and `Mark Failed`

Update `DatabaseMigrationDialog.tsx`, `ReleaseDetailSections.tsx`, and `app/approvals/page.tsx` so the operator sees:
- execution mode
- required action
- whether Juanie will execute the command or only record external completion

**Step 6: Re-run tests**

Run:

```bash
bun test src/lib/approvals/__tests__/view.test.ts
bun run lint
```

Expected: PASS.

**Step 7: Commit**

```bash
git add src/app/api/projects/[id]/migration-runs/[runId]/route.ts src/app/api/projects/[id]/databases/[dbId]/migrations/route.ts src/components/projects/ReleaseMigrationActions.tsx src/components/projects/DatabaseMigrationDialog.tsx src/components/projects/ReleaseDetailSections.tsx src/app/approvals/page.tsx src/lib/approvals/view.ts src/lib/approvals/__tests__/view.test.ts
git commit -m "feat: add manual and external migration actions"
```

### Task 5: Harden Bootstrap And Contract Drift Visibility In Juanie

**Files:**
- Modify: `src/lib/queue/project-init.ts`
- Modify: `src/lib/releases/service.ts`
- Modify: `src/lib/releases/release-view-shared.ts`
- Modify: `src/lib/releases/recap.ts`
- Modify: `src/lib/releases/intelligence.ts`
- Test: `src/lib/releases/__tests__/service.test.ts`
- Test: `src/lib/releases/__tests__/intelligence.test.ts`

**Step 1: Write the failing tests**

Add release view tests that prove:
- releases blocked by external completion count as “attention”
- recap text mentions external/manual migration gate counts
- release cards show the new issue label instead of looking like an ordinary in-progress deploy

**Step 2: Run the tests**

Run:

```bash
bun test src/lib/releases/__tests__/service.test.ts src/lib/releases/__tests__/intelligence.test.ts
```

Expected: FAIL because only `awaiting_approval` is treated as a first-class blocking state today.

**Step 3: Update generated config defaults**

Keep bootstrap conservative, but make it explicit:
- `db:push` => `executionMode: manual_platform`
- add a comment that this blocks production release until approved in Juanie

This removes the silent “config exists but release ignores it” behavior.

**Step 4: Update release presentation**

Update list/detail/recap logic so:
- `approvalRunsCount` remains for platform approval
- add `externalCompletionRunsCount`
- attention filters and risk labels treat both as release-blocking
- recap strings mention `外部迁移待确认`

**Step 5: Re-run tests**

Run:

```bash
bun test src/lib/releases/__tests__/service.test.ts src/lib/releases/__tests__/intelligence.test.ts
```

Expected: PASS.

**Step 6: Commit**

```bash
git add src/lib/queue/project-init.ts src/lib/releases/service.ts src/lib/releases/release-view-shared.ts src/lib/releases/recap.ts src/lib/releases/intelligence.ts src/lib/releases/__tests__/service.test.ts src/lib/releases/__tests__/intelligence.test.ts
git commit -m "feat: surface migration gate drift in release views"
```

### Task 6: Update NexusNote Contract And Add App-Side Schema Guard

**Files:**
- Modify: `/Users/findbiao/projects/nexusnote/juanie.yaml`
- Modify: `/Users/findbiao/projects/nexusnote/scripts/db-verify.mjs`
- Create: `/Users/findbiao/projects/nexusnote/lib/server/schema-compatibility.ts`
- Modify: `/Users/findbiao/projects/nexusnote/app/api/health/route.ts`
- Modify: `/Users/findbiao/projects/nexusnote/DEPLOYMENT.md`

**Step 1: Update the release contract**

Replace the old migration block with an explicit execution mode:

```yaml
migrate:
  tool: drizzle
  workingDirectory: .
  command: npm run db:push
  phase: preDeploy
  executionMode: manual_platform
  approvalPolicy: manual_in_production
```

Do not keep `autoRun: false` as the primary contract once Juanie understands `executionMode`.

**Step 2: Strengthen schema verification**

Add the missing learn-chat columns to `scripts/db-verify.mjs`:

```js
["conversations", "learn_course_id"],
["conversations", "learn_chapter_index"],
```

This closes the exact gap that caused the current incident.

**Step 3: Add a runtime schema compatibility helper**

Create `lib/server/schema-compatibility.ts` that checks required columns via `information_schema.columns`.

Recommended shape:

```ts
export async function getSchemaCompatibility() {
  return {
    ok: boolean,
    missing: string[],
  };
}
```

Include at least:
- `conversations.learn_course_id`
- `conversations.learn_chapter_index`

**Step 4: Fail health checks on schema mismatch**

In `app/api/health/route.ts`, add the schema check alongside database and Redis.

Required behavior:
- `status: 503` when required schema columns are missing
- include a `checks.schema` payload listing missing items

This prevents the platform from treating the rollout as healthy when the app cannot safely serve traffic.

**Step 5: Update docs and verify**

Update `DEPLOYMENT.md` so it no longer says “run db:push manually after deploy”; instead it should say the release blocks in Juanie until the pre-deploy migration gate is satisfied.

Run:

```bash
cd /Users/findbiao/projects/nexusnote
bun run lint
bun run typecheck
```

If a local database is available, also run:

```bash
node scripts/db-push.mjs
```

Expected: lint and typecheck pass; health route returns `503` when schema is incomplete and `200` when complete.

**Step 6: Commit**

```bash
git -C /Users/findbiao/projects/nexusnote add juanie.yaml scripts/db-verify.mjs lib/server/schema-compatibility.ts app/api/health/route.ts DEPLOYMENT.md
git -C /Users/findbiao/projects/nexusnote commit -m "feat: add schema gate for release compatibility"
```

### Task 7: End-To-End Validation Across Both Repos

**Files:**
- Modify: `src/lib/releases/__tests__/planning.test.ts`
- Modify: `src/lib/releases/__tests__/intelligence.test.ts`
- Modify: `src/lib/approvals/__tests__/view.test.ts`
- Modify: `/Users/findbiao/projects/nexusnote/scripts/db-verify.mjs`

**Step 1: Validate Juanie unit coverage**

Run:

```bash
cd /Users/findbiao/projects/Juanie
bun test src/lib/releases/__tests__/planning.test.ts
bun test src/lib/releases/__tests__/intelligence.test.ts
bun test src/lib/approvals/__tests__/view.test.ts
bun run lint
```

Expected: PASS.

**Step 2: Validate NexusNote static checks**

Run:

```bash
cd /Users/findbiao/projects/nexusnote
bun run lint
bun run typecheck
```

Expected: PASS.

**Step 3: Manual release rehearsal**

Use a staging project and verify this sequence:
1. Push NexusNote commit with a schema-dependent code change and `executionMode: manual_platform`.
2. Confirm Juanie creates a release in `awaiting_approval` before deploy.
3. Approve the migration from Juanie.
4. Confirm the migration run reaches `success`.
5. Confirm the release then enters `deploying` and finishes.
6. Break the schema on purpose in staging and verify NexusNote `/api/health` returns `503`.

**Step 4: Commit release-note docs if needed**

If operator-facing copy changed significantly, update release docs or runbooks before merge.

**Step 5: Final merge prep**

Run:

```bash
cd /Users/findbiao/projects/Juanie
bun test
bun run build
cd /Users/findbiao/projects/nexusnote
bun run build
```

Expected: PASS, or document any known non-goals before merge.

