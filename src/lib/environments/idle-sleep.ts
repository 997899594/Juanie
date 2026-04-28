import { and, eq, isNotNull, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { environments } from '@/lib/db/schema';
import {
  getEnvironmentLastRuntimeActivityAt,
  resolveEnvironmentIdleSleepMinutes,
} from '@/lib/environments/idle-policy';
import {
  getEnvironmentRuntimeState,
  setEnvironmentRuntimeState,
} from '@/lib/environments/runtime-control';
import { logger } from '@/lib/logger';
import { isActiveReleaseStatus } from '@/lib/releases/state-machine';

const activeDeploymentStatuses = new Set([
  'queued',
  'migration_pending',
  'migration_running',
  'building',
  'deploying',
  'awaiting_rollout',
]);

const idleSleepLogger = logger.child({ component: 'environment-idle-sleep' });

function toDate(value: Date | string | null): Date | null {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isIdle(lastActivityAt: Date | null, idleMinutes: number, now: Date): boolean {
  if (!lastActivityAt) {
    return false;
  }

  return now.getTime() - lastActivityAt.getTime() >= idleMinutes * 60 * 1000;
}

export async function sleepIdleEnvironments(input?: { now?: Date }): Promise<{
  sleptIds: string[];
  skipped: Array<{ id: string; reason: string }>;
}> {
  const now = input?.now ?? new Date();
  const candidateEnvironments = await db.query.environments.findMany({
    where: and(
      eq(environments.autoSleepEnabled, true),
      ne(environments.kind, 'production'),
      isNotNull(environments.namespace)
    ),
    with: {
      project: {
        columns: {
          id: true,
          slug: true,
        },
      },
      releases: {
        columns: {
          status: true,
        },
      },
      deployments: {
        columns: {
          status: true,
        },
      },
    },
  });
  const sleptIds: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const environment of candidateEnvironments) {
    const idleMinutes = resolveEnvironmentIdleSleepMinutes(environment);
    const lastActivityAt = toDate(getEnvironmentLastRuntimeActivityAt(environment));

    if (!idleMinutes) {
      skipped.push({ id: environment.id, reason: 'disabled' });
      continue;
    }

    if (!isIdle(lastActivityAt, idleMinutes, now)) {
      skipped.push({ id: environment.id, reason: 'active' });
      continue;
    }

    if (environment.releases.some((release) => isActiveReleaseStatus(release.status))) {
      skipped.push({ id: environment.id, reason: 'active_release' });
      continue;
    }

    if (
      environment.deployments.some((deployment) => activeDeploymentStatuses.has(deployment.status))
    ) {
      skipped.push({ id: environment.id, reason: 'active_deployment' });
      continue;
    }

    const runtimeState = await getEnvironmentRuntimeState({
      project: environment.project,
      environment,
    });

    if (runtimeState.state === 'sleeping') {
      skipped.push({ id: environment.id, reason: 'already_sleeping' });
      continue;
    }

    if (runtimeState.state === 'not_deployed' || runtimeState.state === 'unknown') {
      skipped.push({ id: environment.id, reason: runtimeState.state });
      continue;
    }

    try {
      await setEnvironmentRuntimeState({
        project: environment.project,
        environment,
        action: 'sleep',
      });
      sleptIds.push(environment.id);
    } catch (error) {
      idleSleepLogger.warn('Failed to auto-sleep idle environment', {
        environmentId: environment.id,
        error: error instanceof Error ? error.message : String(error),
      });
      skipped.push({ id: environment.id, reason: 'sleep_failed' });
    }
  }

  return { sleptIds, skipped };
}
