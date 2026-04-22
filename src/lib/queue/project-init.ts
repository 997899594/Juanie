import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Job, Worker } from 'bullmq';
import { and, eq, inArray, isNull } from 'drizzle-orm';
import { encrypt } from '@/lib/crypto';
import {
  type DatabaseCapability,
  normalizeDatabaseCapabilities,
} from '@/lib/databases/capabilities';
import { supportsDatabaseAutomatedMigrations } from '@/lib/databases/platform-support';
import { provisionManagedDatabase } from '@/lib/databases/provider';
import { db } from '@/lib/db';
import {
  databases,
  domains,
  environments,
  environmentVariables,
  projectInitSteps,
  projects,
  repositories,
  services,
  teams,
} from '@/lib/db/schema';
import { resolveDeployImageRepository } from '@/lib/deploy-images';
import { syncEnvVarsToK8s } from '@/lib/env-sync';
import { ensureEnvironmentNamespace, reconcileEnvironmentState } from '@/lib/environments/service';
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
  resolveExecutionToolForSchemaSource,
} from '@/lib/migrations/schema-source';
import { buildSchemaContractCommentLines } from '@/lib/migrations/strategy';
import type { MonorepoType } from '@/lib/monorepo';
import { detectMonorepoType } from '@/lib/monorepo';
import { publishProjectInitRealtimeEvent } from '@/lib/realtime/project-init';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';
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
    },
  });
}

type ProjectInitProjectRecord = NonNullable<Awaited<ReturnType<typeof loadProjectInitProject>>>;

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

      if (!autoRetryPending) {
        job.discard();
      }
      throw error;
    }
  }

  await db.update(projects).set({ status: 'active' }).where(eq(projects.id, projectId));
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

  if (!project.repository) {
    scopedLogger.warn('No repository linked');
    if (isDev) {
      scopedLogger.info('Skipping repository validation in development mode');
      await onProgress?.(100, '开发模式下跳过仓库校验');
      return;
    }
    throw new Error('No repository linked to project');
  }

  scopedLogger.info('Validating repository access', {
    repositoryFullName: project.repository.fullName,
  });
  await onProgress?.(45, '验证团队仓库授权');

  // Obtain integration session with required capability
  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('validate_repository'),
  });

  await onProgress?.(80, '读取仓库元数据');
  const repo = await gateway.getRepository(session, project.repository.fullName);
  scopedLogger.info('Resolved repository access', {
    repositoryFullName: project.repository.fullName,
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

  if (!project.repository) {
    throw new Error('Project has no repository');
  }

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
    teamName:
      (await db.query.teams.findFirst({ where: eq(teams.id, project.teamId) }))?.name || 'Team',
    description: project.description || '',
  }).renderToMemory();

  await onProgress?.(85, '推送模板到仓库');
  await gateway.pushFiles(session, {
    repoFullName: project.repository.fullName,
    branch: project.productionBranch || 'main',
    files: Object.fromEntries(files),
    message: 'Initial commit from Juanie template',
  });

  await onProgress?.(100, '模板已推送');
  scopedLogger.info('Pushed template files to repository', {
    fileCount: files.size,
    repositoryFullName: project.repository.fullName,
  });
}

// ============================================
// CI/CD Config Functions
// ============================================

const TEMPLATES_DIR = join(process.cwd(), 'templates');

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

