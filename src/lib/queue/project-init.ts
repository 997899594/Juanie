import { Job, Worker } from 'bullmq';
import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';
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
  teamMembers,
  teams,
} from '@/lib/db/schema';
import { createGitProvider } from '@/lib/git';
import {
  createCiliumGateway,
  createCiliumHTTPRoute,
  createDeployment,
  createNamespace,
  createSecret,
  createService,
  createStatefulSet,
  getIsConnected,
  getK8sClient,
  initK8sClient,
} from '@/lib/k8s';
import { TemplateService } from '@/lib/templates';
import type { ProjectInitJobData } from './index';

const isDev = process.env.NODE_ENV === 'development';

// ============================================
// Types
// ============================================

interface GitProviderWithClient {
  provider: typeof gitProviders.$inferSelect;
  client: ReturnType<typeof createGitProvider>;
}

// ============================================
// Helper Functions
// ============================================

/**
 * Parse a shell command string into an array of arguments.
 * Handles quoted strings (single and double quotes) and escaped spaces.
 * @example parseCommandString('node server.js --config "my file.json"')
 *   returns ['node', 'server.js', '--config', 'my file.json']
 */
function parseCommandString(commandStr: string): string[] {
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

// ============================================
// Helper Functions
// ============================================

async function getTeamGitProvider(teamId: string): Promise<GitProviderWithClient> {
  const teamMember = await db.query.teamMembers.findFirst({
    where: and(eq(teamMembers.teamId, teamId), eq(teamMembers.role, 'owner')),
    with: {
      user: true,
    },
  });

  if (!teamMember) {
    throw new Error('No owner found for team');
  }

  const gitProvider = await db.query.gitProviders.findFirst({
    where: eq(gitProviders.userId, teamMember.userId),
  });

  if (!gitProvider || !gitProvider.accessToken) {
    throw new Error('No Git provider configured for team owner');
  }

  const client = createGitProvider({
    type: gitProvider.type,
    serverUrl: gitProvider.serverUrl || undefined,
    clientId: gitProvider.clientId || '',
    clientSecret: gitProvider.clientSecret || '',
    redirectUri: '',
  });

  return { provider: gitProvider, client };
}

async function updateStepStatus(
  projectId: string,
  _step: StepName,
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

  const { provider, client } = await getTeamGitProvider(project.teamId);

  const repo = await client.createRepository(provider.accessToken!, {
    name: project.slug,
    description: project.description || undefined,
    isPrivate: true,
    autoInit: false,
  });

  // Create repository record in database
  const [dbRepo] = await db
    .insert(repositories)
    .values({
      providerId: provider.id,
      externalId: repo.id,
      fullName: repo.fullName,
      name: repo.name,
      owner: repo.owner,
      cloneUrl: repo.cloneUrl,
      sshUrl: repo.sshUrl || null,
      webUrl: repo.webUrl,
      defaultBranch: repo.defaultBranch,
      isPrivate: repo.isPrivate,
    })
    .returning();

  // Update project with repository ID
  await db.update(projects).set({ repositoryId: dbRepo.id }).where(eq(projects.id, project.id));

  console.log(`✅ Created repository: ${repo.fullName}`);
}

async function pushTemplate(
  project: typeof projects.$inferSelect & {
    repository: typeof repositories.$inferSelect | null;
  }
) {
  console.log(`Pushing template to project ${project.name}`);

  if (!project.repository) {
    throw new Error('Project has no repository');
  }

  const { provider, client } = await getTeamGitProvider(project.teamId);

  // Get template ID from project config or default to 'nextjs'
  const templateId = (project.configJson as any)?.['template'] || 'nextjs';

  // Get team name for template
  const team = await db.query.teams.findFirst({
    where: eq(teams.id, project.teamId),
  });

  // Render template files
  const templateService = new TemplateService(templateId, {
    projectName: project.name,
    projectSlug: project.slug,
    teamName: team?.name || 'Team',
    description: project.description || '',
  });

  const files = await templateService.renderToMemory();

  // Push files to repository
  await client.pushFiles(provider.accessToken!, {
    repoFullName: project.repository.fullName,
    branch: project.productionBranch || 'main',
    files: Object.fromEntries(files),
    message: 'Initial commit from Juanie template',
  });

  console.log(`✅ Pushed ${files.size} files to repository`);
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

  for (const service of serviceList) {
    if (hasK8s) {
      console.log(`Deploying service ${service.name} for project ${project.name}`);

      // Build image name (in production, this would be built by CI/CD)
      const imageName = `juanie/${project.slug}-${service.name}:latest`;

      // Create Deployment
      await createDeployment(namespace, `${project.slug}-${service.name}`, {
        image: imageName,
        port: service.port || 3000,
        replicas: service.replicas || 1,
        cpuRequest: service.cpuRequest || undefined,
        cpuLimit: service.cpuLimit || undefined,
        memoryRequest: service.memoryRequest || undefined,
        memoryLimit: service.memoryLimit || undefined,
        command: service.startCommand ? parseCommandString(service.startCommand) : undefined,
      });

      // Create Service for web services
      if (service.type === 'web' && service.port) {
        await createService(namespace, `${project.slug}-${service.name}`, {
          port: 80,
          targetPort: service.port,
        });
      }

      console.log(`✅ Deployed service ${service.name}`);
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
