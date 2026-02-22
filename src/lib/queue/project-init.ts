import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  databases,
  domains,
  environments,
  gitProviders,
  projectInitSteps,
  projects,
  repositories,
  services,
} from '@/lib/db/schema';
import { createGitProvider } from '@/lib/git';
import { createNamespace, getIsConnected, initK8sClient } from '@/lib/k8s';
import type { ProjectInitJobData } from './index';

const isDev = process.env.NODE_ENV === 'development';

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
  'setup_namespace',
  'deploy_services',
  'provision_databases',
  'configure_dns',
] as const;

const CREATE_STEPS = [
  'create_repository',
  'push_template',
  'setup_namespace',
  'deploy_services',
  'provision_databases',
  'configure_dns',
] as const;

type StepName = (typeof IMPORT_STEPS)[number] | (typeof CREATE_STEPS)[number];

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
    .where(eq(projectInitSteps.projectId, projectId));
}

export async function processProjectInit(job: Job<ProjectInitJobData>) {
  const { projectId, mode } = job.data;

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
        case 'create_repository':
          await createRepository(project);
          break;
        case 'push_template':
          await pushTemplate(project);
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
  if (!project.repository) {
    // In dev mode without a real repo, just pass
    if (isDev) {
      console.log('⚠️  Skipping repository validation (dev mode)');
      return;
    }
    throw new Error('No repository linked to project');
  }

  const provider = await db.query.gitProviders.findFirst({
    where: eq(gitProviders.id, project.repository.providerId),
  });

  if (!provider || !provider.accessToken) {
    // In dev mode, skip validation
    if (isDev) {
      console.log('⚠️  Skipping repository validation (no provider, dev mode)');
      return;
    }
    throw new Error('Git provider not configured');
  }

  const gitProvider = createGitProvider({
    type: provider.type,
    serverUrl: provider.serverUrl || undefined,
    clientId: provider.clientId || '',
    clientSecret: provider.clientSecret || '',
    redirectUri: '',
  });

  const repo = await gitProvider.getRepository(provider.accessToken, project.repository.fullName);

  if (!repo) {
    throw new Error('No access to repository');
  }
}

async function createRepository(project: typeof projects.$inferSelect) {
  console.log(`Creating repository for project ${project.name}`);
  // TODO: Implement with real Git provider
}

async function pushTemplate(project: typeof projects.$inferSelect) {
  console.log(`Pushing template to project ${project.name}`);
  // TODO: Implement with real Git provider
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

  for (const service of serviceList) {
    if (hasK8s) {
      console.log(`Deploying service ${service.name} for project ${project.name}`);
      // TODO: Create K8s Deployment and Service
    } else {
      console.log(`[Mock] Would deploy service: ${service.name}`);
    }
    await db.update(services).set({ status: 'running' }).where(eq(services.id, service.id));
  }
}

async function provisionDatabases(project: typeof projects.$inferSelect, hasK8s: boolean) {
  const databaseList = await db.query.databases.findMany({
    where: eq(databases.projectId, project.id),
  });

  for (const database of databaseList) {
    if (hasK8s) {
      console.log(`Provisioning database ${database.name} for project ${project.name}`);
      // TODO: Create managed database
    } else {
      console.log(`[Mock] Would provision database: ${database.name}`);
    }
    await db.update(databases).set({ status: 'running' }).where(eq(databases.id, database.id));
  }
}

async function configureDns(project: typeof projects.$inferSelect, hasK8s: boolean) {
  const domainList = await db.query.domains.findMany({
    where: eq(domains.projectId, project.id),
  });

  for (const domain of domainList) {
    if (hasK8s) {
      console.log(`Configuring DNS for ${domain.hostname}`);
      // TODO: Configure DNS and TLS
    } else {
      console.log(`[Mock] Would configure DNS for: ${domain.hostname}`);
    }
    await db.update(domains).set({ isVerified: true }).where(eq(domains.id, domain.id));
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
