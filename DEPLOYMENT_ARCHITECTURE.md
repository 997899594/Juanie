# Deployment Architecture

This repository intentionally keeps two different deployment paths.

They solve different problems and should not be merged back into one generic flow.

## 1. Juanie Self-Deploy

Juanie deploying Juanie is a first-party release path.

Characteristics:

- Single known application
- Single known database ownership
- Migration command is owned by this repository
- No need for platform inference
- No need for project-level migration policy orchestration

Current release chain:

1. CI builds three runtime images:
   - `juanie-web`
   - `juanie-worker`
   - `juanie-migrate`
2. CI connects to the target cluster
3. CI creates a cluster-local schema sync job with `juanie-migrate`
4. Migration must succeed before rollout continues
5. Helm rolls out `juanie-web`
6. Helm rolls out `juanie-worker`
7. Rollout failure stops the release

Design rules:

- Migration runs inside the target cluster, not on the GitHub runner
- Failed migration must block rollout
- Web, worker, and migration artifacts must remain separate
- Self-deploy does not go through Juanie's own platform release domain

## 2. Platform-Managed Application Deploy

This is the multi-tenant control-plane path for user projects such as `nexusnote`.

Characteristics:

- The platform does not inherently know the app's migration command
- The platform does not inherently know the right database binding
- Different services can target different databases
- Different environments can have different migration policies
- The platform must explain, audit, retry, diff, and attribute failures

Current release chain:

1. A project release is created
2. Juanie resolves release artifacts by service
3. Juanie reads `juanie.yaml`
4. Juanie resolves migration specifications and database bindings
5. Juanie runs pre-deploy migration phase
6. Juanie deploys workloads
7. Juanie verifies rollout and traffic state
8. Juanie records timeline, incidents, and remediation signals

Design rules:

- This path keeps release orchestration, migration policy, manual controls, and incident signals
- Migration specs come from the repository contract, not platform guesses
- Deployment and migration stay coupled at the workflow level but decoupled at the runtime artifact level

## Boundary

Use the self-deploy path when Juanie ships Juanie.

Use the platform-managed path when Juanie ships somebody else's application.

If a change makes these two paths look identical again, it is probably pushing the architecture in the
wrong direction.
