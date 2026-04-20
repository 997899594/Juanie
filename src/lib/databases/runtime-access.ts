import Redis from 'ioredis';
import { MongoClient } from 'mongodb';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import type { PlatformDatabaseType } from '@/lib/databases/platform-support';
import {
  getDatabaseTypeLabel,
  resolveDatabaseProvisionType,
  toPlatformDatabaseProvisionType,
  validateExternalDatabaseUrl,
} from '@/lib/databases/platform-support';

export type DatabaseRuntimeAccessValidationDepth = 'skipped' | 'protocol_handshake';

export interface DatabaseRuntimeAccessTarget {
  id?: string;
  name: string;
  type: PlatformDatabaseType;
  provisionType?: string | null;
  connectionString?: string | null;
}

export interface DatabaseRuntimeAccessIssue {
  code: 'missing_connection_string' | 'invalid_connection_string' | 'runtime_access_failed';
  message: string;
}

export interface DatabaseRuntimeAccessCheckResult {
  validated: boolean;
  satisfied: boolean;
  depth: DatabaseRuntimeAccessValidationDepth;
  issues: DatabaseRuntimeAccessIssue[];
}

export interface DatabaseRuntimeAccessProbeOverrides {
  timeoutMs?: number;
  probePostgres?: (connectionString: string, timeoutMs: number) => Promise<void>;
  probeRedis?: (connectionString: string, timeoutMs: number) => Promise<void>;
  probeMysql?: (connectionString: string, timeoutMs: number) => Promise<void>;
  probeMongo?: (connectionString: string, timeoutMs: number) => Promise<void>;
}

const DEFAULT_RUNTIME_ACCESS_TIMEOUT_MS = 5_000;

function getConnectionString(database: DatabaseRuntimeAccessTarget): string | null {
  const value = database.connectionString?.trim();
  return value ? value : null;
}

function getDisplayName(database: DatabaseRuntimeAccessTarget): string {
  return database.name || database.id || 'unnamed';
}

function buildIssue(
  code: DatabaseRuntimeAccessIssue['code'],
  message: string
): DatabaseRuntimeAccessIssue {
  return { code, message };
}

function formatProbeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function resolveDatabaseRuntimeAccessValidationDepth(
  database: DatabaseRuntimeAccessTarget
): DatabaseRuntimeAccessValidationDepth {
  const provisionType = resolveDatabaseProvisionType(
    database.type,
    toPlatformDatabaseProvisionType(database.provisionType)
  );

  if (provisionType !== 'external') {
    return 'skipped';
  }

  return 'protocol_handshake';
}

export function shouldValidateDatabaseRuntimeAccess(
  database: DatabaseRuntimeAccessTarget
): boolean {
  return resolveDatabaseRuntimeAccessValidationDepth(database) !== 'skipped';
}

export function formatDatabaseRuntimeAccessIssues(
  database: Pick<DatabaseRuntimeAccessTarget, 'name'>,
  issues: readonly DatabaseRuntimeAccessIssue[]
): string {
  const details = issues.map((issue) => issue.message).join('；');
  return `数据库 "${database.name}" 运行时访问校验失败：${details}`;
}

async function defaultProbePostgres(connectionString: string, timeoutMs: number): Promise<void> {
  const client = new PgClient({
    connectionString,
    connectionTimeoutMillis: timeoutMs,
    query_timeout: timeoutMs,
    statement_timeout: timeoutMs,
  });

  try {
    await client.connect();
    await client.query('SELECT 1');
  } finally {
    await client.end().catch(() => undefined);
  }
}

async function defaultProbeRedis(connectionString: string, timeoutMs: number): Promise<void> {
  const client = new Redis(connectionString, {
    lazyConnect: true,
    enableOfflineQueue: false,
    connectTimeout: timeoutMs,
    maxRetriesPerRequest: 0,
  });

  try {
    await client.connect();
    await client.ping();
  } finally {
    try {
      await client.quit();
    } catch {
      client.disconnect();
    }
  }
}

async function defaultProbeMysql(connectionString: string, timeoutMs: number): Promise<void> {
  const connection = await mysql.createConnection({
    uri: connectionString,
    connectTimeout: timeoutMs,
  });

  try {
    await connection.ping();
  } finally {
    await connection.end().catch(() => undefined);
  }
}

async function defaultProbeMongo(connectionString: string, timeoutMs: number): Promise<void> {
  const client = new MongoClient(connectionString, {
    maxPoolSize: 1,
    connectTimeoutMS: timeoutMs,
    serverSelectionTimeoutMS: timeoutMs,
    socketTimeoutMS: timeoutMs,
  });

  try {
    await client.connect();
    await client.db().command({ ping: 1 });
  } finally {
    await client.close().catch(() => undefined);
  }
}

export async function verifyDeclaredDatabaseRuntimeAccess(
  database: DatabaseRuntimeAccessTarget,
  overrides: DatabaseRuntimeAccessProbeOverrides = {}
): Promise<DatabaseRuntimeAccessCheckResult> {
  const depth = resolveDatabaseRuntimeAccessValidationDepth(database);

  if (depth === 'skipped') {
    return {
      validated: false,
      satisfied: true,
      depth,
      issues: [],
    };
  }

  const connectionString = getConnectionString(database);
  if (!connectionString) {
    return {
      validated: true,
      satisfied: false,
      depth,
      issues: [
        buildIssue(
          'missing_connection_string',
          `${getDatabaseTypeLabel(database.type)} 外部数据库缺少连接串，无法进行运行时访问校验`
        ),
      ],
    };
  }

  const urlError = validateExternalDatabaseUrl(database.type, connectionString);
  if (urlError) {
    return {
      validated: true,
      satisfied: false,
      depth,
      issues: [buildIssue('invalid_connection_string', urlError)],
    };
  }

  const timeoutMs = overrides.timeoutMs ?? DEFAULT_RUNTIME_ACCESS_TIMEOUT_MS;
  const probePostgres = overrides.probePostgres ?? defaultProbePostgres;
  const probeRedis = overrides.probeRedis ?? defaultProbeRedis;
  const probeMysql = overrides.probeMysql ?? defaultProbeMysql;
  const probeMongo = overrides.probeMongo ?? defaultProbeMongo;

  try {
    switch (database.type) {
      case 'postgresql':
        await probePostgres(connectionString, timeoutMs);
        break;
      case 'redis':
        await probeRedis(connectionString, timeoutMs);
        break;
      case 'mysql':
        await probeMysql(connectionString, timeoutMs);
        break;
      case 'mongodb':
        await probeMongo(connectionString, timeoutMs);
        break;
    }

    return {
      validated: true,
      satisfied: true,
      depth,
      issues: [],
    };
  } catch (error) {
    const typeLabel = getDatabaseTypeLabel(database.type);
    const targetName = getDisplayName(database);
    return {
      validated: true,
      satisfied: false,
      depth,
      issues: [
        buildIssue(
          'runtime_access_failed',
          `${typeLabel} 数据库 "${targetName}" 运行时不可达或认证失败：${formatProbeError(error)}`
        ),
      ],
    };
  }
}

export async function assertDeclaredDatabaseRuntimeAccess(
  database: DatabaseRuntimeAccessTarget,
  overrides: DatabaseRuntimeAccessProbeOverrides = {}
): Promise<DatabaseRuntimeAccessCheckResult> {
  const result = await verifyDeclaredDatabaseRuntimeAccess(database, overrides);

  if (!result.satisfied) {
    throw new Error(formatDatabaseRuntimeAccessIssues(database, result.issues));
  }

  return result;
}
