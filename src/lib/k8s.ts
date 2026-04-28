import { existsSync } from 'node:fs';
import { Writable } from 'node:stream';
import * as k8s from '@kubernetes/client-node';
import { logger } from '@/lib/logger';

let k8sCoreApi: k8s.CoreV1Api | null = null;
let k8sAppsApi: k8s.AppsV1Api | null = null;
let k8sCustomApi: k8s.CustomObjectsApi | null = null;
let k8sNetworkingApi: k8s.NetworkingV1Api | null = null;
let k8sBatchApi: k8s.BatchV1Api | null = null;
let kubeConfig: k8s.KubeConfig | null = null;
let initAttempted = false;
const k8sLogger = logger.child({ component: 'k8s' });

export function initK8sClient(): void {
  if (initAttempted) return;
  initAttempted = true;

  const kc = new k8s.KubeConfig();

  try {
    // In production (K8s environment), prefer in-cluster config
    // In development, use external kubeconfig
    if (process.env.KUBERNETES_SERVICE_HOST) {
      // Running in K8s cluster, use in-cluster config (ServiceAccount)
      kc.loadFromCluster();
      k8sLogger.info('Using in-cluster Kubernetes configuration');
    } else if (process.env.KUBECONFIG_CONTENT) {
      // External kubeconfig provided as string
      kc.loadFromString(process.env.KUBECONFIG_CONTENT);
      k8sLogger.info('Using KUBECONFIG_CONTENT');
    } else {
      // Try to load from file or default
      const kubeconfigPath = process.env.KUBECONFIG || `${process.env.HOME}/.kube/config`;
      if (existsSync(kubeconfigPath)) {
        kc.loadFromFile(kubeconfigPath);
        k8sLogger.info('Using kubeconfig from file', { kubeconfigPath });
      } else {
        kc.loadFromDefault();
        k8sLogger.info('Using default kubeconfig');
      }
    }

    // Check if we have a valid cluster config
    const currentCluster = kc.getCurrentCluster();
    if (!currentCluster) {
      k8sLogger.warn('No Kubernetes cluster configured');
      return;
    }

    kubeConfig = kc;
    k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
    k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
    k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);
    k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
    k8sBatchApi = kc.makeApiClient(k8s.BatchV1Api);
    k8sLogger.info('Kubernetes client initialized');
  } catch (error) {
    k8sLogger.warn('Failed to initialize Kubernetes client', {
      errorMessage: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export function getK8sClient(): {
  core: k8s.CoreV1Api;
  apps: k8s.AppsV1Api;
  custom: k8s.CustomObjectsApi;
  networking: k8s.NetworkingV1Api;
  batch: k8s.BatchV1Api;
  config: k8s.KubeConfig;
} {
  if (
    !k8sCoreApi ||
    !k8sAppsApi ||
    !k8sCustomApi ||
    !k8sNetworkingApi ||
    !k8sBatchApi ||
    !kubeConfig
  ) {
    initK8sClient();
    if (
      !k8sCoreApi ||
      !k8sAppsApi ||
      !k8sCustomApi ||
      !k8sNetworkingApi ||
      !k8sBatchApi ||
      !kubeConfig
    ) {
      throw new Error('K8s client not initialized');
    }
  }

  return {
    core: k8sCoreApi,
    apps: k8sAppsApi,
    custom: k8sCustomApi,
    networking: k8sNetworkingApi,
    batch: k8sBatchApi,
    config: kubeConfig,
  };
}

export async function createNamespace(
  name: string,
  labels: Record<string, string | null | undefined> = {}
): Promise<void> {
  const { core } = getK8sClient();
  const normalizedLabels = Object.fromEntries(
    Object.entries(labels).filter((entry): entry is [string, string] => Boolean(entry[1]))
  );

  try {
    await core.readNamespace({ name });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) === 404) {
      await core.createNamespace({
        body: {
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: {
            name,
            labels: normalizedLabels,
          },
        },
      });
    } else {
      throw e;
    }
  }
}

export async function deleteNamespace(name: string): Promise<void> {
  const { core } = getK8sClient();

  try {
    await core.deleteNamespace({ name });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) !== 404) {
      throw e;
    }
  }
}

async function doesNamespaceExist(name: string): Promise<boolean> {
  const { core } = getK8sClient();

  try {
    await core.readNamespace({ name });
    return true;
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) === 404) {
      return false;
    }

    throw e;
  }
}

export async function waitForNamespaceCreated(input: {
  name: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<boolean> {
  const timeoutMs = input.timeoutMs ?? 45_000;
  const pollIntervalMs = input.pollIntervalMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (await doesNamespaceExist(input.name)) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return doesNamespaceExist(input.name);
}

export async function waitForNamespaceDeleted(input: {
  name: string;
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<boolean> {
  const timeoutMs = input.timeoutMs ?? 90_000;
  const pollIntervalMs = input.pollIntervalMs ?? 2_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (!(await doesNamespaceExist(input.name))) {
      return true;
    }

    await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
  }

  return !(await doesNamespaceExist(input.name));
}

export async function deletePod(
  namespace: string,
  name: string,
  options?: {
    force?: boolean;
  }
): Promise<void> {
  const { core } = getK8sClient();

  try {
    await core.deleteNamespacedPod({
      namespace,
      name,
      gracePeriodSeconds: options?.force ? 0 : undefined,
      body: options?.force
        ? {
            gracePeriodSeconds: 0,
            propagationPolicy: 'Background',
          }
        : undefined,
    });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) !== 404) {
      throw e;
    }
  }
}

export async function cleanupStuckTerminatingPods(
  namespace: string,
  options?: {
    olderThanMs?: number;
  }
): Promise<string[]> {
  const thresholdMs = options?.olderThanMs ?? 10 * 60 * 1000;
  const now = Date.now();
  const pods = await getPods(namespace);
  const stuckPods = pods.filter((pod) => {
    const deletionTimestamp = pod.metadata?.deletionTimestamp;
    if (!deletionTimestamp || !pod.metadata?.name) {
      return false;
    }

    const deletedAt = new Date(deletionTimestamp).getTime();
    return !Number.isNaN(deletedAt) && now - deletedAt >= thresholdMs;
  });

  await Promise.all(
    stuckPods.map((pod) => deletePod(namespace, pod.metadata?.name ?? '', { force: true }))
  );

  return stuckPods.map((pod) => pod.metadata?.name ?? '').filter(Boolean);
}

export async function getDeployments(namespace: string): Promise<k8s.V1Deployment[]> {
  const { apps } = getK8sClient();

  const response = await apps.listNamespacedDeployment({ namespace });
  return response.items;
}

export async function scaleDeploymentIfExists(input: {
  namespace: string;
  name: string;
  replicas: number;
}): Promise<boolean> {
  const { apps } = getK8sClient();

  try {
    const current = await apps.readNamespacedDeployment({
      namespace: input.namespace,
      name: input.name,
    });
    if (!current.spec?.selector || !current.spec.template) {
      return false;
    }

    await apps.replaceNamespacedDeployment({
      namespace: input.namespace,
      name: input.name,
      body: {
        ...current,
        spec: {
          ...current.spec,
          selector: current.spec.selector,
          template: current.spec.template,
          replicas: input.replicas,
        },
      },
    });

    return true;
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) === 404) {
      return false;
    }

    throw e;
  }
}

