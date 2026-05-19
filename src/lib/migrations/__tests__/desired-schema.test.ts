import { describe, expect, it } from 'bun:test';
import {
  addPostgresCapabilityExtensionsToSchemaSql,
  resolveDrizzleExportOptionsFromConfig,
  validateDesiredSchemaSqlOutput,
} from '@/lib/migrations/desired-schema';

describe('desired schema export helpers', () => {
  it('uses schema and dialect from drizzle config without db credentials', () => {
    expect(
      resolveDrizzleExportOptionsFromConfig({
        dialect: 'postgresql',
        schema: './db/schema.ts',
        dbCredentials: {
          url: 'postgresql://example',
        },
      })
    ).toEqual({
      dialect: 'postgresql',
      schema: './db/schema.ts',
    });
  });

  it('rejects interactive drizzle output instead of treating it as schema sql', () => {
    expect(() =>
      validateDesiredSchemaSqlOutput(`
Reading config file '/tmp/repo/drizzle.config.mjs'
Using 'postgres' driver for database querying
[✓] Pulling schema from database...
error: Interactive prompts require a TTY terminal
`)
    ).toThrow(/交互式提示/);
  });

  it('accepts real drizzle schema export sql', () => {
    expect(
      validateDesiredSchemaSqlOutput(`
CREATE TABLE "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL
);
`)
    ).toContain('CREATE TABLE "users"');
  });

  it('prepends declared postgres capability extensions to desired schema sql', () => {
    expect(
      addPostgresCapabilityExtensionsToSchemaSql('CREATE TABLE chunks (embedding vector(1536));', [
        'vector',
        'pg_trgm',
      ])
    ).toBe(
      'CREATE EXTENSION IF NOT EXISTS "pg_trgm";\n' +
        'CREATE EXTENSION IF NOT EXISTS "vector";\n\n' +
        'CREATE TABLE chunks (embedding vector(1536));'
    );
  });
});
