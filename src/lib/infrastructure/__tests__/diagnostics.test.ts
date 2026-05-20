import { describe, expect, it, mock } from 'bun:test';
import type * as k8s from '@kubernetes/client-node';

let namespacePods: k8s.V1Pod[] = [];
let allPods: k8s.V1Pod[] = [];
let events: k8s.CoreV1Event[] = [];

mock.module('@/lib/k8s', () => ({
  getDeployments: async () => [],
  getEvents: async () => events,
  getNodes: async () => [],
  getPods: async () => namespacePods,
  getPodsAllNamespaces: async () => allPods,
}));

function pod(name: string, uid: string, deletionTimestamp?: Date): k8s.V1Pod {
  return {
    metadata: {
      name,
      uid,
      creationTimestamp: new Date('2026-05-20T08:00:00.000Z'),
      deletionTimestamp,
    },
    status: {
      phase: 'Running',
      containerStatuses: [
        {
          name: 'app',
          state: {
            running: {},
          },
        },
      ],
    },
  } as k8s.V1Pod;
}

function unhealthyEvent(podName: string, podUid: string): k8s.CoreV1Event {
  return {
    reason: 'Unhealthy',
    message:
      'Readiness probe failed: Get "http://10.42.0.249:3000/api/health": connect: no route to host',
    involvedObject: {
      kind: 'Pod',
      name: podName,
      uid: podUid,
    },
    lastTimestamp: new Date('2026-05-20T08:30:00.000Z'),
    metadata: {
      uid: `event-${podUid}`,
    },
  } as k8s.CoreV1Event;
}

describe('infrastructure diagnostics', () => {
  function resetFixtures(): void {
    namespacePods = [pod('nexusnote-web-7944dcd875-wgdr8', 'pod-current')];
    allPods = [...namespacePods];
    events = [];
  }

  it('ignores probe events from pods that are no longer current', async () => {
    resetFixtures();
    const { getInfrastructureDiagnostics } = await import('@/lib/infrastructure/diagnostics');
    events = [unhealthyEvent('nexusnote-web-5fdcf488cf-zdqz7', 'pod-old')];

    const snapshot = await getInfrastructureDiagnostics({
      namespace: 'juanie-nexusnote-staging',
      releaseWindow: {
        startedAt: new Date('2026-05-20T08:00:00.000Z'),
        finishedAt: new Date('2026-05-20T08:45:00.000Z'),
      },
    });

    expect(snapshot.incidents.some((incident) => incident.issueCode === 'probe_failed')).toBe(
      false
    );
    expect(snapshot.primaryIssue?.code ?? null).not.toBe('probe_failed');
  });

  it('keeps probe events for the active pod', async () => {
    resetFixtures();
    const { getInfrastructureDiagnostics } = await import('@/lib/infrastructure/diagnostics');
    events = [unhealthyEvent('nexusnote-web-7944dcd875-wgdr8', 'pod-current')];

    const snapshot = await getInfrastructureDiagnostics({
      namespace: 'juanie-nexusnote-staging',
      releaseWindow: {
        startedAt: new Date('2026-05-20T08:00:00.000Z'),
        finishedAt: new Date('2026-05-20T08:45:00.000Z'),
      },
    });

    expect(snapshot.incidents.some((incident) => incident.issueCode === 'probe_failed')).toBe(true);
    expect(snapshot.primaryIssue?.code).toBe('probe_failed');
  });
});
