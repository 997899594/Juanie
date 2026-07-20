# Turborepo Monorepo Final Form

## Decision

Juanie uses Turborepo's native affected query as the only selective-build authority for
`monorepo.type: turborepo`. Path matching is retained only for explicit manual selection. A missing,
invalid, or failed Turbo analysis always produces a full build.

The platform-owned delivery workflow downloads immutable base and head archives and materializes a
two-commit synthetic Git repository. It runs a pinned Turbo CLI in that repository, then submits the
result through an OIDC-authenticated build-run request. The Juanie workload token binds repository,
provider, head SHA, base SHA, ref, and delivery id so the analysis cannot be replayed for another
source lineage.

## Data Flow

1. The delivery workflow requests the build-analysis policy from Juanie.
2. Juanie loads the commit-scoped `juanie.yml` and returns either `full` or a Turbo task policy.
3. For selective builds, CI downloads both immutable revisions and creates base/head Git commits.
4. CI runs pinned `turbo query affected` in package or task-input mode.
5. CI submits the affected package facts with the build-run command.
6. Juanie validates the facts against the authenticated lineage and declared workload packages.
7. Analysis failures, incomplete provider comparisons, or undeclared workload facts fail full.

## Workspace Discovery

Repository import reads workspace declarations from `pnpm-workspace.yaml` first and then
`package.json#workspaces`. Glob expansion is bounded and provider-backed, supports nested paths and
negative patterns, and no longer assumes only `apps/*` and `packages/*`.

## Packaging

Managed Turborepo images use `turbo prune --docker` before dependency installation. The default
runtime copies only the target package dependency closure. An explicit `pnpm-deploy` strategy runs
`pnpm deploy --prod` to produce a minimal self-contained runtime tree. Unsupported package metadata
is rejected instead of being accepted and ignored. Turbo task artifacts are persisted remotely by
the platform workflow through a service-scoped GitHub Actions cache and a generated cache-export
Docker target, so child repositories do not need cache credentials or additional configuration.

## Failure Modes

- Turbo unavailable, malformed output, missing base, or query failure: full build.
- Provider comparison truncated: full build.
- Analysis lineage does not match the request: reject the request.
- Workspace discovery exceeds its bounds or cannot resolve a declaration: surface a topology warning
  and require declared `juanie.yml` topology.

## Trade-offs

The plan job downloads the base archive for selective Turborepo builds and installs a pinned Turbo
CLI. That adds planning latency, but removes the correctness risk of maintaining a second dependency
engine in Juanie. Synthetic Git history works consistently for GitHub, GitLab, and self-hosted
GitLab archives without exposing provider credentials to the executor.
