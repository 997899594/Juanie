# Git Platform Integration - Design Document

## Overview

本设计文档描述了 AI DevOps Platform 与 Git 平台（GitHub/GitLab）深度集成的技术实现方案。该功能使平台能够自动在 Git 平台上创建和管理组织、项目仓库、用户权限，实现平台操作与 Git 平台的双向同步。

### 核心目标

1. **统一入口**：用户只需在平台操作，无需频繁切换到 Git 平台
2. **自动同步**：平台操作自动同步到 Git 平台
3. **权限映射**：平台角色自动映射到 Git 平台权限
4. **双向同步**：Git 平台变更可以同步回平台（可选）

### 设计原则

1. **复用现有架构**：基于现有的三层服务架构和 GitProviderService
2. **渐进式实施**：分阶段实现，先项目级后组织级
3. **异步处理**：使用队列处理同步任务，避免阻塞
4. **幂等性**：所有同步操作支持安全重试
5. **可观测性**：完整的日志和追踪

## Architecture

### 系统架构图

```
┌─────────────────────────────────────────────────────────────┐
│                      Frontend (Vue 3)                        │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ WorkspaceSwitcher│ │ ProjectWizard  │  │ MemberManager│  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓ tRPC
┌─────────────────────────────────────────────────────────────┐
│                    API Gateway (NestJS)                      │
│  ┌────────────────┐  ┌────────────────┐  ┌──────────────┐  │
│  │ Projects Router│  │ GitOps Router  │  │ Users Router │  │
│  └────────────────┘  └────────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   Business Layer Services                    │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  GitOps Module                                         │ │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐ │ │
│  │  │ GitProvider  │  │  GitSync     │  │ Credentials │ │ │
│  │  │   Service    │  │  Service     │  │   Manager   │ │ │
│  │  └──────────────┘  └──────────────┘  └─────────────┘ │ │
│  └────────────────────────────────────────────────────────┘ │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Projects Module                                       │ │
│  │  ┌──────────────┐  ┌──────────────┐                  │ │
│  │  │  Projects    │  │ ProjectMembers│                  │ │
│  │  │  Service     │  │   Service     │                  │ │
│  │  └──────────────┘  └──────────────┘                  │ │
│  └────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                  Foundation Layer Services                   │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │    OAuth     │  │    Users     │  │  Organizations   │  │
│  │   Accounts   │  │   Service    │  │     Service      │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                        Core Layer                            │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Database   │  │    Queue     │  │     Events       │  │
│  │  (Drizzle)   │  │  (BullMQ)    │  │  (EventEmitter)  │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────────┐
│                   External Services                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │  GitHub API  │  │  GitLab API  │  │   Kubernetes     │  │
│  └──────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
```


### 数据流

#### 项目创建流程（含 Git 同步）

```
用户创建项目
    ↓
ProjectsService.createProject()
    ↓
创建平台项目记录
    ↓
发布 PROJECT_CREATED 事件
    ↓
GitSyncService 监听事件
    ↓
异步队列：git-sync-project
    ↓
GitProviderService.createRepository()
    ↓
更新项目 Git 信息
    ↓
发布 GIT_REPO_CREATED 事件
```

#### 添加成员流程（含权限同步）

```
管理员添加成员
    ↓
ProjectMembersService.addMember()
    ↓
创建平台成员记录
    ↓
发布 MEMBER_ADDED 事件
    ↓
GitSyncService 监听事件
    ↓
检查用户 Git 账号关联
    ↓
异步队列：git-sync-member
    ↓
GitProviderService.addCollaborator()
    ↓
更新同步状态
```

## Components and Interfaces

### 1. GitSyncService (新增)

**职责**：协调平台与 Git 平台的同步操作

**位置**：`packages/services/business/src/gitops/git-sync/git-sync.service.ts`

**设计决策**：
- 使用独立服务而非直接在 ProjectsService 中实现
- 原因：同步逻辑复杂，涉及队列、重试、错误处理
- 符合单一职责原则

