# Business Layer Architecture

**Last Updated**: December 26, 2024  
**Status**: Post-Migration (Upstream Tools)

## Overview

The Business layer (`@juanie/service-business`) contains domain-specific business logic for the AI DevOps platform. After the upstream tools migration, this layer has been significantly simplified by removing duplicate implementations and unnecessary abstractions.

## Architecture Principles

### 1. Direct Dependency on Core Layer

The Business layer directly uses Core layer services without creating wrapper abstractions:

```
Business Layer → Core Layer → Upstream SDKs
```

**Benefits**:
- Reduced code duplication
- Better type safety
- Easier maintenance
- Clearer dependency chain

### 2. Minimal Abstraction

Only create abstractions when adding clear business value:

- ✅ **Do**: Add business logic, validation, orchestration
- ❌ **Don't**: Wrap SDK calls without adding value
- ❌ **Don't**: Create custom implementations of SDK features

### 3. Use Upstream Features

Leverage built-in features from upstream tools:

- **BullMQ**: Job events, progress tracking, retry logic
- **EventEmitter2**: Event emission, wildcards, async handling
- **Drizzle ORM**: Relation queries, transactions, type inference
- **Flux CLI**: Resource creation, reconciliation, health checks

## Module Structure

```
packages/services/business/src/
├── projects/              # Project management
│   ├── core/             # Core project operations
│   ├── initialization/   # Project initialization (simplified)
│   └── members/          # Project member management
├── deployments/          # Deployment management
├── environments/         # Environment management
├── gitops/              # GitOps operations (simplified)
│   ├── git-sync/        # Git synchronization
│   └── webhooks/        # Webhook handling
└── queue/               # Queue workers (simplified)
```

## Key Services

### GitSyncService

**Purpose**: Synchronize Git repositories with Flux CD

**Dependencies**:
- `FluxCliService` (Core) - Direct Flux CLI operations
- `K8sClientService` (Core) - Kubernetes resource management
- `EventEmitter2` - Event emission

**Pattern**:
```typescript
@Injectable()
export class GitSyncService {
  constructor(
    private readonly fluxCli: FluxCliService,      // ✅ Direct Core usage
    private readonly k8sClient: K8sClientService,  // ✅ Direct Core usage
    private readonly eventEmitter: EventEmitter2,  // ✅ Direct usage
  ) {}

  async syncRepository(options: SyncOptions) {
    // Direct Flux CLI usage - no wrapper
    await this.fluxCli.createGitRepository({
      name: `project-${options.projectId}`,
      namespace: options.namespace,
      url: options.repoUrl,
      branch: options.branch
    })

    // Direct event emission - no publisher wrapper
    this.eventEmitter.emit(DomainEvents.GIT_SYNC_COMPLETED, {
      projectId: options.projectId,
      repoUrl: options.repoUrl
    })
  }
}
```

**Changes from Migration**:
- ❌ Removed: Custom Flux wrapper services
- ❌ Removed: Custom event publisher
- ✅ Added: Direct Core service usage

### ProjectInitializationWorker

**Purpose**: Handle asynchronous project initialization

**Dependencies**:
- `InitializationService` - Business logic
- `BullMQ` - Job processing

**Pattern**:
```typescript
@Processor('project-initialization')
export class ProjectInitializationWorker extends WorkerHost {
  async process(job: Job<InitJobData>) {
    // ✅ Use BullMQ built-in progress tracking
    await job.updateProgress(10)
    await this.initService.createGitRepository(job.data.projectId)

    await job.updateProgress(50)
    await this.initService.setupFlux(job.data.projectId)

    await job.updateProgress(100)
  }

  // ✅ Use BullMQ built-in events
  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.info({ jobId: job.id }, 'Job completed')
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, error: Error) {
    this.logger.error({ jobId: job.id, error }, 'Job failed')
  }
}
```

**Changes from Migration**:
- ❌ Removed: Custom orchestrator service
- ❌ Removed: Custom progress tracker
- ✅ Added: BullMQ built-in features

### ProjectsService

**Purpose**: Core project CRUD operations

**Dependencies**:
- `DatabaseClient` - Database operations
- `EventEmitter2` - Event emission

