# BunK8sClient 快速参考

## 基本使用

### 初始化

```typescript
import { BunK8sClient } from '@/gitops/k3s/bun-k8s-client'

const client = new BunK8sClient('/path/to/kubeconfig')
```

### 健康检查

```typescript
const healthy = await client.healthCheck()
```

## Namespace 操作

```typescript
// 列出所有 Namespace
const namespaces = await client.listNamespaces()

// 创建 Namespace
await client.createNamespace('my-namespace')

// 删除 Namespace
await client.deleteNamespace('my-namespace')
```

## Pod 操作

```typescript
// 列出 Namespace 中的所有 Pod
const pods = await client.listPods('default')

// 使用 Label Selector
const pods = await client.listPods('default', 'app=nginx')
```

## Deployment 操作

```typescript
// 列出 Deployment
const deployments = await client.listDeployments('default')

// 获取单个 Deployment
const deployment = await client.getDeployment('default', 'my-app')

// 创建 Deployment
await client.createDeployment('default', {
  apiVersion: 'apps/v1',
  kind: 'Deployment',
  metadata: { name: 'my-app' },
  spec: { ... }
})

// 更新 Deployment
await client.updateDeployment('default', 'my-app', deployment)

// 删除 Deployment
await client.deleteDeployment('default', 'my-app')
```

## Service 操作

```typescript
// 创建 Service
await client.createService('default', {
  apiVersion: 'v1',
  kind: 'Service',
  metadata: { name: 'my-service' },
  spec: { ... }
})

// 删除 Service
await client.deleteService('default', 'my-service')
```

## Secret 操作

```typescript
// 创建 Secret
await client.createSecret('default', 'my-secret', {
  username: 'admin',
  password: 'secret123'
}, 'Opaque')
```

## Custom Resources (Flux)

### GitRepository

```typescript
// 列出 GitRepository
const repos = await client.listCustomResources(
  'source.toolkit.fluxcd.io',
  'v1',
  'gitrepositories',
  'flux-system'
)

// 获取单个 GitRepository
const repo = await client.getNamespacedCustomObject({
  group: 'source.toolkit.fluxcd.io',
  version: 'v1',
  plural: 'gitrepositories',
  namespace: 'flux-system',
  name: 'my-repo'
})

// 创建 GitRepository
await client.createNamespacedCustomObject({
  group: 'source.toolkit.fluxcd.io',
  version: 'v1',
  plural: 'gitrepositories',
  namespace: 'flux-system',
  body: {
    apiVersion: 'source.toolkit.fluxcd.io/v1',
    kind: 'GitRepository',
    metadata: { name: 'my-repo' },
    spec: { ... }
  }
})

// 更新 GitRepository (Patch)
await client.patchNamespacedCustomObject({
  group: 'source.toolkit.fluxcd.io',
  version: 'v1',
  plural: 'gitrepositories',
  namespace: 'flux-system',
  name: 'my-repo',
  body: {
    spec: { interval: '5m' }
  }
})

// 删除 GitRepository
await client.deleteCustomResource(
  'source.toolkit.fluxcd.io',
  'v1',
  'gitrepositories',
  'flux-system',
  'my-repo'
)
```

### Kustomization

```typescript
// 列出 Kustomization
const kustomizations = await client.listCustomResources(
  'kustomize.toolkit.fluxcd.io',
  'v1',
  'kustomizations',
  'flux-system'
)

// 获取单个 Kustomization
const kustomization = await client.getNamespacedCustomObject({
  group: 'kustomize.toolkit.fluxcd.io',
  version: 'v1',
  plural: 'kustomizations',
  namespace: 'flux-system',
  name: 'my-app'
})
```

### HelmRelease

```typescript
// 列出 HelmRelease
const releases = await client.listCustomResources(
  'helm.toolkit.fluxcd.io',
  'v2',
  'helmreleases',
  'default'
)
```

## Events

```typescript
// 获取 Namespace 中的事件
const events = await client.getEvents('default')

events.forEach(event => {
  console.log(`${event.type}: ${event.message}`)
})
```

## 错误处理

