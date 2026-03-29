import { and, desc, eq, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  environments,
  projects,
  releaseArtifacts,
  releases,
  repositories,
  services,
} from '@/lib/db/schema';
import { resolvePreviewEnvironment } from '@/lib/environments/preview';
import { ensurePreviewEnvironmentForRef } from '@/lib/environments/service';
import { addReleaseJob } from '@/lib/queue';
import { buildDefaultReleaseSummary } from '@/lib/releases/presentation';

type EnvironmentRecord = typeof environments.$inferSelect;

export interface ReleaseServiceInput {
  id?: string;
  name?: string;
  image: string;
  digest?: string | null;
}

export interface CreateRepositoryReleaseInput {
  repository: string;
  ref: string;
  sha?: string | null;
  services?: ReleaseServiceInput[];
  serviceId?: string;
  serviceName?: string;
  image?: string;
  triggeredBy?: 'api' | 'manual';
  triggeredByUserId?: string | null;
  summary?: string | null;
}

export interface CreateProjectReleaseInput {
  projectId: string;
  environmentId: string;
  services: ReleaseServiceInput[];
  sourceRepository: string;
  sourceRef: string;
  sourceCommitSha?: string | null;
  configCommitSha?: string | null;
  triggeredBy?: 'api' | 'manual';
  triggeredByUserId?: string | null;
  summary?: string | null;
}

function matchesGlob(pattern: string, value: string): boolean {
  const regex = new RegExp(
    `^${pattern.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*')}$`
  );
  return regex.test(value);
}

export function resolveEnvironment(
  ref: string,
  envs: EnvironmentRecord[]
): EnvironmentRecord | undefined {
  const previewEnvironment = resolvePreviewEnvironment(ref, envs);
  if (previewEnvironment) {
    return previewEnvironment;
  }

  if (ref.startsWith('refs/tags/')) {
    const tag = ref.slice('refs/tags/'.length);
    const byTag = envs.find((env) => env.tagPattern && matchesGlob(env.tagPattern, tag));
    if (byTag) {
      return byTag;
    }
    return envs.find((env) => env.branch === 'main' || env.branch === 'master');
  }

  const branch = ref.replace('refs/heads/', '');
  return envs.find((env) => env.branch === branch);
}

async function resolveReleaseServices(
  projectId: string,
  projectServices: Array<typeof services.$inferSelect>,
  inputs: ReleaseServiceInput[]
) {
  const artifacts = [];

  for (const input of inputs) {
    let service =
      (input.id ? projectServices.find((candidate) => candidate.id === input.id) : undefined) ??
      (input.name ? projectServices.find((candidate) => candidate.name === input.name) : undefined);

    if (!service && projectServices.length === 1) {
      service = projectServices[0];
    }

    if (!service || service.projectId !== projectId) {
      throw new Error(
        `Unable to resolve service for release artifact ${input.name ?? input.id ?? input.image}`
      );
    }

    artifacts.push({
      service,
      imageUrl: input.image,
      imageDigest: input.digest ?? null,
    });
  }

  return artifacts;
}

async function persistRelease(
  project: typeof projects.$inferSelect & { services: Array<typeof services.$inferSelect> },
  environment: typeof environments.$inferSelect,
  requestedServices: ReleaseServiceInput[],
  meta: {
    sourceRepository: string;
    sourceRef: string;
    sourceCommitSha?: string | null;
    configCommitSha?: string | null;
    triggeredBy?: 'api' | 'manual';
    triggeredByUserId?: string | null;
    summary?: string | null;
  }
) {
  if (requestedServices.length === 0) {
    throw new Error('At least one release service artifact is required');
  }

  if (
    requestedServices.length === 1 &&
    !requestedServices[0].id &&
    !requestedServices[0].name &&
    project.services.length > 1
  ) {
    throw new Error(
      'Multi-service projects must specify serviceId/serviceName or use services[] when creating a release'
    );
  }

  const artifacts = await resolveReleaseServices(project.id, project.services, requestedServices);
  const [release] = await db
    .insert(releases)
    .values({
      projectId: project.id,
      environmentId: environment.id,
      sourceRepository: meta.sourceRepository,
      sourceRef: meta.sourceRef,
      sourceCommitSha: meta.sourceCommitSha ?? null,
      configCommitSha: meta.configCommitSha ?? meta.sourceCommitSha ?? null,
      status: 'queued',
      triggeredBy: meta.triggeredBy ?? 'api',
      triggeredByUserId: meta.triggeredByUserId ?? null,
      summary:
        meta.summary ??
        buildDefaultReleaseSummary({
          sourceRef: meta.sourceRef,
          sourceCommitSha: meta.sourceCommitSha ?? null,
          isPreview: environment.isPreview,
        }),
    })
    .returning();

  await db.insert(releaseArtifacts).values(
    artifacts.map((artifact) => ({
      releaseId: release.id,
      serviceId: artifact.service.id,
      imageUrl: artifact.imageUrl,
      imageDigest: artifact.imageDigest,
    }))
  );

  await addReleaseJob(release.id);

  return db.query.releases.findFirst({
    where: eq(releases.id, release.id),
    with: {
      environment: true,
      artifacts: {
        with: {
          service: true,
        },
      },
    },
  });
}

