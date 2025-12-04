# Git 平台集成功能恢复计划

## 问题概述

在修复循环依赖后，Git 平台集成功能被临时禁用，导致：
- 43 个 TypeScript 错误（Web 应用）
- 多个 tRPC 端点缺失
- 前端组件无法正常工作

## 架构分析

### 当前架构状态

```
✅ 正常运行的部分：
├── API Gateway (NestJS)
├── 三层服务架构
│   ├── Foundation Layer (基础层)
│   ├── Business Layer (业务层)
│   └── Extensions Layer (扩展层)
├── 事件驱动架构
│   ├── ProjectMembersService → Events
│   └── GitSyncEventHandler → GitSyncService
└── 核心功能
    ├── 项目管理
    ├── 用户管理
    └── 认证授权

⚠️ 被禁用的部分：
├── GitPlatformSyncService (webhook 处理)
├── ProjectCollaborationSyncService (项目协作同步)
├── OrganizationEventHandler (组织同步)
└── Git-sync Router 端点
    ├── getProjectSyncLogs
    ├── syncProjectMembers
    ├── retrySyncTask
    ├── getGitAccountStatus
    ├── getOAuthUrl
    └── unlinkGitAccount
```

### 根本原因

1. **Schema 不匹配**
   - `GitPlatformSyncService` 使用的 metadata 结构与 schema 定义不一致
   - 旧代码使用 `role` 字段，新 schema 使用 `systemRole`

2. **循环依赖遗留问题**
   - 虽然主要循环依赖已解决，但 Git 平台集成功能的依赖关系仍需重新设计

3. **功能耦合度高**
   - Webhook 处理、Git 同步、项目成员管理耦合在一起
   - 缺乏清晰的边界和职责划分

## 架构设计原则

### 1. 单一职责原则

每个服务只负责一个明确的职责：

- **GitSyncService**: 管理 Git 同步任务（队列、状态、日志）
- **GitPlatformSyncService**: 处理 Git 平台 webhook 事件
- **ProjectCollaborationSyncService**: 同步项目协作状态
- **OrganizationSyncService**: 同步组织信息

### 2. 事件驱动通信

使用事件解耦服务间的直接依赖：

```typescript
// 项目成员变更 → 事件 → Git 同步
ProjectMembersService.addMember()
  → emit('project.member.added')
  → GitSyncEventHandler.handleMemberAdded()
  → GitSyncService.syncProjectMember()

// Webhook 事件 → 事件 → 项目成员更新
WebhookController.handleWebhook()
  → WebhookEventProcessor.process()
  → emit('git.member.updated')
  → ProjectMemberEventHandler.handleGitMemberUpdated()
  → ProjectMembersService.updateMember()
```

### 3. 依赖倒置

高层模块不应依赖低层模块，都应依赖抽象：

```typescript
// ❌ 错误：直接依赖具体实现
class WebhookService {
  constructor(
    private projectMembers: ProjectMembersService,
    private gitSync: GitSyncService,
  ) {}
}

// ✅ 正确：依赖事件总线（抽象）
class WebhookService {
  constructor(
    private eventEmitter: EventEmitter2,
  ) {}
  
  async handleWebhook(event: WebhookEvent) {
    // 发出事件，不直接调用其他服务
    this.eventEmitter.emit('git.webhook.received', event)
  }
}
```

## 恢复方案

### 阶段 1：修复 Schema 不匹配（优先级：高）

**目标**：让被禁用的服务可以正常编译和运行

**步骤**：

1. **修复 GitPlatformSyncService**
   ```typescript
   // 修改 metadata 结构，使用 systemRole 而非 role
   metadata: {
     systemRole: member.role,  // ✅ 正确
     // role: member.role,     // ❌ 错误
   }
   ```

2. **修复 ProjectCollaborationSyncService**
   - 对齐 metadata 字段
   - 确保类型定义一致

3. **验证修复**
   ```bash
   bun run build --filter='@juanie/service-business'
   ```

### 阶段 2：恢复 tRPC Router 端点（优先级：高）

**目标**：让前端组件可以正常调用后端 API

**需要恢复的端点**：

#### git-sync.router.ts

```typescript
export const gitSyncRouter = router({
  // 1. 获取项目同步日志
  getProjectSyncLogs: publicProcedure
    .input(z.object({
      projectId: z.string(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    }))
    .query(async ({ input, ctx }) => {
      // 实现逻辑
    }),

  // 2. 手动触发项目成员同步
  syncProjectMembers: publicProcedure
    .input(z.object({
      projectId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 触发事件，由 GitSyncEventHandler 处理
      ctx.eventEmitter.emit('project.sync.requested', {
        projectId: input.projectId,
      })
    }),

  // 3. 重试失败的同步任务
  retrySyncTask: publicProcedure
    .input(z.object({
      syncLogId: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 实现重试逻辑
    }),

  // 4. 获取 Git 账号状态
  getGitAccountStatus: publicProcedure
    .input(z.object({
      provider: z.enum(['github', 'gitlab']),
    }))
    .query(async ({ input, ctx }) => {
      // 查询用户的 Git 账号关联状态
    }),

  // 5. 获取 OAuth 授权 URL
  getOAuthUrl: publicProcedure
    .input(z.object({
      provider: z.enum(['github', 'gitlab']),
    }))
    .query(async ({ input, ctx }) => {
      // 生成 OAuth 授权 URL
    }),

  // 6. 取消关联 Git 账号
  unlinkGitAccount: publicProcedure
    .input(z.object({
      provider: z.enum(['github', 'gitlab']),
    }))
    .mutation(async ({ input, ctx }) => {
      // 删除 Git 账号关联
    }),
})
```

