import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normalizeDatabaseCapabilities } from '@/lib/databases/capabilities';
import { databases, projects, repositories, services } from '@/lib/db/schema';
import type { DeliveryGraphWorkload } from '@/lib/delivery-graph/model';
import { buildProjectNamespaceBase, buildProjectScopedK8sName } from '@/lib/k8s/naming';
import { buildSchemaContractCommentLines } from '@/lib/migrations/strategy';
import {
  renderManagedBuildTargetDockerfile,
  renderManagedRuntimeDockerfile,
} from '@/lib/projects/bootstrap/delivery-build';
import {
  getProjectBuildTargetsConfig,
  getProjectDeliverablesConfig,
  getProjectMonorepoConfig,
  getProjectServiceAppDir,
  getProjectServiceConfigMap,
  inferDatabaseCapabilities,
  inferSchemaConfig,
  type MonorepoAffectedRules,
  type MonorepoCiAffectedRules,
  type ProjectConfigBuildTargetEntry,
  type ProjectConfigDeliverableEntry,
  type ProjectConfigServiceEntry,
  type ProjectInitRenderContext,
  type RepoAutomationContextLike,
  supportsGeneratedMigration,
} from '@/lib/projects/bootstrap/repository-analysis';
import { getProjectProductionBranch } from '@/lib/projects/refs';
import { buildServiceRuntimeCommandSpec } from '@/lib/services/runtime-command';

export {
  buildRunScriptCommand,
  detectMigrationTool,
  detectPackageManager,
  extractAtlasSchemaSourcePaths,
  getProjectConfigJson,
  getProjectServiceConfigMap,
  inferSchemaConfig,
  type ProjectConfigBuildTargetEntry,
  type ProjectConfigDeliverableEntry,
  type ProjectConfigMonorepoEntry,
  type ProjectInitRenderContext,
  type RepoAutomationContext,
  resolveManagedMigrationScriptPaths,
  resolvePackageScriptCommand,
} from '@/lib/projects/bootstrap/repository-analysis';

export const JUANIE_BUILD_RUN_SCRIPT_PATH = '.juanie/build-run.sh';
export const JUANIE_DELIVERY_SCRIPT_PATH = '.juanie/delivery-artifacts.sh';
export const JUANIE_AFFECTED_WORKSPACE_SCRIPT_PATH = '.juanie/affected-workspace.mjs';
export const JUANIE_MANAGED_DOC_PATH = 'JUANIE.md';

const TEMPLATES_DIR = join(process.cwd(), 'templates');

function readRequiredTemplate(...segments: string[]): string {
  const templatePath = join(TEMPLATES_DIR, ...segments);
  if (!existsSync(templatePath)) {
    throw new Error(`Required template file not found at ${templatePath}`);
  }
  return readFileSync(templatePath, 'utf-8');
}

export function renderManagedWorkloadDockerfile(input: {
  workload: DeliveryGraphWorkload;
  packageManager: RepoAutomationContextLike['packageManager'];
  secretNames: string[];
}): string {
  const template = readRequiredTemplate(
    'runtime',
    input.workload.runtimeKind === 'static' ? 'static-web.Dockerfile' : 'bun-workload.Dockerfile'
  );
  return renderManagedRuntimeDockerfile({
    template,
    packageManager: input.packageManager,
    appDir: input.workload.appDir,
    buildCommand: input.workload.buildCommand ?? `${input.packageManager} run build`,
    startCommand: input.workload.startCommand,
    port: input.workload.port ?? 3000,
    secretNames: input.secretNames,
  });
}

export function renderManagedArtifactTargetDockerfile(input: {
  packageManager: RepoAutomationContextLike['packageManager'];
  buildCommand: string;
  outputPath: string;
  secretNames: string[];
}): string {
  return renderManagedBuildTargetDockerfile({
    template: readRequiredTemplate('runtime', 'build-target.Dockerfile'),
    ...input,
  });
}

export function renderStaticNginxConfig(): string {
  return readRequiredTemplate('runtime', 'static-nginx.conf');
}

function resolveBakeTarget(
  service: typeof services.$inferSelect,
  automation: RepoAutomationContextLike
): string | null {
  const bakeTargets = automation.bakeTargets ?? [];

  if (bakeTargets.length === 0) {
    return null;
  }

  const directMatch = bakeTargets.find((target) => target === service.name);
  if (directMatch) {
    return directMatch;
  }

  if (bakeTargets.length === 1) {
    return bakeTargets[0] ?? null;
  }

  return null;
}

