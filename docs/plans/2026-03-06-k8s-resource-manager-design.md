# K8s Resource Manager 设计文档

## 概述

将现有的 K8s 资源调度系统从 Flux GitOps 模式改造为基于 Webhook 的实时调度系统，使用 TypeScript 类替代 Helm Chart 模板，实现类型安全、可测试、易维护的资源管理。

## 架构

```
┌─────────────────────────────────────────────────────────────────────┐
│                         Juanie Platform                              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  Webhook (GitHub/GitLab)     │     Registry Webhook (GHCR/GLCR)     │
│       │                      │              │                        │
│       ▼                      │              ▼                        │
│  ┌─────────┐    ┌─────────┐  │  ┌─────────────────────────────┐    │
│  │ Git     │    │ Image   │  │  │       API Routes            │    │
│  │ Event   │    │ Push    │  │  │  /api/projects/[id]/deploy  │    │
│  └────┬────┘    └────┬────┘  │  └──────────────┬──────────────┘    │
│       │              │        │                 │                   │
│       ▼              ▼        │                 ▼                   │
│  ┌─────────────────────────┐ │  ┌─────────────────────────────┐    │
│  │     BullMQ Queue        │ │  │   K8s Resource Manager      │    │
│  │  - deployment queue     │◄┼──│  - AppBuilder (资源生成)    │    │
│  │  - project-init queue   │ │  │  - AppDeployer (部署/更新)  │    │
│  └───────────┬─────────────┘ │  │  - AppDestroyer (清理)     │    │
│              │               │  └──────────────┬──────────────┘    │
│              ▼               │                 │                   │
│  ┌─────────────────────────┐ │                 ▼                   │
│  │    Worker Process       │ │  ┌─────────────────────────────┐    │
│  │  - 处理部署任务          │──┼─►│     Kubernetes Cluster      │    │
│  │  - 调用 K8s Manager      │ │  │  - Namespace per project    │    │
│  └─────────────────────────┘ │  │  - Deployment/Service/Route │    │
│                              │  │  - ConfigMap/Secret         │    │
│                              │  │  - StatefulSet (databases)  │    │
│                              │  └─────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────────┘
```

## 核心模块

### 文件结构

```
src/lib/k8s/
├── index.ts
├── client.ts           # K8s 客户端封装
├── types.ts            # AppSpec Zod schema
├── app-builder.ts      # 资源生成（纯函数，易测试）
├── app-deployer.ts     # 部署执行
├── app-destroyer.ts    # 资源清理
├── database.ts         # StatefulSet 生成（Postgres/Redis）
└── gateway.ts          # Cilium Gateway API 封装
```

### 1. types.ts - 类型定义

```typescript
import { z } from 'zod';

export const AppSpecSchema = z.object({
  name: z.string().regex(/^[a-z0-9-]+$/),
  namespace: z.string(),
  hostname: z.string().optional(),

  image: z.object({
    repository: z.string(),
    tag: z.string(),
    pullPolicy: z.enum(['Always', 'IfNotPresent', 'Never']).default('Always'),
  }),

  replicas: z.number().min(0).max(100).default(1),
  port: z.number().default(3000),

  resources: z.object({
    cpu: z.object({ request: z.string(), limit: z.string() }).optional(),
    memory: z.object({ request: z.string(), limit: z.string() }).optional(),
  }).optional(),

  env: z.record(z.string()).optional(),
  secretEnv: z.record(z.string()).optional(),

  healthcheck: z.object({
    path: z.string().default('/health'),
    initialDelaySeconds: z.number().default(10),
  }).optional(),
});

export type AppSpec = z.infer<typeof AppSpecSchema>;
```

### 2. app-builder.ts - 资源生成器

纯函数，输入 AppSpec，输出 K8s 资源对象。

```typescript
export interface AppResources {
  namespace?: V1Namespace;
  deployment: V1Deployment;
  service: V1Service;
  configMap?: V1ConfigMap;
  secret?: V1Secret;
  httpRoute?: V1CustomResourceDefinition;
}

export class AppBuilder {
  static build(spec: AppSpec): AppResources;
  private static buildNamespace(spec: AppSpec): V1Namespace;
  private static buildDeployment(spec: AppSpec): V1Deployment;
  private static buildService(spec: AppSpec): V1Service;
  private static buildConfigMap(spec: AppSpec): V1ConfigMap;
  private static buildSecret(spec: AppSpec): V1Secret;
  private static buildHTTPRoute(spec: AppSpec): V1CustomResourceDefinition;
}
```

### 3. app-deployer.ts - 部署执行器

```typescript
export class AppDeployer {
  // 完整部署（幂等）
  static async deploy(spec: AppSpec): Promise<{ success: boolean; resources: AppResources }>;

  // 仅更新镜像（快速部署）
  static async updateImage(namespace: string, name: string, image: string): Promise<void>;

  // 扩缩容
  static async scale(namespace: string, name: string, replicas: number): Promise<void>;
}
```

### 4. app-destroyer.ts - 资源清理

```typescript
export class AppDestroyer {
  static async destroy(namespace: string, name: string): Promise<void>;
}
```

## 触发流程

