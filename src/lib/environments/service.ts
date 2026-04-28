import { and, eq } from 'drizzle-orm';
import {
  assertDatabasePreviewCloneSupport,
  toPlatformDatabaseProvisionType,
} from '@/lib/databases/platform-support';
import { syncPreviewEnvironmentDatabases } from '@/lib/databases/preview';
import { db } from '@/lib/db';
import { environments, services } from '@/lib/db/schema';
import { ensureEnvironmentDomains } from '@/lib/domains/service';
import {
  isPreviewApplicationSetEnvironment,
  syncProjectPreviewApplicationSet,
  usesPreviewApplicationSetStableRoutes,
} from '@/lib/environments/application-set';
import { resolveProjectPreviewDatabaseStrategy } from '@/lib/environments/database-strategy';
import { getDatabasesForEnvironment } from '@/lib/environments/inheritance';
import {
  buildEnvironmentNamespace,
  inferEnvironmentDeploymentRuntime,
  isPersistentEnvironment,
  isPreviewEnvironment,
  isProductionEnvironment,
} from '@/lib/environments/model';
import { createNamespace, isK8sAvailable, upsertService, waitForNamespaceCreated } from '@/lib/k8s';
import { buildProjectScopedK8sName } from '@/lib/k8s/naming';
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

async function assertPreviewCloneSupportForBaseEnvironment(input: {
  projectId: string;
  baseEnvironmentId: string | null;
}): Promise<void> {
  if (!input.baseEnvironmentId) {
    return;
  }

  const sourceDatabases = await getDatabasesForEnvironment({
    projectId: input.projectId,
    environmentId: input.baseEnvironmentId,
  });

  assertDatabasePreviewCloneSupport(
    sourceDatabases.map((database) => ({
      ...database,
      provisionType: toPlatformDatabaseProvisionType(database.provisionType),
    }))
  );
}

async function syncPreviewEnvironmentScaffold(input: {
  projectId: string;
  projectSlug: string;
  environmentId: string;
  namespace: string;
}): Promise<void> {
  await syncProjectPreviewApplicationSet({
    projectId: input.projectId,
  });

  const namespaceReady = await waitForNamespaceCreated({
    name: input.namespace,
  });

  if (!namespaceReady) {
    throw new Error(
      `预览环境 ${input.projectSlug}/${input.environmentId} 的命名空间仍未由 Argo CD 创建完成，请检查 ApplicationSet、仓库凭据和控制器健康状态`
    );
  }
}

async function loadProjectServices(projectId: string) {
  return db.query.services.findMany({
    where: eq(services.projectId, projectId),
  });
}

export interface ReconcileEnvironmentStateInput {
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
    isProduction?: boolean | null;
    isPreview?: boolean | null;
    deploymentStrategy?: 'rolling' | 'controlled' | 'canary' | 'blue_green' | null;
  };
  services?: Array<{
    id: string;
    name: string;
    type: string;
    isPublic?: boolean | null;
    port?: number | null;
  }>;
  scope?: 'runtime' | 'access' | 'full';
}

export async function ensureEnvironmentNamespace(input: {
  projectId?: string;
  projectSlug: string;
  environment: {
    id: string;
    name: string;
    namespace: string | null;
    kind?: 'production' | 'persistent' | 'preview' | null;
    isProduction?: boolean | null;
    isPreview?: boolean | null;
  };
}): Promise<string> {
  const namespace =
    input.environment.namespace ||
    buildEnvironmentNamespace(input.projectSlug, {
      name: input.environment.name,
      kind: resolveEnvironmentKindForScaffold(input.environment),
    });

  if (input.environment.namespace !== namespace) {
    await db
      .update(environments)
      .set({
        namespace,
        updatedAt: new Date(),
      })
      .where(eq(environments.id, input.environment.id));
  }

  return namespace;
}

function buildEnvironmentNamespaceLabels(input: {
  projectId?: string;
  projectSlug: string;
  environment: {
    id: string;
    name: string;
    kind?: 'production' | 'persistent' | 'preview' | null;
    isProduction?: boolean | null;
    isPreview?: boolean | null;
  };
}): Record<string, string> {
  return {
    'app.kubernetes.io/managed-by': 'juanie',
    'juanie.dev/project-id': input.projectId ?? '',
    'juanie.dev/project-slug': input.projectSlug,
    'juanie.dev/environment-id': input.environment.id,
    'juanie.dev/environment-name': input.environment.name,
    'juanie.dev/environment-kind': resolveEnvironmentKindForScaffold(input.environment),
  };
}