function buildServiceBuildLines(
  service: typeof services.$inferSelect,
  automation: RepoAutomationContextLike,
  serviceConfig?: ProjectConfigServiceEntry
): string[] {
  const lines = ['    build:'];
  const configuredBuild = serviceConfig?.build;
  const buildCommand = configuredBuild?.command ?? service.buildCommand ?? 'npm run build';
  const dockerContext = configuredBuild?.context ?? service.dockerContext ?? '.';
  const dockerfile = configuredBuild?.dockerfile ?? service.dockerfile?.trim();
  const bakeDefinition = configuredBuild?.definition ?? automation.bakeDefinition ?? null;
  const bakeTarget = configuredBuild?.target ?? resolveBakeTarget(service, automation);
  const buildStrategy = configuredBuild?.strategy;

  lines.push(
    '      # command is the CI build command for this service.',
    `      command: ${buildCommand}`
  );

  if (bakeDefinition || buildStrategy === 'bake') {
    lines.push(
      '      # strategy bake uses Docker Buildx Bake targets.',
      '      strategy: bake',
      '      # context is the Docker build context.',
      `      context: ${dockerContext}`
    );

    if (bakeDefinition) {
      lines.push('      # definition points at docker-bake.hcl or docker-bake.json.');
      lines.push(`      definition: ${bakeDefinition}`);
    }

    if (bakeTarget) {
      lines.push('      # target selects the Bake target for this service.');
      lines.push(`      target: ${bakeTarget}`);
    }

    if (dockerfile) {
      lines.push('      # dockerfile is retained when the Bake target needs it as metadata.');
      lines.push(`      dockerfile: ${dockerfile}`);
    }

    appendBuildPackagingLines(lines, configuredBuild);
    return lines;
  }

  if (dockerfile || buildStrategy === 'dockerfile') {
    lines.push(
      '      # strategy dockerfile builds this service from a Dockerfile.',
      '      strategy: dockerfile',
      '      # context is the Docker build context.',
      `      context: ${dockerContext}`
    );
    if (dockerfile) {
      lines.push('      # dockerfile is the service image build file.');
      lines.push(`      dockerfile: ${dockerfile}`);
    }
    appendBuildPackagingLines(lines, configuredBuild);
    return lines;
  }

  lines.push(
    '      # strategy buildpacks lets the platform infer the image build when no Dockerfile is declared.',
    `      strategy: ${buildStrategy ?? 'buildpacks'}`,
    '      # context is the source directory used by the selected build strategy.',
    `      context: ${dockerContext}`
  );
  appendBuildPackagingLines(lines, configuredBuild);
  return lines;
}

function appendBuildPackagingLines(lines: string[], build?: ProjectConfigServiceEntry['build']) {
  if (build?.secrets?.length) {
    lines.push(
      '      # secrets lists BuildKit secret ids; values are fetched just-in-time from Juanie.',
      '      secrets:',
      ...build.secrets.map((secret) => `        - ${secret}`)
    );
  }

  if (build?.package) {
    lines.push(
      '      # package controls service runtime packaging before the image is built.',
      '      package:',
      '        # strategy selects the dependency pruning/packaging tool.',
      `        strategy: ${build.package.strategy}`
    );
  }
}

export function buildSchemaConfigLines(
  indent: string,
  inferred: ReturnType<typeof inferSchemaConfig>
): string[] {
  if (!inferred) {
    return buildSchemaContractCommentLines(indent);
  }

  const lines = [
    `${indent}# ${inferred.comment}`,
    `${indent}schema:`,
    `${indent}  source: ${inferred.source}`,
    ...(inferred.config ? [`${indent}  config: ${inferred.config}`] : []),
    `${indent}  phase: preDeploy`,
    `${indent}  executionMode: ${inferred.executionMode}`,
  ];

  if (inferred.approvalPolicy) {
    lines.push(`${indent}  approvalPolicy: ${inferred.approvalPolicy}`);
  }

  return lines;
}

export function buildServiceMigrationLines(
  service: typeof services.$inferSelect,
  serviceList: Array<typeof services.$inferSelect>,
  databaseList: Array<typeof databases.$inferSelect>,
  automation: RepoAutomationContextLike
): string[] {
  const serviceScopedRelationalDbs = databaseList.filter(
    (database) => database.serviceId === service.id && supportsGeneratedMigration(database.type)
  );

  if (serviceScopedRelationalDbs.length === 1 && serviceScopedRelationalDbs[0].role === 'primary') {
    return buildSchemaConfigLines(
      '    ',
      inferSchemaConfig(automation, serviceScopedRelationalDbs[0].type)
    );
  }

  if (serviceScopedRelationalDbs.length > 0) {
    const lines = ['    databases:'];

    for (const database of serviceScopedRelationalDbs) {
      const inferred = inferSchemaConfig(automation, database.type);
      lines.push(
        `      - role: ${database.role ?? 'primary'}`,
        `        type: ${database.type}`,
        ...buildSchemaConfigLines('        ', inferred)
      );
    }

    return lines;
  }

  if (serviceList.length === 1) {
    const accessibleRelationalDbs = databaseList.filter(
      (database) =>
        supportsGeneratedMigration(database.type) &&
        (database.serviceId === service.id || database.serviceId === null)
    );

    if (accessibleRelationalDbs.length === 1 && accessibleRelationalDbs[0].role === 'primary') {
      return buildSchemaConfigLines(
        '    ',
        inferSchemaConfig(automation, accessibleRelationalDbs[0].type)
      );
    }
  }

  return [];
}

