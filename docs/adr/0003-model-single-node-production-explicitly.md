# ADR-0003: Model single-node production explicitly

## Status

Accepted

## Context

Juanie currently runs on one four-core node with 3.7 GiB of memory. Requiring two replicas of
every control-plane component does not provide node-level availability and can prevent scheduling
or trigger memory pressure. Production readiness must describe the topology that actually exists
instead of equating production with a replica count.

## Decision

Add `production.topologyMode` with two valid modes:

- `singleNode` requires exactly one replica of every control-plane component and uses no-surge
  rolling updates.
- `highAvailability` requires at least two replicas of every control-plane component and is only
  appropriate after the cluster has multiple failure domains and sufficient capacity.

The current production values use `singleNode`. Durability, monitoring, immutable image, and schema
release gates remain mandatory in both modes.

## Consequences

### Positive

- Resource declarations match the real cluster capacity and failure domain.
- A future HA migration is an explicit, validated topology change.
- Single-node upgrades cannot temporarily schedule an unbounded surge replica.

### Negative

- A web rollout has a short availability gap on the single node.
- The current topology cannot survive node failure.

## Alternatives Considered

- Keep two replicas on one node: rejected because it is not high availability and exceeds capacity.
- Silently reduce production replicas: rejected because topology intent would remain implicit.
- Resize only the existing node: rejected as an HA solution because it keeps one failure domain.

## References

- `deploy/k8s/charts/juanie/values-prod.yaml`
- `deploy/k8s/charts/juanie/templates/production-readiness.yaml`
