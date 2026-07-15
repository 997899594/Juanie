# Control-plane Trust And Ownership Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use executing-plans to implement this plan task-by-task.

**Goal:** Close Juanie's CI identity, durable ownership, migration compatibility, production
recovery, least-privilege and UI truthfulness gaps without adding application-side configuration.

**Architecture:** OIDC authenticates CI workloads; explicit Restate execution keys plus PostgreSQL
fencing serialize environment and database mutations. Control-plane expand and contract migrations
become separate validated chains, while Helm production readiness fails closed.

**Tech Stack:** Bun, TypeScript, jose, Next.js, PostgreSQL/Drizzle, Atlas, Restate, Helm, GitHub
Actions, GitLab CI.

---

### Task 1: Replace repository-token CI authentication with workload identity

**Files:**
- Create: `src/lib/ci/workload-identity.ts`
- Create: `src/lib/ci/__tests__/workload-identity.test.ts`
- Modify: `src/lib/builds/service.ts`
- Modify: `src/lib/artifacts/upload-service.ts`
- Modify: `src/app/api/build-runs/**/route.ts`
- Modify: `src/app/api/releases/**/route.ts`
- Modify: `templates/ci/build-run.sh`
- Modify: `templates/ci/github-actions*.yml`
- Modify: `templates/ci/gitlab-ci*.yml`

Steps:
1. Add failing tests for issuer, audience, repository, ref, SHA, run and unit binding.
2. Implement GitHub and configured GitLab OIDC verification with cached remote JWKS.
3. Remove build-secret capability issuance and verification.
4. Fetch a fresh workload token for every CI API call; never write it into the build state directory.
5. Run workload identity, build service and repository automation tests.

### Task 2: Add environment and database ownership with fencing

**Files:**
- Modify: `src/lib/db/schema/delivery.ts`
- Modify: `src/lib/db/schema/data.ts`
- Create: `src/lib/execution/ownership.ts`
- Modify: `src/lib/outbox/types.ts`
- Modify: `src/lib/outbox/service.ts`
- Modify: `src/lib/outbox/dispatcher.ts`
- Modify: `src/lib/restate/contracts.ts`
- Modify: `src/lib/releases/index.ts`
- Modify: `src/lib/releases/orchestration.ts`
- Modify: `src/lib/migrations/index.ts`
- Modify: `src/lib/migrations/release-plan.ts`
- Modify: `src/lib/migrations/runner.ts`
- Create: `migrations/*_execution_ownership.sql`

Steps:
1. Add tests showing two releases cannot own one environment and two runs cannot own one database.
2. Persist execution keys and monotonically increasing fencing generations.
3. Route Restate release objects by environment and migration objects by lock key.
4. Assert the fence before every external side effect and terminal projection update.
5. Add stale-owner reconciliation tests and run Restate integration tests.

### Task 3: Establish reusable control-plane expand/contract chains

**Files:**
- Modify: `src/lib/db/control-plane-atlas.ts`
- Create: `migrations-contract/atlas.sum`
- Modify: `atlas.hcl`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Modify: `deploy/k8s/charts/juanie/templates/schema-sync-job.yaml`

Steps:
1. Add tests proving expand rejects destructive DDL and contract never runs during the same release.
2. Keep existing Atlas history immutable and create a separate contract revision schema.
3. Add contract compatibility epoch and explicit promotion command.
4. Validate and hash both chains in CI.
5. Render Helm and verify the default rollout preserves the N-1 rollback window.

### Task 4: Make production durability and monitoring fail closed

**Files:**
- Modify: `deploy/k8s/charts/juanie/values.yaml`
- Modify: `deploy/k8s/charts/juanie/values-prod.yaml`
- Create: `deploy/k8s/charts/juanie/templates/production-readiness.yaml`
- Modify: `.github/workflows/ci.yml`

Steps:
1. Add Helm tests for external-state and self-hosted-backup modes.
2. Require either external PostgreSQL/Restate endpoints or PostgreSQL backup plus Restate snapshot.
3. Require production PrometheusRule rendering.
4. Verify `helm lint` and all supported production values profiles.

### Task 5: Enforce least privilege and encrypted-secret invariants

**Files:**
- Modify: `deploy/k8s/charts/juanie/templates/rbac.yaml`
- Modify: `deploy/k8s/charts/juanie/templates/network-policy.yaml`
- Modify: `deploy/k8s/charts/juanie/templates/deployment.yaml`
- Modify: `deploy/k8s/charts/juanie/templates/restate.yaml`
- Modify: `src/lib/db/schema/platform.ts`
- Modify: `src/lib/env-sync.ts`
- Modify: `src/lib/builds/service.ts`
- Create: `migrations/*_secret_invariants.sql`

Steps:
1. Add chart assertions for component ServiceAccounts, network peers and projected Secret keys.
2. Split controller and scheduler RBAC and restrict Restate service ingress.
3. Backfill encrypted environment secrets and add a database check constraint.
4. Delete runtime plaintext self-migration and fail closed on invalid secret records.
5. Run env-var, project initialization and Helm tests.

### Task 6: Close UI state and dependency security gaps

**Files:**
- Modify: `src/lib/migrations/control-service.ts`
- Modify: `src/components/projects/ReleaseDetailSections.tsx`
- Modify: `package.json`
- Modify: `bun.lock`
- Modify: `.github/workflows/ci.yml`

Steps:
1. Add tests for failed and superseded migration-plan presentation.
2. Make external migration failure update the plan projection transactionally.
3. Upgrade vulnerable dependency chains and make production audit a CI gate.
4. Run full tests, lint, typecheck, build, Atlas validation, Helm lint and Playwright UI checks.
