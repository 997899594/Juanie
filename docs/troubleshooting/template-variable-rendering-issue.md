# 模板变量未渲染导致 GitHub Actions 构建失败

**日期**: 2025-01-22  
**状态**: ✅ 已修复

## 问题描述

项目创建后，GitHub Actions 构建镜像时报错：

```
ERROR: failed to build: invalid tag "ghcr.io/997899594/<%= projectName %>:2a91697": invalid reference format
```

**关键信息**:
- Docker tag 中出现了 **未渲染的 EJS 模板变量** `<%= projectName %>`
- 说明模板文件被推送到 Git 仓库时，变量没有被正确替换

## 根本原因分析

### 1. 缺少 `platformApiUrl` 变量

在 `ProjectInitializationService.pushTemplate()` 方法中，传递给模板渲染器的 `templateVariables` 对象缺少 `platformApiUrl` 变量：

```typescript
// ❌ 错误：缺少 platformApiUrl
const templateVariables = {
  projectId: project.id,
  projectName: project.name,  // ❌ 还有一个问题：使用了 name 而不是 slug
  projectSlug: project.slug,
  description: project.description || `${project.name} - AI DevOps Platform`,
  githubUsername: ctx.resolvedRepository.username || 'unknown',
  appName: project.slug,
  registry: 'ghcr.io',
  port: 3000,
  replicas: 1,
  repository: {
    url: ctx.repoInfo.cloneUrl,
    branch: ctx.repoInfo.defaultBranch,
  },
  // ❌ 缺少 platformApiUrl
}
```

### 2. `projectName` 使用了 `project.name` 而不是 `project.slug`

**问题**: `project.name` 可能包含空格、中文等字符，不符合 Docker tag 规范。

**Docker tag 规范**:
- 只能包含小写字母、数字、`-`、`_`、`.`
- 不能包含空格、大写字母、特殊字符

**示例**:
```typescript
project.name = "我的测试项目"  // ❌ 不符合 Docker tag 规范
project.slug = "my-test-project"  // ✅ 符合规范
```

### 3. 模板文件中的变量使用

GitHub Actions workflow 模板文件 `.github/workflows/build-project-image.yml` 中使用了这些变量：

```yaml
env:
  REGISTRY: ghcr.io
  PROJECT_ID: "<%= projectId %>"
  PROJECT_NAME: "<%= projectName %>"  # ✅ 用于 Docker tag
  PLATFORM_API_URL: "<%= platformApiUrl %>"  # ❌ 未传递，导致未渲染
```

## 解决方案

### 修复代码

**文件**: `packages/services/business/src/projects/initialization/initialization.service.ts`

```typescript
const templateVariables = {
  projectId: project.id,
  projectName: project.slug, // ✅ 使用 slug 作为镜像名（符合 Docker tag 规范）
  projectSlug: project.slug,
  description: project.description || `${project.name} - AI DevOps Platform`,
  githubUsername: ctx.resolvedRepository.username || 'unknown',
  appName: project.slug,
  registry: 'ghcr.io',
  port: 3000,
  replicas: 1,
  platformApiUrl: process.env.PLATFORM_API_URL || 'http://localhost:3000', // ✅ 添加平台 API URL
  repository: {
    url: ctx.repoInfo.cloneUrl,
    branch: ctx.repoInfo.defaultBranch,
  },
}
```

### 修复要点

1. **✅ 添加 `platformApiUrl`** - 从环境变量读取，默认值为 `http://localhost:3000`
2. **✅ 修正 `projectName`** - 使用 `project.slug` 而不是 `project.name`，确保符合 Docker tag 规范

## 环境变量配置

需要在 `.env` 文件中添加：

```bash
# 平台 API URL（用于 GitHub Actions 回调）
PLATFORM_API_URL=https://api.juanie.art
```

**说明**:
- 开发环境可以使用 `http://localhost:3000`
- 生产环境应该使用公网可访问的 URL
- 这个 URL 用于 GitHub Actions 构建完成后触发部署

## 验证步骤

### 1. 重新编译服务

```bash
cd packages/services/business
bun run build

cd apps/api-gateway
bun run build
```

### 2. 重启 API 服务

```bash
bun run dev:api
```

### 3. 创建新项目

通过前端或 API 创建一个新项目，确保：
- 项目 slug 符合命名规范（小写字母、数字、连字符）
- 初始化成功完成

### 4. 检查推送的文件

在 GitHub 仓库中检查 `.github/workflows/build-project-image.yml` 文件：

