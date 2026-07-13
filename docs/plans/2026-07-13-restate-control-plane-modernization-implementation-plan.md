# Restate Control Plane Modernization Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Juanie's hand-written durable orchestration and unsafe control-plane boundaries with Restate OSS, a transactional outbox, least-privilege runtime identities, encrypted grants, event-ledger projections, and production verification.

**Architecture:** PostgreSQL remains the product source of truth. Commands atomically append domain events and outbox messages; a dispatcher invokes idempotent Restate services, which execute external side effects and project state back into PostgreSQL. Web, controller, scheduler, and schema-runner run with separate identities and telemetry.

**Tech Stack:** Next.js 16, TypeScript 6, Bun 1.3.9, PostgreSQL, Drizzle, Atlas, Restate Server 1.7.2, Restate TypeScript SDK 1.16.1, OpenTelemetry, Prometheus, Kubernetes, Helm.

---

### Task 1: Control-plane persistence primitives

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/outbox/types.ts`
- Create: `src/lib/outbox/service.ts`
- Create: `src/lib/releases/events.ts`
- Create: `src/lib/outbox/__tests__/service.test.ts`
- Create: `src/lib/releases/__tests__/events.test.ts`
- Create: `migrations/*_control_plane_durability.sql`

**Steps:**
1. Add failing tests for deterministic outbox keys and release event projection.
2. Add `outbox_message` and `release_event` tables with delivery, causation, correlation, and indexes.
3. Add database unique and partial-unique constraints for memberships, defaults, services,
   environments, domains, and init steps.
4. Generate the Atlas migration, refresh the hash, and validate it.
5. Run focused tests and TypeScript checks.

### Task 2: Credential boundary

**Files:**
- Modify: `src/lib/db/schema.ts`
- Modify: `src/lib/crypto.ts`
- Modify: `src/lib/integrations/service/grant-service.ts`
- Modify: `src/lib/integrations/service/session-service.ts`
- Modify: `src/lib/auth.ts`
- Modify: `src/types/next-auth.d.ts`
- Create: `src/lib/integrations/__tests__/grant-encryption.test.ts`

**Steps:**
1. Add versioned encrypted grant fields and a migration path for existing rows.
2. Make master-key bootstrap fail closed in production; allow explicit development fallback only.
3. Encrypt grants before persistence and decrypt only inside server-side provider sessions.
4. Remove access tokens from JWT/session callbacks and public types.
5. Add tests proving plaintext tokens are neither persisted in new rows nor exposed in sessions.

### Task 3: Restate runtime and outbox dispatch

**Files:**
- Modify: `package.json`
- Create: `src/lib/restate/config.ts`
- Create: `src/lib/restate/services.ts`
- Create: `src/lib/restate/server.ts`
- Create: `src/lib/outbox/dispatcher.ts`
- Create: `src/lib/restate/__tests__/contracts.test.ts`
- Modify: `Dockerfile`
- Modify: `deploy/k8s/charts/juanie/values.yaml`
- Modify: `deploy/k8s/charts/juanie/templates/deployment.yaml`

**Steps:**
1. Install and pin Restate SDK 1.16.1.
2. Define stable service, handler, invocation, and task-queue names.
3. Implement a dispatcher that claims outbox rows with `SKIP LOCKED` and invokes Restate idempotently.
4. Build separate `restate-services` and `outbox-dispatcher` runtime commands.
5. Deploy pinned Restate Server 1.7.2 with persistent storage and health probes.
6. Add contract tests for message mapping, redelivery, and unavailable-runtime behavior.

### Task 4: Project initialization workflow migration

**Files:**
- Create: `src/lib/projects/workflows/project-init.ts`
- Create: `src/lib/projects/workflows/activities.ts`
- Modify: `src/lib/projects/create-project-service.ts`
- Modify: `src/lib/queue/project-init.ts`
- Modify: `src/app/api/projects/[id]/init/retry/route.ts`
- Create: `src/lib/projects/__tests__/project-init-workflow.test.ts`

**Steps:**
1. Extract repository, configuration, namespace, database, and DNS activities behind typed ports.
2. Persist project creation and `project.init.requested` outbox message in one transaction.
3. Implement the Restate workflow with durable step progress and retry policies.
4. Route retry through a workflow command rather than a second BullMQ job.
5. Remove BullMQ ownership after migration tests cover resume and duplicate delivery.

### Task 5: Release, migration, and repair workflows

**Files:**
- Create: `src/lib/releases/workflows/release.ts`
- Create: `src/lib/releases/workflows/activities.ts`
- Modify: `src/lib/releases/index.ts`
- Modify: `src/lib/releases/orchestration.ts`
- Modify: `src/lib/migrations/control-service.ts`
- Modify: `src/lib/schema-management/atlas-run.ts`
- Modify: rollout and approval API routes under `src/app/api/projects/[id]`
- Create: workflow tests under `src/lib/releases/__tests__`

**Steps:**
1. Model admission, pre-migration, deploy, rollout wait, verification, and post-migration states.
2. Convert approval and rollout actions to durable signals.
3. Append a release event for every accepted transition and project the mutable release row.
4. Make deployment and migration activities idempotent by stable operation key.
5. Remove release/migration healing jobs once Restate owns recovery.

### Task 6: Kubernetes least privilege and HA

**Files:**
- Split: `deploy/k8s/charts/juanie/templates/rbac.yaml`
- Modify: `deploy/k8s/charts/juanie/templates/serviceaccount.yaml`
- Modify: `deploy/k8s/charts/juanie/templates/deployment.yaml`
- Create: `deploy/k8s/charts/juanie/templates/pdb.yaml`
- Create: `deploy/k8s/charts/juanie/templates/network-policy.yaml`
- Modify: `deploy/k8s/charts/juanie/values-prod.yaml`

**Steps:**
1. Give Web no Kubernetes token and no RBAC binding.
2. Create dedicated controller, scheduler, schema-runner, and Restate identities.
3. Restrict secret access and separate cluster bootstrap from namespace runtime permissions.
4. Add scheduler leader election and remove scheduler-in-worker production mode.
5. Add PDB, topology spread, security contexts, and HA production replicas.

### Task 7: Observability, health, and cost controls

**Files:**
- Create: `src/instrumentation.ts`
- Create: `src/lib/telemetry/*`
- Create: `src/app/api/metrics/route.ts`
- Modify: `src/lib/health/dependency-checks.ts`
- Modify: `src/lib/ai/runtime/usage-service.ts`
- Create: `src/lib/rate-limit/*`
- Modify: `src/app/api/wake/route.ts`

**Steps:**
1. Install OpenTelemetry SDK and Prometheus metrics packages.
2. Trace API, DB, outbox, Restate, provider, and Kubernetes operations with real spans.
3. Export workflow latency, outbox lag, stuck workflow, queue depth, and error metrics.
4. Make readiness fail when authoritative dependencies are unavailable.
5. Add wake single-flight/rate limits and team AI token budgets.

### Task 8: Supply-chain and deployment hardening

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `Dockerfile`
- Create: `.github/dependabot.yml` or `renovate.json`
- Create: supply-chain policy files under `deploy/`

**Steps:**
1. Pin actions and container bases by immutable digest.
2. Enable BuildKit provenance and SBOM generation.
3. Add dependency, filesystem, image, and secret scans.
4. Sign images with GitHub OIDC and verify signatures before Helm upgrade.
5. Protect production deployment with a GitHub Environment and remove long-lived deployment secrets where supported.

### Task 9: Integration, E2E, and failure verification

**Files:**
- Modify: `package.json`
- Create: `tests/integration/*`
- Create: `tests/e2e/*`
- Create: `playwright.config.ts`
- Modify: `.github/workflows/ci.yml`

**Steps:**
1. Add PostgreSQL/Redis integration fixtures and Restate test environment.
2. Test crash points before dispatch, after dispatch, during activity, and while waiting for signals.
3. Add Playwright golden paths for create/import, staging release, approval, rollout, and deletion.
4. Add coverage thresholds for domain and orchestration code.
5. Run integration and E2E suites in CI with artifact retention on failure.

### Task 10: Boundary cleanup and documentation convergence

**Files:**
- Split: `src/lib/queue/project-init.ts`
- Split: `src/lib/k8s.ts`
- Split: `src/lib/db/schema.ts`
- Split: `src/components/projects/create-project-form.tsx`
- Modify: `AGENTS.md`
- Modify: `docs/current-architecture.md`
- Archive or replace: `DEPLOYMENT_ARCHITECTURE.md`, `PRODUCTION_READINESS.md`

**Steps:**
1. Move template rendering, provider operations, and workflow activities into bounded modules.
2. Split Kubernetes read, apply, job, route, and diagnostic adapters.
3. Split schema declarations by bounded context with one export surface.
4. Split create-project state machine from visual sections.
5. Make `docs/current-architecture.md` the only current architecture source and mark historical plans explicitly.
6. Run lint, typecheck, unit, integration, E2E, AI eval, Atlas validation, and production build.

