# Source Delivery Durability Implementation Plan

**Goal:** Make source webhook acceptance durable, observable, replayable, and deployment-gated by a
working platform GitHub App identity without adding child-application configuration.

**Architecture:** PostgreSQL owns source-event acceptance and deduplication, transactional outbox
bridges committed events to Restate, and a keyed Restate object owns GitHub workflow dispatch.
Provider webhook identity and platform dispatch capability are reconciled as distinct contracts.

**Tech Stack:** Next.js route handlers, Drizzle ORM, PostgreSQL 17, Atlas migrations, Restate OSS,
GitHub App installation tokens, Helm hook Jobs, Bun tests.

---

### Task 1: Add the source delivery aggregate

**Files:**
- Modify: `src/lib/db/schema/enums.ts`
- Modify: `src/lib/db/schema/delivery.ts`
- Modify: `src/lib/db/schema/relations/delivery.ts`
- Create: `migrations/20260722040146_source_delivery_durability.sql`
- Test: `tests/integration/outbox-postgres.test.ts`

1. Define `sourceDeliveryStatus` with `received`, `dispatching`, `dispatched`, and `failed`.
2. Add `sourceDelivery` with provider delivery uniqueness, project/repository lineage, immutable
   source identity, dispatch attempt metadata, and timestamps.
3. Add an acceptance service that inserts the inbox row and outbox command in one transaction.
4. On duplicate failed delivery, atomically transition it back to `received` and enqueue one new
   command; active or completed duplicates remain no-ops.
5. Verify insert, duplicate, and failed-redelivery behavior with focused tests.

### Task 2: Move dispatch behind Restate

**Files:**
- Create: `src/lib/source-deliveries/service.ts`
- Create: `src/lib/source-deliveries/workflows/source-delivery.ts`
- Modify: `src/lib/restate/config.ts`
- Modify: `src/lib/restate/contracts.ts`
- Modify: `src/lib/restate/services.ts`
- Modify: `src/lib/outbox/types.ts`
- Modify: `src/app/api/webhooks/source/route.ts`
- Test: `tests/integration/outbox-postgres.test.ts`
- Test: `src/lib/restate/__tests__/contracts.test.ts`

1. Add the `source.delivery.requested` durable contract keyed by source-delivery ID.
2. Implement the Restate object and activity that claims the aggregate, dispatches the immutable
   platform workflow input, then records success or a sanitized terminal error.
3. Replace synchronous route dispatch with the transactional acceptance service and HTTP 202.
4. Add structured logs containing delivery, project, repository, and error code.
5. Verify that the route does not import or call the GitHub dispatch client.

### Task 3: Make webhook ownership and delivery capability explicit

**Files:**
- Modify: `src/lib/db/schema/identity.ts`
- Modify: `src/lib/git/index.ts`
- Modify: `src/lib/git/github.ts`
- Modify: `src/lib/git/gitlab.ts`
- Modify: `src/lib/integrations/service/integration-control-plane.ts`
- Modify: `src/lib/queue/source-webhook-reconciliation.ts`
- Modify: `src/lib/queue/project-init-activities.ts`
- Test: `src/lib/git/__tests__/github.test.ts`
- Test: `src/lib/git/__tests__/gitlab.test.ts`
- Test: `src/lib/queue/__tests__/source-webhook-reconciliation.test.ts`

1. Persist provider webhook ID, canonical URL, verification timestamp, status, and last error.
2. Reconcile by managed ID first, adopt exact canonical hooks second, and create only when absent.
3. Remove only recognized Juanie legacy URLs, including `https://undefined/api/webhooks/git`.
4. Persist reconciliation success/failure and report platform dispatch readiness separately.
5. Verify unrelated provider webhooks are never deleted.

### Task 4: Block releases with a broken platform execution identity

**Files:**
- Modify: `src/lib/ci/application-delivery.ts`
- Create: `src/lib/ci/application-delivery-preflight.ts`
- Modify: `Dockerfile`
- Create: `deploy/k8s/charts/juanie/templates/application-delivery-preflight-job.yaml`
- Modify: `deploy/k8s/charts/juanie/values.yaml`
- Test: `src/lib/ci/__tests__/application-delivery.test.ts`
- Test: `src/lib/db/__tests__/control-plane-migration-phases.test.ts`

1. Extract strict GitHub App configuration parsing and workflow capability verification.
2. Compile a short-lived runtime preflight binary.
3. Run it as a Helm pre-install/pre-upgrade hook before schema expansion and workload rollout.
4. Mount only the GitHub App keys required by the preflight and fail on missing or invalid values.
5. Verify chart rendering, source lineage, focused tests, Atlas validation, full tests, typecheck,
   Biome, and production build.

### Task 5: Production recovery

**Files:**
- No repository secret material is committed.

1. Install the Juanie GitHub App on `997899594/Juanie` with Actions write and Contents read.
2. Add `JUANIE_GITHUB_APP_ID` and `JUANIE_GITHUB_APP_PRIVATE_KEY` to the external production Secret;
   add `JUANIE_GITHUB_APP_INSTALLATION_ID` only when pinning the installation is desired.
3. Deploy and confirm the preflight, schema Job, Restate registration, and all rollouts succeed.
4. Redeliver the failed NexusNote GitHub delivery and verify one `sourceDelivery`, one build run, and
   a started `application-delivery.yml` run.