**Pattern**:
```typescript
@Injectable()
export class ProjectsService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createProject(data: NewProject) {
    // ✅ Use Drizzle ORM transaction
    return this.db.transaction(async (tx) => {
      const [project] = await tx.insert(schema.projects).values(data).returning()

      // ✅ Direct event emission
      this.eventEmitter.emit(DomainEvents.PROJECT_CREATED, {
        projectId: project.id,
        userId: data.userId
      })

      return project
    })
  }

  async getProjectWithDetails(projectId: string) {
    // ✅ Use Drizzle relation queries
    return this.db.query.projects.findFirst({
      where: eq(schema.projects.id, projectId),
      with: {
        environments: {
          with: {
            deployments: true
          }
        },
        team: true,
        organization: true
      }
    })
  }

  // ✅ Direct event listener
  @OnEvent(DomainEvents.PROJECT_CREATED)
  async handleProjectCreated(payload: ProjectCreatedEvent) {
    // Trigger initialization
    await this.queueService.addInitializationJob(payload)
  }
}
```

**Changes from Migration**:
- ✅ Validated: Already using Drizzle ORM correctly
- ✅ Added: Direct EventEmitter2 usage
- ❌ Removed: Custom event publisher

## Dependency Graph

### Before Migration

```
┌─────────────────────────────────────────┐
│         Business Layer                   │
│  ┌────────────────────────────────────┐ │
│  │ Custom Flux Wrappers               │ │
│  │  - flux.service.ts                 │ │
│  │  - flux-resources.service.ts       │ │
│  │  - flux-watcher.service.ts         │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ Custom Orchestrators               │ │
│  │  - orchestrator.service.ts         │ │
│  │  - progress-tracker.ts             │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ Custom Event Publishers            │ │
│  │  - project-event-publisher.ts      │ │
│  │  - git-sync-event-publisher.ts     │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Core Layer                       │
│  - FluxCliService                        │
│  - K8sClientService                      │
│  - QueueModule                           │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Upstream SDKs                    │
│  - Flux CLI                              │
│  - @kubernetes/client-node               │
│  - BullMQ                                │
└─────────────────────────────────────────┘
```

### After Migration

```
┌─────────────────────────────────────────┐
│         Business Layer                   │
│  ┌────────────────────────────────────┐ │
│  │ GitSyncService                     │ │
│  │  → FluxCliService (Core)           │ │
│  │  → K8sClientService (Core)         │ │
│  │  → EventEmitter2 (direct)          │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ ProjectInitializationWorker        │ │
│  │  → BullMQ (direct)                 │ │
│  │  → job.updateProgress() (built-in) │ │
│  │  → @OnWorkerEvent (built-in)       │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ ProjectsService                    │ │
│  │  → DatabaseClient (Core)           │ │
│  │  → EventEmitter2 (direct)          │ │
│  │  → Drizzle ORM (direct)            │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Core Layer                       │
│  - FluxCliService                        │
│  - K8sClientService                      │
│  - DatabaseClient                        │
│  - QueueModule                           │
└─────────────────────────────────────────┘
                  ↓
┌─────────────────────────────────────────┐
│         Upstream SDKs                    │
│  - Flux CLI                              │
│  - @kubernetes/client-node               │
│  - Drizzle ORM                           │
│  - BullMQ                                │
│  - EventEmitter2                         │
└─────────────────────────────────────────┘
```

**Key Changes**:
- ✅ Removed abstraction layers
- ✅ Direct Core service usage
- ✅ Direct upstream SDK usage where appropriate
- ✅ Simplified dependency chain

## Design Patterns

### 1. Direct Service Injection

**Pattern**: Inject Core services directly, don't wrap them

```typescript
// ✅ Good: Direct injection
@Injectable()
export class GitSyncService {
  constructor(
    private readonly fluxCli: FluxCliService,  // Core service
  ) {}
}

// ❌ Bad: Unnecessary wrapper
@Injectable()
export class BusinessFluxService {
  constructor(private readonly coreFlux: FluxCliService) {}
  
  async createGitRepository() {
    // Just forwarding to Core - no value added
    return this.coreFlux.createGitRepository()
  }
}
```

### 2. Built-in Feature Usage

**Pattern**: Use SDK/library built-in features instead of custom implementations

```typescript
// ✅ Good: BullMQ built-in progress
async process(job: Job) {
  await job.updateProgress(50)
}

// ❌ Bad: Custom progress tracker
class ProgressTracker {
  async update(progress: number) {
    // Custom implementation duplicating BullMQ
  }
}
```

### 3. Direct Event Emission

**Pattern**: Use EventEmitter2 directly, don't create publisher wrappers

```typescript
// ✅ Good: Direct emission
this.eventEmitter.emit(DomainEvents.PROJECT_CREATED, payload)

// ❌ Bad: Unnecessary publisher wrapper
class ProjectEventPublisher {
  async publishProjectCreated(payload: any) {
    await this.eventEmitter.emit('project.created', payload)
  }
}
```

### 4. SDK Error Preservation

**Pattern**: Preserve original SDK errors, only wrap when adding business context

