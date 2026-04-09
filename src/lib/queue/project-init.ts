import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Job, Worker } from 'bullmq';
import { and, eq, inArray, isNull, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import postgres from 'postgres';
import { encrypt } from '@/lib/crypto';
import {
  formatDatabaseCapabilityIssues,
  reconcileDeclaredDatabaseCapabilities,
  resolveManagedPostgresImage,
  verifyDeclaredDatabaseCapabilities,
} from '@/lib/databases/capabilities';
import { ensureManagedPostgresOwnership } from '@/lib/databases/postgres-ownership';
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
import { buildDeployImageRepository } from '@/lib/deploy-images';
import { buildDomainRouteName, pickDefaultPublicService } from '@/lib/domains/defaults';
import { syncEnvVarsToK8s } from '@/lib/env-sync';
import { buildPreviewNamespace } from '@/lib/environments/preview';
import type { Capability } from '@/lib/integrations/domain/models';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import { insertRepositoryRecord } from '@/lib/integrations/service/repository-service';
import {
  createCiliumHTTPRoute,
  createNamespace,
  createSecret,
  createService,
  createStatefulSet,
  getIsConnected,
  getK8sClient,
  initK8sClient,
  reconcileCiliumHTTPRoutesForHostname,
} from '@/lib/k8s';
import type { MonorepoType } from '@/lib/monorepo';
import { detectMonorepoType } from '@/lib/monorepo';
import { TemplateService } from '@/lib/templates';
import type { ProjectInitJobData } from './index';

const isDev = process.env.NODE_ENV === 'development';

export const requiredCapabilitiesForStep = (step: StepName): Capability[] => {
  switch (step) {
    case 'validate_repository':
      return ['read_repo'];
    case 'push_cicd_config':
    case 'push_template':
      return ['write_repo', 'write_workflow'];
    case 'configure_release_trigger':
      return ['read_repo'];
    case 'create_repository':
      return ['write_repo'];
    default:
      return [];
  }
};

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

// Check if K8s is available
let k8sAvailable: boolean | null = null;

function isK8sAvailable(): boolean {
  if (k8sAvailable !== null) return k8sAvailable;

  try {
    initK8sClient();
    k8sAvailable = getIsConnected();
    return k8sAvailable;
  } catch {
    k8sAvailable = false;
    console.log('⚠️  Kubernetes not available, running in mock mode');
    return false;
  }
}

const IMPORT_STEPS = [
  'validate_repository',
  'push_cicd_config',
  'configure_release_trigger',
  'setup_namespace',
  'provision_databases',
  'deploy_services',
  'configure_dns',
] as const;

const CREATE_STEPS = [
  'create_repository',
  'push_template',
  'push_cicd_config',
  'configure_release_trigger',
  'setup_namespace',
  'provision_databases',
  'deploy_services',
  'configure_dns',
] as const;

type StepName = (typeof IMPORT_STEPS)[number] | (typeof CREATE_STEPS)[number];
type ProjectInitErrorCode =
  | 'repository_missing'
  | 'repository_access_denied'
  | 'repository_create_denied'
  | 'repository_create_failed'
  | 'template_push_failed'
  | 'cicd_config_push_failed'
  | 'release_trigger_failed'
  | 'k8s_namespace_failed'
  | 'database_provision_failed'
  | 'service_deploy_failed'
  | 'dns_config_failed'
  | 'init_step_failed';

function isAutoRetryableProjectInitError(code: ProjectInitErrorCode): boolean {
  return (
    code === 'k8s_namespace_failed' ||
    code === 'database_provision_failed' ||
    code === 'service_deploy_failed' ||
    code === 'dns_config_failed' ||
    code === 'init_step_failed'
  );
}

// ============================================
// Helper Functions
// ============================================

async function updateStepStatus(
  projectId: string,
  step: StepName,
  status: 'running' | 'completed' | 'failed' | 'skipped',
  data?: { message?: string; progress?: number; error?: string; errorCode?: ProjectInitErrorCode }
) {
  await db
    .update(projectInitSteps)
    .set({
      status,
      message:
        status === 'running' || status === 'completed' || status === 'skipped'
          ? (data?.message ?? null)
          : data?.message,
      progress: data?.progress,
      errorCode:
        status === 'running' || status === 'completed' || status === 'skipped'
          ? null
          : data?.errorCode,
      error:
        status === 'running' || status === 'completed' || status === 'skipped' ? null : data?.error,
      startedAt: status === 'running' ? new Date() : undefined,
      completedAt: status === 'completed' || status === 'skipped' ? new Date() : undefined,
    })
    .where(and(eq(projectInitSteps.projectId, projectId), eq(projectInitSteps.step, step)));
}

function classifyProjectInitError(step: StepName, error: unknown): ProjectInitErrorCode {
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
    return 'repository_create_failed';
  }

  if (step === 'push_template') return 'template_push_failed';
  if (step === 'push_cicd_config') return 'cicd_config_push_failed';
  if (step === 'configure_release_trigger') return 'release_trigger_failed';
  if (step === 'setup_namespace') return 'k8s_namespace_failed';
  if (step === 'provision_databases') return 'database_provision_failed';
  if (step === 'deploy_services') return 'service_deploy_failed';
  if (step === 'configure_dns') return 'dns_config_failed';

  return 'init_step_failed';
}

