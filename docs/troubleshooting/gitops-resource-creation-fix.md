# GitOps 资源创建修复

**日期**: 2025-01-22  
**状态**: ✅ 已完成

## 问题描述

项目初始化后，环境（Environments）和 GitOps 资源显示数量为 0，未正确创建。

## 根本原因

1. **环境创建逻辑缺失** - `ProjectInitializationService` 中完全没有创建环境的步骤
2. **GitOps 资源创建被注释** - `setupGitOps` 步骤中的实现被注释为 TODO
3. **数据库 Schema 问题** - `gitopsResources` 表的 `environmentId` 和 `repositoryId` 字段被错误地设置为 `NOT NULL`，导致 GitRepository 资源（不属于特定环境）无法插入

## 解决方案

### 1. 添加环境创建步骤

在 `ProjectInitializationService` 中添加 `create_environments` 步骤：

```typescript
{
  name: 'create_environments',
  displayName: '创建环境',
  weight: 15,
  execute: this.createEnvironments.bind(this),
}
```

实现创建 3 个默认环境（Development, Staging, Production）：

```typescript
private async createEnvironments(ctx: InitializationContext): Promise<void> {
  const defaultEnvironments = [
    { type: 'development', name: 'Development', description: '开发环境' },
    { type: 'staging', name: 'Staging', description: '预发布环境' },
    { type: 'production', name: 'Production', description: '生产环境' },
  ]

  for (const env of defaultEnvironments) {
    await this.environments.createEnvironment({
      projectId: ctx.projectId,
      ...env,
    })
  }
}
```

### 2. 创建 FluxResourcesService

创建专门的服务来管理 GitOps 资源，遵循架构原则：

**文件**: `packages/services/business/src/gitops/flux/flux-resources.service.ts`

**职责**:
- 为项目创建 GitOps 资源（GitRepository + Kustomization）
- 管理 Git 认证 Secret
- 同步资源状态到数据库

**架构设计**:
- ✅ 使用 Core 层的 `K8sClientService` 操作 K8s
- ✅ 使用 `YamlGeneratorService` 生成 YAML
- ✅ 使用 `customObjectsApi` 创建 Flux Custom Resources
- ✅ 不重复造轮子，利用上游服务

**核心方法**:

```typescript
async setupProjectGitOps(options: {
  projectId: string
  repositoryId: string
  repositoryUrl: string
  repositoryBranch: string
  environments: Array<{ id: string; type: string; name: string }>
  gitToken?: string
}): Promise<{
  gitRepository: { id: string; name: string }
  kustomizations: Array<{ id: string; name: string; environmentId: string }>
}>
```

### 3. 修复数据库 Schema

**问题**: `environmentId` 和 `repositoryId` 被设置为 `NOT NULL`，但 GitRepository 资源不属于特定环境。

**修复**: 将这两个字段改为可选：

```typescript
// packages/database/src/schemas/gitops/gitops-resources.schema.ts
export const gitopsResources = pgTable('gitops_resources', {
  // ...
  environmentId: uuid('environment_id')
    .references(() => environments.id, { onDelete: 'cascade' }), // ✅ 可选
  repositoryId: uuid('repository_id')
    .references(() => repositories.id, { onDelete: 'cascade' }), // ✅ 可选
  // ...
})
```

**迁移**: `packages/database/src/migrations/0004_robust_living_tribunal.sql`

```sql
ALTER TABLE "gitops_resources" ALTER COLUMN "environment_id" DROP NOT NULL;
ALTER TABLE "gitops_resources" ALTER COLUMN "repository_id" DROP NOT NULL;
```

### 4. 修复枚举重复导出

**问题**: `gitProviderEnum` 在两个文件中重复定义，导致 TypeScript 编译错误。

**修复**: 在 `git-sync-logs.schema.ts` 中导入而不是重新定义：

```typescript
// packages/database/src/schemas/gitops/git-sync-logs.schema.ts
import { gitProviderEnum } from '../repository/repositories.schema'
// ✅ 复用 repositories.schema.ts 中的 gitProviderEnum
```

### 5. 更新 FluxModule

移除不必要的 `DatabaseModule` 导入（通过 `@Inject(DATABASE)` 直接注入）：

```typescript
@Global()
@Module({
  imports: [
    ConfigModule,
    CoreFluxModule, // ✅ 导入 Core 层 FluxModule
    K8sModule,      // ✅ 导入 Core 层 K8sModule
  ],
  providers: [
    FluxMetricsService,
    YamlGeneratorService,
    FluxResourcesService, // ✅ 新增
  ],
  exports: [
    FluxMetricsService,
    YamlGeneratorService,
    FluxResourcesService, // ✅ 导出
    CoreFluxModule,
    K8sModule,
  ],
})
export class FluxModule {}
```

### 6. 添加 K8s Custom Objects API 方法

**问题**: `BunK8sClientService` 缺少 `getCustomObjectsApi()` 方法，导致运行时错误。

**修复**: 在 `BunK8sClientService` 中添加兼容方法：

