import { and, count, desc, eq, inArray, isNull, like, lt, ne, notInArray, or } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  buildRuns,
  deliveryExecutions,
  outboxMessages,
  releases,
  repositoryWebhookControllers,
} from '@/lib/db/schema';
import type { HealthCheck } from '@/lib/health/dependency-checks';

const stuckBefore = () => new Date(Date.now() - 30 * 60 * 1000);
const canaryMaxAgeMs = 8 * 60 * 60 * 1000;

export interface DeliveryControlPlaneSnapshot {
  deadLetters: number;
  stuckExecutions: number;
  stuckBuilds: number;
  stuckReleases: number;
  webhookDrift: number;
  latestCanary: {
    status: string;
    createdAt: Date;
    completedAt: Date | null;
  } | null;
}

export function resolveDeliveryControlPlaneHealth(
  snapshot: DeliveryControlPlaneSnapshot,
  now = new Date()
): HealthCheck {
  const { latestCanary, ...metrics } = snapshot;
  if (
    snapshot.deadLetters > 0 ||
    snapshot.stuckExecutions > 0 ||
    snapshot.stuckBuilds > 0 ||
    snapshot.stuckReleases > 0
  ) {
    return { status: 'fail', message: JSON.stringify(metrics) };
  }
  if (
    latestCanary &&
    (latestCanary.status !== 'production_verified' ||
      latestCanary.createdAt.getTime() < now.getTime() - canaryMaxAgeMs)
  ) {
    return {
      status: 'fail',
      message: JSON.stringify({ ...metrics, canary: latestCanary.status }),
    };
  }
  if (!latestCanary || snapshot.webhookDrift > 0) {
    return {
      status: 'warn',
      message: JSON.stringify({
        ...metrics,
        canary: latestCanary?.status ?? 'not_yet_observed',
      }),
    };
  }
  return {
    status: 'pass',
    message: JSON.stringify({ ...metrics, canary: latestCanary.completedAt?.toISOString() }),
  };
}

async function countRows(query: Promise<Array<{ value: number }>>): Promise<number> {
  const [row] = await query;
  return Number(row?.value ?? 0);
}

export async function checkDeliveryControlPlane(): Promise<HealthCheck> {
  const activeExecutionStatuses = [
    'received',
    'dispatching',
    'building',
    'staging_releasing',
    'staging_verified',
    'production_releasing',
  ] as const;
  const activeReleaseStatuses = [
    'admission_running',
    'queued',
    'planning',
    'migration_pre_running',
    'deploying',
    'verifying',
    'migration_post_running',
  ] as const;
  const [deadLetters, stuckExecutions, stuckBuilds, stuckReleases, webhookDrift, latestCanary] =
    await Promise.all([
      countRows(
        db
          .select({ value: count() })
          .from(outboxMessages)
          .where(and(eq(outboxMessages.status, 'dead_letter'), isNull(outboxMessages.resolvedAt)))
      ),
      countRows(
        db
          .select({ value: count() })
          .from(deliveryExecutions)
          .where(
            and(
              inArray(deliveryExecutions.status, activeExecutionStatuses),
              lt(deliveryExecutions.lastSignalAt, stuckBefore())
            )
          )
      ),
      countRows(
        db
          .select({ value: count() })
          .from(buildRuns)
          .where(
            and(
              inArray(buildRuns.status, ['pending', 'running', 'succeeded', 'finalizing']),
              lt(buildRuns.updatedAt, stuckBefore())
            )
          )
      ),
      countRows(
        db
          .select({ value: count() })
          .from(releases)
          .where(
            and(
              inArray(releases.status, activeReleaseStatuses),
              lt(releases.updatedAt, stuckBefore())
            )
          )
      ),
      countRows(
        db
          .select({ value: count() })
          .from(repositoryWebhookControllers)
          .where(
            or(
              notInArray(repositoryWebhookControllers.status, ['in_sync']),
              ne(
                repositoryWebhookControllers.observedGeneration,
                repositoryWebhookControllers.desiredGeneration
              )
            )
          )
      ),
      db.query.deliveryExecutions.findFirst({
        where: like(deliveryExecutions.providerDeliveryId, 'juanie-canary:%'),
        orderBy: [desc(deliveryExecutions.createdAt)],
        columns: { status: true, createdAt: true, completedAt: true },
      }),
    ]);

  return resolveDeliveryControlPlaneHealth({
    deadLetters,
    stuckExecutions,
    stuckBuilds,
    stuckReleases,
    webhookDrift,
    latestCanary: latestCanary ?? null,
  });
}
