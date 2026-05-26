import * as k8s from '@kubernetes/client-node';
import { getK8sClient } from '@/lib/k8s';

const DEFAULT_DEPLOYMENT_REVISION_HISTORY_LIMIT = 2;
const ARGO_API_GROUP = 'argoproj.io';
const ARGO_API_VERSION = 'v1alpha1';
const ARGO_FIELD_MANAGER = 'juanie-control-plane';

interface ArgocdResourceRef {
  namespace: string;
  plural: 'applicationsets' | 'rollouts';
  name: string;
}

export interface ArgoRolloutResourceLike {
  metadata?: {
    name?: string;
    namespace?: string;
    generation?: number;
  };
  spec?: {
    paused?: boolean;
    replicas?: number;
    strategy?: {
      blueGreen?: {
        activeService?: string;
        previewService?: string;
        autoPromotionEnabled?: boolean;
        scaleDownDelaySeconds?: number;
        previewReplicaCount?: number;
      };
      canary?: {
        steps?: Array<Record<string, unknown>>;
      };
    };
    template?: {
      spec?: {
        containers?: Array<{
          image?: string;
        }>;
      };
    };
  };
  status?: {
    phase?: string;
    observedGeneration?: number | string;
    readyReplicas?: number;
    availableReplicas?: number;
    updatedReplicas?: number;
    blueGreen?: {
      activeSelector?: string;
      previewSelector?: string;
    };
    pauseConditions?: Array<{
      reason?: string;
    }>;
    conditions?: Array<{
      type?: string;
      status?: string;
      reason?: string;
      message?: string;
    }>;
  };
}

export interface ArgoRolloutSpec {
  name: string;
  namespace: string;
  image: string;
  port: number;
  replicas: number;
  stableServiceName: string;
  previewServiceName?: string;
  strategy: 'rolling' | 'controlled' | 'canary' | 'blue_green';
  autoPromotionEnabled: boolean;
  env?: Record<string, string>;
  envFrom?: Array<{ secretRef?: { name: string }; configMapRef?: { name: string } }>;
  imagePullSecrets?: string[];
  healthcheckPath?: string;
  cpuRequest?: string;
  cpuLimit?: string;
  memoryRequest?: string;
  memoryLimit?: string;
}

export interface ArgoApplicationSetManifest {
  apiVersion: 'argoproj.io/v1alpha1';
  kind: 'ApplicationSet';
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  spec: Record<string, unknown>;
}

