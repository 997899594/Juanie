# K8s Resource Manager Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace Flux GitOps with TypeScript-based K8s resource management with drift detection and garbage collection.

**Architecture:** AppSpec (Zod) → AppBuilder (pure functions) → AppDeployer (SSA + Prune) → K8s API. Single source of truth from database, drift detection for self-healing.

**Tech Stack:** TypeScript, Zod, @kubernetes/client-node, BullMQ

---

## Task 1: Create Types and Zod Schemas

**Files:**
- Create: `src/lib/k8s/types.ts`

**Step 1: Create AppSpec schema**

```typescript
// src/lib/k8s/types.ts
import { z } from 'zod';

// ============================================
// AppSpec - 应用规格（单一事实来源）
// ============================================

export const ImageSpecSchema = z.object({
  repository: z.string(),
  tag: z.string(),
  pullPolicy: z.enum(['Always', 'IfNotPresent', 'Never']).default('Always'),
});

export const ResourcesSpecSchema = z.object({
  cpu: z.object({
    request: z.string().default('100m'),
    limit: z.string().default('500m'),
  }).optional(),
  memory: z.object({
    request: z.string().default('128Mi'),
    limit: z.string().default('512Mi'),
  }).optional(),
});

export const HealthCheckSchema = z.object({
  path: z.string().default('/health'),
  initialDelaySeconds: z.number().default(10),
  periodSeconds: z.number().default(10),
});

export const AppSpecSchema = z.object({
  // 基本信息
  projectId: z.string(),
  name: z.string().regex(/^[a-z0-9-]+$/),
  namespace: z.string(),

  // 镜像
  image: ImageSpecSchema,

  // 运行配置
  replicas: z.number().min(0).max(100).default(1),
  port: z.number().default(3000),

  // 域名（有则创建 HTTPRoute）
  hostname: z.string().optional(),

  // 资源限制
  resources: ResourcesSpecSchema.optional(),

  // 环境变量
  env: z.record(z.string()).optional(),
  secretEnv: z.record(z.string()).optional(),

  // 健康检查
  healthcheck: HealthCheckSchema.optional(),
});

export type AppSpec = z.infer<typeof AppSpecSchema>;
export type ImageSpec = z.infer<typeof ImageSpecSchema>;
export type ResourcesSpec = z.infer<typeof ResourcesSpecSchema>;
export type HealthCheck = z.infer<typeof HealthCheckSchema>;

// ============================================
// AppResources - 生成的 K8s 资源
// ============================================

export interface AppResources {
  deployment: any;  // V1Deployment
  service: any;     // V1Service
  configMap?: any;  // V1ConfigMap
  secret?: any;     // V1Secret
  httpRoute?: any;  // HTTPRoute CRD
}

// ============================================
// 统一标签
// ============================================

export const JUANIE_LABELS = {
  MANAGED_BY: 'juanie.dev/managed-by',
  PROJECT_ID: 'juanie.dev/project-id',
  APP_NAME: 'juanie.dev/app-name',
  APP_VERSION: 'juanie.dev/app-version',
} as const;

export function getJuanieLabels(spec: AppSpec): Record<string, string> {
  return {
    [JUANIE_LABELS.MANAGED_BY]: 'resource-manager',
    [JUANIE_LABELS.PROJECT_ID]: spec.projectId,
    [JUANIE_LABELS.APP_NAME]: spec.name,
  };
}
```

**Step 2: Verify types compile**

Run: `bun run build 2>&1 | head -20`
Expected: No errors (types only)

**Step 3: Commit**

```bash
git add src/lib/k8s/types.ts
git commit -m "feat(k8s): add AppSpec Zod schema and types

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Create AppBuilder (Pure Functions)

**Files:**
- Create: `src/lib/k8s/app-builder.ts`

**Step 1: Create AppBuilder class**

```typescript
// src/lib/k8s/app-builder.ts
import type { AppSpec, AppResources } from './types';
import { getJuanieLabels } from './types';

/**
 * AppBuilder - 纯函数资源生成器
 * 输入 AppSpec，输出 K8s 资源对象
 */