function getLogicalDatabaseKey(database: typeof databases.$inferSelect): string {
  return [
    database.serviceId ?? 'project',
    database.name,
    database.type,
    database.scope ?? 'project',
    database.role ?? 'primary',
  ].join(':');
}

export function buildLogicalDatabaseList(
  databaseList: Array<typeof databases.$inferSelect>
): Array<typeof databases.$inferSelect> {
  const logicalDatabases = new Map<string, typeof databases.$inferSelect>();

  for (const database of databaseList) {
    const key = getLogicalDatabaseKey(database);
    const existing = logicalDatabases.get(key);

    if (!existing) {
      logicalDatabases.set(key, database);
      continue;
    }

    const capabilities = normalizeDatabaseCapabilities([
      ...normalizeDatabaseCapabilities(existing.capabilities),
      ...normalizeDatabaseCapabilities(database.capabilities),
    ]);

    logicalDatabases.set(key, {
      ...existing,
      capabilities,
    });
  }

  return [...logicalDatabases.values()];
}

const defaultMonorepoGlobalInputs = [
  'package.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'package-lock.json',
  'bun.lock',
  'bun.lockb',
  'turbo.json',
  'juanie.yaml',
  'juanie.yml',
  'docker-bake.hcl',
  'docker-bake.json',
] as const;

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => Boolean(value?.trim())))];
}

export function resolveMonorepoAffectedRules(
  project: Pick<typeof projects.$inferSelect, 'configJson'>,
  automation: RepoAutomationContextLike
): Required<MonorepoAffectedRules> {
  const configured = getProjectMonorepoConfig(project)?.affected;

  return {
    strategy: configured?.strategy ?? (automation.monorepoType === 'turborepo' ? 'turbo' : 'all'),
    task: configured?.task ?? 'build',
    useTaskInputs: configured?.useTaskInputs ?? false,
    global: uniqueStrings([...(configured?.global ?? []), ...defaultMonorepoGlobalInputs]),
    inputs: uniqueStrings(configured?.inputs ?? []),
  };
}

function buildCommentedListLines(indent: string, values: string[]): string[] {
  if (values.length === 0) {
    return [`${indent}[]`];
  }

  return values.map((value) => `${indent}- ${value}`);
}

function buildServiceRuntimeLines(serviceConfig?: ProjectConfigServiceEntry): string[] {
  const runtime = serviceConfig?.runtime;
  if (!runtime?.language) {
    return [];
  }

  return [
    '    # runtime describes how this service runs after it is built; type still controls workload role.',
    '    runtime:',
    '      # language selects the runtime family used by generated packaging and verification.',
    `      language: ${runtime.language}`,
    ...(runtime.framework
      ? [
          '      # framework is descriptive metadata for smarter defaults and future checks.',
          `      framework: ${runtime.framework}`,
        ]
      : []),
    ...(runtime.nodeVersion
      ? [
          '      # nodeVersion pins the Node runtime when language is node.',
          `      nodeVersion: "${runtime.nodeVersion}"`,
        ]
      : []),
  ];
}

function buildDeliverablesReferenceLines(): string[] {
  return [
    '',
    '# deliverables are customer-downloadable outputs produced by buildTargets.',
    '# Uncomment this section when a build target emits an SDK, documentation, or offline bundle.',
    '# deliverables:',
    '#   # name is the product name shown on the Release detail download list.',
    '#   - name: app-baremetal',
    '#     type: baremetal',
    '#     source:',
    '#       # target binds this artifact to a first-class build target output.',
    '#       target: sdk',
    '#     variants:',
    '#       - name: linux-amd64',
    '#         platform: linux/amd64',
    '#         # extract copies files out of the immutable target output image.',
    '#         extract:',
    '#           from: /app/dist',
    '#           to: .',
    '#         package:',
    '#           format: tar.gz',
    '#         checks:',
    '#           - command: test -n "$(find "$JUANIE_ARTIFACT_STAGE" -mindepth 1 -print -quit)"',
  ];
}

