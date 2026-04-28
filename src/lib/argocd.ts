import { getK8sClient } from '@/lib/k8s';

const DEFAULT_DEPLOYMENT_REVISION_HISTORY_LIMIT = 2;
const ARGO_API_GROUP = 'argoproj.io';
const ARGO_API_VERSION = 'v1alpha1';

interface ArgocdResourceRef {
  namespace: string;
  plural: 'applicationsets' | 'rollouts';
  name: string;
}

interface ArgoRolloutResourceLike {
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
    pauseConditions?: Array<{
      reason?: string;
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
  previewServiceName: string;
  strategy: 'controlled' | 'blue_green';
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

function isArgoRolloutReady(rollout: ArgoRolloutResourceLike): boolean {
  const generation = toNumber(rollout.metadata?.generation);
  const observedGeneration = toNumber(rollout.status?.observedGeneration);

  if (generation !== null && (observedGeneration === null || observedGeneration < generation)) {
    return false;
  }

  const desiredReplicas = rollout.spec?.replicas ?? 1;

  if (desiredReplicas === 0) {
    return true;
  }

  return (
    (rollout.status?.updatedReplicas ?? 0) >= desiredReplicas &&
    (rollout.status?.availableReplicas ?? 0) >= desiredReplicas
  );
}

function describeArgoRolloutState(rollout: ArgoRolloutResourceLike | null): string {
  if (!rollout) {
    return 'not found';
  }

  return [
    `phase=${rollout.status?.phase ?? 'unknown'}`,
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

async function upsertArgocdResource(ref: ArgocdResourceRef, body: unknown): Promise<void> {
  const { custom } = getK8sClient();

  try {
    await custom.getNamespacedCustomObject({
      group: ARGO_API_GROUP,
      version: ARGO_API_VERSION,
      namespace: ref.namespace,
      plural: ref.plural,
      name: ref.name,
    });
    await custom.replaceNamespacedCustomObject({
      group: ARGO_API_GROUP,
      version: ARGO_API_VERSION,
      namespace: ref.namespace,
      plural: ref.plural,
      name: ref.name,
      body,
    });
  } catch (error) {
    if (isNotFoundError(error)) {
      await custom.createNamespacedCustomObject({
        group: ARGO_API_GROUP,
        version: ARGO_API_VERSION,
        namespace: ref.namespace,
        plural: ref.plural,
        body,
      });
      return;
    }

    throw error;
  }
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
      strategy: {
        blueGreen: {
          activeService: spec.stableServiceName,
          previewService: spec.previewServiceName,
          autoPromotionEnabled: false,
          scaleDownDelaySeconds: spec.strategy === 'blue_green' ? 30 : 120,
          previewReplicaCount: spec.replicas,
        },
      },
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

  await upsertArgocdResource(
    {
      namespace: input.namespace,
      plural: 'rollouts',
      name: input.name,
    },
    {
      ...current,
      spec: {
        ...current.spec,
        replicas: input.replicas,
      },
    }
  );

  return true;
}

export async function resumeArgoRollout(namespace: string, name: string): Promise<void> {
  const current = await getArgoRollout(namespace, name);

  if (!current) {
    throw new Error(`Argo Rollout ${namespace}/${name} not found`);
  }

  await upsertArgocdResource(
    {
      namespace,
      plural: 'rollouts',
      name,
    },
    {
      ...current,
      spec: {
        ...current.spec,
        paused: false,
        strategy: {
          ...current.spec?.strategy,
          blueGreen: {
            ...current.spec?.strategy?.blueGreen,
            autoPromotionEnabled: true,
          },
        },
      },
    }
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
