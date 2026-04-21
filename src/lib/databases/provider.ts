import { and, eq, ne } from 'drizzle-orm';
import Redis from 'ioredis';
import { nanoid } from 'nanoid';
import postgres from 'postgres';
import {
  formatDatabaseCapabilityIssues,
  reconcileDeclaredDatabaseCapabilities,
  resolveManagedPostgresImage,
  verifyDeclaredDatabaseCapabilities,
} from '@/lib/databases/capabilities';
import {
  buildCloudNativePgClusterManifest,
  buildCloudNativePgConnectionDetails,
} from '@/lib/databases/cloudnative-pg';
import { getDatabaseRuntime } from '@/lib/databases/model';
import {
  formatUnsupportedDatabaseProvisionTypeMessage,
  resolveDatabaseProvisionType,
  supportsDatabaseProvisionType,
  toPlatformDatabaseProvisionType,
} from '@/lib/databases/platform-support';
import {
  assertManagedPostgresRuntimeAccess,
  buildManagedPostgresProvisionStatements,
  deprovisionManagedPostgresDatabase,
} from '@/lib/databases/postgres-ownership';
import {
  formatDatabaseRuntimeAccessIssues,
  verifyDeclaredDatabaseRuntimeAccess,
} from '@/lib/databases/runtime-access';
import { db } from '@/lib/db';
import {
  buildNormalizedPostgresUrl,
  getNormalizedDatabaseUrlFromEnv,
} from '@/lib/db/connection-url';
import type { DatabaseRuntime } from '@/lib/db/schema';
import { databases, environments, projects } from '@/lib/db/schema';
import { buildEnvironmentNamespace } from '@/lib/environments/model';
import {
  createNamespace,
  createService,
  createStatefulSet,
  deleteCloudNativePgCluster,
  deleteDeployment,
  deleteSecret,
  deleteService,
  deleteStatefulSet,
  getK8sClient,
  isK8sAvailable,
  upsertCloudNativePgCluster,
  upsertSecret,
} from '@/lib/k8s';
import { buildProjectNamespaceBase, buildProjectScopedK8sName } from '@/lib/k8s/naming';

type DatabaseRecord = typeof databases.$inferSelect;
type ProjectRecord = typeof projects.$inferSelect;
type DatabaseProviderTarget = Pick<DatabaseRecord, 'type'> & {
  provisionType?: string | null;
  runtime?: DatabaseRuntime | null;
};
type ManagedDatabaseCleanupTarget = DatabaseProviderTarget & {
  connectionString?: string | null;
  host?: string | null;
  port?: number | null;
  databaseName?: string | null;
  username?: string | null;
  namespace?: string | null;
  serviceName?: string | null;
};

export interface ManagedDatabaseProvisionInput {
  database: DatabaseRecord;
  project: ProjectRecord;
  hasK8s: boolean;
}

export interface ManagedDatabaseProvider {
  id: ReturnType<typeof getDatabaseRuntime>;
  provision: (input: ManagedDatabaseProvisionInput) => Promise<void>;
  deprovision: (database: ManagedDatabaseCleanupTarget) => Promise<boolean>;
}

function quoteConnectionPassword(password: string): string {
  return encodeURIComponent(password);
}

function sanitizePgName(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '_')
    .slice(0, 30);
}

function toClusterFqdn(host: string): string {
  const namespace = process.env.JUANIE_NAMESPACE || 'juanie';
  if (!host || host === 'localhost' || /^\d+\.\d+\.\d+\.\d+$/.test(host) || host.includes('.')) {
    return host.toLowerCase();
  }

  return `${host}.${namespace}.svc.cluster.local`.toLowerCase();
}