function buildConfiguredBuildTargetsLines(targets: ProjectConfigBuildTargetEntry[]): string[] {
  if (targets.length === 0) return [];

  const lines = [
    '',
    '# buildTargets are build-only graph nodes. They never become runtime services.',
    'buildTargets:',
  ];
  for (const target of targets) {
    lines.push(
      `  - name: ${target.name}`,
      `    kind: ${target.kind}`,
      '    monorepo:',
      `      appDir: ${target.monorepo.appDir}`,
      ...(target.monorepo.packageName
        ? [`      packageName: "${target.monorepo.packageName}"`]
        : []),
      '    build:',
      `      strategy: ${target.build.strategy ?? 'dockerfile'}`,
      ...(target.build.command ? [`      command: ${target.build.command}`] : []),
      ...(target.build.dockerfile ? [`      dockerfile: ${target.build.dockerfile}`] : []),
      `      context: ${target.build.context ?? '.'}`,
      ...(target.build.secrets?.length
        ? ['      secrets:', ...target.build.secrets.map((secret) => `        - ${secret}`)]
        : []),
      '    output:',
      `      path: ${target.output.path}`
    );
  }
  return lines;
}

function buildConfiguredDeliverablesLines(deliverables: ProjectConfigDeliverableEntry[]): string[] {
  if (deliverables.length === 0) {
    return buildDeliverablesReferenceLines();
  }

  const lines = [
    '',
    '# deliverables are customer-downloadable artifacts emitted by first-class build targets.',
    'deliverables:',
  ];

  for (const deliverable of deliverables) {
    lines.push(
      '  # name is shown on Release detail as the customer-facing product artifact.',
      `  - name: ${deliverable.name}`,
      '    # type controls delivery semantics: package, baremetal, or archive.',
      `    type: ${deliverable.type}`
    );

    if (deliverable.monorepo?.appDir) {
      lines.push(
        '    # monorepo.appDir binds this artifact to workspace affected detection; extraction reads the image.',
        '    monorepo:',
        `      appDir: ${deliverable.monorepo.appDir}`
      );
    }

    lines.push(
      '    # source.target binds this artifact to an immutable build target output.',
      '    source:',
      `      target: ${deliverable.source.target}`
    );

    lines.push(
      '    # variants model selectable extracts of the same deliverable.',
      '    variants:'
    );
    for (const variant of deliverable.variants) {
      lines.push(
        '      # name is the variant label customers choose when downloading.',
        `      - name: ${variant.name}`
      );

      if (variant.platform) {
        lines.push(
          '        # platform identifies the OS/CPU target, or any for portable artifacts.',
          `        platform: ${variant.platform}`
        );
      }

      lines.push(
        '        # extract copies files from the target output image into the package stage.',
        '        extract:',
        `          from: ${variant.extract.from}`,
        `          to: ${variant.extract.to ?? '.'}`
      );

      lines.push(
        '        # package controls the final archive format and platform metadata.',
        '        package:',
        `          format: ${variant.package.format}`
      );

      if (variant.package.platform) {
        lines.push(`          platform: ${variant.package.platform}`);
      }

      if (variant.package.platforms?.length) {
        lines.push(
          '          # platforms lists all targets when one build emits multiple platform bundles.',
          '          platforms:',
          ...buildCommentedListLines('            ', variant.package.platforms)
        );
      }

      if (variant.checks?.length) {
        lines.push(
          '        # checks prove the artifact is usable before release registration.',
          '        checks:'
        );
        for (const check of variant.checks) {
          lines.push(`          - command: ${check.command}`);
        }
      }
    }
  }

  return lines;
}