```typescript
@Injectable()
export class GitSyncService {
  constructor(
    private readonly gitProvider: GitProviderService,
    private readonly credentialManager: CredentialManagerService,
    @Inject(DATABASE) private readonly db: PostgresJsDatabase<typeof schema>,
    @Inject(GIT_SYNC_QUEUE) private readonly queue: Queue,
  ) {}

  /**
   * 同步项目成员权限到 Git 平台
   * Requirements: 4.2, 4.3, 4.4
   * 
   * 使用队列异步处理，避免阻塞用户操作
   */
  async syncProjectMember(
    projectId: string,
    userId: string,
    role: ProjectRole
  ): Promise<void> {
    await this.queue.add('sync-member', {
      projectId,
      userId,
      role,
    })
  }

  /**
   * 移除成员的 Git 权限
   * Requirements: 4.8
   */
  async removeMemberAccess(
    projectId: string,
    userId: string
  ): Promise<void> {
    await this.queue.add('remove-member', {
      projectId,
      userId,
    })
  }

  /**
   * 批量同步（用于迁移现有项目）
   * Requirements: 7.2, 7.3
   */
  async batchSyncProject(projectId: string): Promise<void> {
    await this.queue.add('batch-sync', { projectId })
  }
}
```

### 2. GitProviderService (扩展现有)

**职责**：统一的 GitHub/GitLab API 调用接口

**位置**：`packages/services/business/src/gitops/git-providers/git-provider.service.ts`

**新增方法**：

```typescript
@Injectable()
export class GitProviderService {
  // === 现有方法 ===
  // createRepository()
  // pushFiles()
  // validateRepository()
  // ...

  // === 新增：仓库协作者管理 ===

  /**
   * 添加仓库协作者
   * Requirements: 4.2
   */
  async addCollaborator(
    provider: 'github' | 'gitlab',
    repoFullName: string,
    username: string,
    permission: GitPermission,
    accessToken: string
  ): Promise<void>

  /**
   * 移除仓库协作者
   * Requirements: 4.8
   */
  async removeCollaborator(
    provider: 'github' | 'gitlab',
    repoFullName: string,
    username: string,
    accessToken: string
  ): Promise<void>

  /**
   * 更新协作者权限
   * Requirements: 4.7
   */
  async updateCollaboratorPermission(
    provider: 'github' | 'gitlab',
    repoFullName: string,
    username: string,
    permission: GitPermission,
    accessToken: string
  ): Promise<void>

  /**
   * 列出仓库协作者
   * Requirements: 6.4
   */
  async listCollaborators(
    provider: 'github' | 'gitlab',
    repoFullName: string,
    accessToken: string
  ): Promise<GitCollaborator[]>

  // === 新增：组织管理（Phase 2）===

  /**
   * 创建 GitHub Organization / GitLab Group
   * Requirements: 2.1, 2.2
   */
  async createOrganization(
    provider: 'github' | 'gitlab',
    name: string,
    accessToken: string
  ): Promise<GitOrganizationInfo>

  /**
   * 添加组织成员
   * Requirements: 4.1
   */
  async addOrgMember(
    provider: 'github' | 'gitlab',
    orgName: string,
    username: string,
    role: OrgRole,
    accessToken: string
  ): Promise<void>
}
```

### 3. PermissionMappingService

**职责**：平台角色到 Git 平台权限的映射

**位置**：`packages/services/business/src/gitops/git-sync/permission-mapping.service.ts`

**设计决策**：
- 使用服务类而非工具函数
- 原因：可能需要从数据库读取自定义映射规则
- 支持未来扩展（如自定义权限映射）
- 符合 NestJS 依赖注入模式

```typescript
@Injectable()
export class PermissionMappingService {
  /**
   * 映射项目角色到 Git 权限
   * Requirements: 4.3, 4.4, 4.5, 4.6
   */
  mapProjectRoleToGitPermission(
    role: ProjectRole,
    provider: 'github' | 'gitlab'
  ): string | number {
    if (provider === 'github') {
      const mapping: Record<ProjectRole, string> = {
        maintainer: 'admin',
        developer: 'write',
        viewer: 'read',
      }
      return mapping[role]
    } else {
      const mapping: Record<ProjectRole, number> = {
        maintainer: 40, // Maintainer
        developer: 30,  // Developer
        viewer: 20,     // Reporter
      }
      return mapping[role]
    }
  }

  /**
   * 映射组织角色到 Git 权限
   * Requirements: 4.3
   */
  mapOrgRoleToGitPermission(
    role: OrgRole,
    provider: 'github' | 'gitlab'
  ): string | number {
    if (provider === 'github') {
      const mapping: Record<OrgRole, string> = {
        owner: 'admin',
        admin: 'admin',
        member: 'member',
        billing: 'member',
      }
      return mapping[role]
    } else {
      const mapping: Record<OrgRole, number> = {
        owner: 50,    // Owner
        admin: 40,    // Maintainer
        member: 30,   // Developer
        billing: 20,  // Reporter
      }
      return mapping[role]
    }
  }

  /**
   * 验证权限映射是否有效
   */
  validatePermission(
    permission: string | number,
    provider: 'github' | 'gitlab'
  ): boolean {
    if (provider === 'github') {
      return ['admin', 'write', 'read'].includes(permission as string)
    } else {
      return [50, 40, 30, 20, 10].includes(permission as number)
    }
  }
}
```

