export function normalizeDatabaseUrl(rawUrl: string): string {
  const normalized = rawUrl.trim();
  if (!normalized) {
    throw new Error('Database URL is required');
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return normalized;
  }

  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    return normalized;
  }

  const sslMode =
    process.env.DATABASE_SSL_MODE?.trim() || process.env.PGSSLMODE?.trim() || undefined;

  if (sslMode && !parsed.searchParams.has('sslmode')) {
    parsed.searchParams.set('sslmode', sslMode);
  }

  return parsed.toString();
}

function parseOptionalPort(rawPort?: string | null): number | null {
  if (!rawPort?.trim()) {
    return null;
  }

  const parsed = Number.parseInt(rawPort, 10);
  return Number.isNaN(parsed) ? null : parsed;
}

type DatabaseUrlComponents = {
  username: string;
  password?: string | null;
  host: string;
  port?: number | null;
  databaseName: string;
};

export function getDatabaseUrlComponentsFromEnv(): DatabaseUrlComponents | null {
  const host = process.env.DATABASE_HOST?.trim();
  const databaseName = process.env.DATABASE_NAME?.trim() || process.env.POSTGRES_DB?.trim();
  const username = process.env.DATABASE_USER?.trim() || process.env.POSTGRES_USER?.trim();
  const password =
    process.env.DATABASE_PASSWORD?.trim() || process.env.POSTGRES_PASSWORD?.trim() || null;

  if (!host || !databaseName || !username || !password) {
    return null;
  }

  return {
    username,
    password,
    host,
    port:
      parseOptionalPort(process.env.DATABASE_PORT) ?? parseOptionalPort(process.env.POSTGRES_PORT),
    databaseName,
  };
}

export function buildNormalizedPostgresUrl(input: {
  username: string;
  password?: string | null;
  host: string;
  port?: number | null;
  databaseName: string;
}): string {
  const username = encodeURIComponent(input.username);
  const password = encodeURIComponent(input.password ?? '');
  const auth = input.password ? `${username}:${password}` : username;
  const port = input.port ? `:${input.port}` : '';

  return normalizeDatabaseUrl(
    `postgresql://${auth}@${input.host}${port}/${encodeURIComponent(input.databaseName)}`
  );
}

export function getNormalizedDatabaseUrlFromEnv(): string {
  const components = getDatabaseUrlComponentsFromEnv();
  if (!components) {
    throw new Error(
      'DATABASE_HOST, DATABASE_NAME, DATABASE_USER, and DATABASE_PASSWORD are required'
    );
  }

  return buildNormalizedPostgresUrl(components);
}
