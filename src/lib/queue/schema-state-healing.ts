import { Cron } from 'croner';
import { and, eq, isNull, lt, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import { environmentSchemaStates } from '@/lib/db/schema';
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
}

interface AutoRetryProjectLike {
  id: string;
  teamId: string;
  repository: {
    providerId: string;
    fullName: string;
  } | null;
}

interface AutoRetrySchemaStateLike {
  databaseId: string;
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
    databaseName: state.databaseId,
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

  return !input.schemaStates.some((state) => isReleaseSchemaStateBlocking(toBlockingState(state)));
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

export async function healStaleBlockedSchemaStates(options?: {
  now?: Date;
  staleMinutes?: number;
  batchSize?: number;
}): Promise<void> {
  const now = options?.now ?? new Date();
  const staleMinutes = options?.staleMinutes ?? DEFAULT_SCHEMA_STATE_HEALING_STALE_MINUTES;
  const batchSize = options?.batchSize ?? DEFAULT_SCHEMA_STATE_HEALING_BATCH_SIZE;
  const cutoff = new Date(now.getTime() - staleMinutes * 60_000);

  const blockedStates = await db.query.environmentSchemaStates.findMany({
    where: and(
      eq(environmentSchemaStates.status, 'blocked'),
      or(
        isNull(environmentSchemaStates.lastInspectedAt),
        lt(environmentSchemaStates.lastInspectedAt, cutoff)
      )
    ),
    orderBy: (table, { asc }) => [asc(table.lastInspectedAt), asc(table.updatedAt)],
    limit: batchSize * 4,
    with: {
      database: {
        columns: {
          id: true,
          name: true,
          type: true,
        },
      },
      environment: {
        columns: {
          id: true,
          name: true,
          previewBuildStatus: true,
          previewBuildSourceRef: true,
          previewBuildSourceCommitSha: true,
        },
      },
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

  const candidates = blockedStates
    .filter(
      (state) =>
        state.project.status === 'active' &&
        isRetryableBlockedSchemaState({
          status: state.status,
          databaseType: state.database?.type ?? '',
          lastInspectedAt: state.lastInspectedAt,
          staleMinutes,
          now,
        })
    )
    .slice(0, batchSize);

  for (const candidate of candidates) {
    if (!candidate.database || !candidate.environment) {
      continue;
    }

    try {
      const healedState = await inspectEnvironmentSchemaState({
        projectId: candidate.projectId,
        databaseId: candidate.databaseId,
      });

      if (healedState.status === 'blocked') {
        schemaStateHealingLogger.info('Schema state remains blocked after healing attempt', {
          projectId: candidate.projectId,
          environmentId: candidate.environmentId,
          databaseId: candidate.databaseId,
          databaseName: candidate.database.name,
          summary: healedState.summary,
        });
        continue;
      }

      schemaStateHealingLogger.info('Healed stale blocked schema state', {
        projectId: candidate.projectId,
        environmentId: candidate.environmentId,
        databaseId: candidate.databaseId,
        databaseName: candidate.database.name,
        nextStatus: healedState.status,
        summary: healedState.summary,
      });

      const environmentStates = await db.query.environmentSchemaStates.findMany({
        where: eq(environmentSchemaStates.environmentId, candidate.environmentId),
        columns: {
          databaseId: true,
          status: true,
          summary: true,
          hasLedger: true,
          hasUserTables: true,
        },
      });

      if (
        !canAutoRetryFailedSourceBuildAfterSchemaHealing({
          environment: candidate.environment,
          project: candidate.project,
          schemaStates: environmentStates,
        })
      ) {
        continue;
      }

      try {
        await retryFailedEnvironmentSourceBuild({
          project: candidate.project,
          environment: candidate.environment,
        });
      } catch (error) {
        schemaStateHealingLogger.warn('Failed to retry source build after schema healing', {
          projectId: candidate.project.id,
          environmentId: candidate.environment.id,
          databaseId: candidate.databaseId,
          errorMessage: error instanceof Error ? error.message : String(error),
        });
      }
    } catch (error) {
      schemaStateHealingLogger.warn('Failed to heal blocked schema state', {
        projectId: candidate.projectId,
        environmentId: candidate.environmentId,
        databaseId: candidate.databaseId,
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