export async function processProjectInit(job: Job<ProjectInitJobData>) {
  const { projectId, mode, template } = job.data;

  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
    with: {
      repository: true,
    },
  });

  if (!project) {
    throw new Error(`Project ${projectId} not found`);
  }

  await db
    .update(projects)
    .set({ status: 'initializing', updatedAt: new Date() })
    .where(eq(projects.id, projectId));

  const hasK8s = isK8sAvailable();
  const steps = mode === 'import' ? IMPORT_STEPS : CREATE_STEPS;
  const currentAttempt = job.attemptsMade + 1;
  const totalAttempts =
    typeof job.opts.attempts === 'number' && job.opts.attempts > 0 ? job.opts.attempts : 1;

  for (const step of steps) {
    try {
      await updateStepStatus(projectId, step, 'running', {
        progress: 0,
        message: currentAttempt > 1 ? `平台正在自动重试（第 ${currentAttempt} 次尝试）` : undefined,
      });

      switch (step) {
        case 'validate_repository':
          await validateRepository(project);
          break;
        case 'create_repository': {
          await createRepository(project);
          // Refetch project to get updated repository relation
          const updatedProject = await db.query.projects.findFirst({
            where: eq(projects.id, projectId),
            with: { repository: true },
          });
          if (updatedProject) {
            Object.assign(project, updatedProject);
          }
          break;
        }
        case 'push_cicd_config':
          await pushCicdConfig(project);
          break;
        case 'push_template':
          await pushTemplate(project, template);
          break;
        case 'configure_release_trigger':
          await configureReleaseTrigger(project);
          break;
        case 'setup_namespace':
          await setupNamespace(project, hasK8s, (p) =>
            updateStepStatus(projectId, step, 'running', { progress: p })
          );
          break;
        case 'deploy_services':
          await deployServices(project, hasK8s, (p) =>
            updateStepStatus(projectId, step, 'running', { progress: p })
          );
          break;
        case 'provision_databases':
          await provisionDatabases(project, hasK8s, (p) =>
            updateStepStatus(projectId, step, 'running', { progress: p })
          );
          break;
        case 'configure_dns':
          await configureDns(project, hasK8s, (p) =>
            updateStepStatus(projectId, step, 'running', { progress: p })
          );
          break;
      }

      const message =
        !hasK8s &&
        ['setup_namespace', 'deploy_services', 'provision_databases', 'configure_dns'].includes(
          step
        )
          ? 'Skipped (no K8s cluster)'
          : undefined;

      await updateStepStatus(
        projectId,
        step,
        hasK8s ||
          !['setup_namespace', 'deploy_services', 'provision_databases', 'configure_dns'].includes(
            step
          )
          ? 'completed'
          : 'skipped',
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
  project: typeof projects.$inferSelect & { repository: typeof repositories.$inferSelect | null }
) {
  console.log(`[validateRepository] Starting for project ${project.name}`);

  if (!project.repository) {
    console.log('[validateRepository] No repository linked');
    if (isDev) {
      console.log('⚠️  Skipping repository validation (dev mode)');
      return;
    }
    throw new Error('No repository linked to project');
  }

  console.log(`[validateRepository] Repository: ${project.repository.fullName}`);

  // Obtain integration session with required capability
  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('validate_repository'),
  });

  const repo = await gateway.getRepository(session, project.repository.fullName);
  console.log(`[validateRepository] Repository access ${repo ? 'granted' : 'denied'}`);

  if (!repo) {
    throw new Error('No access to repository');
  }

  console.log('[validateRepository] Validation passed');
}

