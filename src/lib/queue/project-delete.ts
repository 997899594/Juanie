import { Job, Worker } from 'bullmq';
import { eq } from 'drizzle-orm';
import { deprovisionManagedDatabase } from '@/lib/databases/provider';
import { db } from '@/lib/db';
import { databases, environments, projects, repositories } from '@/lib/db/schema';
import { deleteProjectPreviewApplicationSet } from '@/lib/environments/application-set';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import { deleteNamespace, isK8sAvailable, waitForNamespaceDeleted } from '@/lib/k8s';
import { logger } from '@/lib/logger';
import {
  publishProjectDeletedRealtimeEvent,
  publishProjectRealtimeSnapshot,
} from '@/lib/realtime/projects';
import { resolveRedisConnectionOptions } from '@/lib/redis/config';
import type { ProjectDeleteJobData } from './index';

const JUANIE_BASE_REPOSITORY_FILES = ['juanie.yaml', '.env.juanie.example', 'JUANIE.md'] as const;
const JUANIE_GITHUB_WORKFLOW_PATH = '.github/workflows/juanie-ci.yml';
const JUANIE_GITLAB_CI_PATH = '.gitlab-ci.yml';
const JUANIE_GITLAB_CI_MARKERS = [
  'https://juanie.art/api/releases',
  'JUANIE_SOURCE_SHA',
  'juanie-ci-meta.json',
] as const;
const projectDeleteLogger = logger.child({ component: 'project-delete' });

type ProjectDeleteRecord = Pick<
  typeof projects.$inferSelect,
  'id' | 'slug' | 'status' | 'teamId' | 'productionBranch' | 'repositoryId'
> & {
  repository: Pick<
    typeof repositories.$inferSelect,
    'providerId' | 'fullName' | 'defaultBranch'
  > | null;
};

export function isJuanieManagedGitLabCi(content: string | null | undefined): boolean {
  if (!content) {
    return false;
  }

  return JUANIE_GITLAB_CI_MARKERS.some((marker) => content.includes(marker));
}

export function buildJuanieRepositoryCleanupPaths({
  provider,
  gitlabCiContent,
}: {
  provider: 'github' | 'gitlab' | 'gitlab-self-hosted';
  gitlabCiContent?: string | null;
}): string[] {
  const paths: string[] = [...JUANIE_BASE_REPOSITORY_FILES];

  if (provider === 'github') {
    paths.push(JUANIE_GITHUB_WORKFLOW_PATH);
    return paths;
  }

  if (isJuanieManagedGitLabCi(gitlabCiContent)) {
    paths.push(JUANIE_GITLAB_CI_PATH);
  }

  return paths;
}

