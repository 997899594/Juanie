# Project Initialization Progress Persistence

## Status
✅ **RESOLVED** - Modern architecture confirmed, legacy code removed

## Problem Statement

### Current Issues
1. **Frontend progress not updating in real-time** - SSE subscription exists but event handling was incorrect (✅ FIXED)
2. **Sub-progress not shown** - Detailed step progress not displayed properly (✅ FIXED)
3. **Legacy database table exists** - `project_initialization_steps` table is leftover from old implementation (✅ REMOVED)

### Root Cause
Backend was correctly refactored to use BullMQ + Redis Pub/Sub (modern approach), but:
- Legacy database table `project_initialization_steps` was never removed
- This created confusion about which approach is correct

### Resolution
**Confirmed: Current BullMQ + Redis Pub/Sub approach is the modern best practice**

## Architecture Decision

### ✅ **FINAL DECISION: Pure Event-Driven (BullMQ + Redis Pub/Sub)**

**This is the modern, correct approach following project principles:**

1. **Use mature tools** - BullMQ provides built-in `job.updateProgress()`
2. **Don't reinvent the wheel** - No need for custom progress tracking table
3. **Use official solutions** - BullMQ + Redis Pub/Sub is the recommended pattern
4. **Separation of concerns**:
   - BullMQ: Task execution and progress tracking
   - Redis Pub/Sub: Real-time event broadcasting
   - PostgreSQL: Final project state only (not intermediate steps)

**Architecture:**
```
┌─────────────────────────────────────────────────────────────┐
│ BullMQ Worker (project-initialization.worker.ts)           │
│ - Executes initialization steps                             │
│ - Calls job.updateProgress(10, 50, 100)                    │
│ - BullMQ stores progress in Redis automatically            │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ ProjectInitializationService (initialization.service.ts)   │
│ - Publishes detailed events to Redis Pub/Sub               │
│ - Events include: progress, message, substep info          │
│ - No database writes for intermediate steps                │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Redis Pub/Sub (channel: project:{projectId})               │
│ - Broadcasts events to all subscribers                      │
│ - Events: { type, progress, message, substep, timestamp }  │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ tRPC SSE Endpoint (projects.onInitProgress)                │
│ - Subscribes to Redis channel                               │
│ - Streams events to frontend via Server-Sent Events        │
└─────────────────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────┐
│ Frontend (InitializationProgress.vue)                      │
│ - Subscribes to SSE stream                                  │
│ - Reconstructs step state from events (in-memory)          │
│ - Displays real-time progress                               │
└─────────────────────────────────────────────────────────────┘
```

