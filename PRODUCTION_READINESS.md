# Production Readiness

This is a current checklist, not a historical progress log. For the complete architecture map, read
[`docs/current-architecture.md`](./docs/current-architecture.md).

## Current Baseline

| Area | Current state |
| --- | --- |
| Runtime | Web runs as Next standalone on Node 24. Worker, scheduler, and schema-runner share the Bun runtime image. |
| Platform deploy | CI builds `web` and `runtime`, updates `values-gitops.yaml`, then Argo CD syncs Helm. |
| Control-plane schema | Drizzle authors schema; Atlas owns the active migration chain in `migrations/`. |
| User app release | App CI builds images and calls Juanie. Juanie owns release, migration, deployment, rollout, and verification state. |
| Preview | Preview scaffold is managed by Argo CD ApplicationSet. Preview releases still flow through Juanie state. |
| PostgreSQL | CloudNativePG-backed managed PostgreSQL and shared Postgres provisioning are modeled in platform code. |
| Secrets | Chart supports existing Secret, built-in Secret, and ExternalSecret. Production should prefer existing Secret or External Secrets Operator. |
| TLS | cert-manager is part of bootstrap. Insecure TLS bypass is opt-in only. |
| RBAC | High-risk capabilities are behind explicit chart switches. `pods/exec` is disabled by default. |
| Realtime | Project init, project list, release, deployment, and schema repair paths use SSE plus Redis-backed events where available. |
| Observability | Structured logger, audit log, Sentry, Loki integration, and release trace context exist. |
| Health | Web readiness checks database and configured Redis; broader worker/schema-runner diagnostics remain a follow-up. |

## Production Rules

- Do not deploy the platform by SSHing into the server and running Helm.
- Do not create a second control-plane migration path outside Atlas.
- Do not write real secrets into Helm values.
- Do not mutate user app repositories for every runtime release.
- Do not use stale `drizzle/` snapshots as migration history.
- Do not add a new UI/tool path when `schema-safety`, release orchestration, or environment runtime already owns the concept.

## Remaining Gaps

| Gap | Why it matters | Preferred direction |
| --- | --- | --- |
| Worker/runtime readiness is not fully represented by web readiness | Web can be healthy while worker or schema-runner execution is degraded | Keep DB and Redis in readiness, then add a separate control-plane diagnostics surface for workers, scheduler, and schema-runner. |
| Production scheduler can run inside the worker | This saves resources but shares a failure domain | Keep it as an explicit low-cost mode, or split scheduler replicas for a stricter production profile. |
| Some domain modules remain too large | Large files hide duplicate paths and make regressions easier | Continue extracting project init, K8s operations, create-project UI, and environment UI into focused modules. |
| Quotas/cost/policy engine is still light | Multi-tenant platforms need cost and usage guardrails | Add usage accounting before expanding expensive automation. |

## Golden Path Checks

After major architecture changes, verify:

1. Importing a repository injects Juanie-managed CI and `juanie.yaml`.
2. Staging first release is created from the app CI path.
3. Preview can be created from a remote branch's latest commit.
4. Preview can promote to staging.
5. Staging can promote to production and finish controlled rollout from the release detail page.
6. Schema gate blocks unsafe releases and offers the expected repair/review path.
7. Project deletion enters deleting state, cleans runtime resources, and disappears through SSE.
8. Platform self-deploy updates only the GitOps pointer and is reconciled by Argo CD.
