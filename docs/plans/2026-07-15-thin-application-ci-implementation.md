# Thin Application CI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make `juanie.yml` the only user-maintained child-application configuration while moving all CI implementation into a versioned Juanie runtime.

**Architecture:** The control plane reads and validates configuration at the OIDC-bound commit, then computes a build and delivery plan from checkout facts supplied by CI. GitHub and GitLab keep only provider bootstrap files and execute centrally owned runtime assets pinned to the deployed Juanie revision.

**Tech Stack:** Next.js 16 route handlers, TypeScript, Bun, GitHub reusable workflows, GitLab CI Components, Bash, Zod/YAML, Drizzle and Atlas.

---

### Task 1: Commit-scoped configuration loading

**Files:**
- Create: `src/lib/projects/repository-config.ts`
- Create: `src/lib/projects/__tests__/repository-config.test.ts`
- Modify: `src/lib/services/runtime-contract.ts`

**Steps:**
1. Add tests proving only `juanie.yml` at the exact commit is accepted.
2. Add a loader that resolves the team binding, fetches the file, validates it and computes SHA-256.
3. Replace permissive runtime-contract loading with the shared strict loader.
4. Run the repository-config and runtime-contract tests.

### Task 2: Server-owned affected build plan

**Files:**
- Modify: `src/lib/builds/plan.ts`
- Modify: `src/lib/builds/service.ts`
- Modify: `src/app/api/build-runs/route.ts`
- Modify: `src/lib/builds/__tests__/plan.test.ts`

**Steps:**
1. Add tests for path, global-input, Turborepo package and forced-full selection.
2. Extend build plans with config lineage and selected deliverables.
3. Accept checkout facts instead of client-selected service and target names.
4. Load the exact commit config before creating or replaying a build run.
5. Run build-plan and build-service tests.

### Task 3: Ephemeral managed Dockerfiles

**Files:**
- Create: `src/lib/builds/managed-dockerfile.ts`
- Create: `src/lib/builds/__tests__/managed-dockerfile.test.ts`
- Modify: `src/lib/config/parser.ts`
- Modify: `templates/ci/build-run.sh`

**Steps:**
1. Add a first-class `managed` build strategy and rendering tests.
2. Put generated Dockerfile content in the immutable build unit.
3. Materialize it only inside CI state before invoking BuildKit.
4. Run parser, build-plan and shell syntax tests.

### Task 4: Versioned runtime and provider coordinators

**Files:**
- Create: `.github/workflows/application-delivery.yml`
- Create: `templates/ci/runtime/v1/changes.mjs`
- Move: `templates/ci/{build-run.sh,delivery-artifacts.sh,workload-identity.sh}` to `templates/ci/runtime/v1/`
- Create: `templates/ci/gitlab-component-v1.yml`
- Create: `src/app/api/ci/runtime/v1/[asset]/route.ts`
- Create: `src/app/api/ci/components/gitlab/v1/route.ts`
- Create: `src/lib/ci/runtime-assets.ts`

**Steps:**
1. Add asset allowlist, content type and component integrity tests.
2. Implement public immutable runtime asset endpoints.
3. Implement the reusable workflow and GitLab Component against temporary CI state.
4. Validate workflow YAML, component YAML and every shell script.

### Task 5: Thin repository bootstrap

**Files:**
- Modify: `src/lib/projects/bootstrap/repository-automation.ts`
- Modify: `src/lib/queue/project-init-activities.ts`
- Modify: `src/lib/queue/project-delete.ts`
- Modify: `src/lib/queue/__tests__/project-init-rendering.test.ts`
- Replace: `templates/ci/github-actions.yml`
- Replace: `templates/ci/gitlab-ci.yml`
- Delete: `templates/ci/github-actions-monorepo.yml`
- Delete: `templates/ci/gitlab-ci-monorepo.yml`

**Steps:**
1. Add tests asserting the exact minimal file set for GitHub and GitLab.
2. Render one generic provider bootstrap independent of repository topology.
3. Stop injecting runtime scripts, docs, env examples and generated runtime files.
4. Preserve unrelated GitLab pipeline content through an explicit managed include block.
5. Run project initialization and deletion tests.

### Task 6: Platform revision wiring and verification

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `deploy/k8s/charts/juanie/values.yaml`
- Modify: `deploy/k8s/charts/juanie/templates/deployment.yaml`
- Modify: `deploy/k8s/charts/juanie/templates/production-readiness.yaml`
- Modify: `.env.example`
- Modify: `README.md`

**Steps:**
1. Pass the source repository and commit SHA automatically from platform CI into Helm.
2. Require an immutable revision in production readiness checks.
3. Run focused tests, Biome, TypeScript, full Bun tests and production build.
4. Run Atlas validation, Helm lint/render and generated GitHub/GitLab contract checks.
