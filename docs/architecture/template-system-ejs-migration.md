# 模板系统迁移：从 Handlebars 到 EJS

## 📋 概述

本文档记录了模板系统从 Handlebars 迁移到 EJS 的决策过程和技术细节。

## 🎯 为什么迁移到 EJS

### 问题背景

在使用 Handlebars 时，遇到了 **GitHub Actions 语法冲突** 的问题：

```yaml
# GitHub Actions 使用 ${{ }} 语法
env:
  COMMIT_SHA: ${{ github.sha }}

# Handlebars 也使用 {{ }} 语法
env:
  PROJECT_ID: "{{projectId}}"
```

Handlebars 会把 `${{ github.sha }}` 中的 `{{ github.sha }}` 当作模板变量处理，导致渲染为空字符串。

### 尝试过的方案

#### ❌ 方案 1: Plop.js
- **问题**: 持续报错 "Missing helper: -"
- **原因**: 过度设计，不适合简单的文件渲染场景
- **结果**: 放弃

#### ❌ 方案 2: 占位符替换
```typescript
// 使用 __DOLLAR__ 占位符
const content = template.replace(/\$\{\{/g, '__DOLLAR__{{')
// 渲染后恢复
const final = rendered.replace(/__DOLLAR__\{\{/g, '${{')
```
- **问题**: 复杂、不优雅、容易出错
- **结果**: 不符合"最正确的方案"原则

#### ❌ 方案 3: 转义语法
```yaml
# 在模板中使用 \${{ }}
env:
  COMMIT_SHA: \${{ github.sha }}
```
- **问题**: 在 YAML 多行字符串中失败
- **结果**: 不可靠

#### ❌ 方案 4: 保护/恢复机制
```typescript
// 1. 保护 GitHub Actions 语法
const protected = content.replace(/\$\{\{/g, '__GITHUB_ACTIONS_EXPR__{{')
// 2. 渲染
// 3. 恢复
const final = rendered.replace(/__GITHUB_ACTIONS_EXPR__\{\{/g, '${{')
```
- **问题**: 虽然可行，但是 **hack**，不是正确的解决方案
- **结果**: 临时方案，需要更好的替代

### ✅ 最终方案: EJS

EJS (Embedded JavaScript) 是 **现代化、专业的模板引擎**，原生解决了分隔符冲突问题。

## 🌟 为什么 EJS 是现代化方案

### 1. 行业标准

- **Express.js 默认模板引擎** - Node.js 最流行的 Web 框架
- **npm 周下载量 1000万+** - 广泛使用，成熟稳定
- **被主流框架支持** - Nest.js、Koa、Fastify 等

### 2. 原生支持自定义分隔符

```typescript
// EJS 配置
const ejsOptions: ejs.Options = {
  delimiter: '%',        // 使用 <% %> 分隔符
  openDelimiter: '<',
  closeDelimiter: '>',
}

// 模板中
env:
  PROJECT_ID: "<%= projectId %>"           // EJS 变量
  COMMIT_SHA: ${{ github.sha }}            // GitHub Actions 语法（不会被处理）
```

**零妥协** - 无需任何转义、占位符、保护/恢复的 hack！

### 3. 更强大的功能

```ejs
<!-- 条件渲染 -->
<% if (environment === 'production') { %>
  replicas: 3
<% } else { %>
  replicas: 1
<% } %>

<!-- 循环 -->
<% environments.forEach(env => { %>
  - name: <%= env.name %>
    type: <%= env.type %>
<% }) %>

<!-- 直接写 JavaScript -->
<% const imageTag = commitSha.substring(0, 7) %>
tag: <%= imageTag %>

<!-- 包含其他模板 -->
<%- include('partials/header') %>
```

**无需注册 helper** - 直接写 JavaScript，更灵活、更强大！

### 4. 与现代 DevOps 工具理念一致

