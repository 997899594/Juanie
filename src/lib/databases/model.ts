import {
  type PlatformDatabaseProvisionType,
  resolveDatabaseProvisionType,
  toPlatformDatabaseProvisionType,
} from '@/lib/databases/platform-support';
import type { DatabaseRuntime, DatabaseType } from '@/lib/db/schema';

export interface DatabaseRuntimeLike {
  type: DatabaseType;
  provisionType?: PlatformDatabaseProvisionType | string | null;
  runtime?: DatabaseRuntime | null;
}

export function inferDatabaseRuntime(
  type: DatabaseType,
  provisionType?: PlatformDatabaseProvisionType | null
): DatabaseRuntime {
  const resolvedProvisionType = resolveDatabaseProvisionType(type, provisionType);

  if (resolvedProvisionType === 'external') {
    return 'external';
  }

  if (type === 'postgresql' && resolvedProvisionType === 'shared') {
    return 'shared_postgres';
  }

  if (type === 'redis' && resolvedProvisionType === 'shared') {
    return 'shared_redis';
  }

  if (type === 'postgresql' && resolvedProvisionType === 'standalone') {
    return 'cloudnativepg';
  }

  return 'native_k8s';
}

export function getDatabaseRuntime(database: DatabaseRuntimeLike): DatabaseRuntime {
  if (database.runtime) {
    return database.runtime;
  }

  return inferDatabaseRuntime(
    database.type,
    toPlatformDatabaseProvisionType(database.provisionType)
  );
}

export function usesCloudNativePgRuntime(database: DatabaseRuntimeLike): boolean {
  return getDatabaseRuntime(database) === 'cloudnativepg';
}
