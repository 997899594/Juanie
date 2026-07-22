# Restate Operator Migration Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move Juanie's Restate handlers to immutable, automatically drained Kubernetes revisions
without adding any child-project configuration.

**Architecture:** Install the official Restate Operator `2.8.1` from a checksum-pinned OCI chart and
manage handler pods with `RestateDeployment`. Migrate in two production releases: first run the
operator-managed revision beside the existing endpoint so old invocations remain pinned; after the
legacy Restate deployment drains, remove the native Deployment, stable Service, and direct
registration Job. Restate registration and version garbage collection become Operator-owned.

**Tech Stack:** Restate Operator, Restate OSS 1.7.2, Kubernetes CRDs, Helm, GitHub Actions, Bun

---

### Task 1: Pin and install the Restate Operator

**Files:**
- Modify: `.github/workflows/ci.yml`

1. Pin chart version `2.8.1`, OCI digest, downloaded chart SHA-256, and operator image digest.
2. Pull the chart on the production server and verify its archive checksum.
3. Apply the bundled CRDs server-side so upgrades converge CRD schemas.
4. Install or upgrade the operator with `installCrds=false`, then verify its rollout and image digest.

### Task 2: Introduce an immutable handler revision beside the legacy endpoint

**Files:**
- Modify: `deploy/k8s/charts/juanie/values.yaml`
- Modify: `deploy/k8s/charts/juanie/values-prod.yaml`
- Modify: `deploy/k8s/charts/juanie/templates/restate.yaml`
- Modify: `deploy/k8s/charts/juanie/templates/network-policy.yaml`

1. Add production-only Operator configuration and a `RestateDeployment` using the runtime image.
2. Register through the existing `juanie-restate` admin Service.
3. Give legacy and Operator pods disjoint labels so the legacy stable Service never mixes revisions.
4. Disable the direct registration Job when Operator mode is enabled.
5. Allow only the Restate Operator pod to reach the Restate admin API.
6. Give both generations a dedicated handler role label for invocation ingress without overlapping the
   immutable selector of the existing native Deployment.

### Task 3: Add release gates and chart tests

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `tests/helm/secret-rendering.test.ts`

1. Assert production renders one `RestateDeployment` and no direct registration Job.
2. Assert local development retains the direct registration path.
3. Wait for the CR's `Ready` condition during production deployment.
4. Require Operator ownership in every production render.
5. Verify the complete eight-service catalog exists in Restate before the CI release succeeds.

### Task 4: Deploy and drain the legacy Restate deployment

1. Run full lint, typecheck, tests, build, and Helm validation.
2. Commit and push the Operator bootstrap release.
3. Follow CI through Operator installation and `RestateDeployment` readiness.
4. Confirm Restate has a new immutable deployment with all eight services.
5. Confirm the legacy deployment has no pinned or active invocations.

### Task 5: Remove the legacy path and harden health

**Files:**
- Modify: `deploy/k8s/charts/juanie/templates/restate.yaml`
- Modify: `deploy/k8s/charts/juanie/values.yaml`
- Modify: `deploy/k8s/charts/juanie/templates/production-readiness.yaml`
- Modify: `.github/workflows/ci.yml`
- Modify: `src/lib/health/dependency-checks.ts`
- Create: `src/lib/restate/service-catalog.ts`
- Test: `src/lib/restate/__tests__/service-catalog.test.ts`

1. Remove the native handler Deployment, stable Service, direct registration Job, curl image, and
   obsolete registration URL.
2. Make full health verify all expected Restate services while readiness remains connectivity-only.
3. Make GitHub App delivery capability failures return unhealthy/503.
4. Run full verification, commit, push, and verify the second production rollout.

### Task 6: Recover the lost NexusNote delivery

1. Redeliver the failed GitHub webhook after the immutable workflow is live.
2. Verify one provider delivery creates one `sourceDelivery`, one outbox command, and one build run.
3. Confirm the obsolete `https://undefined/api/webhooks/git` webhook is absent.
