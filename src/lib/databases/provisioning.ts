import { and, eq, inArray, isNull } from 'drizzle-orm';
import { encrypt } from '@/lib/crypto';
import { db } from '@/lib/db';
import { databases, environmentVariables, projects } from '@/lib/db/schema';
import { logger } from '@/lib/logger';
import { provisionManagedDatabase } from './provider';

const databaseProvisioningLogger = logger.child({ component: 'database-provisioning' });

/**
 * 数据库供应是数据库领域能力，不属于项目初始化编排。
 * project-init / preview clone 都只能调用这里，避免两套注入环境变量路径。
 */
export async function provisionDatabase(
  database: typeof databases.$inferSelect,
  project: typeof projects.$inferSelect,
  hasK8s: boolean
): Promise<void> {
  await provisionManagedDatabase({
    database,
    project,
    hasK8s,
  });
}

function parseConnUrl(connStr: string): {
  host: string;
  port: string;
  user: string;
  password: string;
  database: string;
} {
  try {
    const url = new URL(connStr);
    return {
      host: url.hostname,
      port: url.port,
      user: url.username ? decodeURIComponent(url.username) : '',
      password: url.password ? decodeURIComponent(url.password) : '',
      database: url.pathname?.length > 1 ? url.pathname.slice(1) : '',
    };
  } catch {
    return { host: '', port: '', user: '', password: '', database: '' };
  }
}

const sensitiveEnvKeys = new Set([
  'DATABASE_URL',
  'POSTGRES_PASSWORD',
  'REDIS_URL',
  'REDIS_PASSWORD',
  'MYSQL_URL',
  'MYSQL_PASSWORD',
  'MONGODB_URL',
  'MONGODB_PASSWORD',
]);

async function upsertEnvVar(
  projectId: string,
  environmentId: string | null,
  key: string,
  value: string,
  isSecret?: boolean
): Promise<void> {
  const sensitive = isSecret ?? sensitiveEnvKeys.has(key);
  const envIdClause = environmentId
    ? eq(environmentVariables.environmentId, environmentId)
    : isNull(environmentVariables.environmentId);

  const existing = await db.query.environmentVariables.findFirst({
    where: and(
      eq(environmentVariables.projectId, projectId),
      eq(environmentVariables.key, key),
      envIdClause,
      isNull(environmentVariables.serviceId)
    ),
  });

  if (sensitive) {
    const { encryptedValue, iv, authTag } = await encrypt(value);
    if (existing) {
      await db
        .update(environmentVariables)
        .set({ value: null, isSecret: true, encryptedValue, iv, authTag, updatedAt: new Date() })
        .where(eq(environmentVariables.id, existing.id));
    } else {
      await db.insert(environmentVariables).values({
        projectId,
        environmentId,
        key,
        value: null,
        isSecret: true,
        encryptedValue,
        iv,
        authTag,
        injectionType: 'runtime',
      });
    }
    return;
  }

  if (existing) {
    await db
      .update(environmentVariables)
      .set({ value, updatedAt: new Date() })
      .where(eq(environmentVariables.id, existing.id));
    return;
  }

  await db.insert(environmentVariables).values({
    projectId,
    environmentId,
    key,
    value,
    isSecret: false,
    injectionType: 'runtime',
  });
}

export async function injectDatabaseEnvVars(
  database: typeof databases.$inferSelect,
  project: typeof projects.$inferSelect,
  environmentId: string | null = null
): Promise<void> {
  if (!database.connectionString) return;

  const parsed = parseConnUrl(database.connectionString);
  const vars: Record<string, string> = {};

  switch (database.type) {
    case 'postgresql':
      vars['DATABASE_URL'] = database.connectionString;
      if (parsed.host) vars['POSTGRES_HOST'] = parsed.host;
      if (parsed.port) vars['POSTGRES_PORT'] = parsed.port;
      if (parsed.user) vars['POSTGRES_USER'] = parsed.user;
      if (parsed.password) vars['POSTGRES_PASSWORD'] = parsed.password;
      if (parsed.database) vars['POSTGRES_DB'] = parsed.database;
      break;
    case 'redis':
      vars['REDIS_URL'] = database.connectionString;
      if (parsed.host) vars['REDIS_HOST'] = parsed.host;
      if (parsed.port) vars['REDIS_PORT'] = parsed.port;
      if (parsed.password) vars['REDIS_PASSWORD'] = parsed.password;
      if (parsed.database && parsed.database !== '0') vars['REDIS_DB'] = parsed.database;
      break;
    case 'mysql':
      vars['MYSQL_URL'] = database.connectionString;
      if (parsed.host) vars['MYSQL_HOST'] = parsed.host;
      if (parsed.port) vars['MYSQL_PORT'] = parsed.port;
      if (parsed.user) vars['MYSQL_USER'] = parsed.user;
      if (parsed.password) vars['MYSQL_PASSWORD'] = parsed.password;
      if (parsed.database) vars['MYSQL_DATABASE'] = parsed.database;
      break;
    case 'mongodb':
      vars['MONGODB_URL'] = database.connectionString;
      if (parsed.host) vars['MONGODB_HOST'] = parsed.host;
      if (parsed.port) vars['MONGODB_PORT'] = parsed.port;
      if (parsed.user) vars['MONGODB_USER'] = parsed.user;
      if (parsed.password) vars['MONGODB_PASSWORD'] = parsed.password;
      if (parsed.database) vars['MONGODB_DATABASE'] = parsed.database;
      break;
  }

  for (const [key, value] of Object.entries(vars)) {
    await upsertEnvVar(project.id, environmentId, key, value);
  }

  const scope = environmentId ? `env:${environmentId.slice(0, 8)}` : 'project-scoped';
  databaseProvisioningLogger.info('Injected database environment variables', {
    projectId: project.id,
    databaseId: database.id,
    databaseName: database.name,
    scope,
    variableCount: Object.keys(vars).length,
    variableKeys: Object.keys(vars),
  });
}

const databaseEnvKeys = [
  'DATABASE_URL',
  'POSTGRES_HOST',
  'POSTGRES_PORT',
  'POSTGRES_USER',
  'POSTGRES_PASSWORD',
  'POSTGRES_DB',
  'REDIS_URL',
  'REDIS_HOST',
  'REDIS_PORT',
  'REDIS_PASSWORD',
  'REDIS_DB',
  'MYSQL_URL',
  'MYSQL_HOST',
  'MYSQL_PORT',
  'MYSQL_USER',
  'MYSQL_PASSWORD',
  'MYSQL_DATABASE',
  'MONGODB_URL',
  'MONGODB_HOST',
  'MONGODB_PORT',
  'MONGODB_USER',
  'MONGODB_PASSWORD',
  'MONGODB_DATABASE',
] as const;

export async function removeInjectedDatabaseEnvVars(
  projectId: string,
  environmentId: string
): Promise<void> {
  await db
    .delete(environmentVariables)
    .where(
      and(
        eq(environmentVariables.projectId, projectId),
        eq(environmentVariables.environmentId, environmentId),
        isNull(environmentVariables.serviceId),
        inArray(environmentVariables.key, [...databaseEnvKeys])
      )
    );
}