export async function getPods(namespace: string, labelSelector?: string): Promise<k8s.V1Pod[]> {
  const { core } = getK8sClient();

  const response = await core.listNamespacedPod({
    namespace,
    labelSelector,
  });
  return response.items;
}

export async function getPodsAllNamespaces(labelSelector?: string): Promise<k8s.V1Pod[]> {
  const { core } = getK8sClient();

  const response = await core.listPodForAllNamespaces({
    labelSelector,
  });
  return response.items;
}

export async function getNodes(): Promise<k8s.V1Node[]> {
  const { core } = getK8sClient();

  const response = await core.listNode();
  return response.items;
}

export async function getServices(namespace: string): Promise<k8s.V1Service[]> {
  const { core } = getK8sClient();

  const response = await core.listNamespacedService({ namespace });
  return response.items;
}

export async function getEvents(namespace: string): Promise<k8s.CoreV1Event[]> {
  const { core } = getK8sClient();

  const response = await core.listNamespacedEvent({ namespace });
  return response.items;
}

export async function getPodLogs(
  namespace: string,
  podName: string,
  containerName?: string,
  tailLines: number = 100,
  follow: boolean = false
): Promise<string> {
  const { config } = getK8sClient();
  const logger = new k8s.Log(config);
  let output = '';

  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });

  await logger.log(namespace, podName, containerName ?? '', stream, {
    follow,
    tailLines,
  });

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return output;
}

export async function createJob(namespace: string, body: k8s.V1Job): Promise<void> {
  const { batch } = getK8sClient();
  await batch.createNamespacedJob({ namespace, body });
}

export async function getJob(namespace: string, name: string): Promise<k8s.V1Job> {
  const { batch } = getK8sClient();
  return batch.readNamespacedJob({ namespace, name });
}

export async function deleteJob(namespace: string, name: string): Promise<void> {
  const { batch } = getK8sClient();
  try {
    await batch.deleteNamespacedJob({
      namespace,
      name,
      body: {
        propagationPolicy: 'Background',
      },
    });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) !== 404) {
      throw e;
    }
  }
}

export async function getPodContainers(namespace: string, podName: string): Promise<string[]> {
  const { core } = getK8sClient();

  const pod = await core.readNamespacedPod({ namespace, name: podName });
  const containers = pod.spec?.containers || [];
  const initContainers = pod.spec?.initContainers || [];

  return [
    ...initContainers.map((c) => c.name || ''),
    ...containers.map((c) => c.name || ''),
  ].filter(Boolean);
}

export async function execInPod(
  namespace: string,
  podName: string,
  containerName: string,
  command: string[]
): Promise<string> {
  const { config } = getK8sClient();

  const exec = new k8s.Exec(config);

  return new Promise((resolve, reject) => {
    let output = '';
    let errorOutput = '';

    const stdout = new (require('node:stream').Writable)({
      write(chunk: Buffer, _encoding: string, callback: () => void) {
        output += chunk.toString();
        callback();
      },
    });

    const stderr = new (require('node:stream').Writable)({
      write(chunk: Buffer, _encoding: string, callback: () => void) {
        errorOutput += chunk.toString();
        callback();
      },
    });

    exec
      .exec(namespace, podName, containerName, command, stdout, stderr, null, false)
      .then(() => {
        resolve(output || errorOutput);
      })
      .catch((err: Error) => {
        if (output || errorOutput) {
          resolve(output || errorOutput);
        } else {
          reject(err);
        }
      });

    setTimeout(() => {
      if (!output && !errorOutput) {
        reject(new Error('Command timed out'));
      }
    }, 30000);
  });
}

export async function createConfigMap(
  namespace: string,
  name: string,
  data: Record<string, string>
): Promise<void> {
  const { core } = getK8sClient();

  try {
    await core.readNamespacedConfigMap({ namespace, name });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) === 404) {
      await core.createNamespacedConfigMap({
        namespace,
        body: {
          apiVersion: 'v1',
          kind: 'ConfigMap',
          metadata: { name },
          data,
        },
      });
    } else {
      throw e;
    }
  }
}

export async function getConfigMaps(namespace: string): Promise<k8s.V1ConfigMap[]> {
  const { core } = getK8sClient();

  const response = await core.listNamespacedConfigMap({ namespace });
  return response.items;
}

export async function deleteConfigMap(namespace: string, name: string): Promise<void> {
  const { core } = getK8sClient();

  try {
    await core.deleteNamespacedConfigMap({ namespace, name });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) !== 404) {
      throw e;
    }
  }
}

