import crypto from 'node:crypto';
import mysql from 'mysql2/promise';
import { Client as PgClient } from 'pg';
import { hasExecutable, normalizeAtlasDatabaseUrl } from '@/lib/atlas/cli';
import { getNormalizedDatabaseUrlFromEnv, normalizeDatabaseUrl } from '@/lib/db/connection-url';

export type AtlasDevDatabaseType = 'postgresql' | 'mysql';

export interface AtlasDevDatabaseSession {
  url: string;
  cleanup: () => Promise<void>;
}

const ATLAS_DEV_URL_ENV_NAMES: Record<AtlasDevDatabaseType, string[]> = {
  postgresql: ['ATLAS_DEV_URL_POSTGRESQL', 'ATLAS_DEV_URL'],
  mysql: ['ATLAS_DEV_URL_MYSQL', 'ATLAS_DEV_URL'],
};

export function getDefaultAtlasDevUrl(databaseType: AtlasDevDatabaseType): string {
  return databaseType === 'postgresql' ? 'docker://postgres/16/dev' : 'docker://mysql/8/dev';
}

export function getAtlasDevUrlEnvNames(databaseType: AtlasDevDatabaseType): string[] {
  return [...ATLAS_DEV_URL_ENV_NAMES[databaseType]];
}

export function resolveAtlasDevUrlOverrideFromEnv(
  databaseType: AtlasDevDatabaseType,
  env: Record<string, string | undefined> = process.env
): string | null {
  for (const key of getAtlasDevUrlEnvNames(databaseType)) {
    const value = env[key]?.trim();
    if (value) {
      return value;
    }
  }

  return null;
}

function isDockerAtlasDevUrl(value: string): boolean {
  return value.startsWith('docker://');
}

function buildScratchIdentifier(prefix: string): string {
  const suffix = crypto.randomUUID().replaceAll('-', '').slice(0, 20);
  return `${prefix}_${suffix}`;
}

function normalizeConfiguredPostgresDevUrl(rawUrl: string): string {
  return normalizeAtlasDatabaseUrl(normalizeDatabaseUrl(rawUrl));
}

function normalizeConfiguredMySqlDevUrl(rawUrl: string): string {
  return normalizeAtlasDatabaseUrl(rawUrl.trim());
}

export function buildPostgresScratchSearchPath(schemaName: string): string {
  return `${schemaName},public`;
}

async function createPostgresScratchSchema(baseUrl: string): Promise<AtlasDevDatabaseSession> {
  const normalizedBaseUrl = normalizeConfiguredPostgresDevUrl(baseUrl);
  const schemaName = buildScratchIdentifier('atlas_dev');
  const adminClient = new PgClient({ connectionString: normalizedBaseUrl });

  await adminClient.connect();

  try {
    await adminClient.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);
  } finally {
    await adminClient.end().catch(() => undefined);
  }

  const url = new URL(normalizedBaseUrl);
  url.searchParams.set('search_path', buildPostgresScratchSearchPath(schemaName));

  return {
    url: url.toString(),
    cleanup: async () => {
      const cleanupClient = new PgClient({ connectionString: normalizedBaseUrl });

      await cleanupClient.connect();

      try {
        await cleanupClient.query(`DROP SCHEMA IF EXISTS "${schemaName}" CASCADE`);
      } finally {
        await cleanupClient.end().catch(() => undefined);
      }
    },
  };
}

async function createMySqlScratchDatabase(baseUrl: string): Promise<AtlasDevDatabaseSession> {
  const normalizedBaseUrl = normalizeConfiguredMySqlDevUrl(baseUrl);
  const scratchDatabase = buildScratchIdentifier('atlas_dev');
  const adminConnection = await mysql.createConnection({
    uri: normalizedBaseUrl,
  });

  try {
    await adminConnection.query(`CREATE DATABASE IF NOT EXISTS \`${scratchDatabase}\``);
  } finally {
    await adminConnection.end().catch(() => undefined);
  }

  const url = new URL(normalizedBaseUrl);
  url.pathname = `/${encodeURIComponent(scratchDatabase)}`;

  return {
    url: url.toString(),
    cleanup: async () => {
      const cleanupConnection = await mysql.createConnection({
        uri: normalizedBaseUrl,
      });

      try {
        await cleanupConnection.query(`DROP DATABASE IF EXISTS \`${scratchDatabase}\``);
      } finally {
        await cleanupConnection.end().catch(() => undefined);
      }
    },
  };
}

async function createConfiguredAtlasDevSession(
  databaseType: AtlasDevDatabaseType,
  configuredUrl: string
): Promise<AtlasDevDatabaseSession> {
  if (isDockerAtlasDevUrl(configuredUrl)) {
    if (!hasExecutable('docker')) {
      throw new Error(
        `当前环境缺少 Docker，无法使用 ${configuredUrl}。请改为设置 ${getAtlasDevUrlEnvNames(databaseType).join(' / ')} 指向平台可访问的 ${databaseType} dev database`
      );
    }

    return {
      url: configuredUrl,
      cleanup: async () => {},
    };
  }

  const protocol = (() => {
    try {
      return new URL(configuredUrl).protocol;
    } catch {
      return null;
    }
  })();

  if (databaseType === 'postgresql') {
    if (!protocol || !['postgres:', 'postgresql:'].includes(protocol)) {
      throw new Error(
        `${getAtlasDevUrlEnvNames(databaseType)[0]} 必须是 PostgreSQL 连接串或 docker:// URL`
      );
    }

    return createPostgresScratchSchema(configuredUrl);
  }

  if (protocol !== 'mysql:') {
    throw new Error(
      `${getAtlasDevUrlEnvNames(databaseType)[0]} 必须是 MySQL 连接串或 docker:// URL`
    );
  }

  return createMySqlScratchDatabase(configuredUrl);
}

export async function prepareAtlasDevDatabaseSession(
  databaseType: AtlasDevDatabaseType
): Promise<AtlasDevDatabaseSession> {
  const configuredUrl = resolveAtlasDevUrlOverrideFromEnv(databaseType);
  if (configuredUrl) {
    return createConfiguredAtlasDevSession(databaseType, configuredUrl);
  }

  if (databaseType === 'postgresql') {
    try {
      return await createPostgresScratchSchema(getNormalizedDatabaseUrlFromEnv());
    } catch (error) {
      if (!hasExecutable('docker')) {
        const message = error instanceof Error ? error.message : String(error);
        throw new Error(
          `无法准备 PostgreSQL Atlas dev database: ${message}。请配置 ${getAtlasDevUrlEnvNames(databaseType).join(' / ')}，或提供可用的控制面 PostgreSQL 环境变量`
        );
      }
    }
  }

  if (hasExecutable('docker')) {
    return {
      url: getDefaultAtlasDevUrl(databaseType),
      cleanup: async () => {},
    };
  }

  throw new Error(
    `当前环境缺少 ${databaseType} 可用的 Atlas dev database，请配置 ${getAtlasDevUrlEnvNames(databaseType).join(' / ')}`
  );
}
