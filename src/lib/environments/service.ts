import { and, eq } from 'drizzle-orm';
import { syncPreviewEnvironmentDatabases } from '@/lib/databases/preview';
import { db } from '@/lib/db';
import { environments, services } from '@/lib/db/schema';
import { ensureEnvironmentDomains } from '@/lib/domains/service';
import {
  buildEnvironmentNamespace,
  isPersistentEnvironment,
  isPreviewEnvironment,
  isProductionEnvironment,
} from '@/lib/environments/model';
import { createNamespace, getIsConnected, upsertService } from '@/lib/k8s';
import {
  buildPreviewEnvironmentName,
  calculatePreviewExpiry,
  extractBranchFromRef,
  extractPrNumberFromRef,
} from './preview';

async function resolvePreviewBaseEnvironmentId(projectId: string): Promise<string | null> {
  const environmentList = await db.query.environments.findMany({
    where: eq(environments.projectId, projectId),
  });

  const preferred =
    environmentList.find(
      (environment) => isPersistentEnvironment(environment) && environment.name === 'staging'
    ) ??
    environmentList.find((environment) => isPersistentEnvironment(environment)) ??
    environmentList.find((environment) => !isPreviewEnvironment(environment)) ??
    null;

  return preferred?.id ?? null;
}

function resolveEnvironmentKindForScaffold(input: {
  kind?: 'production' | 'persistent' | 'preview' | null;
  isProduction?: boolean | null;
  isPreview?: boolean | null;
}): 'production' | 'persistent' | 'preview' {
  if (input.kind) {
    return input.kind;
  }

  if (isPreviewEnvironment(input)) {
    return 'preview';
  }

  if (isProductionEnvironment(input)) {
    return 'production';
  }

  return 'persistent';
}

export async function ensurePreviewEnvironmentForRef(input: {
  projectId: string;
  projectSlug: string;
  ref: string;
  ttlHours?: number;
  databaseStrategy?: 'inherit' | 'isolated_clone';
  baseEnvironmentId?: string | null;
}): Promise<typeof environments.$inferSelect | null> {
  const prNumber = extractPrNumberFromRef(input.ref);
  const branch = extractBranchFromRef(input.ref);

  if (prNumber === null && !branch) {
    return null;
  }

  const environmentName = buildPreviewEnvironmentName({
    branch,
    prNumber,
  });

  const existingEnvironment = await db.query.environments.findFirst({
    where: and(eq(environments.projectId, input.projectId), eq(environments.name, environmentName)),
  });
  const baseEnvironmentId =
    input.baseEnvironmentId === undefined
      ? await resolvePreviewBaseEnvironmentId(input.projectId)
      : input.baseEnvironmentId;

  const values = {
    projectId: input.projectId,
    name: environmentName,
    kind: 'preview' as const,
    branch,
    isPreview: true,
    previewPrNumber: prNumber,
    expiresAt: calculatePreviewExpiry(input.ttlHours),
    baseEnvironmentId,
    databaseStrategy: input.databaseStrategy ?? 'inherit',
    autoDeploy: true,
    isProduction: false,
    deploymentStrategy: 'rolling' as const,
    namespace: buildEnvironmentNamespace(input.projectSlug, {
      name: environmentName,
      kind: 'preview',
    }),
  };

  if (existingEnvironment) {
    const [updated] = await db
      .update(environments)
      .set({
        ...values,
        updatedAt: new Date(),
      })
      .where(eq(environments.id, existingEnvironment.id))
      .returning();

    const serviceList = await db.query.services.findMany({
      where: eq(services.projectId, input.projectId),
    });

    await ensureEnvironmentDomains({
      project: {
        id: input.projectId,
        slug: input.projectSlug,
      },
      environment: {
        id: updated.id,
        name: updated.name,
        namespace: updated.namespace,
        kind: updated.kind,
      },
      services: serviceList,
    });
    await syncPreviewEnvironmentDatabases({
      projectId: input.projectId,
      environmentId: updated.id,
    });

    return updated;
  }

  const [created] = await db.insert(environments).values(values).returning();

  const serviceList = await db.query.services.findMany({
    where: eq(services.projectId, input.projectId),
  });

  await ensureEnvironmentDomains({
    project: {
      id: input.projectId,
      slug: input.projectSlug,
    },
    environment: {
      id: created.id,
      name: created.name,
      namespace: created.namespace,
      kind: created.kind,
    },
    services: serviceList,
  });
  await syncPreviewEnvironmentDatabases({
    projectId: input.projectId,
    environmentId: created.id,
  });

  return created;
}

export async function ensureEnvironmentScaffold(input: {
  project: {
    id: string;
    slug: string;
    teamId: string;
  };
  environment: {
    id: string;
    name: string;
    namespace: string | null;
    kind?: 'production' | 'persistent' | 'preview' | null;
    isProduction?: boolean | null;
    isPreview?: boolean | null;
  };
}): Promise<void> {
  if (!getIsConnected()) {
    return;
  }

  const namespace =
    input.environment.namespace ||
    buildEnvironmentNamespace(input.project.slug, {
      name: input.environment.name,
      kind: resolveEnvironmentKindForScaffold(input.environment),
    });

  if (!input.environment.namespace) {
    await db
      .update(environments)
      .set({
        namespace,
        updatedAt: new Date(),
      })
      .where(eq(environments.id, input.environment.id));
  }

  await createNamespace(namespace);

  const serviceList = await db.query.services.findMany({
    where: eq(services.projectId, input.project.id),
  });

  for (const service of serviceList) {
    const serviceName = `${input.project.slug}-${service.name.toLowerCase().replace(/[^a-z0-9-]/g, '-')}`;

    await upsertService(namespace, serviceName, {
      port: service.port || 3000,
      targetPort: service.port || 3000,
      selector: { app: serviceName },
    });
  }
}
