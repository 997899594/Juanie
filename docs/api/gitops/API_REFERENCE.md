# GitOps API 参考文档

本文档描述了 GitOps 集成的所有 API 端点。所有 API 都通过 tRPC 提供，支持类型安全的调用。

## 目录

- [Flux 管理 API](#flux-管理-api)
- [GitOps 资源 API](#gitops-资源-api)
- [双向部署 API](#双向部署-api)
- [仓库扩展 API](#仓库扩展-api)
- [部署扩展 API](#部署扩展-api)
- [环境扩展 API](#环境扩展-api)

---

## Flux 管理 API

### `gitops.installFlux`

在 K3s 集群中安装 Flux v2。

**输入参数:**

```typescript
{
  clusterId: string;      // K3s 集群 ID
  namespace?: string;     // Flux 命名空间，默认 'flux-system'
  version?: string;       // Flux 版本，默认最新版本
}
```

**返回值:**

```typescript
{
  success: boolean;
  version: string;
  components: Array<{
    name: string;
    status: 'ready' | 'pending' | 'failed';
  }>;
}
```

**示例:**

```typescript
const result = await trpc.gitops.installFlux.mutate({
  clusterId: 'cluster-123',
  namespace: 'flux-system',
  version: 'v2.2.0',
});

console.log(`Flux ${result.version} 安装成功`);
```

**错误码:**

- `FLUX_ALREADY_INSTALLED` - Flux 已经安装
- `K3S_NOT_READY` - K3s 集群未就绪
- `INSUFFICIENT_PERMISSIONS` - 权限不足

---

### `gitops.checkFluxHealth`

检查 Flux 组件的健康状态。

**输入参数:**

```typescript
{
  clusterId: string;
}
```

**返回值:**

```typescript
{
  overall: 'healthy' | 'degraded' | 'unhealthy';
  components: Array<{
    name: string;
    ready: boolean;
    replicas: number;
    readyReplicas: number;
    conditions: Array<{
      type: string;
      status: string;
      message: string;
    }>;
  }>;
}
```

**示例:**

```typescript
const health = await trpc.gitops.checkFluxHealth.query({
  clusterId: 'cluster-123',
});

if (health.overall !== 'healthy') {
  console.warn('Flux 组件异常:', health.components);
}
```

---

### `gitops.uninstallFlux`

卸载 Flux v2。

**输入参数:**

```typescript
{
  clusterId: string;
  deleteNamespace?: boolean;  // 是否删除命名空间，默认 false
}
```

**返回值:**

```typescript
{
  success: boolean;
  message: string;
}
```

---

## GitOps 资源 API

### `gitops.createGitOpsResource`

创建 GitOps 资源（Kustomization 或 HelmRelease）。

**输入参数:**

```typescript
{
  projectId: string;
  environmentId: string;
  repositoryId: string;
  type: 'kustomization' | 'helm';
  name: string;
  namespace: string;
  config: {
    // Kustomization 配置
    path?: string;
    prune?: boolean;
    healthChecks?: Array<{
      apiVersion: string;
      kind: string;
      name: string;
      namespace?: string;
    }>;
    dependsOn?: Array<{
      name: string;
      namespace?: string;
    }>;
    interval?: string;
    timeout?: string;
    retryInterval?: string;
    
    // Helm 配置
    chartName?: string;
    chartVersion?: string;
    sourceType?: 'GitRepository' | 'HelmRepository';
    values?: Record<string, any>;
    valuesFrom?: Array<{
      kind: string;
      name: string;
      valuesKey?: string;
    }>;
    install?: {
      remediation?: { retries: number };
      createNamespace?: boolean;
    };
    upgrade?: {
      remediation?: { retries: number; remediateLastFailure: boolean };
      cleanupOnFail?: boolean;
    };
  };
}
```

**返回值:**

```typescript
{
  id: string;
  name: string;
  type: string;
  status: 'pending' | 'ready' | 'reconciling' | 'failed';
  createdAt: string;
}
```

**示例 - 创建 Kustomization:**

```typescript
const resource = await trpc.gitops.createGitOpsResource.mutate({
  projectId: 'project-123',
  environmentId: 'env-prod',
  repositoryId: 'repo-456',
  type: 'kustomization',
  name: 'my-app-prod',
  namespace: 'default',
  config: {
    path: './k8s/overlays/production',
    prune: true,
    healthChecks: [
      {
        apiVersion: 'apps/v1',
        kind: 'Deployment',
        name: 'my-app',
      },
    ],
    interval: '5m',
    timeout: '3m',
  },
});

console.log(`GitOps 资源已创建: ${resource.id}`);
```

**示例 - 创建 HelmRelease:**

```typescript
const helmRelease = await trpc.gitops.createGitOpsResource.mutate({
  projectId: 'project-123',
  environmentId: 'env-prod',
  repositoryId: 'repo-456',
  type: 'helm',
  name: 'my-app-helm',
  namespace: 'default',
  config: {
    chartName: 'my-app',
    chartVersion: '1.0.0',
    sourceType: 'GitRepository',
    values: {
      replicaCount: 3,
      image: {
        repository: 'ghcr.io/org/my-app',
        tag: 'v1.0.0',
      },
    },
    upgrade: {
      remediation: {
        retries: 3,
        remediateLastFailure: true,
      },
      cleanupOnFail: true,
    },
  },
});
```

---

### `gitops.listGitOpsResources`

列出项目的所有 GitOps 资源。

**输入参数:**

```typescript
{
  projectId: string;
  environmentId?: string;  // 可选，筛选特定环境
  type?: 'kustomization' | 'helm';  // 可选，筛选类型
}
```

**返回值:**

```typescript
Array<{
  id: string;
  name: string;
  type: 'kustomization' | 'helm';
  status: string;
  lastAppliedRevision: string;
  errorMessage?: string;
  environment: {
    id: string;
    name: string;
  };
  repository: {
    id: string;
    fullName: string;
  };
  createdAt: string;
  updatedAt: string;
}>
```

**示例:**

```typescript
const resources = await trpc.gitops.listGitOpsResources.query({
  projectId: 'project-123',
  environmentId: 'env-prod',
});

resources.forEach(r => {
  console.log(`${r.name}: ${r.status}`);
});
```

---

### `gitops.getGitOpsResource`

获取 GitOps 资源详情。

**输入参数:**

```typescript
{
  id: string;
}
```

**返回值:**

```typescript
{
  id: string;
  name: string;
  type: string;
  namespace: string;
  config: object;
  status: string;
  lastAppliedRevision: string;
  lastAttemptedRevision: string;
  errorMessage?: string;
  conditions: Array<{
    type: string;
    status: string;
    reason: string;
    message: string;
    lastTransitionTime: string;
  }>;
  events: Array<{
    type: string;
    reason: string;
    message: string;
    timestamp: string;
  }>;
}
```

---

### `gitops.updateGitOpsResource`

更新 GitOps 资源配置。

**输入参数:**

```typescript
{
  id: string;
  config: object;  // 新的配置
}
```

**返回值:**

```typescript
{
  id: string;
  updatedAt: string;
}
```

---

### `gitops.deleteGitOpsResource`

删除 GitOps 资源（软删除）。

**输入参数:**

```typescript
{
  id: string;
}
```

**返回值:**

```typescript
{
  success: boolean;
}
```

---

### `gitops.triggerSync`

手动触发 GitOps 资源同步。

**输入参数:**

```typescript
{
  id: string;
}
```

**返回值:**

```typescript
{
  success: boolean;
  message: string;
  syncedAt: string;
}
```

**示例:**

```typescript
const result = await trpc.gitops.triggerSync.mutate({
  id: 'resource-123',
});

console.log('同步已触发，等待 Flux 处理...');
```

---

## 双向部署 API

### `gitops.deployWithGitOps`

通过 UI 部署（自动创建 Git commit）。

**输入参数:**

```typescript
{
  projectId: string;
  environmentId: string;
  image?: string;
  replicas?: number;
  env?: Record<string, string>;
  resources?: {
    requests?: { cpu: string; memory: string };
    limits?: { cpu: string; memory: string };
  };
  commitMessage?: string;
}
```

**返回值:**

```typescript
{
  deploymentId: string;
  commitSha: string;
  gitUrl: string;
  message: string;
}
```

**示例:**

```typescript
const deployment = await trpc.gitops.deployWithGitOps.mutate({
  projectId: 'project-123',
  environmentId: 'env-prod',
  image: 'ghcr.io/org/my-app:v1.2.3',
  replicas: 5,
  env: {
    NODE_ENV: 'production',
    API_URL: 'https://api.example.com',
  },
  resources: {
    requests: { cpu: '200m', memory: '256Mi' },
    limits: { cpu: '1000m', memory: '512Mi' },
  },
  commitMessage: 'Deploy v1.2.3 to production',
});

console.log(`部署已提交: ${deployment.commitSha}`);
console.log(`查看 commit: ${deployment.gitUrl}`);
```

---

### `gitops.commitConfigChanges`

提交配置变更到 Git。

**输入参数:**

```typescript
{
  projectId: string;
  environmentId: string;
  yaml: string;  // 完整的 YAML 内容
  commitMessage: string;
  commitDescription?: string;
}
```

**返回值:**

```typescript
{
  commitSha: string;
  gitUrl: string;
  branch: string;
}
```

---

### `gitops.previewChanges`

预览配置变更（不提交）。

**输入参数:**

```typescript
{
  projectId: string;
  environmentId: string;
  changes: {
    image?: string;
    replicas?: number;
    env?: Record<string, string>;
  };
}
```

**返回值:**

```typescript
{
  diff: string;  // Git diff 格式
  summary: {
    additions: number;
    deletions: number;
    files: string[];
  };
  impact: {
    willRestartPods: boolean;
    estimatedDowntime: string;
    affectedResources: string[];
  };
}
```

**示例:**

```typescript
const preview = await trpc.gitops.previewChanges.query({
  projectId: 'project-123',
  environmentId: 'env-prod',
  changes: {
    image: 'ghcr.io/org/my-app:v1.2.3',
    replicas: 5,
  },
});

console.log('变更预览:');
console.log(preview.diff);
console.log(`将重启 Pods: ${preview.impact.willRestartPods}`);
console.log(`预计停机时间: ${preview.impact.estimatedDowntime}`);
```

---

### `gitops.validateYAML`

验证 YAML 配置。

**输入参数:**

```typescript
{
  yaml: string;
}
```

**返回值:**

```typescript
{
  valid: boolean;
  errors?: Array<{
    line: number;
    column: number;
    message: string;
  }>;
  warnings?: Array<{
    message: string;
    suggestion: string;
  }>;
}
```

---

## 仓库扩展 API

### `repositories.enableGitOps`

为仓库启用 GitOps。

**输入参数:**

```typescript
{
  repositoryId: string;
  config: {
    fluxNamespace: string;
    syncInterval: string;
    secretRef?: string;
  };
}
```

**返回值:**

```typescript
{
  success: boolean;
  fluxResourceName: string;
}
```

**示例:**

```typescript
await trpc.repositories.enableGitOps.mutate({
  repositoryId: 'repo-123',
  config: {
    fluxNamespace: 'flux-system',
    syncInterval: '1m',
  },
});
```

---

### `repositories.getFluxStatus`

获取仓库的 Flux 同步状态。

**输入参数:**

```typescript
{
  repositoryId: string;
}
```

**返回值:**

```typescript
{
  syncStatus: 'ready' | 'reconciling' | 'failed';
  lastSyncCommit: string;
  lastSyncTime: string;
  errorMessage?: string;
}
```

---

## 部署扩展 API

现有的 `deployments.create` API 已扩展，支持 GitOps 部署方法。

### `deployments.list`

列出部署记录（已扩展）。

**返回值中新增字段:**

```typescript
{
  // ... 现有字段 ...
  deploymentMethod: 'manual' | 'gitops-ui' | 'gitops-git' | 'pipeline';
  gitopsResourceId?: string;
  gitCommitSha?: string;
  gitCommitUrl?: string;
}
```

**示例:**

```typescript
const deployments = await trpc.deployments.list.query({
  projectId: 'project-123',
});

deployments.forEach(d => {
  if (d.deploymentMethod === 'gitops-ui') {
    console.log(`UI 部署: ${d.gitCommitSha}`);
  } else if (d.deploymentMethod === 'gitops-git') {
    console.log(`Git 部署: ${d.gitCommitSha}`);
  }
});
```

---

## 环境扩展 API

### `environments.configureGitOps`

配置环境的 GitOps 设置。

**输入参数:**

```typescript
{
  environmentId: string;
  config: {
    enabled: boolean;
    autoSync: boolean;
    gitBranch: string;
    gitPath: string;
    syncInterval: string;
  };
}
```

**返回值:**

```typescript
{
  success: boolean;
}
```

**示例:**

```typescript
// 生产环境：手动同步
await trpc.environments.configureGitOps.mutate({
  environmentId: 'env-prod',
  config: {
    enabled: true,
    autoSync: false,  // 需要手动触发
    gitBranch: 'main',
    gitPath: './k8s/overlays/production',
    syncInterval: '10m',
  },
});

// 开发环境：自动同步
await trpc.environments.configureGitOps.mutate({
  environmentId: 'env-dev',
  config: {
    enabled: true,
    autoSync: true,  // 自动同步
    gitBranch: 'develop',
    gitPath: './k8s/overlays/development',
    syncInterval: '1m',
  },
});
```

---

### `environments.getGitOpsConfig`

获取环境的 GitOps 配置。

**输入参数:**

```typescript
{
  environmentId: string;
}
```

**返回值:**

```typescript
{
  enabled: boolean;
  autoSync: boolean;
  gitBranch: string;
  gitPath: string;
  syncInterval: string;
}
```

---

## 错误处理

所有 API 都遵循统一的错误格式：

```typescript
{
  code: string;
  message: string;
  details?: any;
}
```

### 常见错误码

| 错误码 | 描述 | 解决方案 |
|--------|------|----------|
| `FLUX_NOT_INSTALLED` | Flux 未安装 | 先调用 `installFlux` |
| `REPOSITORY_NOT_FOUND` | 仓库不存在 | 检查 repositoryId |
| `GITOPS_NOT_ENABLED` | GitOps 未启用 | 先调用 `enableGitOps` |
| `GIT_AUTH_FAILED` | Git 认证失败 | 检查 Secret 配置 |
| `YAML_INVALID` | YAML 格式错误 | 使用 `validateYAML` 检查 |
| `CONFLICT_DETECTED` | 检测到冲突 | 手动解决冲突 |
| `INSUFFICIENT_PERMISSIONS` | 权限不足 | 检查用户权限 |

---

## 最佳实践

### 1. 错误处理

```typescript
try {
  const result = await trpc.gitops.deployWithGitOps.mutate(data);
  console.log('部署成功:', result);
} catch (error) {
  if (error.code === 'CONFLICT_DETECTED') {
    // 处理冲突
    const conflicts = error.details.conflicts;
    // 显示冲突解决 UI
  } else if (error.code === 'GIT_AUTH_FAILED') {
    // 提示用户配置 Git 凭证
  } else {
    // 通用错误处理
    console.error('部署失败:', error.message);
  }
}
```

### 2. 轮询状态

```typescript
async function waitForDeployment(deploymentId: string) {
  const maxAttempts = 60;
  let attempts = 0;
  
  while (attempts < maxAttempts) {
    const deployment = await trpc.deployments.get.query({ id: deploymentId });
    
    if (deployment.status === 'success') {
      return deployment;
    } else if (deployment.status === 'failed') {
      throw new Error(deployment.errorMessage);
    }
    
    await new Promise(resolve => setTimeout(resolve, 5000));
    attempts++;
  }
  
  throw new Error('部署超时');
}
```

### 3. 批量操作

```typescript
// 为多个环境配置 GitOps
const environments = ['dev', 'staging', 'prod'];

await Promise.all(
  environments.map(env =>
    trpc.environments.configureGitOps.mutate({
      environmentId: env,
      config: getConfigForEnvironment(env),
    })
  )
);
```

---

## 类型定义

完整的 TypeScript 类型定义可以在 `@/core/types` 包中找到：

```typescript
import type {
  GitOpsResource,
  FluxStatus,
  DeploymentMethod,
} from '@/core/types';
```

---

## 相关文档

- [GitOps 快速入门](../getting-started/QUICK_START.md)
- [UI 操作指南](../guides/UI_GUIDE.md)
- [Git 工作流指南](../guides/GIT_WORKFLOW.md)
- [故障排查指南](../troubleshooting/GITOPS_TROUBLESHOOTING.md)
