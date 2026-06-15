# AI-Native SDLC Platform Development Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build an AI-native SDLC control plane that turns goals into specs, orchestrates design and engineering agents, validates work through quality gates, records every decision, and hands ready changes to the delivery plane.

**Architecture:** The platform uses a durable workflow layer for long-running SDLC runs, an agent graph layer for multi-agent execution, a governed MCP gateway for tools, and a ledger for artifacts, decisions, approvals, and quality evidence. Juanie remains the delivery plane adapter rather than the whole SDLC platform.

**Tech Stack:** Next.js / TypeScript / PostgreSQL / Drizzle / Atlas / BullMQ or Temporal / LangGraph or OpenAI Agents SDK / Vercel AI SDK / MCP / Codex or Claude Code executor / OpenDesign or Claude Design adapter.

---

## Implementation Rules

- Do not implement a chat-first product.
- Do not let agents call tools directly; all tools go through Tool Broker / MCP Gateway.
- Do not store AI output as untyped blobs when it affects workflow decisions.
- Do not treat snapshots as decisions; decisions belong in the ledger.
- Do not bind the platform core to one model provider.
- Do not expand Juanie release AI runtime into the global SDLC orchestrator.

## Decision Gates

These choices require product / architecture approval before implementation.

### Decision 1: Workflow Backbone

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Temporal | Durable execution, retries, compensation, long approval waits, strong workflow history | New infra and worker model | Recommended for platform backbone |
| BullMQ only | Already used in Juanie, simple | Harder to model multi-day approvals, compensation, workflow history | Acceptable for prototype only |
| LangGraph only | Great for agent graph | Not ideal as enterprise long-running workflow backbone | Not recommended alone |

Decision needed: `Temporal` or `BullMQ prototype first`.

### Decision 2: Agent Graph Runtime

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| LangGraph | Explicit graph, loops, parallel branches, state accumulation, human-in-loop | Python/JS runtime integration work | Recommended for core agent graph |
| OpenAI Agents SDK | Handoffs, guardrails, tracing, sandbox and OpenAI tools | Less natural for full SDLC state topology | Use for specialist executors |
| Microsoft Agent Framework | Enterprise / Azure / .NET friendly | May overfit Microsoft ecosystem | Optional for Microsoft-heavy customers |

Decision needed: `LangGraph` as default agent graph or `OpenAI Agents SDK` first for speed.

### Decision 3: Product AI UI

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Vercel AI SDK | Best fit for Next.js streaming UI and lightweight tool loop | Not durable workflow backbone | Recommended for UI layer |
| Custom SSE only | More control, no dependency | More product plumbing | Keep for non-chat status streams |

Decision needed: whether to adopt `Vercel AI SDK` for new SDLC command surfaces.

### Decision 4: First Coding Executor

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Codex CLI / Cloud | Strong repo execution, MCP, sandbox/custom provider path | OpenAI ecosystem dependency | Recommended default candidate |
| Claude Code | Strong skills/subagents, good handoff with Claude Design | Anthropic ecosystem dependency | Strong parallel candidate |
| OpenHands | Open-source and self-hostable | More operations work, maturity check required | Self-hosted fallback candidate |
| GitHub Copilot Agent | GitHub-native issue to PR | Less platform control | Adapter for GitHub-heavy teams |

Decision needed: start with `Codex`, `Claude Code`, or both behind a common executor interface.

### Decision 5: First Design Runtime

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| OpenDesign | Local-first, open-source, BYOK, artifact-based | Needs POC for maturity | Recommended first POC |
| Claude Design | Advanced hosted UX, strong design handoff | Subscription / availability dependency | Hosted adapter |
| Figma MCP only | Connects existing design assets | Not full design runtime | Must integrate, not enough alone |

Decision needed: first design loop uses `OpenDesign` or `Claude Design adapter`.

### Decision 6: Skill Manifest Compatibility

