import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { domains } from '@/lib/db/schema';
import {
  createCiliumHTTPRoute,
  deleteCiliumHTTPRoute,
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
