# Delivery Control Plane Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Close the source-to-production delivery chain with one durable execution aggregate, immutable
artifact trust, persistent controllers, truthful health, and a one-click promotion experience.

**Architecture:** Restate owns durable commands while PostgreSQL aggregate updates and outbox enqueue happen
in one transaction. GitHub Actions remains the build executor and reports authenticated, idempotent signals;
existing build, release, deployment, and migration records become correlated stage details.

**Tech Stack:** Next.js 16, TypeScript, Drizzle, Atlas, PostgreSQL, Restate, GitHub Actions OIDC, BuildKit,
Sigstore Cosign, Kubernetes, Bun tests, Playwright.

---

### Task 1: Delivery domain schema

**Files:**
- Modify: `src/lib/db/schema/enums.ts`
- Modify: `src/lib/db/schema/delivery.ts`
- Modify: `src/lib/db/schema/relations/delivery.ts`
- Create: `migrations/20260724120000_delivery_control_plane.sql`
- Test: `src/lib/delivery-executions/__tests__/state-machine.test.ts`

1. Add failing tests for legal monotonic transitions and terminal-state rejection.
2. Add delivery execution, execution event, promotion request, approval event, and repository webhook
   controller schemas plus foreign keys from source delivery, build run, release, and deployment.
3. Add enum values and partial indexes for active/stuck/controller queries.
4. Generate or write the Atlas migration, refresh hashes, and validate lineage.
5. Run the focused state-machine tests and schema validation.

### Task 2: Durable execution orchestration

**Files:**
- Create: `src/lib/delivery-executions/state-machine.ts`
- Create: `src/lib/delivery-executions/service.ts`
- Create: `src/lib/delivery-executions/workflows/delivery-execution.ts`
- Modify: `src/lib/source-deliveries/service.ts`
- Modify: `src/lib/source-deliveries/workflows/source-delivery.ts`
- Modify: `src/lib/restate/contracts.ts`
- Modify: `src/lib/restate/endpoint.ts`
- Test: `src/lib/delivery-executions/__tests__/service.test.ts`

1. Test provider-delivery idempotency, event append, duplicate signal handling, retryable provider errors,
   and terminal identity errors.
2. Create execution in the webhook transaction and enqueue a keyed Restate command.
3. Advance the projection only through typed domain signals; persist every transition event.
4. Use the execution id as the Restate workflow/virtual-object key and preserve trace context.
5. Run focused Restate and source delivery tests.

### Task 3: Build and release correlation

**Files:**
- Modify: `src/lib/builds/service.ts`
- Modify: `src/app/api/build-runs/route.ts`
- Modify: `src/app/api/build-runs/[buildRunId]/finalize/route.ts`
- Modify: `src/lib/releases/index.ts`
- Modify: `src/lib/releases/workflows/release.ts`
- Modify: `.github/workflows/application-delivery.yml`
- Test: `src/lib/builds/__tests__/service.test.ts`

1. Add tests that one execution accepts one build run and correlates its staging release.
2. Pass execution id through workflow dispatch and authenticated callbacks.
3. Add delivery-id workflow concurrency and cancel duplicate provider dispatch capacity.
4. Signal building, staging releasing, staging verified, and failure states transactionally.
5. Run build, release, callback, and workflow contract tests.

### Task 4: Promotion request and approval digest

**Files:**
- Create: `src/lib/promotions/service.ts`
- Create: `src/lib/promotions/content-digest.ts`
- Modify: `src/app/api/projects/[id]/promote/route.ts`
- Modify: `src/lib/releases/planning.ts`
- Modify: `src/lib/releases/index.ts`
- Modify: `src/components/projects/PromotionAction.tsx`
- Modify: `src/components/projects/ReleasePromoteDialog.tsx`
- Test: `src/lib/promotions/__tests__/service.test.ts`

1. Test deterministic artifact content digests, one-click default approval, optional distinct approver,
   and independent digest approval for a production migration plan after that plan exists.
2. Create request, approval event, production release, and outbox command in one transaction for the
   default policy.
3. Link production release to request and execution; update request from release outcomes.
4. Show immutable content and one primary confirmation action without adding project configuration.
5. Run promotion route, service, and component tests.

### Task 5: Immutable images and attestations

