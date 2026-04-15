import Redis, { type RedisOptions } from 'ioredis';

const DEFAULT_REDIS_HOST = 'localhost';
const DEFAULT_REDIS_PORT = 6379;

function parseRedisDatabase(pathname: string): number | undefined {
  const value = pathname.replace(/^\//, '').trim();
  if (!value) {
    return undefined;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? undefined : parsed;
}

export function isRedisConfigured(): boolean {
  return Boolean(process.env.REDIS_URL || process.env.REDIS_HOST);
}

export function resolveRedisConnectionOptions(overrides: RedisOptions = {}): RedisOptions {
  const redisUrl = process.env.REDIS_URL?.trim();

  if (redisUrl) {
    const parsed = new URL(redisUrl);

    return {
      host: parsed.hostname,
      port: parsed.port ? Number.parseInt(parsed.port, 10) : DEFAULT_REDIS_PORT,
      username: parsed.username ? decodeURIComponent(parsed.username) : undefined,
      password: parsed.password ? decodeURIComponent(parsed.password) : undefined,
      db: parseRedisDatabase(parsed.pathname),
      tls: parsed.protocol === 'rediss:' ? {} : undefined,
      ...overrides,
    };
  }

  const redisPort = Number.parseInt(process.env.REDIS_PORT || `${DEFAULT_REDIS_PORT}`, 10);
  const redisDb = process.env.REDIS_DB ? Number.parseInt(process.env.REDIS_DB, 10) : undefined;

  return {
    host: process.env.REDIS_HOST || DEFAULT_REDIS_HOST,
    port: Number.isNaN(redisPort) ? DEFAULT_REDIS_PORT : redisPort,
    password: process.env.REDIS_PASSWORD,
    db: redisDb,
    ...overrides,
  };
}

export function createRedisClient(overrides: RedisOptions = {}): Redis {
  return new Redis(resolveRedisConnectionOptions(overrides));
}
