import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { domains } from '@/lib/db/schema';
import { buildDomainRouteName } from '@/lib/domains/defaults';
import { createCiliumHTTPRoute, deleteCiliumHTTPRoute } from '@/lib/k8s';

export interface TrafficBackendRef {
  serviceName: string;
  servicePort: number;
  weight?: number;
}

export interface RolloutServiceLike {
  id: string;
  name: string;
  type: string;
  isPublic?: boolean | null;
  port?: number | null;
}

export function buildStableDeploymentName(projectSlug: string, serviceName: string): string {
  return `${projectSlug}-${serviceName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

export function buildCandidateDeploymentName(baseName: string): string {
  return `${baseName}-candidate`.slice(0, 63);
}

export async function syncEnvironmentServiceTrafficRoutes(input: {
  projectSlug: string;
  environmentId: string;
  namespace: string;
  service: RolloutServiceLike;
  backends: TrafficBackendRef[];
}) {
  if (input.service.type !== 'web' || input.service.isPublic === false) {
    return;
  }

  const domainList = await db.query.domains.findMany({
    where: eq(domains.environmentId, input.environmentId),
  });
  const serviceDomains = domainList.filter(
    (domain) => domain.serviceId === input.service.id || domain.serviceId === null
  );

  for (const domain of serviceDomains) {
    const routeName = buildDomainRouteName(domain.hostname);
    await deleteCiliumHTTPRoute(input.namespace, routeName).catch(() => undefined);
    await createCiliumHTTPRoute({
      name: routeName,
      namespace: input.namespace,
      gatewayName: 'shared-gateway',
      gatewayNamespace: 'juanie',
      sectionName: 'https-wildcard',
      hostnames: [domain.hostname],
      serviceName:
        input.backends[0]?.serviceName ??
        buildStableDeploymentName(input.projectSlug, input.service.name),
      servicePort: input.backends[0]?.servicePort ?? input.service.port ?? 80,
      backendRefs: input.backends,
      path: '/',
    });
  }
}
