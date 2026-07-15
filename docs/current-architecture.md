# Juanie Current Architecture

This is the canonical architecture document. Files under `docs/plans/` record decisions and
implementation history; they are not runtime truth.

## Control Plane

Juanie is a TypeScript modular monolith with separate runtime processes:

| Process | Runtime | Responsibility | Kubernetes identity |
| --- | --- | --- | --- |
| Web | Node 24 + Next standalone | Auth, validation, command acceptance, projections | No token |
| Outbox dispatcher | Bun | Claim PostgreSQL outbox rows and one-way send to Restate | No token |
| Restate services | Bun | Durable project, release, migration, deployment, repair and runtime workflows | Controller |
| Short-task worker | Bun + BullMQ | Rebuildable AI/background work only | No token |
| Scheduler | Bun | Governance and cleanup cron tasks with Lease election | Scheduler |
| Schema runner | Bun Job | Atlas inspect/migration/repair execution | No token |

PostgreSQL is the product source of truth. Restate owns durable execution state. Redis is not an
authoritative workflow dependency.

```text
Browser -> Web -> PostgreSQL transaction
                    | aggregate / releaseEvent
                    | outboxMessage
                    v
             Outbox Dispatcher -> Restate Server -> Restate Services
                                                        | Git provider
                                                        | Atlas Jobs
                                                        | Kubernetes / Argo Rollouts
```

## Command Rules

All lifecycle commands follow one rule:

1. Validate authorization and domain invariants.
2. Mutate the aggregate and append events in one PostgreSQL transaction.
3. Insert a deduplicated `outboxMessage` in that same transaction.
4. The dispatcher claims with `FOR UPDATE SKIP LOCKED` and calls Restate's one-way `/send` ingress.
5. Restate journals each domain activity separately and updates PostgreSQL projections. Project
   initialization and deletion never wrap their complete multi-step lifecycle in one `ctx.run`.

Project initialization, deletion, releases, migrations, deployments, schema repair, wake and
rollout use this path. Do not add a BullMQ owner or a post-commit `queue.add` fallback.

Project deletion uses a unique command attempt ID. Duplicate delivery of one attempt is idempotent;
a retry after terminal failure creates a new Restate workflow key instead of reopening immutable
outbox history.

AI short tasks are the only BullMQ jobs. PostgreSQL owns their queued/running/final state and an
execution lease. The API may dispatch to Redis immediately for latency, but failed or lost Redis
jobs are reconstructed by the elected scheduler; stale running leases are claimable after expiry.

## Release History

`releaseEvent` is the immutable history. `release.status`, recap and detail models are projections.
Every status transition, approval and rollout command appends an event with correlation and
causation metadata. Timeline views consume events and only use mutable deployment/migration rows
for their context-specific detail.

## Security Boundary

- OAuth access and refresh tokens are AES-256-GCM encrypted with grant-specific AAD and versioned
  master keys. NextAuth account rows and browser sessions do not retain provider credentials.
- Web, short-task worker, schema runner, outbox and Restate Server do not mount Kubernetes tokens.
- Controller and scheduler use distinct ServiceAccounts. Scheduler replicas elect through a
  namespace-scoped Lease.
- Production secrets come from `secret.existingSecret` or External Secrets. Real secrets never
  belong in Helm values.
- Public wake requests are Redis-rate-limited and only enqueue coalesced runtime commands.
- AI plugin execution reserves a team monthly token budget before provider calls and settles actual
  usage afterward.

## Observability

- OpenTelemetry Node instrumentation exports OTLP traces when
  `OTEL_EXPORTER_OTLP_TRACES_ENDPOINT` is configured.
- The dispatcher exposes Prometheus process, delivery, duration, queue depth and oldest-pending
  metrics on port 9464.
- `/api/metrics` exposes control-plane metrics behind `METRICS_BEARER_TOKEN`.
- Readiness requires PostgreSQL and Restate. Redis failures are reported as degraded because Redis
  no longer owns lifecycle durability.
- Platform operators can list unresolved dead letters at `GET /api/operations/outbox` and replay
  one through `POST /api/operations/outbox/:id/replay`. Replay creates a new immutable message with
  lineage; it never mutates a delivered or dead-letter message back to pending.
- Delivered outbox messages and resolved dead letters have separate retention policies. Prometheus
  alerts cover dead letters, dispatch lag, AI backlog and stale workflow projections.

## Platform Delivery

Juanie self-deploy has one path:

1. GitHub Actions runs lint, typecheck, unit, integration, Restate contract and Playwright checks.
2. BuildKit publishes web/runtime/schema-runner images with SBOM and maximum provenance. The
   long-lived runtime image excludes Atlas and schema-management utilities; the ephemeral
   schema-runner image carries the migration toolchain.
3. Cosign signs image digests through GitHub OIDC; Trivy scans source and images.
4. The production environment gate verifies signatures and resolves immutable digests.
5. CI uploads the Helm chart and runs `helm upgrade --install` over the current SSH deployment
   boundary.
6. A Helm pre-install/pre-upgrade Job applies expand migrations and credential backfills.
7. Destructive contract migrations remain outside the default Helm release. Operators promote the
   contract chain explicitly only after the N-1 rollback window closes.

Base images, third-party Helm images and CI service images are pinned by OCI digest. Atlas is built
from a checksum-verified source archive with a pinned Go toolchain and patched security dependency
floor. Application images are signed with GitHub OIDC and deployed by verified digest.

Do not restore `values-gitops.yaml` or the retired `juanie-platform` Argo CD Application. Argo CD
ApplicationSet remains optional for user preview scaffolding; Argo Rollouts owns progressive user
application delivery.

## Deployment Topology

Production runs two replicas for web, Restate services, outbox dispatcher, short-task worker and
scheduler, with PDBs for replicated components. Restate Server currently uses one persistent
StatefulSet replica. A replicated Restate cluster and HA PostgreSQL/Redis require an operator-backed
topology decision; never increase those StatefulSet replicas without configuring their consensus or
replication protocols.

Single-node durability is backed up independently of HA. PostgreSQL custom-format dumps are uploaded
to S3-compatible storage by a CronJob, and Restate journals can be protected by CSI VolumeSnapshots.
Both remain disabled until production supplies the real bucket and `VolumeSnapshotClass`; Helm fails
closed when either enabled mode is missing its storage configuration. The restore runbook and drill
criteria live in `docs/troubleshooting.md`.

Internal manual releases use `POST /api/projects/:id/releases`. External repository CI uses
`POST /api/releases`. Deployment routes only read or operate concrete deployment records; removed
trigger and lookup compatibility endpoints must not be restored.

## Verification

Required before merge:

```bash
bun run lint
bun run typecheck
bun run test
bun run ai:eval
bun run db:hash
bun run db:validate
bun run build
helm lint deploy/k8s/charts/juanie -f deploy/k8s/charts/juanie/values-prod.yaml
```

CI additionally runs PostgreSQL/Redis/Restate integration tests, Chromium Playwright smoke tests,
source/image vulnerability scans, SBOM/provenance generation and signature verification.