async function getDatabaseEnvironmentContext(input: {
  database: DatabaseRecord;
  project: ProjectRecord;
}): Promise<{
  environment: {
    id: string;
    name: string;
    namespace: string | null;
    isPreview: boolean | null;
    isProduction: boolean | null;
  } | null;
  namespace: string;
  resourceName: string;
}> {
  const environment = input.database.environmentId
    ? await db.query.environments.findFirst({
        where: eq(environments.id, input.database.environmentId),
        columns: {
          id: true,
          name: true,
          namespace: true,
          isPreview: true,
          isProduction: true,
        },
      })
    : null;

  const namespace =
    environment?.namespace ??
    (environment
      ? buildEnvironmentNamespace(input.project.slug, environment)
      : buildProjectNamespaceBase(input.project.slug));
  const resourceName = buildProjectScopedK8sName(
    input.project.slug,
    environment?.isPreview ? environment.name : environment?.isProduction ? 'prod' : null,
    input.database.name
  );

  return {
    environment: environment ?? null,
    namespace,
    resourceName,
  };
}

function buildManagedPostgresIdentifier(input: {
  database: DatabaseRecord;
  project: ProjectRecord;
  environment: {
    name: string;
    isPreview: boolean | null;
    isProduction: boolean | null;
  } | null;
}): string {
  const environmentSegment = input.environment?.isPreview
    ? sanitizePgName(input.environment.name)
    : input.environment?.isProduction
      ? 'prod'
      : null;

  return [
    'juanie',
    sanitizePgName(input.project.slug),
    environmentSegment,
    sanitizePgName(input.database.name),
  ]
    .filter(Boolean)
    .join('_')
    .slice(0, 63);
}

function getManagedDatabaseUsername(type: DatabaseRecord['type']): string | null {
  switch (type) {
    case 'postgresql':
      return 'postgres';
    case 'mysql':
      return 'root';
    default:
      return null;
  }
}

function getManagedDatabasePort(type: DatabaseRecord['type']): number | null {
  switch (type) {
    case 'postgresql':
      return 5432;
    case 'mysql':
      return 3306;
    case 'redis':
      return 6379;
    default:
      return null;
  }
}

function buildManagedDatabaseSecretData(
  type: DatabaseRecord['type'],
  password: string
): Record<string, string> {
  switch (type) {
    case 'postgresql':
      return { POSTGRES_PASSWORD: password };
    case 'mysql':
      return { MYSQL_ROOT_PASSWORD: password };
    case 'redis':
      return { password };
    default:
      return { password };
  }
}

function buildStandaloneConnectionString(input: {
  type: DatabaseRecord['type'];
  host: string;
  password: string;
  databaseName: string;
}): string {
  const encodedPassword = quoteConnectionPassword(input.password);

  switch (input.type) {
    case 'postgresql':
      return buildNormalizedPostgresUrl({
        username: 'postgres',
        password: input.password,
        host: input.host,
        port: 5432,
        databaseName: input.databaseName,
      });
    case 'mysql':
      return `mysql://root:${encodedPassword}@${input.host}:3306/${input.databaseName}`;
    case 'redis':
      return `redis://:${encodedPassword}@${input.host}:6379`;
    case 'mongodb':
      return `mongodb://root:${encodedPassword}@${input.host}:27017/${input.databaseName}`;
    default:
      return '';
  }
}

async function createRedisDeployment(
  namespace: string,
  name: string,
  secretName: string
): Promise<void> {
  const { apps } = getK8sClient();

  await apps.createNamespacedDeployment({
    namespace,
    body: {
      apiVersion: 'apps/v1',
      kind: 'Deployment',
      metadata: { name },
      spec: {
        replicas: 1,
        selector: { matchLabels: { app: name } },
        template: {
          metadata: { labels: { app: name } },
          spec: {
            containers: [
              {
                name: 'redis',
                image: 'redis:7-alpine',
                ports: [{ containerPort: 6379 }],
                env: [
                  {
                    name: 'REDIS_PASSWORD',
                    valueFrom: {
                      secretKeyRef: {
                        name: secretName,
                        key: 'password',
                      },
                    },
                  },
                ],
                command: ['sh', '-c'],
                args: ['redis-server --requirepass "$REDIS_PASSWORD"'],
              },
            ],
          },
        },
      },
    },
  });
}

