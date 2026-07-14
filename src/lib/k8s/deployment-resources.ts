import * as k8s from '@kubernetes/client-node';
import {
  getK8sClient,
  type K8sCustomObjectLike,
  withCurrentResourceVersion,
} from '@/lib/k8s/client';
import { isK8sConflictError } from '@/lib/k8s/errors';
import { sleep } from '@/lib/k8s/timing';
import { logger } from '@/lib/logger';

const k8sLogger = logger.child({ component: 'k8s-deployment-resources' });

export async function getDeployments(
  namespace: string,
  labelSelector?: string
): Promise<k8s.V1Deployment[]> {
  const { apps } = getK8sClient();

  const response = await apps.listNamespacedDeployment({ namespace, labelSelector });
  return response.items;
}

export async function getReplicaSets(
  namespace: string,
  labelSelector?: string
): Promise<k8s.V1ReplicaSet[]> {
  const { apps } = getK8sClient();

  const response = await apps.listNamespacedReplicaSet({
    namespace,
    labelSelector,
  });
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

const DEFAULT_DEPLOYMENT_REVISION_HISTORY_LIMIT = 2;
const DEFAULT_DEPLOYMENT_PROGRESS_DEADLINE_SECONDS = 540;
const LEGACY_DEPLOYMENT_ANNOTATIONS_TO_CLEAR = [
  'juanie.dev/last-applied-configuration',
  'juanie.dev/last-applied-spec',
] as const;

function buildHttpProbes(input: { healthcheckPath?: string; port: number }) {
  return {
    readinessProbe: {
      httpGet: { path: input.healthcheckPath || '/api/health/ready', port: input.port },
      initialDelaySeconds: 15,
      periodSeconds: 10,
      failureThreshold: 6, // 15 + 6*10 = 75s before giving up
    },
    livenessProbe: {
      httpGet: { path: input.healthcheckPath || '/api/health/live', port: input.port },
      initialDelaySeconds: 30,
      periodSeconds: 20,
      failureThreshold: 3,
    },
  };
}

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
    command: string[];
    args: string[];
    healthcheckPath?: string;
    enableHttpProbes?: boolean;
    cpuRequest?: string;
    cpuLimit?: string;
    memoryRequest?: string;
    memoryLimit?: string;
    progressDeadlineSeconds?: number;
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
        progressDeadlineSeconds:
          spec.progressDeadlineSeconds ?? DEFAULT_DEPLOYMENT_PROGRESS_DEADLINE_SECONDS,
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
                ...(spec.enableHttpProbes === false
                  ? {}
                  : buildHttpProbes({ healthcheckPath: spec.healthcheckPath, port: spec.port })),
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
    command: string[];
    args: string[];
    healthcheckPath?: string;
    enableHttpProbes?: boolean;
    cpuRequest?: string;
    cpuLimit?: string;
    memoryRequest?: string;
    memoryLimit?: string;
    progressDeadlineSeconds?: number;
  }
): Promise<void> {
  const { apps } = getK8sClient();
  const maxAttempts = 4;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const current = await apps.readNamespacedDeployment({ namespace, name });
      const currentMetadataAnnotations = { ...(current.metadata?.annotations ?? {}) };

      for (const annotationKey of LEGACY_DEPLOYMENT_ANNOTATIONS_TO_CLEAR) {
        delete currentMetadataAnnotations[annotationKey];
      }

      const containers = current.spec?.template?.spec?.containers || [];
      const updatedContainers = containers.map((container) => {
        const port = spec.port ?? container.ports?.[0]?.containerPort ?? 3000;
        const updatedContainer = {
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
          command: spec.command,
          args: spec.args,
          ...(spec.enableHttpProbes === false
            ? {}
            : buildHttpProbes({ healthcheckPath: spec.healthcheckPath, port })),
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
        };

        if (spec.enableHttpProbes === false) {
          delete updatedContainer.readinessProbe;
          delete updatedContainer.livenessProbe;
        }

        return updatedContainer;
      });

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
          progressDeadlineSeconds:
            spec.progressDeadlineSeconds ??
            current.spec?.progressDeadlineSeconds ??
            DEFAULT_DEPLOYMENT_PROGRESS_DEADLINE_SECONDS,
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
                    imagePullSecrets: spec.imagePullSecrets.map((secretName) => ({
                      name: secretName,
                    })),
                  }
                : {}),
              containers: updatedContainers,
            },
          },
        },
      };

      await apps.replaceNamespacedDeployment({ namespace, name, body: updated });
      return;
    } catch (error) {
      if (isK8sConflictError(error) && attempt < maxAttempts) {
        await sleep(150 * attempt);
        continue;
      }

      throw error;
    }
  }
}

/**
 * Trigger a rolling restart for all Deployments in a namespace by bumping the
 * `kubectl.kubernetes.io/restartedAt` annotation. Pods will be recreated one by
 * one (respecting their RollingUpdate strategy) and will re-read the latest
 * ConfigMap / Secret values from envFrom.
 */
export async function rolloutRestartDeployments(namespace: string): Promise<void> {
  const { apps, custom } = getK8sClient();

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
  }

  let rolloutNames: string[] = [];
  try {
    const response = (await custom.listNamespacedCustomObject({
      group: 'argoproj.io',
      version: 'v1alpha1',
      namespace,
      plural: 'rollouts',
    })) as {
      items?: Array<{
        metadata?: {
          name?: string;
        };
      }>;
    };

    rolloutNames = (response.items || [])
      .map((rollout) => rollout.metadata?.name)
      .filter((name): name is string => Boolean(name));
  } catch (e) {
    k8sLogger.warn('Could not list Argo Rollouts for workload restart', {
      namespace,
      errorMessage: e instanceof Error ? e.message : String(e),
    });
  }

  if (deploymentNames.length === 0 && rolloutNames.length === 0) return;

  const restartedAt = new Date().toISOString();
  await Promise.all([
    ...deploymentNames.map(async (deploymentName) => {
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
    }),
    ...rolloutNames.map(async (rolloutName) => {
      try {
        const current = (await custom.getNamespacedCustomObject({
          group: 'argoproj.io',
          version: 'v1alpha1',
          namespace,
          plural: 'rollouts',
          name: rolloutName,
        })) as K8sCustomObjectLike & {
          spec?: Record<string, unknown>;
        };

        // Argo Rollouts supports spec.restartAt for in-place workload restarts
        // without manufacturing a new release artifact or relying on Deployment APIs.
        await custom.replaceNamespacedCustomObject({
          group: 'argoproj.io',
          version: 'v1alpha1',
          namespace,
          plural: 'rollouts',
          name: rolloutName,
          body: withCurrentResourceVersion(
            {
              ...current,
              spec: {
                ...(current.spec ?? {}),
                restartAt: restartedAt,
              },
            },
            current
          ),
        });
      } catch (e) {
        k8sLogger.warn('Failed to restart Argo Rollout', {
          namespace,
          rolloutName,
          errorMessage: e instanceof Error ? e.message : String(e),
        });
      }
    }),
  ]);

  k8sLogger.info('Rolling restart triggered for workloads', {
    namespace,
    deploymentCount: deploymentNames.length,
    deploymentNames,
    rolloutCount: rolloutNames.length,
    rolloutNames,
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