### 4. GitAccountLinkingService (新增)

**职责**：管理用户与 Git 平台账号的关联

**位置**：`packages/services/business/src/gitops/git-sync/git-account-linking.service.ts`

```typescript
@Injectable()
export class GitAccountLinkingService {
  /**
   * 关联用户的 Git 账号
   * Requirements: 5.2, 5.3, 5.4
   */
  async linkGitAccount(
    userId: string,
    provider: 'github' | 'gitlab',
    oauthCode: string
  ): Promise<UserGitAccount>

  /**
   * 获取用户的 Git 账号信息
   * Requirements: 5.5
   */
  async getUserGitAccount(
    userId: string,
    provider: 'github' | 'gitlab'
  ): Promise<UserGitAccount | null>

  /**
   * 检查用户是否已关联 Git 账号
   * Requirements: 5.6
   */
  async hasGitAccount(
    userId: string,
    provider: 'github' | 'gitlab'
  ): Promise<boolean>

  /**
   * 刷新 Git 账号 Token
   * Requirements: 10.3
   */
  async refreshGitAccountToken(
    accountId: string
  ): Promise<void>
}
```

## Data Models

### 新增数据表

#### 1. user_git_accounts (用户 Git 账号关联)

```typescript
export const userGitAccounts = pgTable('user_git_accounts', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  provider: text('provider').notNull(), // 'github' | 'gitlab'
  
  // Git 平台用户信息
  gitUserId: text('git_user_id').notNull(),
  gitUsername: text('git_username').notNull(),
  gitEmail: text('git_email'),
  gitAvatarUrl: text('git_avatar_url'),
  
  // OAuth 凭证（加密存储）
  accessToken: text('access_token').notNull(),
  refreshToken: text('refresh_token'),
  tokenExpiresAt: timestamp('token_expires_at'),
  
  // 同步状态
  connectedAt: timestamp('connected_at').notNull().defaultNow(),
  lastSyncAt: timestamp('last_sync_at'),
  syncStatus: text('sync_status').notNull().default('active'), // 'active' | 'expired' | 'revoked'
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
}, (table) => [
  uniqueIndex('user_git_accounts_user_provider_unique').on(table.userId, table.provider),
  index('user_git_accounts_git_user_id_idx').on(table.gitUserId),
  index('user_git_accounts_sync_status_idx').on(table.syncStatus),
])
```

#### 2. git_sync_logs (Git 同步日志)

**设计决策**：
- 完整的审计日志，符合企业级要求
- 支持详细的错误追踪和调试
- 支持同步状态查询和监控

```typescript
export const gitSyncLogs = pgTable('git_sync_logs', {
  id: uuid('id').primaryKey().defaultRandom(),
  
  // 同步类型
  syncType: text('sync_type').notNull(), // 'project' | 'member' | 'organization'
  action: text('action').notNull(), // 'create' | 'update' | 'delete'
  
  // 关联实体
  projectId: uuid('project_id').references(() => projects.id, { onDelete: 'set null' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'set null' }),
  organizationId: uuid('organization_id').references(() => organizations.id, { onDelete: 'set null' }),
  
  // Git 平台信息
  provider: text('provider').notNull(),
  gitResourceId: text('git_resource_id'),
  gitResourceUrl: text('git_resource_url'),
  
  // 同步状态
  status: text('status').notNull(), // 'pending' | 'success' | 'failed'
  error: text('error'),
  errorStack: text('error_stack'),
  
  // 元数据（用于调试和审计）
  metadata: jsonb('metadata').$type<{
    attemptCount?: number
    lastAttemptAt?: Date
    gitApiResponse?: any
    userAgent?: string
  }>(),
  
  createdAt: timestamp('created_at').notNull().defaultNow(),
  completedAt: timestamp('completed_at'),
}, (table) => [
  index('git_sync_logs_project_id_idx').on(table.projectId),
  index('git_sync_logs_user_id_idx').on(table.userId),
  index('git_sync_logs_status_idx').on(table.status),
  index('git_sync_logs_created_at_idx').on(table.createdAt),
])
```

