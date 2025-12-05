# TODO 清理 - GitHub Issues 清单

> 从代码中提取的 TODO 注释，需要创建 GitHub Issues 追踪

**生成日期:** 2025-12-05  
**总计:** 11 个功能性 Issues

---

## Issue 1: 文档管理功能

**标题:** 实现文档编辑和创建功能

**描述:**
实现完整的文档管理功能，包括文档编辑和创建。

**位置:**
- `apps/web/src/views/Documents.vue`

**TODO 内容:**
```typescript
// TODO: 实现文档编辑功能
const handleEdit = (doc: Document) => {
  console.log('编辑文档:', doc)
}

// TODO: 实现文档创建功能
const handleCreate = () => {
  console.log('创建文档')
}
```

**需求:**
1. 实现文档编辑对话框
2. 实现文档创建对话框
3. 集成 Markdown 编辑器
4. 支持文档版本控制
5. 实现文档搜索功能

**优先级:** P2  
**工作量:** 3 天

---

## Issue 2: 部署功能增强

**标题:** 实现部署审批和重试功能

**描述:**
增强部署管理功能，添加审批流程和失败重试机制。

**位置:**
- `apps/web/src/views/DeploymentDetail.vue`

**TODO 内容:**
```typescript
// TODO: 实现部署审批 API
const handleApprove = async () => {
  console.log('审批部署')
}

// TODO: 实现部署重试逻辑
const handleRetry = async () => {
  console.log('重试部署')
}
```

**需求:**
1. 后端实现部署审批 API
2. 前端实现审批对话框
3. 实现部署重试逻辑（带指数退避）
4. 添加审批历史记录
5. 支持批量审批

**优先级:** P1  
**工作量:** 2 天

---

## Issue 3: 仓库管理功能

**标题:** 实现仓库详情页和组织项目列表

**描述:**
完善仓库管理功能，添加详情页和组织项目列表。

**位置:**
- `apps/web/src/views/repositories/Repositories.vue`

**TODO 内容:**
```typescript
// TODO: 实现仓库详情页
const handleViewDetails = (repo: Repository) => {
  console.log('查看仓库详情:', repo)
}

// TODO: 实现组织项目列表
const handleViewProjects = (repo: Repository) => {
  console.log('查看组织项目:', repo)
}
```

**需求:**
1. 创建仓库详情页面
2. 显示仓库统计信息（提交数、分支数等）
3. 显示关联的项目列表
4. 实现仓库设置功能
5. 支持仓库归档和删除

**优先级:** P2  
**工作量:** 2 天

---

## Issue 4: 项目成员管理增强

**标题:** 完善项目成员管理功能

**描述:**
增强项目成员管理，添加成员邀请、审批和快速操作功能。

**位置:**
- `apps/web/src/views/ProjectDetail.vue`

**TODO 内容:**
```typescript
// TODO: 实现添加成员对话框
const handleAddMember = () => {
  console.log('添加成员')
}

// TODO: 实现移除成员确认
const handleRemoveMember = (member: ProjectMember) => {
  console.log('移除成员:', member)
}

// TODO: 实现待审批列表 API
const pendingApprovals = ref<ProjectMemberApproval[]>([])

// TODO: 实现快速批准/拒绝逻辑
const handleQuickApprove = async (approval: ProjectMemberApproval) => {
  console.log('快速批准:', approval)
}
```

**需求:**
1. 实现添加成员对话框（支持邮箱邀请）
2. 实现移除成员确认对话框
3. 后端实现待审批列表 API
4. 实现快速批准/拒绝功能
5. 添加成员权限管理
6. 支持批量操作

**优先级:** P1  
**工作量:** 3 天

---

## Issue 5: Git 同步功能

**标题:** 实现组织成员同步 API

**描述:**
实现 Git 平台（GitHub/GitLab）组织成员的自动同步功能。

**位置:**
- `apps/web/src/views/organizations/OrganizationDetail.vue`

**TODO 内容:**
```typescript
// TODO: 实现组织成员同步 API
const handleSyncMembers = async () => {
  console.log('同步组织成员')
}
```

**需求:**
1. 后端实现 GitHub 组织成员同步
2. 后端实现 GitLab Group 成员同步
3. 支持增量同步（只同步变更）
4. 添加同步日志和错误处理
5. 前端显示同步进度和结果

**优先级:** P2  
**工作量:** 2 天

---

## Issue 6: AI 功能增强

**标题:** 实现 AI 操作确认和配置生成