**Why this is correct:**
- ✅ Follows project guide: "Use BullMQ built-in progress tracking"
- ✅ No custom progress table needed (don't reinvent the wheel)
- ✅ Real-time updates via Redis Pub/Sub (mature tool)
- ✅ Simpler: No database writes during initialization
- ✅ Scalable: Redis handles high-frequency updates better than PostgreSQL

**Trade-offs accepted:**
- ❌ No persistent audit trail of intermediate steps
- ❌ Page refresh loses in-progress state (acceptable - user can check final project status)
- ✅ Final project state (`status: 'active'|'failed'`) is persisted in `projects` table
- ✅ BullMQ job history provides debugging info if needed

### ❌ **REJECTED: Full Persistence (Database Table)**

**Why this was rejected:**
- ❌ Violates "don't reinvent the wheel" - BullMQ already tracks progress
- ❌ Adds unnecessary database writes during initialization
- ❌ More complex: Need to sync database + Redis events
- ❌ Not the official BullMQ pattern

## Requirements

### Backend Changes

#### 1. Update `ProjectInitializationService`
**File:** `packages/services/business/src/projects/initialization/initialization.service.ts`

**Changes:**
- Add method `createStep(projectId, step)` - Insert step record
- Add method `updateStep(projectId, step, status, progress, error?)` - Update step record
- Modify `executeStep()` to persist step state changes
- Modify `updateProgress()` to update step progress in database

**Step Lifecycle:**
```typescript
// Step starts
await this.createStep(ctx.projectId, {
  step: 'create_repository',
  status: 'running',
  progress: '0',
  startedAt: new Date(),
})

// Step progress updates
await this.updateStep(ctx.projectId, 'create_repository', {
  progress: '50',
})

// Step completes
await this.updateStep(ctx.projectId, 'create_repository', {
  status: 'completed',
  progress: '100',
  completedAt: new Date(),
})

// Step fails
await this.updateStep(ctx.projectId, 'create_repository', {
  status: 'failed',
  error: error.message,
  errorStack: error.stack,
  completedAt: new Date(),
})
```

#### 2. Add tRPC Endpoint
**File:** `apps/api-gateway/src/routers/projects.router.ts`

**New Endpoint:**
```typescript
// Get initialization steps from database
getInitializationSteps: this.trpc.protectedProcedure
  .input(projectIdSchema)
  .query(async ({ ctx, input }) => {
    // Check permission
    const organizationId = await getOrganizationIdFromProject(
      this.projectsService,
      input.projectId,
    )
    await checkPermission(
      this.rbacService,
      ctx.user.id,
      'read',
      'Project',
      organizationId,
      input.projectId,
    )
    
    // Query steps from database
    return await this.db
      .select()
      .from(schema.projectInitializationSteps)
      .where(eq(schema.projectInitializationSteps.projectId, input.projectId))
      .orderBy(schema.projectInitializationSteps.createdAt)
  })
```

### Frontend Changes

#### 1. Update `InitializationProgress.vue`
**File:** `apps/web/src/components/InitializationProgress.vue`

**Changes:**
- Remove `initializeSteps()` function (no longer needed)
- Add `fetchInitialSteps()` function to load from database
- Modify `onMounted()` to fetch initial state before subscribing
- Update event handler to merge database state + real-time events

**New Flow:**
```typescript
onMounted(async () => {
  if (props.projectId) {
    // 1. Fetch initial state from database
    await fetchInitialSteps()
    
    // 2. Fetch current project status
    await fetchCurrentStatus()
    
    // 3. Subscribe to real-time updates
    connectSubscription()
  }
})

async function fetchInitialSteps() {
  try {
    const dbSteps = await trpc.projects.getInitializationSteps.query({
      projectId: props.projectId!
    })
    
    // Convert database records to frontend format
    steps.value = dbSteps.map(dbStep => ({
      step: dbStep.step,
      status: dbStep.status as InitializationStep['status'],
      progress: dbStep.progress ? Number(dbStep.progress) : null,
      error: dbStep.error,
      startedAt: dbStep.startedAt?.toISOString() || null,
      completedAt: dbStep.completedAt?.toISOString() || null,
      duration: calculateDuration(dbStep.startedAt, dbStep.completedAt),
    }))
  } catch (error) {
    console.error('Failed to fetch initial steps:', error)
    // Fallback: initialize empty steps if database query fails
    steps.value = []
  }
}
```

## Acceptance Criteria

### Backend
- [ ] `ProjectInitializationService` persists steps to database
- [ ] Step records created with `status: 'pending'` at initialization start
- [ ] Step records updated to `status: 'running'` when step starts
- [ ] Step progress updated in database during execution
- [ ] Step records updated to `status: 'completed'` or `status: 'failed'` when done
- [ ] Error messages and stack traces persisted on failure
- [ ] Redis Pub/Sub events still published for real-time updates

### API
- [ ] New endpoint `projects.getInitializationSteps` returns steps from database
- [ ] Endpoint requires `read Project` permission
- [ ] Endpoint returns steps ordered by `createdAt`
- [ ] Existing SSE endpoint `projects.onInitProgress` continues to work

### Frontend
- [ ] Component fetches initial steps from database on mount
- [ ] Component subscribes to Redis events for real-time updates
- [ ] Progress updates in real-time during initialization
- [ ] Sub-progress (substep) displayed correctly
- [ ] Page refresh shows historical progress (from database)
- [ ] Completed/failed steps persist after page refresh

### Testing
- [ ] Create project → verify steps persisted to database
- [ ] Refresh page during initialization → verify progress restored
- [ ] Complete initialization → verify all steps marked `completed`
- [ ] Fail initialization → verify failed step has error message
- [ ] Query historical initialization → verify audit trail exists

## Technical Notes

### Database Schema
```sql
-- Already exists, no migration needed
CREATE TABLE project_initialization_steps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  step VARCHAR(100) NOT NULL,
  status VARCHAR(50) NOT NULL DEFAULT 'pending',
  progress VARCHAR(10) DEFAULT '0',
  error TEXT,
  error_stack TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX project_initialization_steps_project_id_idx ON project_initialization_steps(project_id);
CREATE INDEX project_initialization_steps_project_step_idx ON project_initialization_steps(project_id, step);
CREATE INDEX project_initialization_steps_status_idx ON project_initialization_steps(status);
```

### Step Names (from backend)
```typescript
const STEPS = [
  'resolve_credentials',  // 解析凭证
  'create_repository',    // 创建 Git 仓库
  'push_template',        // 推送项目模板
  'create_db_records',    // 创建数据库记录
  'setup_gitops',         // 配置 GitOps
  'finalize',             // 完成初始化
]
```

### Substeps (from backend)
```typescript
const SUBSTEPS = {
  create_repository: ['create_repo'],
  push_template: ['prepare_vars', 'render_template', 'push_files'],
  setup_gitops: ['create_gitops'],
}
```

## Implementation Plan

### Phase 1: Backend Persistence (Priority: HIGH)
1. Add database methods to `ProjectInitializationService`
2. Update `executeStep()` to persist state changes
3. Update `updateProgress()` to write to database
4. Test with manual project creation

### Phase 2: API Endpoint (Priority: HIGH)
1. Add `getInitializationSteps` endpoint to `projects.router.ts`
2. Add permission check
3. Test endpoint with existing projects

### Phase 3: Frontend Integration (Priority: HIGH)
1. Add `fetchInitialSteps()` to `InitializationProgress.vue`
2. Update `onMounted()` to fetch before subscribing
3. Test page refresh during initialization
4. Test completed initialization history

### Phase 4: Testing & Documentation (Priority: MEDIUM)
1. Write integration tests
2. Update troubleshooting docs
3. Add architecture documentation

## References

- Database Schema: `packages/database/src/schemas/project/project-initialization-steps.schema.ts`
- Backend Service: `packages/services/business/src/projects/initialization/initialization.service.ts`
- BullMQ Worker: `packages/services/business/src/queue/project-initialization.worker.ts`
- tRPC Router: `apps/api-gateway/src/routers/projects.router.ts`
- Frontend Component: `apps/web/src/components/InitializationProgress.vue`

## Decision Log

### 2025-01-XX: Architecture Decision
**Decision:** Implement full persistence (Option 1)

**Rationale:**
1. Database table already exists - someone designed it intentionally
2. Audit trail valuable for debugging production issues
3. Historical data important for analytics
4. Aligns with "Use mature tools" principle - PostgreSQL as source of truth
5. Page refresh should not lose user's progress visibility

**Trade-offs Accepted:**
- Additional database writes during initialization (acceptable overhead)
- Slightly more complex implementation (worth it for data integrity)

**Rejected Alternative:**
- Option 2 (Pure Event-Driven) rejected because it wastes existing schema design and loses valuable audit trail