### 扩展现有数据表

#### 1. organizations (扩展)

```typescript
// 新增字段
export const organizations = pgTable('organizations', {
  // ... 现有字段
  
  // Git 平台同步信息
  gitProvider: text('git_provider'), // 'github' | 'gitlab'
  gitOrgId: text('git_org_id'),
  gitOrgName: text('git_org_name'),
  gitOrgUrl: text('git_org_url'),
  gitSyncEnabled: boolean('git_sync_enabled').default(false),
  gitLastSyncAt: timestamp('git_last_sync_at'),
})
```

#### 2. projects (扩展)

**设计决策**：
- 在 config JSONB 中添加 gitSync 配置
- 保持向后兼容，gitSync 为可选字段
- 支持细粒度的同步控制

```typescript
// 扩展 config JSONB 类型
config: jsonb('config').$type<{
  // ... 现有字段
  defaultBranch: string
  enableCiCd: boolean
  enableAi: boolean
  
  // Git 同步配置
  gitSync?: {
    enabled: boolean
    autoSyncMembers: boolean
    lastSyncAt: Date
    syncStatus: 'synced' | 'pending' | 'failed'
    syncError?: string
  }
}>()
```


## Correctness Properties

*A property is a characteristic or behavior that should hold true across all valid executions of a system-essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.*

### Property 1: Git 仓库创建幂等性

*For any* 项目，如果 Git 仓库创建失败后重试，应该能够检测到已存在的仓库并复用，而不是报错。

**Validates: Requirements 3.7, 10.4, 10.6**

### Property 2: 权限映射一致性

*For any* 平台角色和 Git 平台组合，权限映射函数应该返回确定的 Git 权限，且该权限应该符合平台角色的语义。

**Validates: Requirements 4.3, 4.4, 4.5, 4.6**

### Property 3: 成员同步完整性

*For any* 项目成员，如果在平台添加成功，则该成员应该最终出现在 Git 仓库的协作者列表中（或同步日志中记录失败原因）。

**Validates: Requirements 4.2, 6.1, 6.2**

### Property 4: 同步状态可追溯性

*For any* Git 同步操作，无论成功或失败，都应该在 git_sync_logs 表中有对应的记录。

**Validates: Requirements 6.1, 6.2, 6.4**

### Property 5: Token 过期处理

*For any* Git 账号，如果 access token 过期，系统应该尝试使用 refresh token 刷新，或通知用户重新连接。

**Validates: Requirements 10.3, 10.4**

### Property 6: 权限变更同步

*For any* 项目成员，如果其平台角色发生变更，则其 Git 仓库权限应该在同步后与新角色对应的权限一致。

**Validates: Requirements 4.7**

### Property 7: 成员移除同步

*For any* 项目成员，如果从平台移除，则该成员应该不再出现在 Git 仓库的协作者列表中。

**Validates: Requirements 4.8**

### Property 8: 批量同步原子性

*For any* 批量同步操作，即使部分项目同步失败，其他项目的同步应该继续进行，不应中断整个流程。

**Validates: Requirements 7.5**

## Error Handling

### 错误分类

#### 1. 认证错误

```typescript
class GitAuthenticationError extends Error {
  constructor(
    public provider: 'github' | 'gitlab',
    public reason: 'invalid_token' | 'expired_token' | 'insufficient_permissions'
  ) {
    super(`Git authentication failed: ${reason}`)
  }
}
```

**处理策略**：
- 记录详细错误日志
- 通知用户重新连接 Git 账号
- 标记同步状态为 'failed'
- 提供重试选项

#### 2. 网络错误

```typescript
class GitNetworkError extends Error {
  constructor(
    public provider: 'github' | 'gitlab',
    public statusCode?: number
  ) {
    super(`Git API network error: ${statusCode}`)
  }
}
```

