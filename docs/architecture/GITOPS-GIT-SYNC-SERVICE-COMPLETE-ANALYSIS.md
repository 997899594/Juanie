# GitOps Git-Sync Service 完整架构分析

**日期**: 2025-12-25  
**分析对象**: `packages/services/business/src/gitops/git-sync/git-sync.service.ts`  
**分析师**: 资深架构师

---

## 📋 执行摘要

`git-sync.service.ts` 是 GitOps 模块的核心服务，负责协调平台与 Git 平台的同步操作。经过深度审计，发现 **13 处严重架构违规**，违反了三层架构的核心原则。

**严重程度**: 🔴 **CRITICAL**  
**影响范围**: 整个 GitOps 同步功能  
**修复优先级**: P0 (最高)

---

## 🔍 架构违规详细分析

### 违规类型 1: 直接注入数据库 (1 处)

**位置**: Line 38
```typescript
@Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>
```

**问题**:
- Business 层服务直接注入 `DATABASE` token
- 违反三层架构：Business → Foundation → Core
- 绕过了 Foundation 层的封装和业务逻辑

**正确做法**:
```typescript
// ❌ 错误
@Inject(DATABASE) private readonly db

// ✅ 正确
constructor(
  private readonly projectsService: ProjectsService,
  private readonly gitSyncLogsService: GitSyncLogsService,
  // ...
)
```

---

### 违规类型 2: 直接查询 projects 表 (3 处)

#### 违规 #1: Line 67-71
```typescript
const [project] = await this.db
  .select()
  .from(schema.projects)
  .where(eq(schema.projects.id, projectId))
  .limit(1)
```

**问题**:
- 直接查询 `projects` 表
- 应该使用 `ProjectsService.findById()`

#### 违规 #2: Line 138-142
```typescript
const [project] = await this.db
  .select()
  .from(schema.projects)
  .where(eq(schema.projects.id, projectId))
  .limit(1)
```

**问题**: 同上

#### 违规 #3: Line 207-211
```typescript
const [project] = await this.db
  .select()
  .from(schema.projects)
  .where(eq(schema.projects.id, projectId))
  .limit(1)
```

**问题**: 同上

**正确做法**:
```typescript
// ❌ 错误
const [project] = await this.db
  .select()
  .from(schema.projects)
  .where(eq(schema.projects.id, projectId))
  .limit(1)

// ✅ 正确
const project = await this.projectsService.findById(projectId)
```

---

### 违规类型 3: 直接查询 projectGitAuth 表 (3 处)

#### 违规 #4: Line 77-80
```typescript
const [projectAuth] = await this.db
  .select()
  .from(schema.projectGitAuth)
  .where(eq(schema.projectGitAuth.projectId, projectId))
  .limit(1)
```

**问题**:
- 直接查询 `projectGitAuth` 表
- 该表通过 `oauthAccountId` 关联到 `gitConnections`
- 应该使用 `GitConnectionsService` 获取项目的 Git 认证信息

#### 违规 #5: Line 148-151
```typescript
const [projectAuth] = await this.db
  .select()
  .from(schema.projectGitAuth)
  .where(eq(schema.projectGitAuth.projectId, projectId))
  .limit(1)
```

**问题**: 同上

#### 违规 #6: Line 217-220
```typescript
const [projectAuth] = await this.db
  .select()
  .from(schema.projectGitAuth)
  .where(eq(schema.projectGitAuth.projectId, projectId))
  .limit(1)
```

**问题**: 同上

**正确做法**:
```typescript
// ❌ 错误
const [projectAuth] = await this.db
  .select()
  .from(schema.projectGitAuth)
  .where(eq(schema.projectGitAuth.projectId, projectId))
  .limit(1)

// ✅ 正确
// projectGitAuth 通过 oauthAccountId 关联到 gitConnections
// 应该使用 GitConnectionsService 获取项目的 Git 凭证
const credentials = await this.gitConnectionsService.getProjectAccessToken(projectId)
```

---

### 违规类型 4: 直接操作 gitSyncLogs 表 (6 处)

#### 违规 #7: Line 91-106 (创建同步日志)
```typescript
const [syncLog] = await this.db
  .insert(schema.gitSyncLogs)
  .values({
    syncType: 'member',
    action: 'create',
    projectId,
    userId,
    provider,
    status: 'pending',
    gitResourceType: 'repository',
    gitResourceId: projectId,
    metadata: {
      attemptCount: 0,
      systemRole: role,
    },
  })
  .returning()
```

