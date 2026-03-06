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
  cpu: z
    .object({
      request: z.string().default('100m'),
      limit: z.string().default('500m'),
    })
    .optional(),
  memory: z
    .object({
      request: z.string().default('128Mi'),
      limit: z.string().default('512Mi'),
    })
    .optional(),
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
  deployment: any; // V1Deployment
  service: any; // V1Service
  configMap?: any; // V1ConfigMap
  secret?: any; // V1Secret
  httpRoute?: any; // HTTPRoute CRD
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