**描述:**
增强 AI 助手功能，添加操作确认对话框和自动生成 Dockerfile/CI 配置。

**位置:**
- `apps/web/src/components/AIAssistant.vue`
- `apps/web/src/composables/useTemplates.ts`

**TODO 内容:**
```typescript
// AIAssistant.vue
// TODO: 实现 AI 操作确认对话框
const handleAIAction = (action: AIAction) => {
  console.log('AI 操作:', action)
}

// useTemplates.ts
// TODO: 实现 AI 生成 Dockerfile
const generateDockerfile = async (projectId: string) => {
  console.log('生成 Dockerfile')
}

// TODO: 实现 AI 生成 CI/CD 配置
const generateCIConfig = async (projectId: string) => {
  console.log('生成 CI/CD 配置')
}
```

**需求:**
1. 实现 AI 操作确认对话框（显示操作详情）
2. 后端实现 AI 生成 Dockerfile API
3. 后端实现 AI 生成 CI/CD 配置 API
4. 支持多种 CI 平台（GitHub Actions, GitLab CI）
5. 添加生成结果预览和编辑功能

**优先级:** P2  
**工作量:** 3 天

---

## Issue 7: 代码审查服务

**标题:** 实现 CodeReviewService

**描述:**
实现完整的 AI 代码审查服务，支持自动代码审查和建议。

**位置:**
- `apps/api-gateway/src/routers/ai-code-review.router.ts`

**TODO 内容:**
```typescript
// TODO: 实现 CodeReviewService
// 当前使用 mock 数据
```

**需求:**
1. 创建 CodeReviewService
2. 集成 AI 模型（Ollama）
3. 实现代码分析逻辑
4. 支持多种编程语言
5. 生成详细的审查报告
6. 添加代码质量评分
7. 支持自定义审查规则

**优先级:** P2  
**工作量:** 4 天

---

## Issue 8: GitOps 功能完善

**标题:** 实现 GitOps 部署和配置管理

**描述:**
完善 GitOps 功能，实现部署、配置提交和变更预览。

**位置:**
- `apps/api-gateway/src/routers/gitops.router.ts`

**TODO 内容:**
```typescript
// TODO: 实现 GitOps 部署逻辑
deploy: protectedProcedure
  .input(z.object({ projectId: z.string() }))
  .mutation(async ({ input }) => {
    // 实现部署逻辑
  }),

// TODO: 实现配置提交逻辑
commitConfig: protectedProcedure
  .input(z.object({ projectId: z.string(), config: z.any() }))
  .mutation(async ({ input }) => {
    // 实现配置提交
  }),

// TODO: 实现变更预览逻辑
previewChanges: protectedProcedure
  .input(z.object({ projectId: z.string() }))
  .query(async ({ input }) => {
    // 实现变更预览
  }),
```

**需求:**
1. 实现 GitOps 部署逻辑（触发 Flux 同步）
2. 实现配置提交到 Git 仓库
3. 实现变更预览（diff 显示）
4. 添加部署前验证
5. 支持回滚功能
6. 添加部署历史记录

**优先级:** P1  
**工作量:** 3 天

---

## Issue 9: Git 冲突检测

**标题:** 实现 Git 冲突检测和解决

**描述:**
实现 Git 平台的冲突检测功能，帮助用户识别和解决冲突。

**位置:**
- `apps/api-gateway/src/routers/git-sync.router.ts`

**TODO 内容:**
```typescript
// TODO: 实现 accessToken 获取逻辑
const accessToken = 'mock-token'

// TODO: 启用冲突检测功能
// const conflicts = await ctx.gitSyncService.detectConflicts(...)
```

**需求:**
1. 实现 OAuth accessToken 获取和刷新
2. 实现 Git 冲突检测逻辑
3. 支持 GitHub 和 GitLab
4. 提供冲突解决建议
5. 添加自动合并功能（简单冲突）
6. 显示冲突详情和 diff

**优先级:** P2  
**工作量:** 3 天

---

## Issue 10: 项目删除功能

**标题:** 实现项目删除时的仓库处理

**描述:**
完善项目删除功能，正确处理关联的 Git 仓库。

**位置:**
- `packages/services/business/src/projects/projects.service.ts`

**TODO 内容:**
```typescript
// TODO: 实现 handleRepositoryOnDelete
// 决定是否删除 Git 仓库，还是只是解除关联
```

