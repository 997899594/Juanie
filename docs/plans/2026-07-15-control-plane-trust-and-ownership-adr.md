# ADR: Control-plane trust, ownership and recovery boundaries

## Status

Accepted

## Context

Juanie already persists lifecycle intent through PostgreSQL outbox messages and executes durable
commands through Restate. The remaining failure modes sit outside that happy path:

- repository read tokens are accepted as CI execution identities;
- build-secret capabilities are copied through workflow artifacts;
- release and migration Restate objects are keyed by record id instead of the resource they mutate;
- the control-plane migration chain does not provide a reusable expand/contract boundary;
- the production Helm profile can deploy three single-replica state stores without backup or alerts;
- runtime pods receive broader credentials and Kubernetes permissions than their bounded context
  requires.

The platform must remain simple for application repositories. Generated workflows may acquire
identity automatically, but users must not maintain static Juanie tokens or understand coordinator
internals.

## Decision

1. CI calls use workload identity. GitHub Actions obtains an OIDC token with audience `juanie-ci`.
   Juanie verifies issuer, audience, repository, workflow, ref, run and attempt claims. Git provider
   API tokens no longer authorize control-plane mutations.
2. Build secrets are fetched with a fresh workload token and a unit-scoped request. No secret
   capability is returned by the build API or persisted in workflow artifacts.
3. Durable commands carry an explicit execution key. Release commands are serialized by target
   environment and migration commands by environment/database lock key. PostgreSQL ownership rows
   add fencing across the full asynchronous lifecycle, not only one Restate handler invocation.
4. Future destructive control-plane DDL is isolated from the normal expand chain. CI rejects
   destructive statements in expand migrations. Contract migrations use their own Atlas revision
   chain and require an explicit compatibility epoch before execution.
5. The production Helm profile fails closed unless it uses external state services or enables both
   PostgreSQL backup and Restate snapshots. Production alert rules are mandatory.
6. Kubernetes credentials and Secret keys are projected per component. Restate execution endpoints
   are reachable only from Restate Server, and the controller role is not shared with the scheduler.
7. Runtime secret records enforce one of two valid shapes: plaintext non-secret or complete encrypted
   secret. Read paths never migrate or return plaintext secret fallbacks.

## Consequences

### Positive

- Repository membership no longer implies access to build secrets or release mutation APIs.
- A database and an environment each have one fenced mutation owner.
- Rollback compatibility becomes a release invariant instead of a naming convention.
- Production cannot silently run without recovery and alerting.
- A compromised low-privilege pod has a smaller credential and Kubernetes blast radius.

### Negative

- Generated CI workflows require `id-token: write`.
- Self-hosted GitLab needs an explicitly trusted issuer and JWKS endpoint.
- Existing plaintext environment secrets must be migrated before the database constraint is enabled.
- Production operators must choose external HA state services or provide backup storage and a CSI
  snapshot class.

## Alternatives Considered

- GitHub App installation tokens were rejected for build execution because they identify an
  installation, not a concrete workflow run and unit.
- Additional preflight queries were rejected as a concurrency fix because they do not close races.
- Running contract DDL immediately after each rollout was rejected because it destroys the N-1
  rollback window.
- Keeping backup and alerting optional in production was rejected because it makes documented RPO
  and detection targets fictional.
