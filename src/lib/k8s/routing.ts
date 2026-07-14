import { getK8sClient } from '@/lib/k8s/client';
import { createSecret } from '@/lib/k8s/core-resources';

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
  const listeners: Array<Record<string, unknown>> = [
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

  try {
    await custom.createNamespacedCustomObject({
      group: 'gateway.networking.k8s.io',
      version: 'v1',
      namespace: spec.namespace,
      plural: 'httproutes',
      body: route,
    });
  } catch (e: unknown) {
    const error = e as { code?: number; statusCode?: number };
    if ((error.code ?? error.statusCode) !== 409) {
      throw e;
    }

    const current = (await custom.getNamespacedCustomObject({
      group: 'gateway.networking.k8s.io',
      version: 'v1',
      namespace: spec.namespace,
      plural: 'httproutes',
      name: spec.name,
    })) as { metadata?: Record<string, unknown> };

    await custom.replaceNamespacedCustomObject({
      group: 'gateway.networking.k8s.io',
      version: 'v1',
      namespace: spec.namespace,
      plural: 'httproutes',
      name: spec.name,
      body: {
        ...route,
        metadata: {
          ...(current.metadata ?? {}),
          name: spec.name,
          namespace: spec.namespace,
        },
      },
    });
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
