# Production Closure Implementation Plan

**Status:** Implemented and verified on 2026-07-14.

**Deployment gate:** Backup resources remain disabled until production supplies the S3-compatible
bucket credentials and, for Restate volume snapshots, the cluster's `VolumeSnapshotClass`.

**Goal:** Close the remaining retry, recovery, operations, backup, and ownership gaps in Juanie's
existing PostgreSQL, Restate, and BullMQ architecture without adding another infrastructure system.

**Architecture:** PostgreSQL remains the product and short-task source of truth. Every durable
command receives an explicit attempt identity, Restate owns lifecycle retries, and Redis jobs are
reconstructed from leased PostgreSQL task records. Helm resources resolve one effective Secret,
while outbox failure handling, backups, alerts, and API ownership become explicit operator surfaces.

**Tech Stack:** Next.js 16, TypeScript, Bun, PostgreSQL, Drizzle, Atlas, Restate OSS, BullMQ, Redis,
Kubernetes, Helm, Prometheus.

---

### Task 1: Retryable project deletion attempts

**Files:**
- Modify: `src/lib/projects/delete-service.ts`
- Modify: `src/lib/projects/workflows/project-delete.ts`
- Modify: `src/lib/restate/contracts.ts`
- Modify: `src/lib/restate/services.ts`
- Test: `src/lib/projects/__tests__/delete-service.test.ts`
- Test: `src/lib/restate/__tests__/contracts.test.ts`

**Steps:**
1. Add failing tests proving a terminal deletion can create a new command and invocation key.
2. Generate one deletion attempt ID per accepted retry and persist it in the outbox command.
3. Key the Restate workflow by `projectId:attemptId` while preserving duplicate delivery idempotency.
4. Verify focused project and Restate tests.

### Task 2: One effective runtime Secret

**Files:**
- Modify: `deploy/k8s/charts/juanie/templates/_helpers.tpl`
- Modify: `deploy/k8s/charts/juanie/templates/secret.yaml`
- Modify: `deploy/k8s/charts/juanie/templates/external-secret.yaml`
- Modify: `deploy/k8s/charts/juanie/templates/postgres.yaml`
- Test: `tests/helm/secret-rendering.test.ts`

**Steps:**
1. Add render tests for embedded, existing, and ExternalSecret target names.
2. Define `juanie.effectiveSecretName` and use it for every producer and consumer.
3. Render and parse all three configurations with Helm.

### Task 3: PostgreSQL-driven AI task reconstruction

**Files:**
- Modify: `src/lib/db/schema/ai.ts`
- Modify: `src/lib/ai/tasks/generic-task-service.ts`
- Create: `src/lib/ai/tasks/reconciler.ts`
- Modify: `src/lib/queue/worker.ts`
- Create: `src/lib/queue/ai-task-reconciliation.ts`
- Modify: `src/lib/queue/scheduler-runtime.ts`
- Create: `src/lib/ai/tasks/__tests__/reconciler.test.ts`
- Create: `migrations/*_ai_task_leases.sql`

**Steps:**
1. Add lease, heartbeat, dispatch-attempt, and stale-recovery test cases.
2. Make worker claiming conditional and completion fenced by the active lease.
3. Reconcile queued and stale-running rows into stable BullMQ job IDs.
4. Add the reconciler only to the elected scheduler runtime.
5. Validate Atlas and focused tests.

### Task 4: Real Restate workflow verification

**Files:**
- Modify: `tests/integration/outbox-postgres.test.ts`
- Create: `tests/integration/restate-recovery.test.ts`
- Create: `tests/integration/fixtures/restate-crash-workflow.ts`
- Modify: `.github/workflows/ci.yml`

**Steps:**
1. Start PostgreSQL, Restate, service endpoint, and dispatcher fixtures.
2. Seed a valid aggregate and issue a real command through aggregate plus outbox transaction.
3. Assert final PostgreSQL projections and duplicate-delivery behavior.
4. Add crash/restart coverage for an in-flight workflow.

### Task 5: Outbox operations and alerts

**Files:**
- Create: `src/lib/outbox/operations.ts`
- Create: `src/app/api/operations/outbox/route.ts`
- Create: `src/app/api/operations/outbox/[id]/replay/route.ts`
- Modify: `src/lib/outbox/dispatcher.ts`
- Modify: `src/lib/queue/scheduler-runtime.ts`
- Create: `deploy/k8s/charts/juanie/templates/prometheus-rule.yaml`
- Test: `src/lib/outbox/__tests__/operations.test.ts`

**Steps:**
1. Add platform-operator authorization and dead-letter listing tests.
2. Replay by creating a new audited attempt, never by mutating delivered history.
3. Purge delivered rows according to configurable retention.
4. Alert on dead letters, outbox lag, stuck Restate invocations, and AI task backlog.

### Task 6: Single-node backup and restore

**Files:**
- Create: `deploy/k8s/charts/juanie/templates/backup-cronjob.yaml`
- Modify: `deploy/k8s/charts/juanie/values.yaml`
- Modify: `deploy/k8s/charts/juanie/values-prod.yaml`
- Create: `deploy/k8s/charts/juanie/scripts/restore-control-plane.sh`
- Modify: `docs/troubleshooting.md`

**Steps:**
1. Add PostgreSQL logical backups to S3-compatible object storage with retention.
2. Add Restate data-volume snapshot hooks or an explicit journal-loss recovery procedure.
3. Provide a fail-closed restore command and a quarterly restore drill runbook.
4. Render the chart with backup enabled and disabled.

### Task 7: Single API and scheduler ownership

**Files:**
- Create: `src/app/api/projects/[id]/releases/route.ts`
- Remove: `src/app/api/deployments/trigger/route.ts`
- Remove: `src/app/api/releases/lookup/route.ts`
- Modify: `src/lib/releases/client-actions.ts`
- Modify: `src/lib/queue/worker.ts`
- Modify: `deploy/k8s/charts/juanie/templates/deployment.yaml`
- Modify: `deploy/k8s/charts/juanie/values.yaml`

**Steps:**
1. Move internal release creation to the project releases resource.
2. Keep external CI ingress separate and delete unused compatibility endpoints.
3. Remove scheduler startup from the worker and its Helm/environment flag.
4. Verify API contract tests, lint, and typecheck.

### Task 8: Boundary cleanup and release verification

**Files:**
- Split the remaining oversized modules along existing bounded-context ownership.
- Modify: `docs/current-architecture.md`
- Modify: `PRODUCTION_READINESS.md`

**Steps:**
1. Extract pure parsing/rendering, orchestration, infrastructure adapter, and UI state modules where
   a file still mixes more than one ownership boundary.
2. Run format, lint, typecheck, unit, PostgreSQL integration, Restate integration, Atlas validation,
   Helm lint/render, and production build.
3. Record any environment-dependent skips and retain no compatibility code introduced by this plan.
4. Extend Biome coverage to root configuration, scripts, templates, and integration tests.
