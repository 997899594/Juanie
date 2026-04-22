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

type ManagedPostgresDeprovisionStatements = {
  databaseDropStatements: string[];
  roleDropStatements: string[];
};

type ManagedPostgresProvisionStatements = {
  roleCreateOrUpdate: string;
  databaseCreate: string;
  databaseOwnerStatement: string;
  databaseGrants: string[];
  schemaBootstrapStatements: string[];
};

type ManagedPostgresAdminConnection = {
  unsafe: (query: string) => Promise<unknown>;
  end: () => Promise<unknown>;
};

type ManagedPostgresDeprovisionOptions = {
  resolveAdminUrl?: () => string;
  connect?: (connectionString: string) => ManagedPostgresAdminConnection;
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
      DECLARE
        target_role text := ${ownerLiteral};
        target_password text := ${passwordLiteral};
      BEGIN
        IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = target_role) THEN
          EXECUTE format('ALTER ROLE %I LOGIN PASSWORD %L', target_role, target_password);
        ELSE
          EXECUTE format('CREATE ROLE %I LOGIN PASSWORD %L', target_role, target_password);
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

export function buildManagedPostgresDeprovisionStatements({
  databaseName,
  ownerRoleName,
  adminDatabaseName,
  adminRoleName,
}: {
  databaseName: string;
  ownerRoleName?: string | null;
  adminDatabaseName: string;
  adminRoleName: string;
}): ManagedPostgresDeprovisionStatements {
  const normalizedDatabaseName = databaseName.trim().toLowerCase();
  const protectedDatabaseNames = new Set([
    'postgres',
    'template0',
    'template1',
    adminDatabaseName.trim().toLowerCase(),
  ]);
  const databaseDropStatements = protectedDatabaseNames.has(normalizedDatabaseName)
    ? []
    : [`DROP DATABASE IF EXISTS ${quoteIdentifier(databaseName)} WITH (FORCE)`];

  const normalizedOwnerRoleName = ownerRoleName?.trim().toLowerCase() || null;
  const protectedRoleNames = new Set(['postgres', adminRoleName.trim().toLowerCase()]);
  const roleDropStatements =
    normalizedOwnerRoleName && !protectedRoleNames.has(normalizedOwnerRoleName)
      ? [`DROP ROLE IF EXISTS ${quoteIdentifier(ownerRoleName!.trim())}`]
      : [];

  return {
    databaseDropStatements,
    roleDropStatements,
  };
}

function buildManagedPostgresRoleCleanupStatements({
  ownerRoleName,
  adminRoleName,
}: {
  ownerRoleName?: string | null;
  adminRoleName: string;
}): string[] {
  const normalizedOwnerRoleName = ownerRoleName?.trim().toLowerCase() || null;
  const protectedRoleNames = new Set(['postgres', adminRoleName.trim().toLowerCase()]);
  if (!normalizedOwnerRoleName || protectedRoleNames.has(normalizedOwnerRoleName)) {
    return [];
  }

  const ownerLiteral = quoteLiteral(ownerRoleName!.trim());
  const quotedAdminRole = quoteIdentifier(adminRoleName.trim());

  return [
    `
      DO $$
      BEGIN
        IF EXISTS (
          SELECT 1
          FROM pg_namespace
          WHERE nspname = 'public'
            AND pg_get_userbyid(nspowner) = ${ownerLiteral}
        ) THEN
          EXECUTE 'ALTER SCHEMA public OWNER TO ${quotedAdminRole}';
        END IF;
      END $$;
    `,
    `DROP OWNED BY ${quoteIdentifier(ownerRoleName!.trim())}`,
  ];
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

function looksLikeManagedSharedPostgres(
  database: ManagedPostgresDatabase
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

  return Boolean(database.host && database.databaseName && database.username);
}

function getAdminDatabaseName(adminUrl: string): string {
  const pathname = new URL(adminUrl).pathname.replace(/^\/+/, '');
  return decodeURIComponent(pathname || 'postgres');
}

function getAdminRoleName(adminUrl: string): string {
  return decodeURIComponent(new URL(adminUrl).username || 'postgres');
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

export async function deprovisionManagedPostgresDatabase(
  database: ManagedPostgresDatabase,
  options: ManagedPostgresDeprovisionOptions = {}
): Promise<boolean> {
  const shouldManage = looksLikeManagedSharedPostgres(database);
  let adminUrl: string;
  try {
    adminUrl = (options.resolveAdminUrl ?? getNormalizedDatabaseUrlFromEnv)();
  } catch (error) {
    if (shouldManage) {
      throw new Error(
        'Control-plane database config is incomplete; cannot deprovision shared PostgreSQL',
        { cause: error }
      );
    }

    return false;
  }

  if (!isManagedSharedPostgres(database, adminUrl)) {
    return false;
  }

  const statements = buildManagedPostgresDeprovisionStatements({
    databaseName: database.databaseName,
    ownerRoleName: database.username,
    adminDatabaseName: getAdminDatabaseName(adminUrl),
    adminRoleName: getAdminRoleName(adminUrl),
  });
  const roleCleanupStatements = buildManagedPostgresRoleCleanupStatements({
    ownerRoleName: database.username,
    adminRoleName: getAdminRoleName(adminUrl),
  });

  if (
    statements.databaseDropStatements.length === 0 &&
    statements.roleDropStatements.length === 0 &&
    roleCleanupStatements.length === 0
  ) {
    return false;
  }

  const connect =
    options.connect ?? ((connectionString: string) => postgres(connectionString, { max: 1 }));
  const adminConnection = connect(adminUrl);
  const maintenanceUrls = new Set([adminUrl]);
  const postgresUrl = new URL(adminUrl);
  postgresUrl.pathname = '/postgres';
  maintenanceUrls.add(postgresUrl.toString());
  const maintenanceConnections = Array.from(maintenanceUrls, (connectionString) => ({
    connectionString,
    connection: connectionString === adminUrl ? adminConnection : connect(connectionString),
  }));

  try {
    for (const { connection } of maintenanceConnections) {
      for (const statement of roleCleanupStatements) {
        await connection.unsafe(statement);
      }
    }

    for (const statement of statements.databaseDropStatements) {
      await adminConnection.unsafe(statement);
    }

    for (const statement of statements.roleDropStatements) {
      await adminConnection.unsafe(statement);
    }

    return true;
  } finally {
    await Promise.allSettled(
      maintenanceConnections.map(({ connection }) => connection.end().catch(() => undefined))
    );
  }
}

export async function assertManagedPostgresRuntimeAccess(
  database: ManagedPostgresDatabase
): Promise<boolean> {
  if (!shouldAssertManagedPostgresRuntimeAccess(database)) {
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

export function shouldAssertManagedPostgresRuntimeAccess(
  database: Pick<ManagedPostgresDatabase, 'type' | 'provisionType'>
): boolean {
  return database.type === 'postgresql' && database.provisionType === 'shared';
}