export async function createSecret(
  namespace: string,
  name: string,
  data: Record<string, string>,
  type: string = 'Opaque'
): Promise<void> {
  const { core } = getK8sClient();

  const encodedData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    encodedData[key] = Buffer.from(value).toString('base64');
  }

  try {
    await core.readNamespacedSecret({ namespace, name });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) === 404) {
      await core.createNamespacedSecret({
        namespace,
        body: {
          apiVersion: 'v1',
          kind: 'Secret',
          metadata: { name },
          type,
          data: encodedData,
        },
      });
    } else {
      throw e;
    }
  }
}

export async function getSecrets(namespace: string): Promise<k8s.V1Secret[]> {
  const { core } = getK8sClient();

  const response = await core.listNamespacedSecret({ namespace });
  return response.items;
}

export async function deleteSecret(namespace: string, name: string): Promise<void> {
  const { core } = getK8sClient();

  try {
    await core.deleteNamespacedSecret({ namespace, name });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) !== 404) {
      throw e;
    }
  }
}

/**
 * 创建或更新 K8s Secret（upsert 语义）
 * 存在则替换所有 data，不存在则创建
 */
export async function upsertSecret(
  namespace: string,
  name: string,
  data: Record<string, string>,
  type: string = 'Opaque'
): Promise<void> {
  const { core } = getK8sClient();

  const encodedData: Record<string, string> = {};
  for (const [key, value] of Object.entries(data)) {
    encodedData[key] = Buffer.from(value).toString('base64');
  }

  const body = {
    apiVersion: 'v1',
    kind: 'Secret',
    metadata: { name, namespace },
    type,
    data: encodedData,
  };

  try {
    await core.readNamespacedSecret({ namespace, name });
    // 已存在：替换
    await core.replaceNamespacedSecret({ namespace, name, body });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) === 404) {
      await core.createNamespacedSecret({ namespace, body });
    } else {
      throw e;
    }
  }
}

/**
 * 创建或更新 K8s ConfigMap（upsert 语义）
 */
export async function upsertConfigMap(
  namespace: string,
  name: string,
  data: Record<string, string>
): Promise<void> {
  const { core } = getK8sClient();

  const body = {
    apiVersion: 'v1',
    kind: 'ConfigMap',
    metadata: { name, namespace },
    data,
  };

  try {
    await core.readNamespacedConfigMap({ namespace, name });
    await core.replaceNamespacedConfigMap({ namespace, name, body });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) === 404) {
      await core.createNamespacedConfigMap({ namespace, body });
    } else {
      throw e;
    }
  }
}

export function getIsConnected(): boolean {
  return (
    k8sCoreApi !== null &&
    k8sAppsApi !== null &&
    k8sCustomApi !== null &&
    k8sNetworkingApi !== null &&
    k8sBatchApi !== null
  );
}

export function isK8sAvailable(): boolean {
  initK8sClient();
  return getIsConnected();
}

const DEFAULT_DEPLOYMENT_REVISION_HISTORY_LIMIT = 2;
const LEGACY_DEPLOYMENT_ANNOTATIONS_TO_CLEAR = [
  'juanie.dev/last-applied-configuration',
  'juanie.dev/last-applied-spec',
] as const;