async function cleanupRepositoryArtifacts(project: ProjectDeleteRecord): Promise<void> {
  if (!project.repository) {
    return;
  }

  try {
    const session = await getTeamIntegrationSession({
      integrationId: project.repository.providerId,
      teamId: project.teamId,
      requiredCapabilities: ['read_repo', 'write_repo'],
    });
    const branch = project.productionBranch || project.repository.defaultBranch || 'main';
    let gitlabCiContent: string | null = null;

    if (session.provider === 'gitlab' || session.provider === 'gitlab-self-hosted') {
      gitlabCiContent = await gateway.getFileContent(
        session,
        project.repository.fullName,
        JUANIE_GITLAB_CI_PATH,
        branch
      );
    }

    const paths = buildJuanieRepositoryCleanupPaths({
      provider: session.provider,
      gitlabCiContent,
    });

    if (paths.length === 0) {
      return;
    }

    await gateway.deleteFiles(session, {
      repoFullName: project.repository.fullName,
      branch,
      paths,
      message: 'Remove Juanie managed files [skip ci]',
    });
  } catch (error) {
    projectDeleteLogger.warn('Failed to clean repository artifacts for project', {
      projectId: project.id,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

async function cleanupOrphanRepositoryRecord(repositoryId: string): Promise<void> {
  try {
    const attachedProject = await db.query.projects.findFirst({
      where: eq(projects.repositoryId, repositoryId),
      columns: {
        id: true,
      },
    });

    if (attachedProject) {
      return;
    }

    await db.delete(repositories).where(eq(repositories.id, repositoryId));
  } catch (error) {
    projectDeleteLogger.warn('Failed to clean orphan repository record', {
      repositoryId,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  }
}

async function cleanupManagedDatabasesForProject(projectId: string): Promise<void> {
  const databaseList = await db.query.databases.findMany({
    where: eq(databases.projectId, projectId),
    columns: {
      id: true,
      name: true,
      type: true,
      provisionType: true,
      runtime: true,
      host: true,
      port: true,
      databaseName: true,
      username: true,
      connectionString: true,
      namespace: true,
      serviceName: true,
    },
  });

  for (const database of databaseList) {
    try {
      await deprovisionManagedDatabase(database);
    } catch (error) {
      throw new Error(
        `Failed to deprovision managed database ${database.databaseName ?? database.name}`,
        { cause: error }
      );
    }
  }
}

export async function processProjectDelete(job: Job<ProjectDeleteJobData>) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, job.data.projectId),
    columns: {
      id: true,
      slug: true,
      status: true,
      teamId: true,
      productionBranch: true,
      repositoryId: true,
    },
    with: {
      repository: {
        columns: {
          providerId: true,
          fullName: true,
          defaultBranch: true,
        },
      },
    },
  });

  if (!project) {
    await publishProjectDeletedRealtimeEvent(job.data.projectId).catch((error) => {
      projectDeleteLogger.warn(
        'Failed to publish project deleted realtime event for missing project',
        {
          projectId: job.data.projectId,
          errorMessage: error instanceof Error ? error.message : String(error),
        }
      );
    });
    return { success: true, deleted: true, missing: true };
  }

  const environmentList = await db.query.environments.findMany({
    where: eq(environments.projectId, project.id),
    columns: {
      namespace: true,
    },
  });

  const namespaces = [
    ...new Set(
      environmentList
        .map((environment) => environment.namespace)
        .filter((namespace): namespace is string => Boolean(namespace))
    ),
  ];

  if (isK8sAvailable() && namespaces.length > 0) {
    await deleteProjectPreviewApplicationSet(project.slug);
    await Promise.all(namespaces.map((namespace) => deleteNamespace(namespace)));

    const cleanupResults = await Promise.all(
      namespaces.map(async (namespace) => ({
        namespace,
        deleted: await waitForNamespaceDeleted({ name: namespace }),
      }))
    );
    const pendingNamespaces = cleanupResults
      .filter((result) => !result.deleted)
      .map((result) => result.namespace);

    if (pendingNamespaces.length > 0) {
      await publishProjectRealtimeSnapshot(project.id).catch((error) => {
        projectDeleteLogger.warn('Failed to refresh deleting project snapshot', {
          projectId: project.id,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      });
      throw new Error(`Project resources are still cleaning up: ${pendingNamespaces.join(', ')}`);
    }
  }

  await cleanupManagedDatabasesForProject(project.id);
  await cleanupRepositoryArtifacts(project);

  const repositoryId = project.repositoryId;
  await db.delete(projects).where(eq(projects.id, project.id));
  if (repositoryId) {
    await cleanupOrphanRepositoryRecord(repositoryId);
  }

  await publishProjectDeletedRealtimeEvent(project.id).catch((error) => {
    projectDeleteLogger.warn('Failed to publish project deleted realtime event', {
      projectId: project.id,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  });

  return { success: true, deleted: true };
}

export function createProjectDeleteWorker() {
  return new Worker<ProjectDeleteJobData>('project-delete', processProjectDelete, {
    connection: resolveRedisConnectionOptions({
      maxRetriesPerRequest: null,
    }),
    concurrency: 2,
  });
}