| 事件 | 触发方式 | 动作 |
|------|----------|------|
| **项目创建** | `project-init` queue | `AppDeployer.deploy(fullSpec)` |
| **代码推送** | Git Webhook → CI 构建 | CI 自行部署 |
| **镜像推送** | Registry Webhook | `AppDeployer.updateImage()` |
| **环境变量更新** | API `/env-vars` | `AppDeployer.deploy(updatedSpec)` |
| **扩缩容** | API `/settings` | `AppDeployer.scale()` |
| **项目删除** | API DELETE | `AppDestroyer.destroy()` |

## 迁移计划
1. 创建新的 `src/lib/k8s/` 模块
2. 将现有 `k8s.ts` 功能迁移到新模块
3. 更新 `project-init.ts` 使用新的 AppDeployer
4. 更新 API routes 使用新的模块
5. 删除不再使用的 Flux 相关代码
6. 清理 `deploy/flux/` 目录，只保留 charts 作为参考

## 关键陷阱与解决方案

### 陷阱一：孤儿资源与垃圾回收

**问题**：用户移除 `hostname` 后，旧的 HTTPRoute 会残留，导致路由冲突。

**解决方案**：Server-Side Apply (SSA) + 标签管理 + Prune

```typescript
// 统一标签
const commonLabels = {
  "juanie.dev/project-id": spec.projectId,
  "juanie.dev/app-name": spec.name,
  "juanie.dev/managed-by": "resource-manager"
};

// 部署流程
static async deploy(spec: AppSpec): Promise<void> {
  const resources = AppBuilder.build(spec);

  // 1. SSA Apply 新资源
  for (const resource of Object.values(resources).filter(Boolean)) {
    await this.applyResource(resource);
  }

  // 2. Prune 孤儿资源
  await this.pruneOrphans(spec.namespace, spec.name, resources);
}

// 清理孤儿
private static async pruneOrphans(namespace: string, appName: string, current: AppResources): Promise<void> {
  const client = K8sClient.getInstance();

  // 查询该应用的所有资源
  const allResources = await client.listResourcesByLabels(namespace, {
    "juanie.dev/app-name": appName,
    "juanie.dev/managed-by": "resource-manager"
  });

  // 删除不在当前清单中的资源
  for (const resource of allResources) {
    if (!this.isInCurrentSet(resource, current)) {
      await client.deleteResource(resource);
    }
  }
}
```

### 陷阱二：并发冲突

**问题**：Git Push、Registry Webhook、用户 UI 操作同时触发，导致互相覆盖。

**解决方案**：单一事实来源（数据库）+ 幂等全量部署

```typescript
// 所有操作只更新数据库，触发统一的部署队列
// ❌ 不要暴露 updateImage() 这种局部 Patch

// Registry Webhook Handler
async function handleRegistryWebhook(event: RegistryEvent) {
  // 只更新数据库
  await db.update(services).set({
    imageTag: event.tag
  }).where(eq(services.id, serviceId));

  // 触发统一队列
  await queue.add('deployment', { projectId, trigger: 'image-push' });
}

// Worker 永远只调用 deploy(db.getAppSpec())
async function processDeploymentJob(job: DeploymentJob) {
  const spec = await AppSpecBuilder.fromDatabase(job.projectId);
  await AppDeployer.deploy(spec);  // 幂等全量
}
```

### 陷阱三：状态漂移

**问题**：事件驱动没有自愈能力，kubectl edit 后无法恢复。

**解决方案**：漂移检测 Worker

```typescript
// src/lib/queue/drift-detector.ts
import { Cron } from 'croner';

export function startDriftDetector() {
  Cron('*/5 * * * *', async () => {
    const projects = await db.query.projects.findMany({
      where: eq(projects.status, 'active')
    });

    for (const project of projects) {
      const spec = await AppSpecBuilder.fromDatabase(project.id);
      const expected = AppBuilder.build(spec);

      const actual = await K8sClient.getResourceStatus(spec.namespace, spec.name);

      if (hasDrift(actual, expected)) {
        console.log(`[Drift] Detected drift for ${spec.name}, healing...`);
        await AppDeployer.deploy(spec);
      }
    }
  });
}

function hasDrift(actual: any, expected: AppResources): boolean {
  // 比较 replicas, image, env hash 等关键字段
  const actualHash = hashDeployment(actual.deployment);
  const expectedHash = hashDeployment(expected.deployment);
  return actualHash !== expectedHash;
}
```

## Server-Side Apply 实现

```typescript
// app-deployer.ts
import * as k8s from '@kubernetes/client-node';

export class AppDeployer {
  private static async applyResource(obj: any): Promise<void> {
    const client = K8sClient.getInstance();
    const api = client.getApplyApi();

    // 添加 last-applied-configuration 注解
    obj.metadata.annotations = obj.metadata.annotations || {};
    obj.metadata.annotations['juanie.dev/last-applied-configuration'] = JSON.stringify(obj);

    // Server-Side Apply
    await api.patch({
      body: obj,
      headers: { 'Content-Type': 'application/apply-patch+yaml' }
    });
  }
}
```

## 优势
- 类型安全（Zod + TypeScript）
- 可测试（纯函数 builder）
- 幂等操作（SSA apply）
- 自动垃圾回收（标签 + Prune）
- 并发安全（单一事实来源）
- 自愈能力（漂移检测）
- 代码集中（~400 行 vs 散落 ~500 行）