export async function createDeployment(
  namespace: string,
  name: string,
  spec: {
    image: string;
    port: number;
    replicas: number;
    env?: Record<string, string>;
    envFrom?: Array<{ secretRef?: { name: string }; configMapRef?: { name: string } }>;
    imagePullSecrets?: string[];
    command?: string[];
    args?: string[];
    healthcheckPath?: string;
    cpuRequest?: string;
    cpuLimit?: string;
    memoryRequest?: string;
    memoryLimit?: string;
  }
): Promise<void> {
  const { apps } = getK8sClient();

  const envVars = spec.env
    ? Object.entries(spec.env).map(([name, value]) => ({ name, value }))
    : [];

  await apps.createNamespacedDeployment({
    namespace,
    body: {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name },
      spec: {
        replicas: spec.replicas,
        revisionHistoryLimit: DEFAULT_DEPLOYMENT_REVISION_HISTORY_LIMIT,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: {
            imagePullSecrets: spec.imagePullSecrets?.map((s) => ({ name: s })),
            containers: [
              {
                name: 'app',
                image: spec.image,
                ports: [{ containerPort: spec.port }],
                env: envVars,
                envFrom: spec.envFrom,
                command: spec.command,
                args: spec.args,
                readinessProbe: {
                  httpGet: { path: spec.healthcheckPath || '/api/health/ready', port: spec.port },
                  initialDelaySeconds: 15,
                  periodSeconds: 10,
                  failureThreshold: 6, // 15 + 6*10 = 75s before giving up
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
      },
    },
  });
}

export async function updateDeployment(
  namespace: string,
  name: string,
  spec: {
    image?: string;
    replicas?: number;
    port?: number;
    env?: Record<string, string>;
    envFrom?: Array<{ secretRef?: { name: string }; configMapRef?: { name: string } }>;
    imagePullSecrets?: string[];
    healthcheckPath?: string;
    cpuRequest?: string;
    cpuLimit?: string;
    memoryRequest?: string;
    memoryLimit?: string;
  }
): Promise<void> {
  const { apps } = getK8sClient();

  const current = await apps.readNamespacedDeployment({ namespace, name });
  const currentMetadataAnnotations = { ...(current.metadata?.annotations ?? {}) };

  for (const annotationKey of LEGACY_DEPLOYMENT_ANNOTATIONS_TO_CLEAR) {
    delete currentMetadataAnnotations[annotationKey];
  }

  const containers = current.spec?.template?.spec?.containers || [];
  const updatedContainers = containers.map((container) => ({
    ...container,
    image: spec.image ?? container.image,
    ports:
      spec.port !== undefined
        ? [{ containerPort: spec.port, name: 'http', protocol: 'TCP' }]
        : container.ports,
    env: spec.env
      ? Object.entries(spec.env).map(([name, value]) => ({ name, value }))
      : container.env,
    // If envFrom is provided, always apply it so stale/missing envFrom refs get fixed.
    ...(spec.envFrom !== undefined ? { envFrom: spec.envFrom } : {}),
    ...(spec.healthcheckPath
      ? {
          readinessProbe: {
            httpGet: {
              path: spec.healthcheckPath,
              port: spec.port ?? container.ports?.[0]?.containerPort ?? 3000,
            },
            initialDelaySeconds: 15,
            periodSeconds: 10,
            failureThreshold: 6,
          },
          livenessProbe: {
            httpGet: {
              path: spec.healthcheckPath,
              port: spec.port ?? container.ports?.[0]?.containerPort ?? 3000,
            },
            initialDelaySeconds: 30,
            periodSeconds: 20,
            failureThreshold: 3,
          },
        }
      : {}),
    resources: {
      requests: {
        cpu: spec.cpuRequest ?? container.resources?.requests?.cpu ?? '100m',
        memory: spec.memoryRequest ?? container.resources?.requests?.memory ?? '256Mi',
      },
      limits: {
        cpu: spec.cpuLimit ?? container.resources?.limits?.cpu ?? '500m',
        memory: spec.memoryLimit ?? container.resources?.limits?.memory ?? '512Mi',
      },
    },
  }));

  // Always bump restartedAt so the pod rolls even when the image tag is unchanged.
  // This ensures pods pick up the latest ConfigMap/Secret values from envFrom.
  const existingAnnotations = current.spec?.template?.metadata?.annotations || {};
  const updated: k8s.V1Deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: {
      ...current.metadata,
      annotations: currentMetadataAnnotations,
    },
    spec: {
      replicas: spec.replicas ?? current.spec?.replicas,
      revisionHistoryLimit: DEFAULT_DEPLOYMENT_REVISION_HISTORY_LIMIT,
      selector: current.spec?.selector || { matchLabels: { app: name } },
      template: {
        metadata: {
          ...(current.spec?.template?.metadata || { labels: { app: name } }),
          annotations: {
            ...existingAnnotations,
            'kubectl.kubernetes.io/restartedAt': new Date().toISOString(),
          },
        },
        spec: {
          ...current.spec?.template?.spec,
          ...(spec.imagePullSecrets !== undefined
            ? {
                imagePullSecrets: spec.imagePullSecrets.map((secretName) => ({ name: secretName })),
              }
            : {}),
          containers: updatedContainers,
        },
      },
    },
  };

  await apps.replaceNamespacedDeployment({ namespace, name, body: updated });
}

/**
 * Trigger a rolling restart for all Deployments in a namespace by bumping the
 * `kubectl.kubernetes.io/restartedAt` annotation. Pods will be recreated one by
 * one (respecting their RollingUpdate strategy) and will re-read the latest
 * ConfigMap / Secret values from envFrom.
 */
export async function rolloutRestartDeployments(namespace: string): Promise<void> {
  const { apps } = getK8sClient();

  let deploymentNames: string[] = [];
  try {
    const list = await apps.listNamespacedDeployment({ namespace });
    deploymentNames = (list.items || [])
      .map((d) => d.metadata?.name)
      .filter((n): n is string => Boolean(n));
  } catch (e) {
    k8sLogger.warn('Could not list deployments for rollout restart', {
      namespace,
      errorMessage: e instanceof Error ? e.message : String(e),
    });
    return;
  }

  if (deploymentNames.length === 0) return;

  const restartedAt = new Date().toISOString();
  await Promise.all(
    deploymentNames.map(async (deploymentName) => {
      try {
        const current = await apps.readNamespacedDeployment({ namespace, name: deploymentName });
        if (!current.spec?.selector) return;
        const existingAnnotations = current.spec?.template?.metadata?.annotations || {};
        const updated: k8s.V1Deployment = {
          apiVersion: 'apps/v1',
          kind: 'Deployment',
          metadata: current.metadata,
          spec: {
            ...current.spec,
            selector: current.spec.selector,
            template: {
              ...current.spec?.template,
              metadata: {
                ...current.spec?.template?.metadata,
                annotations: {
                  ...existingAnnotations,
                  'kubectl.kubernetes.io/restartedAt': restartedAt,
                },
              },
            },
          },
        };
        await apps.replaceNamespacedDeployment({ namespace, name: deploymentName, body: updated });
      } catch (e) {
        k8sLogger.warn('Failed to restart deployment', {
          namespace,
          deploymentName,
          errorMessage: e instanceof Error ? e.message : String(e),
        });
      }
    })
  );

  k8sLogger.info('Rolling restart triggered for deployments', {
    namespace,
    deploymentCount: deploymentNames.length,
    deploymentNames,
  });
}

export async function deleteDeployment(namespace: string, name: string): Promise<void> {
  const { apps } = getK8sClient();

  try {
    await apps.deleteNamespacedDeployment({ namespace, name });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) !== 404) {
      throw e;
    }
  }
}

// ============================================
// Service Management
// ============================================

export async function createService(
  namespace: string,
  name: string,
  spec: {
    port: number;
    targetPort: number;
    type?: 'ClusterIP' | 'LoadBalancer' | 'NodePort';
    selector?: Record<string, string>;
  }
): Promise<void> {
  const { core } = getK8sClient();

  await core.createNamespacedService({
    namespace,
    body: {
      apiVersion: 'v1',
      kind: 'Service',
      metadata: { name },
      spec: {
        type: spec.type || 'ClusterIP',
        selector: spec.selector || { app: name },
        ports: [
          {
            port: spec.port,
            targetPort: spec.targetPort,
            protocol: 'TCP',
          },
        ],
      },
    },
  });
}

export async function upsertService(
  namespace: string,
  name: string,
  spec: {
    port: number;
    targetPort: number | string;
    type?: 'ClusterIP' | 'LoadBalancer' | 'NodePort';
    selector?: Record<string, string>;
  }
): Promise<void> {
  const { core } = getK8sClient();

  try {
    const current = await core.readNamespacedService({ namespace, name });

    await core.replaceNamespacedService({
      namespace,
      name,
      body: {
        apiVersion: 'v1',
        kind: 'Service',
        metadata: {
          ...current.metadata,
          name,
          namespace,
        },
        spec: {
          ...current.spec,
          type: spec.type || current.spec?.type || 'ClusterIP',
          selector: spec.selector || current.spec?.selector || { app: name },
          ports: [
            {
              name: 'http',
              port: spec.port,
              targetPort: spec.targetPort,
              protocol: 'TCP',
            },
          ],
        },
      },
    });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) === 404) {
      await createService(namespace, name, {
        port: spec.port,
        targetPort: typeof spec.targetPort === 'number' ? spec.targetPort : spec.port,
        type: spec.type,
        selector: spec.selector,
      });
      return;
    }

    throw e;
  }
}