| Option | Pros | Cons | Recommendation |
| --- | --- | --- | --- |
| Agent Skills-compatible | Aligns with Claude / Codex direction | Need mapping layer | Recommended |
| Fully custom manifest | Full control | Less ecosystem leverage | Use only for fields ecosystem lacks |

Decision needed: whether skill packages must be Agent Skills-compatible from day one.

## Phase 0: Architecture Baseline

### Task 0.1: Confirm Product Boundary

**Files:**
- Read: `docs/ai-native-sdlc-architecture.md`
- Read: `docs/current-architecture.md`
- Read: `docs/ai/2026-04-22-juanie-ai-architecture.md`
- Modify: `docs/current-architecture.md` only if Juanie boundary must be reflected

**Steps:**

1. Confirm Juanie is Delivery Plane, not global SDLC plane.
2. Confirm new SDLC concepts do not pollute existing release-first product navigation yet.
3. Write a short ADR section if the team agrees to add a new AI-SDLC platform layer.

**Acceptance:**

- Existing Juanie delivery architecture remains valid.
- New platform boundary is explicit.

## Phase 1: Foundation Control Plane

### Task 1.1: Add Core Domain Model

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `migrations/<timestamp>_ai_sdlc_foundation.sql`
- Create: `src/lib/ai-sdlc/types.ts`
- Create: `src/lib/ai-sdlc/status.ts`
- Test: `src/lib/ai-sdlc/__tests__/status.test.ts`

**Tables:**

```text
sdlcGoal
sdlcGoalSpec
sdlcAgentRun
sdlcAgentRunStep
sdlcContextSnapshot
sdlcArtifact
sdlcDecisionRecord
sdlcQualityGateRun
sdlcHumanApproval
```

**Minimum enums:**

```text
sdlcGoalStatus: draft, clarifying, spec_ready, approved, running, blocked, succeeded, failed, canceled
sdlcAgentRunStatus: queued, running, waiting_for_human, succeeded, failed, canceled
sdlcArtifactKind: spec, design, code_patch, test_report, review_report, release_report, decision, handoff
sdlcDecisionKind: routing, approval, quality_gate, tool_permission, release_readiness
```

**Acceptance:**

- Atlas migration validates.
- Drizzle schema exposes typed tables.
- Status transition tests cover invalid transitions.

### Task 1.2: Implement Goal Service

**Files:**
- Create: `src/lib/ai-sdlc/goals/service.ts`
- Create: `src/lib/ai-sdlc/goals/view.ts`
- Create: `src/lib/ai-sdlc/goals/__tests__/service.test.ts`
- Create: `src/app/api/sdlc/goals/route.ts`
- Create: `src/app/api/sdlc/goals/[goalId]/route.ts`

**Responsibilities:**

- Create goal.
- Update goal intent and constraints.
- Attach repository / project / environment references.
- Mark goal as ready for clarification or spec.

**Acceptance:**

- API requires session.
- Goal creation writes audit / decision seed.
- Tests cover scope and ownership.

### Task 1.3: Implement Spec and Approval Service

**Files:**
- Create: `src/lib/ai-sdlc/specs/service.ts`
- Create: `src/lib/ai-sdlc/specs/schema.ts`
- Create: `src/lib/ai-sdlc/approvals/service.ts`
- Test: `src/lib/ai-sdlc/specs/__tests__/service.test.ts`

**Spec shape:**

```typescript
interface GoalSpecDocument {
  summary: string;
  requirements: string[];
  constraints: string[];
  acceptanceCriteria: string[];
  risks: Array<{ level: 'low' | 'medium' | 'high'; description: string }>;
  affectedSurfaces: string[];
  testExpectations: string[];
  openQuestions: string[];
}
```

**Acceptance:**

- Spec is versioned.
- Approval records actor and approved spec version.
- Build cannot start unless required approval exists.

## Phase 2: Skill Registry and Context Snapshots

### Task 2.1: Implement Skill Package Registry

**Files:**
- Create: `src/lib/ai-sdlc/skills/manifest.ts`
- Create: `src/lib/ai-sdlc/skills/registry.ts`
- Create: `src/lib/ai-sdlc/skills/package-loader.ts`
- Test: `src/lib/ai-sdlc/skills/__tests__/registry.test.ts`

