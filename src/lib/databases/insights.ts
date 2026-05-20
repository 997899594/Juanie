import { Client as PgClient } from 'pg';

export interface DatabaseInsightsTarget {
  id: string;
  name: string;
  type: string;
  connectionString?: string | null;
}

export interface DatabaseInsights {
  available: boolean;
  status: 'ready' | 'unsupported' | 'not_configured' | 'unavailable';
  tableCount: number | null;
  estimatedRows: number | null;
  checkedAt: string;
}

interface PostgresInspector {
  getOverview(connectionString: string): Promise<{
    tableCount: number;
    estimatedRows: number;
  }>;
}

const DEFAULT_TIMEOUT_MS = 3_000;

function createEmptyInsights(status: DatabaseInsights['status']): DatabaseInsights {
  return {
    available: false,
    status,
    tableCount: null,
    estimatedRows: null,
    checkedAt: new Date().toISOString(),
  };
}

async function withPostgresClient<T>(
  connectionString: string,
  task: (client: PgClient) => Promise<T>
): Promise<T> {
  const client = new PgClient({
    connectionString,
    connectionTimeoutMillis: DEFAULT_TIMEOUT_MS,
    query_timeout: DEFAULT_TIMEOUT_MS,
    statement_timeout: DEFAULT_TIMEOUT_MS,
  });

  try {
    await client.connect();
    return await task(client);
  } finally {
    await client.end().catch(() => undefined);
  }
}

const defaultPostgresInspector: PostgresInspector = {
  async getOverview(connectionString) {
    return await withPostgresClient(connectionString, async (client) => {
      const result = await client.query<{
        table_count: string | number;
        estimated_rows: string | number;
      }>(
        `
          select
            count(*)::int as table_count,
            coalesce(sum(greatest(c.reltuples, 0)), 0)::bigint as estimated_rows
          from pg_class c
          join pg_namespace n on n.oid = c.relnamespace
          where c.relkind in ('r', 'p')
            and n.nspname not in ('pg_catalog', 'information_schema')
            and n.nspname not like 'pg_toast%'
        `
      );

      return {
        tableCount: Number(result.rows[0]?.table_count ?? 0),
        estimatedRows: Number(result.rows[0]?.estimated_rows ?? 0),
      };
    });
  },
};

export async function getDatabaseInsights(
  database: DatabaseInsightsTarget,
  inspector: PostgresInspector = defaultPostgresInspector
): Promise<DatabaseInsights> {
  if (database.type !== 'postgresql') {
    return createEmptyInsights('unsupported');
  }

  const connectionString = database.connectionString?.trim();
  if (!connectionString) {
    return createEmptyInsights('not_configured');
  }

  try {
    const overview = await inspector.getOverview(connectionString);

    return {
      available: true,
      status: 'ready',
      tableCount: overview.tableCount,
      estimatedRows: overview.estimatedRows,
      checkedAt: new Date().toISOString(),
    };
  } catch {
    return createEmptyInsights('unavailable');
  }
}
