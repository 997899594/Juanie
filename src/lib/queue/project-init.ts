import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Job, Worker } from 'bullmq';
import { and, eq, isNull, ne } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import postgres from 'postgres';
import { db } from '@/lib/db';
import type { GitProviderType } from '@/lib/db/schema';
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
import { syncEnvVarsToK8s } from '@/lib/env-sync';
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
  ensureGhcrPullSecret,
  getIsConnected,
  getK8sClient,
  initK8sClient,
} from '@/lib/k8s';
import { AppDeployer, type AppSpec } from '@/lib/k8s/index';
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
    case 'setup_registry_webhook':
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
  'setup_registry_webhook',
  'setup_namespace',
  'provision_databases',
  'deploy_services',
  'configure_dns',
] as const;

const CREATE_STEPS = [
  'create_repository',
  'push_template',
  'setup_registry_webhook',
  'setup_namespace',
  'provision_databases',
  'deploy_services',
  'configure_dns',
] as const;

type StepName = (typeof IMPORT_STEPS)[number] | (typeof CREATE_STEPS)[number];

// ============================================
// Helper Functions
// ============================================

async function updateStepStatus(
  projectId: string,
  step: StepName,
  status: 'running' | 'completed' | 'failed' | 'skipped',
  data?: { message?: string; progress?: number; error?: string }
) {
  await db
    .update(projectInitSteps)
    .set({
      status,
      message: data?.message,
      progress: data?.progress,
      error: data?.error,
      startedAt: status === 'running' ? new Date() : undefined,
      completedAt: status === 'completed' || status === 'skipped' ? new Date() : undefined,
    })
    .where(and(eq(projectInitSteps.projectId, projectId), eq(projectInitSteps.step, step)));
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

  const hasK8s = isK8sAvailable();
  const steps = mode === 'import' ? IMPORT_STEPS : CREATE_STEPS;

  for (const step of steps) {
    try {
      await updateStepStatus(projectId, step, 'running', { progress: 0 });

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
        case 'setup_registry_webhook':
          await setupRegistryWebhook(project);
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
      await updateStepStatus(projectId, step, 'failed', { error: message });
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

  const repo = await gateway.createRepository(session, {
    name: project.slug,
    description: project.description || undefined,
    isPrivate: true,
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
  try {
    const rootFiles = await gateway.listRootFiles(
      session,
      project.repository.fullName,
      project.productionBranch || 'main'
    );
    monorepoType = detectMonorepoType(rootFiles);
    console.log(`Detected monorepo type: ${monorepoType}`);
  } catch (error) {
    console.warn('Failed to detect monorepo type, defaulting to none:', error);
  }

  const files: Record<string, string> = {};

  // 1. Push CI workflow configuration based on provider type and monorepo type
  const isMonorepo = monorepoType !== 'none';
  if (session.provider === 'github') {
    const ciTemplate = isMonorepo
      ? renderGitHubCIMonorepo(project, monorepoType)
      : renderGitHubCI(project);
    files['.github/workflows/juanie-ci.yml'] = ciTemplate;
  } else if (session.provider === 'gitlab' || session.provider === 'gitlab-self-hosted') {
    const ciTemplate = isMonorepo
      ? renderGitLabCIMonorepo(project, monorepoType)
      : renderGitLabCI(project);
    files['.gitlab-ci.yml'] = ciTemplate;
  }

  // 2. Push environment variables template
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

  // Update project configJson with monorepo info
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
  }
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
  }
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
  REGISTRY: ghcr.io

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
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and push \${{ matrix.service }}
        run: |
          IMAGE_TAG=\${{ env.REGISTRY }}/\${{ github.repository }}/\${{ matrix.service }}:sha-\${{ github.sha }}
          docker build -t $IMAGE_TAG -f apps/\${{ matrix.service }}/Dockerfile .
          docker push $IMAGE_TAG
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
    - apk add --no-cache jq
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - |
      for SERVICE in $(echo $SERVICES | jq -r '.[]'); do
        IMAGE_TAG=$CI_REGISTRY_IMAGE/$SERVICE:sha-$CI_COMMIT_SHA
        docker build -t $IMAGE_TAG -f apps/$SERVICE/Dockerfile .
        docker push $IMAGE_TAG
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
 * Setup registry webhook configuration.
 * For GitHub, deployments are triggered via GitHub Actions calling our API.
 * No webhook or secret needed - GitHub Actions uses GITHUB_TOKEN for auth.
 */
async function setupRegistryWebhook(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  }
) {
  console.log(`Configuring registry deployment trigger for project ${project.name}`);

  if (!project.repository) {
    console.log('No repository linked, skipping registry configuration');
    return;
  }

  // Obtain integration session to get provider info
  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: ['read_repo'],
  });

  // Update project config with image name
  const config = (project.configJson as Record<string, unknown>) || {};
  const imageName = buildImageName(session.provider, project.repository);

  await db
    .update(projects)
    .set({
      configJson: {
        ...config,
        imageName,
        registryWebhookConfigured: true,
      },
    })
    .where(eq(projects.id, project.id));

  console.log(`✅ Configured deployment trigger for ${project.repository.fullName}`);
  console.log(`   GitHub Actions will call /api/deployments/trigger after image push`);
}

/**
 * Build the container image name based on git provider type.
 */