**Manifest fields:**

```typescript
interface SDLCSkillManifest {
  id: string;
  version: string;
  title: string;
  description: string;
  triggers: string[];
  inputs: unknown;
  outputs: unknown;
  tools: string[];
  permissions: Array<'read' | 'write' | 'dangerous'>;
  evals: string[];
}
```

**Acceptance:**

- Registry supports built-in skills.
- Workspace skills are disabled until explicit decision.
- Permissions are visible before execution.

### Task 2.2: Implement Context Snapshot Service

**Files:**
- Create: `src/lib/ai-sdlc/context/snapshot-service.ts`
- Create: `src/lib/ai-sdlc/context/source-resolvers.ts`
- Test: `src/lib/ai-sdlc/context/__tests__/snapshot-service.test.ts`

**Responsibilities:**

- Build context snapshot from goal, spec, repo metadata, project memory, and linked artifacts.
- Store immutable snapshot.
- Return snapshot IDs for agent runs.

**Acceptance:**

- Agent run stores exact context snapshot ID.
- Snapshot records source references and hashes.

## Phase 3: Workflow and Agent Graph

This phase depends on Decision 1 and Decision 2.

### Task 3.1: Define Orchestrator Interface

**Files:**
- Create: `src/lib/ai-sdlc/orchestration/types.ts`
- Create: `src/lib/ai-sdlc/orchestration/orchestrator.ts`
- Test: `src/lib/ai-sdlc/orchestration/__tests__/orchestrator.test.ts`

**Interface:**

```typescript
interface SDLCOrchestrator {
  startGoalRun(input: { goalId: string; actorUserId: string }): Promise<{ runId: string }>;
  resumeRun(input: { runId: string; signal: string; payload?: unknown }): Promise<void>;
  cancelRun(input: { runId: string; actorUserId: string }): Promise<void>;
}
```

**Acceptance:**

- UI/API does not depend on Temporal, BullMQ, LangGraph, or Agents SDK directly.

### Task 3.2: Implement Prototype Workflow

**Files if Temporal:**
- Create: `src/lib/ai-sdlc/orchestration/temporal/workflows.ts`
- Create: `src/lib/ai-sdlc/orchestration/temporal/activities.ts`
- Create: `src/lib/ai-sdlc/orchestration/temporal/client.ts`

**Files if BullMQ prototype:**
- Create: `src/lib/ai-sdlc/orchestration/bullmq/queue.ts`
- Create: `src/lib/ai-sdlc/orchestration/bullmq/worker.ts`

**Workflow states:**

```text
clarify -> spec -> approval -> build -> validate -> readiness -> learn
```

**Acceptance:**

- Run can pause for approval.
- Run can resume from approval.
- Run state is reflected in `sdlcAgentRun`.

### Task 3.3: Implement Engineering Subgraph Adapter

**Files:**
- Create: `src/lib/ai-sdlc/agents/engineering/types.ts`
- Create: `src/lib/ai-sdlc/agents/engineering/graph.ts`
- Create: `src/lib/ai-sdlc/agents/engineering/executor.ts`
- Test: `src/lib/ai-sdlc/agents/engineering/__tests__/graph.test.ts`

**Subgraph:**

```text
repo_mapper -> planner -> implementation -> tests -> reviewer -> repair_or_finish
```

**Acceptance:**

- Graph can run with mocked executor.
- Failed tests route to repair once.
- Repeated failure escalates to human review.

## Phase 4: Coding Executor Adapter

This phase depends on Decision 4.

### Task 4.1: Define Executor Contract

**Files:**
- Create: `src/lib/ai-sdlc/executors/types.ts`
- Create: `src/lib/ai-sdlc/executors/registry.ts`
- Test: `src/lib/ai-sdlc/executors/__tests__/registry.test.ts`

**Contract:**

