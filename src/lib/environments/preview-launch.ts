import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { projects, releases } from '@/lib/db/schema';
import { setPreviewEnvironmentBuildState } from '@/lib/environments/preview-build-state';
import { ensurePreviewEnvironmentForRef } from '@/lib/environments/service';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import { createProjectRelease, type ReleaseServiceInput } from '@/lib/releases';
import { resolveEnvironmentRoute } from '@/lib/releases/routing';

interface PreviewLaunchProject {
  id: string;
  slug: string;
  teamId: string;
  repository: {
    id: string;
    fullName: string;
    providerId: string;
    defaultBranch: string | null;
  };
  services: Array<{
    id: string;
    name: string;
  }>;
}

interface ReusableArtifactRelease {
  artifacts: Array<{
    serviceId: string;
    imageUrl: string;
    service: {
      id: string;
      name: string;
    };
  }>;
}

export function collectReusableReleaseServices(input: {
  projectServices: PreviewLaunchProject['services'];
  releasesForCommit: ReusableArtifactRelease[];
}): ReleaseServiceInput[] | null {
  const latestImageByServiceId = new Map<string, ReleaseServiceInput>();

  for (const release of input.releasesForCommit) {
    for (const artifact of release.artifacts) {
      if (!artifact.serviceId || latestImageByServiceId.has(artifact.serviceId)) {
        continue;
      }

      latestImageByServiceId.set(artifact.serviceId, {
        id: artifact.service.id,
        name: artifact.service.name,
        image: artifact.imageUrl,
      });
    }
  }

  const services = input.projectServices.map(
    (service) => latestImageByServiceId.get(service.id) ?? null
  );
  return services.every((service): service is ReleaseServiceInput => service !== null)
    ? services
    : null;
}

async function loadReusableReleaseServicesByCommit(input: {
  projectId: string;
  sourceCommitSha: string;
  projectServices: PreviewLaunchProject['services'];
}): Promise<ReleaseServiceInput[] | null> {
  const releasesForCommit = await db.query.releases.findMany({
    where: and(
      eq(releases.projectId, input.projectId),
      eq(releases.sourceCommitSha, input.sourceCommitSha)
    ),
    orderBy: [desc(releases.createdAt)],
    limit: 20,
    with: {
      artifacts: {
        columns: {
          serviceId: true,
          imageUrl: true,
        },
        with: {
          service: {
            columns: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  return collectReusableReleaseServices({
    projectServices: input.projectServices,
    releasesForCommit,
  });
}

export async function resolveRepositoryCommitSha(input: {
  teamId: string;
  providerId: string;
  repositoryFullName: string;
  ref: string;
}): Promise<string | null> {
  const session = await getTeamIntegrationSession({
    integrationId: input.providerId,
    teamId: input.teamId,
    requiredCapabilities: ['read_repo'],
  });

  return gateway.resolveRefToCommitSha(session, input.repositoryFullName, input.ref);
}

async function triggerPreviewBuild(input: {
  project: PreviewLaunchProject;
  ref: string;
  sourceCommitSha: string;
}): Promise<void> {
  const session = await getTeamIntegrationSession({
    integrationId: input.project.repository.providerId,
    teamId: input.project.teamId,
    requiredCapabilities: ['write_workflow'],
  });

  await gateway.triggerReleaseBuild(session, {
    repoFullName: input.project.repository.fullName,
    ref: input.ref,
    releaseRef: input.ref,
    sourceCommitSha: input.sourceCommitSha,
    forceFullBuild: true,
  });
}

export async function launchPreviewEnvironmentFromRef(input: {
  projectId: string;
  ref: string;
  ttlHours?: number;
  databaseStrategy?: 'inherit' | 'isolated_clone';
  triggeredByUserId: string;
}) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    columns: {
      id: true,
      slug: true,
      teamId: true,
    },
    with: {
      environments: true,
      deliveryRules: true,
      repository: {
        columns: {
          id: true,
          fullName: true,
          providerId: true,
          defaultBranch: true,
        },
      },
      services: {
        columns: {
          id: true,
          name: true,
        },
      },
    },
  });

  if (!project?.repository) {
    throw new Error('项目未绑定仓库，无法从分支启动预览环境');
  }

  if (project.services.length === 0) {
    throw new Error('项目还没有可部署的服务，暂时无法启动预览环境');
  }

  const launchProject: PreviewLaunchProject = {
    id: project.id,
    slug: project.slug,
    teamId: project.teamId,
    repository: project.repository,
    services: project.services,
  };

  const sourceCommitSha = await resolveRepositoryCommitSha({
    teamId: launchProject.teamId,
    providerId: launchProject.repository.providerId,
    repositoryFullName: launchProject.repository.fullName,
    ref: input.ref,
  });

  if (!sourceCommitSha) {
    throw new Error('无法解析该分支或 PR 的最新提交，请确认它在远端仓库中存在');
  }

  const previewRoute = resolveEnvironmentRoute({
    ref: input.ref,
    environments: project.environments,
    deliveryRules: project.deliveryRules,
  });

  const environment = await ensurePreviewEnvironmentForRef({
    projectId: launchProject.id,
    projectSlug: launchProject.slug,
    ref: input.ref,
    ttlHours: input.ttlHours,
    databaseStrategy: input.databaseStrategy,
    baseEnvironmentId:
      previewRoute.sourceEvent.sourceType === 'pull_request'
        ? (previewRoute.rule?.environmentId ?? undefined)
        : undefined,
  });

  if (!environment) {
    throw new Error('无法为这个来源创建预览环境');
  }

  const reusableServices = await loadReusableReleaseServicesByCommit({
    projectId: launchProject.id,
    sourceCommitSha,
    projectServices: launchProject.services,
  });

  if (reusableServices) {
    const release = await createProjectRelease({
      projectId: launchProject.id,
      environmentId: environment.id,
      services: reusableServices,
      sourceRepository: launchProject.repository.fullName,
      sourceRef: input.ref,
      sourceCommitSha,
      configCommitSha: sourceCommitSha,
      triggeredBy: 'manual',
      triggeredByUserId: input.triggeredByUserId,
      summary: `Preview deploy ${sourceCommitSha.slice(0, 7)}`,
      entryPoint: 'preview_launch',
    });

    return {
      environment,
      release,
      sourceCommitSha,
      launchState: 'deploying' as const,
    };
  }

  const previewBuildStartedAt = new Date();

  await setPreviewEnvironmentBuildState({
    environmentId: environment.id,
    status: 'building',
    sourceRef: input.ref,
    sourceCommitSha,
    startedAt: previewBuildStartedAt,
  });

  try {
    await triggerPreviewBuild({
      project: launchProject,
      ref: input.ref,
      sourceCommitSha,
    });
  } catch (error) {
    await setPreviewEnvironmentBuildState({
      environmentId: environment.id,
      status: 'failed',
      sourceRef: input.ref,
      sourceCommitSha,
      startedAt: previewBuildStartedAt,
    });
    throw error;
  }

  return {
    environment,
    release: null,
    sourceCommitSha,
    launchState: 'building' as const,
  };
}
