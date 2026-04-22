import type { DatabaseRecord, MigrationSpecificationRecord, ResolvedMigrationSpec } from './types';

export function isPlatformManagedMigrationTool(
  tool: MigrationSpecificationRecord['tool'],
  databaseType: DatabaseRecord['type']
): boolean {
  return (
    (tool === 'sql' && ['postgresql', 'mysql'].includes(databaseType)) ||
    (tool === 'drizzle' && databaseType === 'postgresql') ||
    (tool === 'atlas' && ['postgresql', 'mysql'].includes(databaseType))
  );
}

export function isPlatformManagedMigrationSpec(
  spec: Pick<ResolvedMigrationSpec, 'specification' | 'database'>
): boolean {
  return (
    spec.specification.executionMode !== 'external' &&
    isPlatformManagedMigrationTool(spec.specification.tool, spec.database.type)
  );
}
