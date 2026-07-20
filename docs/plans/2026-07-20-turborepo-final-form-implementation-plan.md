# Turborepo Monorepo Final Form Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Make Turborepo selective builds dependency-correct, configuration-light, and efficiently packaged.

**Architecture:** A platform-owned CI workflow runs a pinned Turbo affected query over immutable base/head snapshots. The authenticated control plane validates the lineage and plans only declared affected workloads, with full-build fallback on every incomplete analysis path. Workspace discovery follows package-manager declarations and managed builds prune to the target dependency closure.

**Tech Stack:** Next.js 16, TypeScript, Zod, Bun tests, Bash, GitHub Actions, Turborepo 2.10.5, Docker BuildKit.

---

### Task 1: Authenticated Turbo analysis protocol

**Files:**
- Modify: `src/lib/releases/ci-identity.ts`
- Modify: `src/lib/releases/api-access.ts`
- Modify: `src/app/api/auth/ci/exchange/route.ts`
- Create: `src/app/api/build-runs/analysis/route.ts`
- Modify: `src/app/api/build-runs/route.ts`
- Modify: `src/lib/builds/service.ts`
- Modify: `src/lib/builds/plan.ts`
- Test: `src/lib/builds/__tests__/plan.test.ts`
- Test: `src/app/api/build-runs/__tests__/route.test.ts`

Steps: add failing lineage and fail-full tests; bind base SHA into the CI token; expose the
commit-scoped analysis policy; accept strict Turbo facts; remove Turbo path fallback; run focused
API and planner tests.

### Task 2: Platform CI native affected query

**Files:**
- Modify: `templates/ci/runtime/v1/build-run.sh`
- Modify: `.github/workflows/application-delivery.yml`
- Modify: `src/app/api/ci/source/archive/route.ts`
- Modify: `src/lib/ci/runtime-assets.ts`
- Test: `src/lib/ci/__tests__/runtime-assets.test.ts`
- Test: `src/releases/__tests__/ci-identity.test.ts`

Steps: add failing runtime contract tests; prepare policy before source download; materialize a
synthetic two-commit repository; execute pinned Turbo query; submit strict analysis facts; refresh
runtime digests; run runtime and identity tests.

### Task 3: Workspace-declaration discovery

**Files:**
- Modify: `src/lib/monorepo/topology.ts`
- Test: `src/lib/monorepo/__tests__/topology.test.ts`

Steps: add pnpm, npm/Yarn, nested, and negative-pattern tests; parse workspace declarations; add
bounded glob expansion through the provider reader; remove hard-coded directory scanning; run
topology tests.

### Task 4: Pruned managed packaging

**Files:**
- Modify: `src/lib/config/parser.ts`
- Modify: `src/lib/builds/managed-dockerfile.ts`
- Modify: `src/lib/builds/plan.ts`
- Modify: `src/lib/projects/bootstrap/repository-analysis.ts`
- Modify: `src/lib/monorepo/topology.ts`
- Test: `src/lib/config/__tests__/parser.test.ts`
- Test: `src/lib/builds/__tests__/managed-dockerfile.test.ts`
- Test: `src/lib/builds/__tests__/plan.test.ts`

Steps: add failing prune/deploy tests; reduce package strategies to executable choices; render
Turbo prune and pnpm deploy stages; force root build context for managed monorepos; run focused
tests.

### Task 5: Verification

Run `bun run lint`, `bun run typecheck`, focused monorepo/build/CI tests, then `bun run test` and
`bun run build`. Inspect the final diff for dead metadata, path-only Turbo fallbacks, generated
runtime digest drift, and unrelated changes.