**Files:**
- Modify: `templates/ci/runtime/v1/build-run.sh`
- Modify: `.github/workflows/application-delivery.yml`
- Create: `src/lib/supply-chain/image-trust.ts`
- Modify: `src/lib/releases/index.ts`
- Modify: `src/lib/queue/deployment-executor.ts`
- Modify: `src/lib/releases/workloads.ts`
- Test: `src/lib/supply-chain/__tests__/image-trust.test.ts`
- Test: `src/lib/queue/__tests__/deployment-executor.test.ts`

1. Test digest normalization, tag rejection, service-specific artifact selection, and promotion digest reuse.
2. Enable BuildKit SBOM/provenance and keyless Cosign signing using GitHub OIDC.
3. Report trust metadata and verify it at release admission and promotion.
4. Persist and deploy only `repository@sha256:...` per service; reject missing or malformed digests.
5. Run supply-chain and deployment tests.

### Task 6: Persistent webhook controller

**Files:**
- Create: `src/lib/source-deliveries/webhook-controller.ts`
- Create: `src/lib/source-deliveries/workflows/webhook-controller.ts`
- Modify: `src/lib/queue/source-webhook-reconciliation.ts`
- Modify: `src/lib/source-deliveries/webhook-management.ts`
- Modify: `src/lib/restate/contracts.ts`
- Test: `src/lib/source-deliveries/__tests__/webhook-controller.test.ts`

1. Test desired/observed generation, drift, legacy deletion, success reset, and durable retry deadlines.
2. Persist desired state for active repositories and enqueue repository-keyed reconcile commands.
3. Move provider I/O into a Restate Virtual Object and classify retryable versus terminal failures.
4. Remove process-memory pagination and expose controller status to read models.
5. Run controller and scheduler tests.

### Task 7: Truthful runtime and delivery health

**Files:**
- Create: `src/lib/health/delivery-control-plane.ts`
- Create: `src/lib/health/runtime-expectations.ts`
- Modify: `src/lib/health/dependency-checks.ts`
- Modify: `src/lib/environments/runtime-control.ts`
- Modify: `src/lib/releases/workloads.ts`
- Modify: `src/lib/queue/scheduler.ts`
- Test: `src/lib/health/__tests__/delivery-control-plane.test.ts`

1. Test dead letters, stuck stages, callback SLO, webhook drift, canary age, and sleeping-service semantics.
2. Build indexed aggregate queries and return structured operational signals.
3. Keep readiness dependency-only; make full health accurately degraded/unhealthy for chain failures.
4. Schedule a no-op synthetic delivery when the platform smoke project is configured.
5. Run health, runtime-control, scheduler, and release verification tests.

### Task 8: Delivery timeline UI

**Files:**
- Create: `src/lib/delivery-executions/read-model.ts`
- Create: `src/components/projects/DeliveryExecutionTimeline.tsx`
- Modify: `src/app/projects/[id]/environments/[envId]/delivery/page.tsx`
- Modify: `src/app/projects/[id]/environments/[envId]/delivery/[releaseId]/page.tsx`
- Modify: `src/lib/releases/service.ts`
- Test: `src/lib/delivery-executions/__tests__/read-model.test.ts`

1. Test ordering and presentation for active, failed, awaiting approval, and completed executions.
2. Add a compact source-to-production timeline and actionable chain/controller status.
3. Keep release details available as drill-down stages and preserve existing navigation.
4. Verify desktop and mobile screenshots with Playwright and check for overflow/overlap.

### Task 9: Repository-wide verification and rollout

**Files:**
- Modify: `.github/workflows/ci.yml` only if new verification commands are not already covered.

1. Run focused tests after each bounded-context change.
2. Run `bun run db:hash`, `bun run db:lineage`, and `bun run db:validate`.
3. Run `bun run test`, `bun run lint`, `bun run typecheck`, and `bun run build`.
4. Review the diff for duplicated state, fallback behavior, patch smells, and leaked configuration burden.
5. Commit and push Juanie main; watch CI, Helm schema expansion, and all runtime rollouts.
6. Trigger one empty NexusNote source commit and verify one execution, one build, one staging release, one
   approval digest, one production release, identical image digests, and healthy production.
