# Restate Control Plane Modernization Design

## Status

Accepted on 2026-07-13.

## Context

Juanie has the right product boundary around projects, environments, releases, schema safety, and
governance, but its execution model is split across PostgreSQL state, BullMQ jobs, local cron tasks,
and hand-written healing loops. A process can commit a control-plane record and exit before its queue
job is published. Long waits, retries, compensation, and human approval are reconstructed from
mutable status columns rather than owned by a durable execution runtime.

The platform also gives the web process the same Kubernetes identity as workers, persists Git
provider credentials without application-level encryption, relies on service code for important
database invariants, and lacks an append-only release history. These problems must be fixed as one
control-plane modernization because solving only the queue gap would preserve the same unsafe
boundaries in a different shape.

## Decision

Juanie will remain a TypeScript modular monolith and adopt:

- Restate OSS Server `v1.7.2` as the durable execution runtime.
- `@restatedev/restate-sdk` `1.16.1` for TypeScript durable services and workflows.
- A PostgreSQL transactional outbox as the only DB-to-runtime dispatch boundary.
- An append-only release event ledger with mutable release rows treated as projections.
- Separate web, controller, scheduler, and schema-runner Kubernetes identities.
- Envelope-encrypted integration grants; raw provider tokens never enter browser sessions.
- OpenTelemetry plus Prometheus-compatible metrics for API, outbox, Restate, and control-plane health.

BullMQ remains available only for non-authoritative short-lived work during migration. It must not
own release, migration, project-init, approval, or repair lifecycle semantics after convergence.

## Target Architecture

```text
Browser
  |
  v
Next.js Web (no Kubernetes credentials)
  |
  +---- PostgreSQL transaction ----+
  | aggregate + release_event       |
  | outbox_message                  |
  +---------------------------------+
                 |
                 v
        Outbox Dispatcher
                 |
                 v
          Restate Server
                 |
                 v
       Juanie Durable Services
          |       |       |
          v       v       v
        Git      Atlas   Kubernetes
                           |
                    Argo Rollouts / CNPG
```

## Component Boundaries

### Web

The web process authenticates requests, validates commands, commits control-plane intent, and reads
projections. It cannot call Kubernetes, decrypt integration grants for arbitrary use, or import
worker implementations. Public wake traffic is coalesced and rate limited before it creates a
runtime command.

### Outbox Dispatcher

The dispatcher claims messages with `FOR UPDATE SKIP LOCKED`, sends idempotent invocations to
Restate, and records delivery attempts. Restate invocation IDs derive from outbox IDs. A dispatcher
crash can cause redelivery but never message loss. Domain services must therefore be idempotent.

### Restate Services

Durable services own project initialization, release orchestration, migrations, repair, and runtime
commands. Restate handlers call side effects through narrow activities. Human approval and rollout
continuation use durable signals rather than queue polling. Restate state is execution state;
PostgreSQL remains the product record and query source.

### Release Event Ledger

Every accepted transition appends an immutable event with release, project, environment, actor,
causation, correlation, and payload metadata. Release status and recap are projections. Timeline,
AI evidence, audit views, and incident analysis consume the event ledger instead of reconstructing
history from current rows.

## Security Model

- Web ServiceAccount has no Kubernetes API permissions and does not automount a token.
- Controller permissions are split between cluster bootstrap and namespace runtime operations.
- Scheduler uses its own identity and a Kubernetes Lease for singleton governance tasks.
- Schema-runner receives only the secret and Job permissions required for its operation.
- OAuth grants are encrypted with versioned AES-256-GCM envelope records. Production master keys
  come from an existing Secret or External Secrets integration; runtime code never creates a master
  key implicitly.
- Sessions expose provider identity but never provider access or refresh tokens.
- Security headers, bounded inputs, rate limits, audit events, and short-lived provider credentials
  are enforced at system boundaries.

## Reliability And Failure Modes

| Failure | Required behavior |
| --- | --- |
| PostgreSQL commits and dispatcher is down | Outbox remains pending and is delivered after recovery. |
| Dispatcher crashes after delivery | Restate invocation ID deduplicates redelivery. |
| Restate handler crashes | Execution resumes from durable journal. |
| Kubernetes call times out | Activity retries only when the operation has an idempotency key. |
| Approval takes days | Workflow sleeps without holding a worker or BullMQ job. |
| Restate is unavailable | Command remains accepted in PostgreSQL and health reports degraded. |
| Redis is unavailable | Authoritative workflows continue; realtime and short jobs degrade. |
| Projection fails | Event remains durable and projection can be replayed. |

## Non-Functional Baseline

- Control-plane intent RPO: zero after PostgreSQL transaction commit.
- Workflow recovery: no manual database edits for normal process or pod failure.
- API p95 target: below 300 ms for command acceptance excluding synchronous provider validation.
- Availability target: 99.9% after HA dependencies are enabled.
- Credentials: no plaintext provider tokens in browser sessions, logs, or new database rows.
- Supply chain: pinned actions and images, SBOM, provenance, vulnerability scan, and signature policy.
- Verification: unit, PostgreSQL/Redis integration, Restate contract, Playwright golden path, and
  deterministic crash-point tests.

## Migration Strategy

1. Add constraints, credential envelopes, release events, and outbox without changing user behavior.
2. Deploy Restate and dispatcher in shadow mode; verify idempotent invocation and observability.
3. Migrate project initialization, then release orchestration, then migration/repair approval flows.
4. Remove authoritative BullMQ paths and the healing jobs they made necessary.
5. Split infrastructure adapters and delete obsolete compatibility code.

Each workflow has one owner at every phase. Dual execution is forbidden; cutover uses a persisted
workflow backend and a one-way migration gate.

## Alternatives Rejected

### Temporal OSS

Temporal is more mature for complex workflow history, but its self-hosted operational footprint is
too large for Juanie's current single-cluster topology. Restate provides the required durability with
a smaller TypeScript-native runtime.

### Restate Cloud

Cloud reduces operations further, but the selected direction keeps workflow metadata and credentials
inside the existing platform boundary and avoids a new subscription dependency.

### Outbox Plus BullMQ Only

This fixes message loss but leaves approvals, timers, compensation, workflow history, and healing as
Juanie-owned infrastructure. It is an interim compatibility path, not the target architecture.