export class AppBuilder {
  /**
   * 构建所有 K8s 资源
   */
  static build(spec: AppSpec): AppResources {
    const labels = getJuanieLabels(spec);

    return {
      deployment: this.buildDeployment(spec, labels),
      service: this.buildService(spec, labels),
      configMap: this.buildConfigMap(spec, labels),
      secret: this.buildSecret(spec, labels),
      httpRoute: spec.hostname ? this.buildHTTPRoute(spec, labels) : undefined,
    };
  }

  /**
   * 生成 Deployment
   */
  private static buildDeployment(spec: AppSpec, labels: Record<string, string>): any {
    const envFrom: any[] = [];

    if (spec.env && Object.keys(spec.env).length > 0) {
      envFrom.push({ configMapRef: { name: `${spec.name}-config` } });
    }
    if (spec.secretEnv && Object.keys(spec.secretEnv).length > 0) {
      envFrom.push({ secretRef: { name: `${spec.name}-secret` } });
    }

    return {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: {
        name: `${spec.name}-web`,
        namespace: spec.namespace,
        labels: { ...labels, app: `${spec.name}-web` },
        annotations: {
          'juanie.dev/last-applied-spec': JSON.stringify(spec),
        },
      },
      spec: {
        replicas: spec.replicas,
        selector: {
          matchLabels: { app: `${spec.name}-web` },
        },
        template: {
          metadata: {
            labels: { app: `${spec.name}-web`, ...labels },
          },
          spec: {
            containers: [
              {
                name: 'web',
                image: `${spec.image.repository}:${spec.image.tag}`,
                imagePullPolicy: spec.image.pullPolicy,
                ports: [{ containerPort: spec.port, name: 'http', protocol: 'TCP' }],
                envFrom: envFrom.length > 0 ? envFrom : undefined,
                resources: spec.resources ? {
                  requests: {
                    cpu: spec.resources.cpu?.request,
                    memory: spec.resources.memory?.request,
                  },
                  limits: {
                    cpu: spec.resources.cpu?.limit,
                    memory: spec.resources.memory?.limit,
                  },
                } : undefined,
                livenessProbe: spec.healthcheck ? {
                  httpGet: { path: spec.healthcheck.path, port: 'http' },
                  initialDelaySeconds: spec.healthcheck.initialDelaySeconds,
                  periodSeconds: spec.healthcheck.periodSeconds,
                } : undefined,
                readinessProbe: spec.healthcheck ? {
                  httpGet: { path: spec.healthcheck.path, port: 'http' },
                  initialDelaySeconds: spec.healthcheck.initialDelaySeconds,
                  periodSeconds: spec.healthcheck.periodSeconds,
                } : undefined,
              },
            ],
          },
        },
      },
    };
  }

  /**
   * 生成 Service
   */
  private static buildService(spec: AppSpec, labels: Record<string, string>): any {
    return {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: {
        name: `${spec.name}-web`,
        namespace: spec.namespace,
        labels,
      },
      spec: {
        type: 'ClusterIP',
        selector: { app: `${spec.name}-web` },
        ports: [
          {
            name: 'http',
            port: 80,
            targetPort: 'http',
            protocol: 'TCP',
          },
        ],
      },
    };
  }

  /**
   * 生成 ConfigMap（仅当有非敏感环境变量时）
   */
  private static buildConfigMap(spec: AppSpec, labels: Record<string, string>): any | undefined {
    if (!spec.env || Object.keys(spec.env).length === 0) {
      return undefined;
    }

    return {
      apiVersion: 'v1',
      kind: 'ConfigMap',
      metadata: {
        name: `${spec.name}-config`,
        namespace: spec.namespace,
        labels,
      },
      data: spec.env,
    };
  }

  /**
   * 生成 Secret（仅当有敏感环境变量时）
   */
  private static buildSecret(spec: AppSpec, labels: Record<string, string>): any | undefined {
    if (!spec.secretEnv || Object.keys(spec.secretEnv).length === 0) {
      return undefined;
    }

    // Base64 encode secret values
    const data: Record<string, string> = {};
    for (const [key, value] of Object.entries(spec.secretEnv)) {
      data[key] = Buffer.from(value).toString('base64');
    }

    return {
      apiVersion: 'v1',
      kind: 'Secret',
      metadata: {
        name: `${spec.name}-secret`,
        namespace: spec.namespace,
        labels,
      },
      type: 'Opaque',
      data,
    };
  }