function supportsGeneratedMigration(dbType: typeof databases.$inferSelect.type): boolean {
  return supportsDatabaseAutomatedMigrations(dbType);
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

const managedMigrationScriptNames = ['db:migrate', 'db:deploy'] as const;

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
    const candidates = [
      'drizzle.config.ts',
      'drizzle.config.mjs',
      'drizzle.config.js',
      'drizzle.config.cjs',
    ];
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

  if (scripts['db:migrate']) {
    return {
      comment: canPlatformManage
        ? 'Auto-generated from package.json script db:migrate'
        : 'Auto-detected from package.json script db:migrate; platform keeps this schema source in external mode',
      source,
      ...(configPath ? { config: configPath } : {}),
      executionMode: canPlatformManage ? 'automatic' : 'external',
      ...(canPlatformManage ? { approvalPolicy: 'manual_in_production' as const } : {}),
    };
  }

  if (scripts['db:deploy']) {
    return {
      comment: canPlatformManage
        ? 'Auto-generated from package.json script db:deploy'
        : 'Auto-detected from package.json script db:deploy; platform keeps this schema source in external mode',
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
  automation: RepoAutomationContextLike
): string[] {
  const lines = ['    build:'];
  const buildCommand = service.buildCommand ?? 'npm run build';
  const dockerContext = service.dockerContext ?? '.';
  const dockerfile = service.dockerfile?.trim();
  const bakeDefinition = automation.bakeDefinition ?? null;
  const bakeTarget =
    automation.monorepoType === 'none' ? resolveBakeTarget(service, automation) : null;

  lines.push(`      command: ${buildCommand}`);

  if (bakeDefinition) {
    lines.push(
      '      strategy: bake',
      `      definition: ${bakeDefinition}`,
      `      context: ${dockerContext}`
    );

    if (bakeTarget) {
      lines.push(`      target: ${bakeTarget}`);
    }

    if (dockerfile) {
      lines.push(`      dockerfile: ${dockerfile}`);
    }

    return lines;
  }

  if (dockerfile) {
    lines.push(
      '      strategy: dockerfile',
      `      dockerfile: ${dockerfile}`,
      `      context: ${dockerContext}`
    );
    return lines;
  }

  lines.push('      strategy: buildpacks', `      context: ${dockerContext}`);
  return lines;
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

export function renderJuanieConfig(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  context: ProjectInitRenderContext,
  automation: RepoAutomationContextLike
): string {
  const lines: string[] = ['# juanie.yaml', `name: ${project.slug}`, '', 'services:'];

  for (const service of context.services) {
    const autoscaling =
      service.autoscaling &&
      typeof service.autoscaling === 'object' &&
      !Array.isArray(service.autoscaling)
        ? (service.autoscaling as { max?: number; cpu?: number })
        : null;

    lines.push(
      `  - name: ${service.name}`,
      `    type: ${service.type}`,
      ...buildServiceBuildLines(service, automation),
      '    run:',
      `      command: ${service.startCommand ?? 'npm start'}`
    );

    if (service.port) {
      lines.push(`      port: ${service.port}`);
    }

    const healthPath =
      service.healthcheckPath ?? (service.type === 'web' ? '/api/health' : '/health');
    lines.push(
      '    healthcheck:',
      `      path: ${healthPath}`,
      `      interval: ${service.healthcheckInterval ?? 30}`
    );

    lines.push(
      '    scaling:',
      `      min: ${service.replicas ?? 1}`,
      ...(autoscaling?.max ? [`      max: ${autoscaling.max}`] : []),
      ...(autoscaling?.cpu ? [`      cpu: ${autoscaling.cpu}`] : [])
    );

    lines.push(
      '    resources:',
      `      cpuRequest: ${service.cpuRequest ?? '100m'}`,
      `      cpuLimit: ${service.cpuLimit ?? '500m'}`,
      `      memoryRequest: ${service.memoryRequest ?? '256Mi'}`,
      `      memoryLimit: ${service.memoryLimit ?? '512Mi'}`
    );

    if (service.isPublic === false) {
      lines.push('    isPublic: false');
    }

    const migrationLines = buildServiceMigrationLines(
      service,
      context.services,
      context.databases,
      automation
    );
    if (migrationLines.length > 0) {
      lines.push(...migrationLines);
    }
  }

  if (context.databases.length > 0) {
    lines.push('', 'databases:');

    for (const database of context.databases) {
      const capabilities = inferDatabaseCapabilities(automation, database);
      lines.push(
        `  - name: ${database.name}`,
        `    type: ${database.type}`,
        `    plan: ${database.plan ?? 'starter'}`,
        `    scope: ${database.scope ?? (database.serviceId ? 'service' : 'project')}`,
        `    role: ${database.role ?? 'primary'}`
      );

      if (capabilities.length > 0) {
        lines.push(
          '    capabilities:',
          ...capabilities.map((capability) => `      - ${capability}`)
        );
      }
    }
  }

  lines.push(
    '',
    'environments:',
    '  production:',
    `    branch: ${project.productionBranch || 'main'}`,
    '  staging:',
    `    branch: ${project.productionBranch || 'main'}`
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

  // Obtain integration session with required capabilities
  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('push_cicd_config'),
  });

  // Detect monorepo type from repository root files using gateway
  let monorepoType: MonorepoType = 'none';
  let rootFiles: string[] = [];
  let bakeDefinition: string | null = null;
  let bakeTargets: string[] = [];
  let atlasConfigPath: string | null = null;
  let atlasConfigContent: string | null = null;
  const atlasSchemaContents: Record<string, string> = {};
  const migrationScriptContents: Record<string, string> = {};
  let packageJson: RepoAutomationContext['packageJson'] = null;

  try {
    await onProgress?.(20, '扫描仓库根目录与构建入口');
    rootFiles = await gateway.listRootFiles(
      session,
      project.repository.fullName,
      project.productionBranch || 'main'
    );
    monorepoType = detectMonorepoType(rootFiles);
    scopedLogger.info('Detected repository topology for CI/CD config', {
      monorepoType,
      repositoryFullName: project.repository.fullName,
    });

    if (rootFiles.includes('package.json')) {
      try {
        await onProgress?.(35, '读取 package.json 分析运行时');
        const packageJsonContent = await gateway.getFileContent(
          session,
          project.repository.fullName,
          'package.json',
          project.productionBranch || 'main'
        );
        packageJson = packageJsonContent ? JSON.parse(packageJsonContent) : null;
      } catch (error) {
        scopedLogger.warn('Failed to parse package.json, falling back to migration skeleton', {
          repositoryFullName: project.repository.fullName,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    if (rootFiles.includes('atlas.hcl')) {
      atlasConfigPath = 'atlas.hcl';

      try {
        atlasConfigContent = await gateway.getFileContent(
          session,
          project.repository.fullName,
          atlasConfigPath,
          project.productionBranch || 'main'
        );

        if (atlasConfigContent) {
          for (const sourcePath of extractAtlasSchemaSourcePaths(atlasConfigContent)) {
            try {
              const content = await gateway.getFileContent(
                session,
                project.repository.fullName,
                sourcePath,
                project.productionBranch || 'main'
              );

              if (content) {
                atlasSchemaContents[sourcePath] = content;
              }
            } catch (error) {
              scopedLogger.warn(
                'Failed to inspect Atlas schema source while inferring capabilities',
                {
                  repositoryFullName: project.repository.fullName,
                  sourcePath,
                  errorMessage: error instanceof Error ? error.message : String(error),
                }
              );
            }
          }
        }
      } catch (error) {
        scopedLogger.warn('Failed to read atlas.hcl while inferring migrations', {
          repositoryFullName: project.repository.fullName,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    for (const scriptPath of resolveManagedMigrationScriptPaths(packageJson)) {
      try {
        const content = await gateway.getFileContent(
          session,
          project.repository.fullName,
          scriptPath,
          project.productionBranch || 'main'
        );

        if (content) {
          migrationScriptContents[scriptPath] = content;
        }
      } catch (error) {
        scopedLogger.warn('Failed to inspect migration script while inferring tool', {
          repositoryFullName: project.repository.fullName,
          scriptPath,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }

    const bakeDefinitionPath = rootFiles.includes('docker-bake.hcl')
      ? 'docker-bake.hcl'
      : rootFiles.includes('docker-bake.json')
        ? 'docker-bake.json'
        : null;

    if (bakeDefinitionPath) {
      bakeDefinition = bakeDefinitionPath;

      try {
        await onProgress?.(50, '分析 docker-bake 定义');
        const bakeContent = await gateway.getFileContent(
          session,
          project.repository.fullName,
          bakeDefinitionPath,
          project.productionBranch || 'main'
        );
        if (bakeContent) {
          bakeTargets = parseDockerBakeTargets(bakeContent);
        }
      } catch (error) {
        scopedLogger.warn('Failed to inspect docker-bake definition, continuing without targets', {
          repositoryFullName: project.repository.fullName,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    }
  } catch (error) {
    scopedLogger.warn('Failed to inspect repository root, falling back to generated skeleton', {
      repositoryFullName: project.repository.fullName,
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
      ? renderGitHubCIMonorepo(project, monorepoType)
      : renderGitHubCI(project, renderContext);
    files['.github/workflows/juanie-ci.yml'] = ciTemplate;
  } else if (session.provider === 'gitlab' || session.provider === 'gitlab-self-hosted') {
    const ciTemplate = isMonorepo
      ? renderGitLabCIMonorepo(project, monorepoType)
      : renderGitLabCI(project, renderContext);
    files['.gitlab-ci.yml'] = ciTemplate;
  }

  files['juanie.yaml'] = renderJuanieConfig(project, renderContext, automationContext);

  const envTemplate = await renderEnvTemplate(project);
  files['.env.juanie.example'] = envTemplate;

  if (Object.keys(files).length > 0) {
    await onProgress?.(90, '推送 Juanie 配置到仓库');
    await gateway.pushFiles(session, {
      repoFullName: project.repository.fullName,
      branch: project.productionBranch || 'main',
      files,
      message: 'Configure Juanie CI/CD [skip ci]',
    });
  }

  const existingConfig = (project.configJson as Record<string, unknown>) || {};
  await db
    .update(projects)
    .set({
      configJson: {
        ...existingConfig,
        monorepo: {
          enabled: isMonorepo,
          type: monorepoType,
        },
      },
    })
    .where(eq(projects.id, project.id));

  await onProgress?.(100, 'Juanie CI/CD 配置已注入');
  scopedLogger.info('Pushed Juanie CI/CD config', {
    monorepoType: isMonorepo ? monorepoType : 'none',
    repositoryFullName: project.repository.fullName,
  });
}

function renderGitHubCI(
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

function renderGitLabCI(
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

function renderGitHubCIMonorepo(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  _monorepoType: MonorepoType
): string {
  const templatePath = join(TEMPLATES_DIR, 'ci', 'github-actions-monorepo.yml');

  if (existsSync(templatePath)) {
    let content = readFileSync(templatePath, 'utf-8');
    content = content
      .replace(/\{\{PROJECT_NAME\}\}/g, project.name)
      .replace(/\{\{PROJECT_SLUG\}\}/g, project.slug);
    return content;
  }

  // Fallback to inline template
  return `name: Juanie CI (Monorepo)

on:
  push:
    branches: [main, master]

env:
  IMAGE_REGISTRY: ghcr.io

jobs:
  detect:
    runs-on: ubuntu-latest
    outputs:
      services: \${{ steps.detect.outputs.services }}
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: oven-sh/setup-bun@v1

      - name: Setup Turborepo
        run: bun add -g turbo

      - name: Detect affected services
        id: detect
        run: |
          AFFECTED=$(turbo ls --filter="...[origin/main^1]" --json 2>/dev/null || echo '[]')
          echo "services=$AFFECTED" >> $GITHUB_OUTPUT

  build:
    needs: detect
    if: \${{ needs.detect.outputs.services != '[]' }}
    strategy:
      matrix:
        service: \${{ fromJson(needs.detect.outputs.services) }}
    runs-on: ubuntu-latest
    permissions:
      packages: write
    steps:
      - uses: actions/checkout@v4

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: \${{ env.IMAGE_REGISTRY }}
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and push \${{ matrix.service }}
        run: |
          export REGISTRY="\${{ env.IMAGE_REGISTRY }}"
          IMAGE_TAG=$REGISTRY/\${{ github.repository }}/\${{ matrix.service }}:sha-\${{ github.sha }}
          docker build -t $IMAGE_TAG -f apps/\${{ matrix.service }}/Dockerfile .
          docker push $IMAGE_TAG

      - name: Trigger Juanie Release
        if: success()
        run: |
          IMAGE_TAG=\${{ env.IMAGE_REGISTRY }}/\${{ github.repository }}/\${{ matrix.service }}:sha-\${{ github.sha }}
          RELEASE_RESPONSE_FILE=$(mktemp)
          RELEASE_STATUS=$(curl -sS -o "$RELEASE_RESPONSE_FILE" -w '%{http_code}' -X POST "https://juanie.art/api/releases" \
            -H "Content-Type: application/json" \
            -H "Authorization: Bearer \${{ secrets.GITHUB_TOKEN }}" \
            -d '{
              "repository": "\${{ github.repository }}",
              "sha": "\${{ github.sha }}",
              "ref": "\${{ github.ref }}",
              "services": [
                {
                  "name": "\${{ matrix.service }}",
                  "image": "'"$IMAGE_TAG"'"
                }
              ]
            }')
          RELEASE_RESPONSE=$(cat "$RELEASE_RESPONSE_FILE")
          rm -f "$RELEASE_RESPONSE_FILE"

          echo "$RELEASE_RESPONSE"

          if [ "$RELEASE_STATUS" -lt 200 ] || [ "$RELEASE_STATUS" -ge 300 ]; then
            echo "Juanie release request failed with HTTP $RELEASE_STATUS"
            exit 1
          fi

          RELEASE_ID=$(printf '%s' "$RELEASE_RESPONSE" | jq -r '.release.id')
          RELEASE_PATH=$(printf '%s' "$RELEASE_RESPONSE" | jq -r '.release.releasePath // empty')
          if [ -z "$RELEASE_ID" ] || [ "$RELEASE_ID" = "null" ]; then
            echo "Juanie did not return a release id"
            echo "$RELEASE_RESPONSE"
            exit 1
          fi

          for attempt in $(seq 1 180); do
            STATUS_RESPONSE=$(curl -fsS "https://juanie.art/api/releases/$RELEASE_ID/status" \
              -H "Authorization: Bearer \${{ secrets.GITHUB_TOKEN }}")

            RESOLUTION=$(printf '%s' "$STATUS_RESPONSE" | jq -r '.release.resolution')
            STATUS=$(printf '%s' "$STATUS_RESPONSE" | jq -r '.release.status')
            ERROR_MESSAGE=$(printf '%s' "$STATUS_RESPONSE" | jq -r '.release.error // empty')

            echo "Juanie release $RELEASE_ID: status=$STATUS"

            case "$RESOLUTION" in
              succeeded)
                exit 0
                ;;
              action_required)
                if [ -n "$RELEASE_PATH" ]; then
                  echo "Juanie release requires manual action: https://juanie.art$RELEASE_PATH"
                fi
                exit 0
                ;;
              failed)
                echo "Juanie release failed: \${ERROR_MESSAGE:-unknown error}"
                exit 1
                ;;
            esac

            sleep 10
          done

          echo "Timed out waiting for Juanie release $RELEASE_ID"
          exit 1
`;
}

function renderGitLabCIMonorepo(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  _monorepoType: MonorepoType
): string {
  const templatePath = join(TEMPLATES_DIR, 'ci', 'gitlab-ci-monorepo.yml');

  if (existsSync(templatePath)) {
    let content = readFileSync(templatePath, 'utf-8');
    content = content
      .replace(/\{\{PROJECT_NAME\}\}/g, project.name)
      .replace(/\{\{PROJECT_SLUG\}\}/g, project.slug);
    return content;
  }

  // Fallback to inline template
  return `stages:
  - detect
  - build

variables:
  REGISTRY: $CI_REGISTRY

detect:
  stage: detect
  image: oven/bun:1
  script:
    - bun add -g turbo
    - AFFECTED=$(turbo ls --filter="...[$CI_COMMIT_BEFORE_SHA]" --json 2>/dev/null || echo '[]')
    - echo "SERVICES=$AFFECTED" >> build.env
  artifacts:
    reports:
      dotenv: build.env

build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  before_script:
    - apk add --no-cache curl jq
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - |
      for SERVICE in $(echo $SERVICES | jq -r '.[]'); do
        IMAGE_TAG=$CI_REGISTRY_IMAGE/$SERVICE:sha-$CI_COMMIT_SHA
        docker build -t $IMAGE_TAG -f apps/$SERVICE/Dockerfile .
        docker push $IMAGE_TAG

        RELEASE_RESPONSE_FILE=$(mktemp)
        RELEASE_STATUS=$(curl -sS -o "$RELEASE_RESPONSE_FILE" -w '%{http_code}' -X POST "https://juanie.art/api/releases" \
          -H "Content-Type: application/json" \
          -H "Authorization: Bearer $CI_JOB_TOKEN" \
          -d "{
            \\"repository\\": \\"$CI_PROJECT_PATH\\",
            \\"sha\\": \\"$CI_COMMIT_SHA\\",
            \\"ref\\": \\"$CI_COMMIT_REF_NAME\\",
            \\"services\\": [
              {
                \\"name\\": \\"$SERVICE\\",
                \\"image\\": \\"$IMAGE_TAG\\"
              }
            ]
          }")
        RELEASE_RESPONSE=$(cat "$RELEASE_RESPONSE_FILE")
        rm -f "$RELEASE_RESPONSE_FILE"

        echo "$RELEASE_RESPONSE"

        if [ "$RELEASE_STATUS" -lt 200 ] || [ "$RELEASE_STATUS" -ge 300 ]; then
          echo "Juanie release request failed with HTTP $RELEASE_STATUS"
          exit 1
        fi

        RELEASE_ID=$(printf '%s' "$RELEASE_RESPONSE" | jq -r '.release.id')
        RELEASE_PATH=$(printf '%s' "$RELEASE_RESPONSE" | jq -r '.release.releasePath // empty')
        if [ -z "$RELEASE_ID" ] || [ "$RELEASE_ID" = "null" ]; then
          echo "Juanie did not return a release id"
          echo "$RELEASE_RESPONSE"
          exit 1
        fi

        for attempt in $(seq 1 180); do
          STATUS_RESPONSE=$(curl -fsS "https://juanie.art/api/releases/$RELEASE_ID/status" \
            -H "Authorization: Bearer $CI_JOB_TOKEN")

          RESOLUTION=$(printf '%s' "$STATUS_RESPONSE" | jq -r '.release.resolution')
          STATUS=$(printf '%s' "$STATUS_RESPONSE" | jq -r '.release.status')
          ERROR_MESSAGE=$(printf '%s' "$STATUS_RESPONSE" | jq -r '.release.error // empty')

          echo "Juanie release $RELEASE_ID: status=$STATUS"

          case "$RESOLUTION" in
            succeeded)
              break
              ;;
            action_required)
              if [ -n "$RELEASE_PATH" ]; then
                echo "Juanie release requires manual action: https://juanie.art$RELEASE_PATH"
              fi
              break
              ;;
            failed)
              echo "Juanie release failed: \${ERROR_MESSAGE:-unknown error}"
              exit 1
              ;;
          esac

          sleep 10
        done
      done
  rules:
    - if: $SERVICES != '[]'
`;
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

  if (!project.repository) {
    scopedLogger.warn('No repository linked, skipping release trigger configuration');
    await onProgress?.(100, '项目还没有仓库，跳过发布触发配置');
    return;
  }

  // Update project config with image name
  const config = (project.configJson as Record<string, unknown>) || {};
  await onProgress?.(60, '计算镜像仓库地址');
  const imageName = resolveDeployImageRepository({
    configJson: project.configJson,
    repositoryFullName: project.repository.fullName,
  });

  if (!imageName) {
    throw new Error(`Cannot resolve deploy image repository for ${project.repository.fullName}`);
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
    repositoryFullName: project.repository.fullName,
    imageName,
  });
}

export function resolveInitialAutoDeployRefs(
  environmentList: Array<{
    branch?: string | null;
    autoDeploy?: boolean | null;
    isPreview?: boolean | null;
  }>
): string[] {
  return Array.from(
    new Set(
      environmentList
        .filter((environment) => environment.autoDeploy && !environment.isPreview)
        .map((environment) => environment.branch?.trim())
        .filter((branch): branch is string => Boolean(branch))
        .map((branch) => (branch.startsWith('refs/heads/') ? branch : `refs/heads/${branch}`))
    )
  );
}

function formatInitialAutoDeployRefs(refs: string[]): string {
  return refs.map((ref) => ref.replace(/^refs\/heads\//, '')).join('、');
}

export function buildInitialAutoDeploySummary(input: {
  refs: string[];
  triggeredRefs: string[];
  missingRefs: string[];
}): string {
  if (input.refs.length === 0) {
    return '没有需要触发的首发构建';
  }

  const segments: string[] = [];

  if (input.triggeredRefs.length > 0) {
    segments.push(`已触发 ${input.triggeredRefs.length} 个首发构建`);
  }

  if (input.missingRefs.length > 0) {
    segments.push(`跳过不存在的分支：${formatInitialAutoDeployRefs(input.missingRefs)}`);
  }

  return segments.join('，') || '没有可触发的首发构建';
}

async function triggerInitialAutoDeployBuilds(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  onProgress?: StepProgressReporter
): Promise<void> {
  if (!project.repository?.fullName || !project.repository.providerId) {
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
    repositoryFullName: project.repository.fullName,
  });

  const session = await getTeamIntegrationSession({
    integrationId: project.repository.providerId,
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('trigger_initial_builds'),
  });

  const triggeredRefs: string[] = [];
  const missingRefs: string[] = [];

  for (let index = 0; index < refs.length; index += 1) {
    const ref = refs[index];
    await onProgress?.(
      Math.round((index / refs.length) * 90),
      `检查 ${ref.replace(/^refs\/heads\//, '')} 最新提交`
    );

    const sourceCommitSha = await gateway.resolveRefToCommitSha(
      session,
      project.repository.fullName,
      ref
    );

    if (!sourceCommitSha) {
      missingRefs.push(ref);
      scopedLogger.warn('Skipping missing initial auto-deploy branch', {
        ref,
      });
      continue;
    }

    await gateway.triggerReleaseBuild(session, {
      repoFullName: project.repository.fullName,
      ref,
      releaseRef: ref,
      sourceCommitSha,
      forceFullBuild: true,
    });
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

/**
 * Provision a single database based on its provisionType.
 * - shared: reuse Juanie's own PG/Redis infrastructure (independent DB/user per project)
 * - standalone: create isolated K8s StatefulSet/Deployment
 * - external: connection string already provided, just mark running
 */
export async function provisionDatabase(
  database: typeof databases.$inferSelect,
  project: typeof projects.$inferSelect,
  hasK8s: boolean
): Promise<void> {
  await provisionManagedDatabase({
    database,
    project,
    hasK8s,
  });
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

// ============================================
// Database Env Var Injection
// ============================================

/** Parse a postgres/mysql/redis/mongodb connection string into its components. */
function parseConnUrl(connStr: string): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  try {
    const url = new URL(connStr);
    return {
      host: url.hostname,
      port: url.port,
      user: url.username ? decodeURIComponent(url.username) : '',
      password: url.password ? decodeURIComponent(url.password) : '',
      database: url.pathname?.length > 1 ? url.pathname.slice(1) : '',
    };
  } catch {
    return { host: '', port: '', user: '', password: '', database: '' };
  }
}

/**
 * Keys whose values must be stored encrypted and synced to K8s Secret (not ConfigMap).
 */
const SENSITIVE_ENV_KEYS = new Set([
  'DATABASE_URL',
  'POSTGRES_PASSWORD',
  'REDIS_URL',
  'REDIS_PASSWORD',
  'MYSQL_URL',
  'MYSQL_PASSWORD',
  'MONGODB_URL',
  'MONGODB_PASSWORD',
]);

/**
 * Upsert an environment variable.
 *
 * @param environmentId  null → project-scoped (applies to all environments via env-sync merge)
 *                       string → scoped to a specific environment only
 * @param isSecret       override sensitivity; defaults to SENSITIVE_ENV_KEYS lookup
 */
async function upsertEnvVar(
  projectId: string,
  environmentId: string | null,
  key: string,
  value: string,
  isSecret?: boolean
): Promise<void> {
  const sensitive = isSecret ?? SENSITIVE_ENV_KEYS.has(key);
  const envIdClause = environmentId
    ? eq(environmentVariables.environmentId, environmentId)
    : isNull(environmentVariables.environmentId);

  const existing = await db.query.environmentVariables.findFirst({
    where: and(
      eq(environmentVariables.projectId, projectId),
      eq(environmentVariables.key, key),
      envIdClause,
      isNull(environmentVariables.serviceId)
    ),
  });

  if (sensitive) {
    const { encryptedValue, iv, authTag } = await encrypt(value);
    if (existing) {
      await db
        .update(environmentVariables)
        .set({ value: null, isSecret: true, encryptedValue, iv, authTag, updatedAt: new Date() })
        .where(eq(environmentVariables.id, existing.id));
    } else {
      await db.insert(environmentVariables).values({
        projectId,
        environmentId,
        key,
        value: null,
        isSecret: true,
        encryptedValue,
        iv,
        authTag,
        injectionType: 'runtime',
      });
    }
  } else {
    if (existing) {
      await db
        .update(environmentVariables)
        .set({ value, updatedAt: new Date() })
        .where(eq(environmentVariables.id, existing.id));
    } else {
      await db.insert(environmentVariables).values({
        projectId,
        environmentId,
        key,
        value,
        isSecret: false,
        injectionType: 'runtime',
      });
    }
  }
}

/**
 * Inject database connection info as environment variables.
 *
 * Naming convention matches renderEnvTemplate and common framework expectations:
 *   postgresql → DATABASE_URL, POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER,
 *                POSTGRES_PASSWORD, POSTGRES_DB
 *   redis      → REDIS_URL, REDIS_HOST, REDIS_PORT, REDIS_PASSWORD[, REDIS_DB]
 *   mysql      → MYSQL_URL, MYSQL_HOST, MYSQL_PORT, MYSQL_USER, MYSQL_PASSWORD, MYSQL_DATABASE
 *   mongodb    → MONGODB_URL, MONGODB_HOST, MONGODB_PORT, MONGODB_USER, MONGODB_PASSWORD, MONGODB_DATABASE
 *
 * @param environmentId  null = project-scoped (env-sync merges into every environment)
 *                       pass a specific env ID for per-environment isolation
 */
export async function injectDatabaseEnvVars(
  database: typeof databases.$inferSelect,
  project: typeof projects.$inferSelect,
  environmentId: string | null = null
): Promise<void> {
  if (!database.connectionString) return;

  const c = parseConnUrl(database.connectionString);
  const vars: Record<string, string> = {};

  switch (database.type) {
    case 'postgresql':
      vars['DATABASE_URL'] = database.connectionString;
      if (c.host) vars['POSTGRES_HOST'] = c.host;
      if (c.port) vars['POSTGRES_PORT'] = c.port;
      if (c.user) vars['POSTGRES_USER'] = c.user;
      if (c.password) vars['POSTGRES_PASSWORD'] = c.password;
      if (c.database) vars['POSTGRES_DB'] = c.database;
      break;
    case 'redis':
      vars['REDIS_URL'] = database.connectionString;
      if (c.host) vars['REDIS_HOST'] = c.host;
      if (c.port) vars['REDIS_PORT'] = c.port;
      if (c.password) vars['REDIS_PASSWORD'] = c.password;
      // db index only relevant for shared Redis (stored in pathname e.g. /1)
      if (c.database && c.database !== '0') vars['REDIS_DB'] = c.database;
      break;
    case 'mysql':
      vars['MYSQL_URL'] = database.connectionString;
      if (c.host) vars['MYSQL_HOST'] = c.host;
      if (c.port) vars['MYSQL_PORT'] = c.port;
      if (c.user) vars['MYSQL_USER'] = c.user;
      if (c.password) vars['MYSQL_PASSWORD'] = c.password;
      if (c.database) vars['MYSQL_DATABASE'] = c.database;
      break;
    case 'mongodb':
      vars['MONGODB_URL'] = database.connectionString;
      if (c.host) vars['MONGODB_HOST'] = c.host;
      if (c.port) vars['MONGODB_PORT'] = c.port;
      if (c.user) vars['MONGODB_USER'] = c.user;
      if (c.password) vars['MONGODB_PASSWORD'] = c.password;
      if (c.database) vars['MONGODB_DATABASE'] = c.database;
      break;
  }

  for (const [key, value] of Object.entries(vars)) {
    await upsertEnvVar(project.id, environmentId, key, value);
  }

  const scope = environmentId ? `env:${environmentId.slice(0, 8)}` : 'project-scoped';
  projectInitLogger.info('Injected database environment variables', {
    projectId: project.id,
    databaseId: database.id,
    databaseName: database.name,
    scope,
    variableCount: Object.keys(vars).length,
    variableKeys: Object.keys(vars),
  });
}

const DATABASE_ENV_KEYS = [
  'DATABASE_URL',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'REDIS_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'REDIS_DB',
  'MYSQL_URL',
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
  'MONGODB_URL',
  'MONGODB_HOST',
  'MONGODB_PORT',
  'MONGODB_USER',
  'MONGODB_PASSWORD',
  'MONGODB_DATABASE',
] as const;

export async function removeInjectedDatabaseEnvVars(
  projectId: string,
  environmentId: string
): Promise<void> {
  await db
    .delete(environmentVariables)
    .where(
      and(
        eq(environmentVariables.projectId, projectId),
        eq(environmentVariables.environmentId, environmentId),
        isNull(environmentVariables.serviceId),
        inArray(environmentVariables.key, [...DATABASE_ENV_KEYS])
      )
    );
}

export function createProjectInitWorker() {
  return new Worker<ProjectInitJobData>('project-init', processProjectInit, {
    connection: resolveRedisConnectionOptions({
      maxRetriesPerRequest: null,
    }),
    concurrency: 5,
  });
}
