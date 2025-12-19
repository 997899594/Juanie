# 数据库重构计划

> **创建时间**: 2024-12-18  
> **状态**: 待执行  
> **优先级**: 高

## 背景

通过系统分析发现数据库设计存在多个问题：功能重复、职责不清、命名不一致等。这些问题导致代码混乱、维护困难、容易出 bug。

## 核心原则

遵循项目指南中的"绝不向后兼容"原则：
- 直接替换，删除旧代码
- 不保留历史兼容层
- 一次性彻底重构

---

## 🔴 P0 - 立即修复（严重问题）

### 1. 合并 `oauth_accounts` 和 `user_git_accounts`

**问题**：
- 两个表都存储 Git OAuth token
- 职责重叠，导致代码混乱（刚修复的删除项目 bug）
- 开发者不知道该用哪个表

**当前状态**：
```typescript
// oauth_accounts - 用于登录认证
- userId, provider, providerAccountId
- accessToken, refreshToken, expiresAt
- status, serverUrl, serverType
- metadata

// user_git_accounts - 用于 Git 集成
- userId, provider
- gitUserId, gitUsername, gitEmail, gitAvatarUrl
- accessToken, refreshToken, tokenExpiresAt
- syncStatus, connectedAt, lastSyncAt
```

**目标设计**：
```typescript
// git_platform_connections (新表名)
- userId, provider, serverUrl
- providerAccountId (Git 平台用户 ID)
- username, email, avatarUrl
- accessToken, refreshToken, expiresAt
- status ('active' | 'expired' | 'revoked')
- purpose ('auth' | 'integration' | 'both')  // 区分用途
- connectedAt, lastSyncAt
- serverType ('cloud' | 'self-hosted')
- metadata (JSONB)
```

**迁移步骤**：
1. 创建新表 `git_platform_connections`
2. 数据迁移：合并两个表的数据
3. 更新所有使用这两个表的代码
4. 删除旧表

**影响范围**：
- `OAuthAccountsService`
- `GitAccountLinkingService`
- `ProjectInitializationWorker`
- `GitSyncWorker`
- `ConflictResolutionService`
- 所有使用 OAuth token 的地方

**预计工作量**: 2-3 天

---

### 2. 清理 `repositories` 表的 Flux 状态字段

**问题**：
- `repositories` 表混合了业务数据和 Flux 运行时状态
- 违反单一职责原则
- Flux 状态应该只在 `gitops_resources` 表中

**需要移除的字段**：
```typescript
// 移除这些字段
fluxSyncStatus
fluxLastSyncCommit
fluxLastSyncTime
fluxErrorMessage
```

**迁移步骤**：
1. 确认这些字段没有被使用（或迁移到 `gitops_resources`）
2. 创建数据库迁移删除这些字段
3. 清理相关代码

**影响范围**：
- `RepositoriesService`
- 任何查询 Flux 状态的代码

**预计工作量**: 0.5 天

---

### 3. 删除 `projects` 表的冗余 Git 字段

**问题**：
- `projects` 表存储了 Git 信息，但这些信息已经在 `repositories` 表中
- 数据冗余，可能不一致

**需要移除的字段**：
```typescript
// 移除这些字段
gitProvider
gitRepoUrl
gitRepoName
gitDefaultBranch
```

**替代方案**：
- 通过 `repositories` 表关联查询
- 如果需要快速访问，使用数据库视图或缓存

**迁移步骤**：
1. 更新所有直接访问这些字段的代码
2. 改为通过 `repositories` 表查询
3. 创建数据库迁移删除字段

**影响范围**：
- `ProjectsService`
- 前端显示项目 Git 信息的地方

**预计工作量**: 1 天

---

## 🟡 P1 - 计划重构（中等问题）

### 4. 简化 `project_git_auth` 表设计

**问题**：
- 支持 6 种认证方式，但大部分字段都是 nullable
- 每种认证方式都有独立的字段组
- 设计过于复杂