export async function deleteService(namespace: string, name: string): Promise<void> {
  const { core } = getK8sClient();

  try {
    await core.deleteNamespacedService({ namespace, name });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) !== 404) {
      throw e;
    }
  }
}

export interface CloudNativePgClusterManifest {
  apiVersion: 'postgresql.cnpg.io/v1';
  kind: 'Cluster';
  metadata: {
    name: string;
    namespace: string;
    labels?: Record<string, string>;
  };
  spec: Record<string, unknown>;
}

export async function upsertCloudNativePgCluster(
  manifest: CloudNativePgClusterManifest
): Promise<void> {
  const { custom } = getK8sClient();

  try {
    await custom.getNamespacedCustomObject({
      group: 'postgresql.cnpg.io',
      version: 'v1',
      namespace: manifest.metadata.namespace,
      plural: 'clusters',
      name: manifest.metadata.name,
    });
    await custom.replaceNamespacedCustomObject({
      group: 'postgresql.cnpg.io',
      version: 'v1',
      namespace: manifest.metadata.namespace,
      plural: 'clusters',
      name: manifest.metadata.name,
      body: manifest,
    });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) === 404) {
      await custom.createNamespacedCustomObject({
        group: 'postgresql.cnpg.io',
        version: 'v1',
        namespace: manifest.metadata.namespace,
        plural: 'clusters',
        body: manifest,
      });
      return;
    }

    throw e;
  }
}

export async function deleteCloudNativePgCluster(namespace: string, name: string): Promise<void> {
  const { custom } = getK8sClient();

  try {
    await custom.deleteNamespacedCustomObject({
      group: 'postgresql.cnpg.io',
      version: 'v1',
      namespace,
      plural: 'clusters',
      name,
    });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) !== 404) {
      throw e;
    }
  }
}

// ============================================
// Cilium Gateway API Management
// ============================================

// 使用 Cilium Gateway API (Gateway + HTTPRoute) 替代传统 Ingress

export interface CiliumGatewaySpec {
  name: string;
  namespace: string;
  host?: string;
}

export interface CiliumHTTPRouteSpec {
  name: string;
  namespace: string;
  gatewayName: string;
  gatewayNamespace?: string;
  sectionName?: string;
  hostnames: string[];
  serviceName: string;
  servicePort: number;
  backendRefs?: Array<{
    serviceName: string;
    servicePort: number;
    weight?: number;
  }>;
  path?: string;
}

export async function createCiliumGateway(
  namespace: string,
  name: string,
  spec: {
    host?: string;
    annotations?: Record<string, string>;
    tlsSecretName?: string;
    createTLSSecret?: boolean;
  }
): Promise<void> {
  const { custom } = getK8sClient();

  // Optionally create a placeholder TLS Secret
  if (spec.createTLSSecret && spec.tlsSecretName) {
    await createSecret(
      namespace,
      spec.tlsSecretName,
      {
        'tls.crt': 'PLACEHOLDER_CERTIFICATE',
        'tls.key': 'PLACEHOLDER_KEY',
      },
      'kubernetes.io/tls'
    );
  }

  // Build listeners array
  const listeners: any[] = [
    {
      name: 'http',
      protocol: 'HTTP',
      hostname: spec.host,
      port: 80,
      allowedRoutes: {
        namespaces: {
          from: 'Selector',
          selector: {
            matchLabels: {
              'kubernetes.io/metadata.name': namespace,
            },
          },
        },
      },
    },
  ];

  // Only add HTTPS listener if TLS secret is available
  if (spec.tlsSecretName) {
    listeners.push({
      name: 'https',
      protocol: 'HTTPS',
      hostname: spec.host,
      port: 443,
      allowedRoutes: {
        namespaces: {
          from: 'Selector',
          selector: {
            matchLabels: {
              'kubernetes.io/metadata.name': namespace,
            },
          },
        },
      },
      tls: {
        mode: 'Terminate',
        certificateRefs: [
          {
            kind: 'Secret',
            name: spec.tlsSecretName,
          },
        ],
      },
    });
  }

  const gateway = {
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'Gateway',
    metadata: {
      name,
      namespace,
      annotations: {
        'cilium.io/gateway-type': 'private',
        ...spec.annotations,
      },
    },
    spec: {
      gatewayClassName: 'cilium',
      listeners,
    },
  };

  await custom.createNamespacedCustomObject({
    group: 'gateway.networking.k8s.io',
    version: 'v1',
    namespace,
    plural: 'gateways',
    body: gateway,
  });
}

export async function createCiliumHTTPRoute(spec: CiliumHTTPRouteSpec): Promise<void> {
  const { custom } = getK8sClient();

  const route = {
    apiVersion: 'gateway.networking.k8s.io/v1',
    kind: 'HTTPRoute',
    metadata: {
      name: spec.name,
      namespace: spec.namespace,
    },
    spec: {
      parentRefs: [
        {
          name: spec.gatewayName,
          namespace: spec.gatewayNamespace ?? spec.namespace,
          ...(spec.sectionName ? { sectionName: spec.sectionName } : {}),
        },
      ],
      hostnames: spec.hostnames,
      rules: [
        {
          backendRefs: [
            ...(spec.backendRefs?.length
              ? spec.backendRefs.map((backend) => ({
                  kind: 'Service',
                  name: backend.serviceName,
                  port: backend.servicePort,
                  ...(backend.weight !== undefined ? { weight: backend.weight } : {}),
                }))
              : [
                  {
                    kind: 'Service',
                    name: spec.serviceName,
                    port: spec.servicePort,
                  },
                ]),
          ],
          matches: [
            {
              path: {
                type: 'PathPrefix',
                value: spec.path || '/',
              },
            },
          ],
        },
      ],
    },
  };

  await custom.createNamespacedCustomObject({
    group: 'gateway.networking.k8s.io',
    version: 'v1',
    namespace: spec.namespace,
    plural: 'httproutes',
    body: route,
  });
}

