import type { DatabaseRecord, MigrationSpecificationRecord } from './types';

export function getDefaultMigrationPath(
  tool: MigrationSpecificationRecord['tool'],
  databaseType: DatabaseRecord['type']
): string | null {
  switch (tool) {
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
  specification: Pick<MigrationSpecificationRecord, 'tool' | 'migrationPath'>,
  databaseType: DatabaseRecord['type']
): string | null {
  return specification.migrationPath ?? getDefaultMigrationPath(specification.tool, databaseType);
}
