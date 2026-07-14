import { Writable } from 'node:stream';
import * as k8s from '@kubernetes/client-node';
import { getK8sClient } from '@/lib/k8s/client';

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
  tailLinesOrOptions:
    | number
    | {
        tailLines?: number;
        follow?: boolean;
        previous?: boolean;
        timestamps?: boolean;
        limitBytes?: number;
      } = 100,
  follow: boolean = false
): Promise<string> {
  const { config } = getK8sClient();
  const logger = new k8s.Log(config);
  const options =
    typeof tailLinesOrOptions === 'number'
      ? {
          tailLines: tailLinesOrOptions,
          follow,
        }
      : tailLinesOrOptions;
  let output = '';

  const stream = new Writable({
    write(chunk, _encoding, callback) {
      output += chunk.toString();
      callback();
    },
  });

  await logger.log(namespace, podName, containerName ?? '', stream, {
    follow: options.follow ?? false,
    limitBytes: options.limitBytes,
    previous: options.previous,
    tailLines: options.tailLines ?? 100,
    timestamps: options.timestamps ?? false,
  });

  await new Promise<void>((resolve, reject) => {
    stream.on('finish', () => resolve());
    stream.on('error', reject);
  });

  return output;
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

    const stdout = new Writable({
      write(chunk: Buffer, _encoding: string, callback: () => void) {
        output += chunk.toString();
        callback();
      },
    });

    const stderr = new Writable({
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
