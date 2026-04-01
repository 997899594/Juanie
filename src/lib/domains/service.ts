import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { domains } from '@/lib/db/schema';
import {
  createCiliumHTTPRoute,
  deleteCiliumHTTPRoute,
  getIsConnected,
  initK8sClient,
} from '@/lib/k8s';
import {
  buildDomainRouteName,
  buildLegacyProjectRouteName,
  buildPreviewEnvironmentHostname,
  pickDefaultPublicService,
} from './defaults';

interface EnsureEnvironmentDomainsInput {
  project: {
    id: string;
    slug: string;
  };
  environment: {
    id: string;
    name: string;
    namespace: string | null;
    isPreview?: boolean | null;
  };
  services: Array<{
    id: string;
    name: string;
    type: string;
    isPublic?: boolean | null;
    port?: number | null;
  }>;
}

function isConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: number; statusCode?: number; body?: { code?: number } };
  return candidate.code === 409 || candidate.statusCode === 409 || candidate.body?.code === 409;
}

function buildServiceResourceName(projectSlug: string, serviceName: string): string {
  return `${projectSlug}-${serviceName.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;
}

export async function ensureEnvironmentDomains(input: EnsureEnvironmentDomainsInput) {
  let domainList = await db.query.domains.findMany({
    where: and(
      eq(domains.projectId, input.project.id),
      eq(domains.environmentId, input.environment.id)
    ),
  });

  if (input.environment.isPreview && domainList.length === 0) {
    const service = pickDefaultPublicService(input.services);

    if (service) {
      const [domain] = await db
        .insert(domains)
        .values({
          projectId: input.project.id,
          environmentId: input.environment.id,
          serviceId: service.id,
          hostname: buildPreviewEnvironmentHostname(input.project.slug, {
            name: input.environment.name,
          }),
          isCustom: false,
          isVerified: false,
          tlsEnabled: true,
        })
        .returning();

      domainList = [domain];
    }
  }

  if (!getIsConnected() || !input.environment.namespace || domainList.length === 0) {
    return domainList;
  }

  initK8sClient();

  for (const domain of domainList) {
    const service =
      (domain.serviceId
        ? input.services.find((candidate) => candidate.id === domain.serviceId)
        : undefined) ?? pickDefaultPublicService(input.services);

    if (!service || service.type !== 'web' || service.isPublic === false) {
      continue;
    }

    const routeName = buildDomainRouteName(domain.hostname);
    const legacyRouteName = buildLegacyProjectRouteName(input.project.slug);
    const spec = {
      name: routeName,
      namespace: input.environment.namespace,
      gatewayName: 'shared-gateway',
      gatewayNamespace: 'juanie',
      sectionName: 'https-wildcard',
      hostnames: [domain.hostname],
      serviceName: buildServiceResourceName(input.project.slug, service.name),
      servicePort: service.port || 80,
      path: '/',
    };

    if (legacyRouteName !== routeName) {
      await deleteCiliumHTTPRoute(input.environment.namespace, legacyRouteName).catch(() => {
        // Ignore missing legacy route errors during canonical route reconciliation.
      });
    }

    try {
      await createCiliumHTTPRoute(spec);
    } catch (error) {
      if (!isConflictError(error)) {
        throw error;
      }

      await deleteCiliumHTTPRoute(input.environment.namespace, routeName).catch(() => {
        // Ignore missing route errors before recreation.
      });
      await createCiliumHTTPRoute(spec);
    }

    if (!domain.isVerified) {
      await db.update(domains).set({ isVerified: true }).where(eq(domains.id, domain.id));
    }
  }

  return db.query.domains.findMany({
    where: and(
      eq(domains.projectId, input.project.id),
      eq(domains.environmentId, input.environment.id)
    ),
  });
}