**处理策略**：
- 使用指数退避重试（最多 3 次）
- 记录重试次数和间隔
- 超过重试次数后标记为失败
- 支持手动重试

#### 3. 速率限制错误

```typescript
class GitRateLimitError extends Error {
  constructor(
    public provider: 'github' | 'gitlab',
    public resetAt: Date
  ) {
    super(`Git API rate limit exceeded, resets at ${resetAt}`)
  }
}
```

**处理策略**：
- 自动延迟到 resetAt 后重试
- 使用队列延迟任务
- 通知管理员速率限制情况

#### 4. 资源冲突错误

```typescript
class GitResourceConflictError extends Error {
  constructor(
    public resourceType: 'repository' | 'organization' | 'member',
    public resourceName: string
  ) {
    super(`Git resource already exists: ${resourceType}/${resourceName}`)
  }
}
```

**处理策略**：
- 检查是否可以复用现有资源
- 如果可以复用，更新平台记录
- 如果不可以，提示用户修改名称

### 错误恢复流程

```typescript
async function handleSyncError(
  error: Error,
  context: SyncContext
): Promise<SyncResult> {
  // 1. 记录错误日志
  await logSyncError(error, context)
  
  // 2. 根据错误类型决定是否重试
  if (isRetryable(error)) {
    const retryCount = await getRetryCount(context)
    if (retryCount < MAX_RETRIES) {
      // 使用指数退避
      const delay = calculateBackoff(retryCount)
      await scheduleRetry(context, delay)
      return { status: 'retrying', retryAt: new Date(Date.now() + delay) }
    }
  }
  
  // 3. 标记为失败
  await markSyncFailed(context, error)
  
  // 4. 发送通知
  await notifyAdmins(context, error)
  
  return { status: 'failed', error: error.message }
}
```

## Testing Strategy

### 测试原则

采用现代化的测试最佳实践：
- 单元测试：测试独立的业务逻辑
- 集成测试：测试服务间的交互
- 端到端测试：测试完整的用户流程
- 使用 Vitest 作为测试框架
- 测试覆盖率目标：核心逻辑 > 80%

### 单元测试

#### 1. PermissionMappingService

```typescript
describe('PermissionMappingService', () => {
  let service: PermissionMappingService

  beforeEach(() => {
    service = new PermissionMappingService()
  })

  describe('mapProjectRoleToGitPermission', () => {
    it('should map maintainer to GitHub admin', () => {
      expect(service.mapProjectRoleToGitPermission('maintainer', 'github'))
        .toBe('admin')
    })

    it('should map developer to GitLab 30', () => {
      expect(service.mapProjectRoleToGitPermission('developer', 'gitlab'))
        .toBe(30)
    })

    it('should map all roles correctly for both providers', () => {
      const roles: ProjectRole[] = ['maintainer', 'developer', 'viewer']
      
      roles.forEach(role => {
        const githubPerm = service.mapProjectRoleToGitPermission(role, 'github')
        const gitlabPerm = service.mapProjectRoleToGitPermission(role, 'gitlab')
        
        expect(githubPerm).toBeDefined()
        expect(gitlabPerm).toBeDefined()
        expect(service.validatePermission(githubPerm, 'github')).toBe(true)
        expect(service.validatePermission(gitlabPerm, 'gitlab')).toBe(true)
      })
    })
  })
})
```

#### 2. GitProviderService

```typescript
describe('GitProviderService', () => {
  let service: GitProviderService

  beforeEach(() => {
    service = new GitProviderService(configService)
  })

  describe('addCollaborator', () => {
    it('should call GitHub API with correct parameters', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({})
      })
      global.fetch = mockFetch

      await service.addCollaborator(
        'github',
        'owner/repo',
        'username',
        'write',
        'token'
      )

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.github.com/repos/owner/repo/collaborators/username',
        expect.objectContaining({
          method: 'PUT',
          headers: expect.objectContaining({
            Authorization: 'Bearer token'
          }),
          body: JSON.stringify({ permission: 'write' })
        })
      )
    })
  })
})
```

### 集成测试

#### 1. Git 同步流程

