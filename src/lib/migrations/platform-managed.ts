import type { DatabaseRecord, MigrationSpecificationRecord, ResolvedMigrationSpec } from './types';

export function isPlatformManagedMigrationTool(
  tool: MigrationSpecificationRecord['tool'],
  databaseType: DatabaseRecord['type']
): boolean {
  return tool === 'sql' || (tool === 'drizzle' && databaseType === 'postgresql');
}

export function isPlatformManagedMigrationSpec(
  spec: Pick<ResolvedMigrationSpec, 'specification' | 'database'>
): boolean {
  return (
    spec.specification.executionMode !== 'external' &&
    isPlatformManagedMigrationTool(spec.specification.tool, spec.database.type)
  );
}