async function finalizePreviewEnvironment(input: {
  projectId: string;
  projectSlug: string;
  projectConfigJson?: unknown;
  environment: typeof environments.$inferSelect;
}) {
  const domainsManagedByPreviewApplicationSet =
    usesPreviewApplicationSetStableRoutes(input.environment) &&
    isK8sAvailable() &&
    Boolean(input.environment.namespace);

  await reconcileEnvironmentState({
    project: {
      id: input.projectId,
      slug: input.projectSlug,
      configJson: input.projectConfigJson,
    },
    environment: {
      id: input.environment.id,
      name: input.environment.name,
      namespace: input.environment.namespace,
      kind: input.environment.kind,
      isPreview: input.environment.isPreview,
      deploymentStrategy: input.environment.deploymentStrategy,
    },
    scope: 'access',
  });
  await syncPreviewEnvironmentDatabases({
    projectId: input.projectId,
    environmentId: input.environment.id,
  });

  if (!domainsManagedByPreviewApplicationSet) {
    await syncProjectPreviewApplicationSet({
      projectId: input.projectId,
    });
  }

  return input.environment;
}

export async function ensurePreviewEnvironmentForRef(input: {
  projectId: string;
  projectSlug: string;
  projectConfigJson?: unknown;
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
  const databaseStrategy = resolveProjectPreviewDatabaseStrategy(
    input.projectConfigJson,
    input.databaseStrategy
  );

  if (databaseStrategy === 'isolated_clone') {
    await assertPreviewCloneSupportForBaseEnvironment({
      projectId: input.projectId,
      baseEnvironmentId,
    });
  }

  const values = {
    projectId: input.projectId,
    name: environmentName,
    kind: 'preview' as const,
    deliveryMode: 'direct' as const,
    branch,
    isPreview: true,
    previewPrNumber: prNumber,
    expiresAt: calculatePreviewExpiry(input.ttlHours),
    baseEnvironmentId,
    databaseStrategy,
    autoDeploy: true,
    isProduction: false,
    deploymentStrategy: 'rolling' as const,
    deploymentRuntime: inferEnvironmentDeploymentRuntime('rolling'),
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

    return finalizePreviewEnvironment({
      projectId: input.projectId,
      projectSlug: input.projectSlug,
      projectConfigJson: input.projectConfigJson,
      environment: updated,
    });
  }

  const [created] = await db.insert(environments).values(values).returning();

  return finalizePreviewEnvironment({
    projectId: input.projectId,
    projectSlug: input.projectSlug,
    projectConfigJson: input.projectConfigJson,
    environment: created,
  });
}

export async function reconcileEnvironmentState(input: ReconcileEnvironmentStateInput): Promise<{
  namespace: string;
  services: NonNullable<ReconcileEnvironmentStateInput['services']>;
}> {
  const namespace = await ensureEnvironmentNamespace({
    projectId: input.project.id,
    projectSlug: input.project.slug,
    environment: input.environment,
  });
  const serviceList = input.services ?? (await loadProjectServices(input.project.id));
  const scope = input.scope ?? 'runtime';

  if (scope !== 'access' && isK8sAvailable()) {
    if (isPreviewApplicationSetEnvironment(input.environment)) {
      await syncPreviewEnvironmentScaffold({
        projectId: input.project.id,
        projectSlug: input.project.slug,
        environmentId: input.environment.id,
        namespace,
      });
    } else {
      await createNamespace(
        namespace,
        buildEnvironmentNamespaceLabels({
          projectId: input.project.id,
          projectSlug: input.project.slug,
          environment: input.environment,
        })
      );

      for (const service of serviceList) {
        const serviceName = buildProjectScopedK8sName(input.project.slug, service.name);

        await upsertService(namespace, serviceName, {
          port: service.port || 3000,
          targetPort: service.port || 3000,
          selector: { app: serviceName },
        });
      }
    }
  }

  if (scope !== 'runtime') {
    await ensureEnvironmentDomains({
      project: {
        id: input.project.id,
        slug: input.project.slug,
        configJson: input.project.configJson,
      },
      environment: {
        id: input.environment.id,
        name: input.environment.name,
        namespace,
        kind: input.environment.kind,
        isPreview: input.environment.isPreview,
        deploymentStrategy: input.environment.deploymentStrategy,
      },
      services: serviceList,
    });
  }

  return {
    namespace,
    services: serviceList,
  };
}
