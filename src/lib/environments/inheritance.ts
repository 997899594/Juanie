import { and, eq, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { databases, environments } from '@/lib/db/schema';

export interface EnvironmentLineageItem {
  id: string;
  name: string;
  baseEnvironmentId: string | null;
  isPreview: boolean | null;
}

export async function getEnvironmentLineage(
  environmentId: string
): Promise<EnvironmentLineageItem[]> {
  const lineage: EnvironmentLineageItem[] = [];
  const visited = new Set<string>();
  let currentId: string | null = environmentId;

  while (currentId && !visited.has(currentId)) {
    visited.add(currentId);
    const environment: EnvironmentLineageItem | undefined = await db.query.environments.findFirst({
      where: eq(environments.id, currentId),
      columns: {
        id: true,
        name: true,
        baseEnvironmentId: true,
        isPreview: true,
      },
    });

    if (!environment) {
      break;
    }

    lineage.unshift(environment);
    currentId = environment.baseEnvironmentId ?? null;
  }

  return lineage;
}

export async function getEnvironmentLineageIds(environmentId: string): Promise<string[]> {
  const lineage = await getEnvironmentLineage(environmentId);
  return lineage.map((environment) => environment.id);
}

export async function getInheritedDatabasesForEnvironment(input: {
  projectId: string;
  environmentId: string;
}): Promise<Array<typeof databases.$inferSelect>> {
  const lineageIds = await getEnvironmentLineageIds(input.environmentId);

  if (lineageIds.length === 0) {
    return [];
  }

  const scopePriority = new Map(lineageIds.map((id, index) => [id, index]));
  const databaseList = await db.query.databases.findMany({
    where: and(
      eq(databases.projectId, input.projectId),
      inArray(databases.environmentId, lineageIds)
    ),
  });

  return databaseList.sort((left, right) => {
    const leftPriority = scopePriority.get(left.environmentId ?? '') ?? -1;
    const rightPriority = scopePriority.get(right.environmentId ?? '') ?? -1;
    return rightPriority - leftPriority;
  });
}

export async function getDatabasesForEnvironment(input: {
  projectId: string;
  environmentId: string;
}): Promise<Array<typeof databases.$inferSelect>> {
  const environment = await db.query.environments.findFirst({
    where: eq(environments.id, input.environmentId),
    columns: {
      id: true,
      baseEnvironmentId: true,
      databaseStrategy: true,
    },
  });

  if (!environment) {
    return [];
  }

  if (environment.databaseStrategy === 'inherit' && environment.baseEnvironmentId) {
    return getInheritedDatabasesForEnvironment(input);
  }

  return db.query.databases.findMany({
    where: and(
      eq(databases.projectId, input.projectId),
      eq(databases.environmentId, input.environmentId)
    ),
  });
}
