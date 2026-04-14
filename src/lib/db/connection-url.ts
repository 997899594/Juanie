export function normalizeDatabaseUrl(rawUrl: string): string {
  const normalized = rawUrl.trim();
  if (!normalized) {
    throw new Error('DATABASE_URL is required');
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

export function getNormalizedDatabaseUrlFromEnv(): string {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error('DATABASE_URL is required');
  }

  return normalizeDatabaseUrl(databaseUrl);
}
