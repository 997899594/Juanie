import { describe, expect, it } from 'bun:test';
import type * as k8s from '@kubernetes/client-node';
import {
  describeReplicaSetReadiness,
  formatK8sLabelSelector,
  getReplicaSetPodLabelSelector,
  isReplicaSetReadyForDeployment,
  selectActiveDeploymentReplicaSet,
} from '@/lib/k8s/deployment-rollout';
import { describeDeploymentPodIssues } from '@/lib/k8s/pod-diagnostics';

function deployment(input: {
  name?: string;
  uid?: string;
  revision?: string;
  replicas?: number;
}): k8s.V1Deployment {
  return {
    metadata: {
      name: input.name ?? 'worker',
      uid: input.uid ?? 'deployment-uid',
      annotations: {
        'deployment.kubernetes.io/revision': input.revision ?? '21',
      },
    },
    spec: {
      replicas: input.replicas ?? 1,
      selector: {
        matchLabels: {
          app: input.name ?? 'worker',
        },
      },
      template: {
        metadata: {
          labels: {
            app: input.name ?? 'worker',
          },
        },
        spec: {
          containers: [{ name: 'app', image: 'ghcr.io/acme/worker:test' }],
        },
      },
    },
  } as k8s.V1Deployment;
}

function replicaSet(input: {
  name: string;
  revision: string;
  deploymentName?: string;
  deploymentUid?: string;
  podHash: string;
  readyReplicas?: number;
  availableReplicas?: number;
  createdAt?: string;
}): k8s.V1ReplicaSet {
  return {
    metadata: {
      name: input.name,
      creationTimestamp: input.createdAt ? new Date(input.createdAt) : undefined,
      annotations: {
        'deployment.kubernetes.io/revision': input.revision,
      },
      ownerReferences: [
        {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          name: input.deploymentName ?? 'worker',
          uid: input.deploymentUid ?? 'deployment-uid',
        },
      ],
    },
    spec: {
      selector: {
        matchLabels: {
          app: input.deploymentName ?? 'worker',
          'pod-template-hash': input.podHash,
        },
      },
      template: {
        metadata: {
          labels: {
            app: input.deploymentName ?? 'worker',
            'pod-template-hash': input.podHash,
          },
        },
      },
    },
    status: {
      replicas: input.readyReplicas ?? 0,
      readyReplicas: input.readyReplicas ?? 0,
      availableReplicas: input.availableReplicas ?? 0,
    },
  } as k8s.V1ReplicaSet;
}

describe('deployment rollout diagnostics', () => {
  it('selects the current Deployment revision instead of an older crashlooping ReplicaSet', () => {
    const currentDeployment = deployment({ revision: '21' });
    const staleReplicaSet = replicaSet({
      name: 'worker-7c8bc5774',
      revision: '20',
      podHash: '7c8bc5774',
      readyReplicas: 0,
      availableReplicas: 0,
    });
    const currentReplicaSet = replicaSet({
      name: 'worker-68b74c686d',
      revision: '21',
      podHash: '68b74c686d',
      readyReplicas: 1,
      availableReplicas: 1,
    });

    const selected = selectActiveDeploymentReplicaSet(currentDeployment, [
      staleReplicaSet,
      currentReplicaSet,
    ]);

    expect(selected?.metadata?.name).toBe('worker-68b74c686d');
    expect(getReplicaSetPodLabelSelector(selected!)).toBe(
      'app=worker,pod-template-hash=68b74c686d'
    );
    expect(isReplicaSetReadyForDeployment(currentDeployment, selected!)).toBe(true);
  });

  it('falls back to newest owned ReplicaSet when the Deployment revision annotation is unavailable', () => {
    const currentDeployment = deployment({ revision: undefined });
    currentDeployment.metadata!.annotations = {};

    const selected = selectActiveDeploymentReplicaSet(currentDeployment, [
      replicaSet({
        name: 'worker-old',
        revision: '5',
        podHash: 'old',
        createdAt: '2026-05-28T08:00:00.000Z',
      }),
      replicaSet({
        name: 'worker-new',
        revision: '6',
        podHash: 'new',
        createdAt: '2026-05-28T09:00:00.000Z',
      }),
    ]);

    expect(selected?.metadata?.name).toBe('worker-new');
  });

  it('reports readiness against the active ReplicaSet rather than aggregate Deployment status', () => {
    const currentDeployment = deployment({ replicas: 2 });
    const currentReplicaSet = replicaSet({
      name: 'worker-68b74c686d',
      revision: '21',
      podHash: '68b74c686d',
      readyReplicas: 1,
      availableReplicas: 1,
    });

    expect(isReplicaSetReadyForDeployment(currentDeployment, currentReplicaSet)).toBe(false);
    expect(describeReplicaSetReadiness(currentDeployment, currentReplicaSet)).toBe(
      'worker-68b74c686d ready 1/2, available 1/2'
    );
  });

  it('keeps stale ReplicaSet CrashLoopBackOff pods out of current rollout diagnostics', () => {
    const currentDeployment = deployment({ revision: '21' });
    const activeReplicaSet = replicaSet({
      name: 'worker-68b74c686d',
      revision: '21',
      podHash: '68b74c686d',
      readyReplicas: 1,
      availableReplicas: 1,
    });
    const staleReplicaSet = replicaSet({
      name: 'worker-7c8bc5774',
      revision: '20',
      podHash: '7c8bc5774',
    });
    const selected = selectActiveDeploymentReplicaSet(currentDeployment, [
      staleReplicaSet,
      activeReplicaSet,
    ]);
    const activeSelector = getReplicaSetPodLabelSelector(selected!);
    const pods = [
      {
        metadata: {
          name: 'worker-7c8bc5774-xvxdl',
          labels: {
            app: 'worker',
            'pod-template-hash': '7c8bc5774',
          },
        },
        status: {
          containerStatuses: [
            {
              image: 'ghcr.io/acme/worker:old',
              imageID: 'sha256:old',
              name: 'app',
              ready: false,
              restartCount: 7,
              state: {
                waiting: {
                  reason: 'CrashLoopBackOff',
                  message: 'back-off restarting failed container',
                },
              },
            },
          ],
        },
      },
      {
        metadata: {
          name: 'worker-68b74c686d-wppq9',
          labels: {
            app: 'worker',
            'pod-template-hash': '68b74c686d',
          },
        },
        status: {
          containerStatuses: [
            {
              image: 'ghcr.io/acme/worker:new',
              imageID: 'sha256:new',
              name: 'app',
              ready: true,
              restartCount: 0,
              state: {
                running: {
                  startedAt: new Date('2026-05-28T09:10:41.000Z'),
                },
              },
            },
          ],
        },
      },
    ] as k8s.V1Pod[];
    const activePods = pods.filter(
      (pod) => formatK8sLabelSelector(pod.metadata?.labels ?? {}) === activeSelector
    );

    expect(describeDeploymentPodIssues(pods)).toContain('CrashLoopBackOff');
    expect(describeDeploymentPodIssues(activePods)).toBe(null);
  });
});
