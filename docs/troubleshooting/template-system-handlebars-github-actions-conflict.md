# 模板系统：Handlebars 与 GitHub Actions 语法冲突

## 📋 问题描述

**日期**: 2024-12-22  
**严重程度**: 高  
**影响范围**: 项目初始化流程、GitHub Actions workflow 生成

### 症状

使用 Handlebars 渲染 GitHub Actions workflow 文件时，`${{ }}` 语法被错误处理：

```yaml
# 期望输出
env:
  COMMIT_SHA: ${{ github.sha }}

# 实际输出
env:
  COMMIT_SHA: $
```

**根本原因**: Handlebars 使用 `{{ }}` 作为分隔符，与 GitHub Actions 的 `${{ }}` 语法冲突。即使 `${{ }}` 中的变量不存在，Handlebars 也会将 `{{ github.sha }}` 当作模板变量处理，渲染为空字符串。

## 🔍 尝试过的方案

### ❌ 方案 1: Plop.js

**尝试**: 使用 Plop.js 作为模板系统  
**问题**: 持续报错 "Missing helper: -"  
**原因**: Plop.js 过度设计，不适合简单的文件渲染场景  
**结果**: 放弃

### ❌ 方案 2: 占位符替换

```typescript
// 使用 __DOLLAR__ 占位符
const content = template.replace(/\$\{\{/g, '__DOLLAR__{{')
// 渲染后恢复
const final = rendered.replace(/__DOLLAR__\{\{/g, '${{')
```

**问题**: 
- 复杂且不优雅
- 容易出错
- 不符合"最正确的方案"原则

**结果**: 不采用

### ❌ 方案 3: 转义语法

```yaml
# 在模板中使用 \${{ }}
env:
  COMMIT_SHA: \${{ github.sha }}
```

**问题**: 在 YAML 多行字符串中失败  
**结果**: 不可靠

### ❌ 方案 4: 自定义分隔符 + 保护/恢复机制

```typescript
// 1. 保护 GitHub Actions 语法
const protected = content.replace(/\$\{\{/g, '__GITHUB_ACTIONS_EXPR__{{')

// 2. 替换自定义分隔符 <% %> -> {{ }}
const withStandardDelimiters = protected.replace(/<%/g, '{{').replace(/%>/g, '}}')

// 3. Handlebars 渲染
const template = this.handlebars.compile(withStandardDelimiters)
const rendered = template(variables)

// 4. 恢复 GitHub Actions 语法
const final = rendered.replace(/__GITHUB_ACTIONS_EXPR__\{\{/g, '${{')
```

**问题**: 
- 虽然可行，但是 **hack**
- 需要维护保护/恢复逻辑
- 不是正确的解决方案

**结果**: 临时方案，需要更好的替代

## ✅ 最终解决方案：迁移到 EJS

### 为什么选择 EJS

1. **原生支持自定义分隔符** - 这是 EJS 的核心功能，不是 hack
2. **行业标准** - Express.js 默认模板引擎，npm 周下载量 1000万+
3. **零妥协** - 无需任何转义、占位符、保护/恢复
4. **更强大** - 直接写 JavaScript，无需注册 helper
5. **DevOps 理念一致** - 与 Helm、Terraform、Ansible 等工具理念相同

### 实现方式

```typescript
import * as ejs from 'ejs'

// EJS 渲染选项
private readonly ejsOptions: ejs.Options = {
  delimiter: '%',           // 使用 <% %> 分隔符
  openDelimiter: '<',
  closeDelimiter: '>',
  async: false,
  compileDebug: true,
  rmWhitespace: false,
}

// 渲染方法
private renderContent(content: string, variables: TemplateVariables, filePath?: string): string {
  try {
    const rendered = ejs.render(content, variables, {
      ...this.ejsOptions,
      filename: filePath,
    })
    return rendered
  } catch (error) {
    this.logger.warn(`Failed to render template:`, error)
    return content
  }
}
```

### 模板语法

```yaml
# EJS 模板变量（使用 <% %> 分隔符）
env:
  PROJECT_ID: "<%= projectId %>"
  PLATFORM_API_URL: "<%= platformApiUrl %>"

# GitHub Actions 语法（不会被处理）
jobs:
  build:
    steps:
      - name: Extract metadata
        run: |
          echo "Repository: ${{ github.repository }}"
          echo "SHA: ${{ github.sha }}"
          echo "Event: ${{ github.event_name }}"
```

### 验证结果

```bash
bun run scripts/test-ejs-render.ts
```

```
🎉 测试通过！EJS 完美支持 GitHub Actions 语法。

✨ 优势：
  - 零妥协：无需转义、占位符、保护/恢复
  - 原生支持：自定义分隔符是 EJS 的核心功能
  - 行业标准：Express.js 默认模板引擎
  - 更强大：直接写 JavaScript，无需注册 helper
```

## 📦 迁移步骤

### 1. 安装依赖

```bash
bun add ejs
bun add -d @types/ejs
bun remove handlebars
```

### 2. 更新代码

**文件**: `packages/services/business/src/projects/template-renderer.service.ts`

- ✅ 替换 `import Handlebars from 'handlebars'` 为 `import * as ejs from 'ejs'`
- ✅ 删除 `registerHelpers()` 方法（EJS 直接写 JavaScript）
- ✅ 删除 `renderWorkflowFile()` 方法（不需要特殊处理）
- ✅ 更新 `renderContent()` 使用 EJS

### 3. 更新模板文件

**文件**: `templates/nextjs-15-app/.github/workflows/build-project-image.yml`

```yaml
# 从 Handlebars 自定义分隔符
env:
  PROJECT_ID: "<%projectId%>"

# 改为 EJS 标准语法
env:
  PROJECT_ID: "<%= projectId %>"
```

### 4. 删除测试文件

```bash
rm scripts/test-custom-delimiters.js
rm scripts/test-handlebars-render.ts
```

保留：
- ✅ `scripts/test-ejs-render.ts` - EJS 功能验证

## 📚 相关文档

- [模板系统 EJS 迁移](../architecture/template-system-ejs-migration.md) - 完整的技术决策和对比分析
- [项目初始化流程](../architecture/project-initialization-flow-analysis.md) - 模板系统在初始化流程中的作用

## 🎯 经验教训

1. **不要用 hack 解决问题** - 保护/恢复机制虽然可行，但不是正确的方案
2. **选择正确的工具** - EJS 原生支持自定义分隔符，这是核心功能而不是 workaround
3. **遵循行业标准** - Express.js、Helm、Terraform 等工具都使用类似的理念
4. **零妥协原则** - 如果需要 hack，说明工具选错了

## ✅ 解决状态

**状态**: 已解决  
**解决方案**: 迁移到 EJS  
**验证**: 测试通过  
**文档**: 已完善

---

**最后更新**: 2024-12-22  
**负责人**: 系统架构  
**标签**: `template-system`, `github-actions`, `ejs`, `handlebars`, `migration`