export async function createRepositoryRelease(input: CreateRepositoryReleaseInput) {
  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.fullName, input.repository),
  });

  if (!repo) {
    throw new Error(`Repository ${input.repository} not found in Juanie`);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.repositoryId, repo.id),
    with: {
      environments: true,
      services: true,
    },
  });

  if (!project) {
    throw new Error(`No project linked to repository ${input.repository}`);
  }

  let environment = resolveEnvironment(input.ref, project.environments);
  if (!environment) {
    const previewEnvironment = await ensurePreviewEnvironmentForRef({
      projectId: project.id,
      projectSlug: project.slug,
      ref: input.ref,
    });

    if (previewEnvironment) {
      environment = previewEnvironment;
    }
  }

  if (!environment) {
    throw new Error(`No environment configured for ref ${input.ref}`);
  }

  const requestedServices =
    input.services && input.services.length > 0
      ? input.services
      : input.image
        ? [
            {
              id: input.serviceId,
              name: input.serviceName,
              image: input.image,
            },
          ]
        : [];

  return persistRelease(project, environment, requestedServices, {
    sourceRepository: input.repository,
    sourceRef: input.ref,
    sourceCommitSha: input.sha ?? null,
    configCommitSha: input.sha ?? null,
    triggeredBy: input.triggeredBy,
    triggeredByUserId: input.triggeredByUserId ?? null,
    summary: input.summary ?? null,
  });
}

export async function createProjectRelease(input: CreateProjectReleaseInput) {
  const project = await db.query.projects.findFirst({
    where: eq(projects.id, input.projectId),
    with: {
      services: true,
    },
  });

  if (!project) {
    throw new Error(`Project ${input.projectId} not found`);
  }

  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, input.environmentId),
  });

  if (!environment || environment.projectId !== project.id) {
    throw new Error(`Environment ${input.environmentId} not found`);
  }

  return persistRelease(project, environment, input.services, {
    sourceRepository: input.sourceRepository,
    sourceRef: input.sourceRef,
    sourceCommitSha: input.sourceCommitSha ?? null,
    configCommitSha: input.configCommitSha ?? input.sourceCommitSha ?? null,
    triggeredBy: input.triggeredBy,
    triggeredByUserId: input.triggeredByUserId ?? null,
    summary: input.summary ?? null,
  });
}

export async function getReleaseById(releaseId: string) {
  return db.query.releases.findFirst({
    where: eq(releases.id, releaseId),
    with: {
      project: {
        with: {
          repository: true,
        },
      },
      environment: {
        with: {
          baseEnvironment: {
            columns: {
              id: true,
              name: true,
            },
          },
          databases: {
            columns: {
              id: true,
              name: true,
              status: true,
              sourceDatabaseId: true,
            },
          },
          domains: {
            with: {
              service: true,
            },
          },
        },
      },
      artifacts: {
        with: {
          service: true,
        },
      },
      deployments: true,
      migrationRuns: {
        with: {
          service: true,
          database: true,
          specification: true,
          items: true,
        },
      },
    },
  });
}

export async function getPreviousReleaseByScope(input: {
  projectId: string;
  environmentId: string;
  createdAt: Date;
}) {
  return db.query.releases.findFirst({
    where: and(
      eq(releases.projectId, input.projectId),
      eq(releases.environmentId, input.environmentId),
      lt(releases.createdAt, input.createdAt)
    ),
    orderBy: [desc(releases.createdAt)],
    with: {
      artifacts: {
        with: {
          service: true,
        },
      },
      migrationRuns: {
        with: {
          service: true,
          database: true,
          specification: true,
        },
      },
    },
  });
}