export async function deploymentExists(namespace: string, name: string): Promise<boolean> {
  const { apps } = getK8sClient();

  try {
    await apps.readNamespacedDeployment({ namespace, name });
    return true;
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) === 404) {
      return false;
    }

    throw e;
  }
}

export interface DeploymentSnapshot {
  image: string | null;
  replicas: number;
  envFrom?: Array<{ secretRef?: { name: string }; configMapRef?: { name: string } }>;
  imagePullSecrets?: string[];
  port: number;
  cpuRequest?: string;
  cpuLimit?: string;
  memoryRequest?: string;
  memoryLimit?: string;
}

function getContainerWaitingMessage(containerStatus?: k8s.V1ContainerStatus): string | null {
  const waiting = containerStatus?.state?.waiting;
  if (!waiting) {
    return null;
  }

  return waiting.message
    ? `${waiting.reason ?? 'Waiting'}: ${waiting.message}`
    : (waiting.reason ?? 'Waiting');
}

function getContainerTerminatedMessage(containerStatus?: k8s.V1ContainerStatus): string | null {
  const terminated = containerStatus?.state?.terminated;
  if (!terminated) {
    return null;
  }

  return terminated.message
    ? `${terminated.reason ?? 'Terminated'}: ${terminated.message}`
    : (terminated.reason ?? 'Terminated');
}

function describeDeploymentPodIssues(pods: k8s.V1Pod[]): string | null {
  for (const pod of pods) {
    const statuses = pod.status?.containerStatuses ?? [];

    for (const status of statuses) {
      const waitingMessage = getContainerWaitingMessage(status);
      if (
        waitingMessage &&
        ['ImagePullBackOff', 'ErrImagePull', 'CrashLoopBackOff', 'CreateContainerConfigError'].some(
          (reason) => waitingMessage.includes(reason)
        )
      ) {
        return `${pod.metadata?.name ?? 'pod'} · ${waitingMessage}`;
      }

      const terminatedMessage = getContainerTerminatedMessage(status);
      if (terminatedMessage) {
        return `${pod.metadata?.name ?? 'pod'} · ${terminatedMessage}`;
      }
    }
  }

  return null;
}

function getEventTimestamp(event: k8s.CoreV1Event): number {
  const timestamp = event.eventTime ?? event.lastTimestamp ?? event.firstTimestamp;
  if (!timestamp) {
    return 0;
  }

  const value = new Date(timestamp).getTime();
  return Number.isNaN(value) ? 0 : value;
}

function formatPodWarningEvent(event: k8s.CoreV1Event): string {
  const reason = event.reason ?? 'Warning';
  if (!event.message) {
    return reason;
  }

  return `${reason}: ${event.message}`;
}

function isReadinessWarning(event: k8s.CoreV1Event): boolean {
  const reason = event.reason ?? '';
  const message = event.message ?? '';
  const text = `${reason} ${message}`;
  return [
    'Unhealthy',
    'Readiness probe failed',
    'Liveness probe failed',
    'Startup probe failed',
    'Back-off restarting failed container',
  ].some((keyword) => text.includes(keyword));
}

async function describeDeploymentEventIssues(
  namespace: string,
  pods: k8s.V1Pod[]
): Promise<string | null> {
  const podNames = new Set(
    pods.map((pod) => pod.metadata?.name).filter((name): name is string => Boolean(name))
  );

  if (podNames.size === 0) {
    return null;
  }

  let events: k8s.CoreV1Event[];
  try {
    events = await getEvents(namespace);
  } catch (error) {
    k8sLogger.warn('Could not list pod events while waiting for deployment readiness', {
      namespace,
      errorMessage: error instanceof Error ? error.message : String(error),
    });
    return null;
  }

  const podWarnings = events
    .filter((event) => {
      if (event.type !== 'Warning') {
        return false;
      }

      if (event.involvedObject.kind !== 'Pod') {
        return false;
      }

      return podNames.has(event.involvedObject.name ?? '');
    })
    .sort((left, right) => getEventTimestamp(right) - getEventTimestamp(left));

  const event = podWarnings.find(isReadinessWarning) ?? podWarnings[0];
  if (!event) {
    return null;
  }

  return `${event.involvedObject.name ?? 'pod'} · ${formatPodWarningEvent(event)}`;
}