```yaml
# ✅ 应该看到渲染后的值
env:
  REGISTRY: ghcr.io
  PROJECT_ID: "abc123-def456-ghi789"
  PROJECT_NAME: "my-test-project"  # ✅ 不应该有 <%= %>
  PLATFORM_API_URL: "https://api.juanie.art"  # ✅ 不应该有 <%= %>
```

### 5. 触发 GitHub Actions 构建

推送代码到 main 分支，观察 GitHub Actions 日志：

```bash
# 应该看到正确的 Docker tag
docker build ... --tag ghcr.io/username/my-test-project:abc1234
```

## 预期结果

✅ **模板变量正确渲染**:
- 所有 `<%= ... %>` 变量都被替换为实际值
- 没有未渲染的模板语法出现在推送的文件中

✅ **Docker tag 符合规范**:
- 使用 `project.slug` 作为镜像名
- 只包含小写字母、数字、连字符

✅ **GitHub Actions 构建成功**:
- 镜像成功构建并推送到 GHCR
- 没有 "invalid reference format" 错误

## 相关文件

- `packages/services/business/src/projects/initialization/initialization.service.ts` - 修复变量传递
- `templates/nextjs-15-app/.github/workflows/build-project-image.yml` - 使用变量的模板文件
- `packages/services/business/src/projects/templates/template-renderer.service.ts` - EJS 模板渲染器

## 经验教训

### 1. 模板变量必须完整传递

**问题**: 模板文件中使用的所有变量都必须在 `templateVariables` 中定义，否则会保留原始的 `<%= ... %>` 语法。

**解决**: 
- 在添加新的模板变量时，同步更新 `templateVariables` 对象
- 使用 TypeScript 接口约束变量类型，避免遗漏

### 2. 命名规范很重要

**问题**: `project.name` 可能包含不符合 Docker tag 规范的字符。

**解决**:
- 对于需要符合特定规范的场景（Docker tag、DNS、URL），使用 `slug` 而不是 `name`
- `slug` 在创建时已经过验证，确保符合规范

### 3. 环境变量的默认值

**问题**: 生产环境和开发环境的配置不同。

**解决**:
- 提供合理的默认值（如 `http://localhost:3000`）
- 在文档中明确说明生产环境需要配置的变量

### 4. 模板渲染的验证

**建议**: 在推送到 Git 之前，验证渲染后的文件：
- 检查是否还有未渲染的 `<%= ... %>`
- 验证关键文件（如 GitHub Actions workflow）的语法正确性

## 未来改进

### 1. 添加模板变量验证

在 `TemplateRenderer` 中添加验证逻辑：

```typescript
private validateVariables(
  templatePath: string,
  variables: TemplateVariables
): { valid: boolean; missing: string[] } {
  // 扫描模板文件，提取所有使用的变量
  // 检查 variables 对象是否包含所有必需的变量
  // 返回缺失的变量列表
}
```

### 2. 使用 TypeScript 接口约束

定义严格的模板变量接口：

```typescript
interface NextJsTemplateVariables {
  projectId: string
  projectName: string  // 必须是 slug
  projectSlug: string
  description: string
  githubUsername: string
  appName: string
  registry: string
  port: number
  replicas: number
  platformApiUrl: string  // ✅ 明确标记为必需
  repository: {
    url: string
    branch: string
  }
}
```

### 3. 添加渲染后验证

在推送到 Git 之前，验证渲染结果：

```typescript
private async validateRenderedContent(
  files: Array<{ path: string; content: string }>
): Promise<{ valid: boolean; errors: string[] }> {
  const errors: string[] = []
  
  for (const file of files) {
    // 检查是否还有未渲染的模板语法
    if (file.content.includes('<%=') || file.content.includes('%>')) {
      errors.push(`Unrendered template syntax in ${file.path}`)
    }
  }
  
  return { valid: errors.length === 0, errors }
}
```

## 总结

这是一个典型的 **模板变量遗漏** 问题，根本原因是：

1. **变量定义不完整** - `platformApiUrl` 未传递
2. **变量选择不当** - 使用 `name` 而不是 `slug`

修复后，所有模板变量都能正确渲染，GitHub Actions 构建成功。

**关键要点**:
- ✅ 模板中使用的所有变量都必须在 `templateVariables` 中定义
- ✅ 对于有格式要求的场景（Docker tag），使用 `slug` 而不是 `name`
- ✅ 提供合理的默认值，并在文档中说明生产环境配置
