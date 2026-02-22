import * as k8s from '@kubernetes/client-node';
import { existsSync } from 'fs';

let k8sCoreApi: k8s.CoreV1Api | null = null;
let k8sAppsApi: k8s.AppsV1Api | null = null;
let k8sCustomApi: k8s.CustomObjectsApi | null = null;
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
  config: k8s.KubeConfig;
} {
  if (!k8sCoreApi || !k8sAppsApi || !k8sCustomApi || !kubeConfig) {
    initK8sClient();
    if (!k8sCoreApi || !k8sAppsApi || !k8sCustomApi || !kubeConfig) {
      throw new Error('K8s client not initialized');
    }
  }

  return {
    core: k8sCoreApi,
    apps: k8sAppsApi,
    custom: k8sCustomApi,
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
