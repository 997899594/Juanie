# 模板渲染完整修复

**日期**: 2024-12-23  
**状态**: ✅ 已完成  
**类型**: Bug 修复

## 问题描述

项目初始化时模板渲染失败，出现两个错误：

### 错误 1: `projectId is not defined`
```
Template rendering failed for kustomization.yaml:
namespace: project-<%= projectId %>-staging
projectId is not defined
```

### 错误 2: `githubUsername is not defined`
```
Template rendering failed for deployment.yaml:
image: ghcr.io/<%= githubUsername %>/<%= projectName %>:latest
githubUsername is not defined
```

### 错误 3: GitHub Actions workflow 语法错误
```bash
cut-c1-7: command not found
```

## 根本原因

1. **`projectId` 缺失**: `RenderTemplateHandler` 没有传递 `projectId` 变量给模板渲染器
2. **`githubUsername` 缺失**: 状态机路径在渲染模板时没有 GitHub 用户名信息
3. **`cut` 命令语法错误**: `cut-c1-7` 缺少空格，应该是 `cut -c1-7`

## 解决方案

### 1. 添加 `projectId` 变量

**文件**: `packages/services/business/src/projects/initialization/handlers/render-template.handler.ts`

```typescript
const result = await this.renderer.renderTemplate(
  context.templatePath,
  {
    projectId: project.id,  // ✅ 添加
    projectName: project.name,
    description: project.description || undefined,
    ...context.templateConfig,
  },
  outputDir,
)
```

### 2. 添加 `githubUsername` 变量

**文件**: `packages/services/business/src/projects/initialization/handlers/render-template.handler.ts`

**方案**: 从用户的 Git 连接中获取 GitHub 用户名

```typescript
// 注入 GitConnectionsService
constructor(
  @Inject(DATABASE) private db: PostgresJsDatabase<typeof schema>,
  private renderer: TemplateRenderer,
  private gitConnections: GitConnectionsService,  // ✅ 添加
  private readonly logger: Logger,
) {}

// 在 execute 方法中获取 GitHub 用户名
let githubUsername = 'unknown'

if (context.repository?.provider === 'github') {
  try {
    const gitConnection = await this.gitConnections.getConnectionWithDecryptedTokens(
      context.userId,
      'github',
    )
    
    if (gitConnection?.username) {
      githubUsername = gitConnection.username
      this.logger.info(`✅ Retrieved GitHub username: ${githubUsername}`)
    }
  } catch (error) {
    this.logger.warn('Failed to retrieve GitHub username:', error)
  }
}

// 传递给模板
const result = await this.renderer.renderTemplate(
  context.templatePath,
  {
    projectId: project.id,
    projectName: project.name,
    description: project.description || undefined,
    githubUsername,  // ✅ 添加
    ...context.templateConfig,
  },
  outputDir,
)
```

### 3. 修复 GitHub Actions workflow 语法

**文件**: `templates/nextjs-15-app/.github/workflows/build-project-image.yml`

```yaml
# ❌ 错误
SHORT_SHA=$(echo "${{ github.sha }}" | cut-c1-7)

# ✅ 正确
SHORT_SHA=$(echo "${{ github.sha }}" | cut -c1-7)
```

## 修改的文件

1. `packages/services/business/src/projects/initialization/handlers/render-template.handler.ts`
   - 添加 `GitConnectionsService` 依赖注入
   - 添加 `projectId` 变量
   - 添加 `githubUsername` 变量（从 Git 连接获取）

2. `templates/nextjs-15-app/.github/workflows/build-project-image.yml`
   - 修复 `cut` 命令语法错误

3. `packages/services/business/src/projects/template-renderer.service.ts`
   - 增强调试日志（info 级别）
   - 在错误时输出完整的变量对象

## 验证步骤

1. 重启后端：
   ```bash
   bun run dev:api
   ```

2. 创建新项目，观察日志：
   ```
   [RenderTemplateHandler] ✅ Retrieved GitHub username: findbiao
   [TemplateRenderer] 🔍 Rendering kustomization.yaml with variables: {
     projectId: "xxx",
     projectName: "test",
     githubUsername: "findbiao",
     allKeys: [...]
   }
   ```

3. 检查生成的文件：
   - `kustomization.yaml`: `namespace: project-{projectId}-staging` ✅
   - `deployment.yaml`: `image: ghcr.io/{githubUsername}/{projectName}:latest` ✅
   - `.github/workflows/build-project-image.yml`: `cut -c1-7` ✅

4. 推送到 GitHub 后，workflow 应该成功运行

## 技术细节

### 为什么从 Git 连接获取 GitHub 用户名？

1. **状态机路径特点**: 在渲染模板时还没有创建仓库，无法从仓库信息获取
2. **用户已连接 GitHub**: 用户必须先连接 GitHub 账户才能创建项目
3. **多租户支持**: 每个用户使用自己的 GitHub 用户名，镜像路径为 `ghcr.io/{username}/{project}`

### Worker 路径 vs 状态机路径

| 路径 | GitHub 用户名来源 | 时机 |
|------|------------------|------|
| Worker | `resolveAccessToken()` 返回 | 推送代码时 |
| 状态机 | `GitConnectionsService.getConnectionWithDecryptedTokens()` | 渲染模板时 |

两个路径都能正确获取 GitHub 用户名，确保模板变量一致。

## 相关文档

- [模板系统 EJS 迁移](../architecture/template-system-ejs-migration.md)
- [项目初始化流程](../architecture/project-initialization-flow-complete.md)
- [多租户修复总结](./multi-tenant-complete-fix-summary.md)

## 下一步

- ✅ 模板渲染成功
- ✅ GitHub Actions workflow 语法正确
- 🔄 等待 workflow 运行，验证镜像构建
- 🔄 验证 Flux CD 自动部署
