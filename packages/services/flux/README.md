# Flux Service

Flux v2 GitOps 服务模块，用于管理 Kubernetes 集群的 GitOps 部署。

## 功能特性

- ✅ Flux v2 安装和管理
- ✅ GitRepository 资源管理
- ✅ Kustomization 资源管理
- ✅ HelmRelease 资源管理
- ✅ 实时事件监听（Kubernetes Watch API）
- ✅ 自动状态同步
- ✅ 健康检查和故障诊断

## Flux v2 API 版本

本服务使用 Flux v2 的最新稳定 API 版本（2024）：

| 资源类型 | API 版本 | 状态 |
|---------|---------|------|
| GitRepository | `source.toolkit.fluxcd.io/v1` | ✅ GA (稳定版) |
| Kustomization | `kustomize.toolkit.fluxcd.io/v1` | ✅ GA (稳定版) |
| HelmRelease | `helm.toolkit.fluxcd.io/v2` | ✅ GA (稳定版) |
| Provider | `notification.toolkit.fluxcd.io/v1` | ✅ GA (稳定版) |
| Alert | `notification.toolkit.fluxcd.io/v1` | ✅ GA (稳定版) |

## 架构

```
┌─────────────────────────────────────────────────────────┐
│                    Flux Service 架构                     │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  FluxService (核心服务)                                  │
│    ├── FluxCliService (CLI 封装)                        │
│    ├── YamlGeneratorService (YAML 生成)                 │
│    └── FluxWatcherService (事件监听)                    │
│                                                          │
│  ↓ 通过 kubeconfig 连接                                  │
│                                                          │
│  K3s 集群                                                │
│    ├── flux-system namespace                            │
│    │   ├── source-controller                            │
│    │   ├── kustomize-controller                         │
│    │   ├── helm-controller                              │
│    │   └── notification-controller                      │
│    │                                                     │
│    └── 应用 namespaces                                   │
│        ├── GitRepository CRD                            │
│        ├── Kustomization CRD                            │
│        └── HelmRelease CRD                              │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

## 服务说明

### FluxService

核心服务，提供 Flux 管理的主要功能：

- `installFlux()` - 安装 Flux 到 K3s 集群
- `checkFluxHealth()` - 检查 Flux 组件健康状态
- `uninstallFlux()` - 卸载 Flux
- `createGitOpsResource()` - 创建 GitOps 资源
- `listGitOpsResources()` - 列出项目的 GitOps 资源
- `updateGitOpsResource()` - 更新 GitOps 资源
- `deleteGitOpsResource()` - 删除 GitOps 资源（软删除）

### FluxCliService

封装 Flux CLI 命令：

- `install()` - 执行 `flux install`
- `check()` - 执行 `flux check`
- `uninstall()` - 执行 `flux uninstall`
- `reconcile()` - 手动触发 reconciliation
- `getVersion()` - 获取 Flux 版本

### YamlGeneratorService

生成 Flux 资源的 YAML：

- `generateGitRepositoryYAML()` - 生成 GitRepository
- `generateKustomizationYAML()` - 生成 Kustomization
- `generateHelmReleaseYAML()` - 生成 HelmRelease
- `generateGitSecretYAML()` - 生成 Git 认证 Secret
- `generateNotificationProviderYAML()` - 生成通知 Provider
- `generateAlertYAML()` - 生成 Alert

### FluxWatcherService

实时监听 Flux 资源事件：

- 使用 Kubernetes Watch API 监听资源变化
- 自动更新数据库中的资源状态
- 支持自动重连（5秒重试）
- 监听的资源类型：
  - GitRepository
  - Kustomization
  - HelmRelease

## 使用示例

### 安装 Flux

```typescript
import { FluxService } from '@juanie/service-flux'

// 安装 Flux 到 K3s 集群
const installation = await fluxService.installFlux({
  namespace: 'flux-system',
  version: 'v2.2.0', // 可选，默认使用最新版本
})

console.log(installation)
// {
//   namespace: 'flux-system',
//   version: 'v2.2.0',
//   components: ['source-controller', 'kustomize-controller', ...],
//   status: 'installed'
// }
```

### 创建 Kustomization 资源

```typescript
// 创建 Kustomization 资源
const resource = await fluxService.createGitOpsResource({
  projectId: 'project-123',
  environmentId: 'env-456',
  repositoryId: 'repo-789',
  type: 'kustomization',
  name: 'my-app',
  namespace: 'default',
  config: {
    gitRepositoryName: 'my-repo',
    path: './k8s/overlays/production',
    interval: '5m',
    prune: true,
    healthChecks: [
      {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: 'my-app',
        namespace: 'default',
      },
    ],
  },
})
```

### 创建 HelmRelease 资源

```typescript
// 创建 HelmRelease 资源
const helmRelease = await fluxService.createGitOpsResource({
  projectId: 'project-123',
  environmentId: 'env-456',
  repositoryId: 'repo-789',
  type: 'helm',
  name: 'nginx',
  namespace: 'default',
  config: {
    chartName: 'nginx',
    chartVersion: '15.0.0',
    sourceType: 'HelmRepository',
    sourceName: 'bitnami',
    values: {
      replicaCount: 3,
      service: {
        type: 'LoadBalancer',
      },
    },
  },
})
```

### 检查 Flux 健康状态

```typescript
const health = await fluxService.checkFluxHealth()

console.log(health)
// {
//   overall: 'healthy',
//   components: [
//     { name: 'source-controller', ready: true, replicas: 1 },
//     { name: 'kustomize-controller', ready: true, replicas: 1 },
//     { name: 'helm-controller', ready: true, replicas: 1 },
//     { name: 'notification-controller', ready: true, replicas: 1 }
//   ]
// }
```

## 环境变量

```bash
# Kubeconfig 路径（必需）
KUBECONFIG_PATH=/path/to/kubeconfig
# 或
K3S_KUBECONFIG_PATH=/path/to/kubeconfig

# 开发环境跳过 TLS 验证（可选）
NODE_ENV=development
K3S_SKIP_TLS_VERIFY=true
```

## 依赖

- `@juanie/service-k3s` - K3s 服务
- `@juanie/core-database` - 数据库服务
- `@kubernetes/client-node` - Kubernetes 客户端
- `yaml` - YAML 处理库

## 技术栈

- **Flux v2** - GitOps Toolkit 架构
- **Kubernetes Watch API** - 实时事件监听
- **TypeScript** - 类型安全
- **NestJS** - 依赖注入框架
- **Drizzle ORM** - 数据库 ORM

## 参考文档

- [Flux v2 官方文档](https://fluxcd.io/flux/)
- [Flux v2 API 参考](https://fluxcd.io/flux/components/)
- [GitOps Toolkit](https://toolkit.fluxcd.io/)
