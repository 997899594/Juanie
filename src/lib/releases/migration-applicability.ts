import { isSchemaManagedDatabaseType } from '@/lib/databases/platform-support';
import type { ReleaseSchemaGateSnapshot } from '@/lib/schema-safety';

export type ReleaseMigrationPhase = 'preDeploy' | 'postDeploy' | 'manual';

export interface ReleaseMigrationSpecApplicabilityLike {
  specification: {
    phase: ReleaseMigrationPhase;
  };
  database?: {
    id?: string | null;
    type?: string | null;
  } | null;
}

function isReleaseSchemaManagedMigrationSpec(spec: ReleaseMigrationSpecApplicabilityLike): boolean {
  if (!spec.database?.type) {
    return true;
  }

  return isSchemaManagedDatabaseType(spec.database.type);
}

function getPendingMigrationDatabaseIds(
  schemaGate?: ReleaseSchemaGateSnapshot | null
): Set<string> {
  return new Set(
    (schemaGate?.states ?? [])
      .filter((state) => state.status === 'pending_migrations')
      .map((state) => state.databaseId)
  );
}

export function resolveExecutableReleaseMigrationSpecs<
  TSpec extends ReleaseMigrationSpecApplicabilityLike,
>(input: {
  migrationSpecs: TSpec[];
  schemaGate?: ReleaseSchemaGateSnapshot | null;
  phases?: readonly ReleaseMigrationPhase[];
}): TSpec[] {
  const phaseSet = input.phases ? new Set(input.phases) : null;
  const schemaManagedSpecs = input.migrationSpecs.filter(
    (spec) =>
      isReleaseSchemaManagedMigrationSpec(spec) &&
      (!phaseSet || phaseSet.has(spec.specification.phase))
  );

  if (!input.schemaGate) {
    return schemaManagedSpecs;
  }

  const pendingDatabaseIds = getPendingMigrationDatabaseIds(input.schemaGate);
  if (pendingDatabaseIds.size === 0) {
    return [];
  }

  return schemaManagedSpecs.filter((spec) => {
    if (!spec.database?.id) {
      return true;
    }

    return pendingDatabaseIds.has(spec.database.id);
  });
}

export function hasExecutableReleaseMigrations(input: {
  migrationSpecs: ReleaseMigrationSpecApplicabilityLike[];
  schemaGate?: ReleaseSchemaGateSnapshot | null;
  phases?: readonly ReleaseMigrationPhase[];
}): boolean {
  return resolveExecutableReleaseMigrationSpecs(input).length > 0;
}
