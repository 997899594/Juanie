# 模板渲染错误：projectId is not defined

**日期**: 2024-12-23  
**状态**: ✅ 已修复

## 错误信息

```
Template rendering failed for kustomization.yaml: 
/Users/findbiao/projects/Juanie/templates/nextjs-15-app/k8s/overlays/staging/kustomization.yaml:4
    2| kind: Kustomization
    3| 
 >> 4| namespace: project-<%= projectId %>-staging
    5| 
    6| resources:
    7|   - ../../base

projectId is not defined
```

## 根本原因

**位置**: `packages/services/business/src/projects/initialization/handlers/render-template.handler.ts`

**问题**: RenderTemplateHandler 传递给模板渲染器的变量中**缺少 `projectId`**

```typescript
// ❌ 修复前 - 缺少 projectId
const result = await this.renderer.renderTemplate(
  context.templatePath,
  {
    projectName: project.name,
    description: project.description || undefined,
    ...context.templateConfig,
  },
  outputDir,
)
```

## 修复方案

添加 `projectId` 到模板变量中：

```typescript
// ✅ 修复后 - 添加 projectId
const result = await this.renderer.renderTemplate(
  context.templatePath,
  {
    projectId: project.id,  // ✅ 添加这一行
    projectName: project.name,
    description: project.description || undefined,
    ...context.templateConfig,
  },
  outputDir,
)
```

## 为什么之前没发现

项目初始化有两个路径：

1. **状态机路径**（同步）：
   - 使用 `RenderTemplateHandler`
   - ❌ 缺少 `projectId`
   - 用于快速初始化（不推送代码）

2. **Worker 路径**（异步）：
   - 使用 `ProjectInitializationWorker.pushTemplateCode()`
   - ✅ 包含 `projectId`
   - 用于推送代码到 Git

**问题**: 状态机路径的 handler 没有传递 `projectId`，导致模板渲染失败。

## 影响范围

- ✅ Worker 路径：正常工作（已有 `projectId`）
- ❌ 状态机路径：失败（缺少 `projectId`）

所有使用 K8s 模板的项目初始化都会失败，因为 `kustomization.yaml` 需要 `projectId`。

## 验证步骤

1. **重启后端**（代码已热重载，但建议重启确保）:
   ```bash
   # Ctrl+C 停止
   bun run dev:api
   ```

2. **创建新项目**:
   - 在前端创建一个新项目
   - 选择 Next.js 15 模板

3. **检查结果**:
   - ✅ 项目创建成功
   - ✅ 模板渲染成功
   - ✅ K8s 资源创建成功

## 相关文件

- `packages/services/business/src/projects/initialization/handlers/render-template.handler.ts` - **已修复**
- `packages/services/business/src/queue/project-initialization.worker.ts` - 正常（已有 projectId）
- `packages/services/business/src/projects/template-renderer.service.ts` - 正常（渲染逻辑）
- `templates/nextjs-15-app/k8s/overlays/staging/kustomization.yaml` - 模板文件

## 其他改进

同时在 `template-renderer.service.ts` 中：

1. **移除 await**: 改为同步调用 `ejs.render()`（因为 `async: false`）
2. **添加调试日志**: 记录传递给 YAML 文件的变量

```typescript
// 调试：记录关键文件的变量
if (fileName.endsWith('.yaml') || fileName.endsWith('.yml')) {
  this.logger.debug(`Rendering ${fileName} with variables:`, {
    projectId: variables.projectId,
    projectName: variables.projectName,
    hasAllKeys: Object.keys(variables).length,
  })
}
```

## 总结

✅ **问题已修复**

- 根本原因：`RenderTemplateHandler` 缺少 `projectId` 变量
- 修复方法：添加 `projectId: project.id` 到模板变量
- 影响：所有使用状态机路径的项目初始化
- 状态：已修复，等待验证

**下一步**: 重启后端并创建新项目验证修复效果。