```typescript
describe('Git Sync Integration', () => {
  let gitSync: GitSyncService
  let gitProvider: GitProviderService
  let db: Database

  beforeEach(async () => {
    // 设置测试数据库
    db = await setupTestDatabase()
    gitSync = new GitSyncService(gitProvider, db, queue)
  })

  it('should sync project member to Git repository', async () => {
    // 1. 创建测试数据
    const project = await createTestProject(db)
    const user = await createTestUser(db)
    await linkGitAccount(user.id, 'github', 'test-token')

    // 2. 同步成员
    await gitSync.syncProjectMember(project.id, user.id, 'developer')

    // 3. 等待队列处理
    await waitForQueueCompletion()

    // 4. 验证同步日志
    const logs = await db.query.gitSyncLogs.findMany({
      where: eq(gitSyncLogs.projectId, project.id)
    })

    expect(logs).toHaveLength(1)
    expect(logs[0].status).toBe('success')
  })
})
```

### 端到端测试

#### 1. 完整用户流程

```typescript
describe('E2E: Git Platform Integration', () => {
  it('should complete full member sync workflow', async () => {
    // 1. 用户连接 Git 账号
    const linkResponse = await api.linkGitAccount({
      provider: 'github',
      code: 'oauth-code'
    })
    expect(linkResponse.success).toBe(true)

    // 2. 创建项目
    const project = await api.createProject({
      name: 'test-project',
      organizationId: 'org-id'
    })

    // 3. 添加成员
    const member = await api.addProjectMember({
      projectId: project.id,
      userId: 'user-id',
      role: 'developer'
    })

    // 4. 等待同步完成
    await waitFor(() => {
      const status = api.getGitSyncStatus(project.id, 'user-id')
      return status.synced === true
    })

    // 5. 验证 Git 平台
    const collaborators = await gitHubApi.listCollaborators(project.gitRepo)
    expect(collaborators).toContainEqual(
      expect.objectContaining({
        login: 'test-user',
        permissions: { push: true }
      })
    )
  })
})
```

## Implementation Phases

### Phase 1: 项目级同步（MVP - 2周）

**目标**：实现项目创建和成员权限的基本同步

**任务**：
1. 创建 user_git_accounts 表和 git_sync_logs 表
2. 实现 GitAccountLinkingService
3. 扩展 GitProviderService 添加协作者管理方法
4. 实现 GitSyncService 的项目成员同步功能
5. 实现 PermissionMappingService
6. 集成到项目创建和成员管理流程
7. 添加同步状态显示 UI

**验收标准**：
- 用户可以关联 GitHub/GitLab 账号
- 创建项目时自动创建 Git 仓库
- 添加项目成员时自动添加 Git 仓库协作者
- 可以查看同步状态和日志

### Phase 2: 组织级同步（3-4周）

**目标**：实现组织和 Git 平台组织的同步

**任务**：
1. 扩展 organizations 表添加 Git 同步字段
2. 实现 GitProviderService 的组织管理方法
3. 实现组织创建时的 Git 组织同步
4. 实现组织成员的 Git 组织权限同步
5. 添加组织级同步配置 UI

**验收标准**：
- 创建组织时可选择同步到 Git 平台
- 组织成员自动同步到 Git 平台组织
- 组织级权限正确映射

### Phase 3: 双向同步和高级功能（2-3周）

**目标**：实现 Git 平台到平台的同步和高级功能

**任务**：
1. 实现 Webhook 接收和验证
2. 实现 Git 平台变更同步回平台
3. 实现冲突检测和解决
4. 实现批量同步功能
5. 实现 Token 自动刷新
6. 添加同步监控和报告

**验收标准**：
- Git 平台的变更可以同步回平台
- 支持批量同步现有项目
- Token 过期自动刷新或通知
- 完整的同步监控和报告

## Security Considerations

### 1. 凭证安全

- 所有 Git access token 使用 AES-256 加密存储
- 使用环境变量存储加密密钥
- Token 传输使用 HTTPS
- 定期轮换加密密钥

### 2. API 权限

- 最小权限原则：只请求必需的 API 权限
- GitHub: `repo`, `read:org`, `write:org`
- GitLab: `api`, `read_repository`, `write_repository`

### 3. Webhook 安全

- 验证 Webhook 签名
- 使用 HTTPS 接收 Webhook
- 限制 Webhook 来源 IP
- 记录所有 Webhook 请求

### 4. 审计日志

- 记录所有 Git 同步操作
- 记录操作用户和时间戳
- 记录操作结果和错误信息
- 支持审计日志查询和导出

## Performance Considerations

### 1. 异步处理