  /**
   * 生成 HTTPRoute（Cilium Gateway API）
   */
  private static buildHTTPRoute(spec: AppSpec, labels: Record<string, string>): any | undefined {
    if (!spec.hostname) {
      return undefined;
    }

    return {
      apiVersion: 'gateway.networking.k8s.io/v1',
      kind: 'HTTPRoute',
      metadata: {
        name: `${spec.name}-route`,
        namespace: spec.namespace,
        labels,
      },
      spec: {
        parentRefs: [
          {
            name: 'shared-gateway',
            namespace: 'juanie',
            sectionName: 'https',
          },
        ],
        hostnames: [spec.hostname],
        rules: [
          {
            matches: [
              {
                path: {
                  type: 'PathPrefix',
                  value: '/',
                },
              },
            ],
            backendRefs: [
              {
                name: `${spec.name}-web`,
                port: 80,
              },
            ],
          },
        ],
      },
    };
  }

  /**
   * 计算资源 Hash（用于漂移检测）
   */
  static hashResources(resources: AppResources): string {
    const crypto = require('crypto');
    const content = JSON.stringify({
      deployment: resources.deployment.spec,
      service: resources.service.spec,
      configMap: resources.configMap?.data,
      secret: resources.secret ? Object.keys(resources.secret.data || {}) : undefined,
      httpRoute: resources.httpRoute?.spec,
    });
    return crypto.createHash('sha256').update(content).digest('hex').slice(0, 16);
  }
}
```

**Step 2: Verify compiles**

Run: `bun run build 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/k8s/app-builder.ts
git commit -m "feat(k8s): add AppBuilder for resource generation

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Create AppDeployer (SSA + Prune)

**Files:**
- Create: `src/lib/k8s/app-deployer.ts`

**Step 1: Create AppDeployer class**