```typescript
// packages/core/src/k8s/bun-k8s-client.service.ts
getCustomObjectsApi() {
  return {
    createNamespacedCustomObject: this.createNamespacedCustomObject.bind(this),
    deleteNamespacedCustomObject: this.deleteNamespacedCustomObject.bind(this),
    patchNamespacedCustomObject: this.patchNamespacedCustomObject.bind(this),
    getNamespacedCustomObject: this.getNamespacedCustomObject.bind(this),
    listNamespacedCustomObject: this.listNamespacedCustomObject.bind(this),
  }
}
```

### 7. 重新编译包

由于修改了 Core 层代码，需要重新编译：

```bash
# 编译 Core 层
cd packages/core
bun run build

# 编译 Business 层
cd packages/services/business
bun run build

# 编译 API Gateway
cd apps/api-gateway
bun run build
```

## 验证步骤

1. ✅ 数据库迁移已应用
2. ✅ TypeScript 编译通过（无错误）
3. ✅ 所有服务正确注入和导出
4. ✅ 初始化流程包含环境创建和 GitOps 资源创建步骤
5. ✅ `BunK8sClientService` 添加了 `getCustomObjectsApi()` 方法
6. ✅ 所有包已重新编译

## 测试建议

### 1. 重启 API 服务

```bash
# 停止当前服务（如果正在运行）
# Ctrl+C

# 重新启动
bun run dev:api
```

### 2. 创建测试项目

```bash
# 通过 API 创建新项目
curl -X POST http://localhost:3000/api/trpc/projects.create \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Test GitOps Project",
    "slug": "test-gitops",
    "description": "Testing GitOps resource creation",
    "repository": {
      "provider": "github",
      "name": "test-gitops-repo",
      "visibility": "private"
    }
  }'
```

### 3. 验证数据库记录

```sql
-- 1. 检查环境是否创建
SELECT id, name, type, status 
FROM environments 
WHERE project_id = '<project_id>';
-- 应该看到 3 个环境：Development, Staging, Production

-- 2. 检查 GitOps 资源是否创建
SELECT id, type, name, namespace, status, environment_id, repository_id
FROM gitops_resources 
WHERE project_id = '<project_id>';
-- 应该看到：
-- 1 个 git-repository (environment_id = NULL)
-- 3 个 kustomization (每个有对应的 environment_id)

-- 3. 检查初始化步骤
SELECT step, display_name, status, progress, duration
FROM project_initialization_steps
WHERE project_id = '<project_id>'
ORDER BY sequence;
-- 应该看到所有步骤都是 'completed' 状态
```

### 4. 验证 K8s 资源

```bash
# 获取项目的 namespace（使用项目 ID 前 8 位）
PROJECT_SHORT_ID="<project_id 前 8 位>"

# 检查 GitRepository 资源
kubectl get gitrepositories -n project-${PROJECT_SHORT_ID}
kubectl describe gitrepository -n project-${PROJECT_SHORT_ID}

# 检查 Kustomization 资源
kubectl get kustomizations -n project-${PROJECT_SHORT_ID}
kubectl describe kustomizations -n project-${PROJECT_SHORT_ID}

# 检查资源状态
kubectl get gitrepositories,kustomizations -n project-${PROJECT_SHORT_ID} -o wide
```

### 5. 预期结果

✅ **数据库**:
- 3 个环境记录（Development, Staging, Production）
- 4 个 GitOps 资源记录（1 GitRepository + 3 Kustomizations）
- 所有初始化步骤状态为 `completed`

✅ **K8s 集群**:
- 1 个 GitRepository 资源（状态: Ready 或 Pending）
- 3 个 Kustomization 资源（每个环境一个）
- 所有资源在正确的 namespace 中

✅ **API 日志**:
- 无 `getCustomObjectsApi is not a function` 错误
- 看到 "Created GitRepository" 和 "Created Kustomization" 日志
- 看到 "GitOps setup completed" 日志

## 相关文件

- `packages/services/business/src/projects/initialization/initialization.service.ts`
- `packages/services/business/src/gitops/flux/flux-resources.service.ts` (新增)
- `packages/services/business/src/gitops/flux/flux.module.ts`
- `packages/database/src/schemas/gitops/gitops-resources.schema.ts`
- `packages/database/src/schemas/gitops/git-sync-logs.schema.ts`
- `packages/database/src/migrations/0004_robust_living_tribunal.sql`

## 架构改进

1. **关注点分离** - GitOps 资源管理独立为 `FluxResourcesService`
2. **利用上游服务** - 直接使用 Core 层的 `K8sClientService` 和 `customObjectsApi`
3. **类型安全** - 修复 Schema 定义，避免 `null` 类型错误
4. **避免重复** - 复用 `gitProviderEnum` 定义
5. **完整流程** - 初始化包含环境创建和 GitOps 资源创建

## 经验教训

1. **Schema 设计要考虑实际使用场景** - 不是所有资源都属于特定环境
2. **枚举定义应该集中管理** - 避免重复定义导致冲突
3. **使用官方 API** - `customObjectsApi` 而不是 `getCoreApi()`
4. **类型推断依赖 Schema 定义** - 修改 Schema 后需要重新构建
