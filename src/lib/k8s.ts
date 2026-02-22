import * as k8s from '@kubernetes/client-node';
import { existsSync } from 'fs';

let k8sCoreApi: k8s.CoreV1Api | null = null;
let k8sAppsApi: k8s.AppsV1Api | null = null;
let k8sCustomApi: k8s.CustomObjectsApi | null = null;
let k8sNetworkingApi: k8s.NetworkingV1Api | null = null;
let kubeConfig: k8s.KubeConfig | null = null;
let initAttempted = false;

export function initK8sClient(): void {
  if (initAttempted) return;
  initAttempted = true;

  const kc = new k8s.KubeConfig();

  try {
    const kubeconfigContent = process.env.KUBECONFIG_CONTENT;
    if (kubeconfigContent) {
      kc.loadFromString(kubeconfigContent);
    } else {
      const kubeconfigPath = process.env.KUBECONFIG || process.env.HOME + '/.kube/config';
      if (existsSync(kubeconfigPath)) {
        kc.loadFromFile(kubeconfigPath);
      } else {
        // Try loadFromDefault as last resort (may work in-cluster)
        kc.loadFromDefault();
      }
    }

    // Check if we have a valid cluster config
    const currentCluster = kc.getCurrentCluster();
    if (!currentCluster) {
      console.log('⚠️  No Kubernetes cluster configured');
      return;
    }

    kubeConfig = kc;
    k8sCoreApi = kc.makeApiClient(k8s.CoreV1Api);
    k8sAppsApi = kc.makeApiClient(k8s.AppsV1Api);
    k8sCustomApi = kc.makeApiClient(k8s.CustomObjectsApi);
    k8sNetworkingApi = kc.makeApiClient(k8s.NetworkingV1Api);
    console.log('✅ Kubernetes client initialized');
  } catch (error) {
    console.log(
      '⚠️  Failed to initialize Kubernetes client:',
      error instanceof Error ? error.message : 'Unknown error'
    );
  }
}

export function getK8sClient(): {
  core: k8s.CoreV1Api;
  apps: k8s.AppsV1Api;
  custom: k8s.CustomObjectsApi;
  networking: k8s.NetworkingV1Api;
  config: k8s.KubeConfig;
} {
  if (!k8sCoreApi || !k8sAppsApi || !k8sCustomApi || !k8sNetworkingApi || !kubeConfig) {
    initK8sClient();
    if (!k8sCoreApi || !k8sAppsApi || !k8sCustomApi || !k8sNetworkingApi || !kubeConfig) {
      throw new Error('K8s client not initialized');
    }
  }

  return {
    core: k8sCoreApi,
    apps: k8sAppsApi,
    custom: k8sCustomApi,
    networking: k8sNetworkingApi,
    config: kubeConfig,
  };
}

