import { Client as PgClient } from 'pg';
import { getNormalizedDatabaseUrlFromEnv } from '@/lib/db/connection-url';

export const databaseCapabilities = ['vector', 'pg_trgm'] as const;
export type DatabaseCapability = (typeof databaseCapabilities)[number];

export const basePostgresImage = 'postgres:16-alpine';
export const supersetPostgresImage = 'pgvector/pgvector:pg16';

const postgresCapabilitySpecs: Record<
  DatabaseCapability,
  {
    extension: string;
    probeSql: string;
  }
> = {
  vector: {
    extension: 'vector',
    probeSql: "SELECT '[1,2,3]'::vector",
  },
  pg_trgm: {
    extension: 'pg_trgm',
    probeSql: "SELECT similarity('juanie', 'juanie')",
  },
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export function normalizeDatabaseCapabilities(
  capabilities: readonly string[] | null | undefined
): DatabaseCapability[] {
  if (!capabilities?.length) {
    return [];
  }

  return Array.from(
    new Set(
      capabilities.filter((capability): capability is DatabaseCapability =>
        databaseCapabilities.includes(capability as DatabaseCapability)
      )
    )
  ).sort();
}

export function resolveManagedPostgresImage(
  capabilities: readonly string[] | null | undefined
): string {
  const normalized = normalizeDatabaseCapabilities(capabilities);
  return normalized.includes('vector') ? supersetPostgresImage : basePostgresImage;
}

export function getPostgresCapabilityExtensions(
  capabilities: readonly string[] | null | undefined
): string[] {
  return Array.from(
    new Set(
      normalizeDatabaseCapabilities(capabilities).map(
        (capability) => postgresCapabilitySpecs[capability].extension
      )
    )
  );
}

export interface DatabaseCapabilityTarget {
  id?: string;
  name: string;
  type: string;
  connectionString: string | null;
  provisionType?: string | null;
  databaseName?: string | null;
  capabilities?: readonly string[] | null;
}

export interface DatabaseCapabilityIssue {
  capability: DatabaseCapability;
  message: string;
}

export interface DatabaseCapabilityCheckResult {
  satisfied: boolean;
  capabilities: DatabaseCapability[];
  issues: DatabaseCapabilityIssue[];
}

async function connectWithRetry(connectionString: string): Promise<PgClient> {
  const timeoutMs = 120_000;
  const startedAt = Date.now();
  let lastError: unknown = null;

  while (Date.now() - startedAt < timeoutMs) {
    const client = new PgClient({ connectionString });
    try {
      await client.connect();
      return client;
    } catch (error) {
      lastError = error;
      await client.end().catch(() => undefined);
      await sleep(2_000);
    }
  }

  throw new Error(
    `Timed out connecting to PostgreSQL: ${lastError instanceof Error ? lastError.message : String(lastError)}`
  );
}

function getCapabilityConnectionString(
  database: DatabaseCapabilityTarget,
  mode: 'verify' | 'reconcile'
): string | null {
  if (mode === 'reconcile' && database.provisionType === 'shared' && database.databaseName) {
    try {
      const adminUrl = getNormalizedDatabaseUrlFromEnv();
      const nextUrl = new URL(adminUrl);
      nextUrl.pathname = `/${database.databaseName}`;
      return nextUrl.toString();
    } catch {
      return database.connectionString;
    }
  }

  return database.connectionString;
}

async function checkCapability(
  client: PgClient,
  capability: DatabaseCapability
): Promise<DatabaseCapabilityIssue | null> {
  const spec = postgresCapabilitySpecs[capability];
  const extensionCheck = await client.query<{ extname: string }>(
    'SELECT extname FROM pg_extension WHERE extname = $1',
    [spec.extension]
  );

  if (extensionCheck.rowCount === 0) {
    return {
      capability,
      message: `缺少 ${spec.extension} 扩展`,
    };
  }

  try {
    await client.query(spec.probeSql);
    return null;
  } catch (error) {
    return {
      capability,
      message: `${spec.extension} 扩展存在但运行时不可用: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

export async function verifyDeclaredDatabaseCapabilities(
  database: DatabaseCapabilityTarget
): Promise<DatabaseCapabilityCheckResult> {
  const capabilities = normalizeDatabaseCapabilities(database.capabilities);

  if (capabilities.length === 0 || database.type !== 'postgresql') {
    return {
      satisfied: true,
      capabilities,
      issues: [],
    };
  }

  const targetConnectionString = getCapabilityConnectionString(database, 'verify');
  if (!targetConnectionString) {
    return {
      satisfied: false,
      capabilities,
      issues: capabilities.map((capability) => ({
        capability,
        message: `数据库 ${database.name} 缺少连接信息，无法校验 ${capability} 能力`,
      })),
    };
  }

  const client = await connectWithRetry(targetConnectionString);

  try {
    const issues: DatabaseCapabilityIssue[] = [];

    for (const capability of capabilities) {
      const issue = await checkCapability(client, capability);
      if (issue) {
        issues.push(issue);
      }
    }

    return {
      satisfied: issues.length === 0,
      capabilities,
      issues,
    };
  } finally {
    await client.end();
  }
}

export async function reconcileDeclaredDatabaseCapabilities(
  database: DatabaseCapabilityTarget
): Promise<DatabaseCapabilityCheckResult> {
  const capabilities = normalizeDatabaseCapabilities(database.capabilities);

  if (capabilities.length === 0 || database.type !== 'postgresql') {
    return {
      satisfied: true,
      capabilities,
      issues: [],
    };
  }

  const targetConnectionString = getCapabilityConnectionString(database, 'reconcile');
  if (!targetConnectionString) {
    return {
      satisfied: false,
      capabilities,
      issues: capabilities.map((capability) => ({
        capability,
        message: `数据库 ${database.name} 缺少连接信息，无法兑现 ${capability} 能力`,
      })),
    };
  }

  const client = await connectWithRetry(targetConnectionString);

  try {
    for (const extension of getPostgresCapabilityExtensions(capabilities)) {
      try {
        await client.query(`CREATE EXTENSION IF NOT EXISTS "${extension}"`);
      } catch (error) {
        return {
          satisfied: false,
          capabilities,
          issues: capabilities
            .filter((capability) => postgresCapabilitySpecs[capability].extension === extension)
            .map((capability) => ({
              capability,
              message: `${extension} 扩展无法创建: ${error instanceof Error ? error.message : String(error)}`,
            })),
        };
      }
    }
  } finally {
    await client.end();
  }

  return verifyDeclaredDatabaseCapabilities(database);
}

export function formatDatabaseCapabilityIssues(
  database: Pick<DatabaseCapabilityTarget, 'name'>,
  issues: DatabaseCapabilityIssue[]
): string {
  return `数据库 ${database.name} 能力校验失败：${issues.map((issue) => issue.message).join('；')}`;
}

export async function assertDeclaredDatabaseCapabilities(
  database: DatabaseCapabilityTarget
): Promise<DatabaseCapabilityCheckResult> {
  const result = await verifyDeclaredDatabaseCapabilities(database);

  if (!result.satisfied) {
    throw new Error(formatDatabaseCapabilityIssues(database, result.issues));
  }

  return result;
}
