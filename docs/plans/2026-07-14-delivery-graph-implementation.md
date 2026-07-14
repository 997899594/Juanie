# Delivery Graph Implementation Plan

**Goal:** Make repository import accurately classify workloads, build-only artifacts, libraries and
external resources while keeping the default setup flow automatic.

**Architecture:** Add a pure Delivery Graph inference layer under the monorepo boundary. Existing
repository topology and project creation consume its workload projection, while the analysis API and
UI expose the complete summary. Managed CI is generated from the persisted graph.

**Tech Stack:** TypeScript, Bun, Next.js 16, Zod, Turborepo, Vitest/Bun test, GitLab CI.

---

### Task 1: Delivery Graph model and inference

**Status:** Completed

**Files:**
- Create: `src/lib/delivery-graph/model.ts`
- Create: `src/lib/delivery-graph/inference.ts`
- Create: `src/lib/delivery-graph/__tests__/inference.test.ts`
- Modify: `src/lib/monorepo/topology.ts`

**Verification:** A Fuser-shaped fixture yields two runtime apps, build-only outputs and libraries;
no library is projected as a service.

### Task 2: Repository analysis contract

**Status:** Completed

**Files:**
- Modify: `src/lib/monorepo/index.ts`
- Modify: `src/app/api/git/repositories/analyze/route.ts`
- Modify: `src/lib/projects/create-form-model.ts`

**Verification:** The API returns a versioned graph summary and service drafts only for workloads.

### Task 3: Simple import experience

**Status:** Completed

**Files:**
- Modify: `src/components/projects/use-create-project-form.ts`
- Modify: `src/components/projects/create-project-config-step.tsx`
- Modify: `src/components/projects/create-project-review-step.tsx`

**Verification:** Default import shows a compact detected topology summary; detailed service and
database editing remains under Advanced.

### Task 4: Persisted graph and managed CI

**Status:** Completed

**Files:**
- Modify: `src/lib/projects/create-project-service.ts`
- Modify: `src/lib/queue/project-init-activities.ts`
- Modify: `src/lib/projects/bootstrap/repository-automation.ts`
- Modify: `templates/ci/affected-workspace.mjs`

**Verification:** Project configuration persists the graph version and CI matrices contain workloads
and artifact targets without library workspaces.

### Task 5: Static runtime and external resources

**Status:** Completed

**Files:**
- Create: `templates/runtime/static-web.Dockerfile`
- Modify: `src/lib/projects/bootstrap/repository-automation.ts`
- Modify: `src/lib/config/parser.ts`
- Modify: `src/lib/databases/platform-support.ts`

**Verification:** A Vite app without `start` receives a managed static runtime; a detected proprietary
database remains an external binding and is never provisioned.

### Task 6: Full verification

**Status:** Completed

Run:

```bash
bun test src/lib/delivery-graph src/lib/monorepo
bun run typecheck
bunx biome check
bun run test
bun run build
```

Validate the analysis result against a read-only Fuser-shaped fixture and ensure no Fuser files are
modified.
