# Deployment Architecture

This document describes the current deployment boundary. The canonical architecture entry remains
[`docs/current-architecture.md`](./docs/current-architecture.md).

Juanie intentionally keeps two deployment paths because they solve different problems:

1. Juanie self-deploys the control plane.
2. Juanie manages releases for user applications.

These paths should share platform primitives where useful, but they should not be collapsed into
one generic GitOps story.

## Juanie Self-Deploy

Juanie self-deploy is first-party control-plane delivery.

Current chain:

1. A push to `main` runs CI quality checks.
2. CI builds two images from the platform `Dockerfile`: `web` and shared `runtime`.
3. CI updates `deploy/k8s/charts/juanie/values-gitops.yaml` with the new image tags.
4. CI commits the GitOps pointer back to `main` with `[skip ci]`.
5. Argo CD syncs the `juanie-platform` Application.
6. The Helm PreSync Job runs control-plane Atlas migrations through the runtime image
   `schema-runner`.
7. Helm rolls out web and worker workloads. The same runtime image also provides worker,
   scheduler, and schema-runner commands.

Rules:

- Do not restore SSH-based Helm deployment scripts.
- Do not reintroduce separate platform `worker` or `migrate` images.
- Control-plane schema changes go through `atlas.hcl` and `migrations/` only.
- Argo CD and Helm own desired-state sync; CI only builds images and moves the GitOps pointer.

Operational checks:

- GitHub Actions `quality`, `build-images`, and `promote-gitops`.
- `deploy/k8s/charts/juanie/values-gitops.yaml` for the promoted image revision.
- Argo CD Application `juanie-platform`.
- PreSync schema-runner Job logs.
- `/api/health/ready` for web readiness.

## Platform-Managed Application Releases

User applications are not deployed through the platform self-deploy path.

Current chain:

1. Juanie creates or imports a project and injects managed CI plus `juanie.yaml`.
2. The app repository CI builds the app image.
3. The app repository CI calls Juanie release APIs.
4. Juanie resolves environment policy, service artifacts, database bindings, and schema gates.
5. Juanie runs pre-deploy migration work when configured.
6. Juanie deploys or updates workloads in the target environment.
7. Juanie verifies runtime state and route state.
8. Production releases may stop at a controlled rollout gate.
9. Juanie records release, deployment, migration, trace, and AI/task context.

Rules:

- User app CI builds artifacts; Juanie owns release orchestration.
- Subapps do not need a GitOps repo mutation for every release.
- Migration truth comes from `juanie.yaml` and supported schema sources, not platform guesses.
- Atlas is used for diff/safety/repair workflows, while app migration execution follows the
  configured migration tool and policy.
- Preview scaffold is managed through Argo CD ApplicationSet, but individual subapp releases stay
  release-state-machine driven.

## Boundary

Use the self-deploy path when Juanie ships Juanie.

Use the platform-managed path when Juanie ships a user application.

If a change makes the two paths look identical again, it is likely reintroducing accidental
complexity or stale GitOps dogma.
