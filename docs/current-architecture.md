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

Base images, third-party Helm images and CI service images are pinned by OCI digest. Atlas community
CLI is built from a checksum-verified source archive with a pinned, security-current Go toolchain.
Juanie owns target-version boundaries: it derives the exact positional migration count from the
ordered directory and completed revision ledger, adopts explicit baselines with `migrate set`, and
verifies the target revision after execution. The runtime does not depend on extended-only Atlas
flags. The published out-of-order control-plane lineage is closed by an explicit reconciliation
checkpoint: only that lineage uses Atlas `linear-skip`, and the checkpoint becomes its new
continuity baseline without falsely recording superseded destructive revisions. CI rejects
rewritten migrations and versions inserted behind a published frontier unless they carry explicit
reconciliation metadata. Final application bases receive a fresh Debian security upgrade on every CI run; the
resulting SBOM and immutable digest, rather than the upstream tag, are the deployed trust boundary.
Application images are signed with GitHub OIDC and deployed by verified digest.

Do not restore `values-gitops.yaml` or the retired `juanie-platform` Argo CD Application. Argo CD
ApplicationSet remains optional for user preview scaffolding; Argo Rollouts owns progressive user
application delivery.

## Deployment Topology

Production explicitly runs `production.topologyMode=singleNode`: every control-plane component has
one replica, and web/worker rollouts use no-surge replacement. This matches the current four-core,
3.7 GiB single failure domain. `highAvailability` is a separate validated mode that requires at
least two replicas for every component and must not be selected before the cluster has multiple
failure domains and operator-backed state replication.

Single-node durability is backed up independently of HA. PostgreSQL custom-format dumps are uploaded
to S3-compatible storage by a CronJob, and Restate journals can be protected by CSI VolumeSnapshots.
Both remain disabled until production supplies the real bucket and `VolumeSnapshotClass`; Helm fails
closed when either enabled mode is missing its storage configuration. The restore runbook and drill
criteria live in `docs/troubleshooting.md`.

Child repositories expose exactly one Juanie-owned file: `juanie.yml`. Juanie installs a signed push
webhook through the bound GitHub or GitLab integration. A verified source event dispatches
`.github/workflows/application-delivery.yml` in the Juanie repository with a short-lived GitHub App
installation token; child repositories contain no Actions caller, GitLab include or CI credential.

The platform workflow exchanges its own GitHub OIDC identity at `/api/auth/ci/exchange`. Juanie
binds that trusted executor to the requested source provider, repository, ref, commit and provider
delivery ID, then serves an immutable source archive through `/api/ci/source/archive`. Changed paths
are derived server-side through the provider compare API. Incomplete comparisons force a full build
instead of risking an under-build. Build scripts and generated Dockerfiles remain versioned Juanie
runtime assets materialized only in temporary runner state. Images are written to the
Juanie-controlled `JUANIE_WORKLOAD_REGISTRY` namespace, so child repository package permissions are
never part of the delivery trust boundary.

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
