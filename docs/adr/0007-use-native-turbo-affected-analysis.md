# ADR 0007: Use Native Turbo Affected Analysis

- Status: Accepted
- Date: 2026-07-20

## Context

Juanie previously selected Turborepo build units from provider changed-file paths. That cannot
resolve reverse workspace dependencies: a shared library change can require rebuilding applications
outside the changed directory. Keeping a second dependency engine in the control plane would also
drift from Turbo task and workspace semantics.

## Decision

The platform-owned delivery workflow materializes immutable base and head archives as a synthetic
two-commit Git repository and runs pinned Turbo 2.10.5 queries there. The workflow submits the
complete workspace package list and affected package list through an OIDC-authenticated request.
Juanie binds the workload token and analysis to repository, provider, ref, head SHA, base SHA, and
delivery id, then validates every declared service and build target against the source graph.

Package-level affected analysis is the default because it remains correct when a repository has not
declared complete Turbo task dependencies. Task-input analysis is available only through the
explicit `useTaskInputs: true` optimization. Missing snapshots, query errors, malformed facts, and
incomplete provider comparisons always select the full declared graph.

Managed Turborepo builds use the same pinned Turbo version to prune the target dependency closure.
The root repository remains the build context, while runtime images contain only the pruned closure
or an explicit `pnpm deploy` output. The platform workflow restores and saves each build unit's
`.turbo` directory through a repository- and lockfile-scoped GitHub Actions cache; a dedicated
Docker target exports the updated cache without requiring Vercel credentials or user configuration.

## Consequences

- Shared package changes rebuild dependent applications without extra Juanie configuration.
- GitHub, GitLab, and self-hosted GitLab use the same analysis path without exposing provider
  credentials to build containers.
- Selective planning downloads one additional immutable archive and installs a pinned Turbo CLI.
- Invalid or incomplete analysis costs a full build instead of risking a skipped deployment.
- Nx, Rush, and Lage remain outside this ADR; supporting them requires a separate workspace-engine
  decision rather than path-matching extensions.