function isNotFoundError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: number; statusCode?: number };
  return (candidate.code ?? candidate.statusCode) === 404;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function toNumber(value: number | string | undefined): number | null {
  if (value === undefined) {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type ArgoRolloutReadiness =
  | { ready: true; state: 'healthy' | 'scaled_to_zero' }
  | { ready: false; state: 'missing' | 'observing' | 'paused' | 'progressing' | 'degraded' };

export function getArgoRolloutReadiness(
  rollout: ArgoRolloutResourceLike | null
): ArgoRolloutReadiness {
  if (!rollout) {
    return { ready: false, state: 'missing' };
  }

  const invalidCondition = rollout.status?.conditions?.find(
    (condition) => condition.type === 'InvalidSpec' && condition.status === 'True'
  );

  if (rollout.status?.phase === 'Degraded' || invalidCondition) {
    return { ready: false, state: 'degraded' };
  }

  if (rollout.spec?.paused || (rollout.status?.pauseConditions?.length ?? 0) > 0) {
    return { ready: false, state: 'paused' };
  }

  const generation = toNumber(rollout.metadata?.generation);
  const observedGeneration = toNumber(rollout.status?.observedGeneration);

  if (generation !== null && (observedGeneration === null || observedGeneration < generation)) {
    return { ready: false, state: 'observing' };
  }

  const desiredReplicas = rollout.spec?.replicas ?? 1;

  if (desiredReplicas === 0) {
    return { ready: true, state: 'scaled_to_zero' };
  }

  const ready =
    (rollout.status?.updatedReplicas ?? 0) >= desiredReplicas &&
    (rollout.status?.availableReplicas ?? 0) >= desiredReplicas;

  return ready ? { ready: true, state: 'healthy' } : { ready: false, state: 'progressing' };
}

function isArgoRolloutReady(rollout: ArgoRolloutResourceLike): boolean {
  return getArgoRolloutReadiness(rollout).ready;
}

function describeArgoRolloutState(rollout: ArgoRolloutResourceLike | null): string {
  if (!rollout) {
    return 'not found';
  }

  return [
    `phase=${rollout.status?.phase ?? 'unknown'}`,
    rollout.status?.conditions
      ?.filter((condition) => condition.status === 'True' && condition.reason)
      .map((condition) => `${condition.type ?? 'condition'}=${condition.reason}`)
      .join(', '),
    `observed=${rollout.status?.observedGeneration ?? 'unknown'}`,
    `generation=${rollout.metadata?.generation ?? 'unknown'}`,
    `updated=${rollout.status?.updatedReplicas ?? 0}`,
    `available=${rollout.status?.availableReplicas ?? 0}`,
    `desired=${rollout.spec?.replicas ?? 1}`,
  ]
    .filter(Boolean)
    .join(', ');
}

async function getArgocdResource<T>(ref: ArgocdResourceRef): Promise<T | null> {
  const { custom } = getK8sClient();

  try {
    return (await custom.getNamespacedCustomObject({
      group: ARGO_API_GROUP,
      version: ARGO_API_VERSION,
      namespace: ref.namespace,
      plural: ref.plural,
      name: ref.name,
    })) as T;
  } catch (error) {
    if (isNotFoundError(error)) {
      return null;
    }

    throw error;
  }
}

async function upsertArgocdResource(_ref: ArgocdResourceRef, body: unknown): Promise<void> {
  const { object } = getK8sClient();

  await object.patch(
    body as k8s.KubernetesObject,
    undefined,
    undefined,
    ARGO_FIELD_MANAGER,
    true,
    k8s.PatchStrategy.ServerSideApply
  );
}

async function patchArgocdResource(ref: ArgocdResourceRef, body: unknown[]): Promise<void> {
  const { custom } = getK8sClient();

  await custom.patchNamespacedCustomObject({
    group: ARGO_API_GROUP,
    version: ARGO_API_VERSION,
    namespace: ref.namespace,
    plural: ref.plural,
    name: ref.name,
    body,
  });
}

export function buildScaleArgoRolloutPatch(replicas: number): unknown[] {
  return [{ op: 'add', path: '/spec/replicas', value: replicas }];
}

export function buildPromoteArgoRolloutPatch(input: { hasBlueGreenStrategy: boolean }): unknown[] {
  const operations: unknown[] = [{ op: 'add', path: '/spec/paused', value: false }];

  if (input.hasBlueGreenStrategy) {
    operations.push({
      op: 'add',
      path: '/spec/strategy/blueGreen/autoPromotionEnabled',
      value: true,
    });
  }

  return operations;
}

export function isArgoRolloutCompleted(rollout: ArgoRolloutResourceLike | null): boolean {
  if (!rollout) {
    return false;
  }

  const completedCondition = rollout.status?.conditions?.some(
    (condition) => condition.type === 'Completed' && condition.status === 'True'
  );
  const blueGreenSettled =
    !rollout.status?.blueGreen?.previewSelector ||
    rollout.status.blueGreen.previewSelector === rollout.status.blueGreen.activeSelector;

  return rollout.status?.phase === 'Healthy' && Boolean(completedCondition) && blueGreenSettled;
}

async function deleteArgocdResource(ref: ArgocdResourceRef): Promise<void> {
  const { custom } = getK8sClient();

  try {
    await custom.deleteNamespacedCustomObject({
      group: ARGO_API_GROUP,
      version: ARGO_API_VERSION,
      namespace: ref.namespace,
      plural: ref.plural,
      name: ref.name,
    });
  } catch (error) {
    if (!isNotFoundError(error)) {
      throw error;
    }
  }
}

function buildArgoRolloutBody(spec: ArgoRolloutSpec): Record<string, unknown> {
  const strategy =
    spec.strategy === 'canary'
      ? {
          canary: {
            maxSurge: '25%',
            maxUnavailable: 0,
            steps: [
              { setWeight: 25 },
              { pause: { duration: '30s' } },
              { setWeight: 50 },
              { pause: { duration: '30s' } },
            ],
          },
        }
      : {
          blueGreen: {
            activeService: spec.stableServiceName,
            previewService: spec.previewServiceName,
            autoPromotionEnabled: spec.autoPromotionEnabled,
            scaleDownDelaySeconds: spec.strategy === 'blue_green' ? 30 : 120,
            previewReplicaCount: spec.replicas,
          },
        };

  return {
    apiVersion: 'argoproj.io/v1alpha1',
    kind: 'Rollout',
    metadata: {
      name: spec.name,
      namespace: spec.namespace,
    },
    spec: {
      replicas: spec.replicas,
      revisionHistoryLimit: DEFAULT_DEPLOYMENT_REVISION_HISTORY_LIMIT,
      selector: {
        matchLabels: {
          app: spec.name,
        },
      },
      template: {
        metadata: {
          labels: {
            app: spec.name,
          },
        },
        spec: {
          imagePullSecrets: spec.imagePullSecrets?.map((secretName) => ({ name: secretName })),
          containers: [
            {
              name: 'app',
              image: spec.image,
              ports: [{ name: 'http', containerPort: spec.port, protocol: 'TCP' }],
              env: spec.env
                ? Object.entries(spec.env).map(([name, value]) => ({ name, value }))
                : undefined,
              envFrom: spec.envFrom,
              readinessProbe: {
                httpGet: { path: spec.healthcheckPath || '/api/health/ready', port: spec.port },
                initialDelaySeconds: 15,
                periodSeconds: 10,
                failureThreshold: 6,
              },
              livenessProbe: {
                httpGet: { path: spec.healthcheckPath || '/api/health/live', port: spec.port },
                initialDelaySeconds: 30,
                periodSeconds: 20,
                failureThreshold: 3,
              },
              resources: {
                requests: {
                  cpu: spec.cpuRequest || '100m',
                  memory: spec.memoryRequest || '256Mi',
                },
                limits: {
                  cpu: spec.cpuLimit || '500m',
                  memory: spec.memoryLimit || '512Mi',
                },
              },
            },
          ],
        },
      },
      strategy,
    },
  };
}

export function getArgoRollout(
  namespace: string,
  name: string
): Promise<ArgoRolloutResourceLike | null> {
  return getArgocdResource<ArgoRolloutResourceLike>({
    namespace,
    plural: 'rollouts',
    name,
  });
}

export async function listArgoRollouts(namespace: string): Promise<ArgoRolloutResourceLike[]> {
  const { custom } = getK8sClient();

  const response = (await custom.listNamespacedCustomObject({
    group: ARGO_API_GROUP,
    version: ARGO_API_VERSION,
    namespace,
    plural: 'rollouts',
  })) as { items?: ArgoRolloutResourceLike[] };

  return response.items ?? [];
}

export function upsertArgoRollout(spec: ArgoRolloutSpec): Promise<void> {
  return upsertArgocdResource(
    {
      namespace: spec.namespace,
      plural: 'rollouts',
      name: spec.name,
    },
    buildArgoRolloutBody(spec)
  );
}

export async function waitForArgoRolloutReady(input: {
  namespace: string;
  name: string;
  timeoutMs?: number;
  pollMs?: number;
}): Promise<ArgoRolloutResourceLike> {
  const timeoutMs = input.timeoutMs ?? 180_000;
  const pollMs = input.pollMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;
  let lastRollout: ArgoRolloutResourceLike | null = null;

  while (Date.now() < deadline) {
    lastRollout = await getArgoRollout(input.namespace, input.name);

    if (lastRollout && isArgoRolloutReady(lastRollout)) {
      return lastRollout;
    }

    await sleep(pollMs);
  }

  throw new Error(
    `Argo Rollout ${input.namespace}/${input.name} did not become ready: ${describeArgoRolloutState(
      lastRollout
    )}`
  );
}

export async function scaleArgoRolloutIfExists(input: {
  namespace: string;
  name: string;
  replicas: number;
}): Promise<boolean> {
  const current = await getArgoRollout(input.namespace, input.name);

  if (!current) {
    return false;
  }

  await patchArgocdResource(
    { namespace: input.namespace, plural: 'rollouts', name: input.name },
    buildScaleArgoRolloutPatch(input.replicas)
  );

  return true;
}

export async function resumeArgoRollout(namespace: string, name: string): Promise<void> {
  const current = await getArgoRollout(namespace, name);

  if (!current) {
    throw new Error(`Argo Rollout ${namespace}/${name} not found`);
  }

  await patchArgocdResource(
    { namespace, plural: 'rollouts', name },
    buildPromoteArgoRolloutPatch({
      hasBlueGreenStrategy: Boolean(current.spec?.strategy?.blueGreen),
    })
  );
}

export function upsertArgoApplicationSet(manifest: ArgoApplicationSetManifest): Promise<void> {
  return upsertArgocdResource(
    {
      namespace: manifest.metadata.namespace,
      plural: 'applicationsets',
      name: manifest.metadata.name,
    },
    manifest
  );
}

export function deleteArgoApplicationSet(namespace: string, name: string): Promise<void> {
  return deleteArgocdResource({
    namespace,
    plural: 'applicationsets',
    name,
  });
}
