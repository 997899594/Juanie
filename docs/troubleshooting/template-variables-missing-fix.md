# 模板变量缺失修复

**日期**: 2024-12-23  
**状态**: ✅ 已完成  
**类型**: Bug 修复

## 问题描述

项目初始化时模板渲染失败，连续出现多个变量未定义的错误：

1. **第一个错误**: `projectId is not defined`
2. **第二个错误**: `githubUsername is not defined`
3. **第三个错误**: `platformApiUrl is not defined`

## 根本原因

**状态机路径**（`RenderTemplateHandler`）和 **Worker 路径**（`ProjectInitializationWorker`）传递给模板渲染器的变量不一致。

### 问题分析

项目初始化有两条路径：

1. **状态机路径**（同步）：
   - 用于简单项目创建（无仓库）
   - 在 `RenderTemplateHandler` 中渲染模板
   - ❌ 只传递了 `projectName` 和 `description`

2. **Worker 路径**（异步）：
   - 用于完整项目初始化（包含仓库创建）
   - 在 `ProjectInitializationWorker` 中渲染模板
   - ✅ 传递了完整的变量集合

### 模板需要的变量

模板文件使用了以下变量：

```yaml
# k8s/overlays/staging/kustomization.yaml
namespace: project-<%= projectId %>-staging

# k8s/base/deployment.yaml
image: ghcr.io/<%= githubUsername %>/<%= projectName %>:latest

# .github/workflows/build-project-image.yml
PLATFORM_API_URL: "<%= platformApiUrl %>"
```

## 解决方案

### 1. 添加缺失的依赖注入

**文件**: `packages/services/business/src/projects/initialization/handlers/render-template.handler.ts`

```typescript
import { GitConnectionsService } from '@juanie/service-foundation'
import { ConfigService } from '@nestjs/config'

constructor(
  @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
  private renderer: TemplateRenderer,
  private gitConnections: GitConnectionsService,  // 新增
  private config: ConfigService,                   // 新增
  private readonly logger: Logger,
) {
  this.logger.setContext(RenderTemplateHandler.name)
}
```

### 2. 统一模板变量

修改 `execute` 方法，传递与 Worker 一致的完整变量集合：

```typescript
async execute(context: InitializationContext): Promise<void> {
  // ... 获取项目信息 ...

  // 获取 GitHub 用户名（从用户的 Git 连接中）
  let githubUsername = 'unknown'
  
  if (context.repository?.provider === 'github') {
    try {
      const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
        context.userId,
        'github',
      )
      
      if (gitConnection?.username) {
        githubUsername = gitConnection.username
      }
    } catch (error) {
      this.logger.warn('Failed to retrieve GitHub username:', error)
    }
  }

  // 准备模板变量（与 Worker 保持一致）
  const result = await this.renderer.renderTemplate(
    context.templatePath,
    {
      // 项目信息
      projectId: project.id,
      projectName: project.name,
      description: project.description || `${project.name} - AI DevOps Platform`,

      // GitHub 信息（用于镜像路径）
      githubUsername,

      // K8s 配置
      appName: project.name,
      registry: 'ghcr.io',
      port: 3000,
      domain: this.config.get('APP_DOMAIN') || 'example.com',
      replicas: 1,

      // 平台 API 配置（用于 CI/CD 回调）
      platformApiUrl: this.config.get('PLATFORM_API_URL') || 'http://localhost:3000',

      // 可选功能
      enableDatabase: false,
      enableCache: false,
      enableAuth: false,
      enableSentry: false,

      // 资源配置
      resources: {
        requests: { cpu: '200m', memory: '512Mi' },
        limits: { cpu: '1000m', memory: '1Gi' },
      },

      // 仓库信息（如果有）
      repository: context.repository
        ? {
            url: context.repository.url || '',
            branch: context.repository.defaultBranch || 'main',
          }
        : undefined,

      // 合并用户自定义配置
      ...context.templateConfig,
    },
    outputDir,
  )
}
```

## 修复内容总结

### 新增变量

| 变量名 | 来源 | 用途 |
|--------|------|------|
| `projectId` | `project.id` | K8s namespace 命名 |
| `githubUsername` | Git 连接 | 镜像路径 `ghcr.io/<username>/<project>` |
| `platformApiUrl` | 环境变量 | CI/CD 回调 URL |
| `appName` | `project.name` | K8s 资源名称 |
| `registry` | 固定值 | 容器镜像仓库 |
| `port` | 固定值 | 应用端口 |
| `domain` | 环境变量 | Ingress 域名 |
| `replicas` | 固定值 | Pod 副本数 |
| `enableDatabase` | 固定值 | 功能开关 |
| `enableCache` | 固定值 | 功能开关 |
| `enableAuth` | 固定值 | 功能开关 |
| `enableSentry` | 固定值 | 功能开关 |
| `resources` | 固定值 | K8s 资源限制 |
| `repository` | context | 仓库信息 |

### 关键改进

1. **从 Git 连接获取 GitHub 用户名**：
   - 调用 `GitConnectionsService.getConnectionWithDecryptedTokens()`
   - 支持多租户（每个用户使用自己的 GitHub 账户）
   - 失败时使用占位符 `'unknown'`

2. **从环境变量读取配置**：
   - `PLATFORM_API_URL`: 平台 API 地址
   - `APP_DOMAIN`: 应用域名
   - 提供默认值避免渲染失败

3. **与 Worker 保持一致**：
   - 两条路径使用相同的变量结构
   - 避免模板渲染不一致

## 验证步骤

1. 重启后端：
   ```bash
   bun run dev:api
   ```

2. 创建新项目（状态机路径）

3. 检查日志，确认所有变量都已传递：
   ```
   [TemplateRenderer] 🔍 Rendering kustomization.yaml with variables: {
     projectId: "xxx",
     projectName: "test",
     githubUsername: "your-username",
     platformApiUrl: "http://localhost:3000",
     allKeys: [...]
   }
   ```

4. 验证模板渲染成功

## 相关文件

- `packages/services/business/src/projects/initialization/handlers/render-template.handler.ts` (已修复)
- `packages/services/business/src/queue/project-initialization.worker.ts` (参考)
- `packages/services/business/src/projects/template-renderer.service.ts` (调试增强)
- `templates/nextjs-15-app/k8s/overlays/staging/kustomization.yaml`
- `templates/nextjs-15-app/k8s/base/deployment.yaml`
- `templates/nextjs-15-app/.github/workflows/build-project-image.yml`

## 经验教训

1. **保持一致性**：多条路径使用相同的变量结构
2. **完整测试**：测试所有初始化路径（状态机 + Worker）
3. **调试日志**：关键变量使用 `info` 级别日志
4. **错误处理**：外部依赖失败时使用合理的默认值
5. **文档同步**：修复后更新相关文档

## 后续优化

1. **提取公共函数**：将变量准备逻辑提取为共享函数
2. **类型定义**：为模板变量创建 TypeScript 接口
3. **配置验证**：启动时验证必需的环境变量
4. **单元测试**：为模板渲染添加测试用例
