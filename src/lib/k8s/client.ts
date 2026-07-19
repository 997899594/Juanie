import * as k8s from '@kubernetes/client-node';
import { resolveKubernetesConfiguration } from '@/lib/k8s/configuration';
import { logger } from '@/lib/logger';

let k8sCoreApi: k8s.CoreV1Api | null = null;
let k8sAppsApi: k8s.AppsV1Api | null = null;
let k8sCustomApi: k8s.CustomObjectsApi | null = null;
let k8sNetworkingApi: k8s.NetworkingV1Api | null = null;
let k8sBatchApi: k8s.BatchV1Api | null = null;
let k8sObjectApi: k8s.KubernetesObjectApi | null = null;
let kubeConfig: k8s.KubeConfig | null = null;
let initAttempted = false;
const k8sLogger = logger.child({ component: 'k8s' });

export interface K8sCustomObjectLike {
  metadata?: {
    resourceVersion?: string;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}

export function withCurrentResourceVersion<T extends { metadata?: Record<string, unknown> }>(
  manifest: T,
  current: K8sCustomObjectLike | null
): T {
  const resourceVersion = current?.metadata?.resourceVersion;

  if (!resourceVersion) {
    return manifest;
  }

  return {
    ...manifest,
    metadata: {
      ...(manifest.metadata ?? {}),
      resourceVersion,
    },
  };
}

export function initK8sClient(): void {
  if (initAttempted) return;
  initAttempted = true;

  const kc = new k8s.KubeConfig();

  try {
    const configuration = resolveKubernetesConfiguration();
    if (!configuration) {
      k8sLogger.info('Kubernetes access is not configured for this runtime');
      return;
    }

    if (configuration.kind === 'in-cluster') {
      kc.loadFromCluster();
      k8sLogger.info('Using in-cluster Kubernetes configuration');
    } else if (configuration.kind === 'content') {
      kc.loadFromString(configuration.content);
      k8sLogger.info('Using KUBECONFIG_CONTENT');
    } else {
      kc.loadFromFile(configuration.path);
      k8sLogger.info('Using kubeconfig from file', { kubeconfigPath: configuration.path });
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
    k8sObjectApi = k8s.KubernetesObjectApi.makeApiClient(kc);
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
  object: k8s.KubernetesObjectApi;
  config: k8s.KubeConfig;
} {
  if (
    !k8sCoreApi ||
    !k8sAppsApi ||
    !k8sCustomApi ||
    !k8sNetworkingApi ||
    !k8sBatchApi ||
    !k8sObjectApi ||
    !kubeConfig
  ) {
    initK8sClient();
    if (
      !k8sCoreApi ||
      !k8sAppsApi ||
      !k8sCustomApi ||
      !k8sNetworkingApi ||
      !k8sBatchApi ||
      !k8sObjectApi ||
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
    object: k8sObjectApi,
    config: kubeConfig,
  };
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