```typescript
// src/lib/k8s/app-deployer.ts
import * as k8s from '@kubernetes/client-node';
import { getK8sClient } from '@/lib/k8s';
import type { AppSpec, AppResources } from './types';
import { AppBuilder } from './app-builder';
import { JUANIE_LABELS } from './types';

/**
 * AppDeployer - 部署执行器
 * 使用 Server-Side Apply + Prune 实现幂等部署
 */
export class AppDeployer {
  /**
   * 部署应用（幂等操作）
   * 1. SSA Apply 新资源
   * 2. Prune 孤儿资源
   */
  static async deploy(spec: AppSpec): Promise<{ success: boolean; resources: AppResources }> {
    const resources = AppBuilder.build(spec);
    const client = getK8sClient();

    // 1. 确保 Namespace 存在
    await this.ensureNamespace(spec.namespace);

    // 2. Apply 所有资源
    await this.applyResource(resources.deployment);
    await this.applyResource(resources.service);
    if (resources.configMap) {
      await this.applyResource(resources.configMap);
    }
    if (resources.secret) {
      await this.applyResource(resources.secret);
    }
    if (resources.httpRoute) {
      await this.applyResource(resources.httpRoute);
    }

    // 3. Prune 孤儿资源
    await this.pruneOrphans(spec.namespace, spec.name, resources);

    return { success: true, resources };
  }

  /**
   * Server-Side Apply 资源
   */
  private static async applyResource(resource: any): Promise<void> {
    const { config, custom } = getK8sClient();
    const kind = resource.kind;
    const namespace = resource.metadata.namespace;
    const name = resource.metadata.name;

    // 添加 last-applied-configuration 注解
    resource.metadata.annotations = resource.metadata.annotations || {};
    resource.metadata.annotations['juanie.dev/last-applied-configuration'] = JSON.stringify(resource);

    try {
      if (kind === 'Deployment') {
        await this.applyDeployment(resource);
      } else if (kind === 'Service') {
        await this.applyService(resource);
      } else if (kind === 'ConfigMap') {
        await this.applyConfigMap(resource);
      } else if (kind === 'Secret') {
        await this.applySecret(resource);
      } else if (kind === 'HTTPRoute') {
        await this.applyHTTPRoute(resource);
      }
    } catch (error) {
      console.error(`[AppDeployer] Failed to apply ${kind}/${name}:`, error);
      throw error;
    }
  }

  private static async applyDeployment(resource: any): Promise<void> {
    const { apps } = getK8sClient();
    const namespace = resource.metadata.namespace;
    const name = resource.metadata.name;

    try {
      await apps.readNamespacedDeployment({ namespace, name });
      await apps.replaceNamespacedDeployment({ namespace, name, body: resource });
    } catch (e: any) {
      if (e.statusCode === 404) {
        await apps.createNamespacedDeployment({ namespace, body: resource });
      } else {
        throw e;
      }
    }
  }

  private static async applyService(resource: any): Promise<void> {
    const { core } = getK8sClient();
    const namespace = resource.metadata.namespace;
    const name = resource.metadata.name;

    try {
      await core.readNamespacedService({ namespace, name });
      await core.replaceNamespacedService({ namespace, name, body: resource });
    } catch (e: any) {
      if (e.statusCode === 404) {
        await core.createNamespacedService({ namespace, body: resource });
      } else {
        throw e;
      }
    }
  }

  private static async applyConfigMap(resource: any): Promise<void> {
    const { core } = getK8sClient();
    const namespace = resource.metadata.namespace;
    const name = resource.metadata.name;

    try {
      await core.readNamespacedConfigMap({ namespace, name });
      await core.replaceNamespacedConfigMap({ namespace, name, body: resource });
    } catch (e: any) {
      if (e.statusCode === 404) {
        await core.createNamespacedConfigMap({ namespace, body: resource });
      } else {
        throw e;
      }
    }
  }

  private static async applySecret(resource: any): Promise<void> {
    const { core } = getK8sClient();
    const namespace = resource.metadata.namespace;
    const name = resource.metadata.name;

    try {
      await core.readNamespacedSecret({ namespace, name });
      await core.replaceNamespacedSecret({ namespace, name, body: resource });
    } catch (e: any) {
      if (e.statusCode === 404) {
        await core.createNamespacedSecret({ namespace, body: resource });
      } else {
        throw e;
      }
    }
  }

  private static async applyHTTPRoute(resource: any): Promise<void> {
    const { custom } = getK8sClient();
    const namespace = resource.metadata.namespace;
    const name = resource.metadata.name;

    try {
      await custom.getNamespacedCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        namespace,
        plural: 'httproutes',
        name,
      });
      await custom.replaceNamespacedCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        namespace,
        plural: 'httproutes',
        name,
        body: resource,
      });
    } catch (e: any) {
      if (e.statusCode === 404) {
        await custom.createNamespacedCustomObject({
          group: 'gateway.networking.k8s.io',
          version: 'v1',
          namespace,
          plural: 'httproutes',
          body: resource,
        });
      } else {
        throw e;
      }
    }
  }

  /**
   * 清理孤儿资源
   * 删除带有 juanie.dev/app-name 标签但不在当前资源列表中的资源
   */
  private static async pruneOrphans(
    namespace: string,
    appName: string,
    currentResources: AppResources
  ): Promise<void> {
    const { core, apps, custom } = getK8sClient();

    // 当前资源名称集合
    const currentNames = {
      configMap: currentResources.configMap?.metadata?.name,
      secret: currentResources.secret?.metadata?.name,
      httpRoute: currentResources.httpRoute?.metadata?.name,
    };

    const labelSelector = `${JUANIE_LABELS.APP_NAME}=${appName},${JUANIE_LABELS.MANAGED_BY}=resource-manager`;

    // 检查 ConfigMap
    const configMaps = await core.listNamespacedConfigMap({ namespace, labelSelector });
    for (const cm of configMaps.items) {
      if (cm.metadata?.name !== currentNames.configMap) {
        console.log(`[AppDeployer] Pruning orphan ConfigMap: ${cm.metadata?.name}`);
        await core.deleteNamespacedConfigMap({ namespace, name: cm.metadata!.name! });
      }
    }

    // 检查 Secret
    const secrets = await core.listNamespacedSecret({ namespace, labelSelector });
    for (const s of secrets.items) {
      if (s.metadata?.name !== currentNames.secret) {
        console.log(`[AppDeployer] Pruning orphan Secret: ${s.metadata?.name}`);
        await core.deleteNamespacedSecret({ namespace, name: s.metadata!.name! });
      }
    }

    // 检查 HTTPRoute
    try {
      const routes = await custom.listNamespacedCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        namespace,
        plural: 'httproutes',
        labelSelector,
      }) as { items: any[] };
      for (const route of routes.items) {
        if (route.metadata?.name !== currentNames.httpRoute) {
          console.log(`[AppDeployer] Pruning orphan HTTPRoute: ${route.metadata?.name}`);
          await custom.deleteNamespacedCustomObject({
            group: 'gateway.networking.k8s.io',
            version: 'v1',
            namespace,
            plural: 'httproutes',
            name: route.metadata!.name!,
          });
        }
      }
    } catch (e) {
      // Ignore errors in prune
    }
  }

  /**
   * 确保 Namespace 存在
   */
  private static async ensureNamespace(name: string): Promise<void> {
    const { core } = getK8sClient();

    try {
      await core.readNamespace({ name });
    } catch (e: any) {
      if (e.statusCode === 404) {
        await core.createNamespace({
          body: {
            apiVersion: 'v1',
            kind: 'Namespace',
            metadata: { name },
          },
        });
      } else {
        throw e;
      }
    }
  }
}
```

