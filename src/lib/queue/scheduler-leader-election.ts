import * as k8s from '@kubernetes/client-node';
import { logger } from '@/lib/logger';

const leaseLogger = logger.child({ component: 'scheduler-leader-election' });
const leaseName = 'juanie-scheduler';
const leaseDurationSeconds = 30;
const renewIntervalMs = 10_000;

function errorStatus(error: unknown): number | undefined {
  const candidate = error as { code?: number; statusCode?: number };
  return candidate.code ?? candidate.statusCode;
}

function loadCoordinationClient(): k8s.CoordinationV1Api {
  const config = new k8s.KubeConfig();
  config.loadFromCluster();
  return config.makeApiClient(k8s.CoordinationV1Api);
}

function buildLease(identity: string, now: Date, resourceVersion?: string): k8s.V1Lease {
  return {
    apiVersion: 'coordination.k8s.io/v1',
    kind: 'Lease',
    metadata: {
      name: leaseName,
      namespace: process.env.JUANIE_NAMESPACE ?? 'juanie',
      ...(resourceVersion ? { resourceVersion } : {}),
    },
    spec: {
      holderIdentity: identity,
      leaseDurationSeconds,
      acquireTime: now,
      renewTime: now,
    },
  };
}

function isExpired(lease: k8s.V1Lease, now: Date): boolean {
  const renewTime = lease.spec?.renewTime?.getTime() ?? 0;
  const durationMs = (lease.spec?.leaseDurationSeconds ?? leaseDurationSeconds) * 1000;
  return renewTime + durationMs < now.getTime();
}

export async function acquireSchedulerLeadership(): Promise<() => void> {
  if (!process.env.KUBERNETES_SERVICE_HOST) {
    leaseLogger.info('Kubernetes is unavailable; scheduler runs as a local singleton');
    return () => undefined;
  }

  const namespace = process.env.JUANIE_NAMESPACE ?? 'juanie';
  const identity = process.env.HOSTNAME ?? `scheduler-${process.pid}`;
  const client = loadCoordinationClient();

  while (true) {
    const now = new Date();
    try {
      const current = await client.readNamespacedLease({ name: leaseName, namespace });
      if (current.spec?.holderIdentity !== identity && !isExpired(current, now)) {
        await new Promise((resolve) => setTimeout(resolve, renewIntervalMs));
        continue;
      }

      await client.replaceNamespacedLease({
        name: leaseName,
        namespace,
        body: buildLease(identity, now, current.metadata?.resourceVersion),
      });
      break;
    } catch (error) {
      if (errorStatus(error) === 404) {
        try {
          await client.createNamespacedLease({
            namespace,
            body: buildLease(identity, now),
          });
          break;
        } catch (createError) {
          if (errorStatus(createError) !== 409) {
            throw createError;
          }
        }
      } else if (errorStatus(error) !== 409) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, renewIntervalMs));
    }
  }

  leaseLogger.info('Scheduler leadership acquired', { identity, namespace, leaseName });
  const renewal = setInterval(async () => {
    try {
      const current = await client.readNamespacedLease({ name: leaseName, namespace });
      if (current.spec?.holderIdentity !== identity) {
        throw new Error(`Scheduler lease is held by ${current.spec?.holderIdentity ?? 'nobody'}`);
      }
      await client.replaceNamespacedLease({
        name: leaseName,
        namespace,
        body: buildLease(identity, new Date(), current.metadata?.resourceVersion),
      });
    } catch (error) {
      leaseLogger.error('Scheduler leadership lost', error, { identity, namespace, leaseName });
      process.exit(1);
    }
  }, renewIntervalMs);

  return () => clearInterval(renewal);
}
