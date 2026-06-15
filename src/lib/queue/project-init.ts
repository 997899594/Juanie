import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Job, Worker } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import {
  type DatabaseCapability,
  normalizeDatabaseCapabilities,
} from '@/lib/databases/capabilities';
import { supportsDatabaseAutomatedMigrations } from '@/lib/databases/platform-support';
import { injectDatabaseEnvVars, provisionDatabase } from '@/lib/databases/provisioning';
import { db } from '@/lib/db';
import {
  databases,
  domains,
  environments,
  projectInitSteps,
  projects,
  repositories,
  services,
} from '@/lib/db/schema';
import { resolveDeployImageRepository } from '@/lib/deploy-images';
import { syncEnvVarsToK8s } from '@/lib/env-sync';
import { ensureEnvironmentNamespace, reconcileEnvironmentState } from '@/lib/environments/service';
import { setEnvironmentSourceBuildState } from '@/lib/environments/source-build-state';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import { insertRepositoryRecord } from '@/lib/integrations/service/repository-service';
import { isK8sAvailable } from '@/lib/k8s';
import { buildProjectNamespaceBase, buildProjectScopedK8sName } from '@/lib/k8s/naming';
import { logger } from '@/lib/logger';
import { isPlatformManagedMigrationTool } from '@/lib/migrations/platform-managed';
import {
  getDefaultSchemaConfigPath,
  getSchemaConfigCandidates,
  resolveExecutionToolForSchemaSource,
} from '@/lib/migrations/schema-source';
import { buildSchemaContractCommentLines } from '@/lib/migrations/strategy';
import {
  inspectRepositoryTopology,
  type MonorepoType,
  parseDockerBakeTargets,
  type RepositoryTopologyService,
} from '@/lib/monorepo';
import {
  buildInitialAutoDeploySummary,
  resolveInitialAutoDeployEnvironmentsForRef,
  resolveInitialAutoDeployRefs,
} from '@/lib/projects/initial-auto-deploy';
import { getProjectProductionBranch } from '@/lib/projects/refs';
import { publishProjectInitRealtimeEvent } from '@/lib/realtime/project-init';
import { publishProjectRealtimeSnapshot } from '@/lib/realtime/projects';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';
import { buildServiceRuntimeCommandSpec } from '@/lib/services/runtime-command';
import { TemplateService } from '@/lib/templates';
import type { ProjectInitJobData } from './index';
import { requiredCapabilitiesForStep } from './project-init-capabilities';
import {
  getProjectInitSteps,
  isAutoRetryableProjectInitError,
  isK8sBackedProjectInitStep,
  type ProjectInitErrorCode,
  type ProjectInitStepName,
  projectInitDefaultErrorCodes,
} from './project-init-steps';

const isDev = process.env.NODE_ENV === 'development';
const projectInitLogger = logger.child({ component: 'project-init' });
const JUANIE_BUILD_RUN_SCRIPT_PATH = '.juanie/build-run.sh';
const JUANIE_DELIVERY_SCRIPT_PATH = '.juanie/delivery-artifacts.sh';

export { requiredCapabilitiesForStep } from './project-init-capabilities';

// ============================================
// Helper Functions
// ============================================

/**
 * Parse a shell command string into an array of arguments.
 * Handles quoted strings (single and double quotes) and escaped spaces.
 * @example parseCommandString('node server.js --config "my file.json"')
 *   returns ['node', 'server.js', '--config', 'my file.json']
 */
