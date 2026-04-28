# Juanie Architecture Convergence

## Conclusion

Juanie is not a pile of disconnected features, but several late-stage capabilities now overlap at
the edges. The product spine is correct:

Project -> Environment -> Release -> Schema Safety -> Deployment -> Rollout/Traffic -> Timeline
-> Governance.

The work to reach 90 is not adding more surfaces. It is making every capability belong to one
plane, one owner, and one user path.

## Target Score

| Area | Current Read | 90-Point Requirement |
| --- | --- | --- |
| Release Control | Strong core state machine, some event composition in view code | Release detail uses one canonical timeline/event builder |
| Environment Control | Environment is the right control center | Runtime, resources, variables, sleep/wake and routes stay environment-owned |
| Schema Safety | Good backend depth, naming split across migrations/schema-management/gate | Public product boundary is Schema Safety; internals can stay specialized |
| Runtime Governance | Healing exists for infra, migration and schema states | Route drift from sleep/wake is reconciled by scheduler, not manual cleanup |
| UI Information Architecture | Useful but occasionally repetitive | One main chain first; advanced controls are secondary environment/release tools |

## Architecture Boundaries

### Control Plane

Owns product identity and user intent: teams, projects, environments and releases. It should not
leak Kubernetes object details into primary flows.

### Schema Safety Plane

Owns database readiness before and during release:

- schema inspection
- schema gate
- migration run state
- repair plan and review request
- ledger adoption

The user-facing concept is Schema Safety. `schema-management`, `migrations` and `schema-gate` are
implementation modules behind that boundary.

### Runtime Plane

Owns workloads, routes, sleep/wake and traffic. Runtime state must be self-healing enough that a
sleeping environment, a resumed environment and a promoted release cannot leave stale routes behind.

### Release Intelligence Plane

Owns the release story: release creation, migration approval/failure, deployment, rollout, preview
readiness, infra incidents and governance actions. The release timeline is the canonical event
stream, not a UI-only summary.

### Governance Plane

Owns scheduled cleanup, reconciliation and retention. Anything that can drift because Kubernetes,
CI, registry or workers are eventually consistent belongs here.

## Decisions

### ADR-001: Environment Is The Main Operating Surface

Environment details own variables, resources, runtime state, logs, sleep/wake and database safety.
Project pages summarize; release pages explain one change; resources stay a secondary environment
tool.

### ADR-002: Schema Safety Is The Public Boundary

Do not expose three product concepts named migration management, schema management and schema gate.
The platform speaks Schema Safety. Internally, the modules can remain separate where that keeps the
code simple.

### ADR-003: Release Timeline Is The Canonical Event Stream

Release detail should consume a single timeline builder. It may include migrations, deployments,
incidents, rollout and governance events, but those are all release events from the user's point of
view.

### ADR-004: Runtime Routes Must Reconcile

Sleep/wake and rollout both mutate HTTP routes. Scheduler reconciliation is required so stale wake
routes or app routes do not survive a partial failure.

### ADR-005: No Compatibility Shims For Broken Concepts

If a concept is wrong, migrate it to the correct model. Do not add presentation-layer reinterpretation
or long-term compatibility branches just to hide old states.

## 90-Point Checklist

- Release detail uses one event timeline module.
- Schema APIs enter through the Schema Safety boundary.
- Mark-aligned access and presentation logic is centralized with other schema actions.
- Runtime route state is reconciled on a schedule.
- Documentation records which plane owns which capability.
- UI keeps the main path simple: Environment -> Release -> Schema Safety -> Logs/Timeline.

