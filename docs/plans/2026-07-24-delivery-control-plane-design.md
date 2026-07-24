# Delivery Control Plane Final Form

## Decision

Juanie keeps GitHub Actions as the elastic build executor and Restate as the durable control-plane
orchestrator. A new `deliveryExecution` aggregate becomes the authoritative answer to one question:
"What happened to this source change, from webhook receipt through production verification?"
`sourceDelivery`, `buildRun`, `release`, deployment, and migration records remain bounded-context
details, but all of them are correlated to one execution. The execution state machine is monotonic:

```text
received -> dispatching -> building -> staging_releasing -> staging_verified
         -> awaiting_promotion -> production_releasing -> production_verified
         -> failed | canceled
```

Callbacks do not directly invent the next step. They atomically update their domain record, append an
execution event, advance the execution projection, and enqueue the next Restate command through the
transactional outbox. Provider delivery id is the ingress idempotency boundary; execution id is the
workflow key; build run and release uniqueness remain secondary idempotency boundaries. GitHub Actions
also uses delivery-scoped concurrency so Restate retries cannot consume duplicate build capacity.

## Promotion and artifact trust

Production promotion creates a `promotionRequest` before it creates a production release. The request
captures a content digest over the source release, target environment, image digests, deliverable
checksums, and the explicit `independent_release_plan` migration approval mode. Approval applies only to
that digest. A production migration plan does not exist until the production release is created, so any
policy-gated migration is approved separately against its own immutable plan digest. Personal projects
and the default team policy perform promotion request plus artifact approval in the same one-click
command; the data model supports a distinct approver policy without making it a default or adding
application configuration. Any change to the captured content invalidates approval instead of silently
reusing it.

Every deployable image must have a registry digest. Release admission materializes a service-specific
`repository@sha256:...` reference, deployment records persist it, and the Kubernetes executor refuses
tag-only references. Application builds emit BuildKit SBOM and provenance, sign each digest using
Sigstore keyless GitHub OIDC, and report the attestation identity with the artifact. Promotion reuses the
same digest and rechecks the recorded trust statement. No child repository secret or new `juanie.yml`
field is required.

## Controllers and health

Repository webhook management becomes a persistent controller. Each repository has desired generation,
observed generation, canonical URL, status, retry deadline, attempt count, and last error. The scheduler
only enqueues reconciliation commands. A repository-keyed Restate Virtual Object performs provider I/O,
records observed state, and applies durable exponential backoff. It owns creation, update, and removal of
legacy webhook URLs.

Readiness remains a process/dependency gate. Full health gains a delivery-control-plane check derived from
dead-letter outbox rows, stuck source/build/release/execution counts, webhook drift, callback latency,
production verification SLO, and the last synthetic canary. A no-op smoke project exercises dispatch,
identity exchange, callback, and orchestration without deploying production workloads. Missing canary
configuration is `not_applicable` outside production and a visible warning in production.

Runtime verification uses Juanie's desired service state. A sleeping worker is `not_applicable`; a running
web, worker, or cron service must satisfy its inferred service-level contract. This policy is inferred from
the environment and service type, so applications do not gain health configuration burden.

## Experience

The environment delivery screen presents an execution timeline that spans source, build, staging,
promotion, production, and verification. The primary action stays one button. When production approval is
needed, the dialog shows the exact immutable artifacts being approved. A migration approval appears only
after its real release plan exists and always displays that plan's own digest.
Webhook drift and delivery-chain degradation appear as actionable operational signals, not generic 503s.
The UI never exposes Restate commands, outbox rows, or provider tokens as user concepts.

## Failure semantics and verification

Provider timeouts, 429s, and 5xx responses remain retryable Restate failures with durable backoff. Invalid
identity, missing workflow, invalid artifact digest, failed signature verification, and approval-content
mismatch are terminal domain failures with structured codes. Execution events preserve cause, correlation,
attempt, and timestamps for diagnosis. Tests cover transition legality, duplicate callbacks, promotion
digest invalidation, per-service digest deployment, controller drift/backoff, health severity, and sleeping
service semantics. CI additionally runs migration validation, unit/integration tests, typecheck, lint, build,
workflow syntax checks, and browser screenshots for desktop and mobile delivery views.