- 所有 Git API 调用使用队列异步处理
- 避免阻塞用户操作
- 使用 BullMQ 管理队列任务

### 2. 批量操作优化

- 批量同步使用并发控制（最多 5 个并发）
- 使用 Promise.allSettled 处理批量操作
- 失败的任务不影响其他任务

### 3. 缓存策略

- 缓存 Git 用户信息（1小时）
- 缓存权限映射结果
- 使用 Redis 存储缓存

### 4. 速率限制

- 监控 Git API 速率限制
- 自动调整请求频率
- 使用队列延迟处理超限请求

## Monitoring and Observability

### 日志记录

使用结构化日志记录所有关键操作：

```typescript
@Injectable()
export class GitSyncService {
  private readonly logger = new Logger(GitSyncService.name)

  async syncProjectMember(projectId: string, userId: string, role: ProjectRole) {
    this.logger.log({
      message: 'Starting member sync',
      projectId,
      userId,
      role,
      timestamp: new Date().toISOString()
    })

    try {
      // 同步逻辑
      this.logger.log({
        message: 'Member sync completed',
        projectId,
        userId,
        duration: Date.now() - startTime
      })
    } catch (error) {
      this.logger.error({
        message: 'Member sync failed',
        projectId,
        userId,
        error: error.message,
        stack: error.stack
      })
    }
  }
}
```

### Prometheus 指标

```typescript
import { Counter, Histogram } from 'prom-client'

// 同步操作计数
const gitSyncTotal = new Counter({
  name: 'git_sync_operations_total',
  help: 'Total number of Git sync operations',
  labelNames: ['sync_type', 'provider', 'status']
})

// 同步操作耗时
const gitSyncDuration = new Histogram({
  name: 'git_sync_duration_seconds',
  help: 'Duration of Git sync operations',
  labelNames: ['sync_type', 'provider'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
})

// 同步错误计数
const gitSyncErrors = new Counter({
  name: 'git_sync_errors_total',
  help: 'Total number of Git sync errors',
  labelNames: ['sync_type', 'provider', 'error_type']
})
```

### OpenTelemetry 追踪

```typescript
import { Trace } from '@juanie/core/observability'

@Injectable()
export class GitSyncService {
  @Trace('git-sync.syncProjectMember')
  async syncProjectMember(
    projectId: string,
    userId: string,
    role: ProjectRole
  ): Promise<void> {
    // 自动记录 trace span
  }
}
```

### 告警规则

```yaml
# Prometheus 告警规则
groups:
  - name: git_sync
    rules:
      - alert: GitSyncHighFailureRate
        expr: |
          rate(git_sync_errors_total[5m]) / rate(git_sync_operations_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Git sync failure rate > 5%"

      - alert: GitSyncTokenExpired
        expr: |
          sum(git_sync_errors_total{error_type="token_expired"}) > 10
        for: 1m
        labels:
          severity: critical
        annotations:
          summary: "Multiple Git tokens expired"

      - alert: GitSyncQueueBacklog
        expr: |
          git_sync_queue_size > 100
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Git sync queue has large backlog"
```

## Summary

本设计文档描述了 Git 平台集成功能的技术方案，遵循以下原则：

### 设计原则

1. **复用现有架构** ✅
   - 基于现有的 GitProviderService
   - 使用现有的队列系统（BullMQ）
   - 符合三层服务架构

2. **使用成熟工具** ✅
   - GitHub/GitLab 官方 API
   - Drizzle ORM
   - NestJS 依赖注入

3. **渐进式实施** ✅
   - Phase 1: MVP（项目级同步）
   - Phase 2: 组织级同步
   - Phase 3: 双向同步

4. **最小化实现** ✅
   - 只实现核心功能
   - 测试标记为可选
   - 监控可以后续添加

### 核心组件

1. **GitSyncService** - 协调同步操作
2. **GitAccountLinkingService** - 管理用户 Git 账号关联
3. **PermissionMappingService** - 权限映射
4. **GitProviderService** (扩展) - Git API 调用

### 数据模型

1. **user_git_accounts** - 用户 Git 账号关联
2. **git_sync_logs** - 同步日志
3. **organizations** (扩展) - 添加 Git 同步字段
4. **projects** (扩展) - 添加 Git 同步配置

该方案完全复用现有架构，最小化代码改动，提供企业级 Git 平台集成能力。
