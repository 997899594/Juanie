import { and, desc, eq, lt } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  deliveryRules,
  environments,
  projects,
  releaseArtifacts,
  releases,
  repositories,
  services,
} from '@/lib/db/schema';
import { resolveProjectPreviewDatabaseStrategy } from '@/lib/environments/database-strategy';
import { ensurePreviewEnvironmentForRef } from '@/lib/environments/service';
import {
  clearEnvironmentSourceBuildState,
  setEnvironmentSourceBuildState,
} from '@/lib/environments/source-build-state';
import { logger } from '@/lib/logger';
import { invalidateMigrationFilePreviewCache } from '@/lib/migrations/file-preview';
import { addReleaseJob } from '@/lib/queue';
import { publishReleaseRealtimeSnapshot } from '@/lib/realtime/releases';
import { assertReleaseEntryPointAllowed, type ReleaseEntryPoint } from '@/lib/releases/admission';
import { prewarmReleaseMigrationPreviewCache } from '@/lib/releases/migration-preview-prewarm';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import { buildDefaultReleaseSummary } from '@/lib/releases/presentation';
import {
  inspectPreviewDatabaseGuardForRelease,
  PreviewDatabaseGuardBlockedError,
  previewDatabaseGuardMessage,
} from '@/lib/releases/preview-database-guard';
import { resolveEnvironmentRoute } from '@/lib/releases/routing';
import { inspectReleaseSchemaGate, ReleaseSchemaGateBlockedError } from '@/lib/schema-safety';
import { syncProjectServiceRuntimeContractsFromRepo } from '@/lib/services/runtime-contract';
import { buildTraceLogFields, createTraceId } from '@/lib/trace/context';
import { getDeliveryReleaseArtifacts, getDeployableReleaseArtifacts } from './artifacts';

type EnvironmentRecord = typeof environments.$inferSelect;
type DeliveryRuleRecord = typeof deliveryRules.$inferSelect;
const releaseServiceLogger = logger.child({ component: 'release-service' });

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
  sourceReleaseId?: string | null;
  triggeredBy?: 'api' | 'manual';
  triggeredByUserId?: string | null;
  summary?: string | null;
  entryPoint?: ReleaseEntryPoint;
}

export interface PersistedAdmissionRelease {
  id: string;
  projectId: string;
  environmentId: string;
  releasePath: string;
}

export function resolveEnvironment(
  ref: string,
  envs: EnvironmentRecord[],
  rules: DeliveryRuleRecord[] = []
): EnvironmentRecord | undefined {
  return (
    resolveEnvironmentRoute({
      ref,
      environments: envs,
      deliveryRules: rules,
    }).environment ?? undefined
  );
}

