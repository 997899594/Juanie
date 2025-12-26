# Business 层 Flux 清理迁移指南

## 概述

本文档记录了 Business 层 Flux 模块的清理工作，删除了与 Core 层重复的实现，并提供了迁移指南。

**完成时间**: 2025-12-25  
**任务**: 上游工具迁移 - 任务 1（删除 Business 层重复的 Flux 实现）

## 已删除的服务

### 1. FluxService (Business 层)
- **文件**: `packages/services/business/src/gitops/flux/flux.service.ts`
- **原因**: Core 层已有完整实现
- **替代方案**: 使用 `@juanie/core/flux` 的 `FluxService`

### 2. FluxResourcesService
- **文件**: `packages/services/business/src/gitops/flux/flux-resources.service.ts`
- **原因**: 95%+ 代码与 Core 层重复
- **替代方案**: 
  - 使用 `@juanie/core/flux` 的 `FluxCliService` 进行 Flux CLI 操作
  - 使用 `@juanie/core/k8s` 的 `K8sClientService` 进行 K8s 资源操作

### 3. FluxSyncService
- **文件**: `packages/services/business/src/gitops/flux/flux-sync.service.ts`
- **原因**: 功能应该在 GitSyncService 中实现
- **替代方案**: 功能已合并到 `GitSyncService`

### 4. FluxWatcherService (Business 层)
- **文件**: `packages/services/business/src/gitops/flux/flux-watcher.service.ts`
- **原因**: Core 层已有实现
- **替代方案**: 使用 `@juanie/core/flux` 的 `FluxWatcherService`

## 保留的服务

### 1. FluxMetricsService ✅
- **文件**: `packages/services/business/src/gitops/flux/flux-metrics.service.ts`
- **原因**: 业务指标收集，属于 Business 层职责
- **用途**: 收集 GitOps 相关的 Prometheus 指标

### 2. YamlGeneratorService ✅
- **文件**: `packages/services/business/src/gitops/flux/yaml-generator.service.ts`
- **原因**: 有用的工具服务
- **用途**: 生成 Flux 资源的 YAML

## 迁移指南

### 场景 1: 创建 GitRepository 和 Kustomization

**迁移前**:
```typescript
import { FluxResourcesService } from '@juanie/service-business'

@Injectable()
export class MyService {
  constructor(private fluxResources: FluxResourcesService) {}

  async setupFlux(projectId: string) {
    await this.fluxResources.createGitRepository({
      name: `project-${projectId}`,
      namespace: 'default',
      url: 'https://github.com/user/repo',
      branch: 'main'
    })

    await this.fluxResources.createKustomization({
      name: `project-${projectId}`,
      namespace: 'default',
      gitRepositoryName: `project-${projectId}`,
      path: './k8s'
    })
  }
}
```

**迁移后**:
```typescript
import { FluxCliService } from '@juanie/core/flux'
import { K8sClientService } from '@juanie/core/k8s'
import { YamlGeneratorService } from '@juanie/service-business'

@Injectable()
export class MyService {
  constructor(
    private fluxCli: FluxCliService,
    private k8sClient: K8sClientService,
    private yamlGenerator: YamlGeneratorService
  ) {}

  async setupFlux(projectId: string) {
    // 方式 1: 使用 Flux CLI（推荐）
    await this.fluxCli.reconcile('gitrepository', `project-${projectId}`, 'default')
    await this.fluxCli.reconcile('kustomization', `project-${projectId}`, 'default')

    // 方式 2: 使用 K8s API + YAML Generator
    const gitRepoYaml = this.yamlGenerator.generateGitRepositoryYAML({
      name: `project-${projectId}`,
      namespace: 'default',
      url: 'https://github.com/user/repo',
      branch: 'main'
    })

    const kustomizationYaml = this.yamlGenerator.generateKustomizationYAML({
      name: `project-${projectId}`,
      namespace: 'default',
      gitRepositoryName: `project-${projectId}`,
      path: './k8s'
    })

    // 应用 YAML
    await this.applyYaml(gitRepoYaml, 'default')
    await this.applyYaml(kustomizationYaml, 'default')
  }

  private async applyYaml(yaml: string, namespace: string) {
    const resource = this.yamlGenerator.parseYAML(yaml)
    const { apiVersion, kind, metadata } = resource
    const [group, version] = apiVersion.split('/')
    const plural = this.getPluralName(kind)

    await this.k8sClient.patchNamespacedCustomObject({
      group,
      version,
      namespace,
      plural,
      name: metadata.name,
      body: resource
    })
  }

  private getPluralName(kind: string): string {
    const pluralMap: Record<string, string> = {
      GitRepository: 'gitrepositories',
      Kustomization: 'kustomizations',
    }
    return pluralMap[kind] || `${kind.toLowerCase()}s`
  }
}
```