```typescript
interface CodingExecutor {
  id: string;
  capabilities: string[];
  run(input: CodingExecutorInput): Promise<CodingExecutorResult>;
}
```

**Acceptance:**

- Executor selection is policy-driven.
- Agent graph does not import Codex / Claude Code directly.

### Task 4.2: Implement First Executor Adapter

**Files for Codex:**
- Create: `src/lib/ai-sdlc/executors/codex.ts`

**Files for Claude Code:**
- Create: `src/lib/ai-sdlc/executors/claude-code.ts`

**Files for OpenHands:**
- Create: `src/lib/ai-sdlc/executors/openhands.ts`

**Acceptance:**

- Executor runs in isolated workspace.
- Output contains patch summary, changed files, test command output, and artifacts.
- Tool calls are recorded in ledger.

## Phase 5: Tool Broker and MCP Gateway

### Task 5.1: Implement Tool Registry

**Files:**
- Create: `src/lib/ai-sdlc/tools/manifest.ts`
- Create: `src/lib/ai-sdlc/tools/registry.ts`
- Create: `src/lib/ai-sdlc/tools/policy.ts`
- Test: `src/lib/ai-sdlc/tools/__tests__/policy.test.ts`

**Acceptance:**

- Tool has scope, risk, input schema, output schema.
- Dangerous tools require approval.

### Task 5.2: Implement MCP Gateway Interface

**Files:**
- Create: `src/lib/ai-sdlc/mcp/types.ts`
- Create: `src/lib/ai-sdlc/mcp/gateway.ts`
- Create: `src/lib/ai-sdlc/mcp/transports.ts`
- Test: `src/lib/ai-sdlc/mcp/__tests__/gateway.test.ts`

**Acceptance:**

- stdio and Streamable HTTP are represented as transport types.
- Gateway validates tool permission before call.
- Tool invocation is recorded in `sdlcDecisionRecord` or dedicated invocation table.

## Phase 6: Quality Gate Engine

### Task 6.1: Implement Gate Registry

**Files:**
- Create: `src/lib/ai-sdlc/quality/types.ts`
- Create: `src/lib/ai-sdlc/quality/registry.ts`
- Create: `src/lib/ai-sdlc/quality/runner.ts`
- Test: `src/lib/ai-sdlc/quality/__tests__/runner.test.ts`

**Gate types:**

```text
deterministic
semantic
adversarial
runtime
```

**Acceptance:**

- Gate result is typed.
- Failed gate can return repair recommendation.
- Gate result is stored as artifact and decision record.

### Task 6.2: Add Deterministic Gate Adapter

**Files:**
- Create: `src/lib/ai-sdlc/quality/gates/command-gate.ts`
- Test: `src/lib/ai-sdlc/quality/gates/__tests__/command-gate.test.ts`

**Acceptance:**

- Runs configured commands in isolated workspace.
- Captures stdout/stderr exit code.
- Supports timeout.

### Task 6.3: Add LLM Judge Gate Adapter

**Files:**
- Create: `src/lib/ai-sdlc/quality/gates/llm-judge.ts`
- Create: `src/lib/ai-sdlc/quality/schemas/judge-verdict.ts`
- Test: `src/lib/ai-sdlc/quality/gates/__tests__/llm-judge.test.ts`

**Acceptance:**

- Judge output is structured.
- Low confidence routes to human review.
- Judge is never sole authority for dangerous action.

## Phase 7: Product Surfaces

This phase depends on Decision 3.

### Task 7.1: Add SDLC Command Center

**Files:**
- Create: `src/app/sdlc/page.tsx`
- Create: `src/lib/ai-sdlc/home/service.ts`
- Create: `src/components/sdlc/CommandCenterClient.tsx`
- Test: `src/lib/ai-sdlc/home/__tests__/service.test.ts`

**UI should show:**

- Draft goals
- Waiting specs
- Waiting approvals
- Running agent runs
- Failed gates
- Ready PRs
- Ready releases

**Acceptance:**

- First screen is workflow control, not marketing page or chat-only UI.

