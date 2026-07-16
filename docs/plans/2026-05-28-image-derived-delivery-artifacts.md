# Image-Derived Delivery Artifacts

## Current State

Juanie already separates deployable artifacts from customer delivery artifacts:

- `kind=image` artifacts are tied to services and are used for deployments.
- `kind=package | baremetal | archive` artifacts are shown as customer downloads.
- The download gateway only manages `s3://` artifact URIs and signs short-lived download URLs.

The weak point is the production path that creates customer artifacts. The current monorepo CI
template checks out source, installs dependencies, runs a deliverable build command, uploads a
GitHub/GitLab CI artifact, and registers that external URL with Juanie. The single-repo template has
no deliverable path at all.

That creates three problems:

- The customer artifact is not proven to come from the image that was actually deployed and verified.
- Download permissions and audit are bypassed when the URI points at GitHub/GitLab instead of
  Juanie-managed object storage.
- Single-repo and monorepo projects have different delivery capabilities.

## Decision

Use the verified image digest as the source of truth for customer artifacts.

Juanie will support one canonical delivery path:

1. CI builds and pushes service images.
2. CI resolves immutable image digests and creates a Juanie release with deployable image artifacts.
3. CI waits for the release resolution.
4. For every configured deliverable, CI pulls the source service image by digest.
5. CI extracts declared paths from that image, runs optional artifact checks against the extracted
   staging directory, packages the result, uploads it through a Juanie-issued signed upload URL, and
   appends the artifact to the same release.
6. Users download only through Juanie signed download URLs.

This removes the old source-rebuild delivery path. `deliverables[].variants[].build` is no longer the
delivery contract. The contract is `source.service + variant.extract`.

## Configuration Contract

Example:

```yaml
deliverables:
  - name: nexusnote-worker
    type: baremetal
    source:
      service: worker
    variants:
      - name: linux-amd64
        platform: linux/amd64
        extract:
          from: /app/dist
          to: .
        package:
          format: tar.gz
        checks:
          - command: test -f package.json
```

Rules:

- Every deliverable must declare `source.service`.
- Every variant must declare `extract.from`.
- `extract.to` defaults to `.`.
- `platform` uses OCI platform syntax such as `linux/amd64`, `linux/arm64`, or `any`.
- `package.format` supports `tgz`, `tar.gz`, and `zip` for downloadable files. `directory` remains a
  parsed format for manifest compatibility but CI upload requires an archive.
- Checks run after extraction with `JUANIE_ARTIFACT_STAGE` pointing at the staged artifact directory.

## Data Model

Delivery artifacts keep their customer-facing metadata and additionally record provenance:

- `sourceServiceId`: service that produced the verified image.
- `sourceImageUri`: tag or repository reference used by CI.
- `sourceImageDigest`: immutable digest used for extraction.
- `sourceImagePlatform`: OCI platform extracted for this variant.

Deployable image artifacts continue to use `serviceId`, `imageUrl`, and `imageDigest`.

## API Contract

Two platform APIs close the loop:

- `POST /api/artifacts/uploads`
  - Authenticates the Git provider token with the same repository access check used by release
    creation.
  - Returns a signed PUT URL and a managed `s3://` URI.
  - Requires `ARTIFACT_STORAGE_BUCKET` and the existing S3-compatible storage settings.
- `POST /api/releases/[releaseId]/artifacts`
  - Authenticates the Git provider token.
  - Appends delivery artifacts to an existing release instead of creating a second release.
  - Resolves `sourceService` to `sourceServiceId`.

## CI Contract

CI templates must not receive object storage credentials. They only receive signed upload URLs from
Juanie. That keeps S3/MinIO/R2 access centralized in the platform.

CI must fail loudly when:

- The source service image is missing.
- The digest cannot be resolved.
- A configured extract path is absent from the image.
- The managed upload URL cannot be created.
- The artifact registration API rejects the metadata.

## Rollout Plan

1. Update parser, rendering, and tests to make image extraction the only active deliverable model.
2. Add release artifact provenance columns through Atlas migration.
3. Add signed upload and append-artifact APIs.
4. Update GitHub/GitLab single-repo and monorepo CI templates.
5. Update generated `juanie.yml` examples so new imports do not learn the old path.
6. Apply the new manifest to NexusNote only after Juanie CI and tests pass.

## Non-Goals

- Do not introduce Bytebase or database governance into artifact delivery.
- Do not push object storage credentials into child repositories.
- Do not keep the old source-rebuild delivery path as a second active path.