async function resolveReleaseServices(
  projectId: string,
  projectServices: Array<typeof services.$inferSelect>,
  inputs: ReleaseServiceInput[]
) {
  const artifacts = [];
  const resolvedServiceIds = new Set<string>();

  for (const input of inputs) {
    let service =
      (input.id ? projectServices.find((candidate) => candidate.id === input.id) : undefined) ??
      (input.name ? projectServices.find((candidate) => candidate.name === input.name) : undefined);

    if (!service && !input.id && !input.name && projectServices.length === 1) {
      service = projectServices[0];
    }

    if (!service || service.projectId !== projectId) {
      throw new Error(
        `Unable to resolve service for release artifact ${input.name ?? input.id ?? input.image}`
      );
    }

    if (resolvedServiceIds.has(service.id)) {
      throw new Error(`Release payload contains duplicate artifact for service ${service.name}`);
    }
    resolvedServiceIds.add(service.id);

    artifacts.push({
      service,
      imageUrl: input.image,
      imageDigest: input.digest ?? null,
      kind: 'image' as const,
      name: service.name,
      uri: input.image,
      status: 'succeeded' as const,
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
    sourceReleaseId?: string | null;
    triggeredBy?: 'api' | 'manual';
    triggeredByUserId?: string | null;
    summary?: string | null;
  }
) {
  if (requestedServices.length === 0) {
    throw new Error('At least one release artifact is required');
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
  const sourceDeliveryArtifacts = meta.sourceReleaseId
    ? getDeliveryReleaseArtifacts(
        (
          await db.query.releases.findFirst({
            where: and(eq(releases.id, meta.sourceReleaseId), eq(releases.projectId, project.id)),
            with: {
              artifacts: true,
            },
          })
        )?.artifacts ?? []
      )
    : [];
  const deployableArtifacts = getDeployableReleaseArtifacts(artifacts);
  const deployableServiceIds = deployableArtifacts.map((artifact) => artifact.service.id);

  const [release] = await db
    .insert(releases)
    .values({
      projectId: project.id,
      environmentId: environment.id,
      sourceRepository: meta.sourceRepository,
      sourceRef: meta.sourceRef,
      sourceCommitSha: meta.sourceCommitSha ?? null,
      configCommitSha: meta.configCommitSha ?? meta.sourceCommitSha ?? null,
      sourceReleaseId: meta.sourceReleaseId ?? null,
      status: 'admission_running',
      triggeredBy: meta.triggeredBy ?? 'api',
      triggeredByUserId: meta.triggeredByUserId ?? null,
      summary:
        meta.summary ??
        buildDefaultReleaseSummary({
          sourceRef: meta.sourceRef,
          sourceCommitSha: meta.sourceCommitSha ?? null,
          environment,
        }),
    })
    .returning();

  const releasePath = buildReleaseDetailPath(project.id, environment.id, release.id);
  const admissionRelease = {
    id: release.id,
    projectId: release.projectId,
    environmentId: release.environmentId,
    releasePath,
  } satisfies PersistedAdmissionRelease;

  const failAdmission = async (errorMessage: string) => {
    await db
      .update(releases)
      .set({
        status: 'admission_failed',
        errorMessage,
        updatedAt: new Date(),
      })
      .where(eq(releases.id, release.id));
    await publishReleaseRealtimeSnapshot(release.id);
  };

  const previewDatabaseGuard =
    deployableServiceIds.length > 0
      ? await inspectPreviewDatabaseGuardForRelease({
          projectId: project.id,
          environmentId: environment.id,
          environment,
          serviceIds: deployableServiceIds,
          sourceRef: meta.sourceRef,
          sourceCommitSha: meta.sourceCommitSha ?? null,
        })
      : { canCreate: true as const };

  if (!previewDatabaseGuard.canCreate) {
    await failAdmission(previewDatabaseGuard.blockingReason ?? previewDatabaseGuardMessage);
    throw new PreviewDatabaseGuardBlockedError(previewDatabaseGuard, undefined, admissionRelease);
  }

  const schemaGate =
    deployableServiceIds.length > 0
      ? await inspectReleaseSchemaGate({
          projectId: project.id,
          environmentId: environment.id,
          serviceIds: deployableServiceIds,
          sourceRef: meta.sourceRef,
          sourceCommitSha: meta.sourceCommitSha ?? null,
        })
      : { canCreate: true as const };

  if (!schemaGate.canCreate) {
    await failAdmission(schemaGate.blockingReason ?? 'Release blocked by schema state');
    throw new ReleaseSchemaGateBlockedError(schemaGate, admissionRelease);
  }

  try {
    await db.insert(releaseArtifacts).values([
      ...artifacts.map((artifact) => ({
        releaseId: release.id,
        serviceId: artifact.service.id,
        kind: artifact.kind,
        name: artifact.name,
        uri: artifact.uri,
        status: artifact.status,
        imageUrl: artifact.imageUrl,
        imageDigest: artifact.imageDigest,
      })),
      ...sourceDeliveryArtifacts.map((artifact) => ({
        releaseId: release.id,
        serviceId: null,
        kind: artifact.kind,
        name: artifact.name,
        variant: artifact.variant,
        platform: artifact.platform,
        format: artifact.format,
        uri: artifact.uri,
        checksum: artifact.checksum,
        sizeBytes: artifact.sizeBytes,
        sbomUri: artifact.sbomUri,
        provenanceUri: artifact.provenanceUri,
        status: artifact.status,
        imageUrl: null,
        imageDigest: null,
        sourceServiceId: artifact.sourceServiceId,
        sourceImageUri: artifact.sourceImageUri,
        sourceImageDigest: artifact.sourceImageDigest,
        sourceImagePlatform: artifact.sourceImagePlatform,
      })),
    ]);

    await db
      .update(releases)
      .set({
        status: 'queued',
        errorMessage: null,
        updatedAt: new Date(),
      })
      .where(eq(releases.id, release.id));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await failAdmission(message);
    throw error;
  }

  if (environment.previewBuildStatus) {
    await clearEnvironmentSourceBuildState(environment.id);
  }

  const traceId = createTraceId(release.id);
  releaseServiceLogger.info('Release queued', {
    ...buildTraceLogFields({
      traceId,
      projectId: project.id,
      environmentId: environment.id,
      releaseId: release.id,
    }),
    serviceCount: artifacts.length,
    artifactCount: artifacts.length,
  });

  await addReleaseJob(release.id, { traceId });
  await publishReleaseRealtimeSnapshot(release.id);

  void (async () => {
    try {
      invalidateMigrationFilePreviewCache({ projectId: project.id });
      await prewarmReleaseMigrationPreviewCache({
        projectId: project.id,
        environmentId: environment.id,
        sourceRef: meta.sourceRef,
        sourceCommitSha: meta.sourceCommitSha ?? null,
        serviceIds: deployableServiceIds,
      });
    } catch (error) {
      releaseServiceLogger.warn('Failed to prewarm migration preview cache', {
        releaseId: release.id,
        projectId: project.id,
        environmentId: environment.id,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return db.query.releases.findFirst({
    where: eq(releases.id, release.id),
    with: {
      environment: true,
      sourceRelease: {
        with: {
          environment: true,
        },
      },
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
      deliveryRules: true,
      environments: true,
      services: true,
    },
  });

  if (!project) {
    throw new Error(`No project linked to repository ${input.repository}`);
  }

  const route = resolveEnvironmentRoute({
    ref: input.ref,
    environments: project.environments,
    deliveryRules: project.deliveryRules,
  });

  let environment = route.environment;
  if (!environment) {
    const previewEnvironment =
      route.rule?.kind === 'pull_request' && route.rule.autoCreateEnvironment
        ? await ensurePreviewEnvironmentForRef({
            projectId: project.id,
            projectSlug: project.slug,
            projectConfigJson: project.configJson,
            ref: input.ref,
            databaseStrategy: resolveProjectPreviewDatabaseStrategy(project.configJson),
            baseEnvironmentId: route.rule.environmentId ?? null,
          })
        : null;

    if (previewEnvironment) {
      environment = previewEnvironment;
    }
  }

  if (!environment) {
    throw new Error(`No environment configured for ref ${input.ref}`);
  }

  assertReleaseEntryPointAllowed(environment, 'repository_route');

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
  try {
    const syncedServices = await syncProjectServiceRuntimeContractsFromRepo({
      projectId: project.id,
      sourceRef: input.ref,
      sourceCommitSha: input.sha ?? null,
    });

    return await persistRelease(
      { ...project, services: syncedServices },
      environment,
      requestedServices,
      {
        sourceRepository: input.repository,
        sourceRef: input.ref,
        sourceCommitSha: input.sha ?? null,
        configCommitSha: input.sha ?? null,
        triggeredBy: input.triggeredBy,
        triggeredByUserId: input.triggeredByUserId ?? null,
        summary: input.summary ?? null,
      }
    );
  } catch (error) {
    if (environment.previewBuildStatus === 'building') {
      await setEnvironmentSourceBuildState({
        environmentId: environment.id,
        status: 'failed',
        sourceRef: input.ref,
        sourceCommitSha: input.sha ?? null,
        startedAt: environment.previewBuildStartedAt ?? new Date(),
      });
    }

    throw error;
  }
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

  assertReleaseEntryPointAllowed(environment, input.entryPoint ?? 'manual_release');

  return persistRelease(project, environment, input.services, {
    sourceRepository: input.sourceRepository,
    sourceRef: input.sourceRef,
    sourceCommitSha: input.sourceCommitSha ?? null,
    configCommitSha: input.configCommitSha ?? input.sourceCommitSha ?? null,
    sourceReleaseId: input.sourceReleaseId ?? null,
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
      sourceRelease: {
        with: {
          environment: {
            columns: {
              id: true,
              name: true,
              kind: true,
              isProduction: true,
              isPreview: true,
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