**Step 2: Verify compiles**

Run: `bun run build 2>&1 | head -30`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/k8s/app-deployer.ts
git commit -m "feat(k8s): add AppDeployer with SSA and Prune

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Create AppDestroyer (Resource Cleanup)

**Files:**
- Create: `src/lib/k8s/app-destroyer.ts`

**Step 1: Create AppDestroyer class**

```typescript
// src/lib/k8s/app-destroyer.ts
import { getK8sClient } from '@/lib/k8s';
import { JUANIE_LABELS } from './types';

/**
 * AppDestroyer - 资源清理器
 * 删除应用的所有 K8s 资源
 */
export class AppDestroyer {
  /**
   * 销毁应用（删除所有相关资源）
   */
  static async destroy(namespace: string, appName: string): Promise<void> {
    const { core, apps, custom } = getK8sClient();

    const labelSelector = `${JUANIE_LABELS.APP_NAME}=${appName},${JUANIE_LABELS.MANAGED_BY}=resource-manager`;

    console.log(`[AppDestroyer] Destroying app ${appName} in ${namespace}`);

    // 1. 删除 HTTPRoute
    try {
      const routes = await custom.listNamespacedCustomObject({
        group: 'gateway.networking.k8s.io',
        version: 'v1',
        namespace,
        plural: 'httproutes',
        labelSelector,
      }) as { items: any[] };
      for (const route of routes.items) {
        await custom.deleteNamespacedCustomObject({
          group: 'gateway.networking.k8s.io',
          version: 'v1',
          namespace,
          plural: 'httproutes',
          name: route.metadata!.name!,
        });
        console.log(`[AppDestroyer] Deleted HTTPRoute: ${route.metadata?.name}`);
      }
    } catch (e) {
      // Ignore
    }

    // 2. 删除 Service
    try {
      const services = await core.listNamespacedService({ namespace, labelSelector });
      for (const svc of services.items) {
        await core.deleteNamespacedService({ namespace, name: svc.metadata!.name! });
        console.log(`[AppDestroyer] Deleted Service: ${svc.metadata?.name}`);
      }
    } catch (e) {
      // Ignore
    }

    // 3. 删除 Deployment
    try {
      const deployments = await apps.listNamespacedDeployment({ namespace, labelSelector });
      for (const dep of deployments.items) {
        await apps.deleteNamespacedDeployment({ namespace, name: dep.metadata!.name! });
        console.log(`[AppDestroyer] Deleted Deployment: ${dep.metadata?.name}`);
      }
    } catch (e) {
      // Ignore
    }

    // 4. 删除 ConfigMap
    try {
      const configMaps = await core.listNamespacedConfigMap({ namespace, labelSelector });
      for (const cm of configMaps.items) {
        await core.deleteNamespacedConfigMap({ namespace, name: cm.metadata!.name! });
        console.log(`[AppDestroyer] Deleted ConfigMap: ${cm.metadata?.name}`);
      }
    } catch (e) {
      // Ignore
    }

    // 5. 删除 Secret
    try {
      const secrets = await core.listNamespacedSecret({ namespace, labelSelector });
      for (const s of secrets.items) {
        await core.deleteNamespacedSecret({ namespace, name: s.metadata!.name! });
        console.log(`[AppDestroyer] Deleted Secret: ${s.metadata?.name}`);
      }
    } catch (e) {
      // Ignore
    }

    console.log(`[AppDestroyer] App ${appName} destroyed`);
  }

  /**
   * 销毁整个 Namespace
   */
  static async destroyNamespace(name: string): Promise<void> {
    const { core } = getK8sClient();

    try {
      await core.deleteNamespace({ name });
      console.log(`[AppDestroyer] Deleted Namespace: ${name}`);
    } catch (e: any) {
      if (e.statusCode !== 404) {
        throw e;
      }
    }
  }
}
```