// Helper to build an IntegrationSession from legacy git provider result (temporary bridge)
const _buildSessionFromGitProviderResult = (
  result: { provider: any; client: any },
  teamId: string
) => {
  return {
    integrationId: result.provider.id,
    provider: result.provider.type,
    teamId,
    grantId: '',
    accessToken: result.provider.accessToken!,
    capabilities: [], // capabilities not needed for current internal calls
  } as const;
};

async function createRepository(project: typeof projects.$inferSelect) {
  console.log(`Creating repository for project ${project.name}`);

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

  const repo = await gateway.createRepository(session, {
    name: project.slug,
    description: project.description || undefined,
    isPrivate,
    autoInit: false,
  });

  // Create repository record in database
  const dbRepoId = await insertRepositoryRecord(repo, session.integrationId);

  // Update project with repository ID
  await db.update(projects).set({ repositoryId: dbRepoId }).where(eq(projects.id, project.id));

  console.log(`✅ Created repository: ${repo.fullName}`);
}

async function pushTemplate(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  },
  template?: string
) {
  console.log(`Pushing template to project ${project.name}`);

  if (!project.repository) {
    throw new Error('Project has no repository');
  }

  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('push_template'),
  });

  // Use gateway to push files instead of direct client
  const templateId = template || 'default';
  const files = await new TemplateService(templateId, {
    projectName: project.name,
    projectSlug: project.slug,
    teamName:
      (await db.query.teams.findFirst({ where: eq(teams.id, project.teamId) }))?.name || 'Team',
    description: project.description || '',
  }).renderToMemory();

  await gateway.pushFiles(session, {
    repoFullName: project.repository.fullName,
    branch: project.productionBranch || 'main',
    files: Object.fromEntries(files),
    message: 'Initial commit from Juanie template',
  });

  console.log(`✅ Pushed ${files.size} files to repository`);
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
  packageJson: {
    packageManager?: string;
    scripts?: Record<string, string>;
    dependencies?: Record<string, string>;
    devDependencies?: Record<string, string>;
  } | null;
}

