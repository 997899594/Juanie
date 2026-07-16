# Delivery Graph Design

**Status:** Implemented

## Context

Juanie currently treats every detected workspace as a deployable service. That model works for a
small service monorepo, but it breaks down for product repositories that contain runtime apps,
static sites, SDK packages, documentation bundles, external databases and build-time artifacts in
the same workspace.

The import experience must remain simple. Repository structure, package scripts and dependencies
are platform-readable facts; users should not have to copy them into a large form.

## Decision

Repository inspection produces a Delivery Graph before it produces project services. The graph has
four first-class node categories:

- `workload`: a runtime deployed by Juanie (`web`, `worker`, `cron` or `static`).
- `artifact`: a build-only output such as an SDK, archive or documentation bundle.
- `library`: a workspace dependency that participates in affected-build calculation but is never
  deployed.
- `resource`: managed or external infrastructure and service dependencies.

Only workload nodes are converted into service drafts. The importer shows a compact graph summary;
manual service editing remains under Advanced settings.

## Inference Rules

1. A valid managed `juanie.yml` remains authoritative.
2. `apps/*` workspaces are workload candidates.
3. A `packages/*` workspace is a workload only when it has an explicit runtime script, schedule or
   Dockerfile.
4. A workspace with build/package scripts but no runtime entrypoint is an artifact candidate.
5. Remaining workspaces are libraries.
6. A frontend workspace with a build script and no production runtime script is a static workload.
7. Known infrastructure dependencies and environment contracts produce resource hints. Hints never
   invent credentials or managed infrastructure.

Inference is deterministic and fail-closed. Low-confidence guesses are not promoted to workloads.

## Import Experience

After choosing a repository, the default configuration screen shows:

- workloads that will run;
- build-only outputs that will be retained;
- ignored library count;
- external resources that still need binding.

The user only supplies values that cannot be derived: external connection details, secrets and
release-channel policy. CI remains platform-managed and may replace the repository CI file.

## Runtime Compatibility

The existing service table remains the runtime projection of the graph. Delivery Graph is the
source model stored in project configuration; workloads project into services, artifacts project
into first-class `buildTargets`, and external resources project into release admission contracts.

Build-only targets produce immutable OCI outputs without becoming services. A target-only change
creates an artifact-only Release that skips deployment orchestration and accepts registered customer
artifacts after the target build succeeds.

This avoids introducing another scheduler or deployment engine. Restate and Outbox continue to own
runtime releases; artifact-only releases terminate after build verification because they have no
runtime deployment stage.

## Failure Modes

| Failure | Required behavior |
|---|---|
| Repository cannot be inspected | Stop import and show the provider error; do not invent a service |
| No workload is detected | Show artifact-only repository state; require explicit confirmation before import |
| Static runtime cannot be generated | Mark the workload blocked with an actionable reason |
| External resource lacks credentials | Allow project creation but block the affected release |
| Generated CI cannot represent a graph node | Fail CI generation before writing repository files |

## Security And Operations

- Build-time secrets and runtime secrets are separate contracts.
- CI fetches build values per Build Run unit and passes them only through BuildKit secret mounts.
- Secret values are never returned by repository analysis or written to `juanie.yml`.
- External resources default to deny-all network access until an explicit binding is configured.
- Graph inference includes a version so future rule changes do not silently reinterpret an existing
  project.

## Alternatives

### Continue expanding `service`

Rejected. It makes build-only packages look deployable and pushes internal platform concepts into
the user form.

### Require every repository to maintain `juanie.yml`

Rejected as the default. Explicit configuration remains an override, not an onboarding prerequisite.

### Add repository-specific adapters

Rejected. Fuser is an acceptance case, not a hard-coded platform special case.