export async function createNamespace(name: string): Promise<void> {
  const { core } = getK8sClient();

  try {
    await core.readNamespace({ name });
  } catch (e: unknown) {
    const error = e as { statusCode?: number };
    if (error.statusCode === 404) {
      await core.createNamespace({
        body: {
          apiVersion: 'v1',
          kind: 'Namespace',
          metadata: { name },
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
    const error = e as { statusCode?: number };
    if (error.statusCode !== 404) {
      throw e;
    }
  }
}

export async function getDeployments(namespace: string): Promise<k8s.V1Deployment[]> {
  const { apps } = getK8sClient();

  const response = await apps.listNamespacedDeployment({ namespace });
  return response.items;
}

export async function getPods(namespace: string, labelSelector?: string): Promise<k8s.V1Pod[]> {
  const { core } = getK8sClient();

  const response = await core.listNamespacedPod({
    namespace,
    labelSelector,
  });
  return response.items;
}

export async function getServices(namespace: string): Promise<k8s.V1Service[]> {
  const { core } = getK8sClient();

  const response = await core.listNamespacedService({ namespace });
  return response.items;
}

interface K8sEvent {
  metadata?: k8s.V1ObjectMeta;
  reason?: string;
  message?: string;
  type?: string;
  involvedObject?: k8s.V1ObjectReference;
  firstTimestamp?: Date;
  lastTimestamp?: Date;
  count?: number;
}

export async function getEvents(namespace: string): Promise<K8sEvent[]> {
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
  const { core } = getK8sClient();

  const response = await core.readNamespacedPodLog({
    namespace,
    name: podName,
    container: containerName,
    tailLines,
    follow,
  });

  return response as unknown as string;
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

    const stdout = new (require('stream').Writable)({
      write(chunk: Buffer, _encoding: string, callback: () => void) {
        output += chunk.toString();
        callback();
      },
    });

    const stderr = new (require('stream').Writable)({
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
    const error = e as { statusCode?: number };
    if (error.statusCode === 404) {
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
    const error = e as { statusCode?: number };
    if (error.statusCode !== 404) {
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
    const error = e as { statusCode?: number };
    if (error.statusCode === 404) {
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
    const error = e as { statusCode?: number };
    if (error.statusCode !== 404) {
      throw e;
    }
  }
}

export function getIsConnected(): boolean {
  return k8sCoreApi !== null && k8sAppsApi !== null;
}

// ============================================
// Deployment Management
// ============================================

export async function createDeployment(
  namespace: string,
  name: string,
  spec: {
    image: string;
    port: number;
    replicas: number;
    env?: Record<string, string>;
    command?: string[];
    args?: string[];
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
                command: spec.command,
                args: spec.args,
                resources: {
                  requests: {
                    cpu: spec.cpuRequest || '100m',
                    memory: spec.memoryRequest || '128Mi',
                  },
                  limits: {
                    cpu: spec.cpuLimit || '500m',
                    memory: spec.memoryLimit || '256Mi',
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
    env?: Record<string, string>;
  }
): Promise<void> {
  const { apps } = getK8sClient();

  const current = await apps.readNamespacedDeployment({ namespace, name });

  const containers = current.spec?.template?.spec?.containers || [];
  const updatedContainers = containers.map((container) => ({
    ...container,
    image: spec.image ?? container.image,
    env: spec.env
      ? Object.entries(spec.env).map(([name, value]) => ({ name, value }))
      : container.env,
  }));

  const updated: k8s.V1Deployment = {
    apiVersion: 'apps/v1',
    kind: 'Deployment',
    metadata: current.metadata,
    spec: {
      replicas: spec.replicas ?? current.spec?.replicas,
      selector: current.spec?.selector || { matchLabels: { app: name } },
      template: {
        metadata: current.spec?.template?.metadata || { labels: { app: name } },
        spec: {
          ...current.spec?.template?.spec,
          containers: updatedContainers,
        },
      },
    },
  };

  await apps.replaceNamespacedDeployment({ namespace, name, body: updated });
}

export async function deleteDeployment(namespace: string, name: string): Promise<void> {
  const { apps } = getK8sClient();

  try {
    await apps.deleteNamespacedDeployment({ namespace, name });
  } catch (e: unknown) {
    const error = e as { statusCode?: number };
    if (error.statusCode !== 404) {
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
        selector: { app: name },
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

export async function deleteService(namespace: string, name: string): Promise<void> {
  const { core } = getK8sClient();

  try {
    await core.deleteNamespacedService({ namespace, name });
  } catch (e: unknown) {
    const error = e as { statusCode?: number };
    if (error.statusCode !== 404) {
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
  hostnames: string[];
  serviceName: string;
  servicePort: number;
  path?: string;
}

export async function createCiliumGateway(
  namespace: string,
  name: string,
  spec: {
    host?: string;
    annotations?: Record<string, string>;
  }
): Promise<void> {
  const { custom } = getK8sClient();

  const gateway = {
    apiVersion: 'gateway.networking.k8s.io/v1beta1',
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
      listeners: [
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
        {
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
                name: `${name}-tls`,
              },
            ],
          },
        },
      ],
    },
  };

  await custom.createNamespacedCustomObject({
    group: 'gateway.networking.k8s.io',
    version: 'v1beta1',
    namespace,
    plural: 'gateways',
    body: gateway,
  });
}

export async function createCiliumHTTPRoute(spec: CiliumHTTPRouteSpec): Promise<void> {
  const { custom } = getK8sClient();

  const route = {
    apiVersion: 'gateway.networking.k8s.io/v1beta1',
    kind: 'HTTPRoute',
    metadata: {
      name: spec.name,
      namespace: spec.namespace,
    },
    spec: {
      parentRefs: [
        {
          name: spec.gatewayName,
          namespace: spec.namespace,
        },
      ],
      hostnames: spec.hostnames,
      rules: [
        {
          backendRefs: [
            {
              kind: 'Service',
              name: spec.serviceName,
              port: spec.servicePort,
            },
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
    version: 'v1beta1',
    namespace: spec.namespace,
    plural: 'httproutes',
    body: route,
  });
}

export async function deleteCiliumGateway(namespace: string, name: string): Promise<void> {
  const { custom } = getK8sClient();

  try {
    await custom.deleteNamespacedCustomObject({
      group: 'gateway.networking.k8s.io',
      version: 'v1beta1',
      namespace,
      plural: 'gateways',
      name,
    });
  } catch (e: unknown) {
    const error = e as { statusCode?: number };
    if (error.statusCode !== 404) {
      throw e;
    }
  }
}

export async function deleteCiliumHTTPRoute(namespace: string, name: string): Promise<void> {
  const { custom } = getK8sClient();

  try {
    await custom.deleteNamespacedCustomObject({
      group: 'gateway.networking.k8s.io',
      version: 'v1beta1',
      namespace,
      plural: 'httproutes',
      name,
    });
  } catch (e: unknown) {
    const error = e as { statusCode?: number };
    if (error.statusCode !== 404) {
      throw e;
    }
  }
}

export async function getCiliumGateways(namespace: string): Promise<unknown[]> {
  const { custom } = getK8sClient();

  const response = (await custom.listNamespacedCustomObject({
    group: 'gateway.networking.k8s.io',
    version: 'v1beta1',
    namespace,
    plural: 'gateways',
  })) as { items: unknown[] };

  return response.items;
}

export async function getCiliumHTTPRoutes(namespace: string): Promise<unknown[]> {
  const { custom } = getK8sClient();

  const response = (await custom.listNamespacedCustomObject({
    group: 'gateway.networking.k8s.io',
    version: 'v1beta1',
    namespace,
    plural: 'httproutes',
  })) as { items: unknown[] };

  return response.items;
}

// ============================================
// StatefulSet Management (for Databases)
// ============================================

export async function createStatefulSet(
  namespace: string,
  name: string,
  spec: {
    image: string;
    serviceName: string;
    port: number;
    replicas: number;
    env: Record<string, string>;
    volumeName: string;
    storageSize: string;
    storageClass?: string;
    command?: string[];
    args?: string[];
  }
): Promise<void> {
  const { apps } = getK8sClient();

  const envVars = Object.entries(spec.env).map(([name, value]) => ({ name, value }));

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
                command: spec.command,
                args: spec.args,
                volumeMounts: [
                  {
                    name: spec.volumeName,
                    mountPath: `/${spec.volumeName}`,
                  },
                ],
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
    const error = e as { statusCode?: number };
    if (error.statusCode !== 404) {
      throw e;
    }
  }
}
