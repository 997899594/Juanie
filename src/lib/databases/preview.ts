import { and, eq, isNotNull } from 'drizzle-orm';
import { normalizeDatabaseCapabilities } from '@/lib/databases/capabilities';
import { clonePostgreSQLDatabase } from '@/lib/databases/clone';
import { db } from '@/lib/db';
import { databases, environments, projects } from '@/lib/db/schema';
import { syncEnvVarsToK8s } from '@/lib/env-sync';
import { getDatabasesForEnvironment } from '@/lib/environments/inheritance';
import { getIsConnected, initK8sClient } from '@/lib/k8s';
import {
  injectDatabaseEnvVars,
  provisionDatabase,
  removeInjectedDatabaseEnvVars,
} from '@/lib/queue/project-init';

function getHasK8s(): boolean {
  try {
    initK8sClient();
    return getIsConnected();
  } catch {
    return false;
  }
}

export async function syncPreviewEnvironmentDatabases(input: {
  projectId: string;
  environmentId: string;
}): Promise<void> {
  const [project, environment] = await Promise.all([
    db.query.projects.findFirst({
      where: eq(projects.id, input.projectId),
    }),
    db.query.environments.findFirst({
      where: eq(environments.id, input.environmentId),
    }),
  ]);

  if (!project || !environment || !environment.isPreview) {
    return;
  }

  const hasK8s = getHasK8s();

  if (environment.databaseStrategy !== 'isolated_clone') {
    await db
      .delete(databases)
      .where(
        and(eq(databases.environmentId, environment.id), isNotNull(databases.sourceDatabaseId))
      );
    await removeInjectedDatabaseEnvVars(project.id, environment.id);
    if (hasK8s) {
      await syncEnvVarsToK8s(project.id, environment.id).catch(() => undefined);
    }
    return;
  }

  if (!environment.baseEnvironmentId) {
    throw new Error('当前预览环境没有基础环境，无法创建独立预览库');
  }

  const sourceDatabases = await getDatabasesForEnvironment({
    projectId: project.id,
    environmentId: environment.baseEnvironmentId,
  });

  if (sourceDatabases.length === 0) {
    return;
  }

  if (sourceDatabases.some((database) => database.provisionType === 'external')) {
    throw new Error('外部数据库暂不支持独立预览库，请改用继承基础数据库');
  }

  const existingClones = await db.query.databases.findMany({
    where: and(eq(databases.environmentId, environment.id), isNotNull(databases.sourceDatabaseId)),
    columns: {
      id: true,
      sourceDatabaseId: true,
      status: true,
      connectionString: true,
      type: true,
      name: true,
      capabilities: true,
    },
  });
  for (const source of sourceDatabases) {
    const existingClone = existingClones.find(
      (database) => database.sourceDatabaseId === source.id
    );

    if (existingClone) {
      const nextCapabilities = normalizeDatabaseCapabilities(source.capabilities);
      const currentCapabilities = normalizeDatabaseCapabilities(existingClone.capabilities);

      if (JSON.stringify(nextCapabilities) !== JSON.stringify(currentCapabilities)) {
        await db
          .update(databases)
          .set({
            capabilities: nextCapabilities,
            updatedAt: new Date(),
          })
          .where(eq(databases.id, existingClone.id));
      }

      continue;
    }

    const [clone] = await db
      .insert(databases)
      .values({
        projectId: project.id,
        environmentId: environment.id,
        sourceDatabaseId: source.id,
        serviceId: source.serviceId,
        name: source.name,
        type: source.type,
        plan: source.plan,
        provisionType: source.provisionType,
        scope: source.scope,
        role: source.role,
        capabilities: source.capabilities,
        status: 'pending',
      })
      .returning();

    await provisionDatabase(clone, project, hasK8s);

    const updated = await db.query.databases.findFirst({
      where: eq(databases.id, clone.id),
    });

    if (!updated) {
      continue;
    }

    await db.update(databases).set({ status: 'cloning' }).where(eq(databases.id, updated.id));

    try {
      await clonePostgreSQLDatabase({
        namespace: environment.namespace,
        source,
        target: updated,
      });
      await db.update(databases).set({ status: 'running' }).where(eq(databases.id, updated.id));
    } catch (error) {
      await db.update(databases).set({ status: 'failed' }).where(eq(databases.id, updated.id));
      throw error;
    }
  }

  await removeInjectedDatabaseEnvVars(project.id, environment.id);
  const currentClones = await db.query.databases.findMany({
    where: and(eq(databases.environmentId, environment.id), isNotNull(databases.sourceDatabaseId)),
  });

  for (const clone of currentClones) {
    if (clone.connectionString && clone.status === 'running') {
      await injectDatabaseEnvVars(clone, project, environment.id);
    }
  }

  if (hasK8s) {
    await syncEnvVarsToK8s(project.id, environment.id).catch(() => undefined);
  }
}