**需求:**
1. 实现仓库删除策略（删除 vs 解除关联）
2. 添加用户确认对话框
3. 支持软删除（保留仓库）
4. 支持硬删除（删除仓库）
5. 清理 Kubernetes 资源
6. 清理 Flux GitRepository 资源
7. 添加删除日志

**优先级:** P1  
**工作量:** 2 天

---

## Issue 11: GitLab Group 自动创建

**标题:** 实现 GitLab Group 自动创建功能

**描述:**
实现 GitLab Group 的自动创建，简化组织设置流程。

**位置:**
- `packages/services/business/src/gitops/git-sync/organization-sync.service.ts`

**TODO 内容:**
```typescript
// TODO: 实现 GitLab Group 自动创建
// 当组织在 GitLab 上不存在时，自动创建对应的 Group
```

**需求:**
1. 检测 GitLab Group 是否存在
2. 自动创建 Group（如果不存在）
3. 设置 Group 权限和可见性
4. 同步组织成员到 Group
5. 处理 Group 名称冲突
6. 添加创建日志

**优先级:** P2  
**工作量:** 2 天

---

## 不需要创建 Issue 的 TODO

### A. 已过时/不需要的 TODO

这些 TODO 是 placeholder 注释，不是真正的功能需求：

- `apps/web/src/components/auth-forms/PATAuthForm.vue` - placeholder 注释
- `apps/web/src/components/auth-forms/GitLabGroupAuthForm.vue` - placeholder 注释

**处理方式:** 直接删除或保留（不影响功能）

### B. 等待后端实现的 TODO

这些功能需要等待后端 API 实现：

1. **工作空间 API** (`apps/web/src/stores/workspace.ts`)
   - 等待后端实现工作空间管理 API
   - 当前使用 mock 数据

2. **策略状态更新** (`apps/web/src/composables/useSecurityPolicies.ts`)
   - API 不支持策略状态更新
   - 需要后端添加 API

3. **部署统计** (`apps/api-gateway/src/routers/deployments.router.ts`)
   - 低优先级功能
   - 可以后续实现

4. **活动日志** (`apps/api-gateway/src/routers/projects.router.ts`)
   - 低优先级功能
   - 可以后续实现

**处理方式:** 添加注释说明，标记为 "等待后端实现"

---

## 实施计划

### 第 1 批（P1 优先级）- 1 周

1. Issue 2: 部署功能增强 (2 天)
2. Issue 4: 项目成员管理增强 (3 天)
3. Issue 8: GitOps 功能完善 (3 天)
4. Issue 10: 项目删除功能 (2 天)

**总计:** 10 天（2 周）

### 第 2 批（P2 优先级）- 2 周

1. Issue 1: 文档管理功能 (3 天)
2. Issue 3: 仓库管理功能 (2 天)
3. Issue 5: Git 同步功能 (2 天)
4. Issue 6: AI 功能增强 (3 天)
5. Issue 7: 代码审查服务 (4 天)
6. Issue 9: Git 冲突检测 (3 天)
7. Issue 11: GitLab Group 自动创建 (2 天)

**总计:** 19 天（4 周）

---

## 创建 Issues 的步骤

### 1. 在 GitHub 上创建 Issues

为每个功能创建一个 Issue，使用以下模板：

```markdown
## 描述
[从上面复制描述]

## 位置
[从上面复制位置]

## 需求
[从上面复制需求列表]

## 优先级
[P1/P2]

## 工作量
[X 天]

## 相关文件
- [ ] 文件路径 1
- [ ] 文件路径 2
```

### 2. 添加标签

- `enhancement` - 功能增强
- `p1` 或 `p2` - 优先级
- `frontend` 或 `backend` - 前后端
- `ai` - AI 相关功能
- `gitops` - GitOps 相关

### 3. 分配里程碑

- Milestone 1: P1 功能（2 周）
- Milestone 2: P2 功能（4 周）

### 4. 更新代码中的 TODO

将 TODO 注释更新为：

```typescript
// TODO: [功能名称] - 已创建 Issue #123
// 或
// NOTE: [说明] - 等待后端实现
```

---

## 验收标准

- [ ] 创建 11 个 GitHub Issues
- [ ] 所有 Issues 添加正确的标签和优先级
- [ ] 所有 Issues 分配到对应的里程碑
- [ ] 更新代码中的 TODO 注释
- [ ] 删除过时的 TODO
- [ ] 为等待实现的 TODO 添加说明

---

**最后更新:** 2025-12-05  
**维护者:** AI DevOps Platform Team
