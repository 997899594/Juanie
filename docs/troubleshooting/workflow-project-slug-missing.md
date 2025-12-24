# GitHub Actions Workflow PROJECT_SLUG 缺失问题

## 问题描述

GitHub Actions 构建失败，错误信息：
```
ERROR: failed to build: invalid tag "ghcr.io/997899594/:73bfcad": invalid reference format
```

**根本原因**：模板文件使用了错误的 EJS 语法 `<%variable%>`，导致 EJS 渲染失败，变量未被替换。

## 影响范围

**所有**在 2025-12-23 12:30 之前创建的项目都受影响。

## 根本问题

### 错误的 EJS 语法

**错误**（旧模板）：
```yaml
env:
  PROJECT_SLUG: "<%projectSlug%>"
```

**正确**（新模板）：
```yaml
env:
  PROJECT_SLUG: "<%= projectSlug %>"
```

### EJS 语法规则

- `<%= variable %>` - 输出变量并转义 HTML（推荐）
- `<%- variable %>` - 输出变量不转义
- `<% code %>` - 执行 JavaScript 代码
- ❌ `<%variable%>` - **无效语法**，EJS 无法识别

### 为什么没有报错？

代码中有错误处理逻辑：
```typescript
try {
  const rendered = await ejs.render(content, variables, options)
  return rendered
} catch (error) {
  this.logger.warn(`Failed to render template:`, error)
  return content  // 返回原始内容，导致变量未替换
}
```

当 EJS 渲染失败时，返回原始内容而不是抛出错误，导致问题被隐藏。

## 快速修复

### 方案 1：手动修复 workflow 文件（推荐）

1. 打开项目仓库的 `.github/workflows/build-project-image.yml`
2. 找到 `env` 部分，将模板语法修改为正确的 EJS 语法：

**修改前**：
```yaml
env:
  REGISTRY: ghcr.io
  PROJECT_ID: "<%projectId%>"
  PROJECT_SLUG: "<%projectSlug%>"
  PLATFORM_API_URL: "<%platformApiUrl%>"
```

**修改后**（替换为实际值）：
```yaml
env:
  REGISTRY: ghcr.io
  PROJECT_ID: "your-project-id"        # 从平台获取
  PROJECT_SLUG: "your-project-slug"    # 项目的 slug
  PLATFORM_API_URL: "https://your-platform.com"
```

3. 同时修复第 90 行的检查逻辑：

**修改前**：
```yaml
if [ -z "${{ env.PLATFORM_API_URL }}" ] || [ "${{ env.PLATFORM_API_URL }}" = "<%platformApiUrl%>" ]; then
```

**修改后**：
```yaml
if [ -z "${{ env.PLATFORM_API_URL }}" ] || [ "${{ env.PLATFORM_API_URL }}" = "https://your-platform.com" ]; then
```

4. 提交并推送更改

### 方案 2：重新创建项目

如果项目刚创建不久，可以：
1. 删除现有项目
2. 使用最新的平台重新创建项目
3. 新项目会自动使用修复后的模板

## 验证修复

修复后，推送代码触发 GitHub Actions：

```bash
git commit --allow-empty -m "test: trigger workflow"
git push
```

检查 Actions 页面，应该看到：
- ✅ 镜像标签格式正确：`ghcr.io/username/project-slug:commit-sha`
- ✅ 构建成功

## 技术细节

### 问题根因

1. **错误的 EJS 语法**：模板使用 `<%variable%>` 而不是 `<%= variable %>`
2. **静默失败**：EJS 渲染失败时返回原始内容，不抛出错误
3. **变量未替换**：GitHub Actions 收到未处理的模板文件

### EJS 配置

```typescript
const ejsOptions: ejs.Options = {
  delimiter: '%',        // 使用 % 作为标记符
  openDelimiter: '<',    // 开始符号 <
  closeDelimiter: '>',   // 结束符号 >
}
```

正确的 EJS 标签：
- `<%= variable %>` - 输出并转义（用于 HTML）
- `<%- variable %>` - 输出不转义（用于 YAML/JSON）
- `<% code %>` - 执行代码

### 修复内容

**修复前**（templates/nextjs-15-app/.github/workflows/build-project-image.yml）：
```yaml
PROJECT_SLUG: "<%projectSlug%>"
```

**修复后**：
```yaml
PROJECT_SLUG: "<%= projectSlug %>"
```

### 为什么新项目也受影响？

因为模板文件本身的语法错误，导致所有使用该模板创建的项目都会遇到同样的问题。

### 正确的变量映射

| 模板变量 | 来源 | 示例值 |
|---------|------|--------|
| `projectId` | `project.id` | `"123"` |
| `projectSlug` | `project.slug` | `"my-app"` |
| `platformApiUrl` | `PLATFORM_API_URL` 环境变量 | `"https://api.example.com"` |

### 镜像命名规范

正确的镜像标签格式：
```
ghcr.io/<github-username>/<project-slug>:<tag>
```

示例：
```
ghcr.io/997899594/my-nextjs-app:73bfcad
ghcr.io/997899594/my-nextjs-app:latest
```

## 预防措施

### 对于平台开发者

1. **验证模板渲染**：
   ```typescript
   // 确保所有必需变量都传递
   const templateVariables = {
     projectId: project.id,
     projectSlug: project.slug,  // 必需
     platformApiUrl: config.get('PLATFORM_API_URL'),
     // ...
   }
   ```

2. **添加渲染后验证**：
   ```typescript
   // 检查关键变量是否被正确替换
   const hasUnreplacedVars = files.some(f => 
     f.content.includes('<%') && f.content.includes('%>')
   )
   if (hasUnreplacedVars) {
     throw new Error('Template variables not fully replaced')
   }
   ```

### 对于用户

1. **创建项目后立即验证**：检查 `.github/workflows/build-project-image.yml` 是否包含 `<%...%>` 模板标记
2. **首次推送前检查**：确保 workflow 文件中的环境变量已正确替换

## 相关文档

- [GitHub Actions 部署触发失败](./github-actions-deployment-trigger-failure.md)
- [多租户镜像拉取修复](./multi-tenant-complete-fix-summary.md)
- [项目初始化流程](../architecture/project-initialization-flow-analysis.md)

## 更新日志

- **2025-12-23**: 修复模板变量传递逻辑，确保 `projectSlug` 正确传递
- **2025-12-23**: 添加本文档，说明历史项目的修复方法