### 场景 2: 触发部署

**迁移前**:
```typescript
import { FluxResourcesService } from '@juanie/service-business'

await this.fluxResources.reconcileProject(projectId, 'production')
```

**迁移后**:
```typescript
import { FluxCliService } from '@juanie/core/flux'

const namespace = `project-${projectId}-production`
const kustomizationName = `${projectId}-production`

await this.fluxCli.reconcile('kustomization', kustomizationName, namespace)
```

### 场景 3: 创建 ImagePullSecret

**迁移前**:
```typescript
await this.fluxResources.createImagePullSecret(
  namespace,
  githubUsername,
  githubToken
)
```

**迁移后**:
```typescript
import { K8sClientService } from '@juanie/core/k8s'

const dockerConfigJson = {
  auths: {
    'ghcr.io': {
      username: githubUsername,
      password: githubToken,
      auth: Buffer.from(`${githubUsername}:${githubToken}`).toString('base64')
    }
  }
}

await this.k8sClient.createSecret(
  namespace,
  'ghcr-secret',
  { '.dockerconfigjson': JSON.stringify(dockerConfigJson) },
  'kubernetes.io/dockerconfigjson'
)
```

### 场景 4: 等待资源就绪

**迁移前**:
```typescript
import { FluxSyncService } from '@juanie/service-business'

const status = await this.fluxSync.waitForKustomizationReady(
  name,
  namespace,
  60000
)
```

**迁移后**:
```typescript
import { K8sClientService } from '@juanie/core/k8s'

async function waitForKustomizationReady(
  k8sClient: K8sClientService,
  name: string,
  namespace: string,
  timeout: number
): Promise<'ready' | 'reconciling' | 'failed'> {
  const startTime = Date.now()

  while (Date.now() - startTime < timeout) {
    try {
      const resource = await k8sClient.getNamespacedCustomObject({
        group: 'kustomize.toolkit.fluxcd.io',
        version: 'v1',
        namespace,
        plural: 'kustomizations',
        name
      })

      const conditions = (resource as any).status?.conditions || []
      const readyCondition = conditions.find((c: any) => c.type === 'Ready')

      if (!readyCondition) {
        await new Promise(resolve => setTimeout(resolve, 3000))
        continue
      }

      if (readyCondition.status === 'True') {
        return 'ready'
      }

      if (readyCondition.reason === 'Failed' || readyCondition.reason === 'Error') {
        return 'failed'
      }

      await new Promise(resolve => setTimeout(resolve, 3000))
    } catch (error) {
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  }

  return 'reconciling'
}
```

## 需要更新的文件

以下文件需要更新以使用新的导入：

### 高优先级（阻塞功能）

1. **packages/services/business/src/projects/initialization/initialization.service.ts**
   - 使用: `FluxResourcesService`
   - 迁移: 使用 `FluxCliService` + `K8sClientService` + `YamlGeneratorService`

2. **packages/services/business/src/deployments/deployments.service.ts**
   - 使用: `FluxResourcesService.reconcileProject()`
   - 迁移: 使用 `FluxCliService.reconcile()`

3. **packages/services/business/src/projects/project-cleanup.service.ts**
   - 使用: `FluxResourcesService`
   - 迁移: 使用 `K8sClientService` 删除资源

