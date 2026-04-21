import { and, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import type { EnvironmentDeploymentStrategy } from '@/lib/db/schema';
import { domains } from '@/lib/db/schema';
import {
  syncProjectPreviewApplicationSet,
  usesPreviewApplicationSetStableRoutes,
} from '@/lib/environments/application-set';
import { isPreviewEnvironment } from '@/lib/environments/model';
import {
  createCiliumHTTPRoute,
  deleteCiliumHTTPRoute,
  isK8sAvailable,
  reconcileCiliumHTTPRoutesForHostname,
} from '@/lib/k8s';
import { buildProjectScopedK8sName } from '@/lib/k8s/naming';
import {
  buildDomainRouteName,
  buildPreviewEnvironmentHostname,
  pickDefaultPublicService,
} from './defaults';
import { resolveProjectManagedHostnameBase } from './managed';

interface EnsureEnvironmentDomainsInput {
  project: {
    id: string;
    slug: string;
    configJson?: unknown;
  };
  environment: {
    id: string;
    name: string;
    namespace: string | null;
    kind?: 'production' | 'persistent' | 'preview' | null;
    isPreview?: boolean | null;
    deploymentStrategy?: EnvironmentDeploymentStrategy | null;
  };
  services: Array<{
    id: string;
    name: string;
    type: string;
    isPublic?: boolean | null;
    port?: number | null;
  }>;
}

const DEFAULT_ROUTE_SERVICE_PORT = 3000;

function isConflictError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const candidate = error as { code?: number; statusCode?: number; body?: { code?: number } };
  return candidate.code === 409 || candidate.statusCode === 409 || candidate.body?.code === 409;
}

function buildServiceResourceName(projectSlug: string, serviceName: string): string {
  return buildProjectScopedK8sName(projectSlug, serviceName);
}

export async function ensureEnvironmentDomains(input: EnsureEnvironmentDomainsInput) {
  let domainList = await db.query.domains.findMany({
    where: and(
      eq(domains.projectId, input.project.id),
      eq(domains.environmentId, input.environment.id)
    ),
  });

  if (isPreviewEnvironment(input.environment) && domainList.length === 0) {
    const service = pickDefaultPublicService(input.services);

    if (service) {
      const managedHostnameBase = resolveProjectManagedHostnameBase(input.project);
      const [domain] = await db
        .insert(domains)
        .values({
          projectId: input.project.id,
          environmentId: input.environment.id,
          serviceId: service.id,
          hostname: buildPreviewEnvironmentHostname(managedHostnameBase, {
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

  const hasK8s = isK8sAvailable();

  if (
    usesPreviewApplicationSetStableRoutes(input.environment) &&
    hasK8s &&
    input.environment.namespace
  ) {
    await syncProjectPreviewApplicationSet({
      projectId: input.project.id,
    });

    const pendingVerificationIds = domainList
      .filter((domain) => !domain.isVerified)
      .map((domain) => domain.id);

    if (pendingVerificationIds.length > 0) {
      for (const domainId of pendingVerificationIds) {
        await db.update(domains).set({ isVerified: true }).where(eq(domains.id, domainId));
      }
    }

    return db.query.domains.findMany({
      where: and(
        eq(domains.projectId, input.project.id),
        eq(domains.environmentId, input.environment.id)
      ),
    });
  }

  if (!hasK8s || !input.environment.namespace || domainList.length === 0) {
    return domainList;
  }

  for (const domain of domainList) {
    const service =
      (domain.serviceId
        ? input.services.find((candidate) => candidate.id === domain.serviceId)
        : undefined) ?? pickDefaultPublicService(input.services);

    if (!service || service.type !== 'web' || service.isPublic === false) {
      continue;
    }

    const routeName = buildDomainRouteName(domain.hostname);
    const spec = {
      name: routeName,
      namespace: input.environment.namespace,
      gatewayName: 'shared-gateway',
      gatewayNamespace: 'juanie',
      sectionName: 'https-wildcard',
      hostnames: [domain.hostname],
      serviceName: buildServiceResourceName(input.project.slug, service.name),
      servicePort: service.port || DEFAULT_ROUTE_SERVICE_PORT,
      path: '/',
    };

    await reconcileCiliumHTTPRoutesForHostname({
      namespace: input.environment.namespace,
      hostname: domain.hostname,
      canonicalRouteName: routeName,
    });

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
