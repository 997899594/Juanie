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

type ManagedPostgresOwnershipStatements = {
  adminStatements: string[];
  databaseStatements: string[];
};

type ManagedPostgresProvisionStatements = {
  roleCreateOrUpdate: string;
  databaseCreate: string;
  databaseOwnerStatement: string;
  databaseGrants: string[];
  schemaBootstrapStatements: string[];
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

export function buildManagedPostgresOwnershipStatements({
  databaseName,
  owner,
}: {
  databaseName: string;
  owner: string;
}): ManagedPostgresOwnershipStatements {
  const quotedDatabase = quoteIdentifier(databaseName);
  const quotedOwner = quoteIdentifier(owner);
  const ownerLiteral = quoteLiteral(owner);

  return {
    adminStatements: [`ALTER DATABASE ${quotedDatabase} OWNER TO ${quotedOwner}`],
    databaseStatements: [
      `ALTER SCHEMA public OWNER TO ${quotedOwner}`,
      `GRANT ALL PRIVILEGES ON SCHEMA public TO ${quotedOwner}`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO ${quotedOwner}`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO ${quotedOwner}`,
      `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON FUNCTIONS TO ${quotedOwner}`,
      `
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
          LEFT JOIN pg_depend dependency
            ON dependency.classid = 'pg_class'::regclass
           AND dependency.objid = c.oid
           AND dependency.deptype = 'e'
          WHERE n.nspname = 'public'
            AND c.relkind IN ('r', 'p', 'S', 'v', 'm', 'f')
            AND pg_get_userbyid(c.relowner) <> ${ownerLiteral}
            AND dependency.objid IS NULL
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
    `,
      `
      DO $$
      DECLARE
        routine_record RECORD;
      BEGIN
        FOR routine_record IN
          SELECT
            n.nspname AS schema_name,
            p.proname AS routine_name,
            pg_get_function_identity_arguments(p.oid) AS routine_args
          FROM pg_proc p
          JOIN pg_namespace n ON n.oid = p.pronamespace
          LEFT JOIN pg_depend dependency
            ON dependency.classid = 'pg_proc'::regclass
           AND dependency.objid = p.oid
           AND dependency.deptype = 'e'
          WHERE n.nspname = 'public'
            AND pg_get_userbyid(p.proowner) <> ${ownerLiteral}
            AND dependency.objid IS NULL
        LOOP
          EXECUTE format(
            'ALTER ROUTINE %I.%I(%s) OWNER TO %I',
            routine_record.schema_name,
            routine_record.routine_name,
            routine_record.routine_args,
            ${ownerLiteral}
          );
        END LOOP;
      END $$;
    `,
      `
      DO $$
      DECLARE
        type_record RECORD;
      BEGIN
        FOR type_record IN
          SELECT
            n.nspname AS schema_name,
            t.typname AS type_name
          FROM pg_type t
          JOIN pg_namespace n ON n.oid = t.typnamespace
          LEFT JOIN pg_depend dependency
            ON dependency.classid = 'pg_type'::regclass
           AND dependency.objid = t.oid
           AND dependency.deptype = 'e'
          WHERE n.nspname = 'public'
            AND t.typtype IN ('c', 'd', 'e', 'r')
            AND pg_get_userbyid(t.typowner) <> ${ownerLiteral}
            AND dependency.objid IS NULL
        LOOP
          EXECUTE format(
            'ALTER TYPE %I.%I OWNER TO %I',
            type_record.schema_name,
            type_record.type_name,
            ${ownerLiteral}
          );
        END LOOP;
      END $$;
    `,
    ],
  };
}

export function buildManagedPostgresProvisionStatements({
  databaseName,
  owner,
  password,
}: {
  databaseName: string;
  owner: string;
  password: string;
}): ManagedPostgresProvisionStatements {
  const quotedDatabase = quoteIdentifier(databaseName);
  const quotedOwner = quoteIdentifier(owner);
  const ownerLiteral = quoteLiteral(owner);
  const passwordLiteral = quoteLiteral(password);

  return {
    roleCreateOrUpdate: `
      DO $$
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = ${ownerLiteral}) THEN
          EXECUTE 'ALTER ROLE ${quotedOwner} LOGIN PASSWORD ${passwordLiteral}';
        ELSE
          EXECUTE 'CREATE ROLE ${quotedOwner} LOGIN PASSWORD ${passwordLiteral}';
        END IF;
      END $$;
    `,
    databaseCreate: `CREATE DATABASE ${quotedDatabase} OWNER ${quotedOwner} ENCODING 'UTF8' TEMPLATE template0`,
    databaseOwnerStatement: `ALTER DATABASE ${quotedDatabase} OWNER TO ${quotedOwner}`,
    databaseGrants: [`GRANT ALL PRIVILEGES ON DATABASE ${quotedDatabase} TO ${quotedOwner}`],
    schemaBootstrapStatements: [
      `ALTER SCHEMA public OWNER TO ${quotedOwner}`,
      `GRANT ALL PRIVILEGES ON SCHEMA public TO ${quotedOwner}`,
    ],
  };
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
  const statements = buildManagedPostgresOwnershipStatements({
    databaseName,
    owner,
  });

  const adminConnection = postgres(adminUrl, { max: 1 });
  const databaseAdminUrl = new URL(adminUrl);
  databaseAdminUrl.pathname = `/${databaseName}`;
  const databaseConnection = postgres(databaseAdminUrl.toString(), { max: 1 });

  try {
    for (const statement of statements.adminStatements) {
      await adminConnection.unsafe(statement);
    }

    for (const statement of statements.databaseStatements) {
      await databaseConnection.unsafe(statement);
    }

    return true;
  } finally {
    await Promise.allSettled([databaseConnection.end(), adminConnection.end()]);
  }
}

export async function assertManagedPostgresRuntimeAccess(
  database: ManagedPostgresDatabase
): Promise<boolean> {
  if (database.type !== 'postgresql' || database.provisionType !== 'shared') {
    return false;
  }

  const connectionString = database.connectionString;
  if (!connectionString) {
    return false;
  }

  const appConnection = postgres(connectionString, { max: 1 });

  try {
    const [row] = await appConnection<
      {
        database_ok: boolean;
        public_schema_ok: boolean;
      }[]
    >`
      SELECT
        has_database_privilege(current_user, current_database(), 'CREATE,TEMP,CONNECT') AS database_ok,
        has_schema_privilege(current_user, 'public', 'USAGE,CREATE') AS public_schema_ok
    `;

    if (!row?.database_ok || !row.public_schema_ok) {
      throw new Error(
        '共享 PostgreSQL 初始化不完整：应用数据库角色缺少数据库或 public schema 的写入权限。请重新 provision 数据库，不要在迁移运行时修 ownership。'
      );
    }

    return true;
  } finally {
    await appConnection.end().catch(() => undefined);
  }
}