**Step 2: Verify compiles**

Run: `bun run build 2>&1 | head -20`
Expected: No errors

**Step 3: Commit**

```bash
git add src/lib/k8s/app-destroyer.ts
git commit -m "feat(k8s): add AppDestroyer for resource cleanup

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Create Drift Detector Worker

**Files:**
- Create: `src/lib/queue/drift-detector.ts`

**Step 1: Create drift detector**

```typescript
// src/lib/queue/drift-detector.ts
import { Cron } from 'croner';
import { db } from '@/lib/db';
import { projects, services } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getK8sClient } from '@/lib/k8s';
import { AppBuilder } from '@/lib/k8s/app-builder';
import { AppDeployer } from '@/lib/k8s/app-deployer';
import type { AppSpec } from '@/lib/k8s/types';

let driftDetectorRunning = false;

/**
 * 启动漂移检测 Worker
 * 每 5 分钟检查一次，发现漂移自动修复
 */
export function startDriftDetector(): void {
  if (driftDetectorRunning) {
    console.log('[DriftDetector] Already running');
    return;
  }

  driftDetectorRunning = true;

  // 每 5 分钟执行一次
  Cron('*/5 * * * *', async () => {
    console.log('[DriftDetector] Starting drift detection...');
    await detectAndHeal();
  });

  console.log('[DriftDetector] Started (runs every 5 minutes)');
}

/**
 * 检测并修复漂移
 */
async function detectAndHeal(): Promise<void> {
  try {
    // 获取所有活跃项目
    const activeProjects = await db.query.projects.findMany({
      where: eq(projects.status, 'active'),
      with: {
        services: true,
        environments: true,
      },
    });

    for (const project of activeProjects) {
      try {
        await checkProjectDrift(project);
      } catch (error) {
        console.error(`[DriftDetector] Error checking project ${project.name}:`, error);
      }
    }
  } catch (error) {
    console.error('[DriftDetector] Error:', error);
  }
}

async function checkProjectDrift(project: any): Promise<void> {
  const namespace = `juanie-${project.slug}`;

  for (const service of project.services || []) {
    const spec = await buildAppSpec(project, service);
    if (!spec) continue;

    const expected = AppBuilder.build(spec);
    const actual = await getActualResources(namespace, spec.name);

    if (hasDrift(expected, actual)) {
      console.log(`[DriftDetector] Drift detected for ${spec.name}, healing...`);
      await AppDeployer.deploy(spec);
      console.log(`[DriftDetector] Healed ${spec.name}`);
    }
  }
}

function hasDrift(expected: any, actual: any): boolean {
  if (!actual.deployment) return true;

  // 检查 replicas
  const expectedReplicas = expected.deployment.spec?.replicas;
  const actualReplicas = actual.deployment?.spec?.replicas;
  if (expectedReplicas !== actualReplicas) {
    console.log(`[DriftDetector] Replicas drift: expected ${expectedReplicas}, actual ${actualReplicas}`);
    return true;
  }

  // 检查 image
  const expectedImage = expected.deployment.spec?.template?.spec?.containers?.[0]?.image;
  const actualImage = actual.deployment?.spec?.template?.spec?.containers?.[0]?.image;
  if (expectedImage !== actualImage) {
    console.log(`[DriftDetector] Image drift: expected ${expectedImage}, actual ${actualImage}`);
    return true;
  }

  return false;
}