```typescript
try {
  await client.getDeployment('default', 'non-existent')
} catch (error) {
  if (error.message.includes('404')) {
    console.log('Deployment 不存在')
  } else if (error.message.includes('401')) {
    console.log('认证失败')
  } else {
    console.error('未知错误:', error)
  }
}
```

## 在 NestJS 中使用

### K3sService

```typescript
import { K3sService } from '@/gitops/k3s/k3s.service'

@Injectable()
export class MyService {
  constructor(private k3s: K3sService) {}

  async listPods() {
    // K3sService 内部使用 BunK8sClient
    return this.k3s.listPods('default')
  }
}
```

### 直接使用

```typescript
import { BunK8sClient } from '@/gitops/k3s/bun-k8s-client'
import { ConfigService } from '@nestjs/config'

@Injectable()
export class MyService {
  private client: BunK8sClient

  constructor(private config: ConfigService) {
    const kubeconfigPath = this.config.get('K3S_KUBECONFIG_PATH')
    this.client = new BunK8sClient(kubeconfigPath)
  }

  async doSomething() {
    const namespaces = await this.client.listNamespaces()
    // ...
  }
}
```

## 常见问题

### Q: 如何处理自签名证书？

A: 在 kubeconfig 中设置 `insecure-skip-tls-verify: true`：

```yaml
clusters:
- cluster:
    server: https://k3s.example.com:6443
    insecure-skip-tls-verify: true
  name: k3s
```

### Q: 如何使用 Bearer Token 认证？

A: 在 kubeconfig 中配置 token：

```yaml
users:
- name: k3s
  user:
    token: eyJhbGciOiJSUzI1NiIsImtpZCI6...
```

### Q: 如何调试 API 请求？

A: 查看错误消息，包含完整的响应：

```typescript
try {
  await client.getDeployment('default', 'my-app')
} catch (error) {
  console.error(error.message) // 包含 HTTP 状态码和响应体
}
```

### Q: 支持哪些认证方式？

A: 目前支持：
- ✅ 客户端证书（cert + key）
- ✅ Bearer Token
- ❌ OIDC（不需要）
- ❌ Exec（不需要）

### Q: 如何实现 Watch API？

A: 使用轮询方式：

```typescript
async watchResources() {
  let lastResourceVersion = '0'
  
  setInterval(async () => {
    const resources = await client.listCustomResources(...)
    
    // 检查 resourceVersion 是否变化
    const currentVersion = resources[0]?.metadata?.resourceVersion
    if (currentVersion !== lastResourceVersion) {
      console.log('资源已更新')
      lastResourceVersion = currentVersion
      // 处理变化
    }
  }, 5000) // 每 5 秒检查一次
}
```

## 性能优化

### 复用客户端实例

```typescript
// ✅ 好的做法
const client = new BunK8sClient(kubeconfigPath)
await client.listNamespaces()
await client.listPods('default')

// ❌ 避免
await new BunK8sClient(kubeconfigPath).listNamespaces()
await new BunK8sClient(kubeconfigPath).listPods('default')
```

### 使用 Label Selector

```typescript
// ✅ 好的做法 - 只获取需要的 Pod
const pods = await client.listPods('default', 'app=nginx')

// ❌ 避免 - 获取所有 Pod 再过滤
const allPods = await client.listPods('default')
const filteredPods = allPods.filter(p => p.metadata.labels?.app === 'nginx')
```

## 测试

### 单元测试

```typescript
import { BunK8sClient } from '@/gitops/k3s/bun-k8s-client'

describe('BunK8sClient', () => {
  let client: BunK8sClient

  beforeEach(() => {
    client = new BunK8sClient(process.env.KUBECONFIG_PATH!)
  })

  it('should list namespaces', async () => {
    const namespaces = await client.listNamespaces()
    expect(namespaces).toBeDefined()
    expect(Array.isArray(namespaces)).toBe(true)
  })
})
```

### 集成测试

```bash
# 运行测试脚本
bun run scripts/test-bun-k8s-client.ts
```

## 相关文档

- [架构设计](../../architecture/bun-k8s-client.md)
- [迁移记录](./k8s-client-migration.md)
- [迁移总结](./MIGRATION_SUMMARY.md)