function supportsGeneratedMigration(dbType: typeof databases.$inferSelect.type): boolean {
  return dbType === 'postgresql' || dbType === 'mysql';
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

export function detectMigrationTool(packageJson: RepoAutomationContext['packageJson']) {
  const dependencies = {
    ...(packageJson?.dependencies ?? {}),
    ...(packageJson?.devDependencies ?? {}),
  };

  if (dependencies.prisma || dependencies['@prisma/client']) return 'prisma';
  if (dependencies['drizzle-kit'] || dependencies['drizzle-orm']) return 'drizzle';
  if (dependencies.knex) return 'knex';
  if (dependencies.typeorm) return 'typeorm';
  return 'custom';
}

export function inferMigrationCommand(
  automation: RepoAutomationContext,
  databaseType: typeof databases.$inferSelect.type
): {
  comment: string;
  tool: 'drizzle' | 'prisma' | 'knex' | 'typeorm' | 'custom';
  command: string;
  executionMode: 'automatic' | 'manual_platform';
  approvalPolicy?: 'manual_in_production';
} | null {
  if (!supportsGeneratedMigration(databaseType) || automation.monorepoType !== 'none') {
    return null;
  }

  const scripts = automation.packageJson?.scripts ?? {};
  const tool = detectMigrationTool(automation.packageJson);

  if (scripts['db:migrate']) {
    return {
      comment: 'Auto-generated from package.json script db:migrate',
      tool,
      command: buildRunScriptCommand(automation.packageManager, 'db:migrate'),
      executionMode: 'automatic',
      approvalPolicy: 'manual_in_production',
    };
  }

  if (scripts['db:deploy']) {
    return {
      comment: 'Auto-generated from package.json script db:deploy',
      tool,
      command: buildRunScriptCommand(automation.packageManager, 'db:deploy'),
      executionMode: 'automatic',
      approvalPolicy: 'manual_in_production',
    };
  }

  if (scripts['db:push']) {
    return {
      comment:
        'Auto-generated from package.json script db:push; review before approving it in Juanie',
      tool,
      command: buildRunScriptCommand(automation.packageManager, 'db:push'),
      executionMode: 'manual_platform',
      approvalPolicy: 'manual_in_production',
    };
  }

  return null;
}

function resolveBakeTarget(
  service: typeof services.$inferSelect,
  automation: RepoAutomationContext
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
  automation: RepoAutomationContext
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

export function buildMigrationConfigLines(
  indent: string,
  inferred: ReturnType<typeof inferMigrationCommand>
): string[] {
  const lines = [
    `${indent}# ${inferred?.comment ?? "TODO: replace with the repository's real migration command before running it from Juanie"}`,
    `${indent}migrate:`,
    `${indent}  tool: ${inferred?.tool ?? 'custom'}`,
    `${indent}  workingDirectory: .`,
    `${indent}  command: ${inferred?.command ?? 'npm run db:migrate'}`,
    `${indent}  phase: preDeploy`,
    `${indent}  executionMode: ${inferred?.executionMode ?? 'manual_platform'}`,
  ];

  if (inferred?.approvalPolicy) {
    lines.push(`${indent}  approvalPolicy: ${inferred.approvalPolicy}`);
  }

  return lines;
}

export function buildServiceMigrationLines(
  service: typeof services.$inferSelect,
  serviceList: Array<typeof services.$inferSelect>,
  databaseList: Array<typeof databases.$inferSelect>,
  automation: RepoAutomationContext
): string[] {
  const serviceScopedRelationalDbs = databaseList.filter(
    (database) => database.serviceId === service.id && supportsGeneratedMigration(database.type)
  );

  if (serviceScopedRelationalDbs.length === 1 && serviceScopedRelationalDbs[0].role === 'primary') {
    return buildMigrationConfigLines(
      '    ',
      inferMigrationCommand(automation, serviceScopedRelationalDbs[0].type)
    );
  }

  if (serviceScopedRelationalDbs.length > 0) {
    const lines = ['    databases:'];

    for (const database of serviceScopedRelationalDbs) {
      const inferred = inferMigrationCommand(automation, database.type);
      lines.push(
        `      - role: ${database.role ?? 'primary'}`,
        `        type: ${database.type}`,
        ...buildMigrationConfigLines('        ', inferred)
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
      return buildMigrationConfigLines(
        '    ',
        inferMigrationCommand(automation, accessibleRelationalDbs[0].type)
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
  automation: RepoAutomationContext
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
      lines.push(
        `  - name: ${database.name}`,
        `    type: ${database.type}`,
        `    plan: ${database.plan ?? 'starter'}`,
        `    scope: ${database.scope ?? (database.serviceId ? 'service' : 'project')}`,
        `    role: ${database.role ?? 'primary'}`
      );
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
  }
) {
  console.log(`Pushing CI/CD config for project ${project.name}`);

  if (!project.repository) {
    console.log('No repository linked, skipping CI/CD config');
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
  let packageJson: RepoAutomationContext['packageJson'] = null;

  try {
    rootFiles = await gateway.listRootFiles(
      session,
      project.repository.fullName,
      project.productionBranch || 'main'
    );
    monorepoType = detectMonorepoType(rootFiles);
    console.log(`Detected monorepo type: ${monorepoType}`);

    if (rootFiles.includes('package.json')) {
      try {
        const packageJsonContent = await gateway.getFileContent(
          session,
          project.repository.fullName,
          'package.json',
          project.productionBranch || 'main'
        );
        packageJson = packageJsonContent ? JSON.parse(packageJsonContent) : null;
      } catch (error) {
        console.warn('Failed to parse package.json, falling back to migration skeleton:', error);
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
        console.warn(
          'Failed to inspect docker-bake definition, continuing without targets:',
          error
        );
      }
    }
  } catch (error) {
    console.warn('Failed to inspect repository root, falling back to generated skeleton:', error);
  }

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

  console.log(`✅ Pushed CI/CD config (monorepo: ${isMonorepo ? monorepoType : 'none'})`);
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

  const ns = `juanie-${project.slug}`;
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
        ? `${project.slug}-${db_.name}.${ns}.svc.cluster.local`
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
  }
) {
  console.log(`Configuring release trigger for project ${project.name}`);

  if (!project.repository) {
    console.log('No repository linked, skipping release trigger configuration');
    return;
  }

  // Update project config with image name
  const config = (project.configJson as Record<string, unknown>) || {};
  const imageName = buildImageName(project.repository);

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

  console.log(`✅ Configured release trigger for ${project.repository.fullName}`);
  console.log(`   Juanie CI will call /api/releases after image push`);
}

/**
 * Build the container image name based on git provider type.
 */
function buildImageName(repo: typeof repositories.$inferSelect): string {
  return buildDeployImageRepository(repo.fullName);
}

async function setupNamespace(
  project: typeof projects.$inferSelect,
  hasK8s: boolean,
  onProgress?: (p: number) => Promise<void>
) {
  // staging → juanie-{slug}, production → juanie-{slug}-prod
  const stagingNamespace = `juanie-${project.slug}`;
  const productionNamespace = `juanie-${project.slug}-prod`;

  const envList = await db.query.environments.findMany({
    where: eq(environments.projectId, project.id),
  });

  // Assign namespaces by role
  for (const env of envList) {
    const ns = env.isProduction ? productionNamespace : stagingNamespace;
    await db.update(environments).set({ namespace: ns }).where(eq(environments.id, env.id));
  }

  const namespacesToCreate = envList.some((e) => e.isProduction)
    ? [stagingNamespace, productionNamespace]
    : [stagingNamespace];

  if (hasK8s) {
    for (const ns of namespacesToCreate) {
      try {
        await createNamespace(ns);
      } catch (error) {
        console.error(`Failed to create namespace ${ns}:`, error);
        throw error;
      }
    }
    await onProgress?.(85);
  } else {
    for (const ns of namespacesToCreate) {
      console.log(`[Mock] Would create namespace: ${ns}`);
    }
  }
  await onProgress?.(40);
}

async function deployServices(
  project: typeof projects.$inferSelect,
  hasK8s: boolean,
  onProgress?: (p: number) => Promise<void>
) {
  const serviceList = await db.query.services.findMany({
    where: eq(services.projectId, project.id),
  });

  const namespace = `juanie-${project.slug}`;

  if (!hasK8s) {
    console.log('⚠️  Skipping service deployment (no K8s cluster)');
    return;
  }

  // Only create K8s Services (ClusterIP) for internal networking.
  // The Deployment (Pod) is intentionally NOT created here — it will be created
  // by the deployment worker on the first CI/CD push with the correct image,
  // envFrom (ConfigMap/Secret refs), and imagePullSecrets.
  for (let i = 0; i < serviceList.length; i++) {
    const service = serviceList[i];
    const resourceName = `${project.slug}-${service.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
    const port = service.port || 3000;

    console.log(`[deployServices] Creating K8s Service for ${service.name}...`);
    await createService(namespace, resourceName, { port, targetPort: port });
    console.log(`✅ Created K8s Service ${resourceName}`);

    // Mark as pending — the Deployment (and pod) will be created by the first CI/CD deploy
    await db.update(services).set({ status: 'pending' }).where(eq(services.id, service.id));
    await onProgress?.(Math.round(((i + 1) / serviceList.length) * 100));
  }
}

async function provisionDatabases(
  project: typeof projects.$inferSelect,
  hasK8s: boolean,
  onProgress?: (p: number) => Promise<void>
) {
  const databaseList = await db.query.databases.findMany({
    where: eq(databases.projectId, project.id),
  });

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
    await onProgress?.(Math.round(((i + 1) / databaseList.length) * 90));
  }

  // Sync all injected env vars to K8s ConfigMap/Secret for each affected environment
  if (hasK8s) {
    const affectedEnvIds = [
      ...new Set(databaseList.map((d) => d.environmentId).filter(Boolean) as string[]),
    ];
    for (const envId of affectedEnvIds) {
      await syncEnvVarsToK8s(project.id, envId).catch((e) =>
        console.warn(`[provisionDatabases] syncEnvVarsToK8s failed for env ${envId}:`, e)
      );
    }
  }
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
  const provisionType = database.provisionType || 'standalone';

  if (provisionType === 'external') {
    // connectionString was set at insert time; just mark running
    const capabilityCheck = await verifyDeclaredDatabaseCapabilities(database);
    await db
      .update(databases)
      .set({ status: capabilityCheck.satisfied ? 'running' : 'failed' })
      .where(eq(databases.id, database.id));
    if (!capabilityCheck.satisfied) {
      throw new Error(formatDatabaseCapabilityIssues(database, capabilityCheck.issues));
    }
    console.log(`✅ Database ${database.name} marked running (external)`);
    return;
  }

  if (provisionType === 'shared') {
    if (database.type === 'postgresql') {
      await provisionSharedPostgreSQL(database, project);
      return;
    }
    if (database.type === 'redis') {
      await provisionSharedRedis(database);
      return;
    }
    // MySQL / MongoDB: shared not supported — fall through to standalone
    console.log(`[shared] ${database.type} not supported as shared, falling through to standalone`);
  }

  // standalone (or shared fallback for unsupported types)
  if (!hasK8s) {
    console.log(`[Mock] Would provision database: ${database.name}`);
    await db.update(databases).set({ status: 'running' }).where(eq(databases.id, database.id));
    return;
  }

  const environment = database.environmentId
    ? await db.query.environments.findFirst({
        where: eq(environments.id, database.environmentId),
        columns: {
          id: true,
          name: true,
          namespace: true,
          isPreview: true,
          isProduction: true,
        },
      })
    : null;
  const namespace =
    environment?.namespace ??
    (environment?.isPreview
      ? buildPreviewNamespace(project.slug, environment.name)
      : environment?.isProduction
        ? `juanie-${project.slug}-prod`
        : `juanie-${project.slug}`);
  const dbPassword = nanoid(32);
  const resourceName = [
    project.slug,
    environment?.isPreview ? environment.name : environment?.isProduction ? 'prod' : null,
    database.name,
  ]
    .filter(Boolean)
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 63);
  const secretName = `${resourceName}-creds`;

  console.log(`Provisioning standalone database ${database.name} for project ${project.name}`);

  await createNamespace(namespace);
  await createSecret(namespace, secretName, { password: dbPassword });

  if (database.type === 'postgresql') {
    await createPostgreSQLStatefulSet(
      namespace,
      resourceName,
      database.name,
      secretName,
      database.capabilities
    );
    await createService(namespace, resourceName, { port: 5432, targetPort: 5432 });
  } else if (database.type === 'redis') {
    await createRedisDeployment(namespace, resourceName, secretName);
    await createService(namespace, resourceName, { port: 6379, targetPort: 6379 });
  } else if (database.type === 'mysql') {
    await createMySQLStatefulSet(namespace, resourceName, database.name, secretName);
    await createService(namespace, resourceName, { port: 3306, targetPort: 3306 });
  }

  const connectionString = getConnectionString(
    database.type,
    resourceName,
    namespace,
    dbPassword,
    database.name
  );

  await db
    .update(databases)
    .set({
      connectionString,
      host: `${resourceName}.${namespace}.svc.cluster.local`,
      serviceName: resourceName,
      namespace,
    })
    .where(eq(databases.id, database.id));

  const latestDatabase = await db.query.databases.findFirst({
    where: eq(databases.id, database.id),
  });
  if (!latestDatabase) {
    throw new Error(`数据库 ${database.name} 在供应完成后丢失，无法兑现能力`);
  }

  const capabilityCheck = await reconcileDeclaredDatabaseCapabilities(latestDatabase);

  await db
    .update(databases)
    .set({ status: capabilityCheck.satisfied ? 'running' : 'failed' })
    .where(eq(databases.id, database.id));

  if (!capabilityCheck.satisfied) {
    throw new Error(formatDatabaseCapabilityIssues(database, capabilityCheck.issues));
  }

  console.log(`✅ Provisioned standalone database ${database.name}`);
}

/** Sanitize a string to a valid PostgreSQL identifier segment (a-z0-9_ only, max 30 chars). */
function sanitizePgName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 30);
}

/**
 * Qualify a bare K8s service name with the Juanie namespace FQDN so it can be
 * resolved from pods running in other namespaces.
 * localhost / IP addresses / already-qualified names are returned as-is.
 */
function toFqdn(host: string): string {
  const juanieNamespace = process.env.JUANIE_NAMESPACE || 'juanie';
  if (!host || host === 'localhost' || /^\d+\.\d+/.test(host) || host.includes('.')) {
    return host;
  }
  return `${host}.${juanieNamespace}.svc.cluster.local`;
}

async function provisionSharedPostgreSQL(
  database: typeof databases.$inferSelect,
  project: typeof projects.$inferSelect
): Promise<void> {
  const adminUrl = process.env.DATABASE_URL;
  if (!adminUrl) throw new Error('DATABASE_URL not set; cannot provision shared PostgreSQL');

  const environment = database.environmentId
    ? await db.query.environments.findFirst({
        where: eq(environments.id, database.environmentId),
        columns: {
          id: true,
          name: true,
          isPreview: true,
          isProduction: true,
        },
      })
    : null;
  const environmentSegment = environment?.isPreview
    ? sanitizePgName(environment.name)
    : environment?.isProduction
      ? 'prod'
      : null;
  const dbIdentifier = [
    'juanie',
    sanitizePgName(project.slug),
    environmentSegment,
    sanitizePgName(database.name),
  ]
    .filter(Boolean)
    .join('_')
    .slice(0, 63);
  const dbPassword = nanoid(32); // URL-safe chars: A-Za-z0-9_- — safe in SQL string literals

  const adminConn = postgres(adminUrl, { max: 1 });
  try {
    // Create database (idempotent)
    await adminConn
      .unsafe(`CREATE DATABASE "${dbIdentifier}" ENCODING 'UTF8'`)
      .catch((e: Error) => {
        if (!e.message?.includes('already exists')) throw e;
      });

    // Create user with password (idempotent)
    await adminConn
      .unsafe(`CREATE USER "${dbIdentifier}" WITH PASSWORD '${dbPassword}'`)
      .catch((e: Error) => {
        if (!e.message?.includes('already exists')) throw e;
      });

    // Grant all privileges
    await adminConn.unsafe(
      `GRANT ALL PRIVILEGES ON DATABASE "${dbIdentifier}" TO "${dbIdentifier}"`
    );
    await adminConn.unsafe(`ALTER DATABASE "${dbIdentifier}" OWNER TO "${dbIdentifier}"`);

    const parsedUrl = new URL(adminUrl);
    const host = toFqdn(parsedUrl.hostname);
    const port = parseInt(parsedUrl.port || '5432', 10);
    const connStr = `postgresql://${dbIdentifier}:${encodeURIComponent(dbPassword)}@${host}:${port}/${dbIdentifier}`;

    await db
      .update(databases)
      .set({
        connectionString: connStr,
        host,
        port,
        databaseName: dbIdentifier,
        username: dbIdentifier,
        password: dbPassword,
      })
      .where(eq(databases.id, database.id));

    await ensureManagedPostgresOwnership({
      type: 'postgresql',
      provisionType: 'shared',
      host,
      port,
      databaseName: dbIdentifier,
      username: dbIdentifier,
      connectionString: connStr,
    });

    const latestDatabase = await db.query.databases.findFirst({
      where: eq(databases.id, database.id),
    });
    if (!latestDatabase) {
      throw new Error(`数据库 ${database.name} 在共享库初始化后丢失，无法兑现能力`);
    }

    const capabilityCheck = await reconcileDeclaredDatabaseCapabilities(latestDatabase);

    await db
      .update(databases)
      .set({ status: capabilityCheck.satisfied ? 'running' : 'failed' })
      .where(eq(databases.id, database.id));

    if (!capabilityCheck.satisfied) {
      throw new Error(formatDatabaseCapabilityIssues(database, capabilityCheck.issues));
    }

    console.log(`✅ Provisioned shared PostgreSQL database ${dbIdentifier}`);
  } finally {
    await adminConn.end();
  }
}

async function provisionSharedRedis(database: typeof databases.$inferSelect): Promise<void> {
  // Count existing shared-redis databases (excluding this one) to assign the next db index.
  // Redis db 0 is reserved for Juanie's BullMQ queues.
  const sharedRedis = await db
    .select({ id: databases.id })
    .from(databases)
    .where(
      and(
        eq(databases.type, 'redis'),
        eq(databases.provisionType, 'shared'),
        ne(databases.id, database.id)
      )
    );
  const dbIndex = sharedRedis.length + 1; // 1-based; 0 reserved for BullMQ

  const redisHost = toFqdn(process.env.REDIS_HOST || 'localhost');
  const redisPort = process.env.REDIS_PORT || '6379';
  const redisPassword = process.env.REDIS_PASSWORD;

  const connStr = redisPassword
    ? `redis://:${encodeURIComponent(redisPassword)}@${redisHost}:${redisPort}/${dbIndex}`
    : `redis://${redisHost}:${redisPort}/${dbIndex}`;

  await db
    .update(databases)
    .set({
      status: 'running',
      connectionString: connStr,
      host: redisHost,
      port: dbIndex, // store redis db index in port field
    })
    .where(eq(databases.id, database.id));

  console.log(`✅ Provisioned shared Redis at db index ${dbIndex}`);
}

// Helper function to create PostgreSQL StatefulSet
async function createPostgreSQLStatefulSet(
  namespace: string,
  name: string,
  dbName: string,
  secretName: string,
  capabilities: readonly string[] | null | undefined
): Promise<void> {
  await createStatefulSet(namespace, name, {
    image: resolveManagedPostgresImage(capabilities),
    serviceName: name,
    port: 5432,
    replicas: 1,
    env: {
      POSTGRES_DB: dbName,
      PGDATA: '/var/lib/postgresql/data/pgdata',
    },
    envFrom: {
      secretName,
    },
    volumeName: 'data',
    storageSize: '10Gi',
    mountPath: '/var/lib/postgresql/data',
  });
}

// Helper function to create Redis Deployment
async function createRedisDeployment(
  namespace: string,
  name: string,
  secretName: string
): Promise<void> {
  const { apps } = getK8sClient();

  await apps.createNamespacedDeployment({
    namespace,
    body: {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: {
            containers: [
              {
                name: 'redis',
                image: 'redis:7-alpine',
                ports: [{ containerPort: 6379 }],
                env: [
                  {
                    name: 'REDIS_PASSWORD',
                    valueFrom: {
                      secretKeyRef: {
                        name: secretName,
                        key: 'password',
                      },
                    },
                  },
                ],
                command: ['sh', '-c'],
                args: ['redis-server --requirepass "$REDIS_PASSWORD"'],
              },
            ],
          },
        },
      },
    },
  });
}

// Helper function to create MySQL StatefulSet
async function createMySQLStatefulSet(
  namespace: string,
  name: string,
  dbName: string,
  secretName: string
): Promise<void> {
  await createStatefulSet(namespace, name, {
    image: 'mysql:8',
    serviceName: name,
    port: 3306,
    replicas: 1,
    env: {
      MYSQL_DATABASE: dbName,
    },
    envFrom: {
      secretName,
    },
    volumeName: 'data',
    storageSize: '10Gi',
    mountPath: '/var/lib/mysql',
  });
}

// Helper function to generate connection strings
function getConnectionString(
  type: string,
  host: string,
  namespace: string,
  password: string,
  dbName: string
): string {
  const fullHost = `${host}.${namespace}.svc.cluster.local`;
  // URL-encode password to handle special characters (@, :, /, #, ?, etc.)
  const encodedPassword = encodeURIComponent(password);
  switch (type) {
    case 'postgresql':
      return `postgresql://postgres:${encodedPassword}@${fullHost}:5432/${dbName}`;
    case 'mysql':
      return `mysql://root:${encodedPassword}@${fullHost}:3306/${dbName}`;
    case 'redis':
      return `redis://:${encodedPassword}@${fullHost}:6379`;
    case 'mongodb':
      return `mongodb://root:${encodedPassword}@${fullHost}:27017/${dbName}`;
    default:
      return '';
  }
}

async function configureDns(
  project: typeof projects.$inferSelect,
  hasK8s: boolean,
  onProgress?: (p: number) => Promise<void>
) {
  const serviceList = await db.query.services.findMany({
    where: eq(services.projectId, project.id),
  });
  const defaultPublicService = pickDefaultPublicService(serviceList);
  const domainList = await db.query.domains.findMany({
    where: eq(domains.projectId, project.id),
    with: {
      service: true,
    },
  });

  const namespace = `juanie-${project.slug}`;

  for (let i = 0; i < domainList.length; i++) {
    const domain = domainList[i];
    if (hasK8s) {
      console.log(`Configuring DNS for ${domain.hostname}`);

      // Determine the service name to point to
      const targetService = domain.service ?? defaultPublicService;
      const serviceName = targetService
        ? `${project.slug}-${targetService.name}`
        : `${project.slug}-web`;

      const servicePort = targetService?.port || 3000;
      const routeName = buildDomainRouteName(domain.hostname);

      // Create HTTPRoute pointing to shared-gateway (https-wildcard handles *.juanie.art)
      await reconcileCiliumHTTPRoutesForHostname({
        namespace,
        hostname: domain.hostname,
        canonicalRouteName: routeName,
      });
      await createCiliumHTTPRoute({
        name: routeName,
        namespace,
        gatewayName: 'shared-gateway',
        gatewayNamespace: 'juanie',
        sectionName: 'https-wildcard',
        hostnames: [domain.hostname],
        serviceName,
        servicePort,
        path: '/',
      });

      // Mark domain as gateway configured
      // NOTE: This sets isVerified=true after creating the Gateway/HTTPRoute,
      // but does NOT perform actual DNS verification. The field name is misleading
      // - it actually indicates "gateway is configured", not "DNS is verified".
      // TODO: Implement actual DNS verification (check TXT/CNAME records) or
      // rename the column to gatewayConfigured for clarity.
      await db.update(domains).set({ isVerified: true }).where(eq(domains.id, domain.id));

      console.log(`✅ Configured DNS for ${domain.hostname}`);
    } else {
      console.log(`[Mock] Would configure DNS for: ${domain.hostname}`);
      // See note above about isVerified semantics
      await db.update(domains).set({ isVerified: true }).where(eq(domains.id, domain.id));
    }
    await onProgress?.(Math.round(((i + 1) / domainList.length) * 100));
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
  console.log(
    `✅ Injected ${Object.keys(vars).length} env vars for database ${database.name} [${scope}]: ${Object.keys(vars).join(', ')}`
  );
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
    connection: {
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: null,
    },
    concurrency: 5,
  });
}