#### gitops.router.ts

```typescript
export const gitopsRouter = router({
  // 1. 创建 GitHub App 凭证
  createGitHubAppCredential: publicProcedure
    .input(z.object({
      projectId: z.string(),
      appId: z.string(),
      installationId: z.string(),
      privateKey: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 实现逻辑
    }),

  // 2. 创建 GitLab Group Token 凭证
  createGitLabGroupTokenCredential: publicProcedure
    .input(z.object({
      projectId: z.string(),
      groupId: z.string(),
      token: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 实现逻辑
    }),

  // 3. 创建 PAT 凭证
  createPATCredential: publicProcedure
    .input(z.object({
      projectId: z.string(),
      provider: z.enum(['github', 'gitlab']),
      token: z.string(),
    }))
    .mutation(async ({ input, ctx }) => {
      // 实现逻辑
    }),

  // 4. 检查凭证健康状态
  checkCredentialHealth: publicProcedure
    .input(z.object({
      projectId: z.string(),
    }))
    .query(async ({ input, ctx }) => {
      // 实现逻辑
    }),
})
```

### 阶段 3：实现组织同步功能（优先级：中）

**目标**：完善组织级别的 Git 平台集成

**步骤**：

1. **实现 OrganizationEventHandler 方法**
   ```typescript
   @Injectable()
   export class OrganizationEventHandler {
     @OnEvent('organization.created')
     async handleOrganizationCreated(event: OrganizationCreatedEvent) {
       // 实现组织创建后的 Git 同步逻辑
     }

     @OnEvent('organization.member.added')
     async handleMemberAdded(event: OrganizationMemberAddedEvent) {
       // 实现组织成员添加后的 Git 同步逻辑
     }
   }
   ```

2. **测试组织同步流程**

### 阶段 4：优化和重构（优先级：低）

**目标**：提升代码质量和可维护性

**改进点**：

1. **统一错误处理**
   - 创建统一的 Git 同步错误类型
   - 实现错误重试策略
   - 添加错误恢复机制

2. **改进日志记录**
   - 使用结构化日志
   - 添加追踪 ID
   - 记录关键操作步骤

3. **性能优化**
   - 批量处理同步任务
   - 实现增量同步
   - 添加缓存机制

## 实施计划

### Week 1: 修复核心功能

- [ ] Day 1-2: 修复 Schema 不匹配
  - 修复 GitPlatformSyncService
  - 修复 ProjectCollaborationSyncService
  - 运行测试验证

- [ ] Day 3-4: 恢复 git-sync router 端点
  - 实现 getProjectSyncLogs
  - 实现 syncProjectMembers
  - 实现 retrySyncTask

- [ ] Day 5: 恢复 gitops router 端点
  - 实现凭证管理端点
  - 实现健康检查端点

### Week 2: 完善功能

- [ ] Day 1-2: 实现组织同步
  - 实现 OrganizationEventHandler
  - 测试组织同步流程

- [ ] Day 3-4: 前端集成测试
  - 测试所有 Git 平台集成组件
  - 修复前端类型错误
  - 端到端测试

- [ ] Day 5: 文档和清理
  - 更新 API 文档
  - 清理临时代码
  - 代码审查

## 验收标准

### 功能验收

- [ ] API Gateway 正常运行
- [ ] 所有 tRPC 端点可访问
- [ ] Web 应用类型检查通过（0 错误）
- [ ] Git 平台同步功能正常工作
- [ ] Webhook 处理正常
- [ ] 组织同步功能正常

### 质量验收

- [ ] 单元测试覆盖率 > 80%
- [ ] 集成测试通过
- [ ] 性能测试通过
- [ ] 安全审计通过

### 文档验收

- [ ] API 文档完整
- [ ] 架构文档更新
- [ ] 故障排查指南更新
- [ ] 开发指南更新

## 风险和缓解措施

### 风险 1：Schema 变更影响现有数据

**缓解措施**：
- 创建数据迁移脚本
- 在测试环境验证
- 保留旧数据备份

### 风险 2：事件驱动架构的复杂性

**缓解措施**：
- 详细的事件文档
- 事件追踪和监控
- 完善的错误处理

### 风险 3：性能问题

**缓解措施**：
- 性能测试
- 监控和告警
- 优化查询和索引

## 相关文档

- [循环依赖修复](./circular-dependency-fix.md)
- [TypeScript 错误修复总结](./typescript-errors-fix-summary.md)
- [Git 平台集成任务列表](../../.kiro/specs/git-platform-integration/tasks.md)
- [三层服务架构](../../.kiro/steering/structure.md)

## 总结

通过系统化的恢复计划，我们将：

1. **修复技术债务** - 解决 Schema 不匹配和循环依赖遗留问题
2. **恢复核心功能** - 让 Git 平台集成功能重新可用
3. **提升架构质量** - 使用事件驱动架构和依赖倒置原则
4. **完善文档** - 确保团队理解新架构

**预期成果**：
- ✅ Web 应用类型检查通过
- ✅ Git 平台集成功能完全恢复
- ✅ 架构更加清晰和可维护
- ✅ 为未来扩展打下良好基础
