import {
  type ManagedPackageManager,
  renderManagedBuildTargetDockerfile,
  renderManagedServiceDockerfile,
} from '@/lib/builds/managed-dockerfile';
import type {
  BuildTargetConfig,
  DeliverableConfig,
  JuanieConfig,
  ServiceConfig,
} from '@/lib/config/parser';
import {
  createTurborepoWorkspaceGraph,
  getTurborepoAppDir,
  getTurborepoPackageName,
} from '@/lib/monorepo';

export type BuildArtifactKind = 'image' | 'package' | 'static' | 'function';
export type BuildStrategy =
  | 'managed'
  | 'dockerfile'
  | 'bake'
  | 'buildpacks'
  | 'custom'
  | 'external';
export type BuildGroupMode = 'bake_group' | 'service_matrix' | 'affected_matrix' | 'external';

export interface BuildArtifactOutput {
  kind: BuildArtifactKind;
  name: string;
  service?: string;
  target?: string;
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
  generatedDockerfile: string | null;
  secrets: string[];
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
    configPath: 'juanie.yml';
    configDigest: string;
  };
  units: BuildUnit[];
  groups: BuildGroup[];
  deliverables: PlannedDeliverable[];
  release: {
    mode: 'aggregate';
    requiredUnits: string[];
  };
}

export interface BuildChangeSet {
  changedFiles: string[];
  affectedPackages?: string[];
  forceFullBuild?: boolean;
}

export interface PlannedDeliverable {
  name: string;
  type: DeliverableConfig['type'];
  appDir: string;
  packageName?: string;
  sourceTarget: string;
  variant: DeliverableConfig['variants'][number];
}

interface SelectedBuildScope {
  services: ServiceConfig[];
  targets: BuildTargetConfig[];
  deliverables: PlannedDeliverable[];
}