### Task 7.2: Add Goal Detail Timeline

**Files:**
- Create: `src/app/sdlc/goals/[goalId]/page.tsx`
- Create: `src/lib/ai-sdlc/goals/detail-view.ts`
- Create: `src/components/sdlc/GoalDetailClient.tsx`

**Acceptance:**

- Timeline shows spec, agent runs, artifacts, decisions, approvals, quality gates.

## Phase 8: Design Runtime

This phase depends on Decision 5.

### Task 8.1: Define Design Runtime Contract

**Files:**
- Create: `src/lib/ai-sdlc/design/types.ts`
- Create: `src/lib/ai-sdlc/design/runtime-registry.ts`
- Test: `src/lib/ai-sdlc/design/__tests__/runtime-registry.test.ts`

**Contract:**

```typescript
interface DesignRuntime {
  id: string;
  capabilities: string[];
  run(input: DesignRuntimeInput): Promise<DesignRuntimeResult>;
}
```

**Acceptance:**

- Platform can switch between OpenDesign, Claude Design, and Figma MCP-backed workflows.

### Task 8.2: Implement First Design Adapter

**Files for OpenDesign:**
- Create: `src/lib/ai-sdlc/design/opendesign.ts`

**Files for Claude Design:**
- Create: `src/lib/ai-sdlc/design/claude-design.ts`

**Files for Figma MCP:**
- Create: `src/lib/ai-sdlc/design/figma-mcp.ts`

**Acceptance:**

- Result contains design artifact references and handoff bundle.
- Visual QA gate can consume design artifact.

## Phase 9: Delivery Adapter

This phase integrates Juanie as a delivery plane. Do not integrate by importing Juanie internals
or reading the Juanie database directly. Use typed API, MCP, events, and artifact contracts.

### Task 9.1: Define Delivery Adapter Contract

**Files:**
- Create: `src/lib/ai-sdlc/delivery/types.ts`
- Create: `src/lib/ai-sdlc/delivery/registry.ts`
- Test: `src/lib/ai-sdlc/delivery/__tests__/registry.test.ts`

**Contract:**

```typescript
interface DeliveryAdapter {
  id: string;
  createPreview(input: DeliveryPreviewInput): Promise<DeliveryPreviewResult>;
  assessReleaseReadiness(input: ReleaseReadinessInput): Promise<ReleaseReadinessResult>;
  createRelease(input: CreateDeliveryReleaseInput): Promise<CreateDeliveryReleaseResult>;
}
```

**Acceptance:**

- Adapter contract is provider-neutral.
- Adapter never exposes Juanie-specific DB rows directly.
- Adapter result contains delivery correlation IDs for ledger and learning events.

### Task 9.2: Implement Juanie Delivery API Adapter

**Files:**
- Create: `src/lib/ai-sdlc/delivery/juanie-api.ts`
- Create: `src/lib/ai-sdlc/delivery/juanie-client.ts`
- Test: `src/lib/ai-sdlc/delivery/__tests__/juanie-api.test.ts`
- Modify only as needed: `src/lib/releases/*`
- Modify only as needed: `src/lib/environments/*`

**Juanie API capabilities:**

```text
listProjects
listEnvironments
createPreview
assessReleaseReadiness
createRelease
getReleaseStatus
getSchemaSafety
```

**Acceptance:**

- SDLC goal can request preview / readiness through adapter.
- Existing Juanie release state machine remains source of truth for delivery.
- No SDLC concepts leak into existing release code except adapter boundary.
- No direct Juanie DB access from AI-SDLC platform code.

### Task 9.3: Define Juanie MCP Server Contract

**Files:**
- Create: `docs/ai-sdlc/juanie-mcp-contract.md`
- Create: `src/lib/ai-sdlc/delivery/juanie-mcp-contract.ts`
- Test: `src/lib/ai-sdlc/delivery/__tests__/juanie-mcp-contract.test.ts`

**MCP tools:**

```text
list_projects
list_environments
get_environment
create_preview_environment
assess_release_readiness
create_release
get_release_status
get_schema_safety
```