export function renderJuanieConfig(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  context: ProjectInitRenderContext,
  automation: RepoAutomationContextLike
): string {
  const targetBranch = getProjectProductionBranch(project);
  const logicalDatabases = buildLogicalDatabaseList(context.databases);
  const serviceConfigMap = getProjectServiceConfigMap(project);
  const monorepoAffected = resolveMonorepoAffectedRules(project, automation);
  const lines: string[] = [
    '# juanie.yaml',
    '# This file is the source of truth for Juanie build, deploy, verification, and delivery.',
    '# Keep runtime services, build-only targets, and customer deliverables as separate graph nodes.',
    '',
    '# name is the stable project slug displayed in Juanie.',
    `name: ${project.slug}`,
  ];

  if (automation.monorepoType !== 'none') {
    lines.push(
      '',
      '# monorepo tells Juanie how to calculate affected services and deliverables.',
      'monorepo:',
      '  # type is the supported workspace orchestrator. Juanie currently supports Turborepo.',
      `  type: ${automation.monorepoType}`,
      '  # packageManager selects install/build command defaults.',
      `  packageManager: ${automation.packageManager}`,
      '  # affected controls change detection. Turbo graph is primary; inputs are explicit fallbacks.',
      '  affected:',
      '    # strategy turbo uses Turborepo query affected before path-rule fallback.',
      `    strategy: ${monorepoAffected.strategy}`,
      '    # task is the Turborepo pipeline task used when task input precision is enabled.',
      `    task: ${monorepoAffected.task}`,
      '    # useTaskInputs true narrows affected detection to Turbo task inputs for the task above.',
      `    useTaskInputs: ${monorepoAffected.useTaskInputs}`,
      '    # global paths trigger a full build because they can change every package.',
      '    global:',
      ...buildCommentedListLines('      ', monorepoAffected.global),
      '    # inputs are non-standard shared source roots that also affect downstream artifacts.',
      '    inputs:',
      ...buildCommentedListLines('      ', monorepoAffected.inputs)
    );
  }

  lines.push('', '# services are deployable workloads: web, worker, or cron.', 'services:');

  for (const service of context.services) {
    const serviceConfig = serviceConfigMap[service.name];
    const runtimeCommand = buildServiceRuntimeCommandSpec(service);
    const autoscaling =
      service.autoscaling &&
      typeof service.autoscaling === 'object' &&
      !Array.isArray(service.autoscaling)
        ? (service.autoscaling as { max?: number; cpu?: number })
        : null;

    lines.push(
      `  # ${service.name} is a deployable ${service.type} workload.`,
      `  - name: ${service.name}`,
      '    # type controls deployment behavior: routing for web, background execution for worker, schedule for cron.',
      `    type: ${service.type}`,
      ...(getProjectServiceAppDir(project, service.name)
        ? [
            '    # monorepo.appDir points at this workload inside the repository.',
            '    monorepo:',
            `      appDir: ${getProjectServiceAppDir(project, service.name)}`,
            ...(serviceConfig?.monorepo?.packageName
              ? [
                  '      # packageName is the Turborepo package identity used for graph-aware affected detection.',
                  `      packageName: "${serviceConfig.monorepo.packageName}"`,
                ]
              : []),
          ]
        : []),
      ...buildServiceRuntimeLines(serviceConfig),
      '    # build describes how CI creates the service image or runtime artifact.',
      ...buildServiceBuildLines(service, automation, serviceConfig),
      '    # run describes the command Juanie starts after deployment.',
      '    run:',
      `      command: ${runtimeCommand.displayCommand}`
    );

    if (service.port) {
      lines.push(`      port: ${service.port}`);
    }

    const healthPath =
      service.healthcheckPath ?? (service.type === 'web' ? '/api/health' : '/health');
    lines.push(
      '    # healthcheck is used for deployment verification and rollout readiness.',
      '    healthcheck:',
      `      path: ${healthPath}`,
      `      interval: ${service.healthcheckInterval ?? 30}`
    );

    lines.push(
      '    # scaling controls desired replicas and optional autoscaling hints.',
      '    scaling:',
      `      min: ${service.replicas ?? 1}`,
      ...(autoscaling?.max ? [`      max: ${autoscaling.max}`] : []),
      ...(autoscaling?.cpu ? [`      cpu: ${autoscaling.cpu}`] : [])
    );

    lines.push(
      '    # resources set Kubernetes requests/limits for this workload.',
      '    resources:',
      `      cpuRequest: ${service.cpuRequest ?? '100m'}`,
      `      cpuLimit: ${service.cpuLimit ?? '500m'}`,
      `      memoryRequest: ${service.memoryRequest ?? '256Mi'}`,
      `      memoryLimit: ${service.memoryLimit ?? '512Mi'}`
    );

    if (service.isPublic === false) {
      lines.push('    # isPublic false keeps this web service internal to the project network.');
      lines.push('    isPublic: false');
    }

    const migrationLines = buildServiceMigrationLines(
      service,
      context.services,
      logicalDatabases,
      automation
    );
    if (migrationLines.length > 0) {
      lines.push(...migrationLines);
    }
  }

  lines.push(...buildConfiguredBuildTargetsLines(getProjectBuildTargetsConfig(project)));
  lines.push(...buildConfiguredDeliverablesLines(getProjectDeliverablesConfig(project)));

  if (logicalDatabases.length > 0) {
    lines.push(
      '',
      '# databases declare runtime data stores and their provisioning model.',
      'databases:'
    );

    for (const database of logicalDatabases) {
      const capabilities = inferDatabaseCapabilities(automation, database);
      lines.push(
        `  # ${database.name} is a ${database.type} database contract for this project.`,
        `  - name: ${database.name}`,
        '    # type selects the database engine.',
        `    type: ${database.type}`,
        '    # plan selects the platform resource size/tier.',
        `    plan: ${database.plan ?? 'starter'}`,
        '    # scope project means shared by the project; service means owned by one service.',
        `    scope: ${database.scope ?? (database.serviceId ? 'service' : 'project')}`,
        '    # role describes how services should treat this database binding.',
        `    role: ${database.role ?? 'primary'}`
      );

      if (capabilities.length > 0) {
        lines.push(
          '    # capabilities declare required database extensions/features before migrations run.',
          '    capabilities:',
          ...capabilities.map((capability) => `      - ${capability}`)
        );
      }
    }
  }

  lines.push(
    '',
    '# environments map logical Juanie environments to Git branches and optional variables.',
    'environments:',
    '  # production is the customer-facing stable environment.',
    '  production:',
    '    # branch is the Git ref used for this environment by default.',
    `    branch: ${targetBranch}`,
    '  # staging is the pre-production environment; adjust branch when the repo has a real staging branch.',
    '  staging:',
    `    branch: ${targetBranch}`
  );

  return `${lines.join('\n')}\n`;
}

