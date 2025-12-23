# 初始化进度组件和 ImagePullSecret 创建问题修复

**日期**: 2025-01-22  
**状态**: ✅ 已修复

## 问题 1: 初始化进度组件不显示

### 症状
- 项目详情页面的初始化进度组件不显示
- 浏览器控制台显示 TypeScript 错误：`找不到名称"ref"`、`找不到名称"computed"` 等

### 根本原因
`InitializationProgress.vue` 组件缺少 Vue Composition API 的显式导入。虽然项目配置了自动导入（`unplugin-auto-import`），但在某些情况下 TypeScript 类型检查会失败。

### 修复方案
在 `apps/web/src/components/InitializationProgress.vue` 中添加显式导入：

```typescript
import { ref, computed, onMounted, onUnmounted } from 'vue'
```

### 修复文件
- `apps/web/src/components/InitializationProgress.vue`

---

## 问题 2: ImagePullSecret 创建失败（错误信息被截断）

### 症状
创建项目时日志显示：
```
ERROR: [FluxResourcesService] Failed to create ImagePullSecret in project-xxx-development:
```
错误信息被截断，无法看到完整的错误堆栈。

### 根本原因
1. **错误日志不完整**: `flux-resources.service.ts` 中的 `createImagePullSecret` 方法没有记录完整的错误信息
2. **数据编码错误**: `.dockerconfigjson` 数据被双重 base64 编码
   - `flux-resources.service.ts` 中先将 JSON 字符串 base64 编码
   - `bun-k8s-client.ts` 的 `createSecret` 方法再次 base64 编码
   - 导致 K8s 无法解析 Secret 数据

### 修复方案

#### 1. 增强错误日志
在 `packages/services/business/src/gitops/flux/flux-resources.service.ts` 中：

```typescript
} else {
  // 打印完整的错误信息
  this.logger.error(`Failed to create ImagePullSecret in ${namespace}:`)
  this.logger.error(`Error message: ${error.message}`)
  this.logger.error(`Error stack: ${error.stack}`)
  
  // 打印 K8s API 响应
  if (error.body) {
    this.logger.error('K8s API response body:', JSON.stringify(error.body, null, 2))
  }
  if (error.statusCode) {
    this.logger.error(`K8s API status code: ${error.statusCode}`)
  }
  if (error.statusText) {
    this.logger.error(`K8s API status text: ${error.statusText}`)
  }
}
```

#### 2. 修复双重编码问题
移除 `flux-resources.service.ts` 中的 base64 编码：

```typescript
// ❌ 错误：双重编码
await this.k3s.createSecret(
  namespace,
  'ghcr-secret',
  {
    '.dockerconfigjson': Buffer.from(JSON.stringify(dockerConfigJson)).toString('base64'),
  },
  'kubernetes.io/dockerconfigjson',
)

// ✅ 正确：只传递 JSON 字符串
await this.k3s.createSecret(
  namespace,
  'ghcr-secret',
  {
    '.dockerconfigjson': JSON.stringify(dockerConfigJson),
  },
  'kubernetes.io/dockerconfigjson',
)
```

**原因**: `bun-k8s-client.ts` 的 `createSecret` 方法已经处理了 base64 编码：

```typescript
async createSecret(
  namespace: string,
  name: string,
  data: Record<string, string>,
  type = 'Opaque',
) {
  const encodedData: Record<string, string> = {}
  for (const [key, value] of Object.entries(data)) {
    encodedData[key] = Buffer.from(value).toString('base64')  // 这里已经编码
  }
  // ...
}
```

### 修复文件
- `packages/services/business/src/gitops/flux/flux-resources.service.ts`

---

## 验证步骤

### 1. 验证进度组件显示
1. 创建新项目
2. 进入项目详情页面
3. 确认初始化进度组件正常显示
4. 确认主进度条和子进度条都能正常更新

### 2. 验证 ImagePullSecret 创建
1. 创建新项目
2. 查看后端日志
3. 确认看到完整的错误信息（如果有错误）
4. 确认 ImagePullSecret 创建成功：
   ```bash
   kubectl get secret ghcr-secret -n project-xxx-development
   kubectl get secret ghcr-secret -n project-xxx-development -o yaml
   ```
5. 验证 Secret 数据格式正确：
   ```bash
   kubectl get secret ghcr-secret -n project-xxx-development -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d
   ```
   应该输出有效的 Docker config JSON

---

## 相关文件
- `apps/web/src/components/InitializationProgress.vue` - 进度组件
- `packages/services/business/src/gitops/flux/flux-resources.service.ts` - Flux 资源服务
- `packages/services/business/src/gitops/k3s/bun-k8s-client.ts` - K8s 客户端

## 相关文档
- [项目初始化流程](../architecture/project-initialization-flow-analysis.md)
- [GitOps 资源管理](../architecture/gitops-resources-explained.md)
- [ImagePullSecret 自动化](../guides/imagepullsecret-automation-complete.md)

## 经验教训

### 1. 自动导入的局限性
虽然 `unplugin-auto-import` 可以自动导入 Vue API，但在某些情况下（特别是 TypeScript 类型检查）可能会失败。对于核心组件，建议显式导入以确保类型安全。

### 2. 数据编码的一致性
在多层抽象中处理数据编码时，需要明确每一层的职责：
- **高层服务**（如 FluxResourcesService）：处理业务逻辑，传递原始数据
- **底层客户端**（如 BunK8sClient）：处理协议细节，如 base64 编码

避免在多个层级重复编码，导致数据损坏。

### 3. 错误日志的重要性
完整的错误日志对于问题排查至关重要。应该记录：
- 错误消息
- 错误堆栈
- API 响应体
- 状态码和状态文本

### 4. 测试 K8s Secret 的方法
```bash
# 查看 Secret
kubectl get secret <name> -n <namespace>

# 查看 Secret 详情
kubectl get secret <name> -n <namespace> -o yaml

# 解码 Secret 数据
kubectl get secret <name> -n <namespace> -o jsonpath='{.data.<key>}' | base64 -d

# 验证 dockerconfigjson 格式
kubectl get secret <name> -n <namespace> -o jsonpath='{.data.\.dockerconfigjson}' | base64 -d | jq .
```