```typescript
// ✅ Good: Preserve original error
try {
  await githubClient.repos.get({ owner, repo })
} catch (error) {
  if (error instanceof RequestError && error.status === 404) {
    throw ErrorFactory.notFound('Repository not found', { cause: error })
  }
  throw error  // Preserve other errors
}

// ❌ Bad: Lose original error information
try {
  await githubClient.repos.get({ owner, repo })
} catch (error) {
  throw new CustomError('GitHub API failed')  // Lost details
}
```

## Module Dependencies

### Internal Dependencies

```
Business Layer Modules:
├── projects/
│   ├── Depends on: Core (Database, Queue, Events)
│   └── Provides: Project CRUD, Initialization
├── deployments/
│   ├── Depends on: Core (Database, Events), projects/
│   └── Provides: Deployment management
├── environments/
│   ├── Depends on: Core (Database, Events), projects/
│   └── Provides: Environment management
└── gitops/
    ├── Depends on: Core (Flux, K8s, Events), projects/
    └── Provides: Git sync, Flux management
```

### External Dependencies

```
Core Layer:
├── @juanie/core/flux → FluxCliService
├── @juanie/core/k8s → K8sClientService
├── @juanie/core/database → DatabaseClient
├── @juanie/core/queue → QueueModule
└── @juanie/core/events → Event constants

Upstream SDKs:
├── @nestjs/event-emitter → EventEmitter2
├── @nestjs/bullmq → BullMQ decorators
├── drizzle-orm → Database operations
└── nestjs-pino → Logging
```

## Best Practices

### 1. Service Design

- ✅ **Do**: Focus on business logic
- ✅ **Do**: Use Core services directly
- ✅ **Do**: Emit domain events
- ❌ **Don't**: Wrap Core services without adding value
- ❌ **Don't**: Duplicate SDK functionality

### 2. Error Handling

- ✅ **Do**: Use SDK error types
- ✅ **Do**: Preserve original errors with `cause`
- ✅ **Do**: Add business context when wrapping
- ❌ **Don't**: Create custom error classification
- ❌ **Don't**: Lose original error information

### 3. Event Handling

- ✅ **Do**: Use EventEmitter2 directly
- ✅ **Do**: Use domain event constants
- ✅ **Do**: Use `@OnEvent` decorator
- ❌ **Don't**: Create event publisher wrappers
- ❌ **Don't**: Duplicate BullMQ job events

### 4. Database Operations

- ✅ **Do**: Use Drizzle relation queries
- ✅ **Do**: Use `db.transaction()` for transactions
- ✅ **Do**: Leverage type inference
- ❌ **Don't**: Write raw SQL when Drizzle provides equivalent
- ❌ **Don't**: Manually manage transactions

## Migration Impact

### Code Reduction

- **Total Lines Removed**: ~2,050 lines
- **Files Deleted**: 6 files
- **Code Reduction**: 37% in affected areas

### Quality Improvements

- ✅ **Type Safety**: Better type inference from SDKs
- ✅ **Maintainability**: Fewer lines to maintain
- ✅ **Clarity**: Clearer dependency chain
- ✅ **Performance**: Fewer function call layers

### Architecture Simplification

- **Before**: 4 layers (Business → Wrappers → Core → SDKs)
- **After**: 3 layers (Business → Core → SDKs)
- **Benefit**: Reduced complexity, better performance

## Future Considerations

### When to Add Abstractions

Only create abstractions when:

1. **Adding Business Logic**: Validation, orchestration, domain rules
2. **Combining Multiple SDKs**: Coordinating multiple services
3. **Adding Retry Logic**: Business-specific retry strategies
4. **Caching**: Business-specific caching requirements

### When NOT to Add Abstractions

Don't create abstractions for:

1. **Simple Forwarding**: Just calling SDK methods
2. **Type Conversion**: Use SDK types directly
3. **Error Wrapping**: Unless adding business context
4. **Event Publishing**: Use EventEmitter2 directly

### Maintenance Guidelines

1. **Keep Dependencies Updated**: Regularly update Core and SDK versions
2. **Monitor Breaking Changes**: Watch for SDK API changes
3. **Review Abstractions**: Periodically review if wrappers still add value
4. **Document Patterns**: Keep this document updated with new patterns

## References

- [Migration Summary](../../.kiro/specs/upstream-tools-migration/MIGRATION-SUMMARY.md)
- [Project Guide](../../.kiro/steering/project-guide.md)
- [Core Layer Architecture](./core-layer-architecture.md)
- [Foundation Layer Architecture](./foundation-layer-architecture.md)

---

**Document Version**: 2.0  
**Last Updated**: December 26, 2024  
**Status**: Post-Migration
