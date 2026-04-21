import type { DatabaseRecord, MigrationSpecificationRecord } from './types';

export function getDefaultMigrationPath(
  tool: MigrationSpecificationRecord['tool'],
  databaseType: DatabaseRecord['type']
): string | null {
  switch (tool) {
    case 'atlas':
      return 'migrations';
    case 'drizzle':
      return 'drizzle';
    case 'prisma':
      return 'prisma/migrations';
    case 'knex':
    case 'typeorm':
      return 'migrations';
    case 'sql':
      return `migrations/${databaseType}`;
    default:
      return null;
  }
}

export function resolveMigrationPath(
  specification: Pick<MigrationSpecificationRecord, 'tool' | 'migrationPath'> & {
    source?: MigrationSpecificationRecord['source'] | null;
  },
  databaseType: DatabaseRecord['type']
): string | null {
  if (specification.migrationPath) {
    return specification.migrationPath;
  }

  switch (specification.source) {
    case 'sql':
      return `migrations/${databaseType}`;
    case 'atlas':
      return 'migrations';
    case 'drizzle':
      return 'drizzle';
    case 'prisma':
      return 'prisma/migrations';
    case 'knex':
    case 'typeorm':
      return 'migrations';
    default:
      return getDefaultMigrationPath(specification.tool, databaseType);
  }
}