**当前设计**：
```typescript
authType: 'oauth' | 'project_token' | 'pat' | 'github_app' | 'gitlab_group_token'
oauthAccountId
projectToken, tokenScopes, tokenExpiresAt
patToken, patProvider, patScopes, patExpiresAt
githubAppId, githubInstallationId, githubPrivateKey
gitlabGroupId, gitlabGroupToken, gitlabGroupScopes
serviceAccountId, serviceAccountConfig
```

**目标设计（多态）**：
```typescript
// project_git_auth (主表)
- projectId
- authType
- createdBy, createdAt, updatedAt
- lastValidatedAt, validationStatus

// project_git_auth_oauth (子表)
- authId (FK)
- oauthAccountId

// project_git_auth_token (子表)
- authId (FK)
- tokenType ('pat' | 'project' | 'group')
- token (encrypted)
- scopes, expiresAt

// project_git_auth_app (子表)
- authId (FK)
- appType ('github_app' | 'gitlab_app')
- appId, installationId
- privateKey (encrypted)
```

**预计工作量**: 2 天

---

### 5. 合并 `project_events` 和 `audit_logs`

**问题**：
- 两个表都记录事件/操作
- 职责重叠，数据分散

**目标设计**：
```typescript
// unified_events (统一事件表)
- id, timestamp
- eventType ('audit' | 'project' | 'system')
- action
- userId, organizationId
- resourceType, resourceId
- metadata (JSONB)
- ipAddress, userAgent
- severity
```

**预计工作量**: 1.5 天

---

### 6. 简化 `git_sync_logs` 枚举设计

**问题**：
- 使用了 6 个 PostgreSQL 枚举类型
- 修改枚举需要数据库迁移
- 过度工程化

**改进方案**：
- 枚举改为普通 `text` 类型
- 在应用层用 Zod 验证
- 保持灵活性

**预计工作量**: 0.5 天

---

## 🟢 P2 - 长期优化（轻微问题）

### 7. 统一命名规范

**问题**：
- 状态字段：`status` vs `syncStatus`
- 时间字段：`createdAt` vs `created_at`
- 不一致导致混乱

**目标规范**：
- 统一使用 `camelCase`
- 状态字段统一命名为 `status`
- 时间字段统一为 `createdAt/updatedAt`
- 所有时间戳使用 `withTimezone: true`

**预计工作量**: 1 天

---

### 8. 添加数据库文档

**内容**：
- 每个表的用途说明
- 字段含义
- 关联关系图
- 使用示例

**预计工作量**: 1 天

---

## 执行计划

### 阶段 1：紧急修复（1 周）
- [ ] 合并 `oauth_accounts` 和 `user_git_accounts`
- [ ] 清理 `repositories` 表 Flux 字段
- [ ] 删除 `projects` 表 Git 字段

### 阶段 2：架构优化（2 周）
- [ ] 简化 `project_git_auth` 设计
- [ ] 合并 `project_events` 和 `audit_logs`
- [ ] 简化 `git_sync_logs` 枚举

### 阶段 3：规范统一（1 周）
- [ ] 统一命名规范
- [ ] 添加数据库文档

---

## 风险评估

**高风险**：
- 合并 `oauth_accounts` 和 `user_git_accounts` - 影响范围大
- 需要充分测试，确保不影响登录和 Git 操作

**中风险**：
- 删除 `projects` 表字段 - 可能影响前端显示
- 需要更新所有查询逻辑

**低风险**：
- 命名规范统一 - 主要是代码修改，逻辑不变

---

## 回滚策略

每个阶段都需要：
1. 创建数据库备份
2. 保留迁移脚本的回滚版本
3. 灰度发布，先在测试环境验证
4. 准备快速回滚方案

---

## 成功标准