export function renderGitHubCI(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  _context: ProjectInitRenderContext
): string {
  const templatePath = join(TEMPLATES_DIR, 'ci', 'github-actions.yml');

  if (existsSync(templatePath)) {
    let content = readFileSync(templatePath, 'utf-8');
    // Replace template variables
    content = content
      .replace(/\{\{PROJECT_NAME\}\}/g, project.name)
      .replace(/\{\{PROJECT_SLUG\}\}/g, project.slug);
    return content;
  }

  // Fallback: should not normally be reached in production (template file is bundled in Docker image)
  throw new Error(
    `CI template file not found at ${templatePath}. Ensure templates are bundled correctly.`
  );
}

export function renderDeliveryArtifactsScript(): string {
  const templatePath = join(TEMPLATES_DIR, 'ci', 'delivery-artifacts.sh');

  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf-8');
  }

  throw new Error(
    `Delivery artifact script template file not found at ${templatePath}. Ensure templates are bundled correctly.`
  );
}

export function renderBuildRunScript(): string {
  const templatePath = join(TEMPLATES_DIR, 'ci', 'build-run.sh');

  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf-8');
  }

  throw new Error(
    `Build run script template file not found at ${templatePath}. Ensure templates are bundled correctly.`
  );
}

export function renderAffectedWorkspaceScript(): string {
  const templatePath = join(TEMPLATES_DIR, 'ci', 'affected-workspace.mjs');

  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf-8');
  }

  throw new Error(
    `Affected workspace script template file not found at ${templatePath}. Ensure templates are bundled correctly.`
  );
}

export function renderGitLabCI(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  _context: ProjectInitRenderContext
): string {
  const templatePath = join(TEMPLATES_DIR, 'ci', 'gitlab-ci.yml');

  if (existsSync(templatePath)) {
    let content = readFileSync(templatePath, 'utf-8');
    content = content
      .replace(/\{\{PROJECT_NAME\}\}/g, project.name)
      .replace(/\{\{PROJECT_SLUG\}\}/g, project.slug);
    return content;
  }

  // Fallback: should not normally be reached in production (template file is bundled in Docker image)
  throw new Error(
    `CI template file not found at ${templatePath}. Ensure templates are bundled correctly.`
  );
}

interface MonorepoCiServiceEntry {
  name: string;
  type: 'web' | 'worker' | 'cron';
  appDir: string;
  packageName: string;
  build: {
    strategy?: 'auto' | 'dockerfile' | 'bake' | 'buildpacks';
    command?: string;
    dockerfile?: string;
    context?: string;
    target?: string;
    definition?: string;
  };
}

interface MonorepoCiDeliverableEntry {
  name: string;
  type: 'package' | 'baremetal' | 'archive';
  appDir: string;
  packageName?: string;
  sourceTarget: string;
  variant: {
    name: string;
    platform?: string;
    extract: {
      from: string;
      to?: string;
    };
    package: {
      format: 'tgz' | 'zip' | 'tar.gz' | 'directory';
      platform?: string;
    };
    checks: Array<{
      command: string;
    }>;
  };
}

export function buildMonorepoCiServices(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  serviceList: Array<typeof services.$inferSelect>
): MonorepoCiServiceEntry[] {
  const serviceConfigMap = getProjectServiceConfigMap(project);

  return serviceList.map((service) => {
    const serviceConfig = serviceConfigMap[service.name];
    const appDir = serviceConfig?.monorepo?.appDir ?? '.';
    const build = serviceConfig?.build;
    const normalizedAppDir = appDir.replace(/\/$/, '');
    const dockerfile =
      build?.dockerfile ?? service.dockerfile?.trim() ?? `${normalizedAppDir}/Dockerfile`;

    return {
      name: service.name,
      type: service.type,
      appDir,
      packageName: serviceConfig?.monorepo?.packageName ?? service.name,
      build: {
        strategy:
          build?.strategy ??
          (build?.definition || build?.target ? 'bake' : dockerfile ? 'dockerfile' : 'auto'),
        command: build?.command ?? service.buildCommand ?? 'npm run build',
        dockerfile,
        context: build?.context ?? service.dockerContext ?? '.',
        target: build?.target ?? (build?.strategy === 'bake' ? service.name : undefined),
        definition: build?.definition,
      },
    };
  });
}

