import type { JuanieConfig, ServiceConfig } from '@/lib/config/parser';
import {
  createTurborepoWorkspaceGraph,
  getTurborepoAppDir,
  getTurborepoPackageName,
} from '@/lib/monorepo';

export type BuildArtifactKind = 'image' | 'package' | 'static' | 'function';
export type BuildStrategy = 'dockerfile' | 'bake' | 'buildpacks' | 'custom' | 'external';
export type BuildGroupMode = 'bake_group' | 'service_matrix' | 'affected_matrix' | 'external';

export interface BuildArtifactOutput {
  kind: BuildArtifactKind;
  name: string;
  service: string;
  image: string;
}

export interface BuildUnit {
  id: string;
  service: string;
  kind: BuildArtifactKind;
  strategy: BuildStrategy;
  context: string;
  dockerfile: string | null;
  bakeTarget: string | null;
  bakeDefinition: string | null;
  workspace?: {
    type: 'turborepo';
    appDir: string;
    packageName: string;
    task: string;
  };
  outputs: BuildArtifactOutput[];
}

export interface BuildGroup {
  id: string;
  mode: BuildGroupMode;
  units: string[];
  sharedCacheKey: string | null;
  buildDefinition: string | null;
}

export interface BuildPlan {
  source: {
    repository: string;
    ref: string;
    sha: string;
  };
  units: BuildUnit[];
  groups: BuildGroup[];
  release: {
    mode: 'aggregate';
    requiredUnits: string[];
  };
}

function normalizeBuildStrategy(
  strategy: ServiceConfig['build'] extends infer T
    ? T extends { strategy?: infer S }
      ? S
      : never
    : never
): BuildStrategy {
  if (strategy === 'bake' || strategy === 'dockerfile' || strategy === 'buildpacks') {
    return strategy;
  }

  return 'buildpacks';
}

