# ADR: Atlas-backed schema release graph

## Status

Accepted

## Context

Juanie currently models a database release as one mutable migration specification in either the
`preDeploy` or `postDeploy` phase. This is sufficient for desired-state schema convergence, but it
cannot represent a zero-downtime change that must cross a deployment boundary:

`expand -> backfill -> verify -> cutover -> contract`

Using `schema.source=drizzle` for this flow loses data-migration intent because the platform only
sees the final desired schema. Running an application-owned release script would create a second,
untracked executor and bypass Atlas checksums and the migration ledger.

The release contract must preserve these non-functional properties:

- every database action is repository-tracked and pinned to the release commit;
- one database has at most one actively executing stage;
- a failed stage resumes from Atlas' revision ledger without replaying completed versions;
- contract migrations cannot run before the new workload has completed rollout verification;
- existing single-phase Atlas, Drizzle, and SQL projects continue to work unchanged.

## Decision

Add an Atlas-only `schema.releaseGraph` contract with fixed architecture stages:

```yaml
schema:
  source: atlas
  config: atlas.hcl
  releaseGraph:
    baselineVersion: "2026071400"
    expand:
      targetVersion: "2026071401"
    backfill:
      targetVersion: "2026071402"
    verify:
      targetVersion: "2026071403"
    cutover: deployment
    contract:
      targetVersion: "2026071404"
```

All SQL remains in one linear Atlas migration directory. `expand`, `backfill`, and `verify` are
ordered pre-deploy specifications. `cutover` maps to Juanie's existing deployment and rollout
state machine. `contract` is a post-deploy specification. Each Atlas execution uses
`atlas migrate apply --to-version <targetVersion>` and fixes the revision ledger in `public`
rather than relying on Atlas CLI version defaults.

`baselineVersion` is optional. Juanie only passes it to Atlas when the target database has user
tables but no revision ledger. Empty databases execute the baseline migration normally; existing
databases adopt it and continue from the next version.

Juanie persists one specification per architecture stage and creates one immutable
`releaseMigrationPlan` before any stage executes. The plan is pinned to a commit, contains the full
per-stage file contents and specification snapshots, and is addressed by a canonical SHA-256
digest. Production approval applies once to that digest. Migration runs are execution projections
of the approved plan and never request a second stage-level approval. The release phase scheduler
orders runs by stage order, not insertion timestamp.

Plan creation is fail-closed. Repository read errors, timeouts, missing file contents, unknown
database state, and truncated previews block the release. Juanie never converts an unreadable
preview into an empty approvable migration.

The parser rejects release graphs that are incomplete, non-monotonic, used with a non-Atlas
source, or combined with an explicit legacy phase. A declared graph always selects the tracked
Atlas migration chain and cannot fall back to desired-state push.

## Consequences

### Positive

- Data backfills and verification assertions become first-class release gates.
- Atlas remains the only child-database migration executor and ledger owner.
- Cutover and contract ordering is enforced by the existing rollout state machine.
- Retries are idempotent at the migration-version boundary.
- Release details can show architecture stage and target version directly.
- Operators approve one complete release migration plan instead of four independent stage runs.

### Negative

- Authors must assign stable, monotonically increasing Atlas versions to stage boundaries.
- Long backfills still need application-specific SQL design and operational sizing.
- The control-plane schema gains stage metadata, immutable run snapshots, and a release migration
  plan aggregate.

### Neutral

- The graph is deliberately fixed rather than a general-purpose DAG. Database changes require a
  strict total order, and arbitrary branching would add failure semantics without product value.
- Existing non-graph specifications remain `standard` stage migrations.

## Alternatives Considered

### Multiple Atlas directories

Rejected because Atlas linear history validation expects one coherent directory. Splitting stage
directories makes earlier revisions disappear from later executions or requires unsafe non-linear
execution flags.

### Application-owned TypeScript release script

Rejected because it bypasses the platform executor, Atlas checksum verification, release previews,
and centralized retry state.

### Desired-state Drizzle export at every stage

Rejected because desired-state diffs cannot preserve data transformation and verification intent.

## Failure And Recovery

- A stage failure stops the release before any later stage is dispatched.
- Retry creates a new run projection from the approved stage snapshot and the same release commit.
- Atlas skips already recorded revisions and continues toward the stage target.
- A failed pre-deploy stage never reaches cutover.
- A failed contract stage marks the release degraded; the deployed workload remains available while
  operators retry the contract stage.
