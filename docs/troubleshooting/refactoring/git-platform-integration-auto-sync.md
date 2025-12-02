# Git 平台自动同步集成

## 背景

基于 GitOps 理念,Git 同步应该是默认行为,而不是可选功能。本文档记录将 Git 同步改为默认启用的重构过程。

## 设计理念

### 核心原则
- **Git 同步是默认行为** - 不需要"启用同步"选项
- **自动即时同步** - 所有操作自动同步到 Git 平台
- **透明的同步状态** - 用户能看到同步状态,但不需要手动操作
- **失败时自动重试** - 同步失败时后台自动重试

### 架构设计

```
OrganizationsService (Foundation)
    ↓ 发布事件
OrganizationEventsService
    ↓ 事件总线
OrganizationEventHandler (Business)
    ↓ 队列任务
GitSyncWorker
    ↓ 执行同步
OrganizationSyncService
    ↓ 调用 API
GitProviderService
```

## 已完成的工作

### 1. UI 简化 ✅

**文件**: `apps/web/src/components/CreateOrganizationModal.vue`

- 移除了"启用同步"开关
- 默认 `gitSyncEnabled = true`
- 简化为只选择 Git 平台和组织名称
- 自动填充 Git 组织名称

**文件**: `apps/web/src/components/OrganizationGitSyncStatus.vue`

- 移除"启用同步"按钮
- 只在同步失败时显示"重试"按钮
- 显示同步状态和进度

### 2. 事件驱动架构 ✅

**文件**: `packages/services/foundation/src/organizations/organization-events.service.ts`

创建了事件发布服务,定义了以下事件:
- `organization.created` - 组织创建
- `organization.member.added` - 成员添加
- `organization.member.removed` - 成员移除
- `organization.member.role.updated` - 角色更新

**文件**: `packages/services/foundation/src/organizations/organizations.service.ts`

集成了事件发布:
- `create()` - 发布组织创建事件
- `inviteMember()` - 发布成员添加事件
- `removeMember()` - 发布成员移除事件
- `updateMemberRole()` - 发布角色更新事件

### 3. 事件监听和队列 ✅

**文件**: `packages/services/business/src/gitops/git-sync/organization-event-handler.service.ts`

创建了事件监听器:
- 监听组织事件
- 将同步任务加入队列
- 异步处理,不阻塞主流程

**文件**: `packages/services/business/src/gitops/git-sync/git-sync.service.ts`

添加了队列方法:
- `queueOrganizationSync()` - 队列组织同步任务
- `queueMemberSync()` - 队列成员同步任务

**文件**: `packages/services/business/src/gitops/git-sync/git-sync.worker.ts`

添加了队列处理器:
- `handleOrganizationSync()` - 处理组织同步
- `handleMemberSync()` - 处理成员同步

### 4. 同步服务方法 ✅

**文件**: `packages/services/business/src/gitops/git-sync/organization-sync.service.ts`

添加了单个操作方法:
- `createGitOrganization()` - 创建 Git 组织
- `addMemberToGitOrganization()` - 添加成员到 Git 组织
- `removeMemberFromGitOrganization()` - 从 Git 组织移除成员
- `updateMemberRoleInGitOrganization()` - 更新成员角色

## 待完成的工作

### 1. 修复编译错误 ⚠️

当前存在以下问题:

1. **GitProviderOrgExtensions 不存在**
   - 文件 `git-provider-org-extensions.ts` 只包含函数,不是类
   - 需要创建服务类或直接使用 GitProviderService

2. **类型问题**
   - `organizations` 表缺少 `type` 字段
   - 需要添加工作空间类型字段或使用其他方式区分

3. **syncType 枚举值不匹配**
   - 使用了 `organization_create`, `member_add` 等值
   - 但 schema 中只定义了 `organization`, `project`, `member`
   - 需要更新 schema 或调整代码

### 2. Git 组织创建实现 ⚠️

**问题**: GitHub 个人账号无法通过 API 创建组织

**解决方案**:
- GitHub: 需要用户手动创建组织,然后通过 API 关联
- GitLab: 可以通过 API 创建 Group

**建议流程**:
1. 检测用户是否已有组织
2. 如果没有,提示用户手动创建
3. 提供关联现有组织的功能

### 3. 测试和验证 ⚠️

需要测试以下场景:
1. 创建组织时自动同步
2. 添加成员时自动同步
3. 移除成员时自动同步
4. 更新角色时自动同步
5. 同步失败时的重试机制
6. 同步状态的 UI 显示

## 下一步行动

### 立即修复

1. **移除 GitProviderOrgExtensions 依赖**
   ```typescript
   // 暂时跳过自动创建组织
   // 改为提示用户手动创建后关联
   ```

2. **修复 syncType 枚举**
   ```sql
   -- 更新 git_sync_logs 表的 sync_type 枚举
   ALTER TYPE git_sync_type ADD VALUE 'organization_create';
   ALTER TYPE git_sync_type ADD VALUE 'member_add';
   ALTER TYPE git_sync_type ADD VALUE 'member_remove';
   ALTER TYPE git_sync_type ADD VALUE 'member_update';
   ```

3. **添加工作空间类型字段**
   ```sql
   -- 添加 type 字段到 organizations 表
   ALTER TABLE organizations ADD COLUMN type VARCHAR(20) DEFAULT 'team';
   ```

### 后续优化

1. **实现 GitLab Group 创建**
   - GitLab 支持通过 API 创建 Group
   - 可以实现完整的自动创建流程

2. **GitHub 组织关联**
   - 提供 UI 让用户选择现有组织
   - 验证用户对组织的访问权限
   - 保存组织 ID 和 URL

3. **完善错误处理**
   - 更详细的错误信息
   - 更智能的重试策略
   - 用户友好的错误提示

## 相关文件

### 前端
- `apps/web/src/components/CreateOrganizationModal.vue`
- `apps/web/src/components/OrganizationGitSyncStatus.vue`
- `apps/web/src/views/organizations/OrganizationDetail.vue`

### 后端 - Foundation
- `packages/services/foundation/src/organizations/organizations.service.ts`
- `packages/services/foundation/src/organizations/organization-events.service.ts`
- `packages/services/foundation/src/organizations/organizations.module.ts`

### 后端 - Business
- `packages/services/business/src/gitops/git-sync/organization-event-handler.service.ts`
- `packages/services/business/src/gitops/git-sync/organization-sync.service.ts`
- `packages/services/business/src/gitops/git-sync/git-sync.service.ts`
- `packages/services/business/src/gitops/git-sync/git-sync.worker.ts`
- `packages/services/business/src/gitops/git-sync/git-sync.module.ts`
- `packages/services/business/src/gitops/git-providers/git-providers.module.ts`

## 总结

自动同步集成的核心架构已经完成:
- ✅ 事件驱动架构
- ✅ 队列处理机制
- ✅ UI 简化
- ⚠️ 具体实现需要完善
- ⚠️ 编译错误需要修复

建议先修复编译错误,然后逐步完善具体的同步实现。