function buildImageName(
  providerType: GitProviderType,
  repo: typeof repositories.$inferSelect
): string {
  switch (providerType) {
    case 'github':
      return `ghcr.io/${repo.owner}/${repo.name}`;
    case 'gitlab':
    case 'gitlab-self-hosted':
      return `registry.gitlab.com/${repo.fullName}`;
    default:
      return '';
  }
}

async function setupNamespace(
  project: typeof projects.$inferSelect,
  hasK8s: boolean,
  onProgress?: (p: number) => Promise<void>
) {
  const namespace = `juanie-${project.slug}`;

  if (hasK8s) {
    try {
      await createNamespace(namespace);
      await onProgress?.(40);
    } catch (error) {
      console.error('Failed to create namespace:', error);
      throw error;
    }

    // 用团队 OAuth token 为该 namespace 创建 GHCR 镜像拉取凭证（GitHub 项目）
    try {
      const session = await getTeamIntegrationSession({
        teamId: project.teamId,
        requiredCapabilities: [],
      });
      if (session.provider === 'github') {
        await ensureGhcrPullSecret(namespace, { token: session.accessToken });
        console.log(`✅ Created GHCR pull secret in namespace ${namespace}`);
      }
    } catch (e) {
      console.warn('Could not create GHCR pull secret during namespace setup:', e);
    }
    await onProgress?.(85);
  } else {
    console.log(`[Mock] Would create namespace: ${namespace}`);
  }

  const envList = await db.query.environments.findMany({
    where: eq(environments.projectId, project.id),
  });

  for (const env of envList) {
    await db.update(environments).set({ namespace }).where(eq(environments.id, env.id));
  }
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

  for (let i = 0; i < serviceList.length; i++) {
    const service = serviceList[i];
    // Build image name (in production, this would be built by CI/CD)
    const _imageName = `juanie/${project.slug}-${service.name}:latest`;

    const spec: AppSpec = {
      projectId: project.id,
      name: `${project.slug}-${service.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
      namespace,
      image: {
        repository: `juanie/${project.slug}-${service.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`,
        tag: 'latest',
        pullPolicy: 'Always',
      },
      replicas: service.replicas || 1,
      port: service.port || 3000,
      hostname: undefined, // Will be set in configure_dns step
      resources: {
        cpu: {
          request: service.cpuRequest || '100m',
          limit: service.cpuLimit || '500m',
        },
        memory: {
          request: service.memoryRequest || '128Mi',
          limit: service.memoryLimit || '512Mi',
        },
      },
    };

    console.log(`[deployServices] Deploying ${service.name}...`);
    await AppDeployer.deploy(spec);
    console.log(`✅ Deployed service ${service.name}`);

    await db.update(services).set({ status: 'running' }).where(eq(services.id, service.id));
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
    await db.update(databases).set({ status: 'running' }).where(eq(databases.id, database.id));
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

  const namespace = `juanie-${project.slug}`;
  const dbPassword = nanoid(32);
  const resourceName = `${project.slug}-${database.name}`;
  const secretName = `${resourceName}-creds`;

  console.log(`Provisioning standalone database ${database.name} for project ${project.name}`);

  await createSecret(namespace, secretName, { password: dbPassword });

  if (database.type === 'postgresql') {
    await createPostgreSQLStatefulSet(namespace, resourceName, database.name, secretName);
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
      status: 'running',
      connectionString,
      host: `${resourceName}.${namespace}.svc.cluster.local`,
      serviceName: resourceName,
      namespace,
    })
    .where(eq(databases.id, database.id));

  console.log(`✅ Provisioned standalone database ${database.name}`);
}

/** Sanitize a string to a valid PostgreSQL identifier segment (a-z0-9_ only, max 30 chars). */
function sanitizePgName(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 30);
}

async function provisionSharedPostgreSQL(
  database: typeof databases.$inferSelect,
  project: typeof projects.$inferSelect
): Promise<void> {
  const adminUrl = process.env.DATABASE_URL;
  if (!adminUrl) throw new Error('DATABASE_URL not set; cannot provision shared PostgreSQL');

  const dbIdentifier =
    `juanie_${sanitizePgName(project.slug)}_${sanitizePgName(database.name)}`.slice(0, 63);
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

    const parsedUrl = new URL(adminUrl);
    const host = parsedUrl.hostname;
    const port = parseInt(parsedUrl.port || '5432', 10);
    const connStr = `postgresql://${dbIdentifier}:${encodeURIComponent(dbPassword)}@${host}:${port}/${dbIdentifier}`;

    await db
      .update(databases)
      .set({
        status: 'running',
        connectionString: connStr,
        host,
        port,
        databaseName: dbIdentifier,
        username: dbIdentifier,
        password: dbPassword,
      })
      .where(eq(databases.id, database.id));

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

  const redisHost = process.env.REDIS_HOST || 'localhost';
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
  secretName: string
): Promise<void> {
  await createStatefulSet(namespace, name, {
    image: 'postgres:16-alpine',
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
      const serviceName = domain.service
        ? `${project.slug}-${domain.service.name}`
        : `${project.slug}-web`;

      const servicePort = domain.service?.port || 80;
      const routeName = `${project.slug}-route`;

      // Create HTTPRoute pointing to shared-gateway (https-wildcard handles *.juanie.art)
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
 * Upsert an environment variable.
 *
 * @param environmentId  null → project-scoped (applies to all environments via env-sync merge)
 *                       string → scoped to a specific environment only
 */
async function upsertEnvVar(
  projectId: string,
  environmentId: string | null,
  key: string,
  value: string
): Promise<void> {
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
      injectionType: 'runtime',
    });
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