- [ ] 所有表职责清晰，无功能重复
- [ ] 命名规范统一
- [ ] 代码更简洁，易维护
- [ ] 无数据丢失
- [ ] 所有功能正常运行
- [ ] 性能无明显下降

---

## 相关文档

- [项目指南](../../.kiro/steering/project-guide.md)
- [数据库 Schema](../../packages/core/src/database/schemas/)
- [Drizzle ORM 文档](https://orm.drizzle.team/)


---

## 补充分析（2024-12-18）

### 9. 中等问题：`deployments` 表的 GitOps 字段设计不清晰

**问题**：
```typescript
// deployments 表
gitopsResourceId: uuid('gitops_resource_id').references(() => gitopsResources.id),
deploymentMethod: text('deployment_method').default('manual'), // 'manual' | 'gitops-ui' | 'gitops-git' | 'pipeline'
gitCommitSha: text('git_commit_sha'), // 用于 GitOps 的完整 commit SHA
commitHash: text('commit_hash').notNull(),
```

**分析**：
1. **字段职责不清**：
   - `gitopsResourceId` 关联到 `gitops_resources` 表（Flux 资源）
   - `gitCommitSha` 和 `commitHash` 都存储 commit hash，重复且混乱
   - 不清楚什么时候用哪个字段

2. **部署方法混乱**：
   - `deploymentMethod` 有 4 种值：`manual`, `gitops-ui`, `gitops-git`, `pipeline`
   - 但实际上 GitOps 的核心是 Git 驱动，不应该区分 UI 和 Git
   - `pipeline` 和 GitOps 也不是互斥的关系

3. **与 GitOps 资源的关系不清**：
   - 从 `gitops_resources` 表可以看出：`Environment 1:1 GitOpsResource`
   - 但 `deployments` 表也有 `gitopsResourceId`，这意味着 `Deployment N:1 GitOpsResource`
   - 这个关系是合理的，但字段命名和用途需要更清晰

**影响**：中等
- 导致 GitOps 部署流程不清晰
- 前端难以正确展示部署状态
- 后端逻辑容易出错

**建议**：
1. **明确部署模型**：
   ```
   Project 1:N Environment
   Environment 1:1 GitOpsResource (Kustomization)
   Environment 1:N Deployment (部署历史记录)
   Deployment N:1 GitOpsResource (关联到环境的 Kustomization)
   ```

2. **调整字段设计**：
   ```typescript
   // deployments 表
   {
     // 保留 gitopsResourceId（关联到环境的 Kustomization）
     gitopsResourceId: uuid('gitops_resource_id').references(() => gitopsResources.id),
     
     // 删除 gitCommitSha（与 commitHash 重复）
     // 统一使用 commitHash
     commitHash: text('commit_hash').notNull(),
     
     // 简化部署方法
     deploymentMethod: text('deployment_method').default('gitops'), // 'gitops' | 'manual'
     // gitops = Flux 自动同步触发
     // manual = 用户手动触发（通过 UI 或 API）
   }
   ```

**预计工作量**: 0.5 天

---

### 10. 轻微问题：`environments` 表的 GitOps 配置设计

**当前设计**：
```typescript
// environments 表
config: jsonb('config').$type<{
  gitops?: {
    enabled: boolean
    autoSync: boolean
    gitBranch: string
    gitPath: string
    syncInterval: string
  }
}>()
```

**分析**：
1. **GitOps 配置存储在 JSONB 中**：
   - 无法高效查询"所有启用 GitOps 的环境"
   - 无法建立索引优化查询

2. **与 `gitops_resources` 表的关系**：
   - `gitops_resources` 表已经存储了 Kustomization 的配置（path, interval 等）
   - `environments.config.gitops` 中的配置与 `gitops_resources.config` 重复
   - 数据冗余，可能不一致

3. **缺少直接关联**：
   - `environments` 表没有 `gitopsResourceId` 字段
   - 需要通过 `gitops_resources.environmentId` 反向查询
   - 不够直观

**影响**：轻微
- 查询性能稍差
- 数据可能不一致
- 代码逻辑稍复杂

**建议**：
1. **添加直接关联**：
   ```typescript
   // environments 表
   {
     // 添加 GitOps 资源关联
     gitopsResourceId: uuid('gitops_resource_id').references(() => gitopsResources.id),
     
     // 简化 config，移除 gitops 配置（已在 gitops_resources 中）
     config: jsonb('config').$type<{
       cloudProvider?: 'aws' | 'gcp' | 'azure'
       region?: string
       approvalRequired: boolean
       minApprovals: number
     }>()
   }
   ```

2. **优势**：
   - 关系更清晰：`Environment 1:1 GitOpsResource`
   - 避免数据冗余
   - 查询更高效

**预计工作量**: 0.5 天

---

### 11. 中等问题：`projects` 表的初始化状态设计

**问题**：
```typescript
// projects 表
initializationStatus: jsonb('initialization_status').$type<{
  step: string // 当前步骤
  progress: number // 0-100
  error?: string // 错误信息
  completedSteps: string[] // 已完成的步骤
  jobId?: string // 异步任务 ID，用于 SSE 连接
}>(),
```

**分析**：
1. **状态存储在 JSONB 中**：
   - 无法高效查询"所有初始化失败的项目"
   - 无法建立索引优化查询
   - 类型安全性差（依赖运行时验证）

2. **与 `status` 字段重复**：
   ```typescript
   status: text('status').notNull().default('active'), // 'initializing', 'active', 'inactive', 'archived', 'failed'
   ```
   - `status` 有 `initializing` 和 `failed` 状态
   - `initializationStatus` 也记录初始化状态
   - 两者容易不一致

3. **缺少时间戳**：
   - 无法知道初始化开始时间
   - 无法计算初始化耗时
   - 无法清理长时间卡住的初始化任务

**影响**：中等
- 查询性能差
- 状态管理混乱
- 难以监控和调试

**建议**：
1. **拆分为独立表**：
   ```typescript
   // project_initialization_steps 表
   {
     id: uuid('id').primaryKey(),
     projectId: uuid('project_id').references(() => projects.id),
     step: text('step').notNull(), // 'create_repo', 'setup_flux', 'create_environments'
     status: text('status').notNull(), // 'pending', 'running', 'success', 'failed'
     progress: integer('progress').default(0), // 0-100
     error: text('error'),
     startedAt: timestamp('started_at'),
     completedAt: timestamp('completed_at'),
     createdAt: timestamp('created_at').defaultNow(),
   }
   ```

2. **简化 `projects` 表**：
   ```typescript
   // projects 表 - 只保留最终状态
   {
     status: text('status').notNull().default('initializing'),
     initializationJobId: text('initialization_job_id'), // BullMQ job ID
     initializationStartedAt: timestamp('initialization_started_at'),
     initializationCompletedAt: timestamp('initialization_completed_at'),
     initializationError: text('initialization_error'),
   }
   ```

3. **优势**：
   - 可以高效查询初始化历史
   - 可以建立索引优化查询
   - 状态管理清晰
   - 支持重试和调试
   - 前端可以实时展示每个步骤的进度

**预计工作量**: 1.5 天

---

### 12. 轻微问题：`gitops_resources` 表的状态字段

**当前设计**：
```typescript
// gitops_resources 表
status: text('status').notNull().default('pending'), // 'pending', 'ready', 'reconciling', 'failed'
lastAppliedRevision: text('last_applied_revision'),
lastAttemptedRevision: text('last_attempted_revision'),
errorMessage: text('error_message'),
```

**分析**：
1. **缺少时间戳**：
   - 无法知道状态最后更新时间
   - 无法判断资源是否长时间卡在某个状态
   - 难以调试和监控

2. **状态值不够丰富**：
   - Flux 的实际状态更复杂：`Reconciling`, `Stalled`, `Ready`, `Failed`
   - 当前设计过于简化

**建议**：
```typescript
// gitops_resources 表
{
  status: text('status').notNull().default('pending'),
  statusReason: text('status_reason'), // 状态原因（来自 Flux）
  statusMessage: text('status_message'), // 详细消息
  lastStatusUpdateAt: timestamp('last_status_update_at'), // 状态最后更新时间
  
  lastAppliedRevision: text('last_applied_revision'),
  lastAppliedAt: timestamp('last_applied_at'), // 最后应用时间
  
  lastAttemptedRevision: text('last_attempted_revision'),
  lastAttemptedAt: timestamp('last_attempted_at'), // 最后尝试时间
  
  errorMessage: text('error_message'),
}
```

**预计工作量**: 0.5 天

---

## 更新后的优先级分类

**P0 - 严重问题（需要立即修复）**：
1. `oauth_accounts` vs `user_git_accounts` 功能重复
2. `repositories` 表混合业务数据和 Flux 状态
3. `projects` 表存储冗余的 Git 信息

**P1 - 中等问题（计划修复）**：
4. `project_git_auth` 表设计过于复杂
5. `project_events` vs `audit_logs` 职责重叠
6. `git_sync_logs` 过度工程化
7. `deployments` 表的 GitOps 字段设计不清晰
8. `projects` 表的初始化状态设计

**P2 - 轻微问题（优化改进）**：
9. 状态字段命名不一致
10. 时间戳字段不一致
11. `environments` 表的 GitOps 配置设计
12. `gitops_resources` 表的状态字段

---

## 更新后的执行计划

### 阶段 1：紧急修复（1 周）
- [ ] 合并 `oauth_accounts` 和 `user_git_accounts`
- [ ] 清理 `repositories` 表 Flux 字段
- [ ] 删除 `projects` 表 Git 字段

### 阶段 2：架构优化（2-3 周）
- [ ] 简化 `project_git_auth` 设计
- [ ] 合并 `project_events` 和 `audit_logs`
- [ ] 简化 `git_sync_logs` 枚举
- [ ] 清理 `deployments` 表的 GitOps 字段
- [ ] 拆分 `projects.initializationStatus` 为独立表

### 阶段 3：规范统一（1 周）
- [ ] 统一命名规范
- [ ] 添加数据库文档
- [ ] 优化 `environments` 表的 GitOps 关联
- [ ] 完善 `gitops_resources` 表的状态字段

**总预计工作量**: 4-5 周

---

## 关键发现总结

通过完整分析所有数据库表，发现了以下关键问题：

1. **数据冗余严重**：
   - Git 信息在 `projects`, `repositories`, `oauth_accounts`, `user_git_accounts` 多处存储
   - GitOps 配置在 `environments.config` 和 `gitops_resources.config` 重复
   - 初始化状态在 `projects.status` 和 `projects.initializationStatus` 重复

2. **关系不清晰**：
   - `Environment` 和 `GitOpsResource` 的关系没有直接外键
   - `Deployment` 和 `GitOpsResource` 的关系不明确
   - 多个表都存储 Git OAuth token，不知道该用哪个

3. **状态管理混乱**：
   - 状态字段命名不一致（`status`, `syncStatus`, `fluxSyncStatus`）
   - 状态值不统一（有的用枚举，有的用字符串）
   - 缺少状态更新时间戳

4. **JSONB 滥用**：
   - 很多应该是独立字段的数据存储在 JSONB 中
   - 导致无法建立索引、无法高效查询
   - 类型安全性差

5. **缺少时间戳**：
   - 很多状态字段没有对应的时间戳
   - 难以监控和调试
   - 无法计算耗时

这些问题的根本原因是：**设计时没有充分考虑关系模型，过度依赖 JSONB 的灵活性**。

重构的核心目标是：**回归关系型数据库的设计原则，建立清晰的实体关系，避免数据冗余**。
