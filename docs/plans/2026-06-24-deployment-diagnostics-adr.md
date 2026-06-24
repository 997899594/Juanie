# ADR: Deployment Diagnostics as Release Evidence

## Status
Accepted

## Context
Deployment failures were recorded mainly as flat log lines and terminal error messages. When
Kubernetes later scaled a non-production environment to zero or garbage-collected pods/events, the
release page could only show symptoms such as `available=0`, not the workload, pod, event, and
container-log evidence that caused the failure.

The platform needs deployment diagnostics that survive auto-sleep, cleanup, and later operator
inspection without coupling UI behavior to ephemeral cluster state.

## Decision
Store deployment failure diagnostics as first-class control-plane records in
`deploymentDiagnostic`, linked to the concrete `deployment` and optionally its `release`,
`environment`, and `service`.

The deployment failure bus captures one structured snapshot per failure attempt:

- workload state for Kubernetes Deployment or Argo Rollout
- active selector and replica counts
- pod summaries and container states
- related warning events
- sanitized container log tail

Release detail pages read the latest diagnostic snapshot per deployment and render it beside the
deployment logs.

## Consequences

### Positive
- Failure evidence survives auto-sleep and pod/event cleanup.
- Web and worker failures remain attributed to the correct deployment inside one release.
- UI can show concise summaries while keeping raw evidence expandable.
- Future automation can query diagnostics structurally instead of parsing log strings.

### Negative
- Control-plane database stores bounded log tails, so retention policy must include diagnostics.
- Capture can fail when Kubernetes is unavailable; that state is still persisted as an unavailable
  snapshot.

### Neutral
- Existing deployment logs remain for timeline streaming, but they are no longer the source of truth
  for failure forensics.

## Alternatives Considered

**Append more text to `deploymentLog`**
- Rejected because it keeps diagnostics unstructured, hard to query, and easy to lose in retention.

**Rely on live Kubernetes state**
- Rejected because auto-sleep and cleanup remove the exact evidence needed for postmortems.

**Store diagnostics at release level only**
- Rejected because one release can contain multiple service deployments with different failure
  states.