async function createMySQLStatefulSet(
  namespace: string,
  name: string,
  dbName: string,
  secretName: string
): Promise<void> {
  await createStatefulSet(namespace, name, {
    image: 'mysql:8',
    serviceName: name,
    port: 3306,
    replicas: 1,
    env: {
      MYSQL_DATABASE: dbName,
    },
    envFrom: {
      secretName,
    },
    volumeName: 'data',
    storageSize: '10Gi',
    mountPath: '/var/lib/mysql',
  });
}

async function provisionExternalDatabase(input: ManagedDatabaseProvisionInput): Promise<void> {
  const runtimeAccessCheck = await verifyDeclaredDatabaseRuntimeAccess(input.database);
  if (!runtimeAccessCheck.satisfied) {
    await db
      .update(databases)
      .set({ runtime: 'external', status: 'failed' })
      .where(eq(databases.id, input.database.id));
    throw new Error(formatDatabaseRuntimeAccessIssues(input.database, runtimeAccessCheck.issues));
  }

  const capabilityCheck = await verifyDeclaredDatabaseCapabilities(input.database);
  await db
    .update(databases)
    .set({
      runtime: 'external',
      status: capabilityCheck.satisfied ? 'running' : 'failed',
      updatedAt: new Date(),
    })
    .where(eq(databases.id, input.database.id));

  if (!capabilityCheck.satisfied) {
    throw new Error(formatDatabaseCapabilityIssues(input.database, capabilityCheck.issues));
  }
}

