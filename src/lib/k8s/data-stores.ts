import {
  getK8sClient,
  type K8sCustomObjectLike,
  withCurrentResourceVersion,
} from '@/lib/k8s/client';

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
    const current = (await custom.getNamespacedCustomObject({
      group: 'postgresql.cnpg.io',
      version: 'v1',
      namespace: manifest.metadata.namespace,
      plural: 'clusters',
      name: manifest.metadata.name,
    })) as K8sCustomObjectLike;
    await custom.replaceNamespacedCustomObject({
      group: 'postgresql.cnpg.io',
      version: 'v1',
      namespace: manifest.metadata.namespace,
      plural: 'clusters',
      name: manifest.metadata.name,
      body: withCurrentResourceVersion(manifest, current),
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
