import { Cron } from 'croner';
import { and, asc, eq, isNotNull, isNull, lt, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { environmentSchemaStates, environments } from '@/lib/db/schema';
import { setEnvironmentSourceBuildState } from '@/lib/environments/source-build-state';
import {
  gateway,
  getTeamIntegrationSession,
} from '@/lib/integrations/service/integration-control-plane';
import { logger } from '@/lib/logger';
import { isReleaseSchemaStateBlocking } from '@/lib/releases/schema-gate';
import { inspectEnvironmentSchemaState } from '@/lib/schema-management/inspect';

const DEFAULT_SCHEMA_STATE_HEALING_SCHEDULE =
  process.env.SCHEMA_STATE_HEALING_SCHEDULE?.trim() || '*/10 * * * *';
const DEFAULT_SCHEMA_STATE_HEALING_STALE_MINUTES = parsePositiveInt(
  process.env.SCHEMA_STATE_HEALING_STALE_MINUTES,
  10
);
const DEFAULT_SCHEMA_STATE_HEALING_BATCH_SIZE = parsePositiveInt(
  process.env.SCHEMA_STATE_HEALING_BATCH_SIZE,
  20
);

const schemaStateHealingLogger = logger.child({ component: 'schema-state-healing' });

let schemaStateHealingRunning = false;

interface AutoRetryEnvironmentLike {
  id: string;
  name: string;
  previewBuildStatus: string | null;
  previewBuildSourceRef: string | null;
  previewBuildSourceCommitSha: string | null;
  previewBuildStartedAt: Date | null;
}

interface AutoRetryProjectLike {
  id: string;
  teamId: string;
  status: string | null;
  repository: {
    providerId: string;
    fullName: string;
  } | null;
}

interface AutoRetrySchemaStateLike {
  databaseId: string;
  databaseName: string;
  databaseType: string | null;
  status:
    | 'aligned'
    | 'pending_migrations'
    | 'aligned_untracked'
    | 'drifted'
    | 'unmanaged'
    | 'blocked';
  summary: string | null;
  hasLedger: boolean;
  hasUserTables: boolean;
  lastInspectedAt: Date | null;
}

interface AutoRetryEnvironmentContext {
  projectId: string;
  environment: AutoRetryEnvironmentLike;
  project: AutoRetryProjectLike;
  schemaStates: AutoRetrySchemaStateLike[];
}

function parsePositiveInt(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

export function isRetryableBlockedSchemaState(input: {
  status: string;
  databaseType: string;
  lastInspectedAt: Date | null;
  now?: Date;
  staleMinutes?: number;
}): boolean {
  if (input.status !== 'blocked') {
    return false;
  }

  if (!['postgresql', 'mysql'].includes(input.databaseType)) {
    return false;
  }

  if (!input.lastInspectedAt) {
    return true;
  }

  const staleMinutes = input.staleMinutes ?? DEFAULT_SCHEMA_STATE_HEALING_STALE_MINUTES;
  const now = input.now ?? new Date();
  return input.lastInspectedAt.getTime() <= now.getTime() - staleMinutes * 60_000;
}

function toBlockingState(state: AutoRetrySchemaStateLike) {
  return {
    databaseId: state.databaseId,
    databaseName: state.databaseName,
    status: state.status,
    statusLabel: state.status,
    summary: state.summary,
    hasLedger: state.hasLedger,
    hasUserTables: state.hasUserTables,
  };
}

export function canAutoRetryFailedSourceBuildAfterSchemaHealing(input: {
  environment: AutoRetryEnvironmentLike;
  project: AutoRetryProjectLike;
  schemaStates: AutoRetrySchemaStateLike[];
}): boolean {
  if (input.environment.previewBuildStatus !== 'failed') {
    return false;
  }

  if (!input.environment.previewBuildSourceRef || !input.environment.previewBuildSourceCommitSha) {
    return false;
  }

  if (!input.project.repository?.providerId || !input.project.repository.fullName) {
    return false;
  }

  if (input.schemaStates.some((state) => isReleaseSchemaStateBlocking(toBlockingState(state)))) {
    return false;
  }

  if (input.schemaStates.length === 0) {
    return true;
  }

  if (!input.environment.previewBuildStartedAt) {
    return false;
  }

  const buildStartedAt = input.environment.previewBuildStartedAt;

  return input.schemaStates.some(
    (state) =>
      state.lastInspectedAt !== null && state.lastInspectedAt.getTime() >= buildStartedAt.getTime()
  );
}

async function retryFailedEnvironmentSourceBuild(input: {
  project: AutoRetryProjectLike;
  environment: AutoRetryEnvironmentLike;
}): Promise<void> {
  const sourceRef = input.environment.previewBuildSourceRef;
  const sourceCommitSha = input.environment.previewBuildSourceCommitSha;

  if (!sourceRef || !sourceCommitSha || !input.project.repository?.providerId) {
    return;
  }

  const session = await getTeamIntegrationSession({
    integrationId: input.project.repository.providerId,
    teamId: input.project.teamId,
    requiredCapabilities: ['write_workflow'],
  });

  const startedAt = new Date();
  await setEnvironmentSourceBuildState({
    environmentId: input.environment.id,
    status: 'building',
    sourceRef,
    sourceCommitSha,
    startedAt,
  });

  try {
    await gateway.triggerReleaseBuild(session, {
      repoFullName: input.project.repository.fullName,
      ref: sourceRef,
      releaseRef: sourceRef,
      sourceCommitSha,
      forceFullBuild: true,
    });

    schemaStateHealingLogger.info('Retried failed source build after schema healing', {
      projectId: input.project.id,
      environmentId: input.environment.id,
      environmentName: input.environment.name,
      sourceRef,
      sourceCommitSha,
    });
  } catch (error) {
    await setEnvironmentSourceBuildState({
      environmentId: input.environment.id,
      status: 'failed',
      sourceRef,
      sourceCommitSha,
      startedAt,
    });

    throw error;
  }
}

async function loadAutoRetryEnvironmentContext(
  environmentId: string
): Promise<AutoRetryEnvironmentContext | null> {
  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, environmentId),
    columns: {
      id: true,
      projectId: true,
      name: true,
      previewBuildStatus: true,
      previewBuildSourceRef: true,
      previewBuildSourceCommitSha: true,
      previewBuildStartedAt: true,
    },
    with: {
      project: {
        columns: {
          id: true,
          teamId: true,
          status: true,
        },
        with: {
          repository: {
            columns: {
              providerId: true,
              fullName: true,
            },
          },
        },
      },
    },
  });

  if (!environment) {
    return null;
  }

  const schemaStates = await db.query.environmentSchemaStates.findMany({
    where: eq(environmentSchemaStates.environmentId, environmentId),
    orderBy: [asc(environmentSchemaStates.updatedAt)],
    columns: {
      databaseId: true,
      status: true,
      summary: true,
      hasLedger: true,
      hasUserTables: true,
      lastInspectedAt: true,
    },
    with: {
      database: {
        columns: {
          id: true,
          name: true,
          type: true,
        },
      },
    },
  });

  return {
    projectId: environment.projectId,
    environment: {
      id: environment.id,
      name: environment.name,
      previewBuildStatus: environment.previewBuildStatus,
      previewBuildSourceRef: environment.previewBuildSourceRef,
      previewBuildSourceCommitSha: environment.previewBuildSourceCommitSha,
      previewBuildStartedAt: environment.previewBuildStartedAt,
    },
    project: {
      id: environment.project.id,
      teamId: environment.project.teamId,
      status: environment.project.status,
      repository: environment.project.repository
        ? {
            providerId: environment.project.repository.providerId,
            fullName: environment.project.repository.fullName,
          }
        : null,
    },
    schemaStates: schemaStates.map((state) => ({
      databaseId: state.databaseId,
      databaseName: state.database?.name ?? state.databaseId,
      databaseType: state.database?.type ?? null,
      status: state.status,
      summary: state.summary,
      hasLedger: state.hasLedger,
      hasUserTables: state.hasUserTables,
      lastInspectedAt: state.lastInspectedAt,
    })),
  };
}

