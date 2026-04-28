import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { domains } from '@/lib/db/schema';
import {
  createCiliumHTTPRoute,
  deleteCiliumHTTPRoute,
  getCiliumHTTPRoutes,
  isK8sAvailable,
  reconcileCiliumHTTPRoutesForHostname,
} from '@/lib/k8s';
import { buildDomainRouteName } from './defaults';

const WAKE_SERVICE_NAME = 'juanie-web';
const WAKE_SERVICE_PORT = 80;
const SHARED_GATEWAY_NAME = 'shared-gateway';
const SHARED_GATEWAY_SECTION = 'https-wildcard';

function getControlPlaneNamespace(): string {
  return process.env.JUANIE_NAMESPACE?.trim() || 'juanie';
}

interface WakeHTTPRouteLike {
  metadata?: {
    name?: string;
  };
  spec?: {
    hostnames?: string[];
    rules?: Array<{
      backendRefs?: Array<{
        name?: string;
        port?: number;
      }>;
    }>;
  };
}

function isWakeRoute(route: WakeHTTPRouteLike): boolean {
  return (
    route.spec?.rules?.some((rule) =>
      rule.backendRefs?.some(
        (backend) => backend.name === WAKE_SERVICE_NAME && backend.port === WAKE_SERVICE_PORT
      )
    ) ?? false
  );
}

export async function getWakeRoutedHostnames(hostnames: string[]): Promise<Set<string>> {
  if (!isK8sAvailable() || hostnames.length === 0) {
    return new Set();
  }

  const expectedHostnames = new Set(hostnames);
  const expectedRouteNames = new Set(hostnames.map(buildDomainRouteName));
  const routes = (await getCiliumHTTPRoutes(getControlPlaneNamespace())) as WakeHTTPRouteLike[];
  const wakeRoutedHostnames = new Set<string>();

  for (const route of routes) {
    if (!route.metadata?.name || !expectedRouteNames.has(route.metadata.name)) {
      continue;
    }

    if (!isWakeRoute(route)) {
      continue;
    }

    for (const hostname of route.spec?.hostnames ?? []) {
      if (expectedHostnames.has(hostname)) {
        wakeRoutedHostnames.add(hostname);
      }
    }
  }

  return wakeRoutedHostnames;
}

export async function deleteEnvironmentWakeRouteForHostname(hostname: string): Promise<void> {
  await deleteCiliumHTTPRoute(getControlPlaneNamespace(), buildDomainRouteName(hostname)).catch(
    () => undefined
  );
}

export async function syncEnvironmentWakeRoutes(input: {
  environmentId: string;
  environmentNamespace: string;
}): Promise<void> {
  if (!isK8sAvailable()) {
    return;
  }

  const routeNamespace = getControlPlaneNamespace();
  const domainList = await db.query.domains.findMany({
    where: eq(domains.environmentId, input.environmentId),
  });

  for (const domain of domainList) {
    const routeName = buildDomainRouteName(domain.hostname);

    await reconcileCiliumHTTPRoutesForHostname({
      namespace: routeNamespace,
      hostname: domain.hostname,
      canonicalRouteName: routeName,
    });

    if (input.environmentNamespace !== routeNamespace) {
      await deleteCiliumHTTPRoute(input.environmentNamespace, routeName).catch(() => undefined);
    }

    await deleteCiliumHTTPRoute(routeNamespace, routeName).catch(() => undefined);
    await createCiliumHTTPRoute({
      name: routeName,
      namespace: routeNamespace,
      gatewayName: SHARED_GATEWAY_NAME,
      gatewayNamespace: routeNamespace,
      sectionName: SHARED_GATEWAY_SECTION,
      hostnames: [domain.hostname],
      serviceName: WAKE_SERVICE_NAME,
      servicePort: WAKE_SERVICE_PORT,
      path: '/',
    });
  }
}