function _parseCommandString(commandStr: string): string[] {
  const args: string[] = [];
  let current = '';
  let inSingleQuote = false;
  let inDoubleQuote = false;
  let escapeNext = false;

  for (let i = 0; i < commandStr.length; i++) {
    const char = commandStr[i];

    if (escapeNext) {
      current += char;
      escapeNext = false;
      continue;
    }

    if (char === '\\') {
      escapeNext = true;
      continue;
    }

    if (char === "'" && !inDoubleQuote) {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (char === '"' && !inSingleQuote) {
      inDoubleQuote = !inDoubleQuote;
      continue;
    }

    if (char === ' ' && !inSingleQuote && !inDoubleQuote) {
      if (current || args.length > 0) {
        args.push(current);
        current = '';
      }
      continue;
    }

    current += char;
  }

  if (current || args.length > 0) {
    args.push(current);
  }

  return args;
}

type StepProgressReporter = (progress: number, message?: string) => Promise<void>;

// ============================================
// Helper Functions
// ============================================

async function updateStepStatus(
  projectId: string,
  step: ProjectInitStepName,
  status: 'running' | 'completed' | 'failed' | 'skipped',
  data?: { message?: string; progress?: number; error?: string; errorCode?: ProjectInitErrorCode }
) {
  const hasField = (field: keyof NonNullable<typeof data>) =>
    Boolean(data && Object.hasOwn(data, field));

  const updatePayload: Record<string, unknown> = {
    status,
    startedAt: status === 'running' ? new Date() : undefined,
    completedAt: status === 'completed' || status === 'skipped' ? new Date() : undefined,
  };

  if (hasField('message')) {
    updatePayload.message =
      status === 'running' || status === 'completed' || status === 'skipped'
        ? (data?.message ?? null)
        : data?.message;
  }

  if (hasField('progress')) {
    updatePayload.progress = data?.progress ?? null;
  }

  if (hasField('errorCode')) {
    updatePayload.errorCode =
      status === 'running' || status === 'completed' || status === 'skipped'
        ? null
        : data?.errorCode;
  }

  if (hasField('error')) {
    updatePayload.error =
      status === 'running' || status === 'completed' || status === 'skipped' ? null : data?.error;
  }

  await db
    .update(projectInitSteps)
    .set(updatePayload)
    .where(and(eq(projectInitSteps.projectId, projectId), eq(projectInitSteps.step, step)));

  await publishProjectInitRealtimeEvent({
    kind: 'step_updated',
    projectId,
    step,
    status,
    progress: hasField('progress') ? (data?.progress ?? null) : null,
    timestamp: Date.now(),
  }).catch((error) => {
    projectInitLogger.warn('Failed to publish project init realtime event', {
      projectId,
      step,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  });
}

async function publishProjectInitCompletion(projectId: string) {
  await Promise.all([
    publishProjectInitRealtimeEvent({
      kind: 'completed',
      projectId,
      status: 'active',
      timestamp: Date.now(),
    }).catch((error) => {
      projectInitLogger.warn('Failed to publish project init completion event', {
        projectId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }),
    publishProjectRealtimeSnapshot(projectId).catch((error) => {
      projectInitLogger.warn('Failed to publish project realtime snapshot after init completion', {
        projectId,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }),
  ]);
}

async function publishProjectInitFailureSnapshot(projectId: string) {
  await publishProjectRealtimeSnapshot(projectId).catch((error) => {
    projectInitLogger.warn('Failed to publish project realtime snapshot after init failure', {
      projectId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  });
}

function classifyProjectInitError(step: ProjectInitStepName, error: unknown): ProjectInitErrorCode {
  const message =
    error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();

  if (step === 'validate_repository') {
    if (message.includes('no repository linked')) return 'repository_missing';
    if (message.includes('no access to repository')) return 'repository_access_denied';
  }

  if (step === 'create_repository') {
    if (message.includes('write_repo') || message.includes('permission')) {
      return 'repository_create_denied';
    }
  }

  return projectInitDefaultErrorCodes[step] ?? 'init_step_failed';
}

async function loadProjectInitProject(projectId: string) {
  return db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      repository: true,
      team: {
        columns: {
          name: true,
        },
      },
    },
  });
}

type ProjectInitProjectRecord = NonNullable<Awaited<ReturnType<typeof loadProjectInitProject>>>;

function requireProjectInitRepository(
  project: Pick<ProjectInitProjectRecord, 'repository'>,
  message = 'Project has no repository'
): typeof repositories.$inferSelect {
  if (!project.repository) {
    throw new Error(message);
  }

  return project.repository;
}

interface ProjectInitExecutionContext {
  hasK8s: boolean;
  project: ProjectInitProjectRecord;
  reportStepProgress: StepProgressReporter;
  template?: string;
}

type ProjectInitStepRunner = (
  context: ProjectInitExecutionContext
) => Promise<ProjectInitProjectRecord | undefined>;

const projectInitStepRunners: Record<ProjectInitStepName, ProjectInitStepRunner> = {
  validate_repository: async ({ project, reportStepProgress }) => {
    await validateRepository(project, reportStepProgress);
    return undefined;
  },
  create_repository: async ({ project, reportStepProgress }) => {
    await createRepository(project, reportStepProgress);
    return (await loadProjectInitProject(project.id)) ?? project;
  },
  push_template: async ({ project, reportStepProgress, template }) => {
    await pushTemplate(project, template, reportStepProgress);
    return undefined;
  },
  push_cicd_config: async ({ project, reportStepProgress }) => {
    await pushCicdConfig(project, reportStepProgress);
    return undefined;
  },
  configure_release_trigger: async ({ project, reportStepProgress }) => {
    await configureReleaseTrigger(project, reportStepProgress);
    return undefined;
  },
  setup_namespace: async ({ project, reportStepProgress }) => {
    await setupNamespace(project, reportStepProgress);
    return undefined;
  },
  provision_databases: async ({ project, hasK8s, reportStepProgress }) => {
    await provisionDatabases(project, hasK8s, reportStepProgress);
    return undefined;
  },
  deploy_services: async ({ project, hasK8s, reportStepProgress }) => {
    await deployServices(project, hasK8s, reportStepProgress);
    return undefined;
  },
  configure_dns: async ({ project, hasK8s, reportStepProgress }) => {
    await configureDns(project, hasK8s, reportStepProgress);
    return undefined;
  },
  trigger_initial_builds: async ({ project, reportStepProgress }) => {
    await triggerInitialAutoDeployBuilds(project, reportStepProgress);
    return undefined;
  },
};

export async function processProjectInit(job: Job<ProjectInitJobData>) {
  const { projectId, mode, template } = job.data;

  const project = await loadProjectInitProject(projectId);

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  await db
    .update(projects)
    .set({ status: 'initializing', updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  const hasK8s = isK8sAvailable();
  const steps = getProjectInitSteps(mode);
  const currentAttempt = job.attemptsMade + 1;
  const totalAttempts =
    typeof job.opts.attempts === 'number' && job.opts.attempts > 0 ? job.opts.attempts : 1;

  for (const step of steps) {
    try {
      const reportStepProgress: StepProgressReporter = (progress, message) =>
        updateStepStatus(projectId, step, 'running', {
          progress,
          ...(message !== undefined ? { message } : {}),
        });

      await updateStepStatus(projectId, step, 'running', {
        progress: 0,
        ...(currentAttempt > 1
          ? { message: `平台正在自动重试（第 ${currentAttempt} 次尝试）` }
          : {}),
      });

      const maybeUpdatedProject = await projectInitStepRunners[step]({
        project,
        template,
        hasK8s,
        reportStepProgress,
      });

      if (maybeUpdatedProject) {
        Object.assign(project, maybeUpdatedProject);
      }

      const message =
        !hasK8s && isK8sBackedProjectInitStep(step) ? 'Skipped (no K8s cluster)' : undefined;

      await updateStepStatus(
        projectId,
        step,
        hasK8s || !isK8sBackedProjectInitStep(step) ? 'completed' : 'skipped',
        { progress: 100, message }
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      const errorCode = classifyProjectInitError(step, error);
      const autoRetryPending =
        isAutoRetryableProjectInitError(errorCode) && currentAttempt < totalAttempts;
      await updateStepStatus(projectId, step, 'failed', {
        error: message,
        errorCode,
        message: autoRetryPending
          ? `平台将在稍后自动重试（下一次为第 ${currentAttempt + 1} 次尝试）`
          : currentAttempt > 1
            ? `平台已执行 ${currentAttempt} 次尝试，后续需要人工处理`
            : undefined,
      });
      await db
        .update(projects)
        .set({ status: 'failed', updatedAt: new Date() })
        .where(eq(projects.id, projectId));
      await publishProjectInitFailureSnapshot(projectId);

      if (!autoRetryPending) {
        job.discard();
      }
      throw error;
    }
  }

  await db
    .update(projects)
    .set({ status: 'active', statusMessage: null, updatedAt: new Date() })
    .where(eq(projects.id, projectId));
  await publishProjectInitCompletion(projectId);
}

async function validateRepository(
  project: typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null },
  onProgress?: StepProgressReporter
) {
  const scopedLogger = projectInitLogger.child({
    projectId: project.id,
    step: 'validate_repository',
  });
  scopedLogger.info('Starting repository validation', { projectName: project.name });
  await onProgress?.(10, '检查仓库绑定');

  const repository = project.repository;

  if (!repository) {
    scopedLogger.warn('No repository linked');
    if (isDev) {
      scopedLogger.info('Skipping repository validation in development mode');
      await onProgress?.(100, '开发模式下跳过仓库校验');
      return;
    }
    throw new Error('No repository linked to project');
  }

  scopedLogger.info('Validating repository access', {
    repositoryFullName: repository.fullName,
  });
  await onProgress?.(45, '验证团队仓库授权');

  // Obtain integration session with required capability
  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('validate_repository'),
  });

  await onProgress?.(80, '读取仓库元数据');
  const repo = await gateway.getRepository(session, repository.fullName);
  scopedLogger.info('Resolved repository access', {
    repositoryFullName: repository.fullName,
    accessGranted: Boolean(repo),
  });

  if (!repo) {
    throw new Error('No access to repository');
  }

  await onProgress?.(100, '仓库访问已确认');
  scopedLogger.info('Repository validation passed');
}

async function createRepository(
  project: typeof projects.$inferSelect,
  onProgress?: StepProgressReporter
) {
  const scopedLogger = projectInitLogger.child({
    projectId: project.id,
    step: 'create_repository',
  });
  scopedLogger.info('Creating repository for project', { projectName: project.name });
  await onProgress?.(10, '准备创建仓库');

  // Obtain integration session with required capability
  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('create_repository'),
  });

  const projectConfig =
    project.configJson && typeof project.configJson === 'object'
      ? (project.configJson as Record<string, unknown>)
      : null;
  const projectInitConfig =
    projectConfig?.projectInit && typeof projectConfig.projectInit === 'object'
      ? (projectConfig.projectInit as Record<string, unknown>)
      : null;
  const isPrivate =
    typeof projectInitConfig?.isPrivate === 'boolean' ? projectInitConfig.isPrivate : true;

  await onProgress?.(40, '向代码仓库提供方申请新仓库');
  const repo = await gateway.createRepository(session, {
    name: project.slug,
    description: project.description || undefined,
    isPrivate,
    autoInit: false,
  });

  // Create repository record in database
  await onProgress?.(75, '写入 Juanie 项目绑定');
  const dbRepoId = await insertRepositoryRecord(repo, session.integrationId);

  // Update project with repository ID
  await db.update(projects).set({ repositoryId: dbRepoId }).where(eq(projects.id, project.id));

  await onProgress?.(100, '仓库创建完成');
  scopedLogger.info('Created repository for project', {
    repositoryFullName: repo.fullName,
  });
}

async function pushTemplate(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
    team?: {
      name: string;
    } | null;
  },
  template?: string,
  onProgress?: StepProgressReporter
) {
  const scopedLogger = projectInitLogger.child({
    projectId: project.id,
    step: 'push_template',
  });
  scopedLogger.info('Pushing template to project repository', { projectName: project.name });
  await onProgress?.(10, '准备模板内容');

  const repository = requireProjectInitRepository(project);
  const targetBranch = getProjectProductionBranch(project);

  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('push_template'),
  });

  // Use gateway to push files instead of direct client
  const templateId = template || 'default';
  await onProgress?.(45, '渲染模板文件');
  const files = await new TemplateService(templateId, {
    projectName: project.name,
    projectSlug: project.slug,
    teamName: project.team?.name || 'Team',
    description: project.description || '',
  }).renderToMemory();

  await onProgress?.(85, '推送模板到仓库');
  await gateway.pushFiles(session, {
    repoFullName: repository.fullName,
    branch: targetBranch,
    files: Object.fromEntries(files),
    message: 'Initial commit from Juanie template',
  });

  await onProgress?.(100, '模板已推送');
  scopedLogger.info('Pushed template files to repository', {
    fileCount: files.size,
    repositoryFullName: repository.fullName,
  });
}

// ============================================
// CI/CD Config Functions
// ============================================

const TEMPLATES_DIR = join(process.cwd(), 'templates');
const JUANIE_MANAGED_DOC_PATH = 'JUANIE.md';

interface ProjectInitRenderContext {
  services: Array<typeof services.$inferSelect>;
  databases: Array<typeof databases.$inferSelect>;
}

type PackageManager = 'bun' | 'pnpm' | 'yarn' | 'npm';

interface RepoAutomationContext {
  monorepoType: MonorepoType;
  rootFiles: string[];
  packageManager: PackageManager;
  bakeDefinition: string | null;
  bakeTargets: string[];
  atlasConfigPath: string | null;
  atlasConfigContent: string | null;
  atlasSchemaContents: Record<string, string>;
  migrationScriptContents: Record<string, string>;
  packageJson: {
    packageManager?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null;
}

type RepoAutomationContextLike = Pick<
  RepoAutomationContext,
  'monorepoType' | 'rootFiles' | 'packageManager' | 'bakeDefinition' | 'bakeTargets' | 'packageJson'
> &
  Partial<
    Pick<
      RepoAutomationContext,
      'atlasConfigPath' | 'atlasConfigContent' | 'atlasSchemaContents' | 'migrationScriptContents'
    >
  >;

type ProjectConfigServiceEntry = {
  monorepo?: {
    appDir?: string;
  };
  runtime?: {
    language?: 'node' | 'bun' | 'static' | 'custom';
    framework?: string;
    nodeVersion?: string;
  };
  build?: {
    strategy?: 'auto' | 'dockerfile' | 'bake' | 'buildpacks';
    command?: string;
    dockerfile?: string;
    context?: string;
    target?: string;
    definition?: string;
    package?: {
      strategy: 'pnpm-deploy' | 'pnpm-pack' | 'npm-pack' | 'copy' | 'custom';
    };
  };
};

type ProjectConfigMonorepoEntry = {
  enabled?: boolean;
  type?: MonorepoType;
  packageManager?: PackageManager;
  affected?: MonorepoAffectedRules;
};

type ProjectConfigDeliverableEntry = {
  name: string;
  type: 'package' | 'baremetal' | 'archive';
  monorepo?: {
    appDir?: string;
  };
  source?: {
    service: string;
  };
  variants: Array<{
    name: string;
    platform?: string;
    extract: {
      from: string;
      to?: string;
    };
    package: {
      format: 'tgz' | 'zip' | 'tar.gz' | 'directory';
      platform?: string;
      platforms?: string[];
    };
    checks?: Array<{
      command: string;
    }>;
  }>;
};

interface MonorepoAffectedRules {
  strategy?: 'turbo' | 'all' | 'manual';
  global?: string[];
  inputs?: string[];
}

function supportsGeneratedMigration(dbType: typeof databases.$inferSelect.type): boolean {
  return supportsDatabaseAutomatedMigrations(dbType);
}

function getProjectConfigJson(
  project: Pick<typeof projects.$inferSelect, 'configJson'>
): Record<string, unknown> {
  return project.configJson && typeof project.configJson === 'object'
    ? (project.configJson as Record<string, unknown>)
    : {};
}

function getProjectServiceConfigMap(
  project: Pick<typeof projects.$inferSelect, 'configJson'>
): Record<string, ProjectConfigServiceEntry> {
  const config = getProjectConfigJson(project);
  const servicesConfig = config.services;

  return servicesConfig && typeof servicesConfig === 'object'
    ? (servicesConfig as Record<string, ProjectConfigServiceEntry>)
    : {};
}

function getProjectMonorepoConfig(
  project: Pick<typeof projects.$inferSelect, 'configJson'>
): ProjectConfigMonorepoEntry | null {
  const config = getProjectConfigJson(project);
  const monorepo = config.monorepo;

  return monorepo && typeof monorepo === 'object' ? (monorepo as ProjectConfigMonorepoEntry) : null;
}

function getProjectDeliverablesConfig(
  project: Pick<typeof projects.$inferSelect, 'configJson'>
): ProjectConfigDeliverableEntry[] {
  const config = getProjectConfigJson(project);
  return Array.isArray(config.deliverables)
    ? (config.deliverables as ProjectConfigDeliverableEntry[])
    : [];
}

function getProjectServiceAppDir(
  project: Pick<typeof projects.$inferSelect, 'configJson'>,
  serviceName: string
): string | null {
  return getProjectServiceConfigMap(project)[serviceName]?.monorepo?.appDir ?? null;
}

export function detectPackageManager(
  rootFiles: string[],
  packageJson: RepoAutomationContext['packageJson']
): PackageManager {
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

export function buildRunScriptCommand(packageManager: PackageManager, script: string): string {
  if (packageManager === 'yarn') {
    return `yarn ${script}`;
  }

  return `${packageManager} run ${script}`;
}

export function resolvePackageScriptCommand(
  packageJson: RepoAutomationContext['packageJson'],
  packageManager: PackageManager,
  script: string
): string {
  const declared = packageJson?.scripts?.[script]?.trim();
  if (declared) {
    return declared;
  }

  return buildRunScriptCommand(packageManager, script);
}

const managedMigrationScriptNames = ['db:push', 'db:migrate', 'db:deploy'] as const;

function detectMigrationToolFromText(
  text: string
): 'atlas' | 'drizzle' | 'prisma' | 'knex' | 'typeorm' | null {
  const normalized = text.trim();
  if (!normalized) {
    return null;
  }

  if (/\batlas\b/i.test(normalized)) return 'atlas';
  if (/\bprisma\b/i.test(normalized)) return 'prisma';
  if (/\bdrizzle-kit\b|\bdrizzle-orm\b/i.test(normalized)) return 'drizzle';
  if (/\bknex\b/i.test(normalized)) return 'knex';
  if (/\btypeorm\b/i.test(normalized)) return 'typeorm';
  return null;
}

function resolveMigrationScriptFilePaths(command: string): string[] {
  const args = _parseCommandString(command);
  const paths = new Set<string>();

  for (let index = 0; index < args.length; index += 1) {
    const value = args[index]?.trim();
    if (!value || value.startsWith('-')) {
      continue;
    }

    const next = args[index + 1]?.trim();
    if (
      ['node', 'bun', 'tsx', 'ts-node', 'bash', 'sh'].includes(value) &&
      next &&
      !next.startsWith('-')
    ) {
      paths.add(next.replace(/^\.\//u, ''));
      continue;
    }

    if (
      value.startsWith('./scripts/') ||
      value.startsWith('scripts/') ||
      /\.(?:mjs|cjs|js|ts|tsx|sh)$/u.test(value)
    ) {
      paths.add(value.replace(/^\.\//u, ''));
    }
  }

  return [...paths];
}

function resolveManagedMigrationScriptPaths(
  packageJson: RepoAutomationContext['packageJson']
): string[] {
  const scripts = packageJson?.scripts ?? {};
  const paths = new Set<string>();

  for (const scriptName of managedMigrationScriptNames) {
    const command = scripts[scriptName]?.trim();
    if (!command) {
      continue;
    }

    for (const scriptPath of resolveMigrationScriptFilePaths(command)) {
      paths.add(scriptPath);
    }
  }

  return [...paths];
}

export function detectMigrationTool(
  automation: Pick<RepoAutomationContextLike, 'packageJson' | 'rootFiles'> &
    Partial<Pick<RepoAutomationContextLike, 'atlasConfigContent' | 'migrationScriptContents'>>
) {
  const scripts = automation.packageJson?.scripts ?? {};

  for (const scriptName of managedMigrationScriptNames) {
    const detected = detectMigrationToolFromText(scripts[scriptName]?.trim() ?? '');
    if (detected) {
      return detected;
    }
  }

  for (const content of Object.values(automation.migrationScriptContents ?? {})) {
    const detected = detectMigrationToolFromText(content);
    if (detected) {
      return detected;
    }
  }

  const dependencies = {
    ...(automation.packageJson?.dependencies ?? {}),
    ...(automation.packageJson?.devDependencies ?? {}),
  };

  if (dependencies.prisma || dependencies['@prisma/client']) return 'prisma';
  if (dependencies['drizzle-kit'] || dependencies['drizzle-orm']) return 'drizzle';
  if (dependencies.knex) return 'knex';
  if (dependencies.typeorm) return 'typeorm';
  if (automation.atlasConfigContent || automation.rootFiles.includes('atlas.hcl')) return 'atlas';
  return 'custom';
}

function inferSchemaConfigPath(
  automation: RepoAutomationContextLike,
  source: ReturnType<typeof detectMigrationTool>
): string | null {
  if (source === 'atlas') {
    return automation.atlasConfigPath ?? 'atlas.hcl';
  }

  if (source === 'drizzle') {
    const candidates = getSchemaConfigCandidates(source);
    return candidates.find((candidate) => automation.rootFiles.includes(candidate)) ?? null;
  }

  return getDefaultSchemaConfigPath(source);
}

function extractAtlasSchemaSourcePaths(content: string): string[] {
  const paths = new Set<string>();
  const regex = /src\s*=\s*["']file:\/\/([^"']+)["']/g;
  let match: RegExpExecArray | null = regex.exec(content);

  while (match !== null) {
    const rawPath = match[1]?.trim();
    if (rawPath) {
      paths.add(rawPath.replace(/^\.\//u, ''));
    }
    match = regex.exec(content);
  }

  return [...paths];
}

function inferDatabaseCapabilities(
  automation: RepoAutomationContextLike,
  database: Pick<typeof databases.$inferSelect, 'type' | 'capabilities'>
): DatabaseCapability[] {
  const declared = normalizeDatabaseCapabilities(database.capabilities ?? []);

  if (database.type !== 'postgresql') {
    return declared;
  }

  const inspectionText = [
    automation.atlasConfigContent ?? '',
    ...Object.values(automation.atlasSchemaContents ?? {}),
    ...Object.values(automation.migrationScriptContents ?? {}),
  ]
    .filter(Boolean)
    .join('\n');

  if (!inspectionText.trim()) {
    return declared;
  }

  const inferred: DatabaseCapability[] = [...declared];
  const detectors: Array<{
    capability: DatabaseCapability;
    patterns: RegExp[];
  }> = [
    {
      capability: 'vector',
      patterns: [
        /\bensurePgvector\b/i,
        /\bpgvector\b/i,
        /create\s+extension\s+if\s+not\s+exists\s+["']?vector["']?/i,
        /\bvector\s*\(/i,
        /::vector\b/i,
      ],
    },
    {
      capability: 'pg_trgm',
      patterns: [
        /create\s+extension\s+if\s+not\s+exists\s+["']?pg_trgm["']?/i,
        /\bgin_trgm_ops\b/i,
        /\bsimilarity\s*\(/i,
      ],
    },
  ];

  for (const detector of detectors) {
    if (
      !inferred.includes(detector.capability) &&
      detector.patterns.some((pattern) => pattern.test(inspectionText))
    ) {
      inferred.push(detector.capability);
    }
  }

  return normalizeDatabaseCapabilities(inferred);
}

export function inferSchemaConfig(
  automation: RepoAutomationContextLike,
  databaseType: typeof databases.$inferSelect.type
): {
  comment: string;
  source: 'atlas' | 'drizzle' | 'prisma' | 'knex' | 'typeorm' | 'custom';
  config?: string;
  executionMode: 'automatic' | 'external';
  approvalPolicy?: 'manual_in_production';
} | null {
  if (!supportsGeneratedMigration(databaseType) || automation.monorepoType !== 'none') {
    return null;
  }

  const scripts = automation.packageJson?.scripts ?? {};
  const source = detectMigrationTool(automation);
  const configPath = inferSchemaConfigPath(automation, source);
  const executionTool = resolveExecutionToolForSchemaSource(source, databaseType);
  const canPlatformManage = isPlatformManagedMigrationTool(executionTool, databaseType);
  const hasAtlasConfig =
    source === 'atlas' && Boolean(automation.atlasConfigPath || automation.atlasConfigContent);
  const inferredScriptName = managedMigrationScriptNames.find((scriptName) =>
    Boolean(scripts[scriptName]?.trim())
  );

  if (hasAtlasConfig) {
    return {
      comment: canPlatformManage
        ? 'Auto-detected from atlas.hcl'
        : 'Auto-detected from atlas.hcl; platform keeps this schema source in external mode',
      source,
      ...(configPath ? { config: configPath } : {}),
      executionMode: canPlatformManage ? 'automatic' : 'external',
      ...(canPlatformManage ? { approvalPolicy: 'manual_in_production' as const } : {}),
    };
  }

  if (inferredScriptName) {
    return {
      comment: canPlatformManage
        ? `Auto-generated from package.json script ${inferredScriptName}`
        : `Auto-detected from package.json script ${inferredScriptName}; platform keeps this schema source in external mode`,
      source,
      ...(configPath ? { config: configPath } : {}),
      executionMode: canPlatformManage ? 'automatic' : 'external',
      ...(canPlatformManage ? { approvalPolicy: 'manual_in_production' as const } : {}),
    };
  }

  return null;
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

function resolveMonorepoAffectedRules(
  project: Pick<typeof projects.$inferSelect, 'configJson'>,
  automation: RepoAutomationContextLike
): Required<MonorepoAffectedRules> {
  const configured = getProjectMonorepoConfig(project)?.affected;
  const inferredInputs = automation.monorepoType === 'turborepo' ? ['packages/**'] : [];

  return {
    strategy: configured?.strategy ?? (automation.monorepoType === 'turborepo' ? 'turbo' : 'all'),
    global: uniqueStrings([...(configured?.global ?? []), ...defaultMonorepoGlobalInputs]),
    inputs: uniqueStrings(configured?.inputs ?? inferredInputs),
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
    '# deliverables are customer-downloadable artifacts extracted from verified service images.',
    '# Uncomment this section when the image contains SDKs, offline assets, or bare-metal bundles.',
    '# deliverables:',
    '#   # name is the product name shown on the Release detail download list.',
    '#   - name: app-baremetal',
    '#     type: baremetal',
    '#     source:',
    '#       # service binds this artifact to the verified deployable image used by the Release.',
    '#       service: web',
    '#     variants:',
    '#       - name: linux-amd64',
    '#         platform: linux/amd64',
    '#         # extract copies files out of the verified image digest; no second source build runs.',
    '#         extract:',
    '#           from: /app/dist',
    '#           to: .',
    '#         package:',
    '#           format: tar.gz',
    '#         checks:',
    '#           - command: test -n "$(find "$JUANIE_ARTIFACT_STAGE" -mindepth 1 -print -quit)"',
  ];
}

function buildConfiguredDeliverablesLines(deliverables: ProjectConfigDeliverableEntry[]): string[] {
  if (deliverables.length === 0) {
    return buildDeliverablesReferenceLines();
  }

  const lines = [
    '',
    '# deliverables are customer-downloadable artifacts extracted from verified service images.',
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
        '    # monorepo.appDir is only used for affected-file detection; extraction reads the image.',
        '    monorepo:',
        `      appDir: ${deliverable.monorepo.appDir}`
      );
    }

    if (deliverable.source?.service) {
      lines.push(
        '    # source.service binds this artifact to a verified deployable service image.',
        '    source:',
        `      service: ${deliverable.source.service}`
      );
    }

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
        '        # extract copies files from the verified image digest into the package stage.',
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
    '# Keep runtime services under services; put customer-downloadable packages under deliverables.',
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
      '    # strategy turbo uses Turborepo/workspace knowledge plus the rules below.',
      `    strategy: ${monorepoAffected.strategy}`,
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

/**
 * Push CI/CD configuration files to the repository.
 * This step is called during project import flow.
 */
async function pushCicdConfig(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  onProgress?: StepProgressReporter
) {
  const scopedLogger = projectInitLogger.child({
    projectId: project.id,
    step: 'push_cicd_config',
  });
  scopedLogger.info('Pushing Juanie CI/CD config', { projectName: project.name });
  await onProgress?.(5, '准备注入 Juanie CI/CD 配置');

  if (!project.repository) {
    scopedLogger.warn('No repository linked, skipping CI/CD config');
    await onProgress?.(100, '项目还没有仓库，跳过 CI/CD 注入');
    return;
  }

  const repository = project.repository;
  const targetBranch = getProjectProductionBranch(project);

  // Obtain integration session with required capabilities
  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('push_cicd_config'),
  });

  let monorepoType: MonorepoType = 'none';
  let rootFiles: string[] = [];
  let bakeDefinition: string | null = null;
  let bakeTargets: string[] = [];
  let atlasConfigPath: string | null = null;
  let atlasConfigContent: string | null = null;
  const atlasSchemaContents: Record<string, string> = {};
  const migrationScriptContents: Record<string, string> = {};
  let packageJson: RepoAutomationContext['packageJson'] = null;
  let topologyServices: RepositoryTopologyService[] = [];
  let configMonorepo: ProjectConfigMonorepoEntry | null = null;
  let configDeliverables: ProjectConfigDeliverableEntry[] = [];
  let managedJuanieConfigContent: string | null = null;

  try {
    await onProgress?.(20, '扫描仓库根目录与构建入口');
    const topology = await inspectRepositoryTopology(
      {
        listRootFiles: (repo, ref) => gateway.listRootFiles(session, repo, ref),
        getFileContent: (repo, path, ref) => gateway.getFileContent(session, repo, path, ref),
        listDirectory: (repo, path, ref) => gateway.listDirectory(session, repo, path, ref),
      },
      repository.fullName,
      targetBranch
    );

    rootFiles = topology.rootFiles;
    monorepoType = topology.monorepoType;
    bakeDefinition = topology.bakeDefinitionPath;
    bakeTargets = topology.bakeTargets;
    packageJson = topology.rootPackageJson;
    topologyServices = topology.services;
    configMonorepo = topology.configMonorepo
      ? {
          enabled: topology.monorepoType !== 'none',
          type: topology.configMonorepo.type,
          packageManager: topology.configMonorepo.packageManager,
          affected: topology.configMonorepo.affected,
        }
      : null;
    configDeliverables = topology.configDeliverables ?? [];
    managedJuanieConfigContent = topology.managedConfigContent ?? null;
    scopedLogger.info('Detected repository topology for CI/CD config', {
      monorepoType,
      repositoryFullName: repository.fullName,
    });

    if (!packageJson && rootFiles.includes('package.json')) {
      try {
        await onProgress?.(35, '读取 package.json 分析运行时');
        const packageJsonContent = await gateway.getFileContent(
          session,
          repository.fullName,
          'package.json',
          targetBranch
        );
        packageJson = packageJsonContent ? JSON.parse(packageJsonContent) : null;
      } catch (error) {
        scopedLogger.warn('Failed to parse package.json, falling back to migration skeleton', {
          repositoryFullName: repository.fullName,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (rootFiles.includes('atlas.hcl')) {
      atlasConfigPath = 'atlas.hcl';

      try {
        atlasConfigContent = await gateway.getFileContent(
          session,
          repository.fullName,
          atlasConfigPath,
          targetBranch
        );

        if (atlasConfigContent) {
          for (const sourcePath of extractAtlasSchemaSourcePaths(atlasConfigContent)) {
            try {
              const content = await gateway.getFileContent(
                session,
                repository.fullName,
                sourcePath,
                targetBranch
              );

              if (content) {
                atlasSchemaContents[sourcePath] = content;
              }
            } catch (error) {
              scopedLogger.warn(
                'Failed to inspect Atlas schema source while inferring capabilities',
                {
                  repositoryFullName: repository.fullName,
                  sourcePath,
                  errorMessage: error instanceof Error ? error.message : String(error),
                }
              );
            }
          }
        }
      } catch (error) {
        scopedLogger.warn('Failed to read atlas.hcl while inferring migrations', {
          repositoryFullName: repository.fullName,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (const scriptPath of resolveManagedMigrationScriptPaths(packageJson)) {
      try {
        const content = await gateway.getFileContent(
          session,
          repository.fullName,
          scriptPath,
          targetBranch
        );

        if (content) {
          migrationScriptContents[scriptPath] = content;
        }
      } catch (error) {
        scopedLogger.warn('Failed to inspect migration script while inferring tool', {
          repositoryFullName: repository.fullName,
          scriptPath,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (bakeDefinition) {
      try {
        await onProgress?.(50, '分析 docker-bake 定义');
        const bakeContent = await gateway.getFileContent(
          session,
          repository.fullName,
          bakeDefinition,
          targetBranch
        );
        if (bakeContent) {
          bakeTargets = parseDockerBakeTargets(bakeContent);
        }
      } catch (error) {
        scopedLogger.warn('Failed to inspect docker-bake definition, continuing without targets', {
          repositoryFullName: repository.fullName,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    scopedLogger.warn('Failed to inspect repository root, falling back to generated skeleton', {
      repositoryFullName: repository.fullName,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }

  await onProgress?.(65, '生成 Juanie 配置文件');
  const [serviceList, databaseList] = await Promise.all([
    db.query.services.findMany({
      where: eq(services.projectId, project.id),
      orderBy: (service, { asc }) => [asc(service.createdAt)],
    }),
    db.query.databases.findMany({
      where: eq(databases.projectId, project.id),
      orderBy: (database, { asc }) => [asc(database.createdAt)],
    }),
  ]);

  const renderContext: ProjectInitRenderContext = {
    services: serviceList,
    databases: databaseList,
  };
  const existingConfig = getProjectConfigJson(project);
  const existingServiceConfigMap = getProjectServiceConfigMap(project);
  const nextServiceConfigMap = { ...existingServiceConfigMap };
  for (const service of topologyServices) {
    nextServiceConfigMap[service.name] = {
      ...(existingServiceConfigMap[service.name] ?? {}),
      ...(service.appDir && service.appDir !== '.' ? { monorepo: { appDir: service.appDir } } : {}),
      ...(service.runtime ? { runtime: service.runtime } : {}),
      ...(service.build ? { build: service.build } : {}),
    };
  }
  const projectWithTopology = {
    ...project,
    configJson: {
      ...existingConfig,
      services: nextServiceConfigMap,
      ...(configMonorepo ? { monorepo: configMonorepo } : {}),
      ...(configDeliverables.length > 0 ? { deliverables: configDeliverables } : {}),
    },
  };
  const automationContext: RepoAutomationContext = {
    monorepoType,
    rootFiles,
    packageManager: detectPackageManager(rootFiles, packageJson),
    bakeDefinition,
    bakeTargets,
    atlasConfigPath,
    atlasConfigContent,
    atlasSchemaContents,
    migrationScriptContents,
    packageJson,
  };
  const files: Record<string, string> = {};

  const isMonorepo = monorepoType !== 'none';
  if (session.provider === 'github') {
    const ciTemplate = isMonorepo
      ? renderGitHubCIMonorepo(projectWithTopology, serviceList)
      : renderGitHubCI(project, renderContext);
    files['.github/workflows/juanie-ci.yml'] = ciTemplate;
  } else if (session.provider === 'gitlab' || session.provider === 'gitlab-self-hosted') {
    const ciTemplate = isMonorepo
      ? renderGitLabCIMonorepo(projectWithTopology, serviceList)
      : renderGitLabCI(project, renderContext);
    files['.gitlab-ci.yml'] = ciTemplate;
  }

  files['juanie.yaml'] =
    managedJuanieConfigContent ??
    renderJuanieConfig(projectWithTopology, renderContext, automationContext);

  const envTemplate = await renderEnvTemplate(project);
  files['.env.juanie.example'] = envTemplate;
  files[JUANIE_MANAGED_DOC_PATH] = renderJuanieManagedDoc(project, session.provider);
  files[JUANIE_BUILD_RUN_SCRIPT_PATH] = renderBuildRunScript();
  files[JUANIE_DELIVERY_SCRIPT_PATH] = renderDeliveryArtifactsScript();

  if (Object.keys(files).length > 0) {
    await onProgress?.(90, '推送 Juanie 配置到仓库');
    await gateway.pushFiles(session, {
      repoFullName: repository.fullName,
      branch: targetBranch,
      files,
      message: 'Configure Juanie CI/CD [skip ci]',
    });
  }

  await db
    .update(projects)
    .set({
      configJson: {
        ...existingConfig,
        services: nextServiceConfigMap,
        monorepo: {
          ...(configMonorepo ?? {}),
          enabled: isMonorepo,
          type: monorepoType,
          packageManager: detectPackageManager(rootFiles, packageJson),
          affected: resolveMonorepoAffectedRules(projectWithTopology, automationContext),
        },
        ...(configDeliverables.length > 0 ? { deliverables: configDeliverables } : {}),
      },
    })
    .where(eq(projects.id, project.id));

  await onProgress?.(100, 'Juanie CI/CD 配置已注入');
  scopedLogger.info('Pushed Juanie CI/CD config', {
    monorepoType: isMonorepo ? monorepoType : 'none',
    repositoryFullName: repository.fullName,
  });
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

function renderDeliveryArtifactsScript(): string {
  const templatePath = join(TEMPLATES_DIR, 'ci', 'delivery-artifacts.sh');

  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf-8');
  }

  throw new Error(
    `Delivery artifact script template file not found at ${templatePath}. Ensure templates are bundled correctly.`
  );
}

function renderBuildRunScript(): string {
  const templatePath = join(TEMPLATES_DIR, 'ci', 'build-run.sh');

  if (existsSync(templatePath)) {
    return readFileSync(templatePath, 'utf-8');
  }

  throw new Error(
    `Build run script template file not found at ${templatePath}. Ensure templates are bundled correctly.`
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
  sourceService?: string;
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
  return getProjectDeliverablesConfig(project).flatMap((deliverable) =>
    deliverable.variants.map((variant) => ({
      name: deliverable.name,
      type: deliverable.type,
      appDir: deliverable.monorepo?.appDir ?? '.',
      sourceService: deliverable.source?.service,
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
    }))
  );
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
  const sourceServicesForDeliverables = new Set(
    selectedDeliverables.map((deliverable) => deliverable.sourceService).filter(Boolean)
  );
  const selectedServices = input.shouldBuildAll
    ? input.services
    : input.services.filter(
        (service) =>
          sourceServicesForDeliverables.has(service.name) ||
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
  const rules: Required<MonorepoAffectedRules> = {
    strategy: configured?.strategy ?? 'turbo',
    global: uniqueStrings([...(configured?.global ?? []), ...defaultMonorepoGlobalInputs]),
    inputs: uniqueStrings(configured?.inputs ?? ['packages/**']),
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

async function renderEnvTemplate(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  }
): Promise<string> {
  const templatePath = join(TEMPLATES_DIR, 'env', '.env.juanie.example');

  if (existsSync(templatePath)) {
    let content = readFileSync(templatePath, 'utf-8');
    content = content
      .replace(/\{\{PROJECT_NAME\}\}/g, project.name)
      .replace(/\{\{PROJECT_SLUG\}\}/g, project.slug);
    return content;
  }

  // Dynamically build template based on project's configured databases
  const dbList = await db.query.databases.findMany({
    where: eq(databases.projectId, project.id),
  });

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

  for (const db_ of dbList) {
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

function renderJuanieManagedDoc(
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

/**
 * Configure the release trigger metadata Juanie needs after project bootstrap.
 * Deployments are triggered by Juanie release creation through managed CI.
 */
async function configureReleaseTrigger(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  onProgress?: StepProgressReporter
) {
  const scopedLogger = projectInitLogger.child({
    projectId: project.id,
    step: 'configure_release_trigger',
  });
  scopedLogger.info('Configuring release trigger for project', { projectName: project.name });
  await onProgress?.(20, '准备发布触发配置');

  const repository = project.repository;

  if (!repository) {
    scopedLogger.warn('No repository linked, skipping release trigger configuration');
    await onProgress?.(100, '项目还没有仓库，跳过发布触发配置');
    return;
  }

  // Update project config with image name
  const config = (project.configJson as Record<string, unknown>) || {};
  await onProgress?.(60, '计算镜像仓库地址');
  const imageName = resolveDeployImageRepository({
    configJson: project.configJson,
    repositoryFullName: repository.fullName,
  });

  if (!imageName) {
    throw new Error(`Cannot resolve deploy image repository for ${repository.fullName}`);
  }

  await db
    .update(projects)
    .set({
      configJson: {
        ...config,
        imageName,
        releaseTriggerConfigured: true,
      },
    })
    .where(eq(projects.id, project.id));

  await onProgress?.(100, '发布触发配置完成');
  scopedLogger.info('Configured release trigger for repository', {
    repositoryFullName: repository.fullName,
    imageName,
  });
}

async function triggerInitialAutoDeployBuilds(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  onProgress?: StepProgressReporter
): Promise<void> {
  const repository = project.repository;

  if (!repository?.fullName || !repository.providerId) {
    await onProgress?.(100, '项目还没有仓库，跳过首发构建触发');
    return;
  }

  const environmentList = await db.query.environments.findMany({
    where: eq(environments.projectId, project.id),
    orderBy: (environment, { asc }) => [asc(environment.createdAt)],
  });
  const refs = resolveInitialAutoDeployRefs(environmentList);

  if (refs.length === 0) {
    await onProgress?.(100, '没有需要触发的首发构建');
    return;
  }

  const scopedLogger = projectInitLogger.child({
    projectId: project.id,
    step: 'trigger_initial_auto_deploy_builds',
    repositoryFullName: repository.fullName,
  });

  const session = await getTeamIntegrationSession({
    integrationId: repository.providerId,
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('trigger_initial_builds'),
  });

  const triggeredRefs: string[] = [];
  const missingRefs: string[] = [];

  for (let index = 0; index < refs.length; index += 1) {
    const ref = refs[index];
    const matchedEnvironments = resolveInitialAutoDeployEnvironmentsForRef(environmentList, ref);
    await onProgress?.(
      Math.round((index / refs.length) * 90),
      `检查 ${ref.replace(/^refs\/heads\//, '')} 最新提交`
    );

    const sourceCommitSha = await gateway.resolveRefToCommitSha(session, repository.fullName, ref);

    if (!sourceCommitSha) {
      missingRefs.push(ref);
      scopedLogger.warn('Skipping missing initial auto-deploy branch', {
        ref,
      });
      continue;
    }

    const buildStartedAt = new Date();
    await Promise.all(
      matchedEnvironments.map((environment) =>
        setEnvironmentSourceBuildState({
          environmentId: environment.id,
          status: 'building',
          sourceRef: ref,
          sourceCommitSha,
          startedAt: buildStartedAt,
        })
      )
    );

    try {
      await gateway.triggerReleaseBuild(session, {
        repoFullName: repository.fullName,
        ref,
        releaseRef: ref,
        sourceCommitSha,
        forceFullBuild: true,
      });
    } catch (error) {
      await Promise.all(
        matchedEnvironments.map((environment) =>
          setEnvironmentSourceBuildState({
            environmentId: environment.id,
            status: 'failed',
            sourceRef: ref,
            sourceCommitSha,
            startedAt: buildStartedAt,
          })
        )
      );
      throw error;
    }
    triggeredRefs.push(ref);

    scopedLogger.info('Triggered initial auto-deploy build', {
      ref,
      sourceCommitSha,
    });
  }

  await onProgress?.(
    100,
    buildInitialAutoDeploySummary({
      refs,
      triggeredRefs,
      missingRefs,
    })
  );
}

async function setupNamespace(
  project: typeof projects.$inferSelect,
  onProgress?: StepProgressReporter
) {
  const envList = await db.query.environments.findMany({
    where: eq(environments.projectId, project.id),
  });

  if (envList.length === 0) {
    await onProgress?.(100, '没有需要创建的命名空间');
    return;
  }

  for (let index = 0; index < envList.length; index += 1) {
    const environment = envList[index];
    const namespace = await ensureEnvironmentNamespace({
      projectSlug: project.slug,
      environment: {
        id: environment.id,
        name: environment.name,
        namespace: environment.namespace,
        kind: environment.kind,
        isProduction: environment.isProduction,
        isPreview: environment.isPreview,
      },
    });

    await syncEnvVarsToK8s(project.id, environment.id).catch((error) =>
      projectInitLogger.warn('Failed to sync initial project variables to Kubernetes', {
        projectId: project.id,
        step: 'setup_namespace',
        environmentId: environment.id,
        namespace,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    );

    await onProgress?.(
      Math.round(((index + 1) / envList.length) * 100),
      `已登记 ${environment.name} 环境命名空间 ${namespace}`
    );
  }
}

async function deployServices(
  project: typeof projects.$inferSelect,
  hasK8s: boolean,
  onProgress?: StepProgressReporter
) {
  const serviceList = await db.query.services.findMany({
    where: eq(services.projectId, project.id),
  });
  const environmentList = await db.query.environments.findMany({
    where: eq(environments.projectId, project.id),
  });

  if (!hasK8s) {
    projectInitLogger.warn('Skipping service deployment because Kubernetes is unavailable', {
      projectId: project.id,
      step: 'deploy_services',
    });
    await onProgress?.(100, '当前没有可用 Kubernetes，已跳过服务初始化');
    return;
  }

  if (serviceList.length === 0 || environmentList.length === 0) {
    await onProgress?.(100, '没有需要初始化的服务');
    return;
  }

  for (let i = 0; i < environmentList.length; i++) {
    const environment = environmentList[i];

    await reconcileEnvironmentState({
      project: {
        id: project.id,
        slug: project.slug,
        configJson: project.configJson,
      },
      environment: {
        id: environment.id,
        name: environment.name,
        namespace: environment.namespace,
        kind: environment.kind,
        isProduction: environment.isProduction,
        isPreview: environment.isPreview,
        deploymentStrategy: environment.deploymentStrategy,
      },
      services: serviceList,
      scope: 'runtime',
    });

    // Namespace is created during reconcileEnvironmentState. Sync env vars afterwards so
    // project-level variables and provisioned database credentials are present for first deploy.
    await syncEnvVarsToK8s(project.id, environment.id).catch((error) =>
      projectInitLogger.warn('Failed to sync environment variables after namespace creation', {
        projectId: project.id,
        step: 'deploy_services',
        environmentId: environment.id,
        namespace: environment.namespace,
        errorMessage: error instanceof Error ? error.message : String(error),
      })
    );

    await onProgress?.(
      Math.round(((i + 1) / environmentList.length) * 100),
      `已确保 ${environment.name} 环境基础服务`
    );
  }

  await db
    .update(services)
    .set({ status: 'pending', updatedAt: new Date() })
    .where(eq(services.projectId, project.id));
}

async function provisionDatabases(
  project: typeof projects.$inferSelect,
  hasK8s: boolean,
  onProgress?: StepProgressReporter
) {
  const databaseList = await db.query.databases.findMany({
    where: eq(databases.projectId, project.id),
  });

  if (databaseList.length === 0) {
    await onProgress?.(100, '没有需要创建的数据库');
    return;
  }

  for (let i = 0; i < databaseList.length; i++) {
    const database = databaseList[i];
    await provisionDatabase(database, project, hasK8s);
    // Re-fetch updated record (connectionString now set) and inject env vars
    const updated = await db.query.databases.findFirst({
      where: eq(databases.id, database.id),
    });
    if (updated?.connectionString) {
      // Scope env vars to the database's environment (null = project-scoped)
      await injectDatabaseEnvVars(updated, project, updated.environmentId ?? null);
    }
    // Reserve last 10% for K8s sync
    await onProgress?.(
      Math.round(((i + 1) / databaseList.length) * 90),
      `数据库 ${database.name} 已完成供应`
    );
  }

  // Sync all injected env vars to K8s ConfigMap/Secret for each affected environment
  if (hasK8s) {
    const affectedEnvIds = [
      ...new Set(databaseList.map((d) => d.environmentId).filter(Boolean) as string[]),
    ];
    for (const envId of affectedEnvIds) {
      await syncEnvVarsToK8s(project.id, envId).catch((e) =>
        projectInitLogger.warn('Failed to sync environment variables to Kubernetes', {
          projectId: project.id,
          step: 'provision_databases',
          environmentId: envId,
          errorMessage: e instanceof Error ? e.message : String(e),
        })
      );
    }
  }

  await onProgress?.(100, '数据库配置与环境变量同步完成');
}

async function configureDns(
  project: typeof projects.$inferSelect,
  hasK8s: boolean,
  onProgress?: StepProgressReporter
) {
  const serviceList = await db.query.services.findMany({
    where: eq(services.projectId, project.id),
  });
  const environmentList = await db.query.environments.findMany({
    where: eq(environments.projectId, project.id),
  });
  const domainList = await db.query.domains.findMany({
    where: eq(domains.projectId, project.id),
    columns: {
      environmentId: true,
    },
  });
  const domainEnvironmentIds = new Set(
    domainList
      .map((domain) => domain.environmentId)
      .filter((value): value is string => Boolean(value))
  );
  const targetEnvironments = environmentList.filter(
    (environment) => environment.kind === 'preview' || domainEnvironmentIds.has(environment.id)
  );

  if (targetEnvironments.length === 0) {
    await onProgress?.(100, '没有需要配置的域名');
    return;
  }

  if (!hasK8s) {
    await onProgress?.(100, '当前没有可用 Kubernetes，已跳过域名配置');
    return;
  }

  for (let i = 0; i < targetEnvironments.length; i++) {
    const environment = targetEnvironments[i];

    await reconcileEnvironmentState({
      project: {
        id: project.id,
        slug: project.slug,
        configJson: project.configJson,
      },
      environment: {
        id: environment.id,
        name: environment.name,
        namespace: environment.namespace,
        kind: environment.kind,
        isPreview: environment.isPreview,
        deploymentStrategy: environment.deploymentStrategy,
      },
      services: serviceList,
      scope: 'access',
    });

    await onProgress?.(
      Math.round(((i + 1) / targetEnvironments.length) * 100),
      `已确保 ${environment.name} 环境域名与路由`
    );
  }
}

export function createProjectInitWorker() {
  return new Worker<ProjectInitJobData>('project-init', processProjectInit, {
    connection: resolveRedisConnectionOptions({
      maxRetriesPerRequest: null,
    }),
    concurrency: 5,
  });
}