async function loadSchemaHealingCandidateEnvironmentIds(options: {
  now: Date;
  staleMinutes: number;
  batchSize: number;
}): Promise<string[]> {
  const cutoff = new Date(options.now.getTime() - options.staleMinutes * 60_000);
  const ids = new Set<string>();

  const blockedStates = await db.query.environmentSchemaStates.findMany({
    where: and(
      eq(environmentSchemaStates.status, 'blocked'),
      or(
        isNull(environmentSchemaStates.lastInspectedAt),
        lt(environmentSchemaStates.lastInspectedAt, cutoff)
      )
    ),
    orderBy: (table, { asc: orderAsc }) => [
      orderAsc(table.lastInspectedAt),
      orderAsc(table.updatedAt),
    ],
    limit: options.batchSize * 4,
    with: {
      database: {
        columns: {
          type: true,
        },
      },
      project: {
        columns: {
          status: true,
        },
      },
    },
  });

  for (const state of blockedStates) {
    if (
      state.project.status === 'active' &&
      state.environmentId &&
      isRetryableBlockedSchemaState({
        status: state.status,
        databaseType: state.database?.type ?? '',
        lastInspectedAt: state.lastInspectedAt,
        staleMinutes: options.staleMinutes,
        now: options.now,
      })
    ) {
      ids.add(state.environmentId);
    }
  }

  const failedSourceBuilds = await db.query.environments.findMany({
    where: and(
      eq(environments.previewBuildStatus, 'failed'),
      isNotNull(environments.previewBuildSourceRef),
      isNotNull(environments.previewBuildSourceCommitSha),
      isNotNull(environments.previewBuildStartedAt)
    ),
    orderBy: (table, { asc: orderAsc }) => [
      orderAsc(table.previewBuildStartedAt),
      orderAsc(table.updatedAt),
    ],
    limit: options.batchSize * 4,
    columns: {
      id: true,
    },
    with: {
      project: {
        columns: {
          status: true,
        },
      },
    },
  });

  for (const environment of failedSourceBuilds) {
    if (environment.project.status === 'active') {
      ids.add(environment.id);
    }
  }

  return [...ids].slice(0, options.batchSize);
}

