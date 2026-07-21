# ADR-0008: Enforce Control-Plane Schema Convergence Before Rollout

## Status

Accepted

## Context

The published `20260714120000_schema_release_graph.sql` revision was extended after an earlier
version had already been applied to production. Production recorded the original seven-statement
hash, while later installations received the extended migration that also created
`releaseMigrationPlan` and `migrationRun.releaseMigrationPlanId`.

Atlas correctly treated the version as applied and did not replay it. The platform release gate
only checked the Atlas revision frontier, Kubernetes rollout status, and the generic readiness
endpoint. A Web image could therefore require schema objects that were absent from the production
database while every deployment check remained green.

The control plane needs an application compatibility boundary, not only a migration-ledger boundary.
It must also repair the already-diverged lineage without rewriting published history again.

## Decision

- Keep all migrations currently published on `main` immutable from this point forward.
- Add one append-only reconciliation revision that converges both known states:
  - databases that applied the original seven-statement revision;
  - databases that applied the later extended revision.
- Derive the required runtime schema contract directly from the Drizzle table and enum definitions.
  The contract covers tables, columns, PostgreSQL types, nullability, database defaults, enum labels,
  indexes, and structural constraint signatures.
- Run the schema contract after every control-plane expand migration and explicit contract promotion.
  Extra database objects remain allowed during compatibility windows, but every object required by
  the active runtime must exist and match before either operation succeeds.
- Execute representative Drizzle read models in the same pre-upgrade Job. This validates the query
  graph actually used by project overview pages before the Web deployment rolls forward.
- Keep `/api/health/ready` lightweight. Release compatibility belongs to the one-shot schema gate,
  not to every Kubernetes readiness probe.

## Consequences

### Positive

- A Web/runtime image cannot roll out against a database missing objects it queries.
- The contract follows the application schema automatically instead of maintaining a second manual
  column allowlist.
- Historical production and fresh installations converge through one forward-only revision.
- Deferred contract migrations may leave extra objects without blocking an expand release.
- Query-shape regressions are detected before user traffic reaches a new Web image.

### Negative

- The schema-runner binary includes the Drizzle schema metadata and performs additional catalog
  queries during deployment.
- A deliberate schema change must ship with an expand migration before the runtime that requires it.
- Named index and constraint changes become part of the runtime deployment contract.

### Neutral

- The existing append-only lineage check remains the mechanism preventing future migration rewrites.
- The production readiness endpoint continues to measure runtime dependencies rather than release
  compatibility.

## Alternatives Considered

**Patch production with manual SQL**

Rejected because it creates an untracked third schema lineage and does not protect future releases.

**Restore the old migration file and move the added statements to a new revision**

Rejected because some databases may already have recorded the extended hash. Rewriting the file
again would replace one divergent history with another.

**Run a full destructive Atlas diff against production**

Rejected because expand deployments intentionally tolerate extra objects until a separately promoted
contract migration removes them. The release gate needs required-subset compatibility, not exact
schema identity.

**Add the project query to the Kubernetes readiness probe**

Rejected because it would turn a release invariant into a continuous high-frequency dependency and
could remove healthy Pods from service because of one representative read model.

## References

- `migrations/20260714120000_schema_release_graph.sql`
- `src/lib/db/control-plane-atlas.ts`
- `deploy/k8s/charts/juanie/templates/schema-sync-job.yaml`
- `docs/plans/2026-07-21-control-plane-schema-convergence-design.md`
