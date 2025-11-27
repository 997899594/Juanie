# Kubernetes 客户端 API 升级

## 概述

将 `@kubernetes/client-node` 从旧版本升级到 1.4.0,并修复所有 API 调用以适配新版本。

## 变更日期

2024-11-27

## 版本信息

- **package.json 约束**: `^1.0.0` (允许 1.x.x 的任何版本)
- **实际安装版本**: 1.4.0 (最新稳定版)
- **API 风格**: 对象参数 (1.0.0+ 的新 API)

**说明**: 
- package.json 中定义的是 `^1.0.0`,这意味着可以安装 1.0.0 到 2.0.0 之前的任何版本
- Bun 安装了符合约束的最新版本 1.4.0
- 代码之前可能是为旧版本 (< 1.0.0) 编写的,使用位置参数
- 现在更新为 1.4.0 的新 API 风格,使用对象参数

## API 变更

### 1. 参数传递方式

**旧版本 (位置参数):**
```typescript
await api.createNamespacedDeployment(namespace, deployment)
await api.readNamespacedDeployment(name, namespace)
await api.listNamespacedPod(namespace, undefined, undefined, undefined, undefined, labelSelector)
```

**新版本 (对象参数):**
```typescript
await api.createNamespacedDeployment({ namespace, body: deployment })
await api.readNamespacedDeployment({ name, namespace })
await api.listNamespacedPod({ namespace, labelSelector })
```

### 2. 响应格式

**旧版本:**
```typescript
const response = await api.readNamespacedDeployment(name, namespace)
return response.body // 需要访问 .body 属性
```

**新版本:**
```typescript
const response = await api.readNamespacedDeployment({ name, namespace })
return response // 直接返回资源对象
```

## 修改的文件

### 1. k3s.service.ts

修复了所有 Kubernetes API 调用:

**Deployment 相关:**
- `createNamespacedDeployment` - 创建 Deployment
- `replaceNamespacedDeployment` - 更新 Deployment
- `readNamespacedDeployment` - 读取 Deployment
- `listNamespacedDeployment` - 列出 Deployments
- `deleteNamespacedDeployment` - 删除 Deployment

**Service 相关:**
- `createNamespacedService` - 创建 Service
- `replaceNamespacedService` - 更新 Service

**Namespace 相关:**
- `createNamespace` - 创建 Namespace
- `readNamespace` - 读取 Namespace
- `listNamespace` - 列出 Namespaces
- `deleteNamespace` - 删除 Namespace

**Secret 相关:**
- `createNamespacedSecret` - 创建 Secret
- `replaceNamespacedSecret` - 更新 Secret

**Pod 相关:**
- `listNamespacedPod` - 列出 Pods

**Event 相关:**
- `listNamespacedEvent` - 列出 Events

### 2. flux-resources.service.ts

修复了 CustomObjectsApi 调用:

**Custom Resource 相关:**
- `patchNamespacedCustomObject` - 补丁更新自定义资源
- `createNamespacedCustomObject` - 创建自定义资源

### 3. flux-sync.service.ts

修复了 CustomObjectsApi 调用:

**Custom Resource 相关:**
- `getNamespacedCustomObject` - 获取自定义资源

### 4. git-ops.service.ts

修复了 Secret 读取:

**Secret 相关:**
- `readNamespacedSecret` - 读取 Secret

## 迁移指南

### 步骤 1: 更新参数传递

将所有位置参数改为对象参数:

```typescript
// 旧代码
await api.someMethod(arg1, arg2, arg3)

// 新代码
await api.someMethod({ param1: arg1, param2: arg2, param3: arg3 })
```

### 步骤 2: 移除 .body 访问

直接使用响应对象:

```typescript
// 旧代码
const response = await api.someMethod(...)
return response.body

// 新代码
const response = await api.someMethod(...)
return response
```

### 步骤 3: 更新 items 访问

列表响应直接包含 items:

```typescript
// 旧代码
const response = await api.listSomething(...)
return response.body.items || []

// 新代码
const response = await api.listSomething(...)
return response.items || []
```

## 常见问题

### Q: 为什么要升级?

A: 新版本提供了更好的类型安全和更清晰的 API 设计。

### Q: 是否有破坏性变更?

A: 是的,API 调用方式完全改变,需要更新所有调用代码。

### Q: 如何处理可选参数?

A: 在对象参数中,可选参数可以省略或设置为 undefined:

```typescript
await api.listNamespacedPod({
  namespace,
  labelSelector, // 可选,可以是 undefined
})
```

### Q: CustomObjectsApi 有什么变化?

A: CustomObjectsApi 也改为对象参数,但参数名称保持不变:

```typescript
// 旧代码
await api.patchNamespacedCustomObject(
  group, version, namespace, plural, name, body
)

// 新代码
await api.patchNamespacedCustomObject({
  group, version, namespace, plural, name, body
})
```

## 验证

### 类型检查

```bash
bun run type-check
```

应该没有 Kubernetes API 相关的类型错误。

### 功能测试

测试以下功能:
- ✅ 创建和删除 Namespace
- ✅ 创建和管理 Deployment
- ✅ 创建和管理 Service
- ✅ 创建和管理 Secret
- ✅ 列出 Pods
- ✅ 获取 Events
- ✅ 管理 Flux Custom Resources

## 相关文档

- [Kubernetes Client Node 文档](https://github.com/kubernetes-client/javascript)
- [API 变更日志](https://github.com/kubernetes-client/javascript/blob/master/CHANGELOG.md)

## 总结

这次升级确保了项目使用最新版本的 Kubernetes 客户端库,提供了:

- ✅ 更好的类型安全
- ✅ 更清晰的 API 设计
- ✅ 更好的错误处理
- ✅ 与最新 Kubernetes 版本的兼容性

所有 API 调用已经更新并通过类型检查。