async function provisionSharedPostgres(input: ManagedDatabaseProvisionInput): Promise<void> {
  let adminUrl: string;
  try {
    adminUrl = getNormalizedDatabaseUrlFromEnv();
  } catch {
    throw new Error(
      'Control-plane database config is incomplete; cannot provision shared PostgreSQL'
    );
  }

  const { environment } = await getDatabaseEnvironmentContext(input);
  const dbIdentifier = buildManagedPostgresIdentifier({
    database: input.database,
    project: input.project,
    environment,
  });
  const dbPassword = nanoid(32);
  const provisionStatements = buildManagedPostgresProvisionStatements({
    databaseName: dbIdentifier,
    owner: dbIdentifier,
    password: dbPassword,
  });

  const adminConn = postgres(adminUrl, { max: 1 });

  try {
    await adminConn.unsafe(provisionStatements.roleCreateOrUpdate);

    const [databaseExists] = await adminConn<{ exists: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = ${dbIdentifier}) AS exists
    `;

    if (!databaseExists?.exists) {
      await adminConn.unsafe(provisionStatements.databaseCreate);
    }

    await adminConn.unsafe(provisionStatements.databaseOwnerStatement);
    for (const statement of provisionStatements.databaseGrants) {
      await adminConn.unsafe(statement);
    }

    const parsedUrl = new URL(adminUrl);
    const host = toClusterFqdn(parsedUrl.hostname);
    const port = Number.parseInt(parsedUrl.port || '5432', 10);
    const connectionString = buildNormalizedPostgresUrl({
      username: dbIdentifier,
      password: dbPassword,
      host,
      port,
      databaseName: dbIdentifier,
    });

    const bootstrapUrl = new URL(adminUrl);
    bootstrapUrl.pathname = `/${dbIdentifier}`;
    const bootstrapConn = postgres(bootstrapUrl.toString(), { max: 1 });
    try {
      for (const statement of provisionStatements.schemaBootstrapStatements) {
        await bootstrapConn.unsafe(statement);
      }
    } finally {
      await bootstrapConn.end().catch(() => undefined);
    }

    await db
      .update(databases)
      .set({
        runtime: 'shared_postgres',
        connectionString,
        host,
        port,
        databaseName: dbIdentifier,
        username: dbIdentifier,
        password: dbPassword,
        status: 'pending',
        updatedAt: new Date(),
      })
      .where(eq(databases.id, input.database.id));

    await assertManagedPostgresRuntimeAccess({
      type: 'postgresql',
      provisionType: 'shared',
      host,
      port,
      databaseName: dbIdentifier,
      username: dbIdentifier,
      connectionString,
    });

    const latestDatabase = await db.query.databases.findFirst({
      where: eq(databases.id, input.database.id),
    });
    if (!latestDatabase) {
      throw new Error(`数据库 ${input.database.name} 在共享库初始化后丢失，无法兑现能力`);
    }

    const capabilityCheck = await reconcileDeclaredDatabaseCapabilities(latestDatabase);

    await db
      .update(databases)
      .set({
        runtime: 'shared_postgres',
        status: capabilityCheck.satisfied ? 'running' : 'failed',
        updatedAt: new Date(),
      })
      .where(eq(databases.id, input.database.id));

    if (!capabilityCheck.satisfied) {
      throw new Error(formatDatabaseCapabilityIssues(input.database, capabilityCheck.issues));
    }
  } finally {
    await adminConn.end().catch(() => undefined);
  }
}

async function provisionSharedRedis(input: ManagedDatabaseProvisionInput): Promise<void> {
  const sharedRedis = await db
    .select({ id: databases.id })
    .from(databases)
    .where(
      and(
        eq(databases.type, 'redis'),
        eq(databases.provisionType, 'shared'),
        ne(databases.id, input.database.id)
      )
    );
  const dbIndex = sharedRedis.length + 1;
  const redisHost = toClusterFqdn(process.env.REDIS_HOST || 'localhost');
  const redisPort = Number.parseInt(process.env.REDIS_PORT || '6379', 10);
  const redisPassword = process.env.REDIS_PASSWORD;
  const connectionString = redisPassword
    ? `redis://:${quoteConnectionPassword(redisPassword)}@${redisHost}:${redisPort}/${dbIndex}`
    : `redis://${redisHost}:${redisPort}/${dbIndex}`;

  await db
    .update(databases)
    .set({
      runtime: 'shared_redis',
      status: 'running',
      connectionString,
      host: redisHost,
      port: redisPort,
      databaseName: String(dbIndex),
      updatedAt: new Date(),
    })
    .where(eq(databases.id, input.database.id));
}

async function provisionNativeK8sDatabase(input: ManagedDatabaseProvisionInput): Promise<void> {
  if (!input.hasK8s) {
    await db
      .update(databases)
      .set({ runtime: 'native_k8s', status: 'running', updatedAt: new Date() })
      .where(eq(databases.id, input.database.id));
    return;
  }

  const { namespace, resourceName } = await getDatabaseEnvironmentContext(input);
  const dbPassword = nanoid(32);
  const secretName = `${resourceName}-creds`;

  await createNamespace(namespace);
  await upsertSecret(
    namespace,
    secretName,
    buildManagedDatabaseSecretData(input.database.type, dbPassword)
  );

  if (input.database.type === 'postgresql') {
    await createStatefulSet(namespace, resourceName, {
      image: resolveManagedPostgresImage(input.database.capabilities),
      serviceName: resourceName,
      port: 5432,
      replicas: 1,
      env: {
        POSTGRES_DB: input.database.name,
        PGDATA: '/var/lib/postgresql/data/pgdata',
      },
      envFrom: {
        secretName,
      },
      volumeName: 'data',
      storageSize: '10Gi',
      mountPath: '/var/lib/postgresql/data',
    });
    await createService(namespace, resourceName, { port: 5432, targetPort: 5432 });
  } else if (input.database.type === 'redis') {
    await createRedisDeployment(namespace, resourceName, secretName);
    await createService(namespace, resourceName, { port: 6379, targetPort: 6379 });
  } else if (input.database.type === 'mysql') {
    await createMySQLStatefulSet(namespace, resourceName, input.database.name, secretName);
    await createService(namespace, resourceName, { port: 3306, targetPort: 3306 });
  } else {
    await db.update(databases).set({ status: 'failed' }).where(eq(databases.id, input.database.id));
    throw new Error(`当前不支持以 standalone 方式供应 ${input.database.type} 数据库`);
  }

  const host = `${resourceName}.${namespace}.svc.cluster.local`;
  const connectionString = buildStandaloneConnectionString({
    type: input.database.type,
    host,
    password: dbPassword,
    databaseName: input.database.name,
  });

  await db
    .update(databases)
    .set({
      runtime: 'native_k8s',
      connectionString,
      host,
      port: getManagedDatabasePort(input.database.type),
      databaseName: input.database.type === 'redis' ? null : input.database.name,
      username: getManagedDatabaseUsername(input.database.type),
      password: dbPassword,
      serviceName: resourceName,
      namespace,
      status: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(databases.id, input.database.id));

  const latestDatabase = await db.query.databases.findFirst({
    where: eq(databases.id, input.database.id),
  });
  if (!latestDatabase) {
    throw new Error(`数据库 ${input.database.name} 在供应完成后丢失，无法兑现能力`);
  }

  const capabilityCheck = await reconcileDeclaredDatabaseCapabilities(latestDatabase);

  await db
    .update(databases)
    .set({
      runtime: 'native_k8s',
      status: capabilityCheck.satisfied ? 'running' : 'failed',
      updatedAt: new Date(),
    })
    .where(eq(databases.id, input.database.id));

  if (!capabilityCheck.satisfied) {
    throw new Error(formatDatabaseCapabilityIssues(input.database, capabilityCheck.issues));
  }
}

async function provisionCloudNativePgDatabase(input: ManagedDatabaseProvisionInput): Promise<void> {
  if (!input.hasK8s) {
    await db
      .update(databases)
      .set({ runtime: 'cloudnativepg', status: 'running', updatedAt: new Date() })
      .where(eq(databases.id, input.database.id));
    return;
  }

  const { environment, namespace, resourceName } = await getDatabaseEnvironmentContext(input);
  const dbIdentifier = buildManagedPostgresIdentifier({
    database: input.database,
    project: input.project,
    environment,
  });
  const dbPassword = nanoid(32);
  const credentialsSecretName = `${resourceName}-app`;

  await createNamespace(namespace);
  await upsertSecret(
    namespace,
    credentialsSecretName,
    {
      username: dbIdentifier,
      password: dbPassword,
    },
    'kubernetes.io/basic-auth'
  );
  await upsertCloudNativePgCluster(
    buildCloudNativePgClusterManifest({
      name: resourceName,
      namespace,
      databaseName: dbIdentifier,
      owner: dbIdentifier,
      credentialsSecretName,
      storageSize: '10Gi',
      capabilities: input.database.capabilities,
    })
  );

  const connection = buildCloudNativePgConnectionDetails({
    clusterName: resourceName,
    namespace,
    username: dbIdentifier,
    password: dbPassword,
    databaseName: dbIdentifier,
  });

  await db
    .update(databases)
    .set({
      runtime: 'cloudnativepg',
      connectionString: connection.connectionString,
      host: connection.host,
      port: connection.port,
      databaseName: connection.databaseName,
      username: connection.username,
      password: dbPassword,
      serviceName: connection.serviceName,
      namespace,
      status: 'pending',
      updatedAt: new Date(),
    })
    .where(eq(databases.id, input.database.id));

  const latestDatabase = await db.query.databases.findFirst({
    where: eq(databases.id, input.database.id),
  });
  if (!latestDatabase) {
    throw new Error(`数据库 ${input.database.name} 在 CloudNativePG 初始化后丢失`);
  }

  const capabilityCheck = await reconcileDeclaredDatabaseCapabilities(latestDatabase);

  await db
    .update(databases)
    .set({
      runtime: 'cloudnativepg',
      status: capabilityCheck.satisfied ? 'running' : 'failed',
      updatedAt: new Date(),
    })
    .where(eq(databases.id, input.database.id));

  if (!capabilityCheck.satisfied) {
    throw new Error(formatDatabaseCapabilityIssues(input.database, capabilityCheck.issues));
  }
}

async function deprovisionSharedRedisDatabase(
  database: ManagedDatabaseCleanupTarget
): Promise<boolean> {
  if (database.type !== 'redis' || !database.connectionString) {
    return false;
  }

  const client = new Redis(database.connectionString, {
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableOfflineQueue: false,
  });

  try {
    await client.connect();
    await client.flushdb();
    return true;
  } finally {
    await client.quit().catch(() => client.disconnect());
  }
}

async function deprovisionNativeK8sDatabase(
  database: ManagedDatabaseCleanupTarget
): Promise<boolean> {
  if (!database.namespace || !database.serviceName || !isK8sAvailable()) {
    return false;
  }

  const secretName = `${database.serviceName}-creds`;

  if (database.type === 'redis') {
    await deleteDeployment(database.namespace, database.serviceName).catch(() => undefined);
  } else {
    await deleteStatefulSet(database.namespace, database.serviceName).catch(() => undefined);
  }

  await deleteService(database.namespace, database.serviceName).catch(() => undefined);
  await deleteSecret(database.namespace, secretName).catch(() => undefined);
  return true;
}

async function deprovisionCloudNativePgDatabase(
  database: ManagedDatabaseCleanupTarget
): Promise<boolean> {
  if (!database.namespace || !database.serviceName || !isK8sAvailable()) {
    return false;
  }

  const clusterName = database.serviceName.endsWith('-rw')
    ? database.serviceName.slice(0, -3)
    : database.serviceName;
  const credentialsSecretName = `${clusterName}-app`;

  await deleteCloudNativePgCluster(database.namespace, clusterName).catch(() => undefined);
  await deleteSecret(database.namespace, credentialsSecretName).catch(() => undefined);
  return true;
}

const externalProvider: ManagedDatabaseProvider = {
  id: 'external',
  provision: provisionExternalDatabase,
  deprovision: async () => false,
};

const sharedPostgresProvider: ManagedDatabaseProvider = {
  id: 'shared_postgres',
  provision: provisionSharedPostgres,
  deprovision: deprovisionManagedPostgresDatabase,
};

const sharedRedisProvider: ManagedDatabaseProvider = {
  id: 'shared_redis',
  provision: provisionSharedRedis,
  deprovision: deprovisionSharedRedisDatabase,
};

const nativeK8sProvider: ManagedDatabaseProvider = {
  id: 'native_k8s',
  provision: provisionNativeK8sDatabase,
  deprovision: deprovisionNativeK8sDatabase,
};

const cloudNativePgProvider: ManagedDatabaseProvider = {
  id: 'cloudnativepg',
  provision: provisionCloudNativePgDatabase,
  deprovision: deprovisionCloudNativePgDatabase,
};

export function resolveManagedDatabaseProvider(
  database: DatabaseProviderTarget
): ManagedDatabaseProvider {
  const runtime = getDatabaseRuntime(database);

  switch (runtime) {
    case 'external':
      return externalProvider;
    case 'shared_postgres':
      return sharedPostgresProvider;
    case 'shared_redis':
      return sharedRedisProvider;
    case 'cloudnativepg':
      return cloudNativePgProvider;
    case 'native_k8s':
      return nativeK8sProvider;
  }
}

export async function provisionManagedDatabase(
  input: ManagedDatabaseProvisionInput
): Promise<void> {
  const provisionType = resolveDatabaseProvisionType(
    input.database.type,
    toPlatformDatabaseProvisionType(input.database.provisionType)
  );

  if (!supportsDatabaseProvisionType(input.database.type, provisionType)) {
    await db.update(databases).set({ status: 'failed' }).where(eq(databases.id, input.database.id));
    throw new Error(
      formatUnsupportedDatabaseProvisionTypeMessage(input.database.type, provisionType)
    );
  }

  return resolveManagedDatabaseProvider(input.database).provision(input);
}

export async function deprovisionManagedDatabase(
  database: ManagedDatabaseCleanupTarget
): Promise<boolean> {
  return resolveManagedDatabaseProvider(database).deprovision(database);
}
