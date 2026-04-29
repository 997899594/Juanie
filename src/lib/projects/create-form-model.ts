import { nanoid } from 'nanoid';
import type { ServiceConfig } from '@/lib/config/parser';
import type { DatabaseCapability } from '@/lib/databases/capabilities';
import type {
  PlatformDatabaseProvisionType,
  PlatformDatabaseType,
} from '@/lib/databases/platform-support';
import { getDefaultDatabaseProvisionType } from '@/lib/databases/platform-support';
import {
  applyRuntimeProfileToServices,
  buildTemplateServices,
  type CreateRuntimeProfile,
} from '@/lib/projects/create-defaults';

export interface AnalyzeServiceResponse {
  name: string;
  type: 'web' | 'worker' | 'cron';
  appDir?: string;
  startCommand?: string;
  port?: number;
  schedule?: string;
  build?: {
    command?: string;
    dockerfile?: string;
    context?: string;
  };
  run?: {
    command: string;
    port?: number;
  };
  healthcheck?: {
    path?: string;
    interval?: number;
  };
  scaling?: {
    min?: number;
    max?: number;
    cpu?: number;
  };
  resources?: {
    cpuRequest?: string;
    cpuLimit?: string;
    memoryRequest?: string;
    memoryLimit?: string;
  };
  isPublic?: boolean;
}

export interface ServiceWithId {
  _id: string;
  disabled?: boolean;
  name: string;
  type: 'web' | 'worker' | 'cron';
  appDir: string;
  schedule?: string;
  build?: {
    command?: string;
    dockerfile?: string;
    context?: string;
  };
  run: {
    command: string;
    port?: number;
  };
  healthcheck?: {
    path?: string;
    interval?: number;
  };
  scaling?: {
    min?: number;
    max?: number;
    cpu?: number;
  };
  resources?: {
    cpuRequest?: string;
    cpuLimit?: string;
    memoryRequest?: string;
    memoryLimit?: string;
  };
  isPublic?: boolean;
}

export interface DatabaseWithId {
  _id: string;
  name: string;
  type: PlatformDatabaseType;
  plan: 'starter' | 'standard' | 'premium';
  provisionType: PlatformDatabaseProvisionType;
  capabilities: DatabaseCapability[];
  externalUrl?: string;
}

export interface InitialVariableWithId {
  _id: string;
  key: string;
  value: string;
  isSecret: boolean;
}

export function withServiceIds(services: Omit<ServiceWithId, '_id'>[]): ServiceWithId[] {
  return services.map((service) => ({
    _id: nanoid(),
    ...service,
  }));
}

export function normalizeService(
  service: AnalyzeServiceResponse | Omit<ServiceWithId, '_id'>,
  runtimeProfile: CreateRuntimeProfile
): Omit<ServiceWithId, '_id'> {
  const run =
    service.run ??
    ('startCommand' in service
      ? {
          command: service.startCommand ?? 'npm start',
          port: service.port,
        }
      : {
          command: 'npm start',
        });

  const normalized = {
    name: service.name,
    type: service.type,
    appDir: service.appDir ?? '.',
    schedule: service.schedule,
    build:
      service.build ??
      (service.type === 'web'
        ? {
            command: 'npm run build',
          }
        : undefined),
    run,
    healthcheck: service.healthcheck,
    scaling: service.scaling,
    resources: service.resources,
    isPublic: service.isPublic ?? service.type === 'web',
  } satisfies Omit<ServiceWithId, '_id'>;

  return applyRuntimeProfileToServices([normalized], runtimeProfile)[0];
}

export function buildTemplateServiceDrafts(
  _templateId: string,
  runtimeProfile: CreateRuntimeProfile
): ServiceWithId[] {
  return withServiceIds(
    buildTemplateServices(runtimeProfile).map((service) => ({
      ...service,
      appDir: service.appDir ?? '.',
      isPublic: service.type === 'web',
    }))
  );
}

export function buildImportFallbackServices(runtimeProfile: CreateRuntimeProfile): ServiceWithId[] {
  return buildTemplateServiceDrafts('nextjs', runtimeProfile);
}

export function createDatabaseDraft(type: DatabaseWithId['type']): DatabaseWithId {
  return {
    _id: nanoid(),
    name: type === 'postgresql' ? 'primary' : type,
    type,
    plan: 'starter',
    provisionType: getDefaultDatabaseProvisionType(type),
    capabilities: [],
  };
}

export function createInitialVariableDraft(): InitialVariableWithId {
  return {
    _id: nanoid(),
    key: '',
    value: '',
    isSecret: true,
  };
}

export function normalizeVariableKey(key: string): string {
  return key.trim();
}

export function getInitialVariableError(
  variable: InitialVariableWithId,
  variables: InitialVariableWithId[]
): string | null {
  const key = normalizeVariableKey(variable.key);
  if (!key && !variable.value) {
    return null;
  }

  if (!key) {
    return '变量名不能为空';
  }

  if (!/^[A-Z0-9_]+$/i.test(key)) {
    return '变量名只能包含字母、数字和下划线';
  }

  if (!variable.value) {
    return '变量值不能为空';
  }

  const duplicates = variables.filter(
    (item) => normalizeVariableKey(item.key).toUpperCase() === key.toUpperCase()
  );
  if (duplicates.length > 1) {
    return '变量名重复';
  }

  return null;
}

export function isInitialVariableReady(
  variable: InitialVariableWithId,
  variables: InitialVariableWithId[]
): boolean {
  return (
    !getInitialVariableError(variable, variables) && Boolean(normalizeVariableKey(variable.key))
  );
}

export function toServicePayload(service: ServiceWithId): ServiceConfig {
  return {
    name: service.name,
    type: service.type,
    ...(service.appDir && service.appDir !== '.' ? { monorepo: { appDir: service.appDir } } : {}),
    ...(service.build ? { build: service.build } : {}),
    run: {
      command: service.run.command,
      ...(typeof service.run.port === 'number' ? { port: service.run.port } : {}),
    },
    ...(service.healthcheck ? { healthcheck: service.healthcheck } : {}),
    ...(service.scaling ? { scaling: service.scaling } : {}),
    ...(service.resources ? { resources: service.resources } : {}),
    ...(service.type === 'cron' && service.schedule ? { schedule: service.schedule } : {}),
    ...(typeof service.isPublic === 'boolean' ? { isPublic: service.isPublic } : {}),
  };
}
