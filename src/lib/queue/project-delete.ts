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
import { getProjectProductionBranch } from '@/lib/projects/refs';
import {
  publishProjectDeletedRealtimeEvent,
  publishProjectRealtimeSnapshot,
} from '@/lib/realtime/projects';

const JUANIE_BASE_REPOSITORY_FILES = [
  'juanie.yaml',
  '.juanie/build-run.sh',
  '.juanie/delivery-artifacts.sh',
  '.juanie/workload-identity.sh',
  '.juanie/affected-workspace.mjs',
  '.env.juanie.example',
  'JUANIE.md',
] as const;
const JUANIE_GITHUB_WORKFLOW_PATH = '.github/workflows/juanie-ci.yml';
const JUANIE_GITLAB_CI_PATH = '.gitlab-ci.yml';
const JUANIE_GITLAB_CI_MARKERS = [
  'https://juanie.art/api/build-runs',
  '.juanie/build-run.sh',
  'JUANIE_SOURCE_SHA',
] as const;
const projectDeleteLogger = logger.child({ component: 'project-delete' });

export type ProjectDeleteRecord = Pick<
  typeof projects.$inferSelect,
  'id' | 'slug' | 'status' | 'teamId' | 'productionBranch' | 'repositoryId'
> & {
  repository: Pick<
    typeof repositories.$inferSelect,
    'providerId' | 'fullName' | 'defaultBranch'
  > | null;
};

interface ProjectDeleteEnvironmentRecord {
  namespace: string | null;
  isPreview: boolean | null;
}

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

export function shouldDeleteProjectPreviewApplicationSet(
  environmentsForProject: ProjectDeleteEnvironmentRecord[]
): boolean {
  return environmentsForProject.some((environment) => environment.isPreview);
}

async function updateProjectDeleteState(input: {
  projectId: string;
  status: 'deleting' | 'failed';
  statusMessage: string | null;
}): Promise<void> {
  await db
    .update(projects)
    .set({
      status: input.status,
      statusMessage: input.statusMessage,
      updatedAt: new Date(),
    })
    .where(eq(projects.id, input.projectId));

  await publishProjectRealtimeSnapshot(input.projectId).catch((error) => {
    projectDeleteLogger.warn('Failed to publish project delete snapshot', {
      projectId: input.projectId,
      status: input.status,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  });
}

async function cleanupRepositoryArtifacts(project: ProjectDeleteRecord): Promise<void> {
  if (!project.repository) {
    return;
  }

  const repository = project.repository;

  try {
    const session = await getTeamIntegrationSession({
      integrationId: repository.providerId,
      teamId: project.teamId,
      requiredCapabilities: ['read_repo', 'write_repo'],
    });
    const branch = getProjectProductionBranch(project);
    let gitlabCiContent: string | null = null;

    if (session.provider === 'gitlab' || session.provider === 'gitlab-self-hosted') {
      gitlabCiContent = await gateway.getFileContent(
        session,
        repository.fullName,
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
      repoFullName: repository.fullName,
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

export interface ProjectDeletionPlan {
  project: ProjectDeleteRecord;
  namespaces: string[];
  hasPreviewApplicationSet: boolean;
}

export async function prepareProjectDeletion(
  projectId: string
): Promise<ProjectDeletionPlan | null> {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, projectId),
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
    await publishProjectDeletedRealtimeEvent(projectId).catch((error) => {
      projectDeleteLogger.warn(
        'Failed to publish project deleted realtime event for missing project',
        {
          projectId,
          errorMessage: error instanceof Error ? error.message : String(error),
        }
      );
    });
    return null;
  }

  const environmentList = await db.query.environments.findMany({
    where: eq(environments.projectId, project.id),
    columns: {
      namespace: true,
      isPreview: true,
    },
  });

  const namespaces = [
    ...new Set(
      environmentList
        .map((environment) => environment.namespace)
        .filter((namespace): namespace is string => Boolean(namespace))
    ),
  ];
  return {
    project,
    namespaces,
    hasPreviewApplicationSet: shouldDeleteProjectPreviewApplicationSet(environmentList),
  };
}

export async function deleteProjectRuntimeResources(plan: ProjectDeletionPlan): Promise<void> {
  if (!isK8sAvailable() || plan.namespaces.length === 0) {
    return;
  }

  if (plan.hasPreviewApplicationSet) {
    await deleteProjectPreviewApplicationSet(plan.project.slug);
  }

  await Promise.all(plan.namespaces.map((namespace) => deleteNamespace(namespace)));
  const cleanupResults = await Promise.all(
    plan.namespaces.map(async (namespace) => ({
      namespace,
      deleted: await waitForNamespaceDeleted({ name: namespace }),
    }))
  );
  const pendingNamespaces = cleanupResults
    .filter((result) => !result.deleted)
    .map((result) => result.namespace);

  if (pendingNamespaces.length > 0) {
    throw new Error(`Project resources are still cleaning up: ${pendingNamespaces.join(', ')}`);
  }
}

export async function deleteProjectManagedDatabases(projectId: string): Promise<void> {
  await cleanupManagedDatabasesForProject(projectId);
}

export async function deleteProjectRepositoryArtifacts(
  project: ProjectDeleteRecord
): Promise<void> {
  await cleanupRepositoryArtifacts(project);
}

export async function deleteProjectControlPlaneRecord(project: ProjectDeleteRecord): Promise<void> {
  await db.delete(projects).where(eq(projects.id, project.id));
  if (project.repositoryId) {
    await cleanupOrphanRepositoryRecord(project.repositoryId);
  }

  await publishProjectDeletedRealtimeEvent(project.id).catch((error) => {
    projectDeleteLogger.warn('Failed to publish project deleted realtime event', {
      projectId: project.id,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  });
}

export async function failProjectDeletion(projectId: string, error: unknown): Promise<void> {
  const message = error instanceof Error ? error.message : String(error);
  await updateProjectDeleteState({
    projectId,
    status: 'failed',
    statusMessage: `项目删除失败，可重新发起删除：${message}`,
  });
}
