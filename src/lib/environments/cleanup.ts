import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { deprovisionManagedPostgresDatabase } from '@/lib/databases/postgres-ownership';
import { db } from '@/lib/db';
import { databases, domains, environments, environmentVariables } from '@/lib/db/schema';
import { isPreviewEnvironment } from '@/lib/environments/model';
import { deleteNamespace, getIsConnected, initK8sClient, waitForNamespaceDeleted } from '@/lib/k8s';
import { isActiveReleaseStatus } from '@/lib/releases/state-machine';

export function isActivePreviewReleaseStatus(status: string): boolean {
  return isActiveReleaseStatus(status);
}

export async function deletePreviewEnvironmentById(environmentId: string): Promise<{
  deleted: boolean;
  reason?: string;
}> {
  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, environmentId),
    with: {
      project: true,
      releases: true,
      domains: true,
      databases: true,
    },
  });

  if (!environment) {
    return { deleted: false, reason: 'not_found' };
  }

  if (!isPreviewEnvironment(environment)) {
    return { deleted: false, reason: 'not_preview' };
  }

  const hasActiveReleases = environment.releases.some((release) =>
    isActivePreviewReleaseStatus(release.status)
  );
  if (hasActiveReleases) {
    return { deleted: false, reason: 'active_release' };
  }

  initK8sClient();
  if (getIsConnected() && environment.namespace) {
    await deleteNamespace(environment.namespace);
    const deleted = await waitForNamespaceDeleted({ name: environment.namespace });
    if (!deleted) {
      return { deleted: false, reason: 'namespace_cleanup_pending' };
    }
  }

  if (environment.domains.length > 0) {
    await db.delete(domains).where(eq(domains.environmentId, environment.id));
  }

  await db
    .delete(environmentVariables)
    .where(eq(environmentVariables.environmentId, environment.id));

  if (environment.databases.length > 0) {
    for (const database of environment.databases) {
      try {
        await deprovisionManagedPostgresDatabase(database);
      } catch (error) {
        throw new Error(
          `Failed to deprovision preview database ${database.databaseName ?? database.name}`,
          { cause: error }
        );
      }
    }

    await db.delete(databases).where(eq(databases.environmentId, environment.id));
  }

  await db.delete(environments).where(eq(environments.id, environment.id));

  return { deleted: true };
}

export async function cleanupExpiredPreviewEnvironments(input?: { projectId?: string }): Promise<{
  deletedIds: string[];
  skipped: Array<{ id: string; reason: string }>;
}> {
  const expiredEnvironments = await db.query.environments.findMany({
    where: and(
      eq(environments.kind, 'preview'),
      isNotNull(environments.expiresAt),
      lt(environments.expiresAt, new Date()),
      input?.projectId ? eq(environments.projectId, input.projectId) : undefined
    ),
    with: {
      releases: {
        columns: {
          id: true,
          status: true,
        },
      },
    },
  });

  const deletedIds: string[] = [];
  const skipped: Array<{ id: string; reason: string }> = [];

  for (const environment of expiredEnvironments) {
    const activeReleaseIds = environment.releases
      .filter((release) => isActivePreviewReleaseStatus(release.status))
      .map((release) => release.id);

    if (activeReleaseIds.length > 0) {
      skipped.push({ id: environment.id, reason: 'active_release' });
      continue;
    }

    const result = await deletePreviewEnvironmentById(environment.id);
    if (result.deleted) {
      deletedIds.push(environment.id);
    } else {
      skipped.push({ id: environment.id, reason: result.reason ?? 'unknown' });
    }
  }

  return { deletedIds, skipped };
}
