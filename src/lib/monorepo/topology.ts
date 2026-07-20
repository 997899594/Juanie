import { parse } from 'yaml';
import { type JuanieConfig, parseJuanieConfig, type ServiceConfig } from '@/lib/config/parser';
import { inferDeliveryGraph } from '@/lib/delivery-graph/inference';
import {
  type DeliveryGraph,
  type DeliveryGraphPackage,
  type DeliveryGraphWorkspaceInput,
  deliveryGraphVersion,
} from '@/lib/delivery-graph/model';
import { detectMonorepoType, type MonorepoType } from './detect';

type ServiceType = 'web' | 'worker' | 'cron';
type BuildStrategy = 'auto' | 'managed' | 'dockerfile' | 'bake' | 'buildpacks';

type PackageJsonShape = DeliveryGraphPackage & {
  packageManager?: string;
  workspaces?: string[] | { packages?: string[] };
};

export interface RepositoryTopologyBuild {
  strategy?: BuildStrategy;
  command?: string;
  dockerfile?: string;
  context?: string;
  target?: string;
  definition?: string;
  secrets?: string[];
  package?: {
    strategy: 'turbo-prune' | 'pnpm-deploy';
  };
}

export interface RepositoryTopologyService {
  name: string;
  type: ServiceType;
  appDir: string;
  packageName?: string;
  startCommand: string;
  port: number;
  schedule?: string;
  build?: RepositoryTopologyBuild;
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
  runtime?: {
    language: 'node' | 'bun' | 'static' | 'custom';
    framework?: string;
    nodeVersion?: string;
  };
  isPublic?: boolean;
}

export interface RepositoryTopologyReader {
  listRootFiles(repoFullName: string, ref?: string): Promise<string[]>;
  getFileContent(repoFullName: string, path: string, ref?: string): Promise<string | null>;
  listDirectory(
    repoFullName: string,
    path: string,
    ref?: string
  ): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>>;
}

export interface RepositoryTopology {
  monorepoType: MonorepoType;
  rootFiles: string[];
  hasDockerBake: boolean;
  bakeTargets: string[];
  bakeDefinitionPath: string | null;
  rootPackageJson: PackageJsonShape | null;
  deliveryGraph: DeliveryGraph;
  services: RepositoryTopologyService[];
  configMonorepo?: JuanieConfig['monorepo'];
  configBuildTargets?: JuanieConfig['buildTargets'];
  configDeliverables?: JuanieConfig['deliverables'];
  managedConfigContent?: string | null;
  source: 'juanie_config' | 'turborepo_scan' | 'docker_bake' | 'package_json' | 'default';
}

function parsePackageJson(content: string | null): PackageJsonShape | null {
  if (!content) {
    return null;
  }

  try {
    return JSON.parse(content) as PackageJsonShape;
  } catch {
    return null;
  }
}

function parseEnvironmentKeys(content: string | null): string[] {
  if (!content) return [];
  const keys = new Set<string>();
  for (const line of content.split('\n')) {
    const match = line.trim().match(/^(?:export\s+)?([A-Z][A-Z0-9_]*)\s*=/u);
    if (match?.[1]) keys.add(match[1]);
  }
  return [...keys];
}

function detectPackageManager(
  rootFiles: string[],
  packageJson: PackageJsonShape | null
): 'bun' | 'pnpm' | 'yarn' | 'npm' {
  const packageManager = packageJson?.packageManager;

  if (typeof packageManager === 'string') {
    if (packageManager.startsWith('bun@')) return 'bun';
    if (packageManager.startsWith('pnpm@')) return 'pnpm';
    if (packageManager.startsWith('yarn@')) return 'yarn';
    if (packageManager.startsWith('npm@')) return 'npm';
  }

  if (rootFiles.includes('bun.lockb') || rootFiles.includes('bun.lock')) return 'bun';
  if (rootFiles.includes('pnpm-lock.yaml')) return 'pnpm';
  if (rootFiles.includes('yarn.lock')) return 'yarn';
  return 'npm';
}

function basename(path: string): string {
  const segments = path.split('/').filter(Boolean);
  return segments[segments.length - 1] ?? path;
}

