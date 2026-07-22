# ADR-0009: Make source delivery ingress durable

## Status

Accepted

## Context

ADR-0002 made application delivery platform-owned, but the initial implementation dispatched the
platform GitHub Actions workflow synchronously from the source webhook request. A missing or invalid
GitHub App identity therefore turned an authenticated source event into an HTTP 503 without leaving
a durable record. The webhook reconciler only proved that the source-provider webhook existed; it
did not prove that Juanie could dispatch the downstream platform workflow. Stale Juanie webhook URLs
also remained active because provider webhook ownership was not persisted.

Source events must be acknowledged independently from downstream availability, deduplicated by the
provider delivery identity, observable after acceptance, and replayable without reusing a person's
OAuth grant as the platform execution identity.

## Decision

Persist every matched source push as a `sourceDelivery` inbox record. The unique identity is the
source provider plus its delivery ID. In the same PostgreSQL transaction, enqueue a
`source.delivery.requested` outbox command. The webhook returns HTTP 202 after that transaction and
never calls GitHub Actions directly.

The outbox dispatcher invokes a keyed Restate `SourceDeliveryWorkflow`. The workflow owns dispatch
attempts and projects `received`, `dispatching`, `dispatched`, and `failed` states back to PostgreSQL.
Build creation remains idempotent on the same external delivery ID, so an uncertain external
dispatch can create at most duplicate runner work, never duplicate control-plane builds or releases.

Repositories persist the provider webhook ID and verification state. Reconciliation manages that
specific webhook, adopts an exact canonical URL when necessary, and removes only explicitly
recognized Juanie legacy URLs. It never deletes unrelated user-owned webhooks.

Platform release includes a pre-upgrade application-delivery capability Job. It validates the
GitHub App key, obtains a short-lived installation token, and confirms that the pinned
`application-delivery.yml` workflow is accessible and active. Failure blocks the Helm release.

## Consequences

### Positive

- Authenticated source pushes survive GitHub, Restate, or network outages after PostgreSQL commit.
- Duplicate provider deliveries converge on one source-delivery aggregate.
- Dispatch failures retain an operator-visible state and error instead of becoming a generic 503.
- Webhook health and downstream delivery capability become separate, accurate signals.
- Missing platform execution identity fails deployment before workloads roll.

### Negative

- Source delivery adds one table, one Restate service, and one Helm hook Job.
- An uncertain GitHub `workflow_dispatch` response may start duplicate workflow runs, although the
  build-run uniqueness boundary prevents duplicate application effects.
- GitHub App configuration remains a required platform bootstrap responsibility.

### Neutral

- `JUANIE_GITHUB_APP_INSTALLATION_ID` remains optional because it can be resolved from the platform
  repository installation.
- Child repositories still need only `juanie.yml`; no new application-side configuration is added.

## Alternatives Considered

- Only add the missing production Secret: rejected because accepted events would still be lost on
  transient downstream failures and health would still be false-positive.
- Retry GitHub from the HTTP handler: rejected because request retries are not a durable execution
  boundary and make provider delivery latency depend on GitHub availability.
- Fall back to a team member OAuth token: rejected because it violates the platform-owned identity
  boundary and reintroduces offboarding failures.
- Use BullMQ: rejected because source delivery is authoritative and must survive Redis loss.

## References

- `docs/adr/0002-platform-owned-application-delivery.md`
- `src/app/api/webhooks/source/route.ts`
- `src/lib/outbox/dispatcher.ts`
- `src/lib/restate/services.ts`