4. **apps/api-gateway/src/routers/gitops.router.ts**
   - 使用: `FluxResourcesService`, `FluxSyncService`
   - 迁移: 使用 `FluxCliService` + `K8sClientService`

### 中优先级（模块导入）

5. **packages/services/business/src/projects/initialization/initialization.module.ts**
   - 导入: `FluxModule`（Business 层）
   - 迁移: 导入 `FluxModule`（Core 层）或直接导入 `FluxCliService`

## 模块导入更新

### GitSyncModule ✅ 已完成

```typescript
// ✅ 正确的导入
import { FluxModule } from '@juanie/core/flux'
import { K8sModule } from '@juanie/core/k8s'

@Module({
  imports: [
    FluxModule,  // Core 层
    K8sModule,   // Core 层
    // ...
  ]
})
export class GitSyncModule {}
```

### Business FluxModule ✅ 已完成

```typescript
// ✅ 简化后的 Business FluxModule
import { FluxModule as CoreFluxModule } from '@juanie/core/flux'
import { K8sModule } from '@juanie/core/k8s'

@Module({
  imports: [CoreFluxModule, K8sModule],
  providers: [
    FluxMetricsService,    // ✅ 保留
    YamlGeneratorService,  // ✅ 保留
  ],
  exports: [
    FluxMetricsService,
    YamlGeneratorService,
    CoreFluxModule,  // ✅ 导出供其他模块使用
    K8sModule,
  ]
})
export class FluxModule {}
```

## 架构改进

### 清理前的问题

1. **重复实现**: Business 和 Core 层都有 Flux 操作代码
2. **职责不清**: Business 层不应该直接操作 K8s 资源
3. **维护成本高**: 两份代码需要同步维护
4. **测试困难**: 需要为两层分别编写测试

### 清理后的架构

```
┌─────────────────────────────────────────┐
│         Business 层                      │
│  ┌────────────────────────────────────┐ │
│  │ GitSyncService                     │ │
│  │  - 直接使用 FluxCliService         │ │
│  │  - 直接使用 K8sClientService       │ │
│  │  - 直接使用 EventEmitter2          │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ 工具服务                            │ │
│  │  - FluxMetricsService              │ │
│  │  - YamlGeneratorService            │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
                  │
                  ▼
┌─────────────────────────────────────────┐
│         Core 层                          │
│  ┌────────────────────────────────────┐ │
│  │ FluxCliService                     │ │
│  │  - Flux CLI 包装器                 │ │
│  │  - reconcile, install, check       │ │
│  └────────────────────────────────────┘ │
│  ┌────────────────────────────────────┐ │
│  │ K8sClientService                   │ │
│  │  - K8s 官方客户端包装器             │ │
│  │  - CRUD 操作                       │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

### 优势

1. **单一职责**: Core 层负责基础设施，Business 层负责业务逻辑
2. **代码减少**: 删除了约 800 行重复代码
3. **易于测试**: 只需测试 Core 层的基础功能
4. **易于维护**: 只有一份 Flux 操作代码

## 验证清单

- [x] 删除 Business 层重复的 Flux 服务文件
- [x] 更新 GitSyncService 使用 Core 层服务
- [x] 更新 GitSyncModule 导入
- [x] 更新 Business FluxModule
- [x] 更新导出文件（index.ts）
- [ ] 更新 InitializationService
- [ ] 更新 DeploymentsService
- [ ] 更新 ProjectCleanupService
- [ ] 更新 GitOps Router
- [ ] 运行测试验证
- [ ] 更新文档

## 下一步

1. 更新所有引用已删除服务的文件
2. 运行 `bun run typecheck` 确保无类型错误
3. 运行 `bun test` 确保所有测试通过
4. 更新项目指南中的导入示例
5. 创建迁移完成总结文档

## 参考

- 设计文档: `.kiro/specs/upstream-tools-migration/design.md`
- 任务列表: `.kiro/specs/upstream-tools-migration/tasks.md`
- Core 层 Flux 服务: `packages/core/src/flux/`
- Core 层 K8s 服务: `packages/core/src/k8s/`
