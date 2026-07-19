# ADR-0005: Use Content-Addressed Platform Image Releases

## Status

Accepted

## Context

Juanie's platform release previously rebuilt web, runtime, and schema-runner images for every push to
`main`. The Docker build also received the GitHub run ID as `SECURITY_REFRESH` and performed a
mutable operating-system `dist-upgrade`. Consequently, chart-only and migration-only changes
produced new large image layers, invalidated BuildKit caches, and forced the production K3s node to
download hundreds of megabytes through the GHCR mirror.

The platform already pins base images, signs image digests with GitHub OIDC, scans published images,
and deploys immutable tag-and-digest references through one serialized Helm path. The release model
should preserve those guarantees while avoiding work unrelated to the changed component.

## Decision

Introduce a repository-owned component image planner for `web`, `runtime`, and `schema-runner`.

- Deployment, workflow, documentation, and repository-policy changes are image-neutral.
- Migration-only changes rebuild schema-runner.
- Application source, dependencies, templates, Docker inputs, and unknown files conservatively
  rebuild all components.
- Missing stable component channels force a bootstrap build.

Changed components publish commit tags with SBOM and provenance, pass Trivy, and receive Cosign
signatures. Unchanged components resolve from the last successfully deployed `*-stable` channel.
Before deployment, every selected channel is resolved to a digest and its GitHub OIDC signature is
verified. Helm receives only immutable `tag@sha256` references.

Stable component channels advance only after the atomic Helm release, workload rollouts, and
external readiness checks succeed. The Helm-owned `juanie-platform-release` ConfigMap records the
source revision and complete immutable image set. Helm history remains the rollback authority.

Remove run-specific OS mutation from image construction. Bun base security updates arrive as pinned
Docker digest changes through Dependabot and must pass the existing source and image vulnerability
gates. Web and long-lived services use Bun's pinned distroless variant so their final images expose
neither a shell nor a package manager. The ephemeral schema-runner retains the Debian tool surface
required to inspect heterogeneous user repositories; fixed security packages in that image are
version-pinned instead of applying a mutable distribution upgrade. Keep Bun as the build and runtime
engine for every component.

## Consequences

### Positive

- Chart-only releases build no images and transfer no new image layers.
- Migration-only releases build only schema-runner.
- Failed builds or deployments cannot advance stable component channels.
- Reused components retain their original signed digest and provenance.
- Base-image refreshes are explicit, reviewable, reproducible inputs instead of mutable build-time
  network state.
- Long-lived production images no longer carry Debian package-management or shell attack surfaces.
- Production exposes one machine-readable release manifest without introducing another deploy path.

### Negative

- Stable tags are mutable channel pointers, although production never deploys them without a digest
  and valid workflow signature.
- Shared or unknown source changes intentionally rebuild all components until dependency-graph
  precision justifies a narrower classification.
- A post-deploy channel-promotion failure leaves production healthy but makes the CI run fail; the
  next run will safely reuse the previous channel or rebuild a missing component.

### Neutral

- Quality and integration jobs continue to run for every change.
- Docker Buildx, GHCR, Cosign, Helm, and the domestic GHCR mirror remain the delivery toolchain.
- Dependabot's existing Docker ecosystem configuration becomes the source of base-image refreshes.

## Alternatives Considered

**Continue rebuilding every image with better cache settings**

Rejected because it still signs, scans, and resolves unrelated targets and cannot eliminate image
transfer when run-specific layers change.

**Use only path filters and deploy mutable tags**

Rejected because path filters alone do not provide a complete release set or immutable rollback
identity.

**Commit generated image digests back into Git**

Rejected because it creates self-triggering release commits and a second source of truth beside Helm
history.

**Adopt Bazel, Nix, or a remote build platform immediately**

Rejected because the current three-target repository does not justify the operational cost. The
planner is intentionally conservative and can later consume a richer dependency graph without
changing the release protocol.

## References

- Implementation plan: `docs/plans/2026-07-17-content-addressed-platform-images.md`
- Workflow: `.github/workflows/ci.yml`
- Image planner: `scripts/plan-platform-images.ts`
- Helm release manifest: `deploy/k8s/charts/juanie/templates/release-manifest.yaml`