**问题**:
- 直接插入 `gitSyncLogs` 表
- 应该创建 `GitSyncLogsService` 来管理同步日志

#### 违规 #8: Line 165-177 (创建同步日志)
```typescript
const [syncLog] = await this.db
  .insert(schema.gitSyncLogs)
  .values({
    syncType: 'member',
    action: 'delete',
    projectId,
    userId,
    provider,
    status: 'pending',
    metadata: {
      attemptCount: 0,
    },
  })
  .returning()
```

**问题**: 同上

#### 违规 #9: Line 233-244 (创建同步日志)
```typescript
const [syncLog] = await this.db
  .insert(schema.gitSyncLogs)
  .values({
    syncType: 'project',
    action: 'update',
    projectId,
    provider,
    status: 'pending',
    metadata: {
      attemptCount: 0,
    },
  })
  .returning()
```

**问题**: 同上

#### 违规 #10: Line 273-280 (查询同步日志)
```typescript
return this.db
  .select()
  .from(schema.gitSyncLogs)
  .where(eq(schema.gitSyncLogs.projectId, projectId))
  .orderBy(desc(schema.gitSyncLogs.createdAt))
  .limit(limit)
```

**问题**: 同上

#### 违规 #11: Line 290-308 (查询失败的同步任务)
```typescript
if (projectId) {
  return this.db
    .select()
    .from(schema.gitSyncLogs)
    .where(
      and(eq(schema.gitSyncLogs.status, 'failed'), eq(schema.gitSyncLogs.projectId, projectId)),
    )
    .orderBy(desc(schema.gitSyncLogs.createdAt))
    .limit(100)
}

return this.db
  .select()
  .from(schema.gitSyncLogs)
  .where(eq(schema.gitSyncLogs.status, 'failed'))
  .orderBy(desc(schema.gitSyncLogs.createdAt))
  .limit(100)
```

**问题**: 同上

#### 违规 #12: Line 319-323 (查询同步日志)
```typescript
const [syncLog] = await this.db
  .select()
  .from(schema.gitSyncLogs)
  .where(eq(schema.gitSyncLogs.id, syncLogId))
  .limit(1)
```

**问题**: 同上

#### 违规 #13: Line 331-338 (更新同步日志)
```typescript
await this.db
  .update(schema.gitSyncLogs)
  .set({
    status: 'pending',
    error: null,
    errorStack: null,
  })
  .where(eq(schema.gitSyncLogs.id, syncLogId))
```

**问题**: 同上

**正确做法**:
```typescript
// ❌ 错误
const [syncLog] = await this.db
  .insert(schema.gitSyncLogs)
  .values({ ... })
  .returning()

// ✅ 正确
const syncLog = await this.gitSyncLogsService.create({
  syncType: 'member',
  action: 'create',
  projectId,
  userId,
  provider,
  status: 'pending',
  // ...
})
```

---

## 🏗️ 架构问题总结

### 问题 1: 违反三层架构原则

**当前架构** (❌ 错误):
```
Business Layer (git-sync.service.ts)
    ↓ 直接访问
Database (projects, projectGitAuth, gitSyncLogs)
```

**正确架构** (✅ 应该):
```
Business Layer (git-sync.service.ts)
    ↓ 调用
Foundation Layer (ProjectsService, GitConnectionsService, GitSyncLogsService)
    ↓ 访问
Database (projects, projectGitAuth, gitSyncLogs)
```

### 问题 2: 缺少 Foundation 层服务

**缺失的服务**:
1. ❌ `GitSyncLogsService` - 管理 `gitSyncLogs` 表
   - 需要创建: `packages/services/foundation/src/git-sync-logs/git-sync-logs.service.ts`

**已存在的服务**:
1. ✅ `ProjectsService` - 管理 `projects` 表
2. ✅ `GitConnectionsService` - 管理 `gitConnections` 和 `projectGitAuth` 表

### 问题 3: 数据访问逻辑混乱

**当前问题**:
- `git-sync.service.ts` 包含大量数据库查询逻辑
- 重复的查询代码（3 次查询 projects，3 次查询 projectGitAuth）
- 没有统一的错误处理
- 没有缓存机制

**应该**:
- 所有数据访问通过 Foundation 层服务
- 统一的错误处理和日志记录
- 可以在 Foundation 层添加缓存