function normalizeBuildStrategy(
  strategy: ServiceConfig['build'] extends infer T
    ? T extends { strategy?: infer S }
      ? S
      : never
    : never
): BuildStrategy {
  if (
    strategy === 'managed' ||
    strategy === 'bake' ||
    strategy === 'dockerfile' ||
    strategy === 'buildpacks'
  ) {
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
  packageManager: ManagedPackageManager;
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
    generatedDockerfile:
      strategy === 'managed'
        ? renderManagedServiceDockerfile({
            packageManager: input.packageManager,
            appDir: input.service.monorepo?.appDir ?? '.',
            buildCommand: input.service.build?.command ?? `${input.packageManager} run build`,
            startCommand: input.service.run.command,
            port: input.service.run.port ?? 3000,
            runtimeLanguage: input.service.runtime?.language,
            secretNames: input.service.build?.secrets ?? [],
          })
        : null,
    secrets: input.service.build?.secrets ?? [],
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

function buildTargetUnit(input: {
  target: BuildTargetConfig;
  imageRepository: string;
  sha: string;
  multiImage: boolean;
  packageManager: ManagedPackageManager;
}): BuildUnit {
  const strategy = normalizeBuildStrategy(input.target.build.strategy ?? 'dockerfile');
  const targetName = input.target.name;

  return {
    id: `target-${sanitizeUnitId(targetName)}`,
    service: targetName,
    kind: input.target.kind === 'documentation' ? 'static' : 'package',
    strategy,
    context: input.target.build.context?.trim() || '.',
    dockerfile: input.target.build.dockerfile?.trim() || null,
    bakeTarget: input.target.build.target?.trim() || null,
    bakeDefinition: input.target.build.definition?.trim() || null,
    generatedDockerfile:
      strategy === 'managed'
        ? renderManagedBuildTargetDockerfile({
            packageManager: input.packageManager,
            buildCommand: input.target.build.command ?? `${input.packageManager} run build`,
            outputPath: input.target.output.path,
            secretNames: input.target.build.secrets ?? [],
          })
        : null,
    secrets: input.target.build.secrets ?? [],
    workspace: {
      type: 'turborepo',
      appDir: input.target.monorepo.appDir,
      packageName: input.target.monorepo.packageName ?? input.target.name,
      task: 'build',
    },
    outputs: [
      {
        kind: input.target.kind === 'documentation' ? 'static' : 'package',
        name: targetName,
        target: targetName,
        image: buildImageTag({
          imageRepository: input.imageRepository,
          service: `target-${targetName}`,
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

function isInsideAppDir(file: string, appDir: string): boolean {
  const normalized = appDir.replace(/^\.\//u, '').replace(/\/$/u, '');
  if (!normalized || normalized === '.') return true;
  return file === normalized || file.startsWith(`${normalized}/`);
}

function matchesInput(file: string, pattern: string): boolean {
  if (pattern.endsWith('/**')) return file.startsWith(pattern.slice(0, -2));
  if (pattern.endsWith('/*')) {
    const prefix = pattern.slice(0, -1);
    return file.startsWith(prefix) && !file.slice(prefix.length).includes('/');
  }
  if (pattern.endsWith('/')) return file.startsWith(pattern);
  return file === pattern;
}

function flattenDeliverables(config: Pick<JuanieConfig, 'buildTargets' | 'deliverables'>) {
  const targetByName = new Map((config.buildTargets ?? []).map((target) => [target.name, target]));

  return (config.deliverables ?? []).flatMap((deliverable) => {
    const target = targetByName.get(deliverable.source.target);
    return deliverable.variants.map((variant) => ({
      name: deliverable.name,
      type: deliverable.type,
      appDir: target?.monorepo.appDir ?? deliverable.monorepo?.appDir ?? '.',
      ...(target?.monorepo.packageName ? { packageName: target.monorepo.packageName } : {}),
      sourceTarget: deliverable.source.target,
      variant,
    }));
  });
}

export function selectBuildScope(
  config: Pick<JuanieConfig, 'services' | 'monorepo' | 'buildTargets' | 'deliverables'>,
  changes?: BuildChangeSet
): SelectedBuildScope {
  const services = config.services;
  const targets = config.buildTargets ?? [];
  const deliverables = flattenDeliverables(config);
  const affected = config.monorepo?.affected ?? {
    strategy: 'turbo' as const,
    task: 'build',
    useTaskInputs: false,
    global: [],
    inputs: [],
  };

  if (!config.monorepo || !changes || changes.forceFullBuild || affected.strategy === 'all') {
    return { services, targets, deliverables };
  }

  const allAppDirs = [
    ...services.map((service) => service.monorepo?.appDir ?? '.'),
    ...targets.map((target) => target.monorepo.appDir),
  ];
  const isWorkloadFile = (file: string) => allAppDirs.some((dir) => isInsideAppDir(file, dir));
  const isGlobalChange = changes.changedFiles.some(
    (file) =>
      file === 'juanie.yml' ||
      file.startsWith('.github/') ||
      file === '.gitlab-ci.yml' ||
      affected.global.some((pattern) => matchesInput(file, pattern)) ||
      (affected.inputs.some((pattern) => matchesInput(file, pattern)) && !isWorkloadFile(file))
  );

  if (isGlobalChange) {
    return { services, targets, deliverables };
  }

  const affectedPackages = new Set(changes.affectedPackages ?? []);
  const usePackageGraph = affected.strategy === 'turbo' && changes.affectedPackages !== undefined;
  const selectedServices = services.filter((service) =>
    usePackageGraph
      ? affectedPackages.has(service.monorepo?.packageName ?? service.name)
      : changes.changedFiles.some((file) => isInsideAppDir(file, service.monorepo?.appDir ?? '.'))
  );
  const selectedTargets = targets.filter((target) =>
    usePackageGraph
      ? affectedPackages.has(target.monorepo.packageName ?? target.name)
      : changes.changedFiles.some((file) => isInsideAppDir(file, target.monorepo.appDir))
  );
  const targetNames = new Set(selectedTargets.map((target) => target.name));
  const selectedDeliverables = deliverables.filter(
    (deliverable) =>
      targetNames.has(deliverable.sourceTarget) ||
      changes.changedFiles.some((file) => isInsideAppDir(file, deliverable.appDir))
  );

  return {
    services: selectedServices,
    targets: selectedTargets,
    deliverables: selectedDeliverables,
  };
}

export function createBuildPlan(input: {
  config: Pick<JuanieConfig, 'services' | 'monorepo' | 'buildTargets' | 'deliverables'>;
  repository: string;
  ref: string;
  sha: string;
  configPath: 'juanie.yml';
  configDigest: string;
  registry?: string;
  changes?: BuildChangeSet;
}): BuildPlan {
  const registry = input.registry ?? 'ghcr.io';
  const imageRepository = `${registry.replace(/\/$/, '')}/${input.repository}`;
  const allServices = input.config.services;
  const allTargets = input.config.buildTargets ?? [];
  const { services, targets, deliverables } = selectBuildScope(input.config, input.changes);

  const targetNames = allServices
    .map((service) => service.build?.target?.trim())
    .filter((value): value is string => Boolean(value));
  const multiImage = new Set(targetNames).size > 1 || allServices.length + allTargets.length > 1;
  const workspaceGraph = createTurborepoWorkspaceGraph(input.config);
  const packageManager = input.config.monorepo?.packageManager ?? 'npm';
  const workspaceByService = new Map(
    workspaceGraph?.services.map((service) => [service.serviceName, service]) ?? []
  );
  const serviceUnits = services.map((service) =>
    buildUnit({
      service,
      imageRepository,
      sha: input.sha,
      multiImage,
      packageManager,
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
  const targetUnits = targets.map((target) =>
    buildTargetUnit({ target, imageRepository, sha: input.sha, multiImage, packageManager })
  );
  const units = [...serviceUnits, ...targetUnits];

  return {
    source: {
      repository: input.repository,
      ref: input.ref,
      sha: input.sha,
      configPath: input.configPath,
      configDigest: input.configDigest,
    },
    units,
    groups: buildGroups(units, Boolean(input.config.monorepo)),
    deliverables,
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
      .filter((output): output is BuildArtifactOutput & { service: string } =>
        Boolean(output.service)
      )
      .map((output) => ({
        name: output.service,
        image: output.image,
      }))
  );
}
