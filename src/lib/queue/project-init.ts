import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Job, Worker } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { db } from '@/lib/db';
import type { GitProviderType } from '@/lib/db/schema';
import {
  databases,
  domains,
  environments,
  projectInitSteps,
  projects,
  repositories,
  services,
  teams,
  webhooks,
} from '@/lib/db/schema';
import type { Capability } from '@/lib/integrations/domain/models';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import { insertRepositoryRecord } from '@/lib/integrations/service/repository-service';
import {
  createCiliumGateway,
  createCiliumHTTPRoute,
  createNamespace,
  createSecret,
  createService,
  createStatefulSet,
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
    case 'setup_webhook':
    case 'setup_registry_webhook':
      return ['manage_webhook'];
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
  'setup_webhook',
  'setup_registry_webhook',
  'setup_namespace',
  'deploy_services',
  'provision_databases',
  'configure_dns',
] as const;

const CREATE_STEPS = [
  'create_repository',
  'push_template',
  'setup_webhook',
  'setup_registry_webhook',
  'setup_namespace',
  'deploy_services',
  'provision_databases',
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
        case 'setup_webhook':
          await setupWebhook(project);
          break;
        case 'setup_registry_webhook':
          await setupRegistryWebhook(project);
          break;
        case 'setup_namespace':
          await setupNamespace(project, hasK8s);
          break;
        case 'deploy_services':
          await deployServices(project, hasK8s);
          break;
        case 'provision_databases':
          await provisionDatabases(project, hasK8s);
          break;
        case 'configure_dns':
          await configureDns(project, hasK8s);
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
  const envTemplate = renderEnvTemplate(project);
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

  // Fallback to inline template
  return `name: Juanie CI

on:
  push:
    branches: [main, master]

env:
  REGISTRY: ghcr.io
  IMAGE_NAME: \${{ github.repository }}

jobs:
  build:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      packages: write

    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Set up Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Log in to GHCR
        uses: docker/login-action@v3
        with:
          registry: ghcr.io
          username: \${{ github.actor }}
          password: \${{ secrets.GITHUB_TOKEN }}

      - name: Build and Push
        run: |
          IMAGE_TAG=\${{ env.REGISTRY }}/\${{ env.IMAGE_NAME }}:sha-\${{ github.sha }}

          if [ -f Dockerfile ]; then
            docker buildx build --push \\
              --tag $IMAGE_TAG \\
              --cache-from type=gha \\
              --cache-to type=gha,mode=max \\
              .
          else
            docker run --rm \\
              -v /var/run/docker.sock:/var/run/docker.sock \\
              -v $PWD:/workspace \\
              -w /workspace \\
              buildpacksio/pack \\
              pack build $IMAGE_TAG --builder paketobuildpacks/builder-jammy-full
          fi
`;
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

  // Fallback to inline template
  return `stages:
  - build

variables:
  REGISTRY: $CI_REGISTRY
  IMAGE_TAG: $CI_REGISTRY_IMAGE:sha-$CI_COMMIT_SHA
  DOCKER_TLS_CERTDIR: "/certs"

build:
  stage: build
  image: docker:24
  services:
    - docker:24-dind
  before_script:
    - docker login -u $CI_REGISTRY_USER -p $CI_REGISTRY_PASSWORD $CI_REGISTRY
  script:
    - |
      if [ -f Dockerfile ]; then
        docker build -t $IMAGE_TAG .
        docker push $IMAGE_TAG
      else
        docker run --rm \\
          -v /var/run/docker.sock:/var/run/docker.sock \\
          -v $PWD:/workspace \\
          -w /workspace \\
          buildpacksio/pack \\
          pack build $IMAGE_TAG --builder paketobuildpacks/builder-jammy-full
      fi
`;
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

function renderEnvTemplate(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  }
): string {
  const templatePath = join(TEMPLATES_DIR, 'env', '.env.juanie.example');

  if (existsSync(templatePath)) {
    let content = readFileSync(templatePath, 'utf-8');
    content = content
      .replace(/\{\{PROJECT_NAME\}\}/g, project.name)
      .replace(/\{\{PROJECT_SLUG\}\}/g, project.slug);
    return content;
  }

  // Fallback to inline template
  return `# ===========================================
# Juanie 环境变量模板
# ===========================================
# 复制此文件为 .env 并填入实际值
# 真实值可在 Juanie 控制台 → 项目 → 环境变量 中查看

# 项目信息
PROJECT_NAME=${project.name}
PROJECT_SLUG=${project.slug}

# -------------------------------------------
# PostgreSQL（如果项目配置了 PostgreSQL）
# -------------------------------------------
DATABASE_URL=postgresql://postgres:<密码>@${project.slug}-postgres.juanie-${project.slug}.svc.cluster.local:5432/main
POSTGRES_HOST=${project.slug}-postgres.juanie-${project.slug}.svc.cluster.local
POSTGRES_PORT=5432
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<在 Juanie 控制台查看>
POSTGRES_DB=main

# -------------------------------------------
# Redis（如果项目配置了 Redis）
# -------------------------------------------
REDIS_URL=redis://:<密码>@${project.slug}-redis.juanie-${project.slug}.svc.cluster.local:6379
REDIS_HOST=${project.slug}-redis.juanie-${project.slug}.svc.cluster.local
REDIS_PORT=6379
REDIS_PASSWORD=<在 Juanie 控制台查看>
`;
}

