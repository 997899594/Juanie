import { and, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { type BuildPlan, createBuildPlan, getBuildPlanReleaseServices } from '@/lib/builds/plan';
import {
  issueBuildSecretCapability,
  verifyBuildSecretCapability,
} from '@/lib/builds/secret-capability';
import { decrypt } from '@/lib/crypto';
import { db } from '@/lib/db';
import {
  type BuildArtifactKind,
  type BuildRunStatus,
  type BuildUnitStatus,
  buildArtifacts,
  buildRuns,
  buildUnits,
  deliveryRules,
  environments,
  environmentVariables,
  projects,
  releases,
  repositories,
  services,
} from '@/lib/db/schema';
import { getEnvironmentLineage } from '@/lib/environments/inheritance';
import { createRepositoryRelease } from '@/lib/releases';
import { verifyRepositoryAccess } from '@/lib/releases/api-access';
import { buildReleaseDetailPath } from '@/lib/releases/paths';
import { resolveEnvironmentRoute } from '@/lib/releases/routing';

export class BuildRunError extends Error {
  constructor(
    message: string,
    public readonly statusCode = 400
  ) {
    super(message);
  }
}

export interface StartBuildRunInput {
  repository: string;
  ref: string;
  sha: string;
  registry?: string;
  services?: string[];
  targets?: string[];
  provider?: string;
  externalRunId?: string | null;
  authHeader: string | null;
}

export interface CompleteBuildUnitInput {
  buildRunId: string;
  unitKey: string;
  status: BuildUnitStatus;
  image?: string | null;
  imageDigest?: string | null;
  errorMessage?: string | null;
  metadata?: Record<string, unknown>;
  authHeader: string | null;
}

export interface FinalizeBuildRunInput {
  buildRunId: string;
  authHeader: string | null;
}

const mutableBuildRunStatuses = [
  'pending',
  'running',
  'succeeded',
] as const satisfies BuildRunStatus[];
const closedBuildUnitStatuses = ['succeeded', 'failed'] as const satisfies BuildUnitStatus[];
const buildUnitStatusRank = {
  pending: 0,
  running: 1,
  succeeded: 2,
  failed: 2,
} as const satisfies Record<BuildUnitStatus, number>;

function isBuildRunClosed(status: BuildRunStatus) {
  return status === 'failed' || status === 'finalizing' || status === 'finalized';
}

function isBuildUnitClosed(status: BuildUnitStatus) {
  return closedBuildUnitStatuses.includes(status as (typeof closedBuildUnitStatuses)[number]);
}

function isBuildUnitStatusRegression(currentStatus: BuildUnitStatus, nextStatus: BuildUnitStatus) {
  return buildUnitStatusRank[nextStatus] < buildUnitStatusRank[currentStatus];
}

function getProjectConfigForBuildPlan(
  project: typeof projects.$inferSelect & { services: Array<typeof services.$inferSelect> }
) {
  const configJson = project.configJson;
  const serviceConfigMap =
    configJson &&
    typeof configJson === 'object' &&
    'services' in configJson &&
    configJson.services &&
    typeof configJson.services === 'object'
      ? (configJson.services as Record<string, Record<string, unknown>>)
      : {};
  const monorepo =
    configJson &&
    typeof configJson === 'object' &&
    'monorepo' in configJson &&
    configJson.monorepo &&
    typeof configJson.monorepo === 'object'
      ? (configJson.monorepo as { type: 'turborepo' })
      : undefined;
  const buildTargets =
    configJson &&
    typeof configJson === 'object' &&
    'buildTargets' in configJson &&
    Array.isArray(configJson.buildTargets)
      ? configJson.buildTargets
      : [];

  return {
    monorepo,
    buildTargets: buildTargets as Array<{
      name: string;
      kind: 'package' | 'documentation' | 'bundle';
      monorepo: { appDir: string; packageName?: string };
      build: {
        strategy?: 'auto' | 'dockerfile' | 'bake' | 'buildpacks';
        command?: string;
        dockerfile?: string;
        context?: string;
        target?: string;
        definition?: string;
        secrets?: string[];
      };
      output: { path: string };
    }>,
    services: project.services.map((service) => {
      const serviceConfig = serviceConfigMap[service.name] ?? {};
      const startCommand = service.startCommand?.trim();

      if (!startCommand) {
        throw new BuildRunError(`Service ${service.name} is missing run.command in juanie.yaml`);
      }

      return {
        name: service.name,
        type: service.type,
        monorepo: serviceConfig.monorepo as { appDir?: string } | undefined,
        build: serviceConfig.build as
          | {
              strategy?: 'auto' | 'dockerfile' | 'bake' | 'buildpacks';
              command?: string;
              dockerfile?: string;
              context?: string;
              target?: string;
              definition?: string;
              secrets?: string[];
            }
          | undefined,
        run: {
          command: startCommand,
          ...(service.port ? { port: service.port } : {}),
        },
      };
    }),
  };
}

async function loadRepositoryProject(repository: string) {
  const repo = await db.query.repositories.findFirst({
    where: eq(repositories.fullName, repository),
  });

  if (!repo) {
    throw new BuildRunError(`Repository ${repository} not found in Juanie`, 404);
  }

  const project = await db.query.projects.findFirst({
    where: eq(projects.repositoryId, repo.id),
    with: {
      services: true,
    },
  });

  if (!project) {
    throw new BuildRunError(`No project linked to repository ${repository}`, 404);
  }

  return { repo, project };
}

function assertUnitBelongsToPlan(plan: BuildPlan, unitKey: string) {
  const unit = plan.units.find((candidate) => candidate.id === unitKey);

  if (!unit) {
    throw new BuildRunError(`Build unit ${unitKey} is not part of this build plan`, 404);
  }

  return unit;
}

function getBuildRunReleasePath(
  release: NonNullable<Awaited<ReturnType<typeof createRepositoryRelease>>>
) {
  return buildReleaseDetailPath(release.projectId, release.environmentId, release.id);
}

function deriveBuildRunStatus(
  units: Array<{ unitKey: string; status: BuildUnitStatus }>
): BuildRunStatus {
  if (units.some((unit) => unit.status === 'failed')) {
    return 'failed';
  }

  if (units.length > 0 && units.every((unit) => unit.status === 'succeeded')) {
    return 'succeeded';
  }

  return 'running';
}

function assertExistingBuildRunMatchesInput(
  buildRun: typeof buildRuns.$inferSelect,
  input: Pick<StartBuildRunInput, 'repository' | 'ref' | 'sha'>
) {
  if (
    buildRun.sourceRepository !== input.repository ||
    buildRun.sourceRef !== input.ref ||
    buildRun.sourceCommitSha !== input.sha
  ) {
    throw new BuildRunError('External build run id already belongs to a different source', 409);
  }
}

export async function startBuildRun(input: StartBuildRunInput) {
  await verifyRepositoryAccess(input.repository, input.authHeader);
  const { repo, project } = await loadRepositoryProject(input.repository);
  const provider = input.provider ?? 'github';

  if (input.externalRunId) {
    const existingBuildRun = await db.query.buildRuns.findFirst({
      where: and(
        eq(buildRuns.repositoryId, repo.id),
        eq(buildRuns.provider, provider),
        eq(buildRuns.externalRunId, input.externalRunId)
      ),
    });

    if (existingBuildRun) {
      assertExistingBuildRunMatchesInput(existingBuildRun, input);
      return {
        buildRun: existingBuildRun,
        plan: existingBuildRun.plan as BuildPlan,
        secretAccessToken: issueBuildSecretCapability(existingBuildRun.id),
      };
    }
  }

  const plan = createBuildPlan({
    config: getProjectConfigForBuildPlan(project),
    repository: input.repository,
    ref: input.ref,
    sha: input.sha,
    registry: input.registry,
    selectedServices: input.services,
    selectedTargets: input.targets,
  });
  const now = new Date();
  const serviceByName = new Map(project.services.map((service) => [service.name, service]));

  const buildRun = await db.transaction(async (tx) => {
    const insertBuildRun = tx.insert(buildRuns).values({
      projectId: project.id,
      repositoryId: repo.id,
      sourceRepository: input.repository,
      sourceRef: input.ref,
      sourceCommitSha: input.sha,
      provider,
      externalRunId: input.externalRunId ?? null,
      status: 'running',
      plan,
      startedAt: now,
      updatedAt: now,
    });

    const [createdBuildRun] = input.externalRunId
      ? await insertBuildRun
          .onConflictDoNothing({
            target: [buildRuns.repositoryId, buildRuns.provider, buildRuns.externalRunId],
          })
          .returning()
      : await insertBuildRun.returning();

    if (!createdBuildRun) {
      const [existingBuildRun] = await tx
        .select()
        .from(buildRuns)
        .where(
          and(
            eq(buildRuns.repositoryId, repo.id),
            eq(buildRuns.provider, provider),
            eq(buildRuns.externalRunId, input.externalRunId ?? '')
          )
        )
        .limit(1);

      if (!existingBuildRun) {
        throw new BuildRunError('Build run was not created', 500);
      }

      assertExistingBuildRunMatchesInput(existingBuildRun, input);
      return existingBuildRun;
    }

    await tx.insert(buildUnits).values(
      plan.units.map((unit) => ({
        buildRunId: createdBuildRun.id,
        serviceId: serviceByName.get(unit.service)?.id ?? null,
        unitKey: unit.id,
        serviceName: unit.service,
        status: 'pending' as const,
        metadata: unit,
      }))
    );

    return createdBuildRun;
  });

  return {
    buildRun,
    plan: buildRun.plan as BuildPlan,
    secretAccessToken: issueBuildSecretCapability(buildRun.id),
  };
}

async function loadBuildRunForMutation(buildRunId: string, authHeader: string | null) {
  const buildRun = await db.query.buildRuns.findFirst({
    where: eq(buildRuns.id, buildRunId),
    with: {
      units: true,
      artifacts: true,
    },
  });

  if (!buildRun) {
    throw new BuildRunError('Build run not found', 404);
  }

  await verifyRepositoryAccess(buildRun.sourceRepository, authHeader);

  return buildRun;
}

async function readBuildVariableValue(
  variable: typeof environmentVariables.$inferSelect
): Promise<string | null> {
  if (!variable.isSecret) return variable.value;
  if (variable.encryptedValue && variable.iv && variable.authTag) {
    return decrypt(variable.encryptedValue, variable.iv, variable.authTag);
  }
  return variable.value;
}

export async function getBuildRunSecrets(input: {
  buildRunId: string;
  unitKey: string;
  capabilityToken: string;
}): Promise<Record<string, string>> {
  if (
    !verifyBuildSecretCapability({
      token: input.capabilityToken,
      buildRunId: input.buildRunId,
    })
  ) {
    throw new BuildRunError('Invalid or expired build secret capability', 401);
  }
  const buildRun = await db.query.buildRuns.findFirst({
    where: eq(buildRuns.id, input.buildRunId),
  });
  if (!buildRun) throw new BuildRunError('Build run not found', 404);
  if (!['pending', 'running'].includes(buildRun.status)) {
    throw new BuildRunError(`Build run no longer accepts secret reads: ${buildRun.status}`, 409);
  }
  const plan = buildRun.plan as BuildPlan;
  const unit = assertUnitBelongsToPlan(plan, input.unitKey);
  const requiredNames = [...new Set(unit.secrets ?? [])].sort();
  if (requiredNames.length === 0) return {};

  const [environmentList, ruleList] = await Promise.all([
    db.query.environments.findMany({ where: eq(environments.projectId, buildRun.projectId) }),
    db.query.deliveryRules.findMany({ where: eq(deliveryRules.projectId, buildRun.projectId) }),
  ]);
  const route = resolveEnvironmentRoute({
    ref: buildRun.sourceRef,
    environments: environmentList,
    deliveryRules: ruleList,
  });
  const lineage = route.environment ? await getEnvironmentLineage(route.environment.id) : [];
  const lineageIds = lineage.map((environment) => environment.id);
  const scopeOrder = new Map(lineageIds.map((id, index) => [id, index]));
  const candidates = await db.query.environmentVariables.findMany({
    where: and(
      eq(environmentVariables.projectId, buildRun.projectId),
      eq(environmentVariables.injectionType, 'build'),
      isNull(environmentVariables.serviceId),
      lineageIds.length > 0
        ? or(
            isNull(environmentVariables.environmentId),
            inArray(environmentVariables.environmentId, lineageIds)
          )
        : isNull(environmentVariables.environmentId)
    ),
  });
  candidates.sort((left, right) => {
    const leftScope = left.environmentId ? (scopeOrder.get(left.environmentId) ?? -1) : -1;
    const rightScope = right.environmentId ? (scopeOrder.get(right.environmentId) ?? -1) : -1;
    if (leftScope !== rightScope) return leftScope - rightScope;
    return left.updatedAt.getTime() - right.updatedAt.getTime();
  });

  const selected = new Map<string, typeof environmentVariables.$inferSelect>();
  for (const variable of candidates) {
    if (requiredNames.includes(variable.key)) selected.set(variable.key, variable);
  }

  const missing = requiredNames.filter((name) => !selected.has(name));
  if (missing.length > 0) {
    throw new BuildRunError(
      `Missing build variables in Juanie: ${missing.join(', ')}. Add them with injection type build.`,
      409
    );
  }

  const values: Record<string, string> = {};
  for (const name of requiredNames) {
    const variable = selected.get(name);
    if (!variable) continue;
    const value = await readBuildVariableValue(variable);
    if (value === null) {
      throw new BuildRunError(`Build variable ${name} has no value`, 409);
    }
    values[name] = value;
  }
  return values;
}

export async function completeBuildUnit(input: CompleteBuildUnitInput) {
  const buildRun = await loadBuildRunForMutation(input.buildRunId, input.authHeader);

  if (isBuildRunClosed(buildRun.status)) {
    throw new BuildRunError(`Build run is closed: ${buildRun.status}`, 409);
  }

  const plan = buildRun.plan as BuildPlan;
  const plannedUnit = assertUnitBelongsToPlan(plan, input.unitKey);
  const unit = buildRun.units.find((candidate) => candidate.unitKey === input.unitKey);

  if (!unit) {
    throw new BuildRunError(`Build unit ${input.unitKey} was not initialized`, 404);
  }

  const image = input.image ?? plannedUnit.outputs[0]?.image ?? null;

  if (input.status === 'succeeded' && !image) {
    throw new BuildRunError(`Build unit ${input.unitKey} did not report an image`, 400);
  }

  const now = new Date();

  await db.transaction(async (tx) => {
    await tx.execute(
      sql`select 1 from ${buildRuns} where ${buildRuns.id} = ${input.buildRunId} for update`
    );

    const [currentBuildRun] = await tx
      .select({
        status: buildRuns.status,
        errorMessage: buildRuns.errorMessage,
        finishedAt: buildRuns.finishedAt,
      })
      .from(buildRuns)
      .where(eq(buildRuns.id, input.buildRunId))
      .limit(1);

    if (!currentBuildRun) {
      throw new BuildRunError('Build run not found', 404);
    }

    if (isBuildRunClosed(currentBuildRun.status)) {
      throw new BuildRunError(`Build run is closed: ${currentBuildRun.status}`, 409);
    }

    const [currentUnit] = await tx
      .select()
      .from(buildUnits)
      .where(
        and(eq(buildUnits.buildRunId, input.buildRunId), eq(buildUnits.unitKey, input.unitKey))
      )
      .limit(1);

    if (!currentUnit) {
      throw new BuildRunError(`Build unit ${input.unitKey} was not initialized`, 404);
    }

    if (isBuildUnitClosed(currentUnit.status) && currentUnit.status !== input.status) {
      throw new BuildRunError(`Build unit ${input.unitKey} is already ${currentUnit.status}`, 409);
    }

    if (isBuildUnitStatusRegression(currentUnit.status, input.status)) {
      throw new BuildRunError(
        `Build unit ${input.unitKey} cannot move from ${currentUnit.status} to ${input.status}`,
        409
      );
    }

    await tx
      .update(buildUnits)
      .set({
        status: input.status,
        image: input.status === 'succeeded' ? image : (input.image ?? currentUnit.image),
        imageDigest:
          input.status === 'succeeded' ? (input.imageDigest ?? null) : currentUnit.imageDigest,
        metadata: {
          ...(typeof currentUnit.metadata === 'object' && currentUnit.metadata
            ? currentUnit.metadata
            : {}),
          ...(input.metadata ?? {}),
        },
        errorMessage:
          input.status === 'failed' ? (input.errorMessage ?? 'Build unit failed') : null,
        startedAt: currentUnit.startedAt ?? now,
        finishedAt: input.status === 'succeeded' || input.status === 'failed' ? now : null,
        updatedAt: now,
      })
      .where(
        and(eq(buildUnits.buildRunId, input.buildRunId), eq(buildUnits.unitKey, input.unitKey))
      );

    if (input.status !== 'succeeded') {
      await tx
        .delete(buildArtifacts)
        .where(
          and(
            eq(buildArtifacts.buildRunId, input.buildRunId),
            eq(buildArtifacts.buildUnitId, currentUnit.id)
          )
        );
    } else {
      for (const output of plannedUnit.outputs) {
        const uri = output.kind === 'image' ? image : output.image;
        await tx
          .insert(buildArtifacts)
          .values({
            buildRunId: input.buildRunId,
            buildUnitId: currentUnit.id,
            serviceId: currentUnit.serviceId,
            kind: output.kind as BuildArtifactKind,
            name: output.name,
            uri,
            digest: input.imageDigest ?? null,
            metadata: output,
          })
          .onConflictDoUpdate({
            target: [buildArtifacts.buildUnitId, buildArtifacts.kind, buildArtifacts.name],
            set: {
              uri,
              digest: input.imageDigest ?? null,
              metadata: output,
            },
          });
      }
    }

    const latestUnits = await tx
      .select({
        unitKey: buildUnits.unitKey,
        status: buildUnits.status,
      })
      .from(buildUnits)
      .where(eq(buildUnits.buildRunId, input.buildRunId));
    const nextStatus = deriveBuildRunStatus(latestUnits);

    await tx
      .update(buildRuns)
      .set({
        status: nextStatus,
        errorMessage:
          input.status === 'failed'
            ? (input.errorMessage ?? `Build unit ${input.unitKey} failed`)
            : nextStatus === 'failed'
              ? currentBuildRun.errorMessage
              : null,
        updatedAt: now,
        finishedAt:
          nextStatus === 'failed' || nextStatus === 'succeeded' ? now : currentBuildRun.finishedAt,
      })
      .where(
        and(eq(buildRuns.id, input.buildRunId), inArray(buildRuns.status, mutableBuildRunStatuses))
      );
  });

  return db.query.buildRuns.findFirst({
    where: eq(buildRuns.id, input.buildRunId),
    with: {
      units: true,
      artifacts: true,
    },
  });
}

export async function finalizeBuildRun(input: FinalizeBuildRunInput) {
  const buildRun = await loadBuildRunForMutation(input.buildRunId, input.authHeader);

  if (buildRun.releaseId) {
    const release = await db.query.releases.findFirst({
      where: eq(releases.id, buildRun.releaseId),
    });

    if (!release) {
      throw new BuildRunError('Build run release link is invalid', 409);
    }

    return {
      buildRun,
      release: {
        ...release,
        releasePath: buildReleaseDetailPath(release.projectId, release.environmentId, release.id),
      },
    };
  }

  if (buildRun.status === 'failed') {
    throw new BuildRunError(buildRun.errorMessage ?? 'Build run failed', 409);
  }

  if (buildRun.status === 'finalizing') {
    throw new BuildRunError('Build run is already finalizing', 409);
  }

  const plan = buildRun.plan as BuildPlan;
  const missingUnits = plan.release.requiredUnits.filter((unitKey) => {
    const unit = buildRun.units.find((candidate) => candidate.unitKey === unitKey);
    return unit?.status !== 'succeeded';
  });

  if (missingUnits.length > 0) {
    throw new BuildRunError(
      `Build run is missing successful units: ${missingUnits.join(', ')}`,
      409
    );
  }

  if (buildRun.status !== 'succeeded') {
    throw new BuildRunError(`Build run is not ready to finalize: ${buildRun.status}`, 409);
  }

  const now = new Date();
  const [claimedBuildRun] = await db
    .update(buildRuns)
    .set({
      status: 'finalizing',
      updatedAt: now,
    })
    .where(and(eq(buildRuns.id, buildRun.id), eq(buildRuns.status, 'succeeded')))
    .returning();

  if (!claimedBuildRun) {
    const latestBuildRun = await db.query.buildRuns.findFirst({
      where: eq(buildRuns.id, buildRun.id),
    });

    if (latestBuildRun?.releaseId) {
      const release = await db.query.releases.findFirst({
        where: eq(releases.id, latestBuildRun.releaseId),
      });

      if (release) {
        return {
          buildRun: latestBuildRun,
          release: {
            ...release,
            releasePath: buildReleaseDetailPath(
              release.projectId,
              release.environmentId,
              release.id
            ),
          },
        };
      }
    }

    throw new BuildRunError(
      `Build run is not ready to finalize: ${latestBuildRun?.status ?? 'unknown'}`,
      409
    );
  }

  const claimedBuildRunWithArtifacts = await db.query.buildRuns.findFirst({
    where: eq(buildRuns.id, claimedBuildRun.id),
    with: {
      units: true,
      artifacts: true,
    },
  });

  if (!claimedBuildRunWithArtifacts) {
    throw new BuildRunError('Build run not found after finalizing claim', 404);
  }

  const releaseServices = getBuildPlanReleaseServices(plan);
  const artifactByService = new Map(
    claimedBuildRunWithArtifacts.artifacts
      .filter((artifact) => artifact.kind === 'image')
      .map((artifact) => [artifact.name, artifact] as const)
  );
  const servicesWithDigests = releaseServices.map((service) => {
    const artifact = artifactByService.get(service.name);

    return {
      name: service.name,
      image: artifact?.uri ?? service.image,
      digest: artifact?.digest ?? null,
    };
  });
  let release: NonNullable<Awaited<ReturnType<typeof createRepositoryRelease>>>;
  try {
    const createdRelease = await createRepositoryRelease({
      repository: buildRun.sourceRepository,
      ref: buildRun.sourceRef,
      sha: buildRun.sourceCommitSha,
      services: servicesWithDigests,
      triggeredBy: 'api',
      summary: `构建发布 · ${buildRun.sourceCommitSha.slice(0, 7)}`,
      artifactOnly:
        servicesWithDigests.length === 0 &&
        plan.units.some((unit) => unit.outputs.some((output) => output.kind !== 'image')),
    });

    if (!createdRelease) {
      throw new BuildRunError('Release was not created', 500);
    }

    release = createdRelease;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    await db
      .update(buildRuns)
      .set({
        status: 'failed',
        errorMessage,
        updatedAt: new Date(),
        finishedAt: new Date(),
      })
      .where(eq(buildRuns.id, buildRun.id));
    throw error;
  }

  await db
    .update(buildRuns)
    .set({
      releaseId: release.id,
      status: 'finalized',
      updatedAt: now,
      finishedAt: now,
    })
    .where(eq(buildRuns.id, buildRun.id));

  return {
    buildRun: {
      ...buildRun,
      releaseId: release.id,
      status: 'finalized' as const,
    },
    release: {
      ...release,
      releasePath: getBuildRunReleasePath(release),
    },
  };
}
