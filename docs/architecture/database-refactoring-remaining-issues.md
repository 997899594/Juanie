# 数据库重构 - 剩余问题清单

> 生成时间: 2024-12-19
> 状态: 待修复

## 问题概述

Schema 已经更新完成，但代码中还在使用已删除的字段，导致编译失败。

## 需要修复的文件

### 1. projects 表字段（已删除）

以下字段已从 `projects` 表删除，需要通过 `repositories` 表关联查询：
- `gitProvider` → 通过 `repository.provider` 获取
- `gitRepoUrl` → 通过 `repository.cloneUrl` 获取
- `gitRepoName` → 通过 `repository.fullName` 获取
- `gitDefaultBranch` → 通过 `repository.defaultBranch` 获取

**受影响的文件**：
- `packages/services/business/src/gitops/git-sync/project-collaboration-sync.service.ts` (4处)
- `packages/services/business/src/gitops/webhooks/git-platform-sync.service.ts` (8处)

### 2. repositories 表 Flux 字段（已删除）

以下字段已从 `repositories` 表删除，Flux 状态应从 `gitops_resources` 表查询：
- `fluxSyncStatus` → 使用 `syncStatus`
- `fluxLastSyncCommit` → 已删除
- `fluxLastSyncTime` → 已删除
- `fluxErrorMessage` → 已删除

**受影响的文件**：
- `packages/services/business/src/repositories/repositories.service.ts` (6处)

### 3. Git 账号字段重命名

以下字段已重命名：
- `gitUserId` → `providerAccountId`
- `gitUsername` → `username`
- `gitEmail` → `email`
- `gitAvatarUrl` → `avatarUrl`
- `syncStatus` → `status`

**受影响的文件**：
- `packages/services/business/src/gitops/git-sync/conflict-resolution.service.ts`
- `packages/services/business/src/gitops/git-sync/project-collaboration-sync.service.ts`
- 测试文件 (*.spec.ts) - 可暂时忽略

## 修复策略

### 策略 1: 通过关联查询获取 Git 信息

对于 `project.gitProvider` 等字段，需要：
1. 在查询 project 时，同时查询关联的 repository
2. 从 repository 中获取 Git 信息

```typescript
// 修改前
const provider = project.gitProvider

// 修改后
const repository = await db.query.repositories.findFirst({
  where: eq(schema.repositories.projectId, project.id)
})
const provider = repository?.provider
```

### 策略 2: 删除 Flux 字段引用

对于 `repository.fluxSyncStatus` 等字段：
1. 使用 `repository.syncStatus` 替代 `fluxSyncStatus`
2. 删除对 `fluxLastSyncCommit`、`fluxLastSyncTime`、`fluxErrorMessage` 的引用
3. 如需详细 Flux 状态，从 `gitops_resources` 表查询

### 策略 3: 更新字段名

对于重命名的字段，直接替换即可。

## 下一步行动

1. ✅ 修复 `git-connections.service.ts` 的 Logger 问题
2. ⏳ 修复 `project-collaboration-sync.service.ts` 中的 gitProvider 引用
3. ⏳ 修复 `git-platform-sync.service.ts` 中的 gitProvider 和 gitRepoUrl 引用
4. ⏳ 修复 `repositories.service.ts` 中的 Flux 字段引用
5. ⏳ 修复 `conflict-resolution.service.ts` 中的字段名
6. ⏳ 运行完整编译测试
7. ⏳ 应用数据库迁移
8. ⏳ 启动开发环境测试

## 预计工作量

- 修复代码: 1-2 小时
- 测试验证: 30 分钟
- 总计: 1.5-2.5 小时
