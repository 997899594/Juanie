# Thin Application CI Design

## Decision

Child repositories expose one user-owned declaration, `juanie.yml`, and one provider-owned
bootstrap entry. GitHub uses a one-job caller for a Juanie reusable workflow. GitLab uses a single
remote CI Component include protected by GitLab's `integrity` field. All executable build planning,
OIDC exchange, image building and artifact registration code belongs to a versioned Juanie CI
runtime. Juanie no longer commits `.juanie/*`, `JUANIE.md`, `.env.juanie.example`, generated
Dockerfiles or static runtime configuration into child repositories.

The bootstrap entry is not application configuration. It is a provider requirement that grants the
minimum permissions needed to start the platform runtime. Application owners only edit
`juanie.yml`. Juanie can replace the bootstrap mechanically when its runtime revision changes,
without merging application-specific data into it.

## Configuration Authority

An OIDC workload token binds provider, repository, ref, source commit and external run id. After
verifying that identity, the control plane reads `juanie.yml` from the bound commit through the
team integration binding. It validates the file with the platform parser and derives the build plan
from that immutable content. Missing or invalid configuration fails the build. The control plane
must not use the mutable `project.configJson` snapshot as a build fallback.

GitHub additionally requires the signed `job_workflow_ref` claim to equal the Juanie source
repository, reusable workflow path and deployed immutable revision. GitLab requires
`ci_config_sha` to equal the pipeline source SHA, then reads that revision's `.gitlab-ci.yml` and
verifies the exact Component URL, integrity and origin. The exchanged token signs the resolved
Juanie project and repository IDs as well as provider/source/run scope; repository display names are
never used to rediscover ownership after exchange.

CI only supplies repository facts that require a checkout: changed paths, Turborepo affected package
names and whether a full build was explicitly requested. The server combines those facts with the
commit-scoped config to select services, build targets and deliverables. The resulting plan records
the config path and digest so retries and audits retain their source lineage.

## Runtime Distribution

The deployed platform revision is the runtime revision. Platform CI injects the immutable Juanie
source repository and commit SHA into the Helm release. Generated GitHub callers pin the reusable
workflow to that SHA. GitLab callers include a versioned component served by Juanie and pin its
content with SHA-256 integrity. Both coordinators download the same versioned runtime assets from
the platform.

Runtime state lives under the CI runner's temporary workspace and is transferred only as short-lived
CI artifacts between jobs. Managed Dockerfiles are emitted into runtime state from the validated
build plan and passed to BuildKit with `--file`; they are never written to the source checkout.

## Failure Model

- Missing `juanie.yml`, invalid YAML, provider read failure or SHA mismatch blocks build planning.
- An unavailable or integrity-mismatched CI Component blocks GitLab pipeline creation.
- An unavailable reusable workflow revision blocks GitHub before application code runs.
- Unknown services, targets or packages are rejected by the control plane.
- No path falls back to injected scripts, embedded matrices or a previous database config snapshot.

## Repository Contract

GitHub repositories contain `juanie.yml` and `.github/workflows/juanie-ci.yml`. GitLab repositories
contain `juanie.yml` plus one Juanie include in their existing `.gitlab-ci.yml`; Juanie must not
replace unrelated GitLab jobs. Repositories with an existing GitLab pipeline receive a managed
include block, while new repositories receive the minimal include-only file.