function parseDockerBakeTargets(content: string): string[] {
  const targets: string[] = [];
  const targetRegex = /target\s+["']?([\w-]+)["']?\s*\{/g;
  let match: RegExpExecArray | null = targetRegex.exec(content);

  while (match !== null) {
    const targetName = match[1];
    if (targetName && !['default', 'multi'].includes(targetName)) {
      targets.push(targetName);
    }
    match = targetRegex.exec(content);
  }

  return [...new Set(targets)];
}

function parsePortFromCommand(command: string | undefined): number | undefined {
  if (!command) {
    return undefined;
  }

  const match =
    command.match(/(?:--port|-p)\s+(\d{2,5})/) ??
    command.match(/PORT=(\d{2,5})/) ??
    command.match(/:(\d{2,5})/);

  if (!match) {
    return undefined;
  }

  const parsed = Number.parseInt(match[1] ?? '', 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function pickScript(
  scripts: Record<string, string>,
  candidates: string[]
): { name: string; command: string } | null {
  for (const candidate of candidates) {
    const command = scripts[candidate]?.trim();
    if (command) {
      return { name: candidate, command };
    }
  }

  return null;
}

function inferServiceType(serviceName: string, packageJson: PackageJsonShape | null): ServiceType {
  const scripts = packageJson?.scripts ?? {};
  const dependencyNames = Object.keys({
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
  }).join(' ');
  const searchable = [
    serviceName,
    packageJson?.name ?? '',
    Object.keys(scripts).join(' '),
    Object.values(scripts).join(' '),
    dependencyNames,
  ]
    .join(' ')
    .toLowerCase();

  const hasWebSignal =
    /(next|react|vue|nuxt|astro|remix|express|fastify|hono|serve|http|vite)/.test(searchable) ||
    /(start|dev)/.test(Object.keys(scripts).join(' ').toLowerCase());
  const hasCronSignal = /(cron|scheduler|schedule|job)/.test(searchable);
  const hasWorkerSignal = /(worker|queue|consumer|processor|bullmq)/.test(searchable);

  if (hasCronSignal && !hasWebSignal) {
    return 'cron';
  }

  if (hasWorkerSignal && !hasWebSignal) {
    return 'worker';
  }

  return 'web';
}

function inferRunCommand(
  serviceType: ServiceType,
  packageJson: PackageJsonShape | null,
  packageManager: 'bun' | 'pnpm' | 'yarn' | 'npm'
): { command: string; port?: number; schedule?: string } {
  const scripts = packageJson?.scripts ?? {};

  const preferredScripts =
    serviceType === 'cron'
      ? ['cron', 'scheduler', 'schedule', 'job', 'start', 'dev']
      : serviceType === 'worker'
        ? ['worker', 'queue', 'consumer', 'processor', 'start', 'dev']
        : ['start', 'dev', 'serve'];

  const resolvedScript = pickScript(scripts, preferredScripts);
  if (resolvedScript) {
    return {
      command: resolvedScript.command,
      port: parsePortFromCommand(resolvedScript.command),
      schedule: packageJson?.juanie?.schedule ?? packageJson?.config?.schedule,
    };
  }

  return {
    command: packageManager === 'yarn' ? 'yarn start' : `${packageManager} run start`,
    schedule: packageJson?.juanie?.schedule ?? packageJson?.config?.schedule,
  };
}

function inferBuildMetadata(input: {
  appDir: string;
  packageJson: PackageJsonShape | null;
  hasDockerfile: boolean;
  bakeDefinitionPath: string | null;
  bakeTargets: string[];
  serviceName: string;
}): RepositoryTopologyBuild | undefined {
  const packageName = input.packageJson?.name?.trim();
  const packageSelector = packageName || input.serviceName;
  const buildCommand = packageName
    ? `turbo run build --filter=${packageName}`
    : (input.packageJson?.scripts?.build?.trim() ?? `turbo run build --filter=${packageSelector}`);

  if (input.bakeDefinitionPath) {
    const candidates = [input.serviceName, basename(input.appDir)];
    const matchedTarget = candidates.find((candidate) => input.bakeTargets.includes(candidate));

    return {
      strategy: 'bake',
      command: buildCommand,
      definition: input.bakeDefinitionPath,
      context: '.',
      ...(matchedTarget ? { target: matchedTarget } : {}),
      ...(input.hasDockerfile ? { dockerfile: `${input.appDir}/Dockerfile` } : {}),
    };
  }

  if (input.hasDockerfile) {
    return {
      strategy: 'dockerfile',
      command: buildCommand,
      dockerfile: `${input.appDir}/Dockerfile`,
      context: '.',
    };
  }

  return {
    command: buildCommand,
  };
}

function toTopologyServiceFromConfig(service: ServiceConfig): RepositoryTopologyService {
  return {
    name: service.name,
    type: service.type,
    appDir: service.monorepo?.appDir ?? '.',
    packageName: service.monorepo?.packageName,
    startCommand: service.run.command,
    port: service.run.port ?? 3000,
    schedule: service.schedule,
    build: service.build
      ? {
          strategy: service.build.strategy,
          command: service.build.command,
          dockerfile: service.build.dockerfile,
          context: service.build.context,
          target: service.build.target,
          definition: service.build.definition,
          package: service.build.package,
        }
      : undefined,
    run: {
      command: service.run.command,
      ...(typeof service.run.port === 'number' ? { port: service.run.port } : {}),
    },
    healthcheck: service.healthcheck,
    scaling: service.scaling,
    resources: service.resources,
    runtime: service.runtime,
    isPublic: service.isPublic,
  };
}

function buildDeclaredDeliveryGraph(
  serviceList: RepositoryTopologyService[],
  buildTargets: JuanieConfig['buildTargets'] = []
): DeliveryGraph {
  return {
    version: deliveryGraphVersion,
    workloads: serviceList.map((service) => ({
      id: `workload:${service.appDir}:${service.name}`,
      name: service.name,
      packageName: service.packageName,
      appDir: service.appDir,
      type: service.type,
      runtimeKind: service.runtime?.language === 'static' ? 'static' : 'server',
      runtimeCapabilities:
        service.type === 'worker' ? ['worker'] : service.type === 'cron' ? ['scheduler'] : ['http'],
      buildCommand: service.build?.command,
      startCommand: service.startCommand,
      port: service.run.port,
      schedule: service.schedule,
      hasDockerfile: Boolean(service.build?.dockerfile),
      confidence: 'declared',
    })),
    artifacts: (buildTargets ?? []).map((target) => ({
      id: `artifact:${target.name}`,
      name: target.name,
      packageName: target.monorepo.packageName,
      appDir: target.monorepo.appDir,
      kind: target.kind,
      buildCommand: target.build.command,
      outputPath: target.output.path,
    })),
    libraries: [],
    resources: [],
    warnings: [],
  };
}

async function safeGetFileContent(
  reader: RepositoryTopologyReader,
  repoFullName: string,
  path: string,
  ref?: string
): Promise<string | null> {
  try {
    return await reader.getFileContent(repoFullName, path, ref);
  } catch {
    return null;
  }
}

const workspaceDiscoveryLimits = {
  patterns: 64,
  directories: 500,
  depth: 12,
} as const;

function normalizeWorkspacePattern(pattern: string): string | null {
  const normalized = pattern.trim().replace(/^\.\//u, '').replace(/\/$/u, '');
  if (
    !normalized ||
    normalized.startsWith('/') ||
    normalized.split('/').some((segment) => segment === '..')
  ) {
    return null;
  }
  return normalized;
}

function parseWorkspacePatterns(
  rootPackageJson: PackageJsonShape | null,
  pnpmWorkspaceContent: string | null
): string[] {
  if (pnpmWorkspaceContent) {
    try {
      const document = parse(pnpmWorkspaceContent) as { packages?: unknown } | null;
      if (Array.isArray(document?.packages)) {
        return document.packages
          .filter((value): value is string => typeof value === 'string')
          .slice(0, workspaceDiscoveryLimits.patterns);
      }
      if (document?.packages !== undefined) {
        throw new Error('pnpm-workspace.yaml packages must be an array');
      }
    } catch (error) {
      throw new Error(
        `Invalid pnpm-workspace.yaml: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  const workspaces = rootPackageJson?.workspaces;
  const patterns = Array.isArray(workspaces) ? workspaces : workspaces?.packages;
  return (patterns ?? []).slice(0, workspaceDiscoveryLimits.patterns);
}

function matchesWorkspaceSegment(value: string, pattern: string): boolean {
  const expression = pattern
    .replace(/[.+^${}()|[\]\\]/gu, '\\$&')
    .replace(/\*/gu, '.*')
    .replace(/\?/gu, '.');
  return new RegExp(`^${expression}$`, 'u').test(value);
}

async function expandWorkspacePattern(input: {
  reader: RepositoryTopologyReader;
  repoFullName: string;
  ref?: string;
  pattern: string;
  budget: { directories: number; exhausted: boolean };
}): Promise<Set<string>> {
  const normalized = normalizeWorkspacePattern(input.pattern);
  if (!normalized) return new Set();
  const segments = normalized.split('/');
  const matches = new Set<string>();
  const visited = new Set<string>();

  async function visit(path: string, index: number): Promise<void> {
    const state = `${path}\0${index}`;
    if (
      visited.has(state) ||
      path.split('/').filter(Boolean).length > workspaceDiscoveryLimits.depth
    ) {
      return;
    }
    visited.add(state);

    if (index === segments.length) {
      if (path) matches.add(path);
      return;
    }

    const segment = segments[index];
    if (!segment) return;
    if (segment === '**') {
      await visit(path, index + 1);
      if (input.budget.directories >= workspaceDiscoveryLimits.directories) {
        input.budget.exhausted = true;
        return;
      }
      input.budget.directories += 1;
      const entries = await input.reader.listDirectory(input.repoFullName, path, input.ref);
      for (const entry of entries.filter((candidate) => candidate.type === 'dir')) {
        await visit(entry.path, index);
      }
      return;
    }

    if (!segment.includes('*') && !segment.includes('?')) {
      await visit(path ? `${path}/${segment}` : segment, index + 1);
      return;
    }

    if (input.budget.directories >= workspaceDiscoveryLimits.directories) {
      input.budget.exhausted = true;
      return;
    }
    input.budget.directories += 1;
    const entries = await input.reader.listDirectory(input.repoFullName, path, input.ref);
    for (const entry of entries) {
      if (entry.type === 'dir' && matchesWorkspaceSegment(entry.name, segment)) {
        await visit(entry.path, index + 1);
      }
    }
  }

  await visit('', 0);
  return matches;
}

async function discoverWorkspacePaths(input: {
  reader: RepositoryTopologyReader;
  repoFullName: string;
  ref?: string;
  patterns: string[];
}): Promise<string[]> {
  const declaredPatterns = input.patterns.length > 0 ? input.patterns : ['apps/*', 'packages/*'];
  const includes = declaredPatterns.filter((pattern) => !pattern.trim().startsWith('!'));
  const excludes = declaredPatterns
    .filter((pattern) => pattern.trim().startsWith('!'))
    .map((pattern) => pattern.trim().slice(1));
  const budget = { directories: 0, exhausted: false };
  const included = new Set<string>();
  const excluded = new Set<string>();

  for (const pattern of includes) {
    const matches = await expandWorkspacePattern({ ...input, pattern, budget });
    for (const path of matches) included.add(path);
  }
  for (const pattern of excludes) {
    const matches = await expandWorkspacePattern({ ...input, pattern, budget });
    for (const path of matches) excluded.add(path);
  }
  if (budget.exhausted) {
    throw new Error(
      `Workspace discovery exceeded the ${workspaceDiscoveryLimits.directories} directory limit`
    );
  }

  return [...included].filter((path) => !excluded.has(path));
}

function inferWorkspaceZone(path: string): DeliveryGraphWorkspaceInput['zone'] {
  const root = path.split('/')[0]?.toLowerCase();
  return root && ['packages', 'libs', 'libraries', 'shared', 'tooling'].includes(root)
    ? 'package'
    : 'app';
}

function toTopologyServiceFromWorkload(input: {
  workload: DeliveryGraph['workloads'][number];
  workspace: DeliveryGraphWorkspaceInput;
  bakeDefinitionPath: string | null;
  bakeTargets: string[];
  packageManager: 'bun' | 'pnpm' | 'yarn' | 'npm';
}): RepositoryTopologyService {
  const { workload, workspace } = input;
  const build = inferBuildMetadata({
    appDir: workspace.path,
    packageJson: workspace.packageJson,
    hasDockerfile: workspace.hasDockerfile,
    bakeDefinitionPath: input.bakeDefinitionPath,
    bakeTargets: input.bakeTargets,
    serviceName: workload.name,
  });

  return {
    name: workload.name,
    type: workload.type,
    appDir: workload.appDir,
    packageName: workload.packageName,
    startCommand: workload.startCommand,
    port: workload.port ?? 3000,
    schedule: workload.schedule,
    build,
    run: {
      command: workload.startCommand,
      ...(typeof workload.port === 'number' ? { port: workload.port } : {}),
    },
    healthcheck:
      workload.type === 'web'
        ? {
            path: workload.runtimeKind === 'static' ? '/healthz' : '/api/health',
            interval: 30,
          }
        : undefined,
    scaling: workload.type === 'web' ? { min: 1 } : undefined,
    runtime: {
      language:
        workload.runtimeKind === 'static'
          ? 'static'
          : input.packageManager === 'bun'
            ? 'bun'
            : 'node',
      ...(workload.runtimeKind === 'static' ? { framework: 'static' } : {}),
    },
    isPublic: workload.type === 'web',
  };
}

async function inspectWorkspaceDelivery(input: {
  reader: RepositoryTopologyReader;
  repoFullName: string;
  ref?: string;
  rootFiles: string[];
  rootPackageJson: PackageJsonShape | null;
  pnpmWorkspaceContent: string | null;
  bakeDefinitionPath: string | null;
  bakeTargets: string[];
}): Promise<{ graph: DeliveryGraph; services: RepositoryTopologyService[] }> {
  const packageManager = detectPackageManager(input.rootFiles, input.rootPackageJson);
  const [workspacePaths, rootEnvironmentContent] = await Promise.all([
    discoverWorkspacePaths({
      reader: input.reader,
      repoFullName: input.repoFullName,
      ref: input.ref,
      patterns: parseWorkspacePatterns(input.rootPackageJson, input.pnpmWorkspaceContent),
    }),
    safeGetFileContent(input.reader, input.repoFullName, '.env.example', input.ref),
  ]);

  const workspaces = (
    await Promise.all(
      workspacePaths.map(async (path): Promise<DeliveryGraphWorkspaceInput | null> => {
        const [packageJsonContent, dockerfileContent, environmentContent] = await Promise.all([
          safeGetFileContent(input.reader, input.repoFullName, `${path}/package.json`, input.ref),
          safeGetFileContent(input.reader, input.repoFullName, `${path}/Dockerfile`, input.ref),
          safeGetFileContent(input.reader, input.repoFullName, `${path}/.env.example`, input.ref),
        ]);
        const packageJson = parsePackageJson(packageJsonContent);
        if (!packageJson && !dockerfileContent) return null;

        return {
          path,
          zone: inferWorkspaceZone(path),
          packageJson: packageJson ?? {},
          hasDockerfile: Boolean(dockerfileContent),
          environmentKeys: parseEnvironmentKeys(environmentContent),
        };
      })
    )
  ).filter((workspace): workspace is DeliveryGraphWorkspaceInput => workspace !== null);

  const graph = inferDeliveryGraph({
    packageManager,
    rootPackageJson: input.rootPackageJson,
    rootEnvironmentKeys: parseEnvironmentKeys(rootEnvironmentContent),
    workspaces,
  });
  const workspaceByPath = new Map(workspaces.map((workspace) => [workspace.path, workspace]));
  const services = graph.workloads.map((workload) => {
    const workspace = workspaceByPath.get(workload.appDir);
    if (!workspace) {
      throw new Error(`Missing workspace descriptor for ${workload.id}`);
    }
    return toTopologyServiceFromWorkload({
      workload,
      workspace,
      bakeDefinitionPath: input.bakeDefinitionPath,
      bakeTargets: input.bakeTargets,
      packageManager,
    });
  });

  return { graph, services };
}

export async function inspectRepositoryTopology(
  reader: RepositoryTopologyReader,
  repoFullName: string,
  ref?: string
): Promise<RepositoryTopology> {
  const rootFiles = await reader.listRootFiles(repoFullName, ref);
  const monorepoType = detectMonorepoType(rootFiles);

  const [
    managedConfigContent,
    dockerBakeHclContent,
    dockerBakeJsonContent,
    rootPackageJsonContent,
    pnpmWorkspaceContent,
  ] = await Promise.all([
    safeGetFileContent(reader, repoFullName, 'juanie.yml', ref),
    safeGetFileContent(reader, repoFullName, 'docker-bake.hcl', ref),
    safeGetFileContent(reader, repoFullName, 'docker-bake.json', ref),
    safeGetFileContent(reader, repoFullName, 'package.json', ref),
    rootFiles.includes('pnpm-workspace.yaml')
      ? safeGetFileContent(reader, repoFullName, 'pnpm-workspace.yaml', ref)
      : Promise.resolve(null),
  ]);

  const bakeDefinitionPath = rootFiles.includes('docker-bake.hcl')
    ? 'docker-bake.hcl'
    : rootFiles.includes('docker-bake.json')
      ? 'docker-bake.json'
      : null;
  const dockerBakeContent = dockerBakeHclContent ?? dockerBakeJsonContent;
  const bakeTargets = dockerBakeContent ? parseDockerBakeTargets(dockerBakeContent) : [];
  const rootPackageJson = parsePackageJson(rootPackageJsonContent);
  if (managedConfigContent) {
    const parsedConfig = parseJuanieConfig(managedConfigContent);
    if (parsedConfig.isValid && parsedConfig.services.length > 0) {
      const serviceList = parsedConfig.services.map(toTopologyServiceFromConfig);
      return {
        monorepoType,
        rootFiles,
        hasDockerBake: Boolean(dockerBakeContent),
        bakeTargets,
        bakeDefinitionPath,
        rootPackageJson,
        deliveryGraph: buildDeclaredDeliveryGraph(serviceList, parsedConfig.buildTargets),
        services: serviceList,
        configMonorepo: parsedConfig.monorepo,
        configBuildTargets: parsedConfig.buildTargets,
        configDeliverables: parsedConfig.deliverables,
        managedConfigContent,
        source: 'juanie_config',
      };
    }
  }

  if (monorepoType === 'turborepo') {
    const delivery = await inspectWorkspaceDelivery({
      reader,
      repoFullName,
      ref,
      rootFiles,
      rootPackageJson,
      pnpmWorkspaceContent,
      bakeDefinitionPath,
      bakeTargets,
    });

    if (delivery.services.length > 0 || delivery.graph.artifacts.length > 0) {
      return {
        monorepoType,
        rootFiles,
        hasDockerBake: Boolean(dockerBakeContent),
        bakeTargets,
        bakeDefinitionPath,
        rootPackageJson,
        deliveryGraph: delivery.graph,
        services: delivery.services,
        source: 'turborepo_scan',
      };
    }
  }

  if (bakeTargets.length > 0) {
    const serviceList: RepositoryTopologyService[] = bakeTargets.map((target) => ({
      name: target,
      type: 'web',
      appDir: '.',
      startCommand: 'npm start',
      port: 3000,
      build: {
        strategy: 'bake',
        command: 'npm run build',
        definition: bakeDefinitionPath ?? undefined,
        context: '.',
        target,
      },
      run: {
        command: 'npm start',
        port: 3000,
      },
      healthcheck: {
        path: '/api/health',
        interval: 30,
      },
      scaling: { min: 1 },
      isPublic: true,
    }));
    return {
      monorepoType,
      rootFiles,
      hasDockerBake: true,
      bakeTargets,
      bakeDefinitionPath,
      rootPackageJson,
      deliveryGraph: buildDeclaredDeliveryGraph(serviceList),
      services: serviceList,
      source: 'docker_bake',
    };
  }

  const serviceType = inferServiceType('web', rootPackageJson);
  const run = inferRunCommand(
    serviceType,
    rootPackageJson,
    detectPackageManager(rootFiles, rootPackageJson)
  );
  const port = run.port ?? (serviceType === 'web' ? 3000 : undefined);
  const serviceList: RepositoryTopologyService[] = [
    {
      name: 'web',
      type: serviceType,
      appDir: '.',
      startCommand: run.command,
      port: port ?? 3000,
      schedule: serviceType === 'cron' ? run.schedule : undefined,
      build: {
        command: rootPackageJson?.scripts?.build?.trim() ?? 'npm run build',
      },
      run: {
        command: run.command,
        ...(typeof port === 'number' ? { port } : {}),
      },
      healthcheck:
        serviceType === 'web'
          ? {
              path: '/api/health',
              interval: 30,
            }
          : undefined,
      scaling: serviceType === 'web' ? { min: 1 } : undefined,
      isPublic: serviceType === 'web',
    },
  ];

  return {
    monorepoType,
    rootFiles,
    hasDockerBake: Boolean(dockerBakeContent),
    bakeTargets,
    bakeDefinitionPath,
    rootPackageJson,
    deliveryGraph: buildDeclaredDeliveryGraph(serviceList),
    services: serviceList,
    source: rootPackageJson ? 'package_json' : 'default',
  };
}

export { parseDockerBakeTargets };
