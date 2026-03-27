import type { ServiceConfig } from '@/lib/config/parser';
import type {
  EnvironmentDatabaseStrategy,
  EnvironmentDeploymentStrategy,
  ServiceType,
} from '@/lib/db/schema';

export type CreateRuntimeProfile = 'standard' | 'resilient' | 'performance';

export interface CreateTemplateOption {
  id: string;
  name: string;
  description: string;
}

export interface CreateOptionDescriptor<TValue extends string> {
  value: TValue;
  label: string;
  description: string;
}

export const createRuntimeProfiles: CreateOptionDescriptor<CreateRuntimeProfile>[] = [
  {
    value: 'standard',
    label: '标准',
    description: '默认单副本，适合大多数业务应用，资源更稳不容易 OOM。',
  },
  {
    value: 'resilient',
    label: '稳态',
    description: 'Web 服务双副本起步，适合需要更高可用性的正式业务。',
  },
  {
    value: 'performance',
    label: '性能',
    description: '更高内存和 CPU 上限，适合富文本、SSR、搜索与 AI 类应用。',
  },
];

export const createProductionDeploymentStrategies: CreateOptionDescriptor<EnvironmentDeploymentStrategy>[] =
  [
    {
      value: 'controlled',
      label: '受控放量',
      description: '推荐默认值，发布后由平台继续推进或确认放量。',
    },
    {
      value: 'rolling',
      label: '滚动发布',
      description: '最简单直接，适合内部工具或低风险服务。',
    },
    {
      value: 'canary',
      label: '金丝雀',
      description: '先给一小部分流量，观察后再逐步放大。',
    },
    {
      value: 'blue_green',
      label: '蓝绿切换',
      description: '保留新旧两套版本，确认后再整体切流。',
    },
  ];

export const createPreviewDatabaseStrategies: CreateOptionDescriptor<
  Extract<EnvironmentDatabaseStrategy, 'inherit' | 'isolated_clone'>
>[] = [
  {
    value: 'inherit',
    label: '继承基础数据库',
    description: '最快速，适合大多数预览环境，默认直接复用基础环境数据库。',
  },
  {
    value: 'isolated_clone',
    label: '独立预览库',
    description: '更安全，适合数据风险更高的项目，但准备时间和成本更高。',
  },
];

export const createTemplateCatalog: CreateTemplateOption[] = [
  {
    id: 'nextjs',
    name: 'Next.js',
    description: '当前已内置的官方模板，适合 Web 与控制台类应用。',
  },
];

interface RuntimeSizing {
  replicas: number;
  cpuRequest: string;
  cpuLimit: string;
  memoryRequest: string;
  memoryLimit: string;
}

function getRuntimeSizing(serviceType: ServiceType, profile: CreateRuntimeProfile): RuntimeSizing {
  if (profile === 'performance') {
    if (serviceType === 'web') {
      return {
        replicas: 2,
        cpuRequest: '250m',
        cpuLimit: '1',
        memoryRequest: '512Mi',
        memoryLimit: '1Gi',
      };
    }

    return {
      replicas: 1,
      cpuRequest: '150m',
      cpuLimit: '750m',
      memoryRequest: '256Mi',
      memoryLimit: '768Mi',
    };
  }

  if (profile === 'resilient') {
    if (serviceType === 'web') {
      return {
        replicas: 2,
        cpuRequest: '150m',
        cpuLimit: '750m',
        memoryRequest: '256Mi',
        memoryLimit: '768Mi',
      };
    }

    return {
      replicas: 1,
      cpuRequest: '100m',
      cpuLimit: '500m',
      memoryRequest: '256Mi',
      memoryLimit: '512Mi',
    };
  }

  return {
    replicas: 1,
    cpuRequest: '100m',
    cpuLimit: '500m',
    memoryRequest: serviceType === 'web' ? '256Mi' : '192Mi',
    memoryLimit: serviceType === 'web' ? '512Mi' : '384Mi',
  };
}

export type CreateServiceDraft = Pick<
  ServiceConfig,
  'name' | 'type' | 'build' | 'run' | 'healthcheck' | 'scaling' | 'resources'
> & {
  appDir?: string;
};

export function applyRuntimeProfileToService<T extends CreateServiceDraft>(
  service: T,
  profile: CreateRuntimeProfile
): T {
  const sizing = getRuntimeSizing(service.type, profile);
  const nextHealthcheck =
    service.type === 'web'
      ? {
          path: service.healthcheck?.path ?? '/api/health',
          interval: service.healthcheck?.interval ?? 30,
        }
      : service.healthcheck;

  return {
    ...service,
    healthcheck: nextHealthcheck,
    scaling: {
      min: sizing.replicas,
      ...(service.scaling?.max && service.scaling.max > sizing.replicas
        ? { max: service.scaling.max }
        : {}),
      ...(service.scaling?.cpu ? { cpu: service.scaling.cpu } : {}),
    },
    resources: {
      cpuRequest: sizing.cpuRequest,
      cpuLimit: sizing.cpuLimit,
      memoryRequest: sizing.memoryRequest,
      memoryLimit: sizing.memoryLimit,
    },
  };
}

export function applyRuntimeProfileToServices<T extends CreateServiceDraft>(
  services: T[],
  profile: CreateRuntimeProfile
): T[] {
  return services.map((service) => applyRuntimeProfileToService(service, profile));
}

export function buildTemplateServices(profile: CreateRuntimeProfile): CreateServiceDraft[] {
  return applyRuntimeProfileToServices(
    [
      {
        name: 'web',
        type: 'web',
        appDir: '.',
        build: {
          command: 'npm run build',
        },
        run: {
          command: 'npm start',
          port: 3000,
        },
      },
    ],
    profile
  );
}

export function getServiceRuntimeSummary(service: CreateServiceDraft): string {
  const replicas = service.scaling?.min ?? 1;
  const cpu = `${service.resources?.cpuRequest ?? '100m'} / ${service.resources?.cpuLimit ?? '500m'}`;
  const memory = `${service.resources?.memoryRequest ?? '256Mi'} / ${service.resources?.memoryLimit ?? '512Mi'}`;

  return `${replicas} 副本 · CPU ${cpu} · 内存 ${memory}`;
}
