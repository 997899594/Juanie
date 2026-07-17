# Content-Addressed Platform Images Implementation Plan

**Goal:** Stop rebuilding and transferring unaffected Juanie platform images while preserving signed,
immutable production deployments.

**Architecture:** A repository-owned planner classifies each main-branch change into web, runtime,
and schema-runner targets. Changed targets publish signed commit tags; unchanged targets reuse the
last successfully deployed stable-channel digest. Helm always receives a complete set of
tag-and-digest references, and stable channels advance only after the atomic deployment succeeds.

**Tech Stack:** Bun, GitHub Actions, Docker Buildx, GHCR, Cosign, Helm, Kubernetes.

---

### Task 1: Define the image impact contract

**Files:**
- Create: `scripts/plan-platform-images.ts`
- Create: `scripts/__tests__/plan-platform-images.test.ts`

**Steps:**

1. Model the three platform targets as `web`, `runtime`, and `schema-runner`.
2. Treat migration-only changes as schema-runner changes.
3. Treat chart, workflow, documentation, and repository-policy changes as image-neutral.
4. Conservatively rebuild all targets for application source, dependency, Dockerfile, template, or
   unknown changes.
5. Emit deterministic JSON for GitHub Actions and human-readable reasons for CI summaries.
6. Verify the planner with Bun tests and TypeScript.

### Task 2: Make image construction reproducible

**Files:**
- Modify: `Dockerfile`
- Modify: `.dockerignore`

**Steps:**

1. Remove the run-specific `SECURITY_REFRESH` argument and mutable `apt dist-upgrade` layer.
2. Continue pinning the Bun base by digest and let Dependabot propose digest refreshes.
3. Exclude deployment and repository-only inputs from Docker build context.
4. Split runtime and schema-runner compilation stages so schema-only inputs do not rebuild every
   long-lived executable.
5. Preserve existing non-root users, immutable toolchain versions, and runtime smoke contracts.

### Task 3: Add component-aware CI planning and resolution

**Files:**
- Modify: `.github/workflows/ci.yml`

**Steps:**

1. Add a planning job with full Git history and planner JSON outputs.
2. Build, sign, and scan only targets present in the plan.
3. Resolve affected targets from commit tags and unaffected targets from stable tags.
4. Verify every selected digest with Cosign before deployment.
5. Keep the deploy job serialized and non-interruptible.
6. Promote stable component tags only after Helm, rollout, and external readiness succeed.

### Task 4: Persist the deployed release manifest

**Files:**
- Create: `deploy/k8s/charts/juanie/templates/release-manifest.yaml`
- Modify: `.github/workflows/ci.yml`

**Steps:**

1. Render source revision and the three immutable image references into a platform-owned ConfigMap.
2. Verify the rendered manifest in the production Helm contract.
3. Confirm Helm history remains the rollback authority and no second deployment path is introduced.

### Task 5: Verify and deploy

**Files:**
- Create: `docs/adr/0005-content-addressed-platform-image-releases.md`

**Steps:**

1. Run planner tests, typecheck, Biome, Helm lint, and production contract rendering.
2. Build all three targets locally or through CI and retain existing smoke checks.
3. Push to `main` and monitor CI through deployment.
4. Confirm the release manifest contains immutable digests and stable tags point at the deployed
   signed digests.
5. Push an image-neutral follow-up change and confirm no component image layers are rebuilt or
   transferred.
