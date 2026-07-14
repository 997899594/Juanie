import * as k8s from '@kubernetes/client-node';
import { getK8sClient } from '@/lib/k8s/client';
import { sleep } from '@/lib/k8s/timing';

// ============================================
// Service Management
// ============================================

interface ServiceResourceSpec {
  port: number;
  targetPort: number | string;
  type?: 'ClusterIP' | 'LoadBalancer' | 'NodePort';
  selector?: Record<string, string>;
  portName?: string;
}

export function buildServiceResource(input: {
  namespace: string;
  name: string;
  spec: ServiceResourceSpec;
  current?: k8s.V1Service | null;
}): k8s.V1Service {
  const servicePort: k8s.V1ServicePort = {
    port: input.spec.port,
    targetPort: input.spec.targetPort,
    protocol: 'TCP',
  };

  if (input.spec.portName) {
    servicePort.name = input.spec.portName;
  }

  return {
    apiVersion: 'v1',
    kind: 'Service',
    metadata: input.current
      ? {
          ...input.current.metadata,
          name: input.name,
          namespace: input.namespace,
        }
      : { name: input.name, namespace: input.namespace },
    spec: {
      ...(input.current?.spec ?? {}),
      type: input.spec.type || input.current?.spec?.type || 'ClusterIP',
      selector: input.spec.selector || input.current?.spec?.selector || { app: input.name },
      ports: [servicePort],
    },
  };
}

export async function createService(
  namespace: string,
  name: string,
  spec: ServiceResourceSpec
): Promise<void> {
  const { core } = getK8sClient();

  await core.createNamespacedService({
    namespace,
    body: buildServiceResource({ namespace, name, spec }),
  });
}

export async function upsertService(
  namespace: string,
  name: string,
  spec: ServiceResourceSpec
): Promise<void> {
  const { core } = getK8sClient();
  const maxAttempts = 3;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const current = await core.readNamespacedService({ namespace, name });

      await core.replaceNamespacedService({
        namespace,
        name,
        body: buildServiceResource({
          namespace,
          name,
          current,
          spec: { portName: 'http', ...spec },
        }),
      });
      return;
    } catch (e: unknown) {
      const error = e as { code?: number; statusCode?: number };
      const statusCode = error.code ?? error.statusCode;

      if (statusCode === 404) {
        await createService(namespace, name, { portName: 'http', ...spec });
        return;
      }

      if (statusCode === 409 && attempt < maxAttempts) {
        await sleep(150 * attempt);
        continue;
      }

      throw e;
    }
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