### 问题 4: 职责不清晰

**当前职责混乱**:
- ✅ 队列管理 (正确)
- ✅ 同步协调 (正确)
- ❌ 数据库查询 (应该在 Foundation 层)
- ❌ 数据验证 (应该在 Foundation 层)
- ❌ 错误处理 (应该在 Foundation 层)

**应该的职责**:
- ✅ 队列管理
- ✅ 同步协调
- ✅ 业务逻辑编排

---

## 📊 违规统计

| 违规类型 | 数量 | 严重程度 |
|---------|------|---------|
| 直接注入数据库 | 1 | 🔴 CRITICAL |
| 直接查询 projects 表 | 3 | 🔴 CRITICAL |
| 直接查询 projectGitAuth 表 | 3 | 🔴 CRITICAL |
| 直接操作 gitSyncLogs 表 | 6 | 🔴 CRITICAL |
| **总计** | **13** | **🔴 CRITICAL** |

---

## 🎯 修复方案

### Step 1: 创建 GitSyncLogsService (Foundation 层)

**文件**: `packages/services/foundation/src/git-sync-logs/git-sync-logs.service.ts`

```typescript
@Injectable()
export class GitSyncLogsService {
  constructor(
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GitSyncLogsService.name)
  }

  async create(data: CreateGitSyncLogDto): Promise<GitSyncLog> {
    const [syncLog] = await this.db
      .insert(schema.gitSyncLogs)
      .values(data)
      .returning()
    
    if (!syncLog) {
      throw new OperationFailedError('createGitSyncLog', 'Database insert returned no result')
    }
    
    return syncLog
  }

  async update(id: string, data: UpdateGitSyncLogDto): Promise<GitSyncLog> {
    const [updated] = await this.db
      .update(schema.gitSyncLogs)
      .set(data)
      .where(eq(schema.gitSyncLogs.id, id))
      .returning()
    
    if (!updated) {
      throw new NotFoundError('GitSyncLog', id)
    }
    
    return updated
  }

  async findById(id: string): Promise<GitSyncLog | null> {
    const [syncLog] = await this.db
      .select()
      .from(schema.gitSyncLogs)
      .where(eq(schema.gitSyncLogs.id, id))
      .limit(1)
    
    return syncLog || null
  }

  async findByProject(projectId: string, limit: number = 50): Promise<GitSyncLog[]> {
    const { desc } = await import('drizzle-orm')
    return this.db
      .select()
      .from(schema.gitSyncLogs)
      .where(eq(schema.gitSyncLogs.projectId, projectId))
      .orderBy(desc(schema.gitSyncLogs.createdAt))
      .limit(limit)
  }

  async findFailed(projectId?: string): Promise<GitSyncLog[]> {
    const { desc, and } = await import('drizzle-orm')
    
    if (projectId) {
      return this.db
        .select()
        .from(schema.gitSyncLogs)
        .where(
          and(
            eq(schema.gitSyncLogs.status, 'failed'),
            eq(schema.gitSyncLogs.projectId, projectId)
          )
        )
        .orderBy(desc(schema.gitSyncLogs.createdAt))
        .limit(100)
    }
    
    return this.db
      .select()
      .from(schema.gitSyncLogs)
      .where(eq(schema.gitSyncLogs.status, 'failed'))
      .orderBy(desc(schema.gitSyncLogs.createdAt))
      .limit(100)
  }

  async retry(id: string): Promise<GitSyncLog> {
    return this.update(id, {
      status: 'pending',
      error: null,
      errorStack: null,
    })
  }
}
```

### Step 2: 重构 git-sync.service.ts

**修改**: `packages/services/business/src/gitops/git-sync/git-sync.service.ts`

