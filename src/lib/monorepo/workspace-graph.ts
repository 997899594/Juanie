import type { JuanieConfig, ServiceConfig } from '@/lib/config/parser';
import type { MonorepoType } from './detect';

export interface TurborepoWorkspaceService {
  serviceName: string;
  appDir: string;
  packageName: string;
  task: string;
}

export interface TurborepoAffectedPolicy {
  strategy: 'turbo' | 'all' | 'manual';
  task: string;
  useTaskInputs: boolean;
  global: string[];
  inputs: string[];
}

export interface TurborepoWorkspaceGraph {
  type: 'turborepo';
  packageManager?: 'bun' | 'pnpm' | 'yarn' | 'npm';
  affected: TurborepoAffectedPolicy;
  services: TurborepoWorkspaceService[];
}

export function getTurborepoPackageName(service: Pick<ServiceConfig, 'name' | 'monorepo'>): string {
  return service.monorepo?.packageName?.trim() || service.name;
}

export function getTurborepoAppDir(service: Pick<ServiceConfig, 'monorepo'>): string {
  return service.monorepo?.appDir?.trim() || '.';
}

export function getTurborepoAffectedPolicy(
  monorepo: NonNullable<JuanieConfig['monorepo']>
): TurborepoAffectedPolicy {
  return {
    strategy: monorepo.affected?.strategy ?? 'turbo',
    task: monorepo.affected?.task ?? 'build',
    useTaskInputs: monorepo.affected?.useTaskInputs ?? false,
    global: monorepo.affected?.global ?? [],
    inputs: monorepo.affected?.inputs ?? [],
  };
}

export function createTurborepoWorkspaceGraph(
  config: Pick<JuanieConfig, 'monorepo' | 'services'>
): TurborepoWorkspaceGraph | null {
  if (config.monorepo?.type !== 'turborepo') {
    return null;
  }

  return {
    type: 'turborepo',
    packageManager: config.monorepo.packageManager,
    affected: getTurborepoAffectedPolicy(config.monorepo),
    services: config.services.map((service) => ({
      serviceName: service.name,
      appDir: getTurborepoAppDir(service),
      packageName: getTurborepoPackageName(service),
      task: getTurborepoAffectedPolicy(config.monorepo as NonNullable<JuanieConfig['monorepo']>)
        .task,
    })),
  };
}

export function isTurborepoType(type: MonorepoType | undefined): type is 'turborepo' {
  return type === 'turborepo';
}
