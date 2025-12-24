# Git 凭证服务重构 - 解决 GitHub 用户名获取失败问题

## 问题描述

**现象**：
- 用户创建项目后，K8s 部署失败
- Pod 状态：`ImagePullBackOff`
- 镜像名称错误：`ghcr.io/unknown/xxx:latest`（应该是 `ghcr.io/997899594/xxx:latest`）
- 说明 `githubUsername` 变量使用了默认值 `unknown`

**根本原因**：
有两个 `resolveAccessToken()` 方法，实现不一致：
1. `SetupRepositoryHandler.resolveAccessToken()` - 在创建任务时调用，**没有添加 `username` 字段**
2. `Worker.resolveAccessToken()` - 在执行任务时调用，**有添加 `username` 字段**

因为 Handler 已经解析了 token，传递给 Worker 的 `accessToken` 不是 `__USE_OAUTH__`，Worker 的方法直接返回原始对象，没有机会添加 `username`。

## 设计问题

用户指出："好乱啊 把你都搞晕了"，"这个是否是个常用的功能 是否以后不光是在 worker 使用啊"

**问题分析**：
- ❌ 过度抽象：创建了独立的 `GitCredentialsService`，但只是对 `GitConnectionsService` 的简单包装
- ❌ 职责重叠：两个 Service 都在管理 Git 连接相关的逻辑
- ❌ 增加复杂度：多了一层依赖注入，增加维护成本

## 解决方案（按 NestJS 最佳实践）

### 核心原则
根据业界最佳实践（Stripe SDK、AWS SDK、Prisma）：
- **按领域分组，不是按操作类型拆分**
- **避免过度抽象**
- **Service 应该有明确的职责边界**

### 重构方案：合并到 GitConnectionsService

将 `GitCredentialsService` 的功能合并到 `GitConnectionsService`，因为：
- ✅ 职责清晰：所有 Git 连接相关的逻辑在一个 Service
- ✅ 减少依赖：不需要额外的 Service 注入
- ✅ 更易维护：相关代码在一起
- ✅ 符合单一职责原则：都是 Git 连接管理

### 实施步骤

#### 1. 在 `GitConnectionsService` 中添加方法

```typescript
@Injectable()
export class GitConnectionsService {
  // ... 原有方法 ...

  /**
   * 解析 Git 凭证（统一入口）
   */
  async resolveCredentials(
    userId: string,
    provider: 'github' | 'gitlab',
  ): Promise<{
    accessToken: string
    username: string
    email?: string
  }> {
    const gitConnection = await this.getConnectionWithDecryptedTokens(userId, provider)
    
    // 验证和返回
    if (!gitConnection || !gitConnection.accessToken || !gitConnection.username) {
      throw new Error('Invalid Git connection')
    }

    return {
      accessToken: gitConnection.accessToken,
      username: gitConnection.username,
      email: gitConnection.email,
    }
  }

  /**
   * 解析仓库配置（兼容 __USE_OAUTH__ 标记）
   */
  async resolveRepositoryConfig(userId: string, repository: any): Promise<any> {
    if (repository.accessToken !== '__USE_OAUTH__') {
      return repository
    }

    const credentials = await this.resolveCredentials(userId, repository.provider)
    return { ...repository, ...credentials }
  }
}
```

#### 2. 更新 `SetupRepositoryHandler`

```typescript
// 导入改为 GitConnectionsService
import { GitConnectionsService } from '@juanie/service-foundation'

constructor(
  private gitConnections: GitConnectionsService,  // 改名
  // ...
) {}

private async resolveAccessToken(context: InitializationContext): Promise<any> {
  return await this.gitConnections.resolveRepositoryConfig(context.userId, repository)
}
```

#### 3. 更新 `ProjectInitializationWorker`

```typescript
// 导入改为 GitConnectionsService
import { GitConnectionsService } from '@juanie/service-foundation'

constructor(
  private gitConnections: GitConnectionsService,  // 改名
  // ...
) {}

// 在 handleProjectInitialization() 中
const resolvedRepository = await this.gitConnections.resolveRepositoryConfig(
  userId,
  repository,
)

// 在 createGitOpsResources() 中
const credentials = await this.gitConnections.resolveCredentials(
  userId,
  repository.provider,
)
```

#### 4. 删除 `GitCredentialsService`

- ✅ 删除 `git-credentials.service.ts` 文件
- ✅ 从 `GitConnectionsModule` 中移除
- ✅ 从 `foundation/src/index.ts` 中移除导出
- ✅ 删除测试脚本

## 清理统计

**删除的代码**：
- `GitCredentialsService` 文件：~80 行
- `SetupRepositoryHandler.resolveAccessToken()`：~30 行（重复）
- `Worker.resolveAccessToken()`：~40 行（重复）
- 总计：~150 行

**新增代码**：
- `GitConnectionsService` 新方法：~60 行（在原有 Service 中）

**净效果**：
- 减少 ~90 行代码
- 减少 1 个 Service 类
- 减少 1 层依赖注入
- 代码更清晰，职责更明确

## 使用场景

`GitConnectionsService` 的新方法将在以下场景使用：

1. **项目初始化**（已完成）
   - `SetupRepositoryHandler` - 创建任务时解析凭证
   - `ProjectInitializationWorker` - 执行任务时解析凭证

2. **GitOps 资源创建**（待更新）
   - `FluxResourcesService.setupProjectGitOps()` - 创建 K8s 资源时

3. **项目删除**（待更新）
   - `ProjectsService.delete()` - 删除远程仓库时

4. **未来功能**
   - 部署触发
   - 仓库同步
   - Webhook 配置
   - CI/CD 回调

## 验证步骤

1. ✅ 构建成功
   ```bash
   bun run build  # Foundation 层
   bun run build  # Business 层
   ```

2. ✅ 代码格式化
   ```bash
   bun biome check --write
   ```

3. ⏳ 重启后端服务
   ```bash
   bun run dev:api
   ```

4. ⏳ 创建新项目测试
   - 验证镜像名称：`ghcr.io/997899594/xxx:latest`
   - 检查日志确认 `githubUsername` 正确传递

5. ⏳ 检查 BullMQ 日志
   ```bash
   bun run scripts/check-bullmq-job.ts
   ```
   - 验证 `repository.username` 字段存在
   - 验证 Worker 日志显示正确的 username

## 业界参考

### Stripe SDK
```typescript
class Stripe {
  customers: CustomersResource
  charges: ChargesResource
  // 所有相关操作在一个类中，不会拆分成多个 Service
}
```

### AWS SDK
```typescript
class S3Client {
  putObject()
  getObject()
  deleteObject()
  // 所有 S3 相关操作在一个类中
}
```

### Prisma
```typescript
class PrismaClient {
  user: UserDelegate
  post: PostDelegate
  // 按数据模型分组，不是按操作类型
}
```

## 相关文件

- `packages/services/foundation/src/git-connections/git-connections.service.ts` (已更新)
- `packages/services/foundation/src/git-connections/git-connections.module.ts` (已更新)
- `packages/services/foundation/src/index.ts` (已更新)
- `packages/services/business/src/projects/initialization/handlers/setup-repository.handler.ts` (已重构)
- `packages/services/business/src/queue/project-initialization.worker.ts` (已重构)
- ~~`packages/services/foundation/src/git-connections/git-credentials.service.ts`~~ (已删除)

## 参考

- [NestJS Service vs Utils 最佳实践](../architecture/nestjs-service-vs-utils-best-practices.md)
- [GitHub Username Unknown Investigation](./github-username-unknown-investigation.md)
- [项目初始化架构对比](../architecture/project-initialization-architecture-comparison.md)