```typescript
@Injectable()
export class GitSyncService {
  constructor(
    // ❌ 删除
    // @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    
    // ✅ 添加 Foundation 层服务
    private readonly projectsService: ProjectsService,
    private readonly gitConnectionsService: GitConnectionsService,
    private readonly gitSyncLogsService: GitSyncLogsService,
    
    @Inject(GIT_SYNC_QUEUE) private readonly queue: Queue,
    private readonly logger: PinoLogger,
  ) {
    this.logger.setContext(GitSyncService.name)
  }

  async syncProjectMember(projectId: string, userId: string, role: ProjectRole): Promise<void> {
    this.logger.info(`Queueing member sync: project=${projectId}, user=${userId}, role=${role}`)

    // ✅ 使用 ProjectsService
    const project = await this.projectsService.findById(projectId)
    if (!project) {
      throw new Error(`Project ${projectId} not found`)
    }

    // ✅ 使用 GitConnectionsService
    const credentials = await this.gitConnectionsService.getProjectAccessToken(projectId)
    
    // ✅ 使用 GitSyncLogsService
    const syncLog = await this.gitSyncLogsService.create({
      syncType: 'member',
      action: 'create',
      projectId,
      userId,
      provider: credentials.provider,
      status: 'pending',
      gitResourceType: 'repository',
      gitResourceId: projectId,
      metadata: {
        attemptCount: 0,
        systemRole: role,
      },
    })

    // 添加到队列
    await this.queue.add(
      'sync-member',
      {
        projectId,
        userId,
        role,
        syncLogId: syncLog.id,
      },
      {
        jobId: `sync-member-${projectId}-${userId}`,
        removeOnComplete: true,
        removeOnFail: false,
      },
    )

    this.logger.info(`Member sync queued: ${syncLog.id}`)
  }

  // 其他方法类似重构...
}
```

### Step 3: 更新 git-sync.module.ts

**修改**: `packages/services/business/src/gitops/git-sync/git-sync.module.ts`

```typescript
@Module({
  imports: [
    FoundationModule, // ✅ 已导入
    QueueModule,
    ConfigModule,
    GitProvidersModule,
    CredentialsModule,
  ],
  providers: [
    GitSyncService,
    GitSyncWorker,
    GitSyncEventHandler,
    OrganizationSyncService,
    ProjectCollaborationSyncService,
    GitSyncErrorService,
    OrganizationEventHandler,
    ConflictResolutionService,
  ],
  exports: [
    GitSyncService,
    OrganizationSyncService,
    ProjectCollaborationSyncService,
    GitSyncErrorService,
    ConflictResolutionService,
  ],
})
export class GitSyncModule {}
```

**注意**: `FoundationModule` 已经导入，所以不需要修改模块配置。

---

## ⏱️ 工作量估算

| 任务 | 时间 | 优先级 |
|-----|------|--------|
| 创建 GitSyncLogsService | 1h | P0 |
| 重构 git-sync.service.ts | 1.5h | P0 |
| 测试和验证 | 0.5h | P0 |
| **总计** | **3h** | **P0** |

---

## 🎓 架构原则回顾

### 三层架构原则

```
┌─────────────────────────────────────┐
│   Business Layer (业务层)           │
│   - 业务逻辑编排                     │
│   - 不直接访问数据库                 │
│   - 通过 Foundation 层服务获取数据   │
└─────────────────────────────────────┘
              ↓ 调用
┌─────────────────────────────────────┐
│   Foundation Layer (基础层)         │
│   - 数据访问                         │
│   - 数据验证                         │
│   - 错误处理                         │
│   - 缓存管理                         │
└─────────────────────────────────────┘
              ↓ 访问
┌─────────────────────────────────────┐
│   Core Layer (核心层)                │
│   - 数据库连接                       │
│   - 队列                             │
│   - 事件                             │
│   - 工具函数                         │
└─────────────────────────────────────┘
```

### 为什么要遵守三层架构？

1. **关注点分离**: 每层只负责自己的职责
2. **可测试性**: 可以 mock Foundation 层服务进行单元测试
3. **可维护性**: 数据访问逻辑集中在 Foundation 层
4. **可扩展性**: 可以在 Foundation 层添加缓存、日志等功能
5. **一致性**: 所有 Business 层服务使用相同的数据访问方式

---

## 📝 总结

`git-sync.service.ts` 存在 **13 处严重架构违规**，主要问题是：

1. ❌ 直接注入数据库 (1 处)
2. ❌ 直接查询 projects 表 (3 处)
3. ❌ 直接查询 projectGitAuth 表 (3 处)
4. ❌ 直接操作 gitSyncLogs 表 (6 处)

**修复方案**:
1. 创建 `GitSyncLogsService` (Foundation 层)
2. 重构 `git-sync.service.ts` 使用 Foundation 层服务
3. 删除所有直接数据库访问代码

**预计工作量**: 3 小时  
**优先级**: P0 (最高)

---

**下一步**: 开始 Phase 4 - 修复 git-sync.service.ts