export async function healStaleBlockedSchemaStates(options?: {
  now?: Date;
  staleMinutes?: number;
  batchSize?: number;
}): Promise<void> {
  const now = options?.now ?? new Date();
  const staleMinutes = options?.staleMinutes ?? DEFAULT_SCHEMA_STATE_HEALING_STALE_MINUTES;
  const batchSize = options?.batchSize ?? DEFAULT_SCHEMA_STATE_HEALING_BATCH_SIZE;
  const candidateEnvironmentIds = await loadSchemaHealingCandidateEnvironmentIds({
    now,
    staleMinutes,
    batchSize,
  });

  for (const environmentId of candidateEnvironmentIds) {
    const context = await loadAutoRetryEnvironmentContext(environmentId);
    if (!context || context.project.status !== 'active') {
      continue;
    }

    try {
      for (const state of context.schemaStates) {
        if (
          !isRetryableBlockedSchemaState({
            status: state.status,
            databaseType: state.databaseType ?? '',
            lastInspectedAt: state.lastInspectedAt,
            staleMinutes,
            now,
          })
        ) {
          continue;
        }

        const healedState = await inspectEnvironmentSchemaState({
          projectId: context.projectId,
          databaseId: state.databaseId,
        });

        if (healedState.status === 'blocked') {
          schemaStateHealingLogger.info('Schema state remains blocked after healing attempt', {
            projectId: context.projectId,
            environmentId: context.environment.id,
            databaseId: state.databaseId,
            databaseName: state.databaseName,
            summary: healedState.summary,
          });
          continue;
        }

        schemaStateHealingLogger.info('Healed stale blocked schema state', {
          projectId: context.projectId,
          environmentId: context.environment.id,
          databaseId: state.databaseId,
          databaseName: state.databaseName,
          nextStatus: healedState.status,
          summary: healedState.summary,
        });
      }

      const refreshedContext = await loadAutoRetryEnvironmentContext(environmentId);
      if (!refreshedContext || refreshedContext.project.status !== 'active') {
        continue;
      }

      if (
        !canAutoRetryFailedSourceBuildAfterSchemaHealing({
          environment: refreshedContext.environment,
          project: refreshedContext.project,
          schemaStates: refreshedContext.schemaStates,
        })
      ) {
        continue;
      }

      try {
        await retryFailedEnvironmentSourceBuild({
          project: refreshedContext.project,
          environment: refreshedContext.environment,
        });
      } catch (error) {
        schemaStateHealingLogger.warn('Failed to retry source build after schema healing', {
          projectId: refreshedContext.project.id,
          environmentId: refreshedContext.environment.id,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      schemaStateHealingLogger.warn('Failed to heal blocked schema state', {
        projectId: context.projectId,
        environmentId: context.environment.id,
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

export function startSchemaStateHealing(): void {
  if (schemaStateHealingRunning) {
    schemaStateHealingLogger.info('Schema state healing already running');
    return;
  }

  schemaStateHealingRunning = true;

  const runHealingTick = async () => {
    try {
      await healStaleBlockedSchemaStates();
    } catch (error) {
      schemaStateHealingLogger.error('Schema state healing failed', error);
    }
  };

  void runHealingTick();
  new Cron(DEFAULT_SCHEMA_STATE_HEALING_SCHEDULE, runHealingTick);

  schemaStateHealingLogger.info('Schema state healing started', {
    schedule: DEFAULT_SCHEMA_STATE_HEALING_SCHEDULE,
    staleMinutes: DEFAULT_SCHEMA_STATE_HEALING_STALE_MINUTES,
    batchSize: DEFAULT_SCHEMA_STATE_HEALING_BATCH_SIZE,
  });
}
