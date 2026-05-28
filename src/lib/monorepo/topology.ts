import { type JuanieConfig, parseJuanieConfig, type ServiceConfig } from '@/lib/config/parser';
import { detectMonorepoType, type MonorepoType } from './detect';

type ServiceType = 'web' | 'worker' | 'cron';
type BuildStrategy = 'auto' | 'dockerfile' | 'bake' | 'buildpacks';

type PackageJsonShape = {
  name?: string;
  packageManager?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  juanie?: {
    schedule?: string;
  };
  config?: {
    schedule?: string;
  };
};

export interface RepositoryTopologyBuild {
  strategy?: BuildStrategy;
  command?: string;
  dockerfile?: string;
  context?: string;
  target?: string;
  definition?: string;
  package?: {
    strategy: 'pnpm-deploy' | 'pnpm-pack' | 'npm-pack' | 'copy' | 'custom';
  };
}

export interface RepositoryTopologyService {
  name: string;
  type: ServiceType;
  appDir: string;
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
  services: RepositoryTopologyService[];
  configMonorepo?: JuanieConfig['monorepo'];
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
  const buildCommand = input.packageJson?.scripts?.build?.trim() ?? 'npm run build';

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

async function safeListDirectory(
  reader: RepositoryTopologyReader,
  repoFullName: string,
  path: string,
  ref?: string
): Promise<Array<{ name: string; path: string; type: 'file' | 'dir' }>> {
  try {
    return await reader.listDirectory(repoFullName, path, ref);
  } catch {
    return [];
  }
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

async function inspectWorkspaceServices(input: {
  reader: RepositoryTopologyReader;
  repoFullName: string;
  ref?: string;
  rootFiles: string[];
  rootPackageJson: PackageJsonShape | null;
  bakeDefinitionPath: string | null;
  bakeTargets: string[];
}): Promise<RepositoryTopologyService[]> {
  const packageManager = detectPackageManager(input.rootFiles, input.rootPackageJson);
  const entries = [
    ...(await safeListDirectory(input.reader, input.repoFullName, 'apps', input.ref)),
    ...(await safeListDirectory(input.reader, input.repoFullName, 'packages', input.ref)),
  ].filter((entry) => entry.type === 'dir');

  const services: Array<RepositoryTopologyService | null> = await Promise.all(
    entries.map(async (entry) => {
      const [packageJsonContent, dockerfileContent] = await Promise.all([
        safeGetFileContent(
          input.reader,
          input.repoFullName,
          `${entry.path}/package.json`,
          input.ref
        ),
        safeGetFileContent(input.reader, input.repoFullName, `${entry.path}/Dockerfile`, input.ref),
      ]);

      if (!packageJsonContent && !dockerfileContent) {
        return null;
      }

      const packageJson = parsePackageJson(packageJsonContent);
      const serviceName = basename(entry.path);
      const serviceType = inferServiceType(serviceName, packageJson);
      const run = inferRunCommand(serviceType, packageJson, packageManager);
      const port = run.port ?? (serviceType === 'web' ? 3000 : undefined);

      const service: RepositoryTopologyService = {
        name: serviceName,
        type: serviceType,
        appDir: entry.path,
        startCommand: run.command,
        port: port ?? 3000,
        build: inferBuildMetadata({
          appDir: entry.path,
          packageJson,
          hasDockerfile: Boolean(dockerfileContent),
          bakeDefinitionPath: input.bakeDefinitionPath,
          bakeTargets: input.bakeTargets,
          serviceName,
        }),
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
        ...(serviceType === 'cron' && run.schedule ? { schedule: run.schedule } : {}),
      };

      return service;
    })
  );

  return services.filter((service): service is RepositoryTopologyService => service !== null);
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
    managedConfigAltContent,
    dockerBakeHclContent,
    dockerBakeJsonContent,
    rootPackageJsonContent,
  ] = await Promise.all([
    safeGetFileContent(reader, repoFullName, 'juanie.yaml', ref),
    safeGetFileContent(reader, repoFullName, 'juanie.yml', ref),
    safeGetFileContent(reader, repoFullName, 'docker-bake.hcl', ref),
    safeGetFileContent(reader, repoFullName, 'docker-bake.json', ref),
    safeGetFileContent(reader, repoFullName, 'package.json', ref),
  ]);

  const bakeDefinitionPath = rootFiles.includes('docker-bake.hcl')
    ? 'docker-bake.hcl'
    : rootFiles.includes('docker-bake.json')
      ? 'docker-bake.json'
      : null;
  const dockerBakeContent = dockerBakeHclContent ?? dockerBakeJsonContent;
  const bakeTargets = dockerBakeContent ? parseDockerBakeTargets(dockerBakeContent) : [];
  const rootPackageJson = parsePackageJson(rootPackageJsonContent);
  const managedConfigContentResolved = managedConfigContent ?? managedConfigAltContent;

  if (managedConfigContentResolved) {
    const parsedConfig = parseJuanieConfig(managedConfigContentResolved);
    if (parsedConfig.isValid && parsedConfig.services.length > 0) {
      return {
        monorepoType,
        rootFiles,
        hasDockerBake: Boolean(dockerBakeContent),
        bakeTargets,
        bakeDefinitionPath,
        rootPackageJson,
        services: parsedConfig.services.map(toTopologyServiceFromConfig),
        configMonorepo: parsedConfig.monorepo,
        configDeliverables: parsedConfig.deliverables,
        managedConfigContent: managedConfigContentResolved,
        source: 'juanie_config',
      };
    }
  }

  if (monorepoType === 'turborepo') {
    const services = await inspectWorkspaceServices({
      reader,
      repoFullName,
      ref,
      rootFiles,
      rootPackageJson,
      bakeDefinitionPath,
      bakeTargets,
    });

    if (services.length > 0) {
      return {
        monorepoType,
        rootFiles,
        hasDockerBake: Boolean(dockerBakeContent),
        bakeTargets,
        bakeDefinitionPath,
        rootPackageJson,
        services,
        source: 'turborepo_scan',
      };
    }
  }

  if (bakeTargets.length > 0) {
    return {
      monorepoType,
      rootFiles,
      hasDockerBake: true,
      bakeTargets,
      bakeDefinitionPath,
      rootPackageJson,
      services: bakeTargets.map((target) => ({
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
      })),
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

  return {
    monorepoType,
    rootFiles,
    hasDockerBake: Boolean(dockerBakeContent),
    bakeTargets,
    bakeDefinitionPath,
    rootPackageJson,
    services: [
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
    ],
    source: rootPackageJson ? 'package_json' : 'default',
  };
}

export { parseDockerBakeTargets };
