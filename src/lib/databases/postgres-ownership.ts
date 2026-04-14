import postgres from 'postgres';
import { getNormalizedDatabaseUrlFromEnv } from '@/lib/db/connection-url';

type ManagedPostgresDatabase = {
  type: string;
  provisionType?: string | null;
  connectionString?: string | null;
  host?: string | null;
  port?: number | null;
  databaseName?: string | null;
  username?: string | null;
};

function quoteIdentifier(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function quoteLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

function toClusterFqdn(host: string): string {
  const namespace = process.env.JUANIE_NAMESPACE || 'juanie';
  if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes('.')) {
    return host.toLowerCase();
  }

  return `${host}.${namespace}.svc.cluster.local`.toLowerCase();
}

function isManagedSharedPostgres(
  database: ManagedPostgresDatabase,
  adminUrl: string
): database is ManagedPostgresDatabase & {
  host: string;
  databaseName: string;
  username: string;
} {
  if (database.type !== 'postgresql') {
    return false;
  }

  if (database.provisionType && database.provisionType !== 'shared') {
    return false;
  }

  if (!database.host || !database.databaseName || !database.username) {
    return false;
  }

  const adminHost = toClusterFqdn(new URL(adminUrl).hostname);
  const targetHost = toClusterFqdn(database.host);
  return adminHost === targetHost;
}

export async function ensureManagedPostgresOwnership(
  database: ManagedPostgresDatabase
): Promise<boolean> {
  let adminUrl: string;
  try {
    adminUrl = getNormalizedDatabaseUrlFromEnv();
  } catch {
    return false;
  }

  if (!isManagedSharedPostgres(database, adminUrl)) {
    return false;
  }

  const databaseName = database.databaseName;
  const owner = database.username;
  const quotedDatabase = quoteIdentifier(databaseName);
  const quotedOwner = quoteIdentifier(owner);
  const ownerLiteral = quoteLiteral(owner);

  const adminConnection = postgres(adminUrl, { max: 1 });
  const databaseAdminUrl = new URL(adminUrl);
  databaseAdminUrl.pathname = `/${databaseName}`;
  const databaseConnection = postgres(databaseAdminUrl.toString(), { max: 1 });

  try {
    await adminConnection.unsafe(`ALTER DATABASE ${quotedDatabase} OWNER TO ${quotedOwner}`);

    await databaseConnection.unsafe(`ALTER SCHEMA public OWNER TO ${quotedOwner}`);
    await databaseConnection.unsafe(`GRANT ALL PRIVILEGES ON SCHEMA public TO ${quotedOwner}`);
    await databaseConnection.unsafe(`REASSIGN OWNED BY postgres TO ${quotedOwner}`);
    await databaseConnection.unsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${quotedOwner}`
    );
    await databaseConnection.unsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${quotedOwner}`
    );
    await databaseConnection.unsafe(
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${quotedOwner}`
    );
    await databaseConnection.unsafe(`
      DO $$
      DECLARE
        object_record RECORD;
      BEGIN
        FOR object_record IN
          SELECT
            CASE c.relkind
              WHEN 'r' THEN 'TABLE'
              WHEN 'p' THEN 'TABLE'
              WHEN 'S' THEN 'SEQUENCE'
              WHEN 'v' THEN 'VIEW'
              WHEN 'm' THEN 'MATERIALIZED VIEW'
              WHEN 'f' THEN 'FOREIGN TABLE'
            END AS object_kind,
            n.nspname AS schema_name,
            c.relname AS object_name
          FROM pg_class c
          JOIN pg_namespace n ON n.oid = c.relnamespace
          WHERE n.nspname = 'public'
            AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
            AND pg_get_userbyid(c.relowner) <> ${ownerLiteral}
        LOOP
          EXECUTE format(
            'ALTER %s %I.%I OWNER TO %I',
            object_record.object_kind,
            object_record.schema_name,
            object_record.object_name,
            ${ownerLiteral}
          );
        END LOOP;
      END $$;
    `);

    return true;
  } finally {
    await Promise.allSettled([databaseConnection.end(), adminConnection.end()]);
  }
}