**Dangerous tools for later phases:**

```text
promote_release
rollback_release
request_schema_repair
delete_preview_environment
```

**Acceptance:**

- Every MCP tool has input schema, output schema, risk level, and audit action.
- Dangerous tools are declared but disabled until approval and policy gates are implemented.
- AI agents can only access Juanie through MCP Gateway, not direct MCP client calls.

### Task 9.4: Implement Delivery Event Ingestion

**Files:**
- Create: `src/lib/ai-sdlc/delivery/events.ts`
- Create: `src/lib/ai-sdlc/delivery/event-ingestion.ts`
- Create: `src/app/api/sdlc/delivery/events/route.ts`
- Test: `src/lib/ai-sdlc/delivery/__tests__/event-ingestion.test.ts`

**Events:**

```text
delivery.preview.created
delivery.release.created
delivery.release.readiness_completed
delivery.release.failed
delivery.release.succeeded
delivery.rollout.paused
delivery.rollout.promoted
delivery.schema_gate.blocked
delivery.schema_gate.passed
```

**Acceptance:**

- Events are idempotent by `eventId`.
- Events include `correlationId` or `traceId`.
- Events update goal ledger and can emit learning events.

### Task 9.5: Implement Delivery Artifact Contract

**Files:**
- Create: `src/lib/ai-sdlc/delivery/artifact-contract.ts`
- Create: `src/lib/ai-sdlc/delivery/artifact-ingestion.ts`
- Test: `src/lib/ai-sdlc/delivery/__tests__/artifact-contract.test.ts`

**Contract fields:**

```typescript
interface DeliveryArtifactEvidence {
  sourceRepository: string;
  sourceRef: string;
  sourceCommitSha: string;
  sourceServiceId: string | null;
  imageUri: string | null;
  imageDigest: string | null;
  imagePlatform: string | null;
  buildProvenanceRef: string | null;
  testReportRefs: string[];
  readinessReportRef: string | null;
  schemaSafetySnapshotRef: string | null;
  juanieReleaseId: string | null;
  juanieEnvironmentId: string | null;
}
```

**Acceptance:**

- Delivery evidence is stored as immutable artifact.
- Release readiness and learning loop can reference delivery evidence.
- Image digest / source service provenance is preserved when Juanie provides it.

## Phase 10: Learning Loop

### Task 10.1: Add Learning Event Model

**Files:**
- Modify: `src/lib/db/schema.ts`
- Create: `src/lib/ai-sdlc/learning/service.ts`
- Test: `src/lib/ai-sdlc/learning/__tests__/service.test.ts`

**Learning event examples:**

- `skill_succeeded`
- `skill_failed`
- `gate_false_positive`
- `gate_false_negative`
- `context_missing`
- `repair_succeeded`
- `human_overrode_agent`

**Acceptance:**

- Goal completion produces learning events.
- Learning events are queryable by skill, executor, gate, and failure class.

### Task 10.2: Generate Eval Candidates

**Files:**
- Create: `src/lib/ai-sdlc/learning/eval-candidates.ts`
- Test: `src/lib/ai-sdlc/learning/__tests__/eval-candidates.test.ts`

**Acceptance:**

- Failed or manually overridden runs can produce eval candidates.
- Eval candidate references artifacts and context snapshots.

## Verification Commands

Run after schema or service changes:

```bash
bun run db:validate
bun run typecheck
bun run lint
bun run test
```

For focused development:

```bash
bun test src/lib/ai-sdlc
```

## Exit Criteria

MVP is complete when:

- User can create an SDLC goal.
- User can approve a generated or manually written spec.
- Platform can create an agent run with immutable context snapshot.
- Engineering subgraph can run with a mock executor.
- First real coding executor can produce a patch in isolated workspace.
- Quality gates can pass/fail and store typed results.
- Goal detail shows timeline, artifacts, decisions, and approvals.
- Juanie delivery adapter can assess release readiness without taking over global orchestration.
