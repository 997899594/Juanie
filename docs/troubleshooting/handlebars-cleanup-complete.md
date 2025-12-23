# Handlebars 清理完成记录

## 📅 日期

2024-12-22

## 🎯 目标

彻底删除项目中所有 Handlebars 相关代码，统一使用 EJS 模板引擎。

## ✅ 已完成的工作

### 1. 删除 Handlebars 依赖的服务

- ✅ 删除 `packages/services/business/src/projects/template-manager.service.ts`
  - 完全基于 Handlebars 的旧服务
  - 功能已被 `TemplateRenderer` (EJS) 替代

- ✅ 删除 `apps/api-gateway/src/routers/project-templates.router.ts`
  - 依赖已删除的 `TemplateManager`

### 2. 更新模块配置

- ✅ 更新 `packages/services/business/src/projects/templates/templates.module.ts`
  - 删除 `TemplateManager` 引用

- ✅ 更新 `packages/services/business/src/index.ts`
  - 删除 `TemplateManager` 导出

- ✅ 更新 `apps/api-gateway/src/trpc/trpc.router.ts`
  - 删除 `projectTemplates` router

### 3. 修复依赖问题

- ✅ 修复 `load-template.handler.ts`
  - 直接查询数据库获取模板
  - 不再依赖 `TemplateManager`

### 4. 保留的功能

**重要**：`TemplatesService` 的 `generateDockerfile` 和 `generateCICD` 功能**已保留**

原因：
- 这是**独立的 AI 辅助生成工具**
- 用于前端 Templates 页面手动生成配置
- 与项目初始化模板系统（`templates/nextjs-15-app/`）是两个不同的功能
- 已从 Handlebars 迁移到 EJS

## 📁 两个模板系统的区别

### 1. 项目初始化模板 (`templates/nextjs-15-app/`)

**用途**：项目创建时使用的完整模板

**特点**：
- 完整的项目结构（代码 + K8s + CI/CD）
- 使用 `TemplateRenderer` (EJS) 渲染
- 在 `ProjectsService.createProject()` 时自动使用

**模板引擎**：EJS (`<% %>`)

### 2. AI 辅助生成工具 (`TemplatesService`)

**用途**：独立生成单个配置文件

**特点**：
- 用户在前端手动触发
- 生成单个 Dockerfile 或 CI/CD 配置
- 不是项目初始化的一部分

**模板引擎**：EJS (`<% %>`)

**模板位置**：`packages/services/business/templates/`
- `dockerfiles/nodejs.Dockerfile`
- `ci-cd/github-actions.yml`

## 🔧 技术细节

### EJS 配置

```typescript
private readonly ejsOptions: ejs.Options = {
  delimiter: '%',
  openDelimiter: '<',
  closeDelimiter: '>',
  async: false,
  compileDebug: true,
  rmWhitespace: false,
}
```

### 模板语法对比

**Handlebars (已废弃)**：
```handlebars
FROM node:{{nodeVersion}}-alpine
{{#if hasBuildStep}}
RUN {{buildCommand}}
{{/if}}
```

**EJS (当前使用)**：
```ejs
FROM node:<%= nodeVersion %>-alpine
<% if (hasBuildStep) { %>
RUN <%= buildCommand %>
<% } %>
```

## 📝 相关文档

- `docs/troubleshooting/template-system-handlebars-github-actions-conflict.md` - 问题记录
- `docs/architecture/template-system-ejs-migration.md` - 迁移方案
- `docs/troubleshooting/handlebars-cleanup-plan.md` - 清理计划

## ✅ 验证清单

- [x] 删除所有 Handlebars 服务代码
- [x] 更新所有模块导出
- [x] 修复所有依赖引用
- [x] 保留 AI 生成工具功能
- [x] 迁移模板语法到 EJS
- [x] 创建清理完成文档

## 🎉 结论

Handlebars 已彻底从项目中移除，所有模板功能统一使用 EJS。两个模板系统（项目初始化 + AI 生成工具）各司其职，互不冲突。

---

**状态**: ✅ 完成  
**创建时间**: 2024-12-22  
**最后更新**: 2024-12-22