export async function waitForDeploymentReady(input: {
  namespace: string;
  name: string;
  timeoutMs?: number;
  pollMs?: number;
}) {
  const timeoutMs = input.timeoutMs ?? 10 * 60 * 1000;
  const pollMs = input.pollMs ?? 3000;
  const deadline = Date.now() + timeoutMs;
  const { apps } = getK8sClient();
  let lastObservedIssue: string | null = null;

  while (Date.now() < deadline) {
    const deployment = await apps.readNamespacedDeployment({
      namespace: input.namespace,
      name: input.name,
    });

    const desiredReplicas = deployment.spec?.replicas ?? 1;
    const readyReplicas = deployment.status?.readyReplicas ?? 0;
    const updatedReplicas = deployment.status?.updatedReplicas ?? 0;
    const availableReplicas = deployment.status?.availableReplicas ?? 0;
    const progressingCondition = deployment.status?.conditions?.find(
      (condition) => condition.type === 'Progressing'
    );

    if (progressingCondition?.status === 'False') {
      throw new Error(progressingCondition.message ?? 'Deployment rollout failed');
    }

    const selectorLabels = deployment.spec?.selector?.matchLabels ?? {};
    const labelSelector = Object.entries(selectorLabels)
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    const pods = await getPods(input.namespace, labelSelector || undefined);
    const podIssue = describeDeploymentPodIssues(pods);
    if (podIssue) {
      throw new Error(podIssue);
    }

    const eventIssue = await describeDeploymentEventIssues(input.namespace, pods);

    if (
      desiredReplicas > 0 &&
      readyReplicas >= desiredReplicas &&
      updatedReplicas >= desiredReplicas &&
      availableReplicas >= desiredReplicas
    ) {
      return;
    }

    lastObservedIssue =
      eventIssue ??
      progressingCondition?.message ??
      `ready ${readyReplicas}/${desiredReplicas}, updated ${updatedReplicas}/${desiredReplicas}`;

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw new Error(lastObservedIssue ?? `Deployment ${input.name} rollout timed out`);
}

function normalizeServiceVerificationPath(path: string): string {
  if (!path.startsWith('/')) {
    return `/${path}`;
  }

  return path;
}

const SERVICE_VERIFY_IMAGE = 'curlimages/curl:8.7.1';

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function buildVerificationPodName(serviceName: string): string {
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${serviceName}-verify-${suffix}`.replace(/[^a-z0-9-]/g, '-').slice(0, 63);
}

function getPodStatusMessage(pod: k8s.V1Pod): string | null {
  const statuses = [
    ...(pod.status?.initContainerStatuses ?? []),
    ...(pod.status?.containerStatuses ?? []),
  ];

  for (const status of statuses) {
    const waitingMessage = getContainerWaitingMessage(status);
    if (waitingMessage) {
      return waitingMessage;
    }

    const terminatedMessage = getContainerTerminatedMessage(status);
    if (terminatedMessage) {
      return terminatedMessage;
    }
  }

  return pod.status?.message ?? pod.status?.reason ?? null;
}

async function waitForPodCompletion(input: {
  namespace: string;
  name: string;
  timeoutMs: number;
  pollMs: number;
}): Promise<k8s.V1Pod> {
  const { core } = getK8sClient();
  const deadline = Date.now() + input.timeoutMs;
  let lastObservedIssue: string | null = null;

  while (Date.now() < deadline) {
    const pod = await core.readNamespacedPod({
      namespace: input.namespace,
      name: input.name,
    });

    const phase = pod.status?.phase;
    if (phase === 'Succeeded' || phase === 'Failed') {
      return pod;
    }

    lastObservedIssue = getPodStatusMessage(pod) ?? lastObservedIssue;
    await sleep(input.pollMs);
  }

  throw new Error(
    lastObservedIssue ?? `Verification pod ${input.namespace}/${input.name} timed out`
  );
}

export async function verifyServiceReachability(input: {
  namespace: string;
  serviceName: string;
  port: number;
  paths: string[];
  timeoutMs?: number;
  pollMs?: number;
  requestTimeoutMs?: number;
}) {
  const timeoutMs = input.timeoutMs ?? 30000;
  const pollMs = input.pollMs ?? 2000;
  const requestTimeoutMs = Math.min(input.requestTimeoutMs ?? 8000, timeoutMs);
  const { core } = getK8sClient();
  const podName = buildVerificationPodName(input.serviceName);
  const attemptCount = Math.max(1, Math.ceil(timeoutMs / pollMs));
  const sleepSeconds = Math.max(1, Math.ceil(pollMs / 1000));
  const requestTimeoutSeconds = Math.max(1, Math.ceil(requestTimeoutMs / 1000));
  const normalizedPaths = input.paths.map(normalizeServiceVerificationPath);
  const verificationCommands = normalizedPaths.map((path) =>
    [
      `last_error=''`,
      `attempt=1`,
      `while [ "$attempt" -le ${attemptCount} ]; do`,
      `  if code=$(curl --silent --show-error --output /tmp/verify-body --write-out '%{http_code}' --max-time ${requestTimeoutSeconds} ${shellQuote(`http://${input.serviceName}:${input.port}${path}`)} 2>/tmp/verify-error); then`,
      `    if [ "$code" -lt 400 ]; then`,
      `      break`,
      `    fi`,
      `    last_error=${shellQuote(`${path} returned `)}"$code"`,
      `  else`,
      `    last_error=$(cat /tmp/verify-error 2>/dev/null || true)`,
      `    [ -n "$last_error" ] || last_error='request failed'`,
      `  fi`,
      `  if [ "$attempt" -eq ${attemptCount} ]; then`,
      `    echo "$last_error" >&2`,
      `    exit 1`,
      `  fi`,
      `  attempt=$((attempt + 1))`,
      `  sleep ${sleepSeconds}`,
      `done`,
    ].join('\n')
  );
  const script = ['set -eu', ...verificationCommands, 'echo verification_ok'].join('\n');

  await core.createNamespacedPod({
    namespace: input.namespace,
    body: {
      apiVersion: 'v1',
      kind: 'Pod',
      metadata: {
        name: podName,
        labels: {
          'app.kubernetes.io/name': 'juanie-service-verify',
          'juanie.io/service': input.serviceName,
        },
      },
      spec: {
        restartPolicy: 'Never',
        containers: [
          {
            name: 'curl',
            image: SERVICE_VERIFY_IMAGE,
            command: ['/bin/sh', '-lc', script],
          },
        ],
      },
    },
  });

  try {
    const pod = await waitForPodCompletion({
      namespace: input.namespace,
      name: podName,
      timeoutMs: timeoutMs + requestTimeoutMs + pollMs,
      pollMs,
    });
    const logs = (await getPodLogs(input.namespace, podName, 'curl', 200).catch(() => '')).trim();

    if (pod.status?.phase !== 'Succeeded') {
      throw new Error(
        `Service verify failed for ${input.serviceName}: ${logs || getPodStatusMessage(pod) || 'verification pod failed'}`
      );
    }
  } finally {
    await deletePod(input.namespace, podName, { force: true }).catch(() => undefined);
  }
}

export async function getDeploymentSnapshot(
  namespace: string,
  name: string
): Promise<DeploymentSnapshot | null> {
  const { apps } = getK8sClient();

  try {
    const current = await apps.readNamespacedDeployment({ namespace, name });
    const container = current.spec?.template?.spec?.containers?.[0];

    if (!container) {
      return null;
    }

    return {
      image: container.image ?? null,
      replicas: current.spec?.replicas ?? 1,
      envFrom:
        container.envFrom?.map((item) => ({
          ...(item.secretRef?.name ? { secretRef: { name: item.secretRef.name } } : {}),
          ...(item.configMapRef?.name ? { configMapRef: { name: item.configMapRef.name } } : {}),
        })) ?? undefined,
      imagePullSecrets: current.spec?.template?.spec?.imagePullSecrets
        ?.map((item) => item.name)
        .filter(Boolean) as string[] | undefined,
      port: container.ports?.[0]?.containerPort ?? 3000,
      cpuRequest: container.resources?.requests?.cpu,
      cpuLimit: container.resources?.limits?.cpu,
      memoryRequest: container.resources?.requests?.memory,
      memoryLimit: container.resources?.limits?.memory,
    };
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) === 404) {
      return null;
    }

    throw e;
  }
}

export async function deleteCiliumGateway(namespace: string, name: string): Promise<void> {
  const { custom } = getK8sClient();

  try {
    await custom.deleteNamespacedCustomObject({
      group: 'gateway.networking.k8s.io',
      version: 'v1',
      namespace,
      plural: 'gateways',
      name,
    });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) !== 404) {
      throw e;
    }
  }
}

export async function deleteCiliumHTTPRoute(namespace: string, name: string): Promise<void> {
  const { custom } = getK8sClient();

  try {
    await custom.deleteNamespacedCustomObject({
      group: 'gateway.networking.k8s.io',
      version: 'v1',
      namespace,
      plural: 'httproutes',
      name,
    });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) !== 404) {
      throw e;
    }
  }
}

export async function getCiliumGateways(namespace: string): Promise<unknown[]> {
  const { custom } = getK8sClient();

  const response = (await custom.listNamespacedCustomObject({
    group: 'gateway.networking.k8s.io',
    version: 'v1',
    namespace,
    plural: 'gateways',
  })) as { items: unknown[] };

  return response.items;
}

export async function getCiliumHTTPRoutes(namespace: string): Promise<unknown[]> {
  const { custom } = getK8sClient();

  const response = (await custom.listNamespacedCustomObject({
    group: 'gateway.networking.k8s.io',
    version: 'v1',
    namespace,
    plural: 'httproutes',
  })) as { items: unknown[] };

  return response.items;
}

interface HTTPRouteLike {
  metadata?: {
    name?: string;
  };
  spec?: {
    hostnames?: string[];
  };
}

export async function reconcileCiliumHTTPRoutesForHostname(input: {
  namespace: string;
  hostname: string;
  canonicalRouteName: string;
}): Promise<void> {
  const routes = (await getCiliumHTTPRoutes(input.namespace)) as HTTPRouteLike[];

  await Promise.all(
    routes
      .filter((route) => {
        const routeName = route.metadata?.name;
        const hostnames = route.spec?.hostnames ?? [];
        return (
          routeName && routeName !== input.canonicalRouteName && hostnames.includes(input.hostname)
        );
      })
      .map((route) => deleteCiliumHTTPRoute(input.namespace, route.metadata!.name!))
  );
}

// ============================================
// StatefulSet Management (for Databases)
// ============================================

export interface StatefulSetEnvFromSecret {
  type: 'secret';
  name: string;
}

export interface StatefulSetEnvVar {
  name: string;
  value?: string;
  valueFrom?: {
    secretKeyRef: {
      name: string;
      key: string;
    };
  };
}

export async function createStatefulSet(
  namespace: string,
  name: string,
  spec: {
    image: string;
    serviceName: string;
    port: number;
    replicas: number;
    env?: Record<string, string>;
    envFrom?: {
      secretName: string;
    };
    volumeName: string;
    storageSize: string;
    storageClass?: string;
    mountPath?: string;
    command?: string[];
    args?: string[];
    cpuRequest?: string;
    cpuLimit?: string;
    memoryRequest?: string;
    memoryLimit?: string;
  }
): Promise<void> {
  const { apps } = getK8sClient();

  const envVars: StatefulSetEnvVar[] = spec.env
    ? Object.entries(spec.env).map(([name, value]) => ({ name, value }))
    : [];

  const envFrom = spec.envFrom
    ? [
        {
          secretRef: {
            name: spec.envFrom.secretName,
          },
        },
      ]
    : undefined;

  await apps.createNamespacedStatefulSet({
    namespace,
    body: {
      apiVersion: 'apps/v1',
      kind: 'StatefulSet',
      metadata: { name },
      spec: {
        serviceName: spec.serviceName,
        replicas: spec.replicas,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: {
            containers: [
              {
                name: 'app',
                image: spec.image,
                ports: [{ containerPort: spec.port }],
                env: envVars,
                envFrom,
                command: spec.command,
                args: spec.args,
                volumeMounts: [
                  {
                    name: spec.volumeName,
                    mountPath: spec.mountPath || `/data/${spec.volumeName}`,
                  },
                ],
                resources: {
                  requests: {
                    cpu: spec.cpuRequest || '100m',
                    memory: spec.memoryRequest || '256Mi',
                  },
                  limits: {
                    cpu: spec.cpuLimit || '1',
                    memory: spec.memoryLimit || '1Gi',
                  },
                },
              },
            ],
          },
        },
        volumeClaimTemplates: [
          {
            metadata: { name: spec.volumeName },
            spec: {
              accessModes: ['ReadWriteOnce'],
              storageClassName: spec.storageClass,
              resources: {
                requests: {
                  storage: spec.storageSize,
                },
              },
            },
          },
        ],
      },
    },
  });
}

export async function deleteStatefulSet(namespace: string, name: string): Promise<void> {
  const { apps } = getK8sClient();

  try {
    await apps.deleteNamespacedStatefulSet({ namespace, name });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) !== 404) {
      throw e;
    }
  }
}
