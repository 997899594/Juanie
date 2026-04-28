import { Cron } from 'croner';
import { eq, isNotNull } from 'drizzle-orm';
import { db } from '@/lib/db';
import { environments, services } from '@/lib/db/schema';
import { getWakeRoutedHostnames } from '@/lib/domains/wake-routing';
import {
  getEnvironmentRuntimeState,
  syncEnvironmentRuntimeRoutes,
} from '@/lib/environments/runtime-control';
import { logger } from '@/lib/logger';

const DEFAULT_ROUTE_RECONCILIATION_SCHEDULE =
  process.env.ROUTE_RECONCILIATION_SCHEDULE?.trim() || '*/10 * * * *';

const routeReconciliationLogger = logger.child({ component: 'environment-route-reconciliation' });

let routeReconciliationRunning = false;

export async function reconcileEnvironmentRuntimeRoutes(): Promise<{
  checked: number;
  reconciled: number;
  skipped: number;
}> {
  const environmentList = await db.query.environments.findMany({
    where: isNotNull(environments.namespace),
    columns: {
      id: true,
      projectId: true,
      name: true,
      namespace: true,
      kind: true,
      isProduction: true,
      isPreview: true,
      autoSleepEnabled: true,
      idleSleepMinutes: true,
      lastRuntimeActivityAt: true,
      lastRuntimeSleptAt: true,
      updatedAt: true,
      createdAt: true,
    },
    with: {
      project: {
        columns: {
          id: true,
          slug: true,
        },
      },
      domains: {
        columns: {
          id: true,
          hostname: true,
        },
      },
    },
  });

  let checked = 0;
  let reconciled = 0;
  let skipped = 0;

  for (const environment of environmentList) {
    if (environment.domains.length === 0 || !environment.project) {
      skipped += 1;
      continue;
    }

    checked += 1;

    try {
      const serviceList = await db.query.services.findMany({
        where: eq(services.projectId, environment.projectId),
        columns: {
          id: true,
          name: true,
          type: true,
          isPublic: true,
          port: true,
          replicas: true,
        },
      });
      const runtimeState = await getEnvironmentRuntimeState({
        project: environment.project,
        environment,
        services: serviceList,
      });

      const hostnames = environment.domains.map((domain) => domain.hostname);
      const wakeRoutedHostnames = await getWakeRoutedHostnames(hostnames);
      const shouldReconcileSleepingRoute =
        (runtimeState.state === 'sleeping' || runtimeState.state === 'partial') &&
        wakeRoutedHostnames.size < hostnames.length;
      const shouldReconcileRunningRoute =
        runtimeState.state === 'running' && wakeRoutedHostnames.size > 0;

      if (!shouldReconcileSleepingRoute && !shouldReconcileRunningRoute) {
        continue;
      }

      await syncEnvironmentRuntimeRoutes({
        project: environment.project,
        environment,
        services: serviceList,
        runtimeState,
      });

      reconciled += 1;
    } catch (error) {
      skipped += 1;
      routeReconciliationLogger.warn('Environment route reconciliation skipped environment', {
        projectId: environment.projectId,
        environmentId: environment.id,
        environmentName: environment.name,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    checked,
    reconciled,
    skipped,
  };
}

export function startEnvironmentRouteReconciliation(): void {
  if (routeReconciliationRunning) {
    routeReconciliationLogger.info('Environment route reconciliation already running');
    return;
  }

  routeReconciliationRunning = true;

  new Cron(DEFAULT_ROUTE_RECONCILIATION_SCHEDULE, async () => {
    try {
      const result = await reconcileEnvironmentRuntimeRoutes();
      routeReconciliationLogger.info('Environment route reconciliation completed', result);
    } catch (error) {
      routeReconciliationLogger.error('Environment route reconciliation failed', error);
    }
  });

  routeReconciliationLogger.info('Environment route reconciliation started', {
    schedule: DEFAULT_ROUTE_RECONCILIATION_SCHEDULE,
  });
}