async function getActualResources(namespace: string, appName: string): Promise<any> {
  const { apps, core, custom } = getK8sClient();

  try {
    const deployment = await apps.readNamespacedDeployment({
      namespace,
      name: `${appName}-web`,
    });
    return { deployment };
  } catch (e: any) {
    if (e.statusCode === 404) {
      return {};
    }
    throw e;
  }
}

async function buildAppSpec(project: any, service: any): Promise<AppSpec | null> {
  const namespace = `juanie-${project.slug}`;

  return {
    projectId: project.id,
    name: service.slug || service.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    namespace,
    image: {
      repository: service.imageRepository || `ghcr.io/${project.repository?.fullName || ''}`,
      tag: service.imageTag || 'latest',
      pullPolicy: 'Always',
    },
    replicas: service.replicas || 1,
    port: service.port || 3000,
    hostname: service.hostname || undefined,
    resources: service.resources || undefined,
    healthcheck: service.healthcheckPath ? {
      path: service.healthcheckPath,
      initialDelaySeconds: 10,
      periodSeconds: 10,
    } : undefined,
  };
}
```

**Step 2: Install croner dependency**

Run: `bun add croner`

**Step 3: Update worker to start drift detector**

Modify: `src/lib/queue/worker.ts` (add at the end of initialization)

```typescript
// 在 worker 初始化后添加
import { startDriftDetector } from './drift-detector';

// 启动漂移检测
if (process.env.ENABLE_DRIFT_DETECTOR !== 'false') {
  startDriftDetector();
}
```

**Step 4: Verify compiles**

Run: `bun run build 2>&1 | head -30`
Expected: No errors

**Step 5: Commit**

```bash
git add src/lib/queue/drift-detector.ts src/lib/queue/worker.ts package.json bun.lock
git commit -m "feat: add drift detector worker for self-healing

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Create Index File and Migrate Existing Code

**Files:**
- Create: `src/lib/k8s/index.ts`
- Modify: `src/lib/k8s.ts` (re-export from new module)

**Step 1: Create index file**

```typescript
// src/lib/k8s/index.ts
// Re-export existing functions
export * from '../k8s';

// Export new modules
export * from './types';
export { AppBuilder } from './app-builder';
export { AppDeployer } from './app-deployer';
export { AppDestroyer } from './app-destroyer';
```

**Step 2: Commit**

```bash
git add src/lib/k8s/index.ts
git commit -m "feat(k8s): add index file for k8s module

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Update project-init.ts to Use New AppDeployer

**Files:**
- Modify: `src/lib/queue/project-init.ts`

**Step 1: Import new modules**

Add at top of file:
```typescript
import { AppDeployer, AppDestroyer, type AppSpec } from '@/lib/k8s';
```

**Step 2: Update deployServices function**

Replace the existing `deployServices` function with:

```typescript
async function deployServices(project: typeof projects.$inferSelect, hasK8s: boolean) {
  const serviceList = await db.query.services.findMany({
    where: eq(services.projectId, project.id),
  });

  const namespace = `juanie-${project.slug}`;

  if (!hasK8s) {
    console.log('⚠️  Skipping service deployment (no K8s cluster)');
    return;
  }

  for (const service of serviceList) {
    const spec: AppSpec = {
      projectId: project.id,
      name: service.slug,
      namespace,
      image: {
        repository: service.imageRepository || '',
        tag: service.imageTag || 'latest',
        pullPolicy: 'Always',
      },
      replicas: service.replicas || 1,
      port: service.port || 3000,
      hostname: undefined, // Will be set in configure_dns step
      resources: {
        cpu: {
          request: service.cpuRequest || '100m',
          limit: service.cpuLimit || '500m',
        },
        memory: {
          request: service.memoryRequest || '128Mi',
          limit: service.memoryLimit || '512Mi',
        },
      },
    };

    console.log(`[deployServices] Deploying ${service.name}...`);
    await AppDeployer.deploy(spec);
    console.log(`[deployServices] Deployed ${service.name}`);
  }
}
```

**Step 3: Commit**

```bash
git add src/lib/queue/project-init.ts
git commit -m "refactor: use AppDeployer in project-init

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Clean Up Unused Flux Code