export function buildMonorepoCiDeliverables(
  project: Pick<typeof projects.$inferSelect, 'configJson'>
): MonorepoCiDeliverableEntry[] {
  const targetByName = new Map(
    getProjectBuildTargetsConfig(project).map((target) => [target.name, target])
  );
  return getProjectDeliverablesConfig(project).flatMap((deliverable) => {
    const sourceTarget = deliverable.source.target;
    const target = targetByName.get(sourceTarget);
    return deliverable.variants.map((variant) => ({
      name: deliverable.name,
      type: deliverable.type,
      appDir: target?.monorepo.appDir ?? deliverable.monorepo?.appDir ?? '.',
      packageName: target?.monorepo.packageName,
      sourceTarget,
      variant: {
        name: variant.name,
        platform: variant.platform ?? variant.package.platform,
        extract: {
          from: variant.extract.from,
          to: variant.extract.to ?? '.',
        },
        package: {
          format: variant.package.format,
          platform: variant.package.platform ?? variant.platform,
        },
        checks: variant.checks ?? [],
      },
    }));
  });
}

export function selectMonorepoCiWork(input: {
  services: MonorepoCiServiceEntry[];
  deliverables: MonorepoCiDeliverableEntry[];
  changedFiles: string[];
  shouldBuildAll: boolean;
}): { services: MonorepoCiServiceEntry[]; deliverables: MonorepoCiDeliverableEntry[] } {
  const selectedDeliverables = input.shouldBuildAll
    ? input.deliverables
    : input.deliverables.filter((deliverable) =>
        input.changedFiles.some(
          (file) => file === deliverable.appDir || file.startsWith(`${deliverable.appDir}/`)
        )
      );
  const selectedServices = input.shouldBuildAll
    ? input.services
    : input.services.filter((service) =>
        input.changedFiles.some(
          (file) => file === service.appDir || file.startsWith(`${service.appDir}/`)
        )
      );
  return {
    services: selectedServices,
    deliverables: selectedDeliverables,
  };
}

export function encodeMonorepoCiServices(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  serviceList: Array<typeof services.$inferSelect>
): string {
  return Buffer.from(
    JSON.stringify(buildMonorepoCiServices(project, serviceList)),
    'utf8'
  ).toString('base64');
}

export function encodeMonorepoCiDeliverables(
  project: Pick<typeof projects.$inferSelect, 'configJson'>
): string {
  return Buffer.from(JSON.stringify(buildMonorepoCiDeliverables(project)), 'utf8').toString(
    'base64'
  );
}

export function encodeMonorepoAffectedRules(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  }
): string {
  const configured = getProjectMonorepoConfig(project)?.affected;
  const rules: MonorepoCiAffectedRules = {
    strategy: configured?.strategy ?? 'turbo',
    task: configured?.task ?? 'build',
    useTaskInputs: configured?.useTaskInputs ?? false,
    packageManager: getProjectMonorepoConfig(project)?.packageManager,
    global: uniqueStrings([...(configured?.global ?? []), ...defaultMonorepoGlobalInputs]),
    inputs: uniqueStrings(configured?.inputs ?? []),
  };

  return Buffer.from(JSON.stringify(rules), 'utf8').toString('base64');
}

export function renderGitHubCIMonorepo(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  serviceList: Array<typeof services.$inferSelect>
): string {
  const templatePath = join(TEMPLATES_DIR, 'ci', 'github-actions-monorepo.yml');
  const serviceMatrix = encodeMonorepoCiServices(project, serviceList);
  const deliverableMatrix = encodeMonorepoCiDeliverables(project);
  const affectedRules = encodeMonorepoAffectedRules(project);

  if (existsSync(templatePath)) {
    let content = readFileSync(templatePath, 'utf-8');
    content = content
      .replace(/\{\{PROJECT_NAME\}\}/g, project.name)
      .replace(/\{\{PROJECT_SLUG\}\}/g, project.slug)
      .replace(/\{\{JUANIE_SERVICE_MATRIX_B64\}\}/g, serviceMatrix)
      .replace(/\{\{JUANIE_DELIVERABLE_MATRIX_B64\}\}/g, deliverableMatrix)
      .replace(/\{\{JUANIE_AFFECTED_RULES_B64\}\}/g, affectedRules);
    return content;
  }

  throw new Error(
    `Monorepo CI template file not found at ${templatePath}. Ensure templates are bundled correctly.`
  );
}