function sanitizeUnitId(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildImageTag(input: {
  imageRepository: string;
  service: string;
  sha: string;
  multiImage: boolean;
}): string {
  const base = `${input.imageRepository}:sha-${input.sha}`;

  if (!input.multiImage) {
    return base;
  }

  return `${base}-${sanitizeUnitId(input.service)}`;
}

function getBuildContext(service: ServiceConfig): string {
  return service.build?.context?.trim() || service.monorepo?.appDir || '.';
}

function getDockerfile(service: ServiceConfig, strategy: BuildStrategy): string | null {
  if (service.build?.dockerfile?.trim()) {
    return service.build.dockerfile.trim();
  }

  if (strategy !== 'dockerfile') {
    return null;
  }

  return service.monorepo?.appDir ? `${service.monorepo.appDir}/Dockerfile` : 'Dockerfile';
}

function getBuildDefinition(service: ServiceConfig): string | null {
  return service.build?.definition?.trim() || null;
}

function getBakeTarget(service: ServiceConfig): string | null {
  return service.build?.target?.trim() || null;
}

function buildUnit(input: {
  service: ServiceConfig;
  imageRepository: string;
  sha: string;
  multiImage: boolean;
  workspace?: BuildUnit['workspace'];
}): BuildUnit {
  const strategy = normalizeBuildStrategy(input.service.build?.strategy ?? 'auto');
  const serviceName = input.service.name;

  return {
    id: sanitizeUnitId(serviceName),
    service: serviceName,
    kind: 'image',
    strategy,
    context: getBuildContext(input.service),
    dockerfile: getDockerfile(input.service, strategy),
    bakeTarget: getBakeTarget(input.service),
    bakeDefinition: getBuildDefinition(input.service),
    ...(input.workspace ? { workspace: input.workspace } : {}),
    outputs: [
      {
        kind: 'image',
        name: serviceName,
        service: serviceName,
        image: buildImageTag({
          imageRepository: input.imageRepository,
          service: serviceName,
          sha: input.sha,
          multiImage: input.multiImage,
        }),
      },
    ],
  };
}

function getBakedGroupKey(unit: BuildUnit): string | null {
  if (unit.strategy !== 'bake' || !unit.bakeDefinition) {
    return null;
  }

  return [unit.strategy, unit.context, unit.bakeDefinition].join(':');
}

function buildGroups(units: BuildUnit[], monorepo: boolean): BuildGroup[] {
  const groupedBakeUnits = new Map<string, BuildUnit[]>();
  const ungroupedUnits: BuildUnit[] = [];

  for (const unit of units) {
    const key = getBakedGroupKey(unit);

    if (!key) {
      ungroupedUnits.push(unit);
      continue;
    }

    groupedBakeUnits.set(key, [...(groupedBakeUnits.get(key) ?? []), unit]);
  }

  const groups: BuildGroup[] = [];
  for (const [key, groupUnits] of groupedBakeUnits) {
    const buildDefinition = groupUnits[0]?.bakeDefinition ?? null;
    groups.push({
      id: `bake-${sanitizeUnitId(buildDefinition ?? key)}`,
      mode: 'bake_group',
      units: groupUnits.map((unit) => unit.id),
      sharedCacheKey: key,
      buildDefinition,
    });
  }

  if (ungroupedUnits.length > 0) {
    for (const unit of ungroupedUnits) {
      groups.push({
        id: `${monorepo ? 'affected' : 'service'}-${unit.id}`,
        mode: monorepo ? 'affected_matrix' : 'service_matrix',
        units: [unit.id],
        sharedCacheKey: null,
        buildDefinition: null,
      });
    }
  }

  return groups;
}

export function createBuildPlan(input: {
  config: Pick<JuanieConfig, 'services' | 'monorepo'>;
  repository: string;
  ref: string;
  sha: string;
  registry?: string;
  selectedServices?: string[];
}): BuildPlan {
  const registry = input.registry ?? 'ghcr.io';
  const imageRepository = `${registry.replace(/\/$/, '')}/${input.repository}`;
  const allServices = input.config.services;
  const selectedServiceNames = new Set(input.selectedServices ?? []);
  const knownServiceNames = new Set(allServices.map((service) => service.name));
  const unknownServiceNames = [...selectedServiceNames].filter(
    (name) => !knownServiceNames.has(name)
  );

  if (unknownServiceNames.length > 0) {
    throw new Error(`Build plan references unknown services: ${unknownServiceNames.join(', ')}`);
  }

  const services =
    selectedServiceNames.size > 0
      ? allServices.filter((service) => selectedServiceNames.has(service.name))
      : allServices;

  if (services.length === 0) {
    throw new Error('Build plan has no selected services');
  }

  const targetNames = allServices
    .map((service) => service.build?.target?.trim())
    .filter((value): value is string => Boolean(value));
  const multiImage = new Set(targetNames).size > 1 || allServices.length > 1;
  const workspaceGraph = createTurborepoWorkspaceGraph(input.config);
  const workspaceByService = new Map(
    workspaceGraph?.services.map((service) => [service.serviceName, service]) ?? []
  );
  const units = services.map((service) =>
    buildUnit({
      service,
      imageRepository,
      sha: input.sha,
      multiImage,
      workspace: workspaceGraph
        ? {
            type: 'turborepo',
            appDir: workspaceByService.get(service.name)?.appDir ?? getTurborepoAppDir(service),
            packageName:
              workspaceByService.get(service.name)?.packageName ?? getTurborepoPackageName(service),
            task: workspaceByService.get(service.name)?.task ?? workspaceGraph.affected.task,
          }
        : undefined,
    })
  );

  return {
    source: {
      repository: input.repository,
      ref: input.ref,
      sha: input.sha,
    },
    units,
    groups: buildGroups(units, Boolean(input.config.monorepo)),
    release: {
      mode: 'aggregate',
      requiredUnits: units.map((unit) => unit.id),
    },
  };
}

export function getBuildPlanReleaseServices(
  plan: Pick<BuildPlan, 'units'>
): Array<{ name: string; image: string }> {
  return plan.units.flatMap((unit) =>
    unit.outputs
      .filter((output) => output.kind === 'image')
      .map((output) => ({
        name: output.service,
        image: output.image,
      }))
  );
}