**Files:**
- Delete: `src/lib/flux.ts`
- Delete: `deploy/k8s/clusters/` (already deleted)
- Keep: `deploy/k8s/charts/` as reference

**Step 1: Remove flux.ts**

```bash
rm -f src/lib/flux.ts
```

**Step 2: Verify build still works**

Run: `bun run build`
Expected: Success

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove unused flux.ts

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Add Tests for AppBuilder

**Files:**
- Create: `src/lib/k8s/__tests__/app-builder.test.ts`

**Step 1: Create test file**

```typescript
// src/lib/k8s/__tests__/app-builder.test.ts
import { describe, it, expect } from 'bun:test';
import { AppBuilder } from '../app-builder';
import type { AppSpec } from '../types';

describe('AppBuilder', () => {
  const baseSpec: AppSpec = {
    projectId: 'test-project-id',
    name: 'my-app',
    namespace: 'juanie-my-app',
    image: {
      repository: 'ghcr.io/test/app',
      tag: 'v1.0.0',
      pullPolicy: 'Always',
    },
    replicas: 2,
    port: 3000,
  };

  it('should build deployment with correct name', () => {
    const resources = AppBuilder.build(baseSpec);
    expect(resources.deployment.metadata.name).toBe('my-app-web');
  });

  it('should build deployment with correct replicas', () => {
    const resources = AppBuilder.build(baseSpec);
    expect(resources.deployment.spec.replicas).toBe(2);
  });

  it('should build deployment with correct image', () => {
    const resources = AppBuilder.build(baseSpec);
    const image = resources.deployment.spec.template.spec.containers[0].image;
    expect(image).toBe('ghcr.io/test/app:v1.0.0');
  });

  it('should build service with correct name', () => {
    const resources = AppBuilder.build(baseSpec);
    expect(resources.service.metadata.name).toBe('my-app-web');
  });

  it('should not build configMap when no env', () => {
    const resources = AppBuilder.build(baseSpec);
    expect(resources.configMap).toBeUndefined();
  });

  it('should build configMap when env provided', () => {
    const spec: AppSpec = {
      ...baseSpec,
      env: { NODE_ENV: 'production', API_URL: 'https://api.example.com' },
    };
    const resources = AppBuilder.build(spec);
    expect(resources.configMap).toBeDefined();
    expect(resources.configMap.data.NODE_ENV).toBe('production');
  });

  it('should not build httpRoute when no hostname', () => {
    const resources = AppBuilder.build(baseSpec);
    expect(resources.httpRoute).toBeUndefined();
  });

  it('should build httpRoute when hostname provided', () => {
    const spec: AppSpec = {
      ...baseSpec,
      hostname: 'my-app.juanie.art',
    };
    const resources = AppBuilder.build(spec);
    expect(resources.httpRoute).toBeDefined();
    expect(resources.httpRoute.spec.hostnames).toContain('my-app.juanie.art');
  });

  it('should add juanie labels to all resources', () => {
    const resources = AppBuilder.build(baseSpec);

    expect(resources.deployment.metadata.labels['juanie.dev/managed-by']).toBe('resource-manager');
    expect(resources.deployment.metadata.labels['juanie.dev/project-id']).toBe('test-project-id');
    expect(resources.deployment.metadata.labels['juanie.dev/app-name']).toBe('my-app');

    expect(resources.service.metadata.labels['juanie.dev/managed-by']).toBe('resource-manager');
  });
});
```

**Step 2: Run tests**

Run: `bun test src/lib/k8s/__tests__/app-builder.test.ts`
Expected: All tests pass

**Step 3: Commit**

```bash
git add src/lib/k8s/__tests__/app-builder.test.ts
git commit -m "test(k8s): add AppBuilder unit tests

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Summary

After completing all tasks:
1. ✅ AppSpec types with Zod validation
2. ✅ AppBuilder for pure resource generation
3. ✅ AppDeployer with SSA + Prune
4. ✅ AppDestroyer for cleanup
5. ✅ Drift detector for self-healing
6. ✅ Updated project-init to use new modules
7. ✅ Removed unused Flux code
8. ✅ Unit tests for AppBuilder