| 工具 | 模板引擎 | 分隔符 | 理念 |
|------|---------|--------|------|
| **Kubernetes Helm** | Go templates | `{{ }}` | 可配置分隔符 + 原生语言表达式 |
| **Terraform** | HCL templates | `${ }` | 可配置分隔符 + 原生语言表达式 |
| **Ansible** | Jinja2 | `{{ }}` | 可配置分隔符 + 原生语言表达式 |
| **GitHub Actions** | 表达式 | `${{ }}` | 特定语法避免冲突 |
| **EJS** | JavaScript | `<% %>` | **可配置分隔符 + 原生语言表达式** ✅ |

EJS 的设计理念与这些工具一致，是 **现代 DevOps 的标准做法**。

### 5. TypeScript 友好

```typescript
import * as ejs from 'ejs'

// 完整的类型支持
const result: string = ejs.render(template, data, {
  delimiter: '%',
  async: false,
  cache: true,
  filename: 'workflow.yml', // 用于错误提示
})
```

### 6. 更好的错误提示

```
Error: Could not find matching close tag for "<%".
    at /path/to/template.yml:15:3
```

EJS 提供 **精确的行号和上下文**，调试更容易。

## 📊 对比总结

| 特性 | Handlebars | EJS |
|------|-----------|-----|
| **分隔符冲突** | ❌ 需要 hack | ✅ 原生支持自定义分隔符 |
| **语法灵活性** | ⚠️ 需要注册 helper | ✅ 直接写 JavaScript |
| **行业地位** | ⚠️ 前端模板引擎 | ✅ Node.js 标准模板引擎 |
| **npm 下载量** | 300万/周 | 1000万/周 |
| **TypeScript 支持** | ✅ 有类型定义 | ✅ 有类型定义 |
| **错误提示** | ⚠️ 一般 | ✅ 精确的行号和上下文 |
| **学习曲线** | ⚠️ 需要学习 helper 系统 | ✅ 会 JavaScript 就会用 |
| **DevOps 工具理念** | ❌ 不一致 | ✅ 一致 |

## 🚀 迁移步骤

### 1. 安装依赖

```bash
bun add ejs
bun add -d @types/ejs
bun remove handlebars
```

### 2. 更新 TemplateRenderer

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

### 3. 更新模板文件

```yaml
# 之前 (Handlebars)
env:
  PROJECT_ID: "<%projectId%>"  # 自定义分隔符避免冲突

# 现在 (EJS)
env:
  PROJECT_ID: "<%= projectId %>"  # EJS 标准语法
  COMMIT_SHA: ${{ github.sha }}   # GitHub Actions 语法（不会被处理）
```

### 4. 删除 hack 代码

```typescript
// ❌ 删除这些临时方案
// - renderWorkflowFile() 方法
// - 保护/恢复机制
// - 占位符替换
// - 转义处理

// ✅ 使用统一的 renderContent() 方法
```

## ✅ 验证

运行测试脚本：

```bash
bun run scripts/test-ejs-render.ts
```

预期输出：

```
🎉 测试通过！EJS 完美支持 GitHub Actions 语法。

✨ 优势：
  - 零妥协：无需转义、占位符、保护/恢复
  - 原生支持：自定义分隔符是 EJS 的核心功能
  - 行业标准：Express.js 默认模板引擎
  - 更强大：直接写 JavaScript，无需注册 helper
```

## 📚 参考资料

- [EJS 官方文档](https://ejs.co/)
- [Express.js 模板引擎](https://expressjs.com/en/guide/using-template-engines.html)
- [EJS vs Handlebars](https://npmtrends.com/ejs-vs-handlebars)
- [Kubernetes Helm Templates](https://helm.sh/docs/chart_template_guide/)

## 🎯 结论

**EJS 是现代化、专业的模板系统方案**，因为：

1. ✅ **原生解决问题** - 自定义分隔符是核心功能，不是 hack
2. ✅ **行业标准** - Express.js 默认，npm 周下载量 1000万+
3. ✅ **更强大** - 直接写 JavaScript，无需注册 helper
4. ✅ **DevOps 理念一致** - 与 Helm、Terraform、Ansible 等工具理念相同
5. ✅ **零妥协** - 无需任何转义、占位符、保护/恢复的临时方案

这不是"简单的方案"，而是 **最正确的方案**。
