# ADR-0002: Make application delivery platform-owned

## Status

Accepted

## Context

Child repositories must not own copies of Juanie's CI implementation. A generated workflow is
still application-repository infrastructure, drifts from the platform runtime, and expands the
workload identity surface. The application contract is one declaration at the bound source commit.

## Decision

The canonical child-application declaration is `juanie.yml`. It is the only Juanie-owned file a
child repository needs. Juanie receives source events through its Git provider integration,
validates the repository and exact commit, reads `juanie.yml`, and runs delivery from a
version-pinned platform workflow.

Child repositories do not contain `.github/workflows/juanie-ci.yml`, generated shell runtimes, or
GitLab CI includes for Juanie. Workload identity is issued to the platform-owned delivery workflow
and bound in code to the source repository, ref, and commit.

GitHub and GitLab push webhooks are installed through the bound provider integration and verified by
Juanie. Juanie dispatches its own GitHub Actions workflow with a short-lived GitHub App installation
token. The workflow authenticates control-plane calls with GitHub OIDC, downloads the exact source
snapshot through Juanie, and pushes images only to the Juanie-owned workload registry.

## Consequences

### Positive

- CI implementation upgrades atomically with the Juanie control plane.
- Child repositories expose one stable, reviewable application contract.
- Provider credentials and identity policy stay in the platform trust boundary.

### Negative

- Juanie must operate reliable GitHub App and GitLab webhook ingestion.
- Source-event replay and delivery deduplication become platform responsibilities.
- Existing child workflows require a one-time migration and removal.

## Alternatives Considered

- Provider-owned reusable-workflow bootstrap in each child repository: rejected because the child
  still contains CI infrastructure.
- Generated full CI workflows: rejected because runtime and security policy drift per repository.

## References

- `juanie.yml`
- `.github/workflows/application-delivery.yml`
