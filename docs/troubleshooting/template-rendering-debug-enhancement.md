# 模板渲染调试增强

**日期**: 2024-12-23  
**状态**: ✅ 已完成  
**类型**: 调试增强

## 问题描述

项目初始化时模板渲染失败，错误信息：
```
projectId is not defined
```

但代码检查显示 `projectId` 已经正确传递给模板渲染器。

## 根本原因

调试日志级别设置为 `debug`，在生产环境中不会输出，导致无法看到实际传递的变量。

## 解决方案

### 1. 增强调试日志

**文件**: `packages/services/business/src/projects/template-renderer.service.ts`

**修改内容**:
```typescript
// ❌ 之前：使用 debug 级别
this.logger.debug(`Rendering ${fileName} with variables:`, {
  projectId: variables.projectId,
  projectName: variables.projectName,
  hasAllKeys: Object.keys(variables).length,
})

// ✅ 修改后：使用 info 级别，输出所有 key
this.logger.info(`🔍 Rendering ${fileName} with variables:`, {
  projectId: variables.projectId,
  projectName: variables.projectName,
  allKeys: Object.keys(variables),
})
```

### 2. 增强错误日志

在关键文件渲染失败时，输出完整的变量对象：

```typescript
if (isCritical) {
  this.logger.error(`❌ Critical file rendering failed [${fileName}]:`, error)
  this.logger.error(`📋 Variables passed:`, variables)  // 新增
  throw new Error(...)
}
```

## 验证步骤

1. 重启后端：
   ```bash
   bun run dev:api
   ```

2. 创建新项目，观察日志输出：
   ```
   [TemplateRenderer] 🔍 Rendering kustomization.yaml with variables: {
     projectId: "xxx",
     projectName: "test",
     allKeys: ["projectId", "projectName", "description", ...]
   }
   ```

3. 如果仍然失败，错误日志会显示完整的变量对象

## 预期结果

- ✅ 能够看到传递给 YAML 文件的所有变量
- ✅ 如果 `projectId` 缺失，能够立即发现
- ✅ 如果 `projectId` 存在但仍然报错，说明是 EJS 渲染问题

## 相关文件

- `packages/services/business/src/projects/template-renderer.service.ts`
- `packages/services/business/src/projects/initialization/handlers/render-template.handler.ts`
- `templates/nextjs-15-app/k8s/overlays/staging/kustomization.yaml`

## 下一步

等待用户重新测试，根据新的日志输出进一步诊断问题。