/**
 * Setup registry webhook for container image push events.
 * For GitHub, this is handled via GitHub Actions calling our API.
 * We just record the configuration in the database.
 */
async function setupRegistryWebhook(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  }
) {
  console.log(`Setting up registry webhook for project ${project.name}`);

  if (!project.repository) {
    console.log('No repository linked, skipping registry webhook');
    return;
  }

  // Obtain integration session to get provider info
  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: ['read_repo'],
  });

  // Check if registry webhook already exists
  const existingWebhook = await db.query.webhooks.findFirst({
    where: and(eq(webhooks.projectId, project.id), eq(webhooks.type, 'registry')),
  });

  if (existingWebhook) {
    console.log(`✅ Registry webhook already exists for project ${project.name}`);
    return;
  }

  // Generate webhook secret
  const webhookSecret = nanoid(32);

  // Build webhook URL for database record
  const baseUrl =
    process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3001';
  const webhookUrl = `${baseUrl}/api/webhooks/registry?project_id=${project.id}`;

  // For GitHub, registry webhooks are handled via GitHub Actions
  // We don't create an actual webhook, just record the configuration
  await db.insert(webhooks).values({
    projectId: project.id,
    externalId: `github-actions-${project.id}`, // Placeholder ID
    type: 'registry',
    url: webhookUrl,
    events: ['package'],
    secret: webhookSecret,
    active: true,
  });

  // Update project config with image name and webhook secret
  const config = (project.configJson as Record<string, unknown>) || {};
  const imageName = buildImageName(session.provider, project.repository);

  await db
    .update(projects)
    .set({
      configJson: {
        ...config,
        imageName,
        registryWebhookSecret: webhookSecret,
        registryWebhookConfigured: true,
      },
    })
    .where(eq(projects.id, project.id));

  console.log(`✅ Configured registry webhook for ${project.repository.fullName}`);
  console.log(`   Webhook secret will be used in GitHub Actions`);
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

async function setupWebhook(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  }
) {
  console.log(`Setting up webhook for project ${project.name}`);

  if (!project.repository) {
    console.log('⚠️  No repository linked, skipping webhook setup');
    return;
  }

  // Obtain integration session with required capabilities
  const session = await getTeamIntegrationSession({
    teamId: project.teamId,
    requiredCapabilities: requiredCapabilitiesForStep('setup_webhook'),
  });

  // Check if webhook already exists
  const existingWebhook = await db.query.webhooks.findFirst({
    where: eq(webhooks.projectId, project.id),
  });

  if (existingWebhook) {
    console.log(`✅ Webhook already exists for project ${project.name}`);
    return;
  }

  // Generate webhook secret
  const webhookSecret = nanoid(32);

  // Build webhook URL
  const baseUrl =
    process.env.NEXTAUTH_URL || process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : 'http://localhost:3001';
  const webhookUrl = `${baseUrl}/api/webhooks/git`;

  // Create webhook via gateway
  const { id: externalId } = await gateway.createWebhook(session, {
    repoFullName: project.repository.fullName,
    webhookUrl,
    secret: webhookSecret,
    events: ['push'],
  });

  // Save to database
  await db.insert(webhooks).values({
    projectId: project.id,
    externalId,
    type: 'git-push',
    url: webhookUrl,
    events: ['push'],
    secret: webhookSecret,
    active: true,
  });

  console.log(`✅ Created webhook for ${project.repository.fullName}`);
}