export function renderGitLabCIMonorepo(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  serviceList: Array<typeof services.$inferSelect>
): string {
  const templatePath = join(TEMPLATES_DIR, 'ci', 'gitlab-ci-monorepo.yml');
  const serviceMatrix = encodeMonorepoCiServices(project, serviceList);
  const deliverableMatrix = encodeMonorepoCiDeliverables(project);
  const affectedRules = encodeMonorepoAffectedRules(project);

  if (existsSync(templatePath)) {
    let content = readFileSync(templatePath, 'utf-8');
    content = content
      .replace(/\{\{PROJECT_NAME\}\}/g, project.name)
      .replace(/\{\{PROJECT_SLUG\}\}/g, project.slug)
      .replace(/\{\{JUANIE_SERVICE_MATRIX_B64\}\}/g, serviceMatrix)
      .replace(/\{\{JUANIE_DELIVERABLE_MATRIX_B64\}\}/g, deliverableMatrix)
      .replace(/\{\{JUANIE_AFFECTED_RULES_B64\}\}/g, affectedRules);
    return content;
  }

  throw new Error(
    `Monorepo CI template file not found at ${templatePath}. Ensure templates are bundled correctly.`
  );
}

export function renderEnvTemplate(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  databaseList: Array<typeof databases.$inferSelect>
): string {
  const templatePath = join(TEMPLATES_DIR, 'env', '.env.juanie.example');

  if (existsSync(templatePath)) {
    let content = readFileSync(templatePath, 'utf-8');
    content = content
      .replace(/\{\{PROJECT_NAME\}\}/g, project.name)
      .replace(/\{\{PROJECT_SLUG\}\}/g, project.slug);
    return content;
  }

  const ns = buildProjectNamespaceBase(project.slug);
  const lines: string[] = [
    `# ===========================================`,
    `# Juanie 环境变量模板`,
    `# ===========================================`,
    `# 复制此文件为 .env 并填入实际值`,
    `# 真实值可在 Juanie 控制台 → 项目 → 环境变量 中查看`,
    ``,
    `PROJECT_NAME=${project.name}`,
    `PROJECT_SLUG=${project.slug}`,
  ];

  for (const db_ of databaseList) {
    const host =
      db_.provisionType === 'standalone'
        ? `${buildProjectScopedK8sName(project.slug, db_.name)}.${ns}.svc.cluster.local`
        : `<host>`;

    switch (db_.type) {
      case 'postgresql':
        lines.push(
          ``,
          `# --- PostgreSQL (${db_.name}) ---`,
          `DATABASE_URL=postgresql://postgres:<password>@${host}:5432/${db_.name}`,
          `POSTGRES_HOST=${host}`,
          `POSTGRES_PORT=5432`,
          `POSTGRES_USER=postgres`,
          `POSTGRES_PASSWORD=<在 Juanie 控制台查看>`,
          `POSTGRES_DB=${db_.name}`
        );
        break;
      case 'redis':
        lines.push(
          ``,
          `# --- Redis (${db_.name}) ---`,
          `REDIS_URL=redis://:<password>@${host}:6379`,
          `REDIS_HOST=${host}`,
          `REDIS_PORT=6379`,
          `REDIS_PASSWORD=<在 Juanie 控制台查看>`
        );
        break;
      case 'mysql':
        lines.push(
          ``,
          `# --- MySQL (${db_.name}) ---`,
          `MYSQL_URL=mysql://root:<password>@${host}:3306/${db_.name}`,
          `MYSQL_HOST=${host}`,
          `MYSQL_PORT=3306`,
          `MYSQL_USER=root`,
          `MYSQL_PASSWORD=<在 Juanie 控制台查看>`,
          `MYSQL_DATABASE=${db_.name}`
        );
        break;
      case 'mongodb':
        lines.push(
          ``,
          `# --- MongoDB (${db_.name}) ---`,
          `MONGODB_URL=mongodb://root:<password>@${host}:27017/${db_.name}`,
          `MONGODB_HOST=${host}`,
          `MONGODB_PORT=27017`,
          `MONGODB_USER=root`,
          `MONGODB_PASSWORD=<在 Juanie 控制台查看>`,
          `MONGODB_DATABASE=${db_.name}`
        );
        break;
    }
  }

  return `${lines.join('\n')}\n`;
}

export function renderJuanieManagedDoc(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  provider: 'github' | 'gitlab' | 'gitlab-self-hosted'
): string {
  const templatePath = join(TEMPLATES_DIR, 'docs', 'JUANIE.md');
  const ciFile = provider === 'github' ? '.github/workflows/juanie-ci.yml' : '.gitlab-ci.yml';

  if (existsSync(templatePath)) {
    let content = readFileSync(templatePath, 'utf-8');
    content = content
      .replace(/\{\{PROJECT_NAME\}\}/g, project.name)
      .replace(/\{\{PROJECT_SLUG\}\}/g, project.slug)
      .replace(/\{\{CI_FILE\}\}/g, ciFile);
    return content;
  }

  throw new Error(
    `Juanie managed doc template file not found at ${templatePath}. Ensure templates are bundled correctly.`
  );
}