async function setupNamespace(project: typeof projects.$inferSelect, hasK8s: boolean) {
  const namespace = `juanie-${project.slug}`;

  if (hasK8s) {
    try {
      await createNamespace(namespace);
    } catch (error) {
      console.error('Failed to create namespace:', error);
      throw error;
    }
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

async function deployServices(project: typeof projects.$inferSelect, hasK8s: boolean) {
  const serviceList = await db.query.services.findMany({
    where: eq(services.projectId, project.id),
  });

  const namespace = `juanie-${project.slug}`;

  if (!hasK8s) {
    console.log('⚠️  Skipping service deployment (no K8s cluster)');
    return;
  }

  for (const service of serviceList) {
    // Build image name (in production, this would be built by CI/CD)
    const _imageName = `juanie/${project.slug}-${service.name}:latest`;

    const spec: AppSpec = {
      projectId: project.id,
      name: service.name.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
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
  }
}

async function provisionDatabases(project: typeof projects.$inferSelect, hasK8s: boolean) {
  const databaseList = await db.query.databases.findMany({
    where: eq(databases.projectId, project.id),
  });

  const namespace = `juanie-${project.slug}`;

  for (const database of databaseList) {
    if (hasK8s) {
      console.log(`Provisioning database ${database.name} for project ${project.name}`);

      const dbPassword = nanoid(32);
      const resourceName = `${project.slug}-${database.name}`;

      // Create password Secret
      await createSecret(namespace, `${resourceName}-creds`, {
        password: dbPassword,
      });

      // Create database based on type
      const secretName = `${resourceName}-creds`;
      if (database.type === 'postgresql') {
        await createPostgreSQLStatefulSet(namespace, resourceName, database.name, secretName);
        await createService(namespace, resourceName, {
          port: 5432,
          targetPort: 5432,
        });
      } else if (database.type === 'redis') {
        await createRedisDeployment(namespace, resourceName, secretName);
        await createService(namespace, resourceName, {
          port: 6379,
          targetPort: 6379,
        });
      } else if (database.type === 'mysql') {
        await createMySQLStatefulSet(namespace, resourceName, database.name, secretName);
        await createService(namespace, resourceName, {
          port: 3306,
          targetPort: 3306,
        });
      }

      // Generate connection string
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

      console.log(`✅ Provisioned database ${database.name}`);
    } else {
      console.log(`[Mock] Would provision database: ${database.name}`);
      await db.update(databases).set({ status: 'running' }).where(eq(databases.id, database.id));
    }
  }
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

async function configureDns(project: typeof projects.$inferSelect, hasK8s: boolean) {
  const domainList = await db.query.domains.findMany({
    where: eq(domains.projectId, project.id),
    with: {
      service: true,
    },
  });

  const namespace = `juanie-${project.slug}`;

  for (const domain of domainList) {
    if (hasK8s) {
      console.log(`Configuring DNS for ${domain.hostname}`);

      // Determine the service name to point to
      const serviceName = domain.service
        ? `${project.slug}-${domain.service.name}`
        : `${project.slug}-web`;

      const servicePort = domain.service?.port || 80;
      const gatewayName = `${project.slug}-${domain.id}`;

      // Create Cilium Gateway
      await createCiliumGateway(namespace, gatewayName, {
        host: domain.hostname,
      });

      // Create Cilium HTTPRoute
      await createCiliumHTTPRoute({
        name: `${gatewayName}-route`,
        namespace,
        gatewayName,
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
  }
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
